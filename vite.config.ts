import tailwindcss from "@tailwindcss/vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { nitro } from "nitro/vite"
import { defineConfig } from "vite"

/**
 * One id per build, shared by every server instance running it and new on the next build, on any
 * host. It versions the snapshot's ETag and the snapshot instances share through Redis.
 */
const BUILD_ID = crypto.randomUUID()

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  define: { "import.meta.env.BUILD_ID": JSON.stringify(BUILD_ID) },
  plugins: [
    devtools(),
    nitro({ rollupConfig: { external: [/^@sentry\//] } }),
    tailwindcss(),
    tanstackStart({
      router: {
        entry: "ui/router.tsx",
        routesDirectory: "ui/routes",
        generatedRouteTree: "ui/routeTree.gen.ts",
      },
    }),
    viteReact(),
  ],
})

export default config
