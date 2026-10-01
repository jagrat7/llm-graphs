import { HarborProvider } from "../harbor/harbor"

export class TerminalBenchScienceProvider extends HarborProvider {
  constructor() {
    super({
      name: "terminalBenchScience",
      displayName: "Terminal-Bench Science 0.1",
      href: "https://www.terminal-bench-science.ai/",
      abbreviation: "TBS",
      package: "terminal-bench-science/terminal-bench-science",
      release: "v0-1-eval",
      dataset: "2b817f26-dc4f-4477-8032-2218dcc553b5",
      trialField: "tasks",
      url: "https://www.terminal-bench-science.ai/api/leaderboard?package=terminal-bench-science%2Fterminal-bench-science&name=v0-1-eval",
    })
  }
}
