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

## AI layer (optional)

Ink can read your posts and write reflection questions that feel like the notebook noticed you:

1. Run [`supabase/migrations/002_reflect_questions.sql`](supabase/migrations/002_reflect_questions.sql) and [`supabase/migrations/003_notebook_memory.sql`](supabase/migrations/003_notebook_memory.sql) in the Supabase SQL editor (fresh installs get both from `schema.sql` automatically).
2. Add `OPENAI_API_KEY` to `.env.local` (see `.env.example`) and restart the dev server.

Every new post is quietly analyzed (summary, sentiment, topics → the `ai_*` columns on `posts`) using GPT-4.1 mini. When you run low on reflection questions, the same model writes new ones from your recent posts, profile, and past answers — and rewrites a running `notebook_memory` note about you (`profiles.notebook_memory`) each time, so later questions can dig into whatever's still vague instead of just avoiding repeats. Without the key, everything degrades gracefully — the app works exactly as before.

## Offline

Ink is written on phones, which means it gets opened on trains and in basements. A service worker ([`public/sw.js`](public/sw.js)) caches the app shell and its build assets, so the app opens with no network; the last feed you loaded is kept in IndexedDB and shown in place of a spinner, marked as offline.

Anything you write with no signal is queued on the device — text and images both — and appears in the feed as a dashed "waiting for signal" card until it sends itself, which happens as soon as the connection is back. Editing an existing post still needs a network: replaying an edit later would overwrite whatever the post had become in the meantime.

Supabase requests are never cached by the worker (they're per-user and carry tokens); only public storage images are, capped at 120. Signing out clears the cached feed, any queued drafts, and the image cache.

The worker registers in production only — a cache-first worker in dev would serve stale chunks. To exercise it locally:

```bash
npm run build && npm start
```

## Install as an app (iPhone)

Open the deployed site in Safari → Share → **Add to Home Screen**. Ink runs full-screen in standalone mode with no browser chrome.

## Structure

- `src/app/login` — sign in / sign up
- `src/app/onboarding` — first-run questionnaire (stored on `profiles` for future AI use)
- `src/app/(tabs)/feed` — timeline, composer bottom sheet, search overlay
- `src/app/(tabs)/reflect` — immersive one-question-at-a-time reflection flow
- `src/app/(tabs)/profile` — profile, editable answers (with change tracking), saved posts
- `src/lib/offline.ts` — offline draft queue + cached feed (on `src/lib/idb.ts`)
- `public/sw.js` — service worker: app shell, static assets, offline fallback
- `src/proxy.ts` — Supabase session refresh + auth routing
- `supabase/schema.sql` — full database schema + RLS
