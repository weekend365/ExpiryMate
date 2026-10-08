import { describe, expect, it } from "vitest";
import { runEvaluationJobs } from "./ai-evaluation-scheduler";

describe("evaluation spend and concurrent requests", () => {
  it("reserves active calls and reuses their released allowance", async () => {
    let active = 0;
    let peak = 0;
    const completed: number[] = [];
    const cost = await runEvaluationJobs({ jobs: [0, 1, 2, 3], concurrency: 3, budgetUsd: 0.9, allowance: () => 0.5,
      run: async job => { active++; peak = Math.max(peak, active); await Promise.resolve(); active--; completed.push(job); return { costUsd: 0.1, accountingComplete: true }; } });
    expect(cost).toBe(0.4);
    expect(peak).toBe(1);
    expect(completed).toEqual([0, 1, 2, 3]);
  });

  it("does not dispatch another request when remaining budget cannot cover it", async () => {
    const invoked: number[] = [];
    await expect(runEvaluationJobs({ jobs: [0, 1, 2], concurrency: 3, budgetUsd: 1, allowance: () => 0.5,
      run: async job => { invoked.push(job); await Promise.resolve(); return { costUsd: 0.5, accountingComplete: true }; } })).rejects.toThrow("allowance exhausted");
    expect(invoked).toEqual([0, 1]);
  });

  it("settles existing requests but stops new ones on unavailable accounting", async () => {
    const invoked: number[] = [];
    const settled: number[] = [];
    await expect(runEvaluationJobs({ jobs: [0, 1, 2, 3], concurrency: 2, budgetUsd: 2, allowance: () => 0.5,
      run: async job => { invoked.push(job); await Promise.resolve(); return { costUsd: 0.1, accountingComplete: job !== 0 }; },
      settled: job => { settled.push(job); } })).rejects.toThrow("accounting is incomplete");
    expect(invoked).toEqual([0, 1]);
    expect(settled).toEqual([0, 1]);
  });

  it("stops when a completed request exceeds its allowance", async () => {
    const invoked: number[] = [];
    await expect(runEvaluationJobs({ jobs: [0, 1], concurrency: 1, budgetUsd: 1, allowance: () => 0.5,
      run: async job => { invoked.push(job); return { costUsd: 0.6, accountingComplete: true }; } })).rejects.toThrow("exceeded its reserved allowance");
    expect(invoked).toEqual([0]);
  });
});
