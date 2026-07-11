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

Deno.serve(async (req) => {
  const runSecret = Deno.env.get("REPORT_RUN_SECRET");
  const requestSecret = req.headers.get("x-report-secret");

  if (runSecret && requestSecret !== runSecret) {
    return Response.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data, error } = await supabase.rpc("get_daily_report_text");

    if (error) throw new Error(error.message);

    const reportText = String(data || "Отчет пустой");

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

    return Response.json({
      ok: true,
      subject,
      sent_to: REPORT_TO_EMAIL,
    });
  } catch (e) {
    return Response.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
});