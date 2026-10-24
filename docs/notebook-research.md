# Notebook depth: source record

Researched 2026-10-23. Existing stack: Next.js 16.2.10, React 19.2.4,
Supabase JS 2.x, PostgreSQL, native IndexedDB and the existing service worker.
No new production service or runtime dependency. The GitHub connector was not
available; public upstream documentation, repositories and maintainer discussions
were accessed through web research instead.

| Choice | Evidence and compatibility | License / cost | Local validation |
| --- | --- | --- | --- |
| PostgreSQL full-text search plus literal matching; retain optional meaning matches | [Supabase full-text examples](https://supabase.com/docs/guides/database/full-text-search), [hybrid search guide](https://supabase.com/docs/guides/ai/hybrid-search). Uses built-in `simple` text configuration, generated tsvector, GIN index, and the existing user-scoped database. The new ranking is literal + FTS with an optional semantic rank contribution; it is not advertised as full reciprocal-rank fusion. | Existing PostgreSQL, PostgreSQL License. No additional paid service or extension. Existing hosted Supabase plan limits still apply. | Actual SQL tested in PGlite with original table definitions/RLS. Filters run before pagination. Benchmark includes 5,000 synthetic entries. |
| Integer revisions, database row locks and operation receipts | [Supabase functions/security guidance](https://supabase.com/docs/guides/database/functions), [upstream concurrent-editing discussion](https://github.com/supabase/supabase-js/issues/1645), [PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html). Definer write functions have an empty search path, explicit account/ownership validation and authenticated-only execution; reads use invoker security and RLS. Standard transactions are used rather than introducing a synchronization service. | Existing PostgreSQL. No new charge or subscription. | Lost acknowledgments, stale edit refusal, version preservation, invalid compound edits, deleted-entry replay, anonymous access and cross-account denial are covered. PGlite is single-connection; this is not a multi-connection load/concurrency benchmark. |
| Native IndexedDB transaction completion and Web Locks | [IndexedDB transaction complete event](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction/complete_event), [Web Locks](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API). Reuse the app's existing IndexedDB wrapper. A write succeeds only on transaction commit. Operation replacement is atomic. Web Locks coordinate tabs where available; database receipts remain authoritative. | Built-in browser APIs. No library fee. Browser storage quotas and eviction still apply. | Aborted transactions, Blob round trips and interrupted operation replacement are tested. Physical iOS storage eviction and OS termination are not simulated. |
| PGlite **0.5.8**, development only | [Getting started and Node examples](https://pglite.dev/docs/), [maintained releases](https://github.com/electric-sql/pglite/releases), [upstream tests](https://github.com/electric-sql/pglite/tree/main/packages/pglite/tests), [license](https://github.com/electric-sql/pglite/blob/main/LICENSE). Run locally under Node 24.16.0. No Docker or remote test database required. | Apache-2.0; pinned exact version in package/lockfile, upstream notices retained. Local free software, no account or metered service. | Executes the shipped migration against real PostgreSQL in WebAssembly. Test fixture supplies Supabase auth roles and JWT subject; optional vector/storage services are excluded explicitly. |
| fake-indexeddb **6.2.5**, development only | [Versioned README and examples](https://github.com/dumbmatter/fakeIndexedDB/blob/v6.2.5/README.md), [maintainer releases and transaction timing fixes](https://github.com/dumbmatter/fakeIndexedDB/releases), [license](https://github.com/dumbmatter/fakeIndexedDB/blob/v6.2.5/LICENSE). Upstream exercises Web Platform Tests. | Apache-2.0; pinned exact version; no hosted service or billing. | Tests the actual IndexedDB wrapper, including abort after a successful individual request. This emulator supplements, not replaces, device testing. |

Read local Next.js guides before editing: `01-app/01-getting-started/15-route-handlers.md`
and `05-server-and-client-components.md` in `node_modules/next/dist/docs/`.

Memory connections use existing tags, people, quoted posts and stored topic metadata.
Users can explicitly link or hide pairs. No model is asked to infer a life story.
The existing optional analysis/embedding integration remains paid when configured;
none of the new core flows require it. Meaning search is opt-in. The public demo
uses entirely fictional, in-memory data and has no backend or AI dependency.

Measured results are in `search-benchmark.json`; validation boundaries and the
deployment order are in `notebook-validation.md`. No hosted-production performance,
Safari reliability, or semantic-search quality claim is inferred from local tests.
