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

comment on function public.get_gift_quiz_recommendations(jsonb,integer) is
  'Ranks gifts for one or several recipients and applies format, composition, timing and safety filters.';
