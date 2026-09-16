---
name: react-composition-audit
description:
  Audit a React codebase for composition anti-patterns. Use when asked to audit,
  review, or grade component composition — boolean prop proliferation, render
  props, prop drilling, provider pyramids, monolithic conditional components, or
  React 19 API misuse. Produces a severity-ranked findings report; fixes are
  opt-in.
argument-hint: "[path-or-component]"
---

# React Composition Audit

You audit React components for composition anti-patterns and report findings
ranked by severity. This skill detects problems; for the remediations
themselves, read the `vercel-composition-patterns` skill's rule files
(`.agents/skills/vercel-composition-patterns/rules/`).

## Scope

- If the user passed an argument, audit that path or component only.
- Otherwise audit `src/ui/**/*.tsx`, skipping:
  - `src/ui/components/ui/` — shadcn/base-ui primitives, low-signal
  - generated files (`routeTree.gen.*`, `*.gen.ts`)
- Read `package.json` first for the React version. React 19 rules only apply
  on `react >= 19` (this repo is React 19).

## Detection passes

Run these with the grep tool over the audit scope, then READ every flagged
file before reporting — grep hits are leads, not findings. Confirm each one in
context and drop false positives (e.g. a legit `isOpen` on a base-ui primitive
is controlled state, not a variant flag).

### P1 — Boolean prop proliferation (HIGH)

Pattern: `\b(is|has|should|show|hide|enable|disable|allow|with)[A-Z]\w*[?:]`
inside `type`/`interface` Props declarations, plus `variant` props with 4+
string literals.

Flag when 2+ such props on one component feed conditional JSX
(`{isX ? <A/> : <B/>}`, `{showY && <C/>}`) — booleans that switch between
distinct subtrees or behaviors. Each boolean doubles the state space; the fix
is composition or explicit variant components
(`rules/architecture-avoid-boolean-props.md`,
`rules/patterns-explicit-variants.md`).

Also flag components with 8+ props where several are booleans — the props are
usually encoding variants.

### P2 — Render props / monolithic config objects (MEDIUM)

Pattern: `render[A-Z]\w*[?:]` in prop types; calls to `Children.map`,
`React.cloneElement`.

Flag `renderHeader`-style props and `cloneElement` injection. Prefer children
composition (`rules/patterns-children-over-render-props.md`). Legit escape
hatches (a single `render` on a primitive like a virtualized list) are not
findings — judgment required.

### P3 — Prop drilling (MEDIUM)

Harder to grep; do it during the read phase. Flag a prop that is accepted by a
component and forwarded unchanged to exactly one child, through 2+ levels,
when that child is the only consumer. The fix is a provider/context interface
(`rules/state-lift-state.md`, `rules/state-context-interface.md`).

### P4 — State coupled to UI (MEDIUM)

Pattern: UI components (files under `components/` that return JSX) directly
calling data/sync hooks (`useQuery`, `useMutation`, store selectors) instead of
receiving `state`/`actions`/`meta` via a provider.

Flag when the same composed UI could plausibly serve two state sources but is
hard-wired to one (`rules/state-decouple-implementation.md`). Route-level
components that own their data are fine — only flag reusable units.

### P5 — Provider pyramids (LOW)

Pattern: 4+ nested `*.Provider>` JSX elements at one site, or a `providers.tsx`
that composes many. Suggest composing into a single boundary component.

### P6 — React 19 API misuse (LOW, skip if React < 19)

Pattern: `forwardRef(`, `useContext(` in `.tsx` files.

Flag `forwardRef` (use `ref` as a normal prop) and `useContext` (use `use()`)
per `rules/react19-no-forwardref.md`. Skip occurrences inside
`components/ui/` primitives — those follow upstream shadcn conventions.

## Severity rubric

| Severity | Meaning                                                        |
| -------- | -------------------------------------------------------------- |
| HIGH     | Boolean-driven variants; component is already hard to extend    |
| MEDIUM   | Pattern works now but blocks reuse or forces prop threading     |
| LOW      | API hygiene; mechanical fix                                     |

Within HIGH/MEDIUM/LOW, order by blast radius: components used by many call
sites first.

## Report format

```
## Composition audit — <scope>

N components scanned, M findings (H high / M medium / L low)

### HIGH
1. <ComponentName> — path/to/file.tsx:NN
   Finding: <what, one line>
   Evidence: <props/snippet, 1-3 lines>
   Fix: <one line; rule file ref if applicable>

### MEDIUM ...
### LOW ...
```

End with a "Suggested order" section: the 1-3 refactors with the best
payoff-to-risk ratio. Do NOT fix anything unless the user asked for fixes —
the audit report is the deliverable. If they want fixes after, apply the
vercel-composition-patterns rules one component at a time.
