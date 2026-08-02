-- People mentioned in the user's posts, kept as a running, AI-maintained
-- record — the start of a graph: people as nodes, posts as the edges that
-- connect them (via post_people) and feed what's known about each one.
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  name text not null,
  relationship text,
  notes text,
  mention_count integer default 1,
  first_mentioned_at timestamptz default now(),
  last_mentioned_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, name)
);

create table if not exists public.post_people (
  post_id uuid references public.posts(id) on delete cascade not null,
  person_id uuid references public.people(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  created_at timestamptz default now(),
  primary key (post_id, person_id)
);

alter table public.people enable row level security;
alter table public.post_people enable row level security;

create policy "people select own" on public.people
  for select using (auth.uid() = user_id);
create policy "people insert own" on public.people
  for insert with check (auth.uid() = user_id);
create policy "people update own" on public.people
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "people delete own" on public.people
  for delete using (auth.uid() = user_id);

create policy "post_people select own" on public.post_people
  for select using (auth.uid() = user_id);
create policy "post_people insert own" on public.post_people
  for insert with check (auth.uid() = user_id);
create policy "post_people delete own" on public.post_people
  for delete using (auth.uid() = user_id);
