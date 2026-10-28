import type { QueryClient } from "@tanstack/react-query"

import { TanStackDevtools } from "@tanstack/react-devtools"
import { HeadContent, Scripts, createRootRouteWithContext } from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"

import AppHeader from "#/ui/components/app-header"
import { TooltipProvider } from "#/ui/components/ui/tooltip"
import { APP_DESCRIPTION, APP_NAME } from "#/ui/lib/app-meta"
import { DEFAULT_SETTINGS, readSettings, SavedSettingsContext } from "#/ui/lib/settings"
import { providersInfoQueryOptions } from "#/ui/lib/use-providers-info"

import TanStackQueryDevtools from "../components/integrations/tanstack-query/devtools"
import appCss from "../styles.css?url"

interface MyRouterContext {
  queryClient: QueryClient
}

// Runs before paint, so it cannot import from `#/ui/lib/theme` — keep the two in
// step: no stored value means the system preference decides.
const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var resolved=stored==='light'||stored==='dark'?stored:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);root.style.colorScheme=resolved}catch(e){}})()`

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
      // The two faces the first paint needs; the other subsets and weights load on demand.
      {
        rel: "preload",
        href: "/fonts/instrument-sans-400-700-normal-latin.woff2",
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
      {
        rel: "preload",
        href: "/fonts/martian-mono-400-700-normal-latin.woff2",
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "icon", href: "/favicon.ico", sizes: "48x48" },
      { rel: "apple-touch-icon", href: "/logo192.png" },
      { rel: "manifest", href: "/manifest.json" },
    ],
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
        <Scripts />
      </body>
    </html>
  )
}
