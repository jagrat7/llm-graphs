## Lint & format

- `bun run lint` / `bun run lint:fix` — oxlint (type-aware)
- `bun run fmt` / `bun run fmt:check` — oxfmt
- Config: `.oxlintrc.json`, `.oxfmtrc.json`
- Custom rules: `dev/oxlint/` (`local/no-server-deep-imports`, `local/only-service-export`)
- `bun run typecheck` — Bun's built-in TypeScript checker (requires Bun 1.4.3+)

## Worktrees

- `scripts/setup-worktree.sh` runs on worktree creation (via `t3.json`): it symlinks the main checkout's `.env` into the worktree and runs `bun install`.
- Edit env files in the main checkout, not in a worktree — the worktree copies are symlinks.

## Design page

- `/design` (dev only: 404 in a build, and none of its code ships) shows the design system as it is: the shadcn preset, colours, type, shape, and every component in light and dark. It reads `src/ui/styles.css`, `components.json` and `src/ui/components/ui/` itself; the page lives in `src/ui/design/`.
- A new component in `src/ui/components/ui/` needs a demo, `src/ui/design/demos/<name>.demo.tsx` (the page lists components without one). A custom component worth showing gets one too, with `meta.custom`.
- After changing `components.json` or the theme, run `bun scripts/design-preset.ts` to refresh `src/ui/design/shadcn-preset.gen.json`.
