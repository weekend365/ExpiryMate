import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

export const integrationSuites = [
  { path: "src/modules/inventory/inventory-workflows.integration.test.ts", minimum: 4 },
  { path: "src/common/ai-telemetry.integration.test.ts", minimum: 2 },
] as const;

/** This command is deliberately restricted to a local, disposable PostgreSQL DB. */
export function requireIntegrationDatabase(value: string | undefined): string {
  const message = "Set JANGO_WORKFLOW_TEST_DATABASE_URL to a local jango_feature_test_* database.";
  if (!value) throw new Error(message);
  let url: URL;
  try { url = new URL(value); } catch { throw new Error(message); }
  if (!["postgres:", "postgresql:"].includes(url.protocol)
    || !["localhost", "127.0.0.1", "[::1]", "postgres"].includes(url.hostname)
    || !/^\/jango_feature_test(?:_[a-z0-9_]+)?$/.test(url.pathname)) {
    throw new Error(message);
  }
  return value;
}

export function assertIntegrationReport(report: unknown): void {
  const suites = (report as { testResults?: unknown[] } | null)?.testResults;
  if (!Array.isArray(suites)) throw new Error("Missing integration test report.");
  for (const expected of integrationSuites) {
    const suite = suites.find((value) => typeof value === "object" && value !== null
      && typeof (value as { name?: unknown }).name === "string"
      && (value as { name: string }).name.replaceAll("\\", "/").endsWith(`/${expected.path}`)) as
      { assertionResults?: { status?: string }[] } | undefined;
    if (!Array.isArray(suite?.assertionResults)
      || suite.assertionResults.length < expected.minimum
      || suite.assertionResults.some((test) => test.status !== "passed")) {
      throw new Error(`Every case must pass without skips: ${expected.path}`);
    }
  }
}

function main() {
  const databaseUrl = requireIntegrationDatabase(process.env.JANGO_WORKFLOW_TEST_DATABASE_URL);
  const temporary = mkdtempSync(join(tmpdir(), "jango-integration-"));
  try {
    const reportPath = join(temporary, "results.json");
    const result = spawnSync(process.execPath, [
      require.resolve("vitest/vitest.mjs"), "run", ...integrationSuites.map((suite) => suite.path),
      "--reporter=default", "--reporter=json", `--outputFile.json=${reportPath}`,
    ], {
      cwd: resolve(__dirname, ".."),
      env: { ...process.env, DATABASE_URL: databaseUrl, JANGO_WORKFLOW_TEST_DATABASE_URL: databaseUrl },
      stdio: "inherit",
    });
    if (result.status !== 0) throw new Error("PostgreSQL integration test process failed.");
    assertIntegrationReport(JSON.parse(readFileSync(reportPath, "utf8")));
    process.stdout.write("PostgreSQL integration suites passed without skipped cases.\n");
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

if (require.main === module) {
  try { main(); } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "Integration tests failed."}\n`);
    process.exitCode = 1;
  }
}
