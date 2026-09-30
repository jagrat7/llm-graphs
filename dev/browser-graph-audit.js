/** Run through the shared preview: import('/dev/browser-graph-audit.js'). */
/* oxlint-disable eslint/no-underscore-dangle -- inspect the development router and mounted R3F renderer */
import {
  graphCases,
  axisSettings,
  axisBindings,
  unavailableMetrics,
  scoreSourceOf,
} from "../src/ui/lib/graph-state"
import { offeredVariants, defaultPicks } from "../src/ui/lib/model-view"
import { buildPlotData, plotQuality, describePlot } from "../src/ui/lib/comparison-plot-data"
import { metricAxisLabel } from "../src/ui/lib/metrics"

let audit
let fiber
export async function prepareBrowserAudit() {
  const router = window.__TSR_ROUTER__
  const queries = router.options.context.queryClient.getQueryCache().getAll()
  const info = queries.find((q) => q.queryKey[0].join("/") === "providers/info").state.data
  const snapshot = queries.find((q) => q.queryKey[0].join("/") === "models/snapshot").state.data
  const compiled = await (await fetch("/src/ui/components/comparison-chart-3d.tsx")).text()
  const url = /from ["']([^"']*@react-three_fiber[^"']*)["']/.exec(compiled)?.[1]
  if (!url) throw new Error("Cannot inspect mounted R3F renderer")
  fiber = await import(/* @vite-ignore */ url)
  audit = {
    startedAt: new Date().toISOString(),
    fetchedAt: snapshot.fetchedAt,
    cases: graphCases(info),
    results: [],
    router,
    info,
    snapshot,
  }
  return { total: audit.cases.length, fetchedAt: audit.fetchedAt }
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function frames() {
  return new Promise((resolve) => {
    let count = 0
    const next = () => {
      count++
      if (count === 3) resolve(count)
      else requestAnimationFrame(next)
    }
    requestAnimationFrame(next)
    setTimeout(() => resolve(count), 1500)
  })
}

export async function auditGraphBatch(start, count = 12) {
  const { snapshot, info, router } = audit
  const results = []
  for (const item of audit.cases.slice(start, start + count)) {
    const axes = axisSettings(item.search, info)
    const bindings = axisBindings(axes, info)
    const offered = offeredVariants(snapshot, bindings)
    const picks = defaultPicks(
      snapshot,
      offered,
      scoreSourceOf(axes),
      info,
      bindings.map((binding) => binding.metric),
    )
    const plot = buildPlotData(
      offered.filter((model) => picks.includes(model.model)),
      item.search,
    )
    const quality = plotQuality(plot)
    const status = unavailableMetrics(axes, info).length
      ? "unavailable-metric"
      : offered.length === 0
        ? "no-matching-configuration"
        : quality.meaningful
          ? "meaningful"
          : "constant-axis"
    await router.navigate({ to: "/", search: item.search, replace: true })
    let expected = false
    for (let tries = 0; tries < 100; tries++) {
      const ready = document.querySelector('[data-chart-frame="loaded"]')
      const description = ready?.querySelector('[role="img"]')?.getAttribute("aria-label")
      const points = ready?.querySelectorAll(
        "[data-chart-keyboard-point], [data-plot-3d-point]",
      ).length
      const canvas = ready?.querySelector("canvas")
      const rendererReady = !plot.is3D || !!fiber._roots.get(canvas)?.store.getState()
      const empty =
        document.body.innerText.includes("unavailable for this score benchmark") ||
        document.body.innerText.includes("No model configurations have all selected metrics")
      expected =
        status === "meaningful"
          ? !!ready &&
            description === describePlot(plot) &&
            points === plot.points.length &&
            rendererReady &&
            (plot.is3D ? !!canvas : !!ready.querySelector("svg.block"))
          : empty
      if (expected && status === "meaningful") {
        const wanted = plot.axes.map((axis) =>
          metricAxisLabel(plot.metrics[axis], axes[axis].source, info),
        )
        expected = wanted.every((label) => ready.innerHTML.includes(label))
      }
      if (expected) break
      await delay(50)
    }
    await frames()
    const failures = []
    if (!expected) failures.push("Expected graph/state did not mount")
    const pointCount = document.querySelectorAll(
      "[data-chart-keyboard-point], [data-plot-3d-point]",
    ).length
    if (pointCount !== plot.points.length)
      failures.push(`Points ${pointCount} != ${plot.points.length}`)
    const result = {
      key: item.key,
      status,
      points: plot.points.length,
      models: plot.modelCount,
      quality,
      failures,
    }
    if (status === "meaningful") {
      if (!quality.meaningful) failures.push("Constant axis or insufficient models")
      const raf = await frames()
      if (raf < 3) failures.push("Animation frames paused")
      result.raf = raf
      const frame = document.querySelector('[data-chart-frame="loaded"]')
      const frameBox = frame.getBoundingClientRect()
      const labels = []
      for (const axis of plot.axes) {
        const label = metricAxisLabel(plot.metrics[axis], axes[axis].source, info)
        const node = plot.is3D
          ? [...frame.querySelectorAll("[title]")].find((n) => n.textContent === label)
          : [...frame.querySelectorAll("svg text")].find(
              (n) => n.childNodes[n.childNodes.length - 1]?.textContent?.trim() === label,
            )
        if (!node) failures.push(`Missing ${axis} native label: ${label}`)
        else {
          const box = node.getBoundingClientRect()
          const clipped =
            box.left < frameBox.left - 1 ||
            box.right > frameBox.right + 1 ||
            box.top < frameBox.top - 1 ||
            box.bottom > frameBox.bottom + 1
          if (clipped) failures.push(`Clipped ${axis} label`)
          labels.push({ axis, label, clipped })
        }
      }
      result.labels = labels
      if (plot.is3D) {
        const canvas = document.querySelector("canvas")
        const state = fiber._roots.get(canvas)?.store.getState()
        if (!state) failures.push("No mounted WebGL renderer")
        else {
          state.gl.render(state.scene, state.camera)
          const gl = state.gl.getContext()
          const pixels = new Uint8Array(canvas.width * canvas.height * 4)
          gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
          let changed = 0
          for (let i = 0; i < pixels.length; i += 4)
            if (
              pixels[i] !== pixels[0] ||
              pixels[i + 1] !== pixels[1] ||
              pixels[i + 2] !== pixels[2]
            )
              changed++
          if (changed < 100 || state.gl.info.render.triangles < plot.points.length)
            failures.push("WebGL has insufficient painted geometry")
          let invalid = false
          let markers = 0
          const outsidePoints = []
          state.scene.traverse((node) => {
            if (![node.position.x, node.position.y, node.position.z].every(Number.isFinite))
              invalid = true
            const values = node.geometry?.attributes?.position?.array
            if (values && !values.every(Number.isFinite)) invalid = true
            if (node.userData.plotPoint) {
              markers++
              const projected = node.getWorldPosition(node.position.clone()).project(state.camera)
              if (
                !node.visible ||
                Math.abs(projected.x) > 1 ||
                Math.abs(projected.y) > 1 ||
                Math.abs(projected.z) > 1
              )
                outsidePoints.push(node.userData.plotPoint)
            }
          })
          if (invalid) failures.push("Nonfinite scene geometry")
          if (markers !== plot.points.length) failures.push("Missing scene point markers")
          if (outsidePoints.length) failures.push("Point markers outside camera view")
          result.render = {
            width: canvas.width,
            height: canvas.height,
            nonBackground: changed,
            triangles: state.gl.info.render.triangles,
            lines: state.gl.info.render.lines,
            markers,
            outsidePoints,
          }
        }
      } else {
        const bad = [...frame.querySelectorAll("svg path")].some((path) =>
          /NaN|Infinity|undefined/.test(path.getAttribute("d") ?? ""),
        )
        if (bad) failures.push("Invalid SVG path")
      }
    } else if (document.querySelector('[data-chart-frame="loaded"]'))
      failures.push("Unsupported graph rendered")
    results.push(result)
  }
  audit.results.push(...results)
  return {
    completed: audit.results.length,
    failures: results.filter((result) => result.failures.length),
    counts: Object.fromEntries(
      [...new Set(results.map((result) => result.status))].map((status) => [
        status,
        results.filter((result) => result.status === status).length,
      ]),
    ),
  }
}
export function browserAuditResults(start = 0, count = 24) {
  return audit.results.slice(start, start + count)
}
export function browserAuditSummary() {
  return {
    checkedAt: audit.startedAt,
    fetchedAt: audit.fetchedAt,
    total: audit.cases.length,
    completed: audit.results.length,
    failures: audit.results.filter((result) => result.failures.length),
    counts: Object.fromEntries(
      [...new Set(audit.results.map((result) => result.status))].map((status) => [
        status,
        audit.results.filter((result) => result.status === status).length,
      ]),
    ),
  }
}
