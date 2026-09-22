import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const SMTP_HOST = Deno.env.get("SMTP_HOST") || "smtp.yandex.ru";
const SMTP_PORT = Number(Deno.env.get("SMTP_PORT") || "465");
const SMTP_USER = Deno.env.get("SMTP_USER")!;
const SMTP_PASSWORD = Deno.env.get("SMTP_PASSWORD")!;
const FROM_EMAIL = Deno.env.get("REPORT_FROM_EMAIL") ||
  "SweetGift <no-reply@sweetgift.ru>";

const SERVICE_KEY_SHA256 = "47f29ef6b920b99c56112b9f3a795d7b79f2b852ab4207693285d24d55fe5114";

async function authorized(req: Request) {
  const supplied = req.headers.get("x-sweetgift-service-key") || "";
  if (supplied.length < 40) return false;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(supplied));
  const fingerprint = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return fingerprint === SERVICE_KEY_SHA256;
}

function clean(value: unknown, max: number) {
  return typeof value === "string"
    ? value.replace(/[\r\n]+/g, " ").trim().slice(0, max)
    : "";
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && !value.includes("..");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char] || char
  );
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return Response.json({ error: "not_found" }, { status: 404 });
  if (!(await authorized(req))) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const payload = await req.json() as Record<string, unknown>;
    const type = clean(payload.type, 20);
    const email = clean(payload.email, 254).toLowerCase();
    const name = clean(payload.name, 100);
    const code = clean(payload.code, 6);
    const pdfBase64 = clean(payload.pdfBase64, 10_000_000);
    if (!validEmail(email)) return Response.json({ error: "invalid_email" }, { status: 400 });

    const client = new SMTPClient({ connection: { hostname: SMTP_HOST, port: SMTP_PORT, tls: true, auth: { username: SMTP_USER, password: SMTP_PASSWORD } } });
    try {
      if (type === "code" && /^\d{6}$/.test(code)) {
        await client.send({ from: FROM_EMAIL, to: email, subject: "Код для получения коммерческого предложения SweetGift", html: `<div style="font:16px/1.5 Arial,sans-serif;color:#261d1f;max-width:560px;margin:auto;padding:28px"><h2>SweetGift</h2><p>Ваш код подтверждения:</p><p style="font-size:32px;font-weight:700;letter-spacing:6px;color:#a9284d">${code}</p><p>Код действует 10 минут. Если вы не запрашивали коммерческое предложение, просто проигнорируйте письмо.</p></div>` });
      } else if (type === "proposal" && pdfBase64.length > 100) {
        await client.send({ from: FROM_EMAIL, to: email, subject: "Ваша подборка SweetGift — коммерческое предложение", html: `<div style="font:16px/1.5 Arial,sans-serif;color:#261d1f;max-width:560px;margin:auto;padding:28px"><p>${escapeHtml(name)}, добрый день!</p><p>Во вложении коммерческое предложение с подобранными вариантами SweetGift.</p><p>Если появятся вопросы, ответьте на это письмо — мы на связи.</p></div>`, attachments: [{ filename: "SweetGift-kommercheskoe-predlozhenie.pdf", content: pdfBase64, encoding: "base64", contentType: "application/pdf" }] });
      } else return Response.json({ error: "invalid_payload" }, { status: 400 });
    } finally {
      try { await client.close(); } catch { /* already closed after SMTP failure */ }
    }
    return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("proposal-mailer failed", error instanceof Error ? error.message : "unknown");
    return Response.json({ error: "send_failed" }, { status: 502 });
  }
});
