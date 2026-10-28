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
  },
})
