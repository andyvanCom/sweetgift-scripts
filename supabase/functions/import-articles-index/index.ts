import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

const FEED_URL = "https://sweetgift.ru/sitemap-feeds.xml";

type Rule = {
  tag: string;
  keyword: string;
};

type FeedItem = {
  url: string;
  lastmod: string | null;
};

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

function getArticleKey(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname.replace(/\/$/, "") || "/";
  } catch {
    return url.replace(/^https?:\/\/[^/]+/i, "").replace(/\/$/, "") || "/";
  }
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
    throw new Error(`HTTP ${res.status} for ${url}`);
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

  const { data, error } = await supabaseAdmin
    .from("articles_index")
    .select("article_key, feed_lastmod")
    .in("article_key", articleKeys);

  if (error) throw error;

  const existing = new Map<string, string | null>();

  for (const row of data || []) {
    existing.set(row.article_key, row.feed_lastmod || null);
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

  return {
    article_key: articleKey,
    title,
    image,
    feed_lastmod: item.lastmod,
    tags_count: tags.length,
    word_count: wordCount,
    reading_time: readingTime,
  };
}

async function runImport(
  supabaseAdmin: any,
  limit: number,
  offset: number,
  mode: string,
) {
  let items = await getAllArticleFeedItems();
  const totalFeedUrls = items.length;

  if (mode === "daily") {
    items = await filterDailyItems(supabaseAdmin, items);
    offset = 0;
  }

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
    next_offset: offset + limit < items.length ? offset + limit : null,
    errors: [] as Array<{ url: string; error: string }>,
    items: [] as Array<unknown>,
  };

  for (const item of batch) {
    try {
      const indexed = await indexOneArticle(supabaseAdmin, item, rules);
      result.processed++;
      result.success++;
      result.items.push(indexed);
    } catch (e) {
      result.processed++;
      result.failed++;
      result.errors.push({
        url: item.url,
        error: e instanceof Error ? e.message : String(e),
      });
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

export default {
  fetch: withSupabase({ auth: ["publishable", "secret"] }, async (req, ctx) => {
    try {
      const url = new URL(req.url);

      const limit = Math.min(
        Math.max(Number(url.searchParams.get("limit") || "50"), 1),
        100,
      );

      const offset = Math.max(Number(url.searchParams.get("offset") || "0"), 0);
      const mode = url.searchParams.get("mode") || "full";

      const result = await runImport(ctx.supabaseAdmin, limit, offset, mode);

      return Response.json(result);
    } catch (e) {
      return Response.json(
        {
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        },
        { status: 500 },
      );
    }
  }),
};