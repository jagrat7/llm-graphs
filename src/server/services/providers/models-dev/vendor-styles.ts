import claudeLogo from "./logos/claude.svg?raw"

export type VendorStyle = {
  /**
   * The brand colour. Only its hue is used: the theme keeps lightness and chroma, so the lines
   * read in both modes. The vendor's models sit on close hues around it. Black, white or grey
   * draws in the theme's ink instead (white in dark mode, near-black in light), its models
   * stepping toward grey.
   */
  color?: string
  /**
   * For a black-and-white brand, the colour its ink is faintly tinted toward, so two such brands
   * tell apart. Only its hue is used. Left out, the tint takes the slug's hashed hue.
   */
  tint?: string
  /** SVG markup, imported with `?raw`. Drawn as a one-colour mask, so only its shape shows. */
  logo?: string
}

/**
 * Brand colours and logos, keyed by vendor slug. Colours are the brands' own, from svgl and
 * theSVG; Anthropic and Alibaba take their model's colour (Claude, Qwen). The white brands' tints
 * are OpenAI's old ChatGPT green, a warm gold for xAI and Kimi's blue for Moonshot. A vendor left out
 * keeps the hue hashed from its slug and its models.dev logo.
 */
export const VENDOR_STYLES: Readonly<Record<string, VendorStyle>> = {
  anthropic: { color: "#D97757", logo: claudeLogo },
  openai: { color: "#FFFFFF", tint: "#10A37F" },
  xai: { color: "#FFFFFF", tint: "#E8B04A" },
  moonshotai: { color: "#FFFFFF", tint: "#1783FF" },
  google: { color: "#4285F4" },
  alibaba: { color: "#615CED" },
  mistral: { color: "#FA520F" },
  deepseek: { color: "#4D6BFE" },
  meta: { color: "#0467DF" },
  nvidia: { color: "#76B900" },
  zhipuai: { color: "#3859FF" },
  ibm: { color: "#1F70C1" },
  amazon: { color: "#FF9900" },
  cohere: { color: "#39594D" },
  tencent: { color: "#0052D9" },
  microsoft: { color: "#00A4EF" },
  "allen-institute-for-ai": { color: "#F0529C" },
  ai2: { color: "#F0529C" },
  xiaomi: { color: "#FF6900" },
  minimax: { color: "#E73562" },
  upstage: { color: "#908AF9" },
  stepfun: { color: "#005AFF" },
  baidu: { color: "#2932E1" },
  "lg-ai-research": { color: "#A50034" },
  perplexity: { color: "#20808D" },
  "bytedance-seed": { color: "#3C8CFF" },
}
