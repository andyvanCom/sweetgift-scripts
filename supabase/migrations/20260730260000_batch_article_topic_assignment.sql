-- Assign missing article topics in small RPC-sized batches. Matching every
-- missing article against the full semantic core in one statement can exceed
-- the hosted statement timeout as both collections grow.
create or replace function public.assign_missing_article_seo_topics_batch(
  p_limit integer default 15
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_keys text[];
  v_matched integer := 0;
  v_fallback integer := 0;
  v_remaining integer := 0;
begin
  select array_agg(target.article_key order by target.article_key)
  into v_keys
  from (
    select a.article_key
    from public.articles_index a
    where a.is_active = true
      and nullif(trim(a.seo_topic_title), '') is null
    order by a.article_key
    limit greatest(1, least(coalesce(p_limit, 15), 100))
  ) target;

  if coalesce(cardinality(v_keys), 0) = 0 then
    return jsonb_build_object(
      'ok', true,
      'processed', 0,
      'matched_to_semantic_core', 0,
      'title_fallback', 0,
      'remaining_without_topic', 0
    );
  end if;

  with candidates as (
    select
      a.article_key,
      q.topic_title,
      row_number() over (
        partition by a.article_key
        order by length(q.query_text) desc, q.id
      ) as position
    from public.articles_index a
    join public.seo_topic_queries q
      on lower(concat_ws(' ', a.title, a.description, a.article_key))
         like '%' || lower(trim(q.query_text)) || '%'
    where a.article_key = any(v_keys)
      and a.is_active = true
      and nullif(trim(a.seo_topic_title), '') is null
      and length(trim(q.query_text)) >= 5
      and nullif(trim(q.topic_title), '') is not null
  ), updated as (
    update public.articles_index a
    set
      seo_topic_title = c.topic_title,
      updated_at = now()
    from candidates c
    where c.position = 1
      and a.article_key = c.article_key
    returning a.article_key
  )
  select count(*) into v_matched from updated;

  with updated as (
    update public.articles_index a
    set
      seo_topic_title = left(
        trim(
          regexp_replace(
            lower(coalesce(a.title, a.article_key)),
            '[^[:alnum:]а-яё -]+',
            ' ',
            'gi'
          )
        ),
        160
      ),
      updated_at = now()
    where a.article_key = any(v_keys)
      and a.is_active = true
      and nullif(trim(a.seo_topic_title), '') is null
    returning a.article_key
  )
  select count(*) into v_fallback from updated;

  select count(*)
  into v_remaining
  from public.articles_index
  where is_active = true
    and nullif(trim(seo_topic_title), '') is null;

  return jsonb_build_object(
    'ok', true,
    'processed', cardinality(v_keys),
    'matched_to_semantic_core', v_matched,
    'title_fallback', v_fallback,
    'remaining_without_topic', v_remaining
  );
end;
$$;

revoke all on function public.assign_missing_article_seo_topics_batch(integer)
  from public, anon, authenticated;
grant execute
  on function public.assign_missing_article_seo_topics_batch(integer)
  to service_role;
