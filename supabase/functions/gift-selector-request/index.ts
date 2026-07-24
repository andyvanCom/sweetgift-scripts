import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { SMTPClient } from "https://deno.land/x/denomailer/mod.ts";

const SMTP_HOST = Deno.env.get("SMTP_HOST") || "smtp.yandex.ru";
const SMTP_PORT = Number(Deno.env.get("SMTP_PORT") || "465");
const SMTP_USER = Deno.env.get("SMTP_USER")!;
const SMTP_PASSWORD = Deno.env.get("SMTP_PASSWORD")!;
const REQUEST_TO_EMAIL =
  Deno.env.get("GIFT_SELECTOR_REQUEST_TO_EMAIL") ||
  "sweetgift.ru@gmail.com";
const REQUEST_FROM_EMAIL =
  Deno.env.get("REPORT_FROM_EMAIL") || "SweetGift <no-reply@sweetgift.ru>";

const ALLOWED_ORIGINS = new Set([
  "https://sweetgift.ru",
  "https://www.sweetgift.ru",
]);

const requestsByIp = new Map<string, number[]>();

function response(
  data: Record<string, unknown>,
  status: number,
  origin: string,
) {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store",
      "access-control-allow-origin": origin,
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "POST,OPTIONS",
      "vary": "Origin",
    },
  });
}

function clean(value: unknown, maxLength: number) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function rateLimited(req: Request) {
  const ip = clean(
    req.headers.get("x-forwarded-for")?.split(",")[0] ||
      req.headers.get("cf-connecting-ip") ||
      "unknown",
    80,
  );
  const now = Date.now();
  const windowStart = now - 10 * 60 * 1000;
  const recent = (requestsByIp.get(ip) || []).filter((time) =>
    time > windowStart
  );

  if (recent.length >= 3) return true;

  recent.push(now);
  requestsByIp.set(ip, recent);
  return false;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "";

  if (req.method === "OPTIONS") {
    if (!allowedOrigin) {
      return new Response(null, { status: 403 });
    }

    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": allowedOrigin,
        "access-control-allow-headers": "content-type",
        "access-control-allow-methods": "POST,OPTIONS",
        "vary": "Origin",
      },
    });
  }

  if (req.method !== "POST") {
    return response({ ok: false, error: "Method not allowed" }, 405, allowedOrigin);
  }

  if (!allowedOrigin) {
    return response({ ok: false, error: "Origin not allowed" }, 403, "");
  }

  if (Number(req.headers.get("content-length") || 0) > 20_000) {
    return response({ ok: false, error: "Слишком большой запрос" }, 413, allowedOrigin);
  }

  if (rateLimited(req)) {
    return response(
      { ok: false, error: "Слишком много запросов. Попробуйте позднее." },
      429,
      allowedOrigin,
    );
  }

  try {
    const body = await req.json();

    // Hidden field: real users never fill it.
    if (clean(body.company, 100)) {
      return response({ ok: true }, 200, allowedOrigin);
    }

    const name = clean(body.name, 100);
    const phone = clean(body.phone, 40);
    const email = clean(body.email, 160).toLowerCase();
    const quantity = Number(body.quantity);
    const budget = Number(body.budget);
    const pageUrl = clean(body.page_url, 500);
    const ingredients = Array.isArray(body.ingredients)
      ? Array.from(
        new Set(
          body.ingredients
            .map((item: unknown) => clean(item, 80))
            .filter(Boolean),
        ),
      ).slice(0, 30)
      : [];

    const errors: string[] = [];

    if (name.length < 2) errors.push("Укажите имя");
    if (!/^[+()\d\s-]{7,40}$/.test(phone)) {
      errors.push("Проверьте телефон");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push("Проверьте email");
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10_000) {
      errors.push("Количество должно быть от 1 до 10 000");
    }
    if (!Number.isFinite(budget) || budget < 500 || budget > 10_000_000) {
      errors.push("Бюджет должен быть от 500 до 10 000 000 рублей");
    }
    if (!ingredients.length) errors.push("Не выбраны ингредиенты");
    if (body.consent !== true) {
      errors.push("Нужно согласие на обработку данных");
    }

    if (errors.length) {
      return response(
        { ok: false, error: errors.join(". ") },
        400,
        allowedOrigin,
      );
    }

    const subject =
      `Запрос корзин по составу: ${ingredients.join(", ")} — ${quantity} шт.`;
    const html = `
      <meta charset="UTF-8">
      <div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.55;color:#222;">
        <div style="max-width:720px;margin:0 auto;padding:24px;">
          <h2 style="margin:0 0 18px;">Новый запрос с подбора по составу</h2>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:8px;border-bottom:1px solid #eee;"><b>Состав</b></td><td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(ingredients.join(", "))}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee;"><b>Количество</b></td><td style="padding:8px;border-bottom:1px solid #eee;">${quantity} шт.</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee;"><b>Бюджет на одну</b></td><td style="padding:8px;border-bottom:1px solid #eee;">${budget.toLocaleString("ru-RU")} ₽</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee;"><b>Имя</b></td><td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(name)}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee;"><b>Телефон</b></td><td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(phone)}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee;"><b>Email</b></td><td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(email)}</td></tr>
            <tr><td style="padding:8px;"><b>Страница</b></td><td style="padding:8px;">${escapeHtml(pageUrl)}</td></tr>
          </table>
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

    try {
      await client.send({
        from: REQUEST_FROM_EMAIL,
        to: REQUEST_TO_EMAIL,
        subject,
        html,
      });
    } finally {
      await client.close();
    }

    return response({ ok: true }, 200, allowedOrigin);
  } catch (error) {
    console.error("gift-selector-request", error);
    return response(
      { ok: false, error: "Не удалось отправить запрос. Попробуйте позднее." },
      500,
      allowedOrigin,
    );
  }
});
