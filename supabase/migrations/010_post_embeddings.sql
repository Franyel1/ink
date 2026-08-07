-- Semantic recall over the notebook.
--
-- `ai_embedding_status` has been written on every analyzed post since the
-- beginning and never read by anything: there was no vector to go with it.
-- This adds the vector, and the search function that makes it worth storing.
--
-- Why it matters beyond search: every AI route currently feeds the model the
-- most recent 30 posts, so the notebook structurally cannot remember anything
-- older than that. Matching on meaning lets it pull back the posts that are
-- actually relevant to what's being written now, however long ago they were.
-- Run this in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).

create extension if not exists vector;

-- 1536 dims to match text-embedding-3-small.
alter table public.posts
  add column if not exists ai_embedding vector(1536);

-- HNSW over cosine distance: the query embeds the user's phrasing, which
-- never matches a stored post's magnitude, only its direction.
create index if not exists posts_ai_embedding_idx
  on public.posts using hnsw (ai_embedding vector_cosine_ops);

-- Lets the backfill find what still needs doing without a full scan.
create index if not exists posts_embedding_status_idx
  on public.posts (user_id, ai_embedding_status)
  where ai_embedding_status <> 'processed';

-- SECURITY INVOKER (the default) is deliberate: the function runs as the
-- caller, so the posts RLS policy applies inside it and a user can only ever
-- match against their own writing. Do not add SECURITY DEFINER here without
-- also filtering on auth.uid().
create or replace function public.match_posts(
  query_embedding vector(1536),
  match_count int default 20,
  min_similarity float default 0.15
)
returns table (
  id uuid,
  similarity float
)
language sql
stable
as $$
  select
    p.id,
    1 - (p.ai_embedding <=> query_embedding) as similarity
  from public.posts p
  where p.ai_embedding is not null
    and 1 - (p.ai_embedding <=> query_embedding) >= min_similarity
  order by p.ai_embedding <=> query_embedding
  limit match_count;
$$;
