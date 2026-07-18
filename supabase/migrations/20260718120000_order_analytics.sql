-- Anonymous order analytics for the Tilda cart.
-- The table is intentionally unavailable through PostgREST; writes go through
-- the validated SECURITY DEFINER RPC only.

alter table public.product_orders
  drop column if exists customer_name,
  drop column if exists recipient_name,
  drop column if exists happy_message,
  drop column if exists agreement;

alter table public.product_orders
  add column if not exists is_gift boolean,
  add column if not exists has_message boolean not null default false,
  add column if not exists message_length integer not null default 0;

alter table public.product_orders
  drop constraint if exists product_orders_message_length_check;

alter table public.product_orders
  add constraint product_orders_message_length_check
  check (message_length between 0 and 10000);

create unique index if not exists product_orders_order_item_uidx
  on public.product_orders (order_id, order_item_index);

alter table public.product_orders enable row level security;
revoke all on table public.product_orders from anon, authenticated;

create or replace function public.track_product_order(p_order jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_id text;
  v_item jsonb;
  v_item_index integer := 0;
  v_inserted_id bigint;
  v_inserted_count integer := 0;
  v_product_key text;
  v_product_title text;
  v_category_slug text;
  v_quantity integer;
  v_price numeric;
  v_item_total numeric;
begin
  if p_order is null or jsonb_typeof(p_order) <> 'object' then
    raise exception 'invalid order payload' using errcode = '22023';
  end if;

  v_order_id := nullif(left(trim(p_order->>'order_id'), 160), '');
  if v_order_id is null then
    raise exception 'order_id is required' using errcode = '22023';
  end if;

  if jsonb_typeof(p_order->'items') <> 'array'
     or jsonb_array_length(p_order->'items') = 0
     or jsonb_array_length(p_order->'items') > 100 then
    raise exception 'items must contain 1..100 entries' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_order->'items')
  loop
    v_product_key := nullif(left(trim(v_item->>'product_key'), 500), '');
    v_product_title := nullif(left(trim(v_item->>'product_title'), 300), '');
    v_category_slug := nullif(left(trim(v_item->>'category_slug'), 160), '');
    v_quantity := greatest(1, least(1000, coalesce((v_item->>'quantity')::integer, 1)));
    v_price := nullif(v_item->>'price', '')::numeric;
    v_item_total := nullif(v_item->>'item_total', '')::numeric;

    insert into public.product_orders (
      order_id, order_item_index, product_key, product_title, category_slug,
      quantity, price, item_total, order_total, subtotal, discount,
      samsebe, is_gift, delivery_date, delivery_interval, delivery_type,
      delivery_price, payment_system, promocode, client_type, freecard,
      has_message, message_length, page_url, referrer
    ) values (
      v_order_id, v_item_index, v_product_key, v_product_title, v_category_slug,
      v_quantity, v_price, v_item_total,
      nullif(p_order->>'order_total', '')::numeric,
      nullif(p_order->>'subtotal', '')::numeric,
      nullif(p_order->>'discount', '')::numeric,
      nullif(left(trim(p_order->>'samsebe'), 100), ''),
      case when p_order ? 'is_gift' then (p_order->>'is_gift')::boolean else null end,
      nullif(left(trim(p_order->>'delivery_date'), 80), ''),
      nullif(left(trim(p_order->>'delivery_interval'), 100), ''),
      nullif(left(trim(p_order->>'delivery_type'), 160), ''),
      nullif(p_order->>'delivery_price', '')::numeric,
      nullif(left(trim(p_order->>'payment_system'), 100), ''),
      nullif(left(trim(p_order->>'promocode'), 100), ''),
      nullif(left(trim(p_order->>'client_type'), 100), ''),
      nullif(left(trim(p_order->>'freecard'), 160), ''),
      coalesce((p_order->>'has_message')::boolean, false),
      greatest(0, least(10000, coalesce((p_order->>'message_length')::integer, 0))),
      nullif(left(trim(p_order->>'page_url'), 500), ''),
      nullif(left(trim(p_order->>'referrer'), 500), '')
    )
    on conflict (order_id, order_item_index) do nothing
    returning id into v_inserted_id;

    if v_inserted_id is not null then
      v_inserted_count := v_inserted_count + 1;

      if v_product_key is not null then
        perform public.track_product_event(
          v_product_key,
          'purchase',
          v_product_title,
          null,
          v_category_slug,
          v_category_slug,
          null,
          'order',
          nullif(left(trim(p_order->>'page_url'), 500), ''),
          nullif(left(trim(p_order->>'referrer'), 500), ''),
          null,
          null
        );
      end if;
    end if;

    v_item_index := v_item_index + 1;
    v_inserted_id := null;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'order_id', v_order_id,
    'items_count', v_item_index,
    'inserted_count', v_inserted_count
  );
end;
$$;

revoke all on function public.track_product_order(jsonb) from public;
grant execute on function public.track_product_order(jsonb) to anon, authenticated;

comment on function public.track_product_order(jsonb) is
  'Validates and stores anonymous Tilda order analytics; retries are idempotent.';
