# Model data API

The browser loads every model and metric from a public JSON route after the page hydrates, and revalidates it with an ETag on later visits. A second public route reports how each source's rows matched up. The UI never links it, but anyone who knows the URL can open it.

## Sub-features

- `api-snapshot` returns the whole snapshot: `entries`, `variants` per source, `logos`, and `fetchedAt` per source.
- `api-etag` answers `304` with no body when the browser's `If-None-Match` matches.
- `api-cache-headers` tells browsers to revalidate on every visit and lets the CDN serve a copy for a minute.
- `api-diagnostics` returns the matching report (`counts`, `failures`, `fetchedAt`, `metadata`, `models`, `sources`, `unresolvedDateGroups`).

## How to get to it (user POV)

- Load `/`: once hydrated, the browser fetches `GET /api/models/snapshot` in the background.
- Load `/` again: the browser sends `If-None-Match` and gets `304` until a source refreshes.
- Open `GET /api/models/diagnostics` directly.

## Driving it with llmg

Preconditions:

- Doctor passes.

- **Snapshot.** Run `llmg api /api/models/snapshot --name api-snapshot`. It prints `200`. `jq '.entries | length' <evidence>/api-snapshot.body` is above 0. `jq -c '.variants | keys'` lists the sources, and every non-null `.fetchedAt` value is newer than the run's start.
- **Cache headers.** In `<evidence>/api-snapshot.headers.txt`, `cache-control` is `public, max-age=0, must-revalidate`, `cdn-cache-control` is `max-age=60, stale-while-revalidate=600`, and an `etag` is present.
- **Revalidate.** Send the ETag back. Run `llmg api /api/models/snapshot --name api-304 --header 'If-None-Match: <etag with quotes>'`. It prints `304` and `api-304.body` is empty. A weak `W/"<etag>"` also gets `304`.
- **Changed tag.** Run `llmg api /api/models/snapshot --name api-200 --header 'If-None-Match: "stale"'`. It prints `200` with the full body.
- **Diagnostics.** Run `llmg api /api/models/diagnostics --name api-diagnostics`. It prints `200`, and `jq -c 'keys'` on the body lists the seven keys above.
- **Background fetch from the page (browser).** Load `/` and watch the network panel. One `GET /api/models/snapshot` goes out after hydration and none during server rendering. On reload it returns `304`.
- **Proof.** Keep the `api-snapshot` headers, the `api-304` status, and the `api-diagnostics` keys.

## Gotchas

- The ETag is tied to the build id and the sources' fetch times. Restarting the server or refreshing a source changes it, so read it fresh in the same run.
- The first snapshot request after `up` fetches every upstream source live. `up` has already made that request, so later calls are cached in memory.
- A source that failed upstream has `fetchedAt` set to null and no rows in `variants`. That is the source's failure, not this route's (Arena 403 today; see `llmg log`).
- Never point these calls at the production deployment or a server started with the real Upstash credentials. Doctor's `stale` check catches a server reading the shared cache.
