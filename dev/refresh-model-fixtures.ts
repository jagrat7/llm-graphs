/**
 * Refetches the real source payloads the aggregator tests run against. Run by hand only:
 * `bun run fixtures:models` (needs AA_API_KEY in .env). Review the snapshot diff afterwards.
 */
import { writeFile } from "node:fs/promises"

import { ProvidersService } from "../src/server/services/providers"

const FIXTURE_DIR = new URL("../src/server/services/model-aggregator/fixtures/", import.meta.url)
const sources = {
  ...Object.fromEntries(
    Object.values(ProvidersService.metricSources).map((source) => [
      source.name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
      source,
    ]),
  ),
  "models-dev": ProvidersService.catalog,
}

for (const [file, source] of Object.entries(sources)) {
  const fixture = { fetchedAt: new Date().toISOString(), payload: await source.fetchPayload() }
  await writeFile(new URL(`${file}.json`, FIXTURE_DIR), `${JSON.stringify(fixture, null, 2)}\n`)
  console.info(
    `${file}: ${fixture.payload.rows.length} rows, ${fixture.payload.dropped.length} dropped`,
  )
}
