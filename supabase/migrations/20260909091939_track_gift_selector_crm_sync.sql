alter table public.gift_selector_requests
  add column if not exists crm_status text not null default 'pending'
    check (crm_status in ('pending', 'created', 'failed')),
  add column if not exists crm_lead_id bigint,
  add column if not exists last_crm_error text;

create index if not exists gift_selector_requests_crm_retry_idx
  on public.gift_selector_requests (crm_status, created_at)
  where crm_status in ('pending', 'failed');

comment on column public.gift_selector_requests.crm_status is
  'Delivery state for the matching amoCRM lead in the incoming stage.';
