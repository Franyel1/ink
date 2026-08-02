-- A running, AI-maintained set of notes about the user, built up from their
-- reflection answers over time. Rewritten (not appended) each time new
-- reflect questions are generated, so it stays a coherent, deduplicated
-- picture rather than a growing log.
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).

alter table public.profiles
  add column if not exists notebook_memory text;
