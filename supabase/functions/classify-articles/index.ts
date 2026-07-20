import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Article = {
  article_key: string;
  title: string | null;
  description: string | null;
  url: string | null;
  is_active: boolean | null;
};

type Entity = {
  article_key: string;
  entity_type: string;
  entity_value: string;
  weight: number;
  source: string;
  reason: string;
};

function has(text: string, patterns: string[]) {
  return patterns.some((p) => text.includes(p));
}

function add(
  list: Entity[],
  article: Article,
  entity_type: string,
  entity_value: string,
  weight: number,
  reason: string,
) {
  list.push({
    article_key: article.article_key,
    entity_type,
    entity_value,
    weight,
    source: "auto",
    reason,
  });
}

function classifyArticle(article: Article): Entity[] {
  const text = `${article.title || ""} ${article.description || ""} ${article.url || ""}`.toLowerCase();
  const result: Entity[] = [];

  // product_type
  if (has(text, ["клубник", "шоколад", "callebaut", "лаймберри", "малин"])) {
    add(result, article, "product_type", "клубника в шоколаде", 150, "product_type: strawberry/chocolate");
  }

  if (has(text, ["букет из клубник", "букеты из клубник"])) {
    add(result, article, "product_type", "букет из клубники", 180, "product_type: strawberry bouquet");
  }

  if (has(text, ["фруктов", "голубик", "физалис", "лайм", "ягод"])) {
    add(result, article, "product_type", "фруктовая корзина", 130, "product_type: fruits/berries");
  }

  if (has(text, ["подарочн", "гастрономическ", "корзин", "деликатес", "продуктов", "гастро"])) {
    add(result, article, "product_type", "подарочная корзина", 150, "product_type: gift basket/gastro");
  }

  if (has(text, ["подарочн набор", "набор из", "гастробокс", "бенто"])) {
    add(result, article, "product_type", "подарочный набор", 150, "product_type: gift set/gastrobox");
  }

  if (has(text, ["пион", "цвет", "флорист", "букет"])) {
    add(result, article, "product_type", "цветы и букеты", 130, "product_type: flowers/bouquet");
  }

  // recipients
  const recipients: Array<[string, string[]]> = [
    ["мама", ["мам"]],
    ["папа", ["пап", "отц"]],
    ["бабушка", ["бабуш"]],
    ["дедушка", ["дедуш"]],
    ["дочь", ["дочк", "дочер"]],
    ["сын", ["сын"]],
    ["жена", ["жене", "жену", "жены", "супруге"]],
    ["муж", ["мужу", "мужа", "мужем", "супругу"]],
    ["девушка", ["девуш"]],
    ["парень", ["парн"]],
    ["подруга", ["подруг"]],
    ["друг", ["друг"]],
    ["брат", ["брат"]],
    ["сестра", ["сестр"]],
    ["коллега", ["коллег"]],
    ["руководитель", ["руковод", "директор", "начальник", "босс", "топ-менеджер", "топ менеджер"]],
    ["партнер", ["партнер", "партнёр"]],
    ["врач", ["врач", "доктор"]],
    ["учитель", ["учител", "преподавател"]],
    ["воспитатель", ["воспитател"]],
    ["ветеран", ["ветеран"]],
    ["мужчина", ["мужчин", "23 февраля", "защитник"]],
    ["женщина", ["женщин", "8 марта"]],
    ["дети", ["детям", "детей", "ребен", "ребён", "класс", "выпускник"]],
  ];

  for (const [value, patterns] of recipients) {
    if (has(text, patterns)) add(result, article, "recipient", value, 100, `recipient: ${value}`);
  }

  // occasions
  const occasions: Array<[string, string[]]> = [
    ["день рождения", ["день рождения", "др"]],
    ["юбилей", ["юбилей"]],
    ["новый год", ["новый год", "новогод"]],
    ["8 марта", ["8 марта"]],
    ["23 февраля", ["23 февраля", "защитник"]],
    ["14 февраля", ["14 февраля", "валентин", "влюблен"]],
    ["9 мая", ["9 мая", "день победы", "победы"]],
    ["выпускной", ["выпускной", "выпускник", "последний звонок"]],
    ["новоселье", ["новосел"]],
    ["свадьба", ["свадьб", "молодожен", "молодожён"]],
    ["годовщина", ["годовщин", "год отношений"]],
    ["благодарность", ["благодар", "отблагодар"]],
    ["день учителя", ["день учителя"]],
    ["день матери", ["день матери"]],
  ];

  for (const [value, patterns] of occasions) {
    if (has(text, patterns)) add(result, article, "occasion", value, 100, `occasion: ${value}`);
  }

  // styles
  const styles: Array<[string, string[]]> = [
    ["vip", ["vip", "вип", "премиум", "премиальн", "статусн", "элитн", "дорог", "luxury"]],
    ["корпоративный", ["корпоратив", "бизнес", "делов", "компан", "партнер", "партнёр"]],
    ["романтический", ["романтич", "любим", "влюблен", "примирен", "год отношений"]],
    ["недорогой", ["недорог", "бюджет"]],
    ["сладкий", ["слад", "зефир", "маршм", "нуга", "помад", "шоколад", "варень", "желе", "десерт", "мармелад"]],
    ["мясной", ["мяс", "специи", "брусничный соус", "раков", "раки"]],
    ["сырный", ["сыр", "вино"]],
    ["гастрономический", ["гастро", "гастроном", "деликатес", "продуктов"]],
  ];

  for (const [value, patterns] of styles) {
    if (has(text, patterns)) add(result, article, "style", value, 90, `style: ${value}`);
  }

  // ingredients
  const ingredients: Array<[string, string[]]> = [
    ["клубника", ["клубник"]],
    ["шоколад", ["шоколад", "callebaut"]],
    ["малина", ["малин"]],
    ["голубика", ["голубик"]],
    ["лайм", ["лайм"]],
    ["физалис", ["физалис"]],
    ["зефир", ["зефир", "маршм"]],
    ["нуга", ["нуга"]],
    ["помадка", ["помадк"]],
    ["мастика", ["мастик"]],
    ["пищевое золото", ["пищевое золото"]],
    ["базилик", ["базилик"]],
    ["орегано", ["орегано"]],
    ["розмарин", ["розмарин"]],
    ["тимьян", ["тимьян"]],
    ["специи", ["специи", "приправа"]],
    ["мясо", ["мяс", "раков", "раки"]],
    ["сыр", ["сыр"]],
    ["вино", ["вино"]],
    ["варенье", ["варень"]],
    ["желе", ["желе"]],
    ["цукаты", ["цукат"]],
  ];

  for (const [value, patterns] of ingredients) {
    if (has(text, patterns)) add(result, article, "ingredient", value, 80, `ingredient: ${value}`);
  }

  // age
  const ageMatches = text.matchAll(/([0-9]{1,2})\s*(лет|год|года)/g);
  for (const m of ageMatches) {
    add(result, article, "age", m[1], 100, `age: ${m[1]}`);
  }

  // fallback для общих статей о подарках
  if (result.length === 0 && has(text, ["что подарить", "подарок", "подарки", "идеи подар"])) {
    add(result, article, "occasion", "день рождения", 70, "fallback: gift article");
    add(result, article, "recipient", "мужчина", 60, "fallback: gift article");
    add(result, article, "recipient", "женщина", 60, "fallback: gift article");
  }

  return result;
}

Deno.serve(async (req) => {
  const runSecret = Deno.env.get("REPORT_RUN_SECRET");
  const requestSecret = req.headers.get("x-report-secret");

  if (runSecret && requestSecret !== runSecret) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  let jobLogId: number | string | null = null;

  try {
    const { data: jobLog } = await supabase
      .from("system_job_logs")
      .insert({
        job_name: "classify-articles",
        started_at: startedAt,
        status: "running",
      })
      .select("id")
      .maybeSingle();

    jobLogId = jobLog?.id || null;

    const { data: articles, error } = await supabase
      .from("articles_index")
      .select("article_key,title,description,url,is_active")
      .eq("is_active", true);

    if (error) throw new Error(error.message);

    const allArticles = (articles || []) as Article[];

    const { error: deleteError } = await supabase
      .from("article_seo_entities")
      .delete()
      .eq("source", "auto");

    if (deleteError) throw new Error(deleteError.message);

    const entitiesRaw: Entity[] = [];

    for (const article of allArticles) {
      entitiesRaw.push(...classifyArticle(article));
    }

    const seen = new Set<string>();
    const entities: Entity[] = [];

    for (const entity of entitiesRaw) {
      const key = `${entity.article_key}|||${entity.entity_type}|||${entity.entity_value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      entities.push(entity);
    }

    let inserted = 0;

    for (let i = 0; i < entities.length; i += 500) {
      const chunk = entities.slice(i, i + 500);

      const { error: insertError } = await supabase
        .from("article_seo_entities")
        .upsert(chunk, {
          onConflict: "article_key,entity_type,entity_value",
        });

      if (insertError) throw new Error(insertError.message);

      inserted += chunk.length;
    }

    const { data: topicData, error: topicError } = await supabase.rpc(
      "assign_missing_article_seo_topics",
    );

    if (topicError) throw new Error(topicError.message);

    if (jobLogId) {
      await supabase.from("system_job_logs").update({
        finished_at: new Date().toISOString(),
        status: "success",
        processed_count: allArticles.length,
        duration_ms: Date.now() - startedMs,
        error_message: null,
        details: {
          processed_articles: allArticles.length,
          inserted_entities: inserted,
          article_seo_topics: topicData,
          downstream_refreshes: "scheduled separately at 04:50 and 04:55 UTC",
        },
      }).eq("id", jobLogId);
    }

    return Response.json({
      ok: true,
      processed_articles: allArticles.length,
      inserted_entities: inserted,
      article_seo_topics: topicData,
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
      { ok: false, error: message },
      { status: 500 },
    );
  }
});
