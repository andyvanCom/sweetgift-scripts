-- For a colleague with no budget ceiling and no preferred style, keep the
-- strongest general matches first and then show the three approved luxury
-- baskets. All eligibility rules (storage, pork, availability) still apply.
do $migration$
declare
  definition text;
  old_ranked text := $$ranked as (select *,row_number() over(order by relevance desc,score desc,orders desc,carts desc,views desc,price) rn from scored),
result as ($$;
  new_ranked text := $$ranked as (select *,row_number() over(order by relevance desc,score desc,orders desc,carts desc,views desc,price) rn from scored),
ordered as (
 select *,row_number() over(order by
   case when budget='any' and recipient='colleague' and style='best' then
     case when rn<=3 then 0
       when product_key=any(array[
         '/podarochnye-korziny-s-produktami/tproduct/881111337422-podarochnaya-korzina-russkii-banket',
         '/premium-korziny/tproduct/763890584232-podarochnaya-korzina-vershina-vkusa',
         '/podarochnye-korziny-s-produktami/tproduct/847585715982-podarochnaya-korzina-s-ikroi-i-fruktami'
       ]::text[]) then 1 else 2 end
   else 0 end,
   case when budget='any' and recipient='colleague' and style='best' and rn>3
     and product_key=any(array[
       '/podarochnye-korziny-s-produktami/tproduct/881111337422-podarochnaya-korzina-russkii-banket',
       '/premium-korziny/tproduct/763890584232-podarochnaya-korzina-vershina-vkusa',
       '/podarochnye-korziny-s-produktami/tproduct/847585715982-podarochnaya-korzina-s-ikroi-i-fruktami'
     ]::text[])
     then array_position(array[
       '/podarochnye-korziny-s-produktami/tproduct/881111337422-podarochnaya-korzina-russkii-banket',
       '/premium-korziny/tproduct/763890584232-podarochnaya-korzina-vershina-vkusa',
       '/podarochnye-korziny-s-produktami/tproduct/847585715982-podarochnaya-korzina-s-ikroi-i-fruktami'
     ]::text[],product_key) else rn end,
   rn) display_rn
 from ranked
),
result as ($$;
begin
  definition := pg_get_functiondef('public.get_gift_quiz_recommendations(jsonb,integer)'::regprocedure);
  if position(old_ranked in definition)=0 or position('item,rn from ranked' in definition)=0 then
    raise exception 'Expected gift quiz ranking fragments were not found';
  end if;
  definition := replace(definition,old_ranked,new_ranked);
  definition := replace(definition,'item,rn from ranked','item,display_rn rn from ordered');
  execute definition;
end
$migration$;
