import { describe, expect, it } from "vitest"
import { prefersMarkdown } from "./chart-markdown"

describe("prefersMarkdown", () => {
  it.each([
    ["Claude Code", "text/markdown, text/html, */*", true],
    [
      "Cursor",
      "text/markdown,text/html;q=0.9,application/xhtml+xml;q=0.8,application/xml;q=0.7,image/webp;q=0.6,*/*;q=0.5",
      true,
    ],
    ["Cursor, later", "text/markdown, text/plain;q=0.9, */*;q=0.8", true],
    [
      "OpenCode",
      "text/markdown;q=1.0, text/x-markdown;q=0.9, text/plain;q=0.8, text/html;q=0.7, */*;q=0.1",
      true,
    ],
    [
      "Codex",
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
      false,
    ],
    ["Gemini CLI", "*/*", false],
    ["a browser", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", false],
    ["HTML ranked above markdown", "text/html, text/markdown;q=0.5", false],
    ["markdown refused", "text/markdown;q=0", false],
    ["HTML ranked above markdown through text/*", "text/markdown;q=0.5, text/*", false],
    ["HTML ranked above markdown through */*", "text/markdown;q=0.5, */*", false],
    ["no header", null, false],
  ])("%s", (_agent, accept, expected) => {
    expect(prefersMarkdown(accept)).toBe(expected)
  })
})
