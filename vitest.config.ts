import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "#": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  define: { "import.meta.env.BUILD_ID": JSON.stringify("test-build") },
  test: {
    include: ["src/**/*.test.{ts,tsx}", "dev/**/*.test.{ts,tsx}"],
    environment: "node",
    // Node 25+ defines its own `localStorage`, which is undefined without a backing file and
    // hides jsdom's from tests that render in a browser environment.
    execArgv: ["--no-experimental-webstorage"],
  },
})
