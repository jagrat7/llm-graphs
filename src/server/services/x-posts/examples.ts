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
    label: "Claude Fable 5.2",
    category: "coding",
    models: ["claude-fable-5-2"],
    posts: [
      {
        url: "https://x.com/BlendiByl/status/2120341251178594532",
        alt: "A painterly, brush-stroke-rendered autumn forest with sunbeams across a leaf-covered path and a figure in a wide-brimmed hat and blue cloak walking away from the camera.",
      },
    ],
  },
  {
    label: "GPT-6.2 Astra",
    category: "coding",
    models: ["gpt-6-2-astra"],
    posts: [
      {
        url: "https://x.com/zavrenn/status/2123566988148846777",
        alt: "An aerial view of a detailed desert military base with two-story buildings, military trucks, shipping containers, hangars and a radio tower.",
      },
    ],
  },
  {
    label: "Gemini 4 Carbon",
    category: "coding",
    models: ["gemini-4-carbon"],
    posts: [
      {
        url: "https://x.com/GlitterPixely/status/2120264316092022895",
        alt: "A close-up, shallow-focus render of a dense green grass meadow dotted with small white wildflowers.",
      },
    ],
  },
  {
    label: "Kimi K3.1 Pro",
    category: "coding",
    models: ["kimi-k3-1-pro"],
    posts: [
      {
        url: "https://x.com/crystalsssup/status/2113684128734625948",
        alt: "A 3D web page titled 'FORM / 01 Dexterous Arm' showing a transparent robotic hand and forearm with visible joints and wiring, with pose and material controls along the bottom.",
      },
    ],
  },
  {
    label: "Claude Opus 5.5",
    category: "agents",
    models: ["claude-opus-5-5"],
    posts: [
      {
        url: "https://x.com/bcherny/status/2102543349102338309",
        alt: "A Slack thread in which the Claude app, running Opus 5.5, reports that six state machines were modelled and proved in Lean 4 and lists five draft PRs fixing the bugs the proofs found.",
      },
    ],
  },
  {
    label: "Gemini 4 Neon",
    category: "agents",
    models: ["gemini-4-neon"],
    posts: [
      {
        url: "https://x.com/ai_for_success/status/2123467103110078747",
        alt: "A rainy Japanese ramen-shop street scene split down the middle, with the original flat JPEG on the left and the live 3D version on the right.",
      },
    ],
  },
  {
    label: "GPT-6.2 Astra vs Claude Fable 5.2",
    category: "agents",
    models: ["gpt-6-2-astra", "claude-fable-5-2"],
    posts: [
      {
        url: "https://x.com/ArtificialAnlys/status/2123866468156854664",
        alt: "Side-by-side camera views of two robot arms next to coloured blocks and a clear tray in a 'Tidy the box' task, labelled GPT-6.2 Astra and Claude Fable 5.2 with command counters below.",
      },
    ],
  },
  {
    label: "Kimi K3.1 Pro",
    category: "agents",
    models: ["kimi-k3-1-pro"],
    posts: [
      {
        url: "https://x.com/Kimi_Moonshot/status/2113680710150357279",
        alt: "The Blender interface showing a circular terraced garden with a reflecting basin being modelled, with the scene collection and modifier panels open on the right.",
      },
    ],
  },
  {
    label: "Gemini 4 Carbon",
    category: "reasoning",
    models: ["gemini-4-carbon"],
    posts: [
      {
        url: "https://x.com/fofrAI/status/2122745728359403942",
        alt: "A scan of a 15th-century manuscript page written in a dense cipher of symbols, the text the model was asked to decode.",
      },
    ],
  },
  {
    label: "GPT-6.2 Astra vs Claude Fable 5.2",
    category: "reasoning",
    models: ["gpt-6-2-astra", "claude-fable-5-2"],
    posts: [
      {
        url: "https://x.com/PhysAIAnalysis/status/2122830478663434403",
        alt: "Side-by-side simulation frames of robot arms holding two interlocked blue and orange claw pieces, labelled GPT-6.2 Astra max and Claude Fable 5.2 max, under the task 'Separate the two interlocked claw pieces without breaking either one.'",
      },
    ],
  },
  {
    label: "GPT-6.2 Astra vs Claude Fable 5.2 vs Gemini 4 Carbon",
    category: "chat",
    models: ["gpt-6-2-astra", "claude-fable-5-2", "gemini-4-carbon"],
    posts: [
      {
        url: "https://x.com/petergyang/status/2123174863397650705",
        alt: "Three essay excerpts side by side on cream cards under the heading 'Writing: Astra vs Fable vs Carbon', labelled GPT-6.2 Astra, Claude Fable 5.2 and Gemini 4 Carbon.",
      },
    ],
  },
  {
    label: "Claude Opus 5.5 vs Claude Opus 5",
    category: "chat",
    models: ["claude-opus-5-5", "claude-opus-5"],
    posts: [
      {
        url: "https://x.com/claudeai/status/2102435529044250670",
        alt: "Two written bug reports side by side, Claude Opus 5 on the left and Claude Opus 5.5 on the right, with the Opus 5.5 version stating the billing bug up front in shorter, plainer prose.",
      },
    ],
  },
  {
    label: "Gemini 4 Argon",
    category: "chat",
    models: ["gemini-4-argon"],
    posts: [
      {
        url: "https://x.com/calebfoundry/status/2110403947894563114",
        alt: "A two-page book viewer showing the English title page of Pride and Prejudice beside its Korean translation, noting 6,067 lines and 231,891 output tokens.",
      },
    ],
  },
  {
    label: "Gemini 4 Hydrogen vs Gemini 3.8 Flash",
    category: "speed",
    models: ["gemini-4-hydrogen", "gemini-3-8-flash"],
    posts: [
      {
        url: "https://x.com/Bhavani_00007/status/2120959112934834412",
        alt: "Two stacked 3D scenes of a cartoon rooster on a desert farm road, the top labelled Gemini 4 Hydrogen and the bottom Gemini 3.8 Flash.",
      },
    ],
  },
  {
    label: "Gemini 4 Hydrogen",
    category: "speed",
    models: ["gemini-4-hydrogen"],
    posts: [
      {
        url: "https://x.com/SidraMiconi/status/2120948703095820743",
        alt: "A glowing orange stellar core surrounded by concentric rings and scattered particle streaks on a black background.",
      },
    ],
  },
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
