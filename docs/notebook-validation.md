# Installation and verification

## Apply the database change first

For an existing Ink database that already has migrations through 012, run the
entire `supabase/migrations/013_notebook_depth.sql` in its Supabase SQL Editor.
It is a single transaction. It adds columns, indexes, three tables and four RPCs;
it does not delete existing entries. Apply it before deploying this app version.
For a new database, run `supabase/schema.sql` and then migration 013.
Run 013 once, not on every startup. If an error occurs, the transaction rolls
back; resolve the error before retrying. Do not bypass errors by applying pieces.

The migration is supplied for the user to apply; it was not run on the hosted
database during implementation. No database-admin credentials were available.

## Local checks (2026-10-23)

- `npm test`: 18 passing tests using Node's built-in test runner, PGlite 0.5.8
  and fake-indexeddb 6.2.5. No API keys or network required.
- `npm run typecheck`: TypeScript.
- `npm run lint`: project ESLint rules.
- `npm run build`: production Next.js build, including `/demo` and `/sync`.
- `npm run benchmark`: records reproducible local keyword-search measurements
  in `docs/search-benchmark.json` (5,000 entries, 8 expected-entry queries,
  10 timed repetitions per query). Actual recorded initial run: 8/8 expected
  entries in top five, median 4.59 ms, p95 5.30 ms. SQL-only, synthetic,
  single-user, warmed-up results; not production or end-to-end latency.
- Browser walkthrough at desktop and 390×844: demo keyword search, older entry
  selection, chronological memory links, offline simulation, reconnect and
  version restoration. No real journal entries used.

Database tests execute the actual migration and existing table/RLS definitions.
The fixture supplies `auth.uid()` and roles; the vector column is inert text
because embedding queries are not under test. PGlite has one connection:
out-of-order edits and replay semantics are tested, but physical two-connection
locking contention, Supabase Storage uploads and real hosted auth are not.

## Two-minute walkthrough

1. Open `/demo` without signing in. Search **application**. Open the February
   entry and follow the career thread through September.
2. Connect a suggestion, hide one, and restore hidden connections. Entries
   always show their original words and why they were suggested.
3. Choose **Try offline & recovery**. Go offline, edit the fictional entry,
   keep it locally, then reconnect. Restore its earlier words.
4. The demo is intentionally a tab-local simulation and resets on reload.
   It must not be presented as proof of real network/offline integration.

## Signed-in checks after applying 013

1. Use two disposable test accounts. Create more than 20 entries for account A.
   Search for an older one before scrolling the feed; verify tag, person and
   date filters and load-more results. Verify B cannot retrieve or connect A's
   entry IDs or read its history.
2. Open an entry, use **Thread & history**, add/hide/restore connections,
   edit it twice and restore an earlier version. Restoration recovers words,
   type and tags; current attached photos remain.
3. Test a production build (`npm run build`, then `npm start`) because the
   existing service worker intentionally does not register in development.
   Load the feed online, disconnect, write and edit cached entries, reload,
   and reconnect. Check `/sync` and confirm each operation appears once.
4. Edit the same revision on two devices; sync one, then the other. On the
   second, compare the saved and local versions. Test **Save my version** and
   **Keep as a separate entry**. The replaced saved version stays in history.
5. Interrupt the response after a server commit, then retry. Check one entry,
   one attachment per file, one accepted operation, and no duplicated history.
6. Switch accounts while a write is pending. The expected account is passed
   to the database, which must reject a different authenticated account.

## Boundaries

- Offline search covers cached entries, clearly labeled in the UI. Online
  search covers the entire notebook. Ordinary text search needs no AI key.
- Saving commits the draft to IndexedDB before trying the server. Unsubmitted
  text in an open composer is not autosaved. Storage can be cleared/evicted by
  the browser or user; pending drafts can be exported from Sync.
- Unknown-owner drafts from pre-upgrade versions are quarantined from sync.
  Their text and image data can be exported; originals remain on-device.
- Uploaded objects can be left unreferenced if a client uploads and never
  finishes the database transaction. Stable paths prevent duplicate uploads
  on retry; automatic orphan cleanup is not introduced here.
- Keep prior deployments from writing concurrently during rollout: old app
  clients do not use the new revision-aware RPC. Reload installed PWAs after
  migration/deployment. Content edits through the new app are versioned;
  direct database/admin updates are not a supported editing path.
- No paid hosting or services were introduced. Existing Supabase hosting,
  image storage, Google font fetching and optional OpenAI configuration remain
  as before. The demo and new core feature logic need no paid AI calls.

## Honest résumé material

After applying the migration and completing signed-in checks:

- Built a personal journaling PWA with searchable memory timelines linking
  entries across people, topics and time using Next.js, TypeScript and PostgreSQL.
- Implemented durable offline writes, idempotent synchronization, optimistic
  concurrency checks and recoverable version history; validated failure and
  account-isolation scenarios with automated PostgreSQL and IndexedDB tests.
- Evaluated keyword retrieval over 5,000 synthetic entries, retrieving the
  expected entry in the top five for 8/8 curated queries. Report local SQL
  timings as local measurements only, never as real-user production latency.
