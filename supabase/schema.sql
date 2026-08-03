-- Ink. — Supabase schema
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).

-- ========== Tables ==========

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  profile_picture_url text,
  profile_color text,
  beliefs jsonb,
  personality text,
  handling_good text,
  handling_bad text,
  improvement_goal text,
  notebook_memory text,
  onboarded boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  content text not null,
  post_type text default 'thought',
  is_pinned boolean default false,
  is_favorited boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  ai_processed boolean default false,
  ai_summary text,
  ai_comment text,
  ai_sentiment text,
  ai_topics jsonb,
  ai_embedding_status text default 'not_processed'
);

create table if not exists public.post_images (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts(id) on delete cascade,
  image_url text not null,
  created_at timestamptz default now()
);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  name text not null,
  created_at timestamptz default now(),
  unique (user_id, name)
);

create table if not exists public.post_tags (
  post_id uuid references public.posts(id) on delete cascade,
  tag_id uuid references public.tags(id) on delete cascade,
  primary key (post_id, tag_id)
);

create table if not exists public.profile_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  field_changed text,
  old_value text,
  new_value text,
  reason text,
  is_mistake boolean default false,
  created_at timestamptz default now()
);

-- AI-generated reflection questions
create table if not exists public.reflect_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  question_key text not null,
  question text not null,
  source text default 'ai',
  created_at timestamptz default now(),
  unique (user_id, question_key)
);

-- Reflect tab answers
create table if not exists public.reflections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  question_key text not null,
  question text not null,
  answer text not null,
  created_at timestamptz default now(),
  unique (user_id, question_key)
);

-- People mentioned in the user's posts, kept as a running, AI-maintained
-- record — the start of a graph: people as nodes, posts as the edges that
-- connect them (via post_people) and feed what's known about each one.
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

-- Monthly, AI-written recaps built from a completed calendar month's posts
-- and reflections. One per user per month.
create table if not exists public.recaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  period_start date not null,
  period_end date not null,
  content text not null,
  created_at timestamptz default now(),
  unique (user_id, period_start)
);

-- Powers the Reflect dashboard: Present (daily line, ask-on-demand),
-- Goals / Wants / Let Go, and Future (sealed letters).
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

create index if not exists posts_user_created_idx
  on public.posts (user_id, created_at desc);

-- ========== Row Level Security ==========

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.post_images enable row level security;
alter table public.tags enable row level security;
alter table public.post_tags enable row level security;
alter table public.profile_changes enable row level security;
alter table public.reflections enable row level security;
alter table public.reflect_questions enable row level security;
alter table public.people enable row level security;
alter table public.post_people enable row level security;
alter table public.recaps enable row level security;
alter table public.goals enable row level security;
alter table public.wants enable row level security;
alter table public.let_gos enable row level security;
alter table public.letters enable row level security;
alter table public.daily_lines enable row level security;

-- reflect_questions
create policy "reflect_questions select own" on public.reflect_questions
  for select using (auth.uid() = user_id);
create policy "reflect_questions insert own" on public.reflect_questions
  for insert with check (auth.uid() = user_id);
create policy "reflect_questions delete own" on public.reflect_questions
  for delete using (auth.uid() = user_id);

-- profiles: a user manages only their own row
create policy "profiles select own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles insert own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles update own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- posts
create policy "posts select own" on public.posts
  for select using (auth.uid() = user_id);
create policy "posts insert own" on public.posts
  for insert with check (auth.uid() = user_id);
create policy "posts update own" on public.posts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "posts delete own" on public.posts
  for delete using (auth.uid() = user_id);

-- post_images: scoped through the owning post
create policy "post_images select own" on public.post_images
  for select using (
    exists (select 1 from public.posts p where p.id = post_id and p.user_id = auth.uid())
  );
create policy "post_images insert own" on public.post_images
  for insert with check (
    exists (select 1 from public.posts p where p.id = post_id and p.user_id = auth.uid())
  );
create policy "post_images delete own" on public.post_images
  for delete using (
    exists (select 1 from public.posts p where p.id = post_id and p.user_id = auth.uid())
  );

-- tags
create policy "tags select own" on public.tags
  for select using (auth.uid() = user_id);
create policy "tags insert own" on public.tags
  for insert with check (auth.uid() = user_id);
create policy "tags update own" on public.tags
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "tags delete own" on public.tags
  for delete using (auth.uid() = user_id);

-- post_tags: scoped through the owning post
create policy "post_tags select own" on public.post_tags
  for select using (
    exists (select 1 from public.posts p where p.id = post_id and p.user_id = auth.uid())
  );
create policy "post_tags insert own" on public.post_tags
  for insert with check (
    exists (select 1 from public.posts p where p.id = post_id and p.user_id = auth.uid())
  );
create policy "post_tags delete own" on public.post_tags
  for delete using (
    exists (select 1 from public.posts p where p.id = post_id and p.user_id = auth.uid())
  );

-- profile_changes
create policy "profile_changes select own" on public.profile_changes
  for select using (auth.uid() = user_id);
create policy "profile_changes insert own" on public.profile_changes
  for insert with check (auth.uid() = user_id);

-- reflections
create policy "reflections select own" on public.reflections
  for select using (auth.uid() = user_id);
create policy "reflections insert own" on public.reflections
  for insert with check (auth.uid() = user_id);
create policy "reflections update own" on public.reflections
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "reflections delete own" on public.reflections
  for delete using (auth.uid() = user_id);

-- people
create policy "people select own" on public.people
  for select using (auth.uid() = user_id);
create policy "people insert own" on public.people
  for insert with check (auth.uid() = user_id);
create policy "people update own" on public.people
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "people delete own" on public.people
  for delete using (auth.uid() = user_id);

-- post_people
create policy "post_people select own" on public.post_people
  for select using (auth.uid() = user_id);
create policy "post_people insert own" on public.post_people
  for insert with check (auth.uid() = user_id);
create policy "post_people delete own" on public.post_people
  for delete using (auth.uid() = user_id);

-- recaps
create policy "recaps select own" on public.recaps
  for select using (auth.uid() = user_id);
create policy "recaps insert own" on public.recaps
  for insert with check (auth.uid() = user_id);

-- goals
create policy "goals select own" on public.goals
  for select using (auth.uid() = user_id);
create policy "goals insert own" on public.goals
  for insert with check (auth.uid() = user_id);
create policy "goals update own" on public.goals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "goals delete own" on public.goals
  for delete using (auth.uid() = user_id);

-- wants
create policy "wants select own" on public.wants
  for select using (auth.uid() = user_id);
create policy "wants insert own" on public.wants
  for insert with check (auth.uid() = user_id);
create policy "wants update own" on public.wants
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "wants delete own" on public.wants
  for delete using (auth.uid() = user_id);

-- let_gos
create policy "let_gos select own" on public.let_gos
  for select using (auth.uid() = user_id);
create policy "let_gos insert own" on public.let_gos
  for insert with check (auth.uid() = user_id);
create policy "let_gos update own" on public.let_gos
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "let_gos delete own" on public.let_gos
  for delete using (auth.uid() = user_id);

-- letters
create policy "letters select own" on public.letters
  for select using (auth.uid() = user_id);
create policy "letters insert own" on public.letters
  for insert with check (auth.uid() = user_id);
create policy "letters update own" on public.letters
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- daily_lines
create policy "daily_lines select own" on public.daily_lines
  for select using (auth.uid() = user_id);
create policy "daily_lines insert own" on public.daily_lines
  for insert with check (auth.uid() = user_id);

-- ========== Auto-create profile on signup ==========

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ========== Storage: post images ==========

insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do nothing;

-- Files are stored under a folder named by user id: {user_id}/{filename}
create policy "post images read own" on storage.objects
  for select using (
    bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "post images insert own" on storage.objects
  for insert with check (
    bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "post images delete own" on storage.objects
  for delete using (
    bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text
  );
