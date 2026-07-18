import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SMTP_HOST = Deno.env.get("SMTP_HOST") || "smtp.yandex.ru";
const SMTP_PORT = Number(Deno.env.get("SMTP_PORT") || "465");
const SMTP_USER = Deno.env.get("SMTP_USER")!;
const SMTP_PASSWORD = Deno.env.get("SMTP_PASSWORD")!;

const REPORT_TO_EMAIL = Deno.env.get("REPORT_TO_EMAIL")!;
const REPORT_FROM_EMAIL =
  Deno.env.get("REPORT_FROM_EMAIL") || "SweetGift <no-reply@sweetgift.ru>";

function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\n", "<br>");
}

type JobHealth = {
  job_name: string;
  started_at: string | null;
  finished_at: string | null;
  status: string;
  processed_count: number;
  duration_ms: number | null;
  error_message: string | null;
  details: Record<string, unknown>;
  fresh: boolean;
};

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { "user-agent": "SweetGiftPipelineMonitor/1.0" },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return await response.text();
}

function extractLocs(xml: string): string[] {
  return Array.from(xml.matchAll(/<loc>(.*?)<\/loc>/gi))
    .map((match) => String(match[1] || "").replace(/&amp;/g, "&").trim())
    .filter(Boolean);
}

async function countArticleFeedUrls(feedUrl: string): Promise<number> {
  const rootXml = await fetchText(feedUrl);
  const sitemapUrls = extractLocs(rootXml)
    .filter((url) => url.includes("sitemap-feed-"));
  const articleUrls = new Set<string>();

  for (const sitemapUrl of sitemapUrls) {
    const xml = await fetchText(sitemapUrl);
    for (const url of extractLocs(xml)) {
      if (url.includes("sweetgift.ru/stati/")) articleUrls.add(url);
    }
  }

  return articleUrls.size;
}

async function countProductFeedProducts(feedUrl: string): Promise<number> {
  const xml = await fetchText(feedUrl);
  const productKeys = new Set<string>();

  for (const match of xml.matchAll(/<offer\b[^>]*>([\s\S]*?)<\/offer>/gi)) {
    const urlMatch = String(match[1] || "").match(/<url>(.*?)<\/url>/i);
    if (!urlMatch?.[1]) continue;

    const rawUrl = urlMatch[1].replace(/&amp;/g, "&").trim();

    try {
      productKeys.add(new URL(rawUrl).pathname.replace(/\/$/, ""));
    } catch {
      productKeys.add(rawUrl.replace(/^https?:\/\/[^/]+/i, "").replace(/\/$/, ""));
    }
  }

  return productKeys.size;
}

function formatJob(job: JobHealth): string {
  const finishedAt = job.finished_at || job.started_at || "нет запуска";
  const state = job.status === "success" && job.fresh ? "✅" : "❌";
  const error = job.error_message ? `; ошибка: ${job.error_message}` : "";
  return `${state} ${job.job_name}: ${job.status}, ${finishedAt}, обработано ${job.processed_count}${error}`;
}

Deno.serve(async (req) => {
  const runSecret = Deno.env.get("REPORT_RUN_SECRET");
  const requestSecret = req.headers.get("x-report-secret");

  if (runSecret && requestSecret !== runSecret) {
    return Response.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  let jobLogId: number | string | null = null;

  try {
    const { data: jobLog } = await supabase
      .from("system_job_logs")
      .insert({
        job_name: "send-daily-report",
        started_at: startedAt,
        status: "running",
      })
      .select("id")
      .maybeSingle();

    jobLogId = jobLog?.id || null;

    const { data, error } = await supabase.rpc("get_daily_report_text");

    if (error) throw new Error(error.message);

    const upstreamNames = [
      "import-yml-products",
      "import-articles-index",
      "classify-articles",
    ];
    const { data: jobRows, error: jobsError } = await supabase
      .from("system_job_logs")
      .select(
        "job_name,started_at,finished_at,status,processed_count,duration_ms,error_message,details",
      )
      .in("job_name", upstreamNames)
      .order("started_at", { ascending: false })
      .limit(100);

    const latestJobs = new Map<string, JobHealth>();

    if (!jobsError) {
      for (const row of jobRows || []) {
        if (latestJobs.has(row.job_name)) continue;
        const finishedAt = row.finished_at || row.started_at;
        latestJobs.set(row.job_name, {
          ...row,
          fresh: Boolean(finishedAt) &&
            Date.now() - new Date(finishedAt).getTime() <= 30 * 60 * 60 * 1000,
        } as JobHealth);
      }
    }

    const upstreamJobs = upstreamNames.map((jobName) =>
      latestJobs.get(jobName) || {
        job_name: jobName,
        started_at: null,
        finished_at: null,
        status: "never",
        processed_count: 0,
        duration_ms: null,
        error_message: null,
        details: {},
        fresh: false,
      }
    );

    const { data: feeds, error: feedsError } = await supabase
      .from("feed_sources")
      .select("name,url,last_run_at,last_status,last_error");

    if (feedsError) throw new Error(feedsError.message);

    const productFeed = (feeds || []).find((feed) => feed.name === "sweetgift_yml");
    const articleFeed = (feeds || []).find((feed) =>
      String(feed.url || "").includes("sitemap-feeds.xml")
    );

    const { count: productsCount, error: productsCountError } = await supabase
      .from("products_catalog")
      .select("product_key", { count: "exact", head: true })
      .eq("available", true);
    if (productsCountError) throw productsCountError;

    const { count: articlesCount, error: articlesCountError } = await supabase
      .from("articles_index")
      .select("article_key", { count: "exact", head: true })
      .eq("is_active", true);
    if (articlesCountError) throw articlesCountError;

    let productSourceCount: number | null = null;
    let articleSourceCount: number | null = null;
    const sourceErrors: string[] = jobsError
      ? [`Журнал pipeline: ${jobsError.message}`]
      : [];

    if (productFeed?.url) {
      try {
        productSourceCount = await countProductFeedProducts(productFeed.url);
      } catch (sourceError) {
        sourceErrors.push(
          `YML: ${sourceError instanceof Error ? sourceError.message : String(sourceError)}`,
        );
      }
    } else {
      sourceErrors.push("YML: источник не найден");
    }

    if (articleFeed?.url) {
      try {
        articleSourceCount = await countArticleFeedUrls(articleFeed.url);
      } catch (sourceError) {
        sourceErrors.push(
          `Статьи: ${sourceError instanceof Error ? sourceError.message : String(sourceError)}`,
        );
      }
    } else {
      sourceErrors.push("Статьи: источник не найден");
    }

    const jobsHealthy = upstreamJobs.length === upstreamNames.length &&
      upstreamJobs.every((job) => job.status === "success" && job.fresh);
    const productsMatch = productSourceCount !== null &&
      productSourceCount === Number(productsCount || 0);
    const articlesMatch = articleSourceCount !== null &&
      articleSourceCount === Number(articlesCount || 0);
    const pipelineHealthy = jobsHealthy && productsMatch && articlesMatch &&
      sourceErrors.length === 0;

    const baseReport = String(data || "Отчет пустой").replace(
      "Ночная обработка SweetGift завершена.",
      pipelineHealthy
        ? "Ночная обработка SweetGift успешно завершена."
        : "Ночная обработка SweetGift требует внимания.",
    );

    const pipelineLines = [
      "",
      "🔄 СОСТОЯНИЕ PIPELINE",
      ...upstreamJobs.map(formatJob),
      "",
      "🔍 СВЕРКА С ИСТОЧНИКАМИ",
      `Товары: источник ${productSourceCount ?? "ошибка"}, база ${productsCount || 0} ${productsMatch ? "✅" : "❌"}`,
      `Статьи: источник ${articleSourceCount ?? "ошибка"}, база ${articlesCount || 0} ${articlesMatch ? "✅" : "❌"}`,
    ];

    if (sourceErrors.length) {
      pipelineLines.push("Ошибки проверки источников: " + sourceErrors.join("; "));
    }

    pipelineLines.push(
      "",
      pipelineHealthy
        ? "✅ Все обязательные этапы завершены успешно."
        : "❌ Ночной pipeline завершён не полностью.",
    );

    const reportText = baseReport + "\n" + pipelineLines.join("\n");

    const today = new Date().toLocaleDateString("ru-RU", {
      timeZone: "Europe/Moscow",
    });

    const subject = `SweetGift Night Report ${today}`;

    const html = `
      <div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.55;color:#222;">
        <div style="max-width:760px;margin:0 auto;padding:24px;">
          <h2 style="margin:0 0 18px;">SweetGift • Ночной отчет</h2>
          <div style="background:#f7f7f7;border-radius:14px;padding:20px;">
            ${escapeHtml(reportText)}
          </div>
        </div>
      </div>
    `;

    const client = new SMTPClient({
      connection: {
        hostname: SMTP_HOST,
        port: SMTP_PORT,
        tls: true,
        auth: {
          username: SMTP_USER,
          password: SMTP_PASSWORD,
        },
      },
    });

    await client.send({
      from: REPORT_FROM_EMAIL,
      to: REPORT_TO_EMAIL,
      subject,
      html,
      content: reportText,
    });

    await client.close();

    if (jobLogId) {
      await supabase.from("system_job_logs").update({
        finished_at: new Date().toISOString(),
        status: pipelineHealthy ? "success" : "warning",
        processed_count: upstreamJobs.length,
        duration_ms: Date.now() - startedMs,
        error_message: pipelineHealthy
          ? null
          : "One or more pipeline checks failed",
        details: {
          pipeline_healthy: pipelineHealthy,
          products_source_count: productSourceCount,
          products_db_count: productsCount || 0,
          articles_source_count: articleSourceCount,
          articles_db_count: articlesCount || 0,
          source_errors: sourceErrors,
        },
      }).eq("id", jobLogId);
    }

    return Response.json({
      ok: true,
      pipeline_healthy: pipelineHealthy,
      subject,
      sent_to: REPORT_TO_EMAIL,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);

    if (jobLogId) {
      await supabase.from("system_job_logs").update({
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
