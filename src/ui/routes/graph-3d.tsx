import { createFileRoute, redirect } from "@tanstack/react-router"
import { z } from "zod"

import { METRICS } from "#/ui/lib/metrics"

const metricSchema = z.enum(METRICS)
const sourceSchema = z.string().optional().catch(undefined)
const graphSearchSchema = z.object({
  x: metricSchema.catch("cost").default("cost"),
  xSource: sourceSchema,
  y: metricSchema.catch("score").default("score"),
  ySource: sourceSchema,
  z: metricSchema.catch("speed").default("speed"),
  zSource: sourceSchema,
})

/** The third axis now lives on Compare; old links keep working through this redirect. */
export const Route = createFileRoute("/graph-3d")({
  validateSearch: (search) => graphSearchSchema.parse(search),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/",
      search,
      replace: true,
    })
  },
})
