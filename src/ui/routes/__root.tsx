import type { QueryClient } from "@tanstack/react-query"

import { TanStackDevtools } from "@tanstack/react-devtools"
import { HeadContent, Scripts, createRootRouteWithContext } from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"

import AppHeader from "#/ui/components/app-header"
import { TooltipProvider } from "#/ui/components/ui/tooltip"
import { APP_DESCRIPTION, APP_NAME } from "#/ui/lib/app-meta"
import { providersInfoQueryOptions } from "#/ui/lib/use-providers-info"

import ClerkProvider from "../components/integrations/clerk/provider"
import TanStackQueryDevtools from "../components/integrations/tanstack-query/devtools"
import appCss from "../styles.css?url"

interface MyRouterContext {
  queryClient: QueryClient
}

// Runs before paint, so it cannot import from `#/ui/lib/theme` — keep the two in
// step: no stored value means the system preference decides.
const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var resolved=stored==='light'||stored==='dark'?stored:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);root.style.colorScheme=resolved}catch(e){}})()`

export const Route = createRootRouteWithContext<MyRouterContext>()({
  beforeLoad: async ({ context }) => {
    await context.queryClient.ensureQueryData(providersInfoQueryOptions)
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
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "icon", href: "/favicon.ico", sizes: "48x48" },
      { rel: "apple-touch-icon", href: "/logo192.png" },
      { rel: "manifest", href: "/manifest.json" },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body className="font-sans antialiased">
        <ClerkProvider>
          <TooltipProvider>
            <AppHeader />
            {children}
          </TooltipProvider>
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
        </ClerkProvider>
        <Scripts />
      </body>
    </html>
  )
}
