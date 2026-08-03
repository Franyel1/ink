-- Monthly, AI-written recaps built from a completed calendar month's posts
-- and reflections. One per user per month.
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).

create table if not exists public.recaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  period_start date not null,
  period_end date not null,
  content text not null,
  created_at timestamptz default now(),
  unique (user_id, period_start)
);

alter table public.recaps enable row level security;

create policy "recaps select own" on public.recaps
  for select using (auth.uid() = user_id);
create policy "recaps insert own" on public.recaps
  for insert with check (auth.uid() = user_id);
