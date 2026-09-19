## Lint & format

- `bun run lint` / `bun run lint:fix` — oxlint (type-aware)
- `bun run fmt` / `bun run fmt:check` — oxfmt
- Config: `.oxlintrc.json`, `.oxfmtrc.json`
- Custom rules: `dev/oxlint/` (`local/no-server-deep-imports`, `local/only-service-export`)
