export type ModelExamples = {
  label: string
  category: "image"
  models: ReadonlyArray<string>
  posts: ReadonlyArray<string>
}

export const MODEL_EXAMPLES: ReadonlyArray<ModelExamples> = [
  {
    label: "GPT Image 2.5",
    category: "image",
    models: ["gpt-image-2-5-sunburst", "gpt-image-2-5-flare"],
    posts: [
      "https://x.com/charlierguo/status/2097399137142772071",
      "https://x.com/DanDr1s/status/2097402355251593558",
      "https://x.com/8co28/status/2097423580229521849",
      "https://x.com/BenGeskin/status/2097554185096999382",
      "https://x.com/0xROAS/status/2097401017260179603",
      "https://x.com/mark_k/status/2097411028510179759",
      "https://x.com/EHuanglu/status/2097519538632024103",
    ],
  },
  {
    label: "Nano Banana 2.1",
    category: "image",
    models: ["nano-banana-2-1"],
    posts: [
      "https://x.com/cfryant/status/2107552426148745491",
      "https://x.com/Google/status/2107501209154204148",
    ],
  },
]
