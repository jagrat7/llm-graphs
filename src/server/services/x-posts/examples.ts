export type ExamplePost = { url: string; alt: string }

export type ExampleCategory = "coding" | "agents" | "reasoning" | "chat" | "speed" | "image"

export type ModelExamples = {
  label: string
  category: ExampleCategory
  models: ReadonlyArray<string>
  posts: ReadonlyArray<ExamplePost>
}

export const MODEL_EXAMPLES: ReadonlyArray<ModelExamples> = [
  {
    label: "GPT Image 2.5",
    category: "image",
    models: ["gpt-image-2-5-sunburst", "gpt-image-2-5-flare"],
    posts: [
      {
        url: "https://x.com/charlierguo/status/2097399137142772071",
        alt: "A clay caterpillar hanging from a twig, one frame of a stop-motion animation",
      },
      {
        url: "https://x.com/DanDr1s/status/2097402355251593558",
        alt: "Two scrambled Rubik's Cubes in front of a mirror, the reflection showing their hidden faces",
      },
      {
        url: "https://x.com/8co28/status/2097423580229521849",
        alt: "A pixel-art anime girl in a yellow jacket, one frame of a fighting sprite sheet",
      },
      {
        url: "https://x.com/BenGeskin/status/2097554185096999382",
        alt: "An Apple-style event slide comparing iPhone Duo models and their prices",
      },
      {
        url: "https://x.com/0xROAS/status/2097401017260179603",
        alt: "A photorealistic selfie of a woman in the back seat of a car",
      },
      {
        url: "https://x.com/mark_k/status/2097411028510179759",
        alt: "A photo-style clearing in a forest, dense with green foliage",
      },
      {
        url: "https://x.com/EHuanglu/status/2097519538632024103",
        alt: "A dark cinematic film still above a sheet of storyboard frames",
      },
    ],
  },
  {
    label: "Nano Banana 2.1",
    category: "image",
    models: ["nano-banana-2-1"],
    posts: [
      {
        url: "https://x.com/cfryant/status/2107552426148745491",
        alt: "Tiny explorers climbing a giant frozen wave inside a vast stone hall",
      },
      {
        url: "https://x.com/Google/status/2107501209154204148",
        alt: "Translucent white flowers above the words Nano Banana 2.1",
      },
    ],
  },
]
