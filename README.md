# Ink.

A private, mobile-first PWA — a you-only feed where you write your life in ink. Built with Next.js, TypeScript, Tailwind CSS, and Supabase.

## Explore Ink

Open `/demo` for a fictional notebook spanning nine months. Follow memory
threads, search old entries, and try an offline/recovery simulation without
an account or API key. [Two-minute walkthrough and validation](docs/notebook-validation.md).

Signed-in notebooks now include:

- Whole-notebook keyword search with type, tag, person and date filters,
  independent of feed pagination. Meaning matches remain optional.
- Chronological memory threads with original-entry links and explanations;
  manually connect entries, hide suggestions and bring them back.
- Offline creation and editing, retry-safe writes, a visible Sync queue,
  conflict comparison, draft export and recoverable text/tag version history.

**Existing installations:** apply [migration 013](supabase/migrations/013_notebook_depth.sql)
before deploying this version, then reload installed PWAs. The migration has
been tested locally; applying it to your hosted database is a separate step.

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql), and run it. This creates all tables, Row Level Security policies, the profile-creation trigger, and the `post-images` storage bucket.
   Then run [`013_notebook_depth.sql`](supabase/migrations/013_notebook_depth.sql)
   for the new search, memory-thread and synchronization tables/functions.
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

Because that note is a model-written description of you, onboarding says so before it asks anything, and Profile → About shows the current text with a "Forget it" that nulls the column. It refills from your posts the next time questions are generated.

## Offline

Ink is written on phones, which means it gets opened on trains and in basements. A service worker ([`public/sw.js`](public/sw.js)) caches the app shell and its build assets, so the app opens with no network; the last feed you loaded is kept in IndexedDB and shown in place of a spinner, marked as offline.

Submitted posts and edits are committed to an account-scoped IndexedDB queue
before trying the network, including text and new image files. **Sync** shows
pending writes and failures. Stable operation IDs prevent duplicate posts after
a lost response. Version checks stop an offline edit from silently overwriting
a newer one; compare both versions, merge the text, or save a separate entry.
Replaced words, entry types and tags remain in version history. Unsubmitted
composer text is not autosaved. Offline search covers only cached entries and
is labeled accordingly.

Supabase requests are never cached by the worker (they're per-user and carry tokens); only public storage images are, capped at 120. Signing out clears the cached feed, any queued drafts, and the image cache.

Drafts can be exported with attachments from Sync. Signing out asks before
deleting pending writing. Old drafts without account labels are quarantined
from automatic sync and can be exported for manual recovery.

## Checks and evidence

Use Node 24+ for the built-in TypeScript test execution.

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run benchmark
```

The test suite runs locally without credentials or a remote database.
[Source and dependency record](docs/notebook-research.md),
[measured search results](docs/search-benchmark.json), and
[verification boundaries](docs/notebook-validation.md) distinguish local tests
from hosted behavior. The two new dependencies are pinned, Apache-2.0-licensed
development tools; no production service was added.

The worker registers in production only — a cache-first worker in dev would serve stale chunks. To exercise it locally:

```bash
npm run build && npm start
```

## Install as an app (iPhone)

Open the deployed site in Safari → Share → **Add to Home Screen**. Ink runs full-screen in standalone mode with no browser chrome.

## Structure

- `src/app/login` — sign in / sign up
- `src/app/onboarding` — first run: what the notebook does, then eight questions that seed `profiles`, a first goal, a first want, and a letter a year out
- `src/app/(tabs)/feed` — timeline, composer bottom sheet, search overlay
- `src/app/(tabs)/reflect` — immersive one-question-at-a-time reflection flow
- `src/app/(tabs)/profile` — profile, editable answers (with change tracking), saved posts
- `src/lib/offline.ts` — offline draft queue + cached feed (on `src/lib/idb.ts`)
- `public/sw.js` — service worker: app shell, static assets, offline fallback
- `src/proxy.ts` — Supabase session refresh + auth routing
- `supabase/schema.sql` — full database schema + RLS
