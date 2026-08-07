-- `is_favorited` shipped with the original posts table and was never read or
-- written by anything: no UI, no query, no filter. Pinning covers the one
-- "keep this near the top" need the app actually has. Dropping it rather than
-- leaving it around, since dead columns are how the people table quietly
-- drifted out of sync with what the app believed about it.
-- Run this in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).

alter table public.posts drop column if exists is_favorited;
