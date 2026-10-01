import { HarborProvider } from "../harbor/harbor"

export class TerminalBenchProvider extends HarborProvider {
  constructor() {
    super({
      name: "terminalBench",
      displayName: "Terminal-Bench 4.0",
      href: "https://www.tbench.ai/leaderboard/terminal-bench/4.0",
      abbreviation: "TB",
      package: "terminal-bench/terminal-bench",
      release: "4-0-0",
      dataset: "1922072f-a433-429a-8929-350d5e1bcf02",
      trialField: "n_trials",
      duration: true,
    })
  }
}
