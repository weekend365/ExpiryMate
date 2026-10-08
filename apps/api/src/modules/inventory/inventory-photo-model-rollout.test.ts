import { describe, expect, it } from "vitest";
import { selectPhotoModel } from "./inventory-photo-model-rollout";

describe("photo model rollout", () => {
  const env = { INVENTORY_PHOTO_PARSE_MODEL: "gpt-4.1-mini", INVENTORY_PHOTO_PARSE_CANDIDATE_MODEL: "gpt-6-luna" };
  it("preserves control by default and for invalid percentages", () => {
    for (const percent of [undefined, "0", "-1", "101", "NaN", "0.5"]) expect(selectPhotoModel("owner", "receipt", { ...env, INVENTORY_PHOTO_PARSE_CANDIDATE_PERCENT: percent })).toEqual({ model: "gpt-4.1-mini", variant: "control" });
  });
  it("keeps owners stable and supports a complete opt-in", () => {
    const partial = { ...env, INVENTORY_PHOTO_PARSE_CANDIDATE_PERCENT: "25" };
    expect(selectPhotoModel("owner", "fridge", partial)).toEqual(selectPhotoModel("owner", "fridge", partial));
    expect(selectPhotoModel("owner", "receipt", { ...env, INVENTORY_PHOTO_PARSE_CANDIDATE_PERCENT: "100" })).toEqual({ model: "gpt-6-luna", variant: "candidate" });
  });
});
