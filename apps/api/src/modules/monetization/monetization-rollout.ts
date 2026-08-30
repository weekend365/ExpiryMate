import { createHmac } from "node:crypto";

export function isStableMonetizationRolloutEnabled(input: {
  subjectKey: string;
  enabledFlag: string;
  rolloutFlag: string;
  experimentKey: string;
}) {
  return isSubjectInStableRollout({
    subjectKey: input.subjectKey,
    enabled: isEnabled(process.env[input.enabledFlag]),
    percent: readPercentage(process.env[input.rolloutFlag]),
    experimentKey: input.experimentKey,
  });
}

export function isSubjectInStableRollout(input: {
  subjectKey: string;
  enabled: boolean;
  percent: number;
  experimentKey: string;
}) {
  if (!input.enabled) return false;
  const percent = input.percent;
  if (percent <= 0) return false;
  if (percent >= 100) return true;
  const salt =
    process.env.MONETIZATION_EXPERIMENT_SALT?.trim() || "monetization-v1";
  const bucket =
    createHmac("sha256", salt)
      .update(`${input.experimentKey}:${input.subjectKey}`)
      .digest()
      .readUInt32BE(0) % 100;
  return bucket < percent;
}

function isEnabled(value: string | undefined) {
  return ["1", "true", "yes", "on"].includes(value?.trim().toLowerCase() ?? "");
}

function readPercentage(value: string | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 100 ? parsed : 0;
}
