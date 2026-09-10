-- Accept both the legacy scalar recipient and a multi-select recipient array.
do $do$
declare
  definition text;
begin
  definition := pg_get_functiondef(
    'public.get_gift_quiz_recommendations(jsonb,integer)'::regprocedure
  );

  if position('jsonb_array_elements_text(i.recipients)' in definition) > 0 then
    return;
  elsif position(
    $old$select coalesce(p_answers->>'recipient','') recipient,coalesce(p_answers->>'budget','any') budget,$old$
    in definition
  ) = 0 then
    raise exception 'recipient input signature not found';
  end if;

  definition := replace(
    definition,
    $old$select coalesce(p_answers->>'recipient','') recipient,coalesce(p_answers->>'budget','any') budget,$old$,
    $new$select
 case when jsonb_typeof(p_answers->'recipient')='array' then p_answers->'recipient'
   when p_answers ? 'recipient' then jsonb_build_array(p_answers->>'recipient')
   else '[]'::jsonb end recipients,
 coalesce(
   case when jsonb_typeof(p_answers->'recipient')='array' then p_answers->'recipient'->>0
     else p_answers->>'recipient' end,
   ''
 ) recipient,
 coalesce(p_answers->>'budget','any') budget,$new$
  );

  if position(
    $old$case i.recipient when 'manager' then c.entities&&array['руководитель'] when 'colleague' then c.entities&&array['коллега']
 when 'woman' then c.entities&&array['девушка','жена','мама','бабушка'] else false end recipient_match,$old$
    in definition
  ) = 0 then
    raise exception 'recipient match expression not found';
  end if;

  definition := replace(
    definition,
    $old$case i.recipient when 'manager' then c.entities&&array['руководитель'] when 'colleague' then c.entities&&array['коллега']
 when 'woman' then c.entities&&array['девушка','жена','мама','бабушка'] else false end recipient_match,$old$,
    $new$exists (
   select 1
   from jsonb_array_elements_text(i.recipients) selected_recipient(value)
   where case selected_recipient.value
     when 'manager' then c.entities&&array['руководитель']
     when 'colleague' then c.entities&&array['коллега']
     when 'woman' then c.entities&&array['девушка','жена','мама','бабушка']
     else false
   end
 ) recipient_match,$new$
  );

  definition := replace(
    definition,
    $old$not(recipient='child' and alcohol_risk)$old$,
    $new$not(recipients ? 'child' and alcohol_risk)$new$
  );
  definition := replace(
    definition,
    $old$case when recipient='child' then 'Без алкоголя' end,$old$,
    $new$case when recipients ? 'child' then 'Без алкоголя' end,$new$
  );

  execute definition;
end
$do$;

-- Replace the coarse price chips with exact lower and upper boundaries.
do $do$
declare
  definition text;
begin
  definition := pg_get_functiondef(
    'public.get_gift_quiz_recommendations(jsonb,integer)'::regprocedure
  );

  if position('budget_min' in definition) = 0 then
    if position(
      $old$coalesce(p_answers->>'budget','any') budget,$old$
      in definition
    ) = 0 then
      raise exception 'budget input signature not found';
    end if;
    definition := replace(
      definition,
      $old$coalesce(p_answers->>'budget','any') budget,$old$,
      $new$coalesce(p_answers->>'budget','any') budget,
 case when coalesce(p_answers->>'budget_min','') ~ '^[0-9]+$'
   then (p_answers->>'budget_min')::numeric end budget_min,
 case when coalesce(p_answers->>'budget_max','') ~ '^[0-9]+$'
   then (p_answers->>'budget_max')::numeric end budget_max,$new$
    );
  end if;

  if position(
    'i.budget_min is not null or i.budget_max is not null'
    in definition
  ) = 0 then
    if position(
      $old$case i.budget when 'under_5000' then c.price<5000 when '5000_7000' then c.price between 5000 and 6999
 when '7000_10000' then c.price between 7000 and 9999 when '10000_15000' then c.price between 10000 and 14999 when 'over_15000' then c.price>=15000 else true end budget_ok,$old$
      in definition
    ) = 0 then
      raise exception 'budget predicate not found';
    end if;
    definition := replace(
      definition,
      $old$case i.budget when 'under_5000' then c.price<5000 when '5000_7000' then c.price between 5000 and 6999
 when '7000_10000' then c.price between 7000 and 9999 when '10000_15000' then c.price between 10000 and 14999 when 'over_15000' then c.price>=15000 else true end budget_ok,$old$,
      $new$case
 when i.budget_min is not null or i.budget_max is not null then
   (i.budget_min is null or c.price>=i.budget_min)
   and (i.budget_max is null or c.price<=i.budget_max)
 else case i.budget
   when 'under_5000' then c.price<5000
   when '5000_7000' then c.price between 5000 and 6999
   when '7000_10000' then c.price between 7000 and 9999
   when '10000_15000' then c.price between 10000 and 14999
   when 'over_15000' then c.price>=15000
   else true
 end end budget_ok,$new$
    );
  end if;

  execute definition;
end
$do$;

comment on function public.get_gift_quiz_recommendations(jsonb,integer) is
  'Ranks gifts for one or several recipients and an exact price range; applies format, composition, timing and safety filters.';
