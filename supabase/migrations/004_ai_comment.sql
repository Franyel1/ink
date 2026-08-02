-- The AI's actual reaction to a post, distinct from ai_summary (which stays
-- a short, factual "noticed" line used as a side note under the comment).
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).

alter table public.posts
  add column if not exists ai_comment text;
