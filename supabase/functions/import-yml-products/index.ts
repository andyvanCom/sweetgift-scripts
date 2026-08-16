import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { XMLParser } from "https://esm.sh/fast-xml-parser@4.5.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const PRODUCT_BATCH_SIZE = 100;
const INGREDIENT_BATCH_SIZE = 500;

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

function arr<T>(value: T | T[] | undefined | null): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function text(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return String(value).trim() || null;
}

function normalizeUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).toString();
  } catch {
    return url;
  }
}

function productKeyFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).pathname.replace(/\/$/, "");
  } catch {
    return url.replace("https://sweetgift.ru", "").replace(/\/$/, "");
  }
}

function categorySlugFromUrl(url: string | null): string | null {
  const key = productKeyFromUrl(url);
  if (!key) return null;
  return key.split("/").filter(Boolean)[0] || null;
}

function extractComposition(description: string | null): string | null {
  if (!description) return null;

  const clean = description
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();

  const marker = "В состав";
  const idx = clean.toLowerCase().indexOf(marker.toLowerCase());

  if (idx === -1) return clean;

  return clean.slice(idx).trim();
}

function splitIngredients(composition: string | null): string[] {
  if (!composition) return [];

  return composition
    .split(/\n|;|•|—/g)
    .map((x) => x
      .replace(/^[-–—\s]+/, "")
      // Tilda/YML sometimes stores the whole composition on one line after
      // this heading. Remove only the heading, not the ingredients following
      // it (the former filter discarded the complete line).
      .replace(/^\s*в состав[^:]*:\s*/i, "")
      .trim())
    .filter((x) => x.length > 2)
    .filter((x) => !/^в состав/i.test(x))
    .filter((x) => !/^дxшxв/i.test(x))
    .filter((x) => !/^вес/i.test(x));
}

function normalizeIngredient(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[«»"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractWeight(value: string): string | null {
  const match = value.match(/(\d+[\.,]?\d*)\s*(г|гр|грамм|кг|мл|л|шт)/i);
  return match ? match[0] : null;
}

function ingredientMatchesRule(
  normalized: string,
  rule: { tag: string; keyword: string },
): boolean {
  // The generic keyword `сыр` must still find concatenated YML values such as
  // `яблокисыр Камамбер`, so a strict word boundary is not suitable here.
  // Exclude only the two known meat-processing prefixes that caused cheese
  // false positives. A later real occurrence such as `сырокопченая с сыром
  // дорблю` still matches.
  if (rule.tag === "cheese" && rule.keyword === "сыр") {
    return /сыр(?!окоп|овял)/i.test(normalized);
  }

  // A plain substring check treats the ending of `вручайте` as `чай`.
  // Keep support for concatenated YML values such as `граммчай Chabo` and
  // for tea adjectives, but require a real tea-token boundary.
  if (rule.tag === "tea" && rule.keyword === "чай") {
    return /(?:^|[^а-яё]|грамм)чай(?=$|[^а-яё]|н(?:ый|ая|ое|ые|ого|ому|ым|ом|ой|ую|ых|ыми)(?:$|[^а-яё]))/i
      .test(normalized);
  }

  return normalized.includes(rule.keyword);
}

serve(async () => {
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  let jobLogId: number | string | null = null;

  // An Edge Function can be terminated by the platform before its catch block
  // runs. Close only genuinely abandoned previous executions before opening a
  // new one, otherwise monitoring keeps showing `running` forever.
  await supabase
    .from("system_job_logs")
    .update({
      finished_at: startedAt,
      status: "error",
      error_message: "Previous run exceeded its execution window",
    })
    .eq("job_name", "import-yml-products")
    .eq("status", "running")
    .lt("started_at", new Date(startedMs - 20 * 60 * 1000).toISOString());

  const { data: jobLog } = await supabase
    .from("system_job_logs")
    .insert({
      job_name: "import-yml-products",
      started_at: startedAt,
      status: "running",
    })
    .select("id")
    .maybeSingle();

  jobLogId = jobLog?.id || null;

  const { data: feeds, error: feedError } = await supabase
    .from("feed_sources")
    .select("*")
    .eq("name", "sweetgift_yml")
    .eq("enabled", true)
    .limit(1);

  if (feedError || !feeds?.length) {
    if (jobLogId) {
      await supabase.from("system_job_logs").update({
        finished_at: new Date().toISOString(),
        status: "error",
        duration_ms: Date.now() - startedMs,
        error_message: feedError?.message || "Feed not found",
      }).eq("id", jobLogId);
    }

    return new Response(JSON.stringify({ ok: false, error: feedError?.message || "Feed not found" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const feed = feeds[0];

  try {
    const response = await fetch(feed.url);
    if (!response.ok) {
      throw new Error(`YML fetch failed: ${response.status} ${response.statusText}`);
    }

    const xml = await response.text();

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "",
      textNodeName: "_text",
      parseTagValue: false,
      parseAttributeValue: false,
      trimValues: true,
    });

    const parsed = parser.parse(xml);

    const shop = parsed?.yml_catalog?.shop;
    const offers = arr(shop?.offers?.offer);

    if (!offers.length) {
      throw new Error("YML contains no offers; catalog was not changed");
    }

    const { data: rulesRaw, error: rulesError } = await supabase
      .from("ingredient_tag_rules")
      .select("tag, keyword, priority, enabled")
      .eq("enabled", true)
      .order("priority", { ascending: true });

    if (rulesError) throw rulesError;

    const rules = (rulesRaw || []).map((r) => ({
      tag: String(r.tag),
      keyword: String(r.keyword || "").toLowerCase().replace(/ё/g, "е"),
    }));

    let imported = 0;
    let ingredientsInserted = 0;
    let deactivated = 0;
    const sourceProductKeys = new Set<string>();
    const sourceVariantKeys = new Set<string>();
    const productRowsByKey = new Map<string, Record<string, unknown>>();
    const variantRowsByKey = new Map<string, Record<string, unknown>>();
    const ingredientRowsByKey = new Map<string, Record<string, unknown>[]>();

    for (const offer of offers) {
      const url = normalizeUrl(text(offer.url));
      const productKey = productKeyFromUrl(url);
      if (!productKey) continue;
      sourceProductKeys.add(productKey);

      const pictures = arr(offer.picture).map((x) => text(x)).filter(Boolean) as string[];
      const description = text(offer.description);
      const composition = extractComposition(description);

      productRowsByKey.set(productKey, {
        product_key: productKey,
        title: text(offer.name) || text(offer.model) || text(offer.vendorCode),
        url,
        image: pictures[0] || null,
        images: pictures,
        price: offer.price ? Number(String(offer.price).replace(",", ".")) : null,
        old_price: offer.oldprice ? Number(String(offer.oldprice).replace(",", ".")) : null,
        category_slug: categorySlugFromUrl(url),
        description,
        composition,
        available: String(offer.available ?? "true") !== "false",
        raw: offer,
        updated_at: new Date().toISOString(),
      });

      const editionUid = text(offer.id) || (() => {
        try {
          return url ? new URL(url).searchParams.get("editionuid") : null;
        } catch {
          return null;
        }
      })();
      if (editionUid) {
        const variantKey = `${productKey}::${editionUid}`;
        const option = arr(offer.param)[0] as Record<string, unknown> | undefined;
        sourceVariantKeys.add(variantKey);
        variantRowsByKey.set(variantKey, {
          variant_key: variantKey,
          product_key: productKey,
          edition_uid: editionUid,
          group_id: text(offer.group_id),
          option_name: text(option?.name),
          option_value: text(option?._text),
          title: text(offer.name) || text(offer.model) || text(offer.vendorCode),
          url,
          image: pictures[0] || null,
          images: pictures,
          price: offer.price ? Number(String(offer.price).replace(",", ".")) : null,
          old_price: offer.oldprice ? Number(String(offer.oldprice).replace(",", ".")) : null,
          available: String(offer.available ?? "true") !== "false",
          raw: offer,
          updated_at: new Date().toISOString(),
        });
      }

      const ingredients = splitIngredients(composition);

      const ingredientRows = ingredients.flatMap((ingredient) => {
        const normalized = normalizeIngredient(ingredient);

        const matchedTags = Array.from(
          new Set(
            rules
              .filter((rule) => ingredientMatchesRule(normalized, rule))
              .map((rule) => rule.tag),
          ),
        );

        if (!matchedTags.length) {
          return [{
            product_key: productKey,
            ingredient_raw: ingredient,
            ingredient_normalized: normalized,
            tag: null,
            weight_text: extractWeight(ingredient),
          }];
        }

        return matchedTags.map((tag) => ({
          product_key: productKey,
          ingredient_raw: ingredient,
          ingredient_normalized: normalized,
          tag,
          weight_text: extractWeight(ingredient),
        }));
      });

      // A YML can contain several offers with the same product URL. Preserve
      // the old sequential-import semantics: the last offer wins completely.
      ingredientRowsByKey.set(productKey, ingredientRows);
    }

    const productRows = Array.from(productRowsByKey.values());
    const variantRows = Array.from(variantRowsByKey.values());
    const allIngredientRows = Array.from(ingredientRowsByKey.values()).flat();

    // The old implementation performed an upsert, delete and insert for every
    // product (more than 2,000 HTTP calls for the current catalog). Batched
    // writes keep the function well inside the Edge Function execution limit.
    for (const batch of chunks(productRows, PRODUCT_BATCH_SIZE)) {
      const { error: upsertError } = await supabase
        .from("products_catalog")
        .upsert(batch, { onConflict: "product_key" });

      if (upsertError) throw upsertError;
      imported += batch.length;
    }

    for (const batch of chunks(variantRows, PRODUCT_BATCH_SIZE)) {
      const { error: variantUpsertError } = await supabase
        .from("product_variants")
        .upsert(batch, { onConflict: "variant_key" });

      if (variantUpsertError) throw variantUpsertError;
    }

    const { data: existingVariants, error: existingVariantsError } = await supabase
      .from("product_variants")
      .select("variant_key,available");

    if (existingVariantsError) throw existingVariantsError;

    const missingVariantKeys = (existingVariants || [])
      .filter((row) => row.available !== false && !sourceVariantKeys.has(String(row.variant_key)))
      .map((row) => String(row.variant_key));

    for (const variantKeys of chunks(missingVariantKeys, PRODUCT_BATCH_SIZE)) {
      const { error: deactivateVariantsError } = await supabase
        .from("product_variants")
        .update({ available: false, updated_at: new Date().toISOString() })
        .in("variant_key", variantKeys);

      if (deactivateVariantsError) throw deactivateVariantsError;
    }

    for (const productKeys of chunks(Array.from(sourceProductKeys), PRODUCT_BATCH_SIZE)) {
      const { error: deleteIngredientsError } = await supabase
        .from("product_ingredients")
        .delete()
        .in("product_key", productKeys);

      if (deleteIngredientsError) throw deleteIngredientsError;
    }

    for (const batch of chunks(allIngredientRows, INGREDIENT_BATCH_SIZE)) {
      const { error: ingredientsError } = await supabase
        .from("product_ingredients")
        .insert(batch);

      if (ingredientsError) throw ingredientsError;
      ingredientsInserted += batch.length;
    }

    const { data: existingProducts, error: existingProductsError } = await supabase
      .from("products_catalog")
      .select("product_key,available");

    if (existingProductsError) throw existingProductsError;

    const missingKeys = (existingProducts || [])
      .filter((row) => row.available !== false && !sourceProductKeys.has(String(row.product_key)))
      .map((row) => String(row.product_key));

    for (let i = 0; i < missingKeys.length; i += 100) {
      const chunk = missingKeys.slice(i, i + 100);
      const { error: deactivateError } = await supabase
        .from("products_catalog")
        .update({
          available: false,
          updated_at: new Date().toISOString(),
        })
        .in("product_key", chunk);

      if (deactivateError) throw deactivateError;
      deactivated += chunk.length;
    }

    const { data: productEntitiesData, error: productEntitiesError } =
      await supabase.rpc("refresh_product_seo_entities_all");

    if (productEntitiesError) throw productEntitiesError;

    const { data: newYearEntitiesData, error: newYearEntitiesError } =
      await supabase.rpc("refresh_product_new_year_entities");

    if (newYearEntitiesError) throw newYearEntitiesError;

    // Product recommendations are intentionally rebuilt by the dedicated
    // nightly cron after product/article imports and article classification.
    // Keeping this import lightweight prevents duplicate cache rebuilds and
    // leaves the frontend on the fast, precomputed read path.
    const articleProductCacheData = {
      status: "scheduled",
      job: "refresh-article-product-cache-daily",
      schedule: "48 4 * * *",
    };

    await supabase
      .from("feed_sources")
      .update({
        last_run_at: startedAt,
        last_status: "success",
        last_error: null,
      })
      .eq("id", feed.id);

    if (jobLogId) {
      await supabase.from("system_job_logs").update({
        finished_at: new Date().toISOString(),
        status: "success",
        processed_count: imported,
        duration_ms: Date.now() - startedMs,
        error_message: null,
        details: {
          source_offers_count: offers.length,
          source_unique_products: sourceProductKeys.size,
          imported,
          ingredients_inserted: ingredientsInserted,
          deactivated,
          product_seo_entities: productEntitiesData,
          product_new_year_entities: newYearEntitiesData,
          article_product_cache: articleProductCacheData,
        },
      }).eq("id", jobLogId);
    }

    return new Response(JSON.stringify({
      ok: true,
      sourceOffersCount: offers.length,
      sourceCount: sourceProductKeys.size,
      imported,
      productSeoEntities: productEntitiesData,
      productNewYearEntities: newYearEntitiesData,
      articleProductCache: articleProductCacheData,
      ingredientsInserted,
      deactivated,
      startedAt,
    }), {
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : JSON.stringify(error, Object.getOwnPropertyNames(error));

    await supabase
      .from("feed_sources")
      .update({
        last_run_at: startedAt,
        last_status: "error",
        last_error: message,
      })
      .eq("id", feed.id);

    if (jobLogId) {
      await supabase.from("system_job_logs").update({
        finished_at: new Date().toISOString(),
        status: "error",
        duration_ms: Date.now() - startedMs,
        error_message: message,
      }).eq("id", jobLogId);
    }

    return new Response(JSON.stringify({
      ok: false,
      error: message,
    }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});
