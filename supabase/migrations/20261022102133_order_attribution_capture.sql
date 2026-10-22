-- Capture augments the existing anonymous product-order RPC. It never sends a
-- conversion and does not trust browser totals or payment claims.
begin;
create schema if not exists neuromaria;
revoke all on schema neuromaria from public, anon, authenticated;
create table neuromaria.order_attribution (
  order_id text primary key check (order_id ~ '^[A-Za-z0-9_-]{1,160}$'),
  attribution jsonb not null,
  captured_at timestamptz not null default now(),
  source text not null check (source in ('browser','server'))
);
alter table neuromaria.order_attribution enable row level security;
revoke all on neuromaria.order_attribution from public, anon, authenticated;

create function neuromaria.capture_order_attribution(p_order_id text, p_attribution jsonb, p_source text)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  a jsonb := '{}'::jsonb;
  k text;
  v text;
begin
  if p_order_id is null or p_order_id !~ '^[A-Za-z0-9_-]{1,160}$'
     or jsonb_typeof(p_attribution) is distinct from 'object' then return; end if;
  foreach k in array array['client_id','ym_uid','yclid','utm_source','utm_medium','utm_campaign','utm_content','utm_term','visited_at','landing_page','campaign_id'] loop
    if jsonb_typeof(p_attribution->k) is distinct from 'string' then continue; end if;
    v := left(trim(p_attribution->>k),300);
    if v = '' then continue; end if;
    if k in ('client_id','ym_uid') and v !~ '^\d{6,30}$' then continue; end if;
    if k = 'yclid' and v !~ '^\d{6,30}$' then continue; end if;
    if k = 'campaign_id' and v !~ '^\d{1,20}$' then continue; end if;
    if k = 'visited_at' and v !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}' then continue; end if;
    if k = 'landing_page' then
      -- Strip URL queries/fragments: they may contain customer contact data.
      v := split_part(split_part(v,'?',1),'#',1);
      if v !~ '^https://(www\.)?(app\.)?sweetgift\.ru(/|$)' or v ~ '@' then continue; end if;
    end if;
    a := a || jsonb_build_object(k,v);
  end loop;
  -- First successful order capture is immutable. A manager/technical browser
  -- or a retried form cannot replace its identifiers later.
  if a <> '{}'::jsonb then
    insert into neuromaria.order_attribution(order_id,attribution,source)
      values(p_order_id,a,p_source) on conflict(order_id) do nothing;
  end if;
end;
$$;
revoke all on function neuromaria.capture_order_attribution(text,jsonb,text) from public,anon,authenticated;

-- Modify only the final return of the deployed RPC, preserving existing item
-- analytics and validation. Fail closed if the function no longer matches.
do $$
declare original text; marker text := '  return jsonb_build_object(';
begin
  select pg_get_functiondef('public.track_product_order(jsonb)'::regprocedure) into original;
  if length(original)-length(replace(original,marker,'')) <> length(marker) then
    raise exception 'track_product_order definition changed; review migration';
  end if;
  execute replace(original,marker,
    '  perform neuromaria.capture_order_attribution(v_order_id, p_order->''attribution'', ''browser'');' || chr(10) || marker);
end;
$$;

create function public.save_order_attribution(p_order_id text,p_attribution jsonb)
returns void language sql security definer set search_path = '' as $$
  select neuromaria.capture_order_attribution(p_order_id,p_attribution,'server');
$$;
revoke all on function public.save_order_attribution(text,jsonb) from public,anon,authenticated;
grant execute on function public.save_order_attribution(text,jsonb) to service_role;

create function public.get_order_attribution(p_order_id text,p_created_at timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare records jsonb;
begin
  -- CRM sometimes stores the numeric suffix of Tilda's TYYYYMM-number. Match
  -- only that explicit format and CRM creation month; never a fuzzy suffix.
  select jsonb_agg(jsonb_build_object('order_id',order_id,'attribution',attribution,'captured_at',captured_at)) into records
  from neuromaria.order_attribution
  where order_id=p_order_id or (
    p_order_id ~ '^\d{6,12}$'
    and order_id='T'||to_char(p_created_at at time zone 'Europe/Moscow','YYYYMM')||'-'||p_order_id
  );
  if jsonb_array_length(records)>1 then raise exception 'ambiguous_order_attribution'; end if;
  return records->0;
end;
$$;
revoke all on function public.get_order_attribution(text,timestamptz) from public,anon,authenticated;
grant execute on function public.get_order_attribution(text,timestamptz) to service_role;
commit;
