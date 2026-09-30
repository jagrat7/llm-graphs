import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "#": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // `src/env.ts` checks this on import. Tests never connect to the database.
    env: { DATABASE_URL: "postgres://test@localhost/test" },
  },
})
