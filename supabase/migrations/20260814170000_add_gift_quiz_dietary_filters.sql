-- Add combinable dietary restrictions while preserving old pork-only links.
do $migration$
declare
  definition text;
begin
  definition := pg_get_functiondef('public.get_gift_quiz_recommendations(jsonb,integer)'::regprocedure);

  if position($old$coalesce(p_answers->>'pork','none') pork,greatest(1,least(coalesce(p_limit,6),12)) lim$old$ in definition)=0
    or position($old$')) pork_risk
 from catalog c$old$ in definition)=0
    or position($old$and not(pork='no_pork' and pork_risk)$old$ in definition)=0 then
    raise exception 'Expected gift quiz dietary fragments were not found';
  end if;

  definition := replace(definition,
    $old$coalesce(p_answers->>'pork','none') pork,greatest(1,least(coalesce(p_limit,6),12)) lim$old$,
    $new$coalesce(p_answers->>'pork','none') pork,
 case when jsonb_typeof(p_answers->'diet')='array' then p_answers->'diet'
   when p_answers ? 'diet' then jsonb_build_array(p_answers->>'diet')
   when p_answers ? 'pork' then jsonb_build_array(p_answers->>'pork')
   else '["none"]'::jsonb end diet,
 greatest(1,least(coalesce(p_limit,6),12)) lim$new$);

  definition := replace(definition,
    $old$')) pork_risk
 from catalog c$old$,
    $new$')) pork_risk,
 (c.tags&&array['meat','sausage','ikra','crab'] or
   lower(concat_ws(' ',c.title,c.ingredient_text)) ~ '(мяс|свинин|говя|телят|баран|ягнен|олени|медвед|лос|косул|индей|куриц|утк|гус|конин|колбас|салями|бекон|ветчин|прошут|хамон|карбонад|корейк|грудинк|шпик|панчет|чориз|рыб|лосос|с[её]мг|форел|икр|краб|кревет|тунец|анчоус|паштет)') vegetarian_risk,
 (c.tags&&array['chocolate','candies','honey','cookies'] or
   lower(concat_ws(' ',c.title,c.ingredient_text)) ~ '(шоколад|конфет|сладост|сахар|м[её]д|печень|зефир|мармелад|варень|джем|карамел|пирож|трюфел)') sweet_risk,
 (c.tags&&array['cheese'] or
   lower(concat_ws(' ',c.title,c.ingredient_text)) ~ '(молок|сливк|сыр|сливочн[^ ]* масл|йогурт|творог|сметан|кефир|лактоз|пармезан|бри([^а-я]|$)|камамбер|моцарел)') dairy_risk
 from catalog c$new$);

  definition := replace(definition,
    $old$and not(pork='no_pork' and pork_risk)$old$,
    $new$and not(diet ? 'no_pork' and pork_risk)
 and not(diet ? 'vegetarian' and vegetarian_risk)
 and not(diet ? 'no_sweet' and sweet_risk)
 and not(diet ? 'no_dairy' and dairy_risk)$new$);

  definition := replace(definition,
    $old$case when recipient_match then 'Подходит выбранному получателю' end,case when pork='no_pork' then 'Без свинины' end,$old$,
    $new$case when recipient_match then 'Подходит выбранному получателю' end,
 case when diet ? 'no_pork' then 'Без свинины' end,
 case when diet ? 'vegetarian' then 'Без мяса и рыбы' end,
 case when diet ? 'no_sweet' then 'Без сладкого' end,
 case when diet ? 'no_dairy' then 'Без молочных продуктов' end,$new$);

  execute definition;
end
$migration$;
