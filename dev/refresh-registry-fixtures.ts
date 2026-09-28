/**
 * Refetches the real source payloads the registry tests run against. Run by hand only:
 * `bun run fixtures:registry` (needs AA_API_KEY in .env). Review the snapshot diff afterwards.
 */
import { writeFile } from "node:fs/promises"

import { ArtificialAnalysisProvider } from "../src/server/services/provider/artificial-analysis"
import { DeepSWEProvider } from "../src/server/services/provider/deep-swe"
import { ModelsDevProvider } from "../src/server/services/provider/models-dev"

const FIXTURE_DIR = new URL("../src/server/services/registry/fixtures/", import.meta.url)
const sources = {
  deepswe: new DeepSWEProvider(),
  "artificial-analysis": new ArtificialAnalysisProvider(),
  "models-dev": new ModelsDevProvider(),
}

for (const [file, source] of Object.entries(sources)) {
  const fixture = { fetchedAt: new Date().toISOString(), payload: await source.fetchPayload() }
  await writeFile(new URL(`${file}.json`, FIXTURE_DIR), `${JSON.stringify(fixture, null, 2)}\n`)
  console.info(
    `${file}: ${fixture.payload.rows.length} rows, ${fixture.payload.dropped.length} dropped`,
  )
}
