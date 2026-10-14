# Benchmark icons

Every registered benchmark has an official source mark in `SourceLogo`. Images are stored locally under `public/benchmarks`; no remote image requests are needed at runtime. Decorative icons have empty alternative text / `aria-hidden`, with the benchmark name displayed beside them.

| Benchmark              | Official asset source                                                   | Use                                                                                                                         |
| ---------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Artificial Analysis    | [Artificial Analysis](https://artificialanalysis.ai/)                   | Existing inline brand mark                                                                                                  |
| DeepSWE                | [Datacurve](https://datacurve.ai/)                                      | Existing inline publisher mark                                                                                              |
| METR                   | [Site favicon](https://metr.org/assets/images/favicon/favicon.png)      | Original PNG                                                                                                                |
| Arena                  | [Site favicon](https://arena.ai/images/favicon-rebrand.svg)             | Inline column paths; retains favicon view box                                                                               |
| AutomationBench        | [Zapier press page](https://zapier.com/press)                           | Inline orange underscore from the header wordmark, using the publisher identity; benchmark favicon is a plain orange square |
| Terminal-Bench         | [Site favicon](https://www.tbench.ai/fav.png)                           | Original terminal prompt PNG                                                                                                |
| Terminal-Bench Science | [Site favicon](https://www.terminal-bench-science.ai/favicon.svg?v=7)   | Inline atom strokes, removes black background and outer padding; central circle expressed as an equivalent path             |
| ARC Prize              | [Site favicon](https://arcprize.org/media/images/favicon.png)           | Original two-square PNG; avoids the verified-results badge                                                                  |
| CursorBench            | [Cursor favicon](https://cursor.com/marketing-static/favicon-light.svg) | Inline Cursor cube path, removes app tile and crops to the existing clip bounds                                             |
| SWE-bench Verified     | [SWE-bench logo](https://www.swebench.com/img/swe-llama.svg)            | Original llama SVG                                                                                                          |
| LiveCodeBench          | [Site favicon](https://livecodebench.github.io/images/favicon.svg)      | Original blue/green SVG                                                                                                     |

Inline shapes use the app's existing muted colour at rest and brand colour on hover, focus, or selection. Multicolour images use grayscale at rest and their original colours when selected or highlighted. An exhaustive `Record<ProviderName, SourceMark>` makes a missing icon for a new provider a type error. All marks remain trademarks of their owners.

Verified in the collaborative browser at 1280×800 and 390×844: all eleven menu icons loaded at 12×12, light and dark themes rendered them, the selected SWE-bench and LiveCodeBench images displayed their original colours, and the mobile page had no horizontal overflow. The existing 115 tests, typecheck, lint, format check, and production build passed.
