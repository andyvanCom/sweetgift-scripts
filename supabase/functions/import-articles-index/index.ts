import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FEED_URL = "https://sweetgift.ru/sitemap-feeds.xml";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Rule = {
  tag: string;
  keyword: string;
};

type FeedItem = {
  url: string;
  lastmod: string | null;
};

class HttpFetchError extends Error {
  status: number;
  url: string;

  constructor(status: number, url: string) {
    super(`HTTP ${status} for ${url}`);
    this.name = "HttpFetchError";
    this.status = status;
    this.url = url;
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const value = error as Record<string, unknown>;
    const parts = ["message", "details", "hint", "code"]
      .map((key) => value[key])
      .filter((part) => typeof part === "string" && part.trim());
    if (parts.length) return parts.join("; ");
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function decodeHtml(text: string): string {
  return String(text || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function stripHtml(html: string): string {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getMeta(html: string, name: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${name}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["'][^>]*>`, "i"),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtml(match[1]);
  }

  return null;
}

function getTitle(html: string, articleKey: string): string {
  const raw =
    getMeta(html, "og:title") ||
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ||
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ||
    articleKey;

  return decodeHtml(stripHtml(raw));
}

function getDescription(html: string): string | null {
  const raw = getMeta(html, "description") || getMeta(html, "og:description");
  return raw ? decodeHtml(stripHtml(raw)) : null;
}

function getImage(html: string): string | null {
  return getMeta(html, "og:image") || getMeta(html, "twitter:image");
}

function extractArticleProductAliases(html: string): string[] {
  const aliases = new Set<string>();
  const containers = html.match(
    /<[^>]*\bclass=["'][^"']*\bsg-related-products\b[^"']*["'][^>]*>/gi,
  ) || [];

  for (const container of containers) {
    const alias = container.match(/\bdata-alias=["']([^"']+)["']/i)?.[1]
      ?.trim()
      .toLowerCase();

    if (alias && /^[a-z0-9][a-z0-9-]*$/.test(alias)) aliases.add(alias);
  }

  return Array.from(aliases);
}

function getArticleKey(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname.replace(/\/$/, "") || "/";
  } catch {
    return url.replace(/^https?:\/\/[^/]+/i, "").replace(/\/$/, "") || "/";
  }
}

function isHoneyArticleAlias(alias: string): boolean {
  return /(^|-)(med|meda|mede|medom|medovyy|medovaya|medovom)(-|$)/.test(
    alias,
  );
}

function isNutArticleAlias(alias: string): boolean {
  return /(oreh|mindal|funduk|keshyu|kedrov|arahis|fistash|pekan|kokos)/
    .test(alias);
}

function isBuilderDayArticleAlias(alias: string): boolean {
  return alias.includes("den-stroitelya") || alias.includes("stroitelyu");
}

function isCoffeeArticleAlias(alias: string): boolean {
  return /kofe|kofeyn|arabik|robust|espresso|americano|kapuchino|latte|obzhark|pomol/
    .test(alias);
}

function extractSitemapUrls(xml: string): string[] {
  return [...xml.matchAll(/<loc>(.*?)<\/loc>/gi)]
    .map((m) => decodeHtml(m[1]))
    .filter((url) => url.includes("sweetgift.ru/sitemap-feed-"));
}

function extractFeedItems(xml: string): FeedItem[] {
  const items: FeedItem[] = [];

  const urlBlocks = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/gi)];

  for (const blockMatch of urlBlocks) {
    const block = blockMatch[1];

    const loc = block.match(/<loc>(.*?)<\/loc>/i)?.[1];
    if (!loc) continue;

    const url = decodeHtml(loc);
    if (!url.includes("sweetgift.ru/stati/")) continue;

    const lastmodRaw = block.match(/<lastmod>(.*?)<\/lastmod>/i)?.[1];
    const lastmod = lastmodRaw ? decodeHtml(lastmodRaw) : null;

    items.push({ url, lastmod });
  }

  return items;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "user-agent": "SweetGiftArticleIndexer/1.0",
    },
  });

  if (!res.ok) {
    throw new HttpFetchError(res.status, url);
  }

  return await res.text();
}

async function getAllArticleFeedItems(): Promise<FeedItem[]> {
  const rootXml = await fetchText(FEED_URL);
  const sitemapUrls = extractSitemapUrls(rootXml);

  const map = new Map<string, FeedItem>();

  for (const sitemapUrl of sitemapUrls) {
    const xml = await fetchText(sitemapUrl);

    for (const item of extractFeedItems(xml)) {
      map.set(item.url, item);
    }
  }

  return Array.from(map.values());
}

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function extractTags(text: string, rules: Rule[]): string[] {
  const lower = text.toLowerCase();
  const tags = new Set<string>();

  for (const rule of rules) {
    const keyword = String(rule.keyword || "").toLowerCase().trim();
    const tag = String(rule.tag || "").trim();

    if (!keyword || !tag) continue;
    if (lower.includes(keyword)) tags.add(tag);
  }

  return Array.from(tags);
}

function isRemoteNewer(feedLastmod: string | null, dbLastmod: string | null): boolean {
  if (!feedLastmod) return false;
  if (!dbLastmod) return true;

  const feedTime = new Date(feedLastmod).getTime();
  const dbTime = new Date(dbLastmod).getTime();

  if (Number.isNaN(feedTime)) return false;
  if (Number.isNaN(dbTime)) return true;

  return feedTime > dbTime;
}

async function filterDailyItems(
  supabaseAdmin: any,
  items: FeedItem[],
): Promise<FeedItem[]> {
  const articleKeys = items.map((item) => getArticleKey(item.url));
  const existing = new Map<string, string | null>();

  // PostgREST encodes .in() values into the URL. Chunking avoids oversized
  // requests after a large Tilda article re-import.
  for (let i = 0; i < articleKeys.length; i += 100) {
    const chunk = articleKeys.slice(i, i + 100);
    const { data, error } = await supabaseAdmin
      .from("articles_index")
      .select("article_key, feed_lastmod")
      .in("article_key", chunk);

    if (error) throw error;

    for (const row of data || []) {
      existing.set(row.article_key, row.feed_lastmod || null);
    }
  }

  return items.filter((item) => {
    const key = getArticleKey(item.url);

    if (!existing.has(key)) return true;

    return isRemoteNewer(item.lastmod, existing.get(key) || null);
  });
}

async function indexOneArticle(
  supabaseAdmin: any,
  item: FeedItem,
  rules: Rule[],
) {
  const articleKey = getArticleKey(item.url);
  const html = await fetchText(item.url);

  const cleanText = stripHtml(html);
  const contentHash = await sha256(cleanText);

  const title = getTitle(html, articleKey);
  const description = getDescription(html);
  const image = getImage(html);
  const articleProductAliases = extractArticleProductAliases(html);

  const words = cleanText.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const readingTime = Math.max(1, Math.ceil(wordCount / 180));

  const tags = extractTags(cleanText, rules);

  const { error } = await supabaseAdmin
    .from("articles_index")
    .upsert(
      {
        article_key: articleKey,
        url: item.url,
        title,
        description,
        image,
        content_hash: contentHash,
        word_count: wordCount,
        reading_time: readingTime,
        ingredients: tags,
        tags,
        feed_lastmod: item.lastmod,
        indexed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_active: true,
      },
      {
        onConflict: "article_key",
      },
    );

  if (error) throw error;

  const { error: clearArticleUrlError } = await supabaseAdmin
    .from("article_product_filters")
    .update({
      article_url: null,
      updated_at: new Date().toISOString(),
    })
    .eq("article_url", item.url);

  if (clearArticleUrlError) throw clearArticleUrlError;

  if (articleProductAliases.length) {
    const { error: articleUrlError } = await supabaseAdmin
      .from("article_product_filters")
      .update({
        article_url: item.url,
        updated_at: new Date().toISOString(),
      })
      .in("alias", articleProductAliases);

    if (articleUrlError) throw articleUrlError;
  }

  return {
    article_key: articleKey,
    url: item.url,
    title,
    image,
    feed_lastmod: item.lastmod,
    tags_count: tags.length,
    word_count: wordCount,
    reading_time: readingTime,
    article_product_aliases: articleProductAliases,
  };
}

async function runImport(
  supabaseAdmin: any,
  limit: number,
  offset: number,
  mode: string,
) {
  const allFeedItems = await getAllArticleFeedItems();
  let items = allFeedItems.slice();
  const totalFeedUrls = allFeedItems.length;

  if (mode === "daily") {
    items = await filterDailyItems(supabaseAdmin, items);
    offset = 0;
  }

  // Daily imports can contain hundreds of republished Tilda articles. Keep
  // each Edge invocation below the runtime limit and continue in a separate
  // invocation after the current batch has been committed.
  const batch = items.slice(offset, offset + limit);

  const { data: rulesData, error: rulesError } = await supabaseAdmin
    .from("ingredient_tag_rules")
    .select("tag, keyword")
    .eq("enabled", true);

  if (rulesError) throw rulesError;

  const rules = (rulesData || []) as Rule[];

  const result = {
    ok: true,
    mode,
    feed_url: FEED_URL,
    total_feed_urls: totalFeedUrls,
    total_urls_to_process: items.length,
    offset,
    limit,
    batch_size: batch.length,
    processed: 0,
    success: 0,
    failed: 0,
    has_more: offset + limit < items.length,
    next_offset: mode === "daily"
      ? null
      : offset + limit < items.length
      ? offset + limit
      : null,
    deactivated: 0,
    skipped: 0,
    errors: [] as Array<{ url: string; error: string }>,
    warnings: [] as Array<{ url: string; warning: string }>,
    items: [] as Array<unknown>,
  };

  for (const item of batch) {
    try {
      const indexed = await indexOneArticle(supabaseAdmin, item, rules);
      result.processed++;
      result.success++;
      result.items.push(indexed);
    } catch (e) {
      await supabaseAdmin
        .from("article_product_filters")
        .update({
          article_url: null,
          updated_at: new Date().toISOString(),
        })
        .eq("article_url", item.url);

      result.processed++;

      if (e instanceof HttpFetchError && e.status === 404) {
        const { error: deactivateMissingError } = await supabaseAdmin
          .from("articles_index")
          .update({
            is_active: false,
            updated_at: new Date().toISOString(),
          })
          .eq("article_key", getArticleKey(item.url));

        if (!deactivateMissingError) {
          result.skipped++;
          result.warnings.push({
            url: item.url,
            warning: getErrorMessage(e),
          });
          continue;
        }

        e = deactivateMissingError;
      }

      result.failed++;
      result.errors.push({
        url: item.url,
        error: getErrorMessage(e),
      });
    }
  }

  const honeyArticles = result.items.flatMap((item: any) =>
    (item.article_product_aliases || [])
      .filter((alias: string) => isHoneyArticleAlias(alias))
      .map((alias: string) => ({
        alias,
        title: item.title,
        url: item.url,
      }))
  );

  if (honeyArticles.length) {
    const { error: honeyFiltersError } = await supabaseAdmin.rpc(
      "sync_honey_article_filters",
      { p_articles: honeyArticles },
    );

    if (honeyFiltersError) throw honeyFiltersError;
  }

  const nutArticles = result.items.flatMap((item: any) =>
    (item.article_product_aliases || [])
      .filter((alias: string) => isNutArticleAlias(alias))
      .map((alias: string) => ({
        alias,
        title: item.title,
        url: item.url,
      }))
  );

  if (nutArticles.length) {
    const { error: nutFiltersError } = await supabaseAdmin.rpc(
      "sync_nut_article_filters",
      { p_articles: nutArticles },
    );

    if (nutFiltersError) throw nutFiltersError;
  }

  const builderDayArticles = result.items.flatMap((item: any) =>
    (item.article_product_aliases || [])
      .filter((alias: string) => isBuilderDayArticleAlias(alias))
      .map((alias: string) => ({
        alias,
        title: item.title,
        url: item.url,
      }))
  );

  if (builderDayArticles.length) {
    const { error: builderDayFiltersError } = await supabaseAdmin.rpc(
      "sync_builder_day_article_filters",
      { p_articles: builderDayArticles },
    );

    if (builderDayFiltersError) throw builderDayFiltersError;
  }

  const coffeeArticles = result.items.flatMap((item: any) =>
    (item.article_product_aliases || [])
      .filter((alias: string) => isCoffeeArticleAlias(alias))
      .map((alias: string) => ({
        alias,
        title: item.title,
        url: item.url,
      }))
  );

  if (coffeeArticles.length) {
    const { error: coffeeFiltersError } = await supabaseAdmin.rpc(
      "sync_coffee_article_filters",
      { p_articles: coffeeArticles },
    );

    if (coffeeFiltersError) throw coffeeFiltersError;
  }

  if (mode === "daily") {
    const sourceKeys = new Set(allFeedItems.map((item) => getArticleKey(item.url)));
    const { data: activeArticles, error: activeArticlesError } = await supabaseAdmin
      .from("articles_index")
      .select("article_key,url")
      .eq("is_active", true);

    if (activeArticlesError) throw activeArticlesError;

    const missingArticles = (activeArticles || [])
      .filter((row: { article_key: string }) =>
        !sourceKeys.has(String(row.article_key))
      );
    const missingKeys = missingArticles
      .map((row: { article_key: string }) => String(row.article_key));
    const missingUrls = missingArticles
      .map((row: { url: string | null }) => String(row.url || "").trim())
      .filter(Boolean);

    for (let i = 0; i < missingKeys.length; i += 100) {
      const chunk = missingKeys.slice(i, i + 100);
      const { error: deactivateError } = await supabaseAdmin
        .from("articles_index")
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .in("article_key", chunk);

      if (deactivateError) throw deactivateError;
      result.deactivated += chunk.length;
    }

    for (let i = 0; i < missingUrls.length; i += 100) {
      const chunk = missingUrls.slice(i, i + 100);
      const { error: clearArticleUrlError } = await supabaseAdmin
        .from("article_product_filters")
        .update({
          article_url: null,
          updated_at: new Date().toISOString(),
        })
        .in("article_url", chunk);

      if (clearArticleUrlError) throw clearArticleUrlError;
    }
  }

  await supabaseAdmin
    .from("feed_sources")
    .update({
      last_run_at: new Date().toISOString(),
      last_status: result.failed ? "partial" : "ok",
      last_error: result.errors.length
        ? JSON.stringify(result.errors.slice(0, 5))
        : null,
    })
    .eq("url", FEED_URL);

  return result;
}

Deno.serve(async (req) => {
    const runSecret = Deno.env.get("REPORT_RUN_SECRET");
    const requestSecret = req.headers.get("x-report-secret");

    if (runSecret && requestSecret !== runSecret) {
      return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const startedAt = new Date().toISOString();
    const startedMs = Date.now();
    let jobLogId: number | string | null = null;

    try {
      await supabaseAdmin
        .from("system_job_logs")
        .update({
          finished_at: new Date().toISOString(),
          status: "error",
          duration_ms: 10 * 60 * 1000,
          error_message: "Run exceeded the Edge Function execution window",
        })
        .eq("job_name", "import-articles-index")
        .eq("status", "running")
        .lt(
          "started_at",
          new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        );

      const { data: jobLog } = await supabaseAdmin
        .from("system_job_logs")
        .insert({
          job_name: "import-articles-index",
          started_at: startedAt,
          status: "running",
        })
        .select("id")
        .maybeSingle();

      jobLogId = jobLog?.id || null;

      const url = new URL(req.url);

      const limit = Math.min(
        Math.max(Number(url.searchParams.get("limit") || "50"), 1),
        100,
      );

      const offset = Math.max(Number(url.searchParams.get("offset") || "0"), 0);
      const mode = url.searchParams.get("mode") || "daily";
      const chainDepth = Math.max(
        Number(url.searchParams.get("chain_depth") || "0"),
        0,
      );

      const result = await runImport(supabaseAdmin, limit, offset, mode);

      if (jobLogId) {
        await supabaseAdmin.from("system_job_logs").update({
          finished_at: new Date().toISOString(),
          status: result.failed ? "partial" : "success",
          processed_count: result.processed,
          duration_ms: Date.now() - startedMs,
          error_message: result.errors.length
            ? JSON.stringify(result.errors.slice(0, 5))
            : null,
          details: {
            mode: result.mode,
            source_count: result.total_feed_urls,
            candidates: result.total_urls_to_process,
            success: result.success,
            failed: result.failed,
            skipped: result.skipped,
            deactivated: result.deactivated,
          },
        }).eq("id", jobLogId);
      }

      if (mode === "daily" && result.has_more && chainDepth < 9) {
        const nextUrl = new URL(req.url);
        nextUrl.searchParams.set("mode", "daily");
        nextUrl.searchParams.set("limit", String(limit));
        nextUrl.searchParams.set("offset", "0");
        nextUrl.searchParams.set("chain_depth", String(chainDepth + 1));

        const nextBatch = fetch(nextUrl, {
          headers: requestSecret
            ? {
              "x-report-secret": requestSecret,
              "Content-Type": "application/json",
            }
            : { "Content-Type": "application/json" },
        }).then(async (response) => {
          const body = await response.text();

          if (!response.ok) {
            throw new Error(
              `Next article batch failed: HTTP ${response.status}; ${body}`,
            );
          }
        }).catch((error) => {
          console.error("Unable to continue article import", error);
        });

        const edgeRuntime = (
          globalThis as typeof globalThis & {
            EdgeRuntime?: { waitUntil: (promise: Promise<unknown>) => void };
          }
        ).EdgeRuntime;

        if (edgeRuntime?.waitUntil) {
          edgeRuntime.waitUntil(nextBatch);
        } else {
          await nextBatch;
        }
      }

      return Response.json(result);
    } catch (e) {
      const message = getErrorMessage(e);

      if (jobLogId) {
        await supabaseAdmin.from("system_job_logs").update({
          finished_at: new Date().toISOString(),
          status: "error",
          duration_ms: Date.now() - startedMs,
          error_message: message,
        }).eq("id", jobLogId);
      }

      return Response.json(
        {
          ok: false,
          error: message,
        },
        { status: 500 },
      );
    }
});
