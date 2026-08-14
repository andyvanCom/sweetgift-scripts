-- The original catalog has more fresh-fruit categories than the first quiz
-- migration knew about. Extend the existing function without changing its API.
do $migration$
declare
  definition text;
  old_fragment text := $$coalesce(c.category_slug,'') in ('fruktovye-korziny','klubnika-v-shokolade','bukety-iz-klubniki')$$;
  new_fragment text := $$coalesce(c.category_slug,'') in ('fruktovye-korziny','klubnika-v-shokolade','bukety-iz-klubniki','frukty-v-shokolade','korziny-s-fruktami-i-shampanskim','bukety_iz_klubniki_i_tsvetov','stakanchiki_s_klubnikoy') or lower(coalesce(c.title,'')) ~ '(^|[^0-9])1 день'$$;
begin
  definition := pg_get_functiondef('public.get_gift_quiz_recommendations(jsonb,integer)'::regprocedure);
  if position(old_fragment in definition) = 0 then
    raise exception 'Expected perishable-category fragment was not found';
  end if;
  execute replace(definition,old_fragment,new_fragment);
end
$migration$;
