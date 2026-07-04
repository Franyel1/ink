# Ink.

A private, mobile-first PWA — a you-only feed where you write your life in ink. Built with Next.js, TypeScript, Tailwind CSS, and Supabase.

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql), and run it. This creates all tables, Row Level Security policies, the profile-creation trigger, and the `post-images` storage bucket.
3. (Optional) In **Authentication → Providers → Email**, disable "Confirm email" if you want to sign in immediately after creating your account.

### 2. Environment

```bash
cp .env.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from **Project Settings → API**.

### 3. Run

```bash
npm install
npm run dev
```

Open http://localhost:3000 — ideally in a mobile-sized viewport (this app is designed iPhone-first).

## Install as an app (iPhone)

Open the deployed site in Safari → Share → **Add to Home Screen**. Ink runs full-screen in standalone mode with no browser chrome.

## Structure

- `src/app/login` — sign in / sign up
- `src/app/onboarding` — first-run questionnaire (stored on `profiles` for future AI use)
- `src/app/(tabs)/feed` — timeline, composer bottom sheet, search overlay
- `src/app/(tabs)/reflect` — immersive one-question-at-a-time reflection flow
- `src/app/(tabs)/profile` — profile, editable answers (with change tracking), saved posts
- `src/proxy.ts` — Supabase session refresh + auth routing
- `supabase/schema.sql` — full database schema + RLS
