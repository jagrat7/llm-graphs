# Adding a score provider

Implement a source in `src/server/services/providers/<provider>/`, extending `MetricProvider` and implementing `MetricSource`. Register its instance once in `providers/index.ts`. The registry supplies provider types, fetching, metadata order, diagnostics, source attribution, selectors and fixture refresh automatically.

The adapter owns these decisions:

- Parse first-party data with a strict schema; keep malformed rows in `dropped`. Use a versioned cache key when parsing or measurement meaning changes.
- Declare only published metrics. A missing observation is `null`; an unsupported metric has no reader. Never derive task cost from a token price or substitute another benchmark's cost.
- Declare native score labels, units and formats in `presentation`. Use `describe` for benchmark version, confidence intervals, scaffold, update date and preliminary status.
- Preserve model snapshots, budgets and configuration identity. Unknown reasoning settings stay unknown; set `configurationKnown: false` when they cannot establish an exact cross-source configuration match.
- Use `scope: "model"` only for measurements independent of effort. Lending token pricing to an unspecified configuration requires every non-refused published variant to have the same nonmissing price. Speed, benchmark task cost and runtime remain configuration-dependent.
- Define benchmark-specific validity bounds in the reader. Shared validation converts negative/nonfinite measurements to unavailable and refuses a refresh with no valid observations for any declared metric. Failed refreshes retain the last good cache copy.

Add small parser fixtures and tests for schema changes, missing fields, invalid bounds and configuration identity. Run `bun run fixtures:models` to refresh full first-party snapshots, then add the new fixture to `allFixtureInputs` for the graph matrix. Fixture refresh requires AA credentials because it refreshes all sources; tests use committed data and make no upstream requests.

Run `bun dev/audit-graphs.ts` for the frozen-data report, then the regression suite and required lint/type/format/build checks. The graph matrix derives its cases from provider capabilities, so adding a score provider automatically adds its metric sets and source choices. Equivalent axis permutations share the same data joins, so the matrix checks each distinct 2D/3D metric set once; native swap interactions cover axis reordering. It checks default selections and measurement provenance rather than enumerating subsets of all models.

For rendering verification, open the shared browser preview with animation frames active. Evaluate `import('/dev/browser-graph-audit.js').then(async m => { window.__browserGraphModule = m; return m.prepareBrowserAudit() })`, then call `window.__browserGraphModule.auditGraphBatch(start, 12)` in batches until its reported total is covered. Export `browserAuditSummary()` and `browserAuditResults(start, 24)` before editing files or reloading. These development-only tools inspect mounted SVG/WebGL rendering, native axis labels, point counts and constant axes. Check representative mobile layouts, tooltips and recovery interactions separately.

When exposing a new kind of measurement, add its key to `provider.types.ts` and its URL/label definition to `ui/lib/metrics.ts`. `Model` and `metricRecord` then include it automatically; provider capability declarations control selectors and audit cases. Existing kinds of measurements need only an adapter reader.

The current sources and limitations are documented in [the research](score-provider-research.md) and [the audit](provider-graph-audit.md).
