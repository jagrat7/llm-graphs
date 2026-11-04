/** Set per build by `define` in vite.config.ts. */
interface ImportMetaEnv {
  readonly BUILD_ID: string
  /** Watchtower (Umami) website ID; without it the tracker is left out. Inlined at build time. */
  readonly VITE_WATCHTOWER_WEBSITE_ID?: string
  /** Overrides the Watchtower tracker URL. */
  readonly VITE_WATCHTOWER_SCRIPT_URL?: string
}
