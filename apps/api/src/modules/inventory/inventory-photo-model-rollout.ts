import type { InventoryPhotoParseScene } from "@expirymate/shared";
import { readCandidatePercent, selectAiModel } from "../../common/ai-model-rollout";

export function selectPhotoModel(ownerKey: string, scene: InventoryPhotoParseScene, env: NodeJS.ProcessEnv = process.env) {
  return selectAiModel(ownerKey, `inventory-photo-model-v1:${scene}`,
    env.INVENTORY_PHOTO_PARSE_MODEL?.trim() || "gpt-5.6-luna",
    env.INVENTORY_PHOTO_PARSE_CANDIDATE_MODEL?.trim(),
    readCandidatePercent(env.INVENTORY_PHOTO_PARSE_CANDIDATE_PERCENT));
}
