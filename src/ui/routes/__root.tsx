import type { QueryClient } from "@tanstack/react-query"

import { TanStackDevtools } from "@tanstack/react-devtools"
import { HeadContent, Scripts, createRootRouteWithContext } from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { Analytics } from "@vercel/analytics/react"

import AppHeader from "#/ui/components/app-header"
import { VariantBar } from "#/ui/dev/variants"
import { TooltipProvider } from "#/ui/components/ui/tooltip"
import { APP_DESCRIPTION, APP_NAME } from "#/ui/lib/app-meta"
import { DEFAULT_SETTINGS, readSettings, SavedSettingsContext } from "#/ui/lib/settings"
import { providersInfoQueryOptions } from "#/ui/lib/use-providers-info"

import TanStackQueryDevtools from "../components/integrations/tanstack-query/devtools"
import instrumentSansLatin from "@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-normal.woff2?url"
import martianMonoLatin from "@fontsource-variable/martian-mono/files/martian-mono-latin-wght-normal.woff2?url"

import appCss from "../styles.css?url"

interface MyRouterContext {
  queryClient: QueryClient
}

// Runs before paint, so it cannot import from `#/ui/lib/theme` — keep the two in
// step: no stored value means the system preference decides.
const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var resolved=stored==='light'||stored==='dark'?stored:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);root.style.colorScheme=resolved}catch(e){}})()`

// Watchtower is a self-hosted Umami. Only builds given a website ID load its tracker, so local dev
// and preview deploys stay out of the numbers. The tracker follows client-side route changes itself.
const WATCHTOWER_WEBSITE_ID = import.meta.env.VITE_WATCHTOWER_WEBSITE_ID
const WATCHTOWER_SCRIPT_URL =
  import.meta.env.VITE_WATCHTOWER_SCRIPT_URL || "https://watchtower-mu-seven.vercel.app/script.js"
const WATCHTOWER_SCRIPT = {
  src: WATCHTOWER_SCRIPT_URL,
  defer: true,
  "data-website-id": WATCHTOWER_WEBSITE_ID,
  // Without it the tracker posts to this app's own /api/send.
  "data-host-url": new URL(WATCHTOWER_SCRIPT_URL).origin,
  // The chart keeps its controls in the query, so counting the path alone stops each control
  // change from being a page view.
  "data-exclude-search": "true",
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  // Settings come from the request's cookie, so the server renders with this reader's own.
  beforeLoad: async ({ context }) => {
    const [savedSettings] = await Promise.all([
      readSettings(),
      context.queryClient.ensureQueryData(providersInfoQueryOptions),
    ])

    return { savedSettings }
  },
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: `${APP_NAME} — ${APP_DESCRIPTION}`,
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      // The two faces the first paint needs; the other subsets and styles load on demand.
      {
        rel: "preload",
        href: instrumentSansLatin,
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
      {
        rel: "preload",
        href: martianMonoLatin,
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
      { rel: "icon", href: "/favicon.ico", sizes: "16x16 32x32 48x48 64x64" },
      { rel: "icon", href: "/favicon-96.png", type: "image/png", sizes: "96x96" },
      { rel: "apple-touch-icon", href: "/logo192.png" },
      { rel: "manifest", href: "/manifest.json" },
    ],
    scripts: WATCHTOWER_WEBSITE_ID ? [WATCHTOWER_SCRIPT] : [],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  // Absent when the root's beforeLoad never ran, as on an error page; the defaults stand then.
  const savedSettings = Route.useRouteContext({ select: (context) => context.savedSettings })

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body className="font-sans antialiased">
        <SavedSettingsContext value={savedSettings ?? DEFAULT_SETTINGS}>
          <TooltipProvider>
            <AppHeader />
            {children}
          </TooltipProvider>
        </SavedSettingsContext>
        <TanStackDevtools
          config={{
            hideUntilHover: true,
            position: "bottom-right",
          }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
            TanStackQueryDevtools,
          ]}
        />
        {import.meta.env.DEV ? <VariantBar /> : null}
        {/* Vite gives the browser no NODE_ENV, so name the mode: dev logs page views, a build sends them. */}
        <Analytics mode={import.meta.env.DEV ? "development" : "production"} />
        <Scripts />
      </body>
    </html>
  )
}
