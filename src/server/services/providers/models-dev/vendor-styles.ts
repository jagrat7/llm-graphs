import ai2Logo from "./logos/ai2.svg?raw"
import amazonLogo from "./logos/amazon.svg?raw"
import antGroupLogo from "./logos/ant-group.svg?raw"
import baaiLogo from "./logos/baai.svg?raw"
import baiduLogo from "./logos/baidu.svg?raw"
import blackForestLabsLogo from "./logos/black-forest-labs.svg?raw"
import bytedanceLogo from "./logos/bytedance.svg?raw"
import ibmLogo from "./logos/ibm.svg?raw"
import inceptionLogo from "./logos/inception.svg?raw"
import lgLogo from "./logos/lg.svg?raw"
import liquidLogo from "./logos/liquid.svg?raw"
import meituanLogo from "./logos/meituan.svg?raw"
import microsoftLogo from "./logos/microsoft.svg?raw"
import servicenowLogo from "./logos/servicenow.svg?raw"
import stepfunLogo from "./logos/stepfun.svg?raw"
import upstageLogo from "./logos/upstage.svg?raw"
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
 * theSVG; logos are theSVG's marks where models.dev has none (Amazon's smile and LG's face are
 * cropped out of their lockups, inclusionAI takes its parent Ant Group's mark); Anthropic and Alibaba take their model's colour (Claude, Qwen). The white brands' tints
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
  ibm: { color: "#1F70C1", logo: ibmLogo },
  amazon: { color: "#FF9900", logo: amazonLogo },
  cohere: { color: "#39594D" },
  tencent: { color: "#0052D9" },
  microsoft: { color: "#00A4EF", logo: microsoftLogo },
  "allen-institute-for-ai": { color: "#F0529C", logo: ai2Logo },
  allenai: { color: "#F0529C", logo: ai2Logo },
  ai2: { color: "#F0529C" },
  xiaomi: { color: "#FF6900" },
  minimax: { color: "#E73562" },
  upstage: { color: "#908AF9", logo: upstageLogo },
  stepfun: { color: "#005AFF", logo: stepfunLogo },
  baidu: { color: "#2932E1", logo: baiduLogo },
  "lg-ai-research": { color: "#A50034", logo: lgLogo },
  perplexity: { color: "#20808D" },
  "bytedance-seed": { color: "#3C8CFF", logo: bytedanceLogo },
  liquid: { logo: liquidLogo },
  meituan: { logo: meituanLogo },
  inception: { logo: inceptionLogo },
  inclusionai: { logo: antGroupLogo },
  baai: { logo: baaiLogo },
  servicenow: { logo: servicenowLogo },
  "black-forest-labs": { logo: blackForestLabsLogo },
}
