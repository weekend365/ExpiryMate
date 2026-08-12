import { createHmac } from "node:crypto";

export type BarcodeRewardPolicy = {
  enabled: boolean;
  cohort: "control" | "reward";
  dailyLimit: number;
  balanceLimit: number;
};

export function resolveBarcodeRewardPolicy(
  ownerKey: string,
): BarcodeRewardPolicy {
  const globallyEnabled = isEnabled("BARCODE_REWARDS_ENABLED");
  const rolloutPercent = Math.min(
    100,
    getNonNegativeInteger("BARCODE_REWARD_ROLLOUT_PERCENT", 0),
  );
  const salt =
    process.env.MONETIZATION_EXPERIMENT_SALT?.trim() || "monetization-v1";
  const bucket =
    createHmac("sha256", `${salt}:barcode-rewards-v1`)
      .update(ownerKey)
      .digest()
      .readUInt32BE(0) % 100;
  const inRewardCohort = bucket < rolloutPercent;

  return {
    enabled: globallyEnabled && inRewardCohort,
    cohort: inRewardCohort ? "reward" : "control",
    dailyLimit: getNonNegativeInteger("BARCODE_REWARD_DAILY_LIMIT", 3),
    balanceLimit: getNonNegativeInteger("BARCODE_REWARD_BALANCE_LIMIT", 10),
  };
}

export function barcodeRewardsGloballyEnabled() {
  return isEnabled("BARCODE_REWARDS_ENABLED");
}

function getNonNegativeInteger(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function isEnabled(name: string) {
  return process.env[name]?.trim().toLowerCase() === "true";
}
