const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function jsonResponse(body: unknown, status = 200, cache = false): Response {
  const payload = JSON.stringify(body);

  return new Response(payload, {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Content-Length": String(new TextEncoder().encode(payload).byteLength),
      "Cache-Control": cache
        ? "public, max-age=300, s-maxage=86400, stale-while-revalidate=3600"
        : "no-store",
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const requestUrl = new URL(req.url);

  if (requestUrl.searchParams.get("manifest") === "1") {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Service configuration is unavailable" }, 500);
    }

    const page = Math.max(0, Math.min(10000, Number(requestUrl.searchParams.get("page")) || 0));
    const pageSize = 100;
    const offset = page * pageSize;
    const response = await fetch(
      `${supabaseUrl}/rest/v1/article_product_filters?select=alias&enabled=eq.true&order=alias&offset=${offset}&limit=${pageSize}`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      },
    );
    const rows = await response.json();

    if (!response.ok || !Array.isArray(rows)) {
      return jsonResponse({ error: "Manifest request failed" }, 502);
    }

    return jsonResponse({
      aliases: rows
        .map((row: Record<string, unknown>) => String(row.alias || ""))
        .filter((value: string) => /^[a-z0-9][a-z0-9-]{0,199}$/.test(value)),
      has_more: rows.length === pageSize,
    }, 200, true);
  }

  const alias = requestUrl.searchParams.get("alias")?.trim().toLowerCase() || "";

  if (!/^[a-z0-9][a-z0-9-]{0,199}$/.test(alias)) {
    return jsonResponse({ error: "Invalid alias" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !publishableKey) {
    return jsonResponse({ error: "Service configuration is unavailable" }, 500);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_article_products`, {
      method: "POST",
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${publishableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ article_alias: alias }),
      signal: controller.signal,
    });

    const data = await response.json();

    if (!response.ok) {
      return jsonResponse({ error: "Selection request failed" }, response.status);
    }

    const publicData = data && typeof data === "object" ? {
      alias: data.alias,
      title: data.title,
      subtitle: data.subtitle,
      products: Array.isArray(data.products)
        ? data.products.map((product: Record<string, unknown>) => ({
          title: product.title,
          url: product.url,
          price: product.price,
          image: product.image,
        }))
        : [],
      navigation: Array.isArray(data.navigation)
        ? data.navigation.slice(0, 12).map((item: Record<string, unknown>) => ({
          title: item.title,
          url: item.url,
        }))
        : [],
    } : null;

    return jsonResponse(publicData, 200, true);
  } catch (error) {
    console.error("article-products failed", error);
    return jsonResponse({ error: "Selection request timed out" }, 504);
  } finally {
    clearTimeout(timeout);
  }
});
