-- Powers the Reflect dashboard: Present (daily line, ask-on-demand),
-- Goals / Wants / Let Go, and Future (sealed letters).
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  raw_text text not null,
  refined_text text,
  done boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.wants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  text text not null,
  done boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.let_gos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  text text not null,
  released boolean default false,
  created_at timestamptz default now()
);

-- Sealed letters to a future self. `content` and `chosen_prompts` are only
-- readable by the app once `target_open_date` has passed.
create table if not exists public.letters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  content text not null,
  chosen_prompts jsonb,
  target_open_date date not null,
  opened_at timestamptz,
  created_at timestamptz default now()
);

-- One AI-written line per day, cached so it's only generated once.
create table if not exists public.daily_lines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  day date not null,
  line text not null,
  created_at timestamptz default now(),
  unique (user_id, day)
);

alter table public.goals enable row level security;
alter table public.wants enable row level security;
alter table public.let_gos enable row level security;
alter table public.letters enable row level security;
alter table public.daily_lines enable row level security;

create policy "goals select own" on public.goals
  for select using (auth.uid() = user_id);
create policy "goals insert own" on public.goals
  for insert with check (auth.uid() = user_id);
create policy "goals update own" on public.goals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "goals delete own" on public.goals
  for delete using (auth.uid() = user_id);

create policy "wants select own" on public.wants
  for select using (auth.uid() = user_id);
create policy "wants insert own" on public.wants
  for insert with check (auth.uid() = user_id);
create policy "wants update own" on public.wants
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "wants delete own" on public.wants
  for delete using (auth.uid() = user_id);

create policy "let_gos select own" on public.let_gos
  for select using (auth.uid() = user_id);
create policy "let_gos insert own" on public.let_gos
  for insert with check (auth.uid() = user_id);
create policy "let_gos update own" on public.let_gos
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "let_gos delete own" on public.let_gos
  for delete using (auth.uid() = user_id);

create policy "letters select own" on public.letters
  for select using (auth.uid() = user_id);
create policy "letters insert own" on public.letters
  for insert with check (auth.uid() = user_id);
create policy "letters update own" on public.letters
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "daily_lines select own" on public.daily_lines
  for select using (auth.uid() = user_id);
create policy "daily_lines insert own" on public.daily_lines
  for insert with check (auth.uid() = user_id);
