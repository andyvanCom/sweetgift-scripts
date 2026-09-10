const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function jsonResponse(body: unknown, status = 200, cache = false): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
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

  const collection = new URL(req.url).searchParams.get("collection") || "";
  if (collection !== "baskets" && collection !== "boxes") {
    return jsonResponse({ error: "Invalid collection" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !publishableKey) {
    return jsonResponse({ error: "Service configuration is unavailable" }, 500);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/rpc/get_gift_selector_cached_catalog`,
      {
        method: "POST",
        headers: {
          apikey: publishableKey,
          Authorization: `Bearer ${publishableKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_collection: collection }),
        signal: controller.signal,
      },
    );
    const data = await response.json();

    if (!response.ok || !data || typeof data !== "object") {
      return jsonResponse({ error: "Prepared catalog is unavailable" }, 502);
    }

    return jsonResponse(data, 200, true);
  } catch (error) {
    console.error("gift-selector-catalog failed", error);
    return jsonResponse({ error: "Prepared catalog request timed out" }, 504);
  } finally {
    clearTimeout(timeout);
  }
});

