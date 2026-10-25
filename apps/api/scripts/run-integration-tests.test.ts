import { describe, expect, it } from "vitest";
import { assertIntegrationReport, integrationSuites, requireIntegrationDatabase } from "./run-integration-tests";

describe("mandatory PostgreSQL integration command", () => {
  const report = () => ({ testResults: integrationSuites.map((suite) => ({
    name: `/repo/apps/api/${suite.path}`,
    assertionResults: Array.from({ length: suite.minimum }, () => ({ status: "passed" })),
  })) });

  it("accepts an isolated local database", () => {
    const url = "postgresql://postgres:local@localhost:5432/jango_feature_test_ci?schema=public";
    expect(requireIntegrationDatabase(url)).toBe(url);
    expect(() => assertIntegrationReport(report())).not.toThrow();
  });

  it.each([undefined, "", "not-a-url", "postgresql://host/production",
    "postgresql://remote.example/jango_feature_test_ci",
    "postgresql://localhost/jango_feature_testproduction"])("rejects unsafe or missing DB configuration without echoing it", (url) => {
    expect(() => requireIntegrationDatabase(url)).toThrow("local jango_feature_test_");
  });

  it.each(["pending", "skipped", "todo", "failed"])("fails on a %s test even when Vitest exits successfully", (status) => {
    const value = report();
    value.testResults[0]!.assertionResults[0]!.status = status;
    expect(() => assertIntegrationReport(value)).toThrow("without skips");
  });

  it("rejects missing reports, suites, and filtered-out cases", () => {
    expect(() => assertIntegrationReport(null)).toThrow();
    expect(() => assertIntegrationReport({ testResults: [] })).toThrow();
    const value = report();
    value.testResults[1]!.assertionResults.pop();
    expect(() => assertIntegrationReport(value)).toThrow();
  });
});
