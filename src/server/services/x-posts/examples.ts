export type ExamplePost = { url: string; alt: string }

export type ExampleCategory = "coding" | "agents" | "reasoning" | "chat" | "speed" | "image"

export type ModelExamples = {
  label: string
  category: ExampleCategory
  models: ReadonlyArray<string>
  posts: ReadonlyArray<ExamplePost>
}

/** Post ids never shown, even when discovery finds them. */
export const BLOCKED_POSTS: ReadonlyArray<string> = []

/** X handles whose posts discovery skips. */
export const BLOCKED_AUTHORS: ReadonlyArray<string> = []
