import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { XMLParser } from "https://esm.sh/fast-xml-parser@4.5.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

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
    .map((x) => x.replace(/^[-–—\s]+/, "").trim())
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

serve(async () => {
  const startedAt = new Date().toISOString();

  const { data: feeds, error: feedError } = await supabase
    .from("feed_sources")
    .select("*")
    .eq("name", "sweetgift_yml")
    .eq("enabled", true)
    .limit(1);

  if (feedError || !feeds?.length) {
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

    for (const offer of offers) {
      const url = normalizeUrl(text(offer.url));
      const productKey = productKeyFromUrl(url);
      if (!productKey) continue;

      const pictures = arr(offer.picture).map((x) => text(x)).filter(Boolean) as string[];
      const description = text(offer.description);
      const composition = extractComposition(description);

      const row = {
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
      };

      const { error: upsertError } = await supabase
        .from("products_catalog")
        .upsert(row, { onConflict: "product_key" });

      if (upsertError) throw upsertError;

      await supabase
        .from("product_ingredients")
        .delete()
        .eq("product_key", productKey);

      const ingredients = splitIngredients(composition);

      const ingredientRows = ingredients.flatMap((ingredient) => {
        const normalized = normalizeIngredient(ingredient);

        const matchedTags = Array.from(
          new Set(
            rules
              .filter((rule) => normalized.includes(rule.keyword))
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

      if (ingredientRows.length) {
        const { error: ingredientsError } = await supabase
          .from("product_ingredients")
          .insert(ingredientRows);

        if (ingredientsError) throw ingredientsError;

        ingredientsInserted += ingredientRows.length;
      }

      imported++;
    }

    await supabase
      .from("feed_sources")
      .update({
        last_run_at: startedAt,
        last_status: "success",
        last_error: null,
      })
      .eq("id", feed.id);

    return new Response(JSON.stringify({
      ok: true,
      imported,
      ingredientsInserted,
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

    return new Response(JSON.stringify({
      ok: false,
      error: message,
    }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});