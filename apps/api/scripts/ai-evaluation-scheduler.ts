export interface EvaluationSettlement {
  costUsd: number;
  accountingComplete: boolean;
}

/** Reserve in-flight allowances before dispatch; stop new work on unknown charges. */
export async function runEvaluationJobs<T>(options: {
  jobs: T[];
  concurrency: number;
  budgetUsd: number;
  allowance: (job: T) => number;
  run: (job: T) => Promise<EvaluationSettlement>;
  settled?: (job: T, totalCostUsd: number) => void;
}) {
  if (!Number.isSafeInteger(options.concurrency) || options.concurrency < 1 || options.concurrency > 6) throw new Error("Invalid evaluation concurrency.");
  if (!Number.isFinite(options.budgetUsd) || options.budgetUsd <= 0) throw new Error("Invalid evaluation budget.");
  let cursor = 0;
  let spent = 0;
  let reserved = 0;
  let stopReason: Error | undefined;

  async function worker() {
    while (!stopReason && cursor < options.jobs.length) {
      const job = options.jobs[cursor]!;
      const allowance = options.allowance(job);
      if (!Number.isFinite(allowance) || allowance <= 0) {
        stopReason = new Error("Invalid evaluation allowance.");
        return;
      }
      // An active job may release unused allowance. Do not stop prematurely.
      if (spent + reserved + allowance > options.budgetUsd + 1e-9) {
        if (reserved === 0) stopReason = new Error("Evaluation spend allowance exhausted.");
        return;
      }
      cursor++;
      reserved += allowance;
      try {
        const result = await options.run(job);
        if (!Number.isFinite(result.costUsd) || result.costUsd < 0) throw new Error("Invalid evaluation cost.");
        spent = Math.round((spent + result.costUsd) * 1e6) / 1e6;
        options.settled?.(job, spent);
        if (!result.accountingComplete) stopReason ??= new Error("Provider accounting is incomplete; reconcile before continuing.");
        if (result.costUsd > allowance + 1e-9) stopReason ??= new Error("Evaluation cost exceeded its reserved allowance.");
      } catch (error) {
        stopReason ??= error instanceof Error ? error : new Error("Evaluation failed.");
      } finally {
        reserved = Math.round((reserved - allowance) * 1e6) / 1e6;
      }
    }
  }

  await Promise.all(Array.from({ length: options.concurrency }, () => worker()));
  if (stopReason) throw stopReason;
  if (cursor < options.jobs.length) throw new Error("Evaluation did not complete.");
  return spent;
}
