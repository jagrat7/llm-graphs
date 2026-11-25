import { createServerFn } from "@tanstack/react-start"

import { XPostsService } from "../services/x-posts"
import { snapshot } from "./models"

export const examples = createServerFn({ method: "GET" }).handler(async () => {
  const payload = await XPostsService.examples()
  if (payload == null) return null

  const covered = new Set(payload.groups.flatMap((group) => group.models))
  const { entries, logos } = await snapshot()
  const models = entries.flatMap((entry) =>
    covered.has(entry.id)
      ? [
          {
            id: entry.id,
            name: entry.name,
            vendor: entry.vendor,
            releaseDate: entry.releaseDate,
            hue: entry.hue,
            ...(entry.shade == null ? {} : { shade: entry.shade }),
            logo: entry.vendor == null ? null : (logos[entry.vendor] ?? null),
          },
        ]
      : [],
  )

  return { ...payload, models }
})
