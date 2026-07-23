import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RUN_SECRET = Deno.env.get("REPORT_RUN_SECRET") || "";
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });

function authorized(req: Request) {
  return Boolean(RUN_SECRET) &&
    req.headers.get("x-report-secret") === RUN_SECRET;
}

function num(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function increment(map: Map<string, number>, key: unknown, amount = 1) {
  const name = String(key || "Не указано").trim() || "Не указано";
  map.set(name, (map.get(name) || 0) + amount);
}

function ranked(map: Map<string, number>, limit = 10) {
  return Array.from(map, ([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

async function getDashboard(days: number) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const [orderResult, jobResult, productResult, articleResult, reportResult] =
    await Promise.all([
      supabase.from("product_orders").select(
        "order_id,product_key,product_title,category_slug,quantity,item_total,order_total,discount,is_gift,has_message,delivery_type,payment_system,promocode,created_at",
      ).gte("created_at", since).order("created_at", { ascending: false }).limit(
        10000,
      ),
      supabase.from("system_job_logs").select(
        "job_name,started_at,finished_at,status,processed_count,duration_ms,error_message,details",
      ).order("started_at", { ascending: false }).limit(40),
      supabase.from("products_catalog").select("product_key", {
        count: "exact",
        head: true,
      }).eq("available", true),
      supabase.from("articles_index").select("article_key", {
        count: "exact",
        head: true,
      }).eq("is_active", true),
      supabase.rpc("get_daily_report_text"),
    ]);

  const errors = [
    orderResult.error,
    jobResult.error,
    productResult.error,
    articleResult.error,
    reportResult.error,
  ].filter(Boolean);
  if (errors.length) {
    throw new Error(errors.map((error) => error!.message).join("; "));
  }

  const orders = new Map<string, {
    order_id: string;
    created_at: string;
    total: number;
    has_order_total: boolean;
    items: number;
    is_gift: boolean;
    has_message: boolean;
    promocode: string | null;
  }>();
  const products = new Map<string, number>();
  const categories = new Map<string, number>();
  const daily = new Map<string, number>();

  for (const row of orderResult.data || []) {
    const quantity = Math.max(1, num(row.quantity));
    const existing = orders.get(row.order_id);
    if (existing) {
      existing.items += quantity;
      if (!existing.has_order_total) existing.total += num(row.item_total);
    } else {
      orders.set(row.order_id, {
        order_id: row.order_id,
        created_at: row.created_at,
        total: num(row.order_total) || num(row.item_total),
        has_order_total: num(row.order_total) > 0,
        items: quantity,
        is_gift: row.is_gift === true,
        has_message: row.has_message === true,
        promocode: row.promocode,
      });
      increment(daily, String(row.created_at).slice(0, 10));
    }
    increment(products, row.product_title || row.product_key, quantity);
    increment(categories, row.category_slug, quantity);
  }

  const orderList = Array.from(orders.values()).sort((a, b) =>
    b.created_at.localeCompare(a.created_at)
  );
  const revenue = orderList.reduce((sum, order) => sum + order.total, 0);
  const latestJobs = new Map<string, unknown>();
  for (const job of jobResult.data || []) {
    if (!latestJobs.has(job.job_name)) latestJobs.set(job.job_name, job);
  }

  return {
    ok: true,
    period_days: days,
    catalog: {
      products: productResult.count || 0,
      articles: articleResult.count || 0,
    },
    orders: {
      total: orderList.length,
      revenue,
      average_check: orderList.length ? revenue / orderList.length : 0,
      items: orderList.reduce((sum, order) => sum + order.items, 0),
      gifts: orderList.filter((order) => order.is_gift).length,
      messages: orderList.filter((order) => order.has_message).length,
      promocodes: orderList.filter((order) => order.promocode).length,
      daily: Array.from(daily, ([date, value]) => ({ date, value })).sort((
        a,
        b,
      ) => a.date.localeCompare(b.date)),
      top_products: ranked(products),
      top_categories: ranked(categories),
      recent: orderList.slice(0, 20).map((order) => ({
        ...order,
        has_order_total: undefined,
        order_id: order.order_id.slice(-12),
      })),
    },
    pipeline: Array.from(latestJobs.values()),
    report: String(reportResult.data || "Отчет пустой"),
  };
}

const actions: Record<string, { name: string; query?: string }> = {
  products: { name: "import-yml-products" },
  articles: { name: "import-articles-index", query: "?mode=daily&limit=100" },
  classify: { name: "classify-articles" },
  report: { name: "send-daily-report" },
};

async function runAction(action: string) {
  const target = actions[action];
  if (!target) return json({ ok: false, error: "Unknown action" }, 400);
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/${target.name}${target.query || ""}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-report-secret": RUN_SECRET,
      },
      body: "{}",
    },
  );
  const text = await response.text();
  let result: unknown = text;
  try {
    result = JSON.parse(text);
  } catch {
    // Return plain response text when a target does not return JSON.
  }
  return json(
    { ok: response.ok, action, status: response.status, result },
    response.ok ? 200 : 502,
  );
}

const HTML = `<!doctype html><html lang="ru"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>SweetGift Admin</title>
<style>
:root{--ink:#261d1f;--muted:#786b6e;--line:#eadfdd;--red:#a9284d;--red2:#d85c7b;--ok:#24835d;--bad:#c04444;--shadow:0 14px 40px #43202914}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:linear-gradient(145deg,#fff8f3,#f5eff1 55%,#f7eee9);color:var(--ink);font:15px/1.45 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}button,input,select{font:inherit}.wrap{max-width:1240px;margin:auto;padding:28px 20px 60px}.top,.brand,.toolbar{display:flex;align-items:center}.top{justify-content:space-between;gap:16px;margin-bottom:22px}.brand{gap:12px}.logo{width:44px;height:44px;border-radius:15px;display:grid;place-items:center;color:#fff;font-size:21px;font-weight:800;background:linear-gradient(135deg,var(--red),var(--red2));box-shadow:var(--shadow)}h1,h2{margin:0}h1{font-size:25px}.sub{color:var(--muted);font-size:13px}.card,.login{background:#fffffff0;border:1px solid var(--line);border-radius:19px;box-shadow:var(--shadow)}.login{max-width:440px;margin:12vh auto;padding:30px}.field,.toolbar{gap:9px}.field{display:flex;margin-top:18px}.field input{min-width:0;flex:1;border:1px solid var(--line);border-radius:12px;padding:12px}.btn{border:0;border-radius:12px;padding:11px 14px;background:var(--red);color:white;font-weight:650;cursor:pointer}.btn:disabled{opacity:.55;cursor:wait}.btn.alt{background:#f1e7e6;color:var(--ink)}.btn.warn{background:#852e43}.toolbar{flex-wrap:wrap}.toolbar select{border:1px solid var(--line);border-radius:12px;background:white;padding:10px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:13px}.metric,.card{padding:18px}.metric b{display:block;font-size:27px;margin-top:4px}.section{margin-top:18px}.section h2{font-size:18px;margin-bottom:11px}.actions{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}.action{text-align:left}.action small{display:block;font-weight:400;opacity:.82;margin-top:3px}.cols{display:grid;grid-template-columns:1.2fr .8fr;gap:15px}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:9px 7px;border-bottom:1px solid var(--line);font-size:13px}th{color:var(--muted)}.status{display:inline-flex;align-items:center;gap:6px}.dot{width:8px;height:8px;border-radius:50%;background:var(--bad)}.success .dot{background:var(--ok)}.barrow{display:grid;grid-template-columns:minmax(95px,1fr) 2fr 42px;gap:9px;align-items:center;margin:9px 0}.barname{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bar{height:9px;background:#f1e7e6;border-radius:10px;overflow:hidden}.bar i{display:block;height:100%;background:linear-gradient(90deg,var(--red),var(--red2))}.report,.result{white-space:pre-wrap;overflow:auto;border-radius:14px;padding:15px;font:12px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace}.report{max-height:410px;background:#2c2426;color:#fff8f5}.result{margin-top:11px;max-height:210px;background:#f7efed}.error{color:var(--bad);margin-top:12px}.hidden{display:none!important}@media(max-width:880px){.grid{grid-template-columns:repeat(2,1fr)}.cols{grid-template-columns:1fr}.actions{grid-template-columns:repeat(2,1fr)}}@media(max-width:560px){.wrap{padding:16px 11px 40px}.top{align-items:flex-start;flex-direction:column}.actions{grid-template-columns:1fr}.field{flex-direction:column}.metric b{font-size:22px}}
</style></head><body>
<div id="login" class="login"><div class="brand"><div class="logo">S</div><div><h2>SweetGift Admin</h2><div class="sub">Аналитика и управление обработкой</div></div></div><p>Введите секрет ночного отчёта. Он останется только в этой вкладке.</p><form id="loginForm" class="field"><input id="secret" type="password" autocomplete="current-password" placeholder="Секрет доступа" required><button class="btn">Войти</button></form><div id="loginError" class="error"></div></div>
<main id="app" class="wrap hidden"><header class="top"><div class="brand"><div class="logo">S</div><div><h1>SweetGift</h1><div class="sub">Заказы и ночная обработка</div></div></div><div class="toolbar"><select id="period"><option value="7">7 дней</option><option value="30" selected>30 дней</option><option value="90">90 дней</option></select><button id="refresh" class="btn alt">Обновить</button><button id="logout" class="btn alt">Выйти</button></div></header>
<section id="metrics" class="grid"></section>
<section class="section"><h2>Управление pipeline</h2><div class="card"><div class="actions"><button class="btn action" data-action="products">Импорт товаров<small>YML и SEO-сущности</small></button><button class="btn action" data-action="articles">Импорт статей<small>Sitemap и индекс</small></button><button class="btn action" data-action="classify">Классификация<small>Темы и сущности</small></button><button class="btn warn action" data-action="report">Отправить отчёт<small>Письмо прямо сейчас</small></button></div><div id="actionResult" class="result hidden"></div></div></section>
<section class="section cols"><div><h2>Состояние обработки</h2><div class="card"><table><thead><tr><th>Этап</th><th>Статус</th><th>Обработано</th><th>Завершён</th></tr></thead><tbody id="jobs"></tbody></table></div></div><div><h2>Заказы по дням</h2><div id="daily" class="card"></div></div></section>
<section class="section cols"><div><h2>Популярные товары</h2><div id="products" class="card"></div></div><div><h2>Категории</h2><div id="categories" class="card"></div></div></section>
<section class="section cols"><div><h2>Последние заказы</h2><div class="card"><table><thead><tr><th>Заказ</th><th>Дата</th><th>Позиций</th><th>Сумма</th></tr></thead><tbody id="orders"></tbody></table></div></div><div><h2>Ежедневный отчёт</h2><div id="report" class="report"></div></div></section>
</main><script>
const state={secret:sessionStorage.getItem("sg_admin_secret")||""},el=id=>document.getElementById(id),esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])),money=v=>new Intl.NumberFormat("ru-RU",{style:"currency",currency:"RUB",maximumFractionDigits:0}).format(Number(v)||0),date=v=>v?new Date(v).toLocaleString("ru-RU",{dateStyle:"short",timeStyle:"short"}):"—";
async function api(path,options={}){const base=location.pathname.replace(/\\/$/,"");const r=await fetch(base+"/"+path,{...options,headers:{...(options.headers||{}),"x-report-secret":state.secret,"content-type":"application/json"}}),b=await r.json();if(!r.ok)throw new Error(b.error||"Ошибка запроса");return b}
function bars(id,rows,key="name"){const max=Math.max(1,...rows.map(x=>+x.value||0));el(id).innerHTML=rows.length?rows.map(x=>'<div class="barrow"><div class="barname" title="'+esc(x[key])+'">'+esc(x[key])+'</div><div class="bar"><i style="width:'+Math.max(3,(+x.value||0)/max*100)+'%"></i></div><b>'+esc(x.value)+'</b></div>').join(""):'<div class="sub">Пока нет данных</div>'}
function render(d){const o=d.orders;el("metrics").innerHTML=[["Заказы",o.total],["Выручка",money(o.revenue)],["Средний чек",money(o.average_check)],["Товаров продано",o.items],["Подарки",o.gifts],["С поздравлением",o.messages],["С промокодом",o.promocodes],["Каталог",d.catalog.products+" / "+d.catalog.articles]].map(x=>'<div class="metric card"><div class="sub">'+esc(x[0])+'</div><b>'+esc(x[1])+'</b></div>').join("");el("jobs").innerHTML=d.pipeline.map(j=>'<tr><td>'+esc(j.job_name)+'</td><td><span class="status '+(j.status==="success"?"success":"")+'"><i class="dot"></i>'+esc(j.status)+'</span></td><td>'+esc(j.processed_count)+'</td><td>'+date(j.finished_at||j.started_at)+'</td></tr>').join("");bars("daily",o.daily,"date");bars("products",o.top_products);bars("categories",o.top_categories);el("orders").innerHTML=o.recent.length?o.recent.map(x=>'<tr><td>…'+esc(x.order_id)+'</td><td>'+date(x.created_at)+'</td><td>'+esc(x.items)+'</td><td>'+money(x.total)+'</td></tr>').join(""):'<tr><td colspan="4" class="sub">Заказов за период нет</td></tr>';el("report").textContent=d.report}
async function load(){el("refresh").disabled=true;try{render(await api("api/dashboard?days="+el("period").value));el("login").classList.add("hidden");el("app").classList.remove("hidden")}finally{el("refresh").disabled=false}}
el("loginForm").addEventListener("submit",async e=>{e.preventDefault();state.secret=el("secret").value;el("loginError").textContent="";try{await load();sessionStorage.setItem("sg_admin_secret",state.secret)}catch(x){state.secret="";el("loginError").textContent=x.message}});el("refresh").onclick=()=>load().catch(x=>alert(x.message));el("period").onchange=()=>load().catch(x=>alert(x.message));el("logout").onclick=()=>{sessionStorage.removeItem("sg_admin_secret");location.reload()};
document.querySelectorAll("[data-action]").forEach(b=>b.onclick=async()=>{const action=b.dataset.action;if(action==="report"&&!confirm("Отправить отчёт на почту сейчас?"))return;if(!confirm("Запустить «"+b.firstChild.textContent.trim()+"»?"))return;b.disabled=true;const box=el("actionResult");box.classList.remove("hidden");box.textContent="Выполняется…";try{const r=await api("api/run",{method:"POST",body:JSON.stringify({action})});box.textContent=JSON.stringify(r,null,2);await load()}catch(x){box.textContent="Ошибка: "+x.message}finally{b.disabled=false}});if(state.secret)load().catch(()=>{sessionStorage.removeItem("sg_admin_secret");state.secret=""});
</script></body></html>`;

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (url.pathname.endsWith("/api/dashboard")) {
    if (!authorized(req)) return json({ ok: false, error: "Неверный секрет" }, 401);
    const days = Math.min(
      90,
      Math.max(1, Number(url.searchParams.get("days")) || 30),
    );
    try {
      return json(await getDashboard(days));
    } catch (error) {
      return json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }, 500);
    }
  }
  if (url.pathname.endsWith("/api/run") && req.method === "POST") {
    if (!authorized(req)) return json({ ok: false, error: "Неверный секрет" }, 401);
    try {
      const body = await req.json();
      return await runAction(String(body?.action || ""));
    } catch (error) {
      return json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }, 500);
    }
  }
  return new Response(HTML, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-security-policy":
        "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    },
  });
});
