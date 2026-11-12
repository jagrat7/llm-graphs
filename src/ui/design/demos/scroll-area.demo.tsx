import { ScrollArea } from "#/ui/components/ui/scroll-area"

import { type DemoMeta } from "../demo"

export const meta: DemoMeta = { title: "Scroll area", components: ["scroll-area"] }

const MODELS = [
  "GPT-5",
  "GPT-5 mini",
  "Claude Opus 4.5",
  "Claude Sonnet 4.5",
  "Gemini 3 Pro",
  "Gemini 2.5 Flash",
  "DeepSeek V3.2",
  "Grok 4",
  "Kimi K2",
  "Qwen3 Max",
  "GLM-4.6",
  "Mistral Medium 3",
]

export default function ScrollAreaDemo() {
  return (
    <ScrollArea className="h-40 w-56 rounded-md border">
      <ul className="text-control grid gap-1 p-2">
        {MODELS.map((model) => (
          <li key={model} className="px-1.5 py-1">
            {model}
          </li>
        ))}
      </ul>
    </ScrollArea>
  )
}
