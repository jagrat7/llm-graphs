## Lint & format

- `bun run lint` / `bun run lint:fix` — oxlint (type-aware)
- `bun run fmt` / `bun run fmt:check` — oxfmt
- Config: `.oxlintrc.json`, `.oxfmtrc.json`
- Custom rules: `dev/oxlint/` (`local/no-server-deep-imports`, `local/only-service-export`)
- `bun run typecheck` — Bun's built-in TypeScript checker (requires Bun 1.4.3+)

## Worktrees

- `scripts/setup-worktree.sh` runs on worktree creation (via `t3.json`): it symlinks the main checkout's `.env` into the worktree and runs `bun install`.
- Edit env files in the main checkout, not in a worktree — the worktree copies are symlinks.
