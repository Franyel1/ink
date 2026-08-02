-- AI-generated reflection questions.
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).

create table if not exists public.reflect_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  question_key text not null,
  question text not null,
  source text default 'ai',
  created_at timestamptz default now(),
  unique (user_id, question_key)
);

alter table public.reflect_questions enable row level security;

create policy "reflect_questions select own" on public.reflect_questions
  for select using (auth.uid() = user_id);
create policy "reflect_questions insert own" on public.reflect_questions
  for insert with check (auth.uid() = user_id);
create policy "reflect_questions delete own" on public.reflect_questions
  for delete using (auth.uid() = user_id);
