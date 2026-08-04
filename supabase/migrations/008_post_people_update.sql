-- post_people shipped with select/insert/delete policies but no update policy,
-- so `mergePeople` repointing a post's link from the folded-away person to the
-- kept one matched zero rows under RLS and failed silently: the merge looked
-- like it worked, and the posts quietly stopped belonging to anyone.
-- Run this in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).

create policy "post_people update own" on public.post_people
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
