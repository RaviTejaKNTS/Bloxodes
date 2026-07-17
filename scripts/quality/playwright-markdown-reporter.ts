import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult } from "@playwright/test/reporter";

type Failure = {
  project: string;
  title: string;
  error: string;
};

export default class MarkdownReporter implements Reporter {
  private startedAt = new Date();
  private tests = 0;
  private passed = 0;
  private skipped = 0;
  private failures: Failure[] = [];
  private projects: string[] = [];
  private reportDir = path.resolve(process.cwd(), "tmp/test-reports");

  onBegin(config: FullConfig, suite: Suite) {
    this.projects = config.projects.map((project) => project.name);
    this.tests = suite.allTests().length;
  }

  onTestEnd(test: TestCase, result: TestResult) {
    if (result.status === "passed") this.passed += 1;
    else if (result.status === "skipped") this.skipped += 1;
    else {
      this.failures.push({
        project: test.parent.project()?.name ?? "unknown",
        title: test.titlePath().join(" > "),
        error: result.error?.message?.replace(/\x1B\[[0-9;]*m/g, "") ?? result.status
      });
    }
  }

  onEnd(result: FullResult) {
    mkdirSync(this.reportDir, { recursive: true });
    const durationMs = Date.now() - this.startedAt.getTime();
    const lines = [
      "# Render smoke verification",
      "",
      `Generated: ${new Date().toISOString()}`,
      `Status: ${result.status}`,
      `Projects: ${this.projects.join(", ")}`,
      `Duration: ${(durationMs / 1_000).toFixed(1)}s`,
      "",
      `- Tests: ${this.tests}`,
      `- Passed: ${this.passed}`,
      `- Skipped: ${this.skipped}`,
      `- Failed or interrupted: ${this.failures.length}`,
      "",
      "## Failures",
      "",
      ...(this.failures.length
        ? this.failures.map((failure) =>
            `- [${failure.project}] ${failure.title}: ${failure.error.replace(/\s+/g, " ").slice(0, 600)}`
          )
        : ["- None"])
    ];
    writeFileSync(path.join(this.reportDir, "render-smoke.md"), `${lines.join("\n")}\n`);
  }
}
