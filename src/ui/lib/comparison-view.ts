import type { ModelSnapshot, ProvidersInfo } from "#/server/api"
import type { GraphSearch } from "#/ui/lib/graph-state"
import type { PickedModels } from "#/ui/lib/picked-models"
import type { Settings } from "#/ui/lib/settings"

import { axisBindings, axisSettings, scoreSourceOf } from "#/ui/lib/graph-state"
import { defaultPicks, offeredVariants } from "#/ui/lib/model-view"
import { withoutHiddenProviders } from "#/ui/lib/settings"

/** The settings that change which models a comparison offers and opens on. */
export type ComparisonSettings = Pick<Settings, "hiddenProviders">

/** The models the axes can draw, and the ones the chart opens on before the reader picks. */
export function comparisonModels(
  snapshot: ModelSnapshot,
  info: ProvidersInfo,
  search: GraphSearch,
  settings: ComparisonSettings,
) {
  const axes = axisSettings(search, info)
  const bindings = axisBindings(axes, info)
  // A provider turned off in settings leaves the picker and the opening picks alike.
  const models = withoutHiddenProviders(
    offeredVariants(snapshot, bindings),
    settings.hiddenProviders,
  )

  return {
    models,
    defaultModels: defaultPicks(
      snapshot,
      models,
      scoreSourceOf(axes),
      info,
      bindings.map((binding) => binding.metric),
    ),
  }
}

/**
 * What the first render draws, cut from the whole snapshot: the shown models' entries and logos,
 * and their rows on the axes' sources only. The opening picks are worked out here, against every
 * source, because the cut no longer holds what ranks them.
 */
export type ComparisonSlice = { snapshot: ModelSnapshot; defaultModels: Array<string> }

export function comparisonSlice(
  snapshot: ModelSnapshot,
  info: ProvidersInfo,
  search: GraphSearch,
  picks: PickedModels,
  settings: ComparisonSettings,
): ComparisonSlice {
  const { defaultModels } = comparisonModels(snapshot, info, search, settings)
  const shown = new Set(picks ?? defaultModels)
  const sources = new Set<string>(
    axisBindings(axisSettings(search, info), info).map((binding) => binding.source),
  )
  const entries = snapshot.entries.filter((entry) => shown.has(entry.id))
  const vendors = new Set(entries.map((entry) => entry.vendor))

  return {
    snapshot: {
      entries,
      logos: Object.fromEntries(
        Object.entries(snapshot.logos).filter(([vendor]) => vendors.has(vendor)),
      ),
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- same keys as the snapshot's
      variants: Object.fromEntries(
        Object.entries(snapshot.variants).map(([source, rows]) => [
          source,
          sources.has(source) ? rows.filter((row) => shown.has(row.entryId)) : [],
        ]),
      ) as ModelSnapshot["variants"],
      fetchedAt: snapshot.fetchedAt,
    },
    defaultModels,
  }
}
