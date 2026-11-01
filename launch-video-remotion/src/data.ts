import derived from "./data/derived.json"

export type Logo = { viewBox: string; body: string }
export type Model = {
  id: string
  name: string
  vendor: string
  hue: number | null
  shade: number | null
  logo: Logo | null
}
export type Point = {
  id: string
  model: string
  series: string
  level: string
  mode: string
  effortOrder: number
  configuration: string | null
  score: number
  cost: number
  duration: number | null
}
export type Source = {
  key: SourceKey
  name: string
  abbreviation: string
  points: Array<Point>
  frontier: Array<string>
}
export type SourceKey = "deepswe" | "terminalBench" | "arcPrize"
export type ScrapRow = {
  model: string
  name: string
  rank: number
  level: string
  value: number
  cells: Array<string>
}
export type Scrap = {
  source: string
  name: string
  title: string
  kind: "table" | "bars" | "scatter"
  columns?: Array<string>
  rows?: Array<ScrapRow>
  dots?: Array<{ model: string; score: number; cost: number }>
  focus?: { name: string; level: string; score: number; cost: number; cells: Array<string> }
}
export type SourceMark =
  | { viewBox: string; paths: Array<string>; brand?: string | { light: string; dark: string }; stroke?: boolean }
  | { src: string }

export const DATA = derived as unknown as {
  fetchedAt: Record<string, string | null>
  focus: string
  models: Array<Model>
  sources: Record<SourceKey, Source>
  scraps: Array<Scrap>
  sourceMarks: Record<string, SourceMark>
}

export const MODELS = new Map(DATA.models.map((model) => [model.id, model]))
export const FOCUS = DATA.focus
