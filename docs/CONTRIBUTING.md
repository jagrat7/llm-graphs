# Contributing

## Running locally

Requires [Bun](https://bun.sh/) 1.4.3 or later.

```bash
bun install
cp .env.example .env
bun run dev   # http://localhost:3000
```

Environment variables, all optional:

| Variable                                             | Purpose                                                                                                             |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `AA_API_KEY`                                         | [Artificial Analysis API](https://artificialanalysis.ai/documentation) key. Without it, that source is unavailable. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Shares the source cache across server instances. Without them, each server caches in memory.                        |
| `VITE_WATCHTOWER_WEBSITE_ID`                         | Watchtower (self-hosted Umami) website ID, read at build time. Without it, no page-view tracker loads.              |
| `VITE_WATCHTOWER_SCRIPT_URL`                         | Overrides the tracker URL. Defaults to `https://watchtower-mu-seven.vercel.app/script.js`.                          |

Sources are fetched on the server, cached, and refreshed in the background once stale. A failed refresh keeps the last good copy.

## Development

| Command                   | What it runs                                                                |
| ------------------------- | --------------------------------------------------------------------------- |
| `bun run test`            | Vitest. Tests use committed fixtures and make no upstream requests.         |
| `bun run typecheck`       | Bun's TypeScript checker                                                    |
| `bun run lint`            | oxlint (type-aware), with custom rules in `dev/oxlint/`                     |
| `bun run fmt`             | oxfmt                                                                       |
| `bun run build`           | Production build (Nitro server, deployed on Vercel)                         |
| `bun run fixtures:models` | Refreshes the first-party data snapshots used by tests (needs `AA_API_KEY`) |

Code layout:

- `src/server/services/providers/`: one adapter per source, registered in `index.ts`
- `src/server/services/model-aggregator/`: joins sources into one model snapshot
- `src/server/api/`: server functions the UI calls
- `src/ui/`: routes, chart components, and chart logic

To add a benchmark, see [Adding a score provider](adding-a-score-provider.md).

## Further reading

- [PRODUCT.md](PRODUCT.md): who it's for and the design principles
- [CONTEXT.md](../CONTEXT.md): domain terms such as score, task cost, and task horizon
- [brand.md](brand.md): the wordmark and seal
