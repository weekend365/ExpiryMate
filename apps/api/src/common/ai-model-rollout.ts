import { createHash } from "node:crypto";

export function selectAiModel(ownerKey: string, feature: string, control: string, candidate: string | undefined, percent: number) {
  const bucket = createHash("sha256").update(`${feature}:${ownerKey}`).digest().readUInt32BE(0) % 100;
  return candidate && bucket < percent
    ? { model: candidate, variant: "candidate" as const }
    : { model: control, variant: "control" as const };
}

export function readCandidatePercent(raw: string | undefined) {
  const value = Number(raw ?? 0);
  return Number.isInteger(value) && value >= 0 && value <= 100 ? value : 0;
}
