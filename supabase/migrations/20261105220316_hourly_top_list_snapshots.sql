create schema top_ranking;
revoke all on schema top_ranking from public;
grant usage on schema top_ranking to anon, authenticated, service_role;

create table top_ranking.page_snapshots (
  period text not null,
  path text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'array'),
  refreshed_at timestamptz not null default transaction_timestamp(),
  primary key (period, path)
);

alter table top_ranking.page_snapshots enable row level security;
revoke all on top_ranking.page_snapshots from public, anon, authenticated, service_role;
grant select on top_ranking.page_snapshots to anon, authenticated, service_role;
create policy read_public_top_page_snapshots on top_ranking.page_snapshots
  for select to anon, authenticated, service_role using (true);

create function top_ranking.refresh_page_snapshots()
returns void
language plpgsql
set search_path = ''
as $$
begin
  -- Readers keep seeing the previous generation until the new one commits.
  delete from top_ranking.page_snapshots;

  with period_lists as materialized (
    select period, public.get_public_top_lists_page_period(period)::jsonb as lists
    from (values ('today'), ('yesterday'), ('week'), ('month'), ('quarter')) as periods(period)
  ),
  overview as (
    select p.period, '/top' as path, coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'icon', l.entry->'icon',
          'title', l.entry->'title',
          'description', l.entry->'description',
          'url', l.entry->'url',
          'items', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'product_title', i.item->'product_title',
                'product_key', i.item->'product_key',
                'product_image', i.item->'product_image'
              ) order by i.position
            )
            from jsonb_array_elements(l.entry->'items') with ordinality as i(item, position)
            where i.position <= 8
          ), '[]'::jsonb)
        ) order by l.position
      )
      from jsonb_array_elements(p.lists) with ordinality as l(entry, position)
    ), '[]'::jsonb) as payload
    from period_lists p
  )
  insert into top_ranking.page_snapshots (period, path, payload)
  select period, path, payload from overview
  union all
  select p.period, rtrim(l.entry->>'url', '/'), jsonb_build_array(l.entry)
  from period_lists p
  cross join lateral jsonb_array_elements(p.lists) as l(entry)
  where l.entry->>'url' like '/top/%';

  if not exists (
    select 1
    from top_ranking.page_snapshots s
    cross join lateral jsonb_array_elements(s.payload) as l(entry)
    where s.period = 'week' and s.path = '/top'
      and jsonb_array_length(l.entry->'items') > 0
  ) then
    raise exception 'Weekly top ranking has no products; keeping the previous snapshots';
  end if;
end;
$$;

create function top_ranking.refresh_rankings_and_snapshots()
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform public.refresh_all_top_lists();
  perform top_ranking.refresh_page_snapshots();
end;
$$;

revoke all on function top_ranking.refresh_page_snapshots() from public, anon, authenticated, service_role;
revoke all on function top_ranking.refresh_rankings_and_snapshots() from public, anon, authenticated, service_role;

create function public.get_public_top_snapshot(p_period text, p_path text default '/top')
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((
    select payload
    from top_ranking.page_snapshots
    where period = p_period and path = p_path
  ), '[]'::jsonb);
$$;

revoke all on function public.get_public_top_snapshot(text, text) from public;
grant execute on function public.get_public_top_snapshot(text, text) to anon, authenticated, service_role;

-- Initialize from the rankings already calculated by the existing hourly job.
select top_ranking.refresh_page_snapshots();

do $$
declare
  ranking_job_id bigint;
begin
  select jobid into strict ranking_job_id
  from cron.job
  where jobname = 'refresh-top-lists-hourly' and active;

  perform cron.alter_job(
    ranking_job_id,
    command := 'select top_ranking.refresh_rankings_and_snapshots();'
  );
end;
$$;

notify pgrst, 'reload schema';
