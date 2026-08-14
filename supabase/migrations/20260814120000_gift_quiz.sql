-- Live gift quiz: one public recommendation RPC and append-only funnel analytics.
create table if not exists public.gift_quiz_events (
  id bigint generated always as identity primary key,
  quiz_session_id text not null check (char_length(quiz_session_id) between 8 and 100),
  visitor_id text,
  event_type text not null check (event_type in (
    'quiz_open','quiz_answer','quiz_results','quiz_product_click',
    'quiz_show_all','quiz_change_answer','quiz_complete'
  )),
  answers jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  page_url text,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(answers) = 'object'),
  check (jsonb_typeof(payload) = 'object')
);

create index if not exists gift_quiz_events_session_created_idx
  on public.gift_quiz_events (quiz_session_id, created_at desc);
create index if not exists gift_quiz_events_type_created_idx
  on public.gift_quiz_events (event_type, created_at desc);
alter table public.gift_quiz_events enable row level security;
revoke all on table public.gift_quiz_events from public, anon, authenticated;

create or replace function public.track_gift_quiz_event(
  p_quiz_session_id text,
  p_event_type text,
  p_answers jsonb default '{}'::jsonb,
  p_payload jsonb default '{}'::jsonb,
  p_visitor_id text default null,
  p_page_url text default null
) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_event_type not in ('quiz_open','quiz_answer','quiz_results','quiz_product_click','quiz_show_all','quiz_change_answer','quiz_complete') then
    raise exception 'unsupported quiz event';
  end if;
  insert into public.gift_quiz_events(quiz_session_id,visitor_id,event_type,answers,payload,page_url)
  values (left(p_quiz_session_id,100),left(p_visitor_id,100),p_event_type,
    case when jsonb_typeof(p_answers)='object' then p_answers else '{}'::jsonb end,
    case when jsonb_typeof(p_payload)='object' then p_payload else '{}'::jsonb end,
    left(p_page_url,500));
end;
$$;

create or replace function public.get_gift_quiz_recommendations(
  p_answers jsonb default '{}'::jsonb,
  p_limit integer default 6
) returns jsonb
language sql stable security definer set search_path = ''
as $$
with input as (
  select
    coalesce(p_answers->>'recipient','') recipient,
    coalesce(p_answers->>'budget','any') budget,
    coalesce(p_answers->>'style','best') style,
    coalesce(p_answers->>'timing','unknown') timing,
    greatest(1,least(coalesce(p_limit,6),12)) lim
), catalog as (
  select p.product_key,p.title,p.url,p.image,p.price,p.category_slug,
    lower(concat_ws(' ',p.title,p.description,p.composition,p.category_slug)) text_data,
    coalesce(array_agg(distinct lower(pi.tag)) filter(where pi.tag is not null),'{}'::text[]) tags,
    coalesce(array_agg(distinct lower(se.entity_value)) filter(where se.entity_value is not null),'{}'::text[]) entities,
    coalesce(s.views,0) views,coalesce(s.add_to_cart,0) carts,coalesce(s.trend_score,0) trend
  from public.products_catalog p
  left join public.product_ingredients pi on pi.product_key=p.product_key
  left join public.product_seo_entities se on se.product_key=p.product_key
  left join public.products_stats s on s.product_key=p.product_key
  where p.available=true and p.price>0
  group by p.product_key,p.title,p.url,p.image,p.price,p.category_slug,p.description,p.composition,s.views,s.add_to_cart,s.trend_score
), orders as (
  select product_key,sum(coalesce(quantity,1)) orders from public.product_orders where product_key is not null group by product_key
), features as (
  select c.*,i.*,
    coalesce(o.orders,0) orders,
    case i.budget when 'under_5000' then c.price<5000 when '5000_7000' then c.price between 5000 and 6999
      when '7000_10000' then c.price between 7000 and 9999 when '10000_15000' then c.price between 10000 and 14999
      when 'over_15000' then c.price>=15000 else true end budget_ok,
    case i.style
      when 'sweet' then c.tags&&array['strawberry','chocolate','candies','raspberry'] or c.entities&&array['сладкий','клубника в шоколаде']
      when 'fruit' then c.tags&&array['strawberry','raspberry','pineapple','grapes','apples','mandarins','bananas','kiwi','pitahaya','papaya','blackberry','nectarines'] or c.entities&&array['фруктовая корзина']
      when 'gourmet' then c.tags&&array['cheese','meat','sausage','ikra','crab'] or c.entities&&array['гастрономический','сырный','мясной']
      when 'tea' then c.tags&&array['tea','coffee','honey','орехи','chocolate','candies']
      when 'hearty' then c.tags&&array['meat','sausage','cheese','ikra','crab']
      when 'premium' then c.entities&&array['премиум','vip'] or c.price>=15000
      else true end style_ok,
    case i.recipient when 'manager' then c.entities&&array['руководитель']
      when 'colleague' then c.entities&&array['коллега']
      when 'woman' then c.entities&&array['девушка','жена','мама','бабушка']
      else false end recipient_match,
    (coalesce(c.category_slug,'') in ('fruktovye-korziny','klubnika-v-shokolade','bukety-iz-klubniki')
      or c.product_key like '/fruktovye-korziny/%'
      or c.product_key like '/klubnika-v-shokolade/%'
      or c.product_key like '/bukety-iz-klubniki/%'
      or c.entities&&array['клубника в шоколаде','букет из клубники','фруктовая корзина']) perishable
  from catalog c cross join input i left join orders o on o.product_key=c.product_key
), eligible as (
  select *,
    (10 + case when recipient_match then 10 else 0 end +
      case when style = 'best' then 0 when style_ok then 20 else 0 end +
      case when timing in ('now','today') and perishable then 10 when timing in ('tomorrow','longer') and not perishable then 10 when timing='unknown' then 5 else 0 end) relevance,
    ln(1+orders)*20 order_signal,ln(1+carts)*15 cart_signal,ln(1+views)*10 view_signal,ln(1+trend)*5 trend_signal
  from features
  where budget_ok
    and not (timing in ('tomorrow','longer') and perishable)
), scored as (
  select *, relevance + least(order_signal,20)+least(cart_signal,15)+least(view_signal,10)+least(trend_signal,5) score
  from eligible
), ranked as (
  select *,row_number() over(order by relevance desc,score desc,orders desc,carts desc,views desc,price) rn
  from scored
), result as (
  select jsonb_build_object('product_key',product_key,'title',title,'url',url,'image',image,'price',price,
    'score',round(score::numeric,2),'match_percent',least(99,greatest(1,round(100*score/100))),'reasons',
    to_jsonb(array_remove(array[
      case when budget_ok then 'Соответствует бюджету' end,
      case when style_ok and style<>'best' then 'Подходит выбранному типу подарка' end,
      case when recipient_match then 'Подходит выбранному получателю' end,
      case when orders>0 then 'Часто покупают' end,
      case when carts>0 then 'Часто добавляют в корзину' end,
      case when trend>0 then 'Популярен за последнюю неделю' end,
      case when timing in ('now','today') and perishable then 'Подходит для вручения день в день' end,
      case when timing in ('tomorrow','longer') and not perishable then 'Подходит для более длительного хранения' end
    ],null))) item,rn from ranked
)
select jsonb_build_object('total',(select count(*) from scored),'relaxed',false,
  'products',coalesce((select jsonb_agg(item order by rn) from result where rn<=(select lim from input)),'[]'::jsonb));
$$;

revoke execute on function public.track_gift_quiz_event(text,text,jsonb,jsonb,text,text) from public, authenticated;
grant execute on function public.track_gift_quiz_event(text,text,jsonb,jsonb,text,text) to anon;
revoke execute on function public.get_gift_quiz_recommendations(jsonb,integer) from public, authenticated;
grant execute on function public.get_gift_quiz_recommendations(jsonb,integer) to anon;

comment on function public.get_gift_quiz_recommendations(jsonb,integer) is
  'Ranks available gifts: relevance gates first, then orders, carts, views and fresh trend; returns evidence-backed reasons.';
