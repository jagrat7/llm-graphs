import { writeFile } from "node:fs/promises"

import { ProvidersService } from "../src/server/services/providers"

const FIXTURE_DIR = new URL("../src/server/services/model-aggregator/fixtures/", import.meta.url)

export function selectFixtureSources<T extends { name: string }>(
  all: ReadonlyArray<T>,
  requested: ReadonlyArray<string>,
): Array<T> {
  if (requested.length === 0) return [...all]
  const unknown = requested.filter((name) => !all.some((source) => source.name === name))
  if (unknown.length)
    throw new Error(
      `Unknown source ${unknown.join(", ")}; one of ${all.map((source) => source.name).join(", ")}`,
    )
  return all.filter((source) => requested.includes(source.name))
}

if (import.meta.main) {
  const sources = selectFixtureSources(
    [...Object.values(ProvidersService.metricSources), ProvidersService.catalog],
    process.argv.slice(2),
  )
  for (const source of sources) {
    const file = source.name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
    const fixture = { fetchedAt: new Date().toISOString(), payload: await source.fetchPayload() }
    await writeFile(new URL(`${file}.json`, FIXTURE_DIR), `${JSON.stringify(fixture, null, 2)}\n`)
    console.info(
      `${file}: ${fixture.payload.rows.length} rows, ${fixture.payload.dropped.length} dropped`,
    )
  }
}
