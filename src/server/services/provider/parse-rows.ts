import type { z } from "zod"

import type { SourcePayload } from "./provider.types"

/**
 * Parses rows one at a time, so one malformed row is dropped and recorded instead of failing the
 * whole response. A response where nothing parses is a failed fetch.
 */
export function parseRows<TRow>(
  source: string,
  rawRows: ReadonlyArray<unknown>,
  schema: z.ZodType<TRow>,
  idField: string,
): SourcePayload<TRow> {
  const payload: SourcePayload<TRow> = { rows: [], dropped: [] }

  for (const rawRow of rawRows) {
    const result = schema.safeParse(rawRow)

    if (result.success) {
      payload.rows.push(result.data)
      continue
    }

    const id = rawRow != null && typeof rawRow === "object" ? Reflect.get(rawRow, idField) : null
    payload.dropped.push({
      id: typeof id === "string" ? id : null,
      reason: result.error.issues
        .map((issue) => `${issue.path.join(".") || "row"}: ${issue.message}`)
        .join("; "),
    })
  }

  if (payload.rows.length === 0) throw new Error(`${source} returned no parseable rows`)

  return payload
}
