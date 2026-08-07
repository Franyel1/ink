-- Quoting an older post: a new post that carries an earlier one inside it.
--
-- `on delete set null` rather than cascade. Deleting the post you quoted must
-- not delete what you wrote about it: the quote is your writing, the thing it
-- points at is a reference. The quoting post survives and renders as a quote
-- whose subject is gone.
-- Run this in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).

alter table public.posts
  add column if not exists quoted_post_id uuid
    references public.posts(id) on delete set null;

-- Answers "what quotes this post", and keeps the delete-time null-out from
-- scanning the whole table.
create index if not exists posts_quoted_post_idx
  on public.posts (quoted_post_id)
  where quoted_post_id is not null;
