-- Add a strict no-pork preference to the gift quiz. Explicit pork terms are
-- excluded, as are ambiguous sausage/salami ingredients unless another meat
-- source is explicitly named.
create or replace function public.get_gift_quiz_recommendations(
  p_answers jsonb default '{}'::jsonb,
  p_limit integer default 6
) returns jsonb
language sql stable security definer set search_path = ''
as $$
with input as (
  select coalesce(p_answers->>'recipient','') recipient,
    coalesce(p_answers->>'budget','any') budget,
    coalesce(p_answers->>'style','best') style,
    coalesce(p_answers->>'timing','unknown') timing,
    coalesce(p_answers->>'pork','none') pork,
    greatest(1,least(coalesce(p_limit,6),12)) lim
), catalog as (
  select p.product_key,p.title,p.url,p.image,p.price,p.category_slug,
    lower(string_agg(distinct concat_ws(' ',pi.ingredient_raw,pi.ingredient_normalized),' ')) ingredient_text,
    coalesce(array_agg(distinct lower(pi.tag)) filter(where pi.tag is not null),'{}'::text[]) tags,
    coalesce(array_agg(distinct lower(se.entity_value)) filter(where se.entity_value is not null),'{}'::text[]) entities,
    coalesce(s.views,0) views,coalesce(s.add_to_cart,0) carts,coalesce(s.trend_score,0) trend
  from public.products_catalog p
  left join public.product_ingredients pi on pi.product_key=p.product_key
  left join public.product_seo_entities se on se.product_key=p.product_key
  left join public.products_stats s on s.product_key=p.product_key
  where p.available=true and p.price>0
  group by p.product_key,p.title,p.url,p.image,p.price,p.category_slug,s.views,s.add_to_cart,s.trend_score
), orders as (
  select product_key,sum(coalesce(quantity,1)) orders
  from public.product_orders where product_key is not null group by product_key
), features as (
  select c.*,i.*,coalesce(o.orders,0) orders,
    case i.budget when 'under_5000' then c.price<5000 when '5000_7000' then c.price between 5000 and 6999
      when '7000_10000' then c.price between 7000 and 9999 when '10000_15000' then c.price between 10000 and 14999
      when 'over_15000' then c.price>=15000 else true end budget_ok,
    case i.style
      when 'sweet' then c.tags&&array['strawberry','chocolate','candies','raspberry'] or c.entities&&array['сладкий','клубника в шоколаде']
      when 'fruit' then c.tags&&array['strawberry','raspberry','pineapple','grapes','apples','mandarins','bananas','kiwi','pitahaya','papaya','blackberry','nectarines'] or c.entities&&array['фруктовая корзина']
      when 'gourmet' then c.tags&&array['cheese','meat','sausage','ikra','crab'] or c.entities&&array['гастрономический','сырный','мясной']
      when 'tea' then c.tags&&array['tea','coffee','honey','орехи','chocolate','candies']
      when 'hearty' then c.tags&&array['meat','sausage','cheese','ikra','crab']
      when 'premium' then c.entities&&array['премиум','vip'] or c.price>=15000 else true end style_ok,
    case i.recipient when 'manager' then c.entities&&array['руководитель']
      when 'colleague' then c.entities&&array['коллега']
      when 'woman' then c.entities&&array['девушка','жена','мама','бабушка'] else false end recipient_match,
    (coalesce(c.category_slug,'') in ('fruktovye-korziny','klubnika-v-shokolade','bukety-iz-klubniki')
      or c.product_key like '/fruktovye-korziny/%' or c.product_key like '/klubnika-v-shokolade/%'
      or c.product_key like '/bukety-iz-klubniki/%'
      or c.entities&&array['клубника в шоколаде','букет из клубники','фруктовая корзина']) perishable,
    (coalesce(c.ingredient_text,'') ~ '(свинин|кабан|бекон|ветчин|прошут|хамон|карбонад|корейк|грудинк|шпик|панчет|чориз|jamon|prosciutto|bacon|pork|chorizo)'
      or (coalesce(c.ingredient_text,'') ~ '(колбас|салями|salami)'
        and coalesce(c.ingredient_text,'') !~ '(олени|медвед|лос|косул|индей|куриц|говя|утк|гус|баран|ягнен|конин)')) pork_risk
  from catalog c cross join input i left join orders o on o.product_key=c.product_key
), eligible as (
  select *, (10 + case when recipient_match then 10 else 0 end +
    case when style='best' then 0 when style_ok then 20 else 0 end +
    case when timing in ('now','today') and perishable then 10
      when timing in ('tomorrow','longer') and not perishable then 10
      when timing='unknown' then 5 else 0 end) relevance,
    ln(1+orders)*20 order_signal,ln(1+carts)*15 cart_signal,
    ln(1+views)*10 view_signal,ln(1+trend)*5 trend_signal
  from features
  where budget_ok and not(timing in ('tomorrow','longer') and perishable)
    and not(pork='no_pork' and pork_risk)
), scored as (
  select *,relevance+least(order_signal,20)+least(cart_signal,15)+least(view_signal,10)+least(trend_signal,5) score
  from eligible
), ranked as (
  select *,row_number() over(order by relevance desc,score desc,orders desc,carts desc,views desc,price) rn from scored
), result as (
  select jsonb_build_object('product_key',product_key,'title',title,'url',url,'image',image,'price',price,
    'score',round(score::numeric,2),'match_percent',least(99,greatest(1,round(score))),'reasons',
    to_jsonb(array_remove(array[
      case when budget_ok then 'Соответствует бюджету' end,
      case when style_ok and style<>'best' then 'Подходит выбранному типу подарка' end,
      case when recipient_match then 'Подходит выбранному получателю' end,
      case when pork='no_pork' then 'Без свинины' end,
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

revoke execute on function public.get_gift_quiz_recommendations(jsonb,integer) from public,authenticated;
grant execute on function public.get_gift_quiz_recommendations(jsonb,integer) to anon;
