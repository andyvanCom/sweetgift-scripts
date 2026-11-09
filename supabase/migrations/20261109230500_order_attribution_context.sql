-- Preserve the original browser touch and the last meaningful external/ad
-- touch. Internal navigation and direct returns never replace either source.
begin;

create or replace function neuromaria.capture_order_attribution(
  p_order_id text,
  p_attribution jsonb,
  p_source text
)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  a jsonb := '{}'::jsonb;
  k text;
  v text;
begin
  if p_order_id is null or p_order_id !~ '^[A-Za-z0-9_-]{1,160}$'
     or jsonb_typeof(p_attribution) is distinct from 'object' then return; end if;

  foreach k in array array[
    'client_id','ym_uid','yclid',
    'utm_source','utm_medium','utm_campaign','utm_content','utm_term','utm_referrer',
    'visited_at','landing_page','campaign_id',
    'last_touch_at','last_touch_landing_page','last_touch_referrer','last_touch_yclid',
    'last_touch_campaign_id','last_touch_utm_source','last_touch_utm_medium',
    'last_touch_utm_campaign','last_touch_utm_content','last_touch_utm_term',
    'attribution_version'
  ] loop
    if jsonb_typeof(p_attribution->k) is distinct from 'string' then continue; end if;
    v := left(trim(p_attribution->>k),300);
    if v = '' then continue; end if;

    if k in ('client_id','ym_uid','yclid','last_touch_yclid') and v !~ '^\d{6,30}$' then
      continue;
    end if;
    if k in ('campaign_id','last_touch_campaign_id') and v !~ '^\d{1,20}$' then
      continue;
    end if;
    if k in ('visited_at','last_touch_at') and v !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}' then
      continue;
    end if;
    if k = 'attribution_version' and v !~ '^\d{1,3}$' then
      continue;
    end if;
    if k in ('landing_page','last_touch_landing_page') then
      v := split_part(split_part(v,'?',1),'#',1);
      if v !~ '^https://(www\.|app\.)?sweetgift\.ru(/|$)' or v ~ '@' then continue; end if;
    end if;
    if k in ('utm_referrer','last_touch_referrer') then
      v := split_part(split_part(v,'?',1),'#',1);
      if v !~ '^https?://[^/ ]+(/|$)' or v ~ '@' then continue; end if;
    end if;

    a := a || jsonb_build_object(k,v);
  end loop;

  -- The first successful order capture remains immutable. The last meaningful
  -- touch is selected in the browser before this one-time order snapshot.
  if a <> '{}'::jsonb then
    insert into neuromaria.order_attribution(order_id,attribution,source)
      values(p_order_id,a,p_source) on conflict(order_id) do nothing;
  end if;
end;
$$;

comment on function neuromaria.capture_order_attribution(text,jsonb,text) is
  'Stores privacy-safe first touch and last meaningful order attribution once per order.';

commit;
