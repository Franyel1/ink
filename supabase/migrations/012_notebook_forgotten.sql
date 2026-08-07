-- Things the notebook was told to forget.
--
-- Deleting a line out of notebook_memory on its own doesn't hold: reflect
-- generation rewrites that memory from scratch every run, so anything removed
-- comes straight back the next time questions are written, and the delete
-- button turns out to have been decoration.
--
-- Keeping the removed lines lets the rewrite prompt be told what not to
-- reintroduce. It's a small betrayal of privacy to store what someone asked
-- you to forget, so this holds only the sentences themselves, and clearing the
-- memory entirely clears this too.
-- Run this in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).

alter table public.profiles
  add column if not exists notebook_forgotten jsonb not null default '[]'::jsonb;
