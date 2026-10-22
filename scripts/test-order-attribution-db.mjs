// Local PostgreSQL/WASM only; never connects to Supabase or production.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db=new PGlite();
await db.exec(`
create role anon; create role authenticated; create role service_role;
create table public.product_orders (
 id bigint generated always as identity primary key,created_at timestamptz default now(),
 order_id text,order_item_index integer,product_key text,product_title text,category_slug text,
 quantity numeric,price numeric,item_total numeric,order_total numeric,subtotal numeric,discount numeric,
 samsebe text,delivery_date text,delivery_interval text,delivery_type text,delivery_price numeric,
 payment_system text,promocode text,client_type text,freecard text,page_url text,referrer text
);
create function public.track_product_event(text,text,text,text,text,text,text,text,text,text,text,text)
 returns void language sql as 'select';
`);
await db.exec(fs.readFileSync(new URL('../supabase/migrations/20260718120000_order_analytics.sql',import.meta.url),'utf8'));
await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261022094858_order_attribution_capture.sql',import.meta.url),'utf8'));
const order={order_id:'T202610-1234567890',items:[{product_key:'gift',product_title:'Gift',quantity:1,price:1200}],order_total:1200,attribution:{client_id:'1234567890123456789',yclid:'9876543210123456789',utm_campaign:'123456789',landing_page:'https://sweetgift.ru/catalog?phone=79991234567',phone:'forbidden',token:'forbidden'}};
await db.exec('set role anon');
const created=await db.query('select public.track_product_order($1::jsonb) as result',[JSON.stringify(order)]);
assert.equal(created.rows[0].result.inserted_count,1);
await db.query('select public.track_product_order($1::jsonb)',[JSON.stringify({...order,attribution:{client_id:'1111111111111111'}})]);
await assert.rejects(db.query('select * from neuromaria.order_attribution'));
await assert.rejects(db.query("select public.get_order_attribution('1234567890','2026-10-19')"));
await assert.rejects(db.query("select public.save_order_attribution('x','{}')"));
await db.exec('reset role; set role service_role');
const rows=await db.query("select public.get_order_attribution('1234567890','2026-10-19') as result");
assert.equal(rows.rows[0].result.attribution.client_id,order.attribution.client_id);
assert.equal(rows.rows[0].result.attribution.yclid,order.attribution.yclid);
assert.equal(rows.rows[0].result.attribution.phone,undefined);
assert.equal(rows.rows[0].result.attribution.token,undefined);
assert.equal(rows.rows[0].result.attribution.landing_page,'https://sweetgift.ru/catalog');
assert.equal((await db.query("select public.get_order_attribution('1234567890','2026-09-19') as result")).rows[0].result,null);
await db.query("select public.save_order_attribution('1234567890','{\"client_id\":\"222222222222\"}')");
await assert.rejects(db.query("select public.get_order_attribution('1234567890','2026-10-19')"),/ambiguous_order_attribution/);
await db.exec('reset role');
assert.equal((await db.query('select count(*) as count from public.product_orders')).rows[0].count,1);
await db.close();
console.log('PostgreSQL: capture, first-write identity, RPC compatibility, RLS/grants, month-bound aliases and ambiguity checks passed.');
