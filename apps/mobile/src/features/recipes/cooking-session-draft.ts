import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ConsumptionChoice, ConsumptionMode } from "./cooking";

const COOKING_SESSION_DRAFT_VERSION = 1;
export const COOKING_SESSION_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

export type CookingSessionDraftState = {
  currentIndex: number;
  checkedPrepKeys: string[];
  completedCookingSteps: number[];
  consumptionChoices: Record<string, ConsumptionChoice>;
};

export type CookingSessionDraft = CookingSessionDraftState & {
  version: typeof COOKING_SESSION_DRAFT_VERSION;
  updatedAt: number;
};

const CONSUMPTION_MODES = new Set<ConsumptionMode>([
  "skip",
  "recommended",
  "full",
  "half",
  "custom",
]);

export function getCookingSessionDraftKey(
  ownerKey: string,
  spaceId: string,
  recommendationId: string,
  dishIndex: number,
) {
  return [
    "expirymate:cooking-session:v1",
    encodeURIComponent(ownerKey),
    encodeURIComponent(spaceId),
    encodeURIComponent(recommendationId),
    dishIndex,
  ].join(":");
}

function isConsumptionChoice(value: unknown): value is ConsumptionChoice {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<ConsumptionChoice>;
  return (
    typeof candidate.mode === "string" &&
    CONSUMPTION_MODES.has(candidate.mode as ConsumptionMode) &&
    typeof candidate.amountBase === "number" &&
    Number.isFinite(candidate.amountBase) &&
    candidate.amountBase >= 0 &&
    (candidate.selectedInventoryItemId === null ||
      typeof candidate.selectedInventoryItemId === "string")
  );
}

function isCookingSessionDraft(value: unknown): value is CookingSessionDraft {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<CookingSessionDraft>;
  return (
    candidate.version === COOKING_SESSION_DRAFT_VERSION &&
    typeof candidate.updatedAt === "number" &&
    Number.isFinite(candidate.updatedAt) &&
    typeof candidate.currentIndex === "number" &&
    Number.isInteger(candidate.currentIndex) &&
    candidate.currentIndex >= 0 &&
    Array.isArray(candidate.checkedPrepKeys) &&
    candidate.checkedPrepKeys.every((key) => typeof key === "string") &&
    Array.isArray(candidate.completedCookingSteps) &&
    candidate.completedCookingSteps.every(
      (index) => Number.isInteger(index) && index >= 0,
    ) &&
    Boolean(candidate.consumptionChoices) &&
    typeof candidate.consumptionChoices === "object" &&
    Object.values(candidate.consumptionChoices).every(isConsumptionChoice)
  );
}

export function decodeCookingSessionDraft(
  stored: string | null,
  now = Date.now(),
) {
  if (!stored) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(stored);
    if (!isCookingSessionDraft(parsed)) {
      return null;
    }
    const age = now - parsed.updatedAt;
    return age >= 0 && age <= COOKING_SESSION_DRAFT_TTL_MS ? parsed : null;
  } catch {
    return null;
  }
}

export async function loadCookingSessionDraft(key: string) {
  const stored = await AsyncStorage.getItem(key);
  const draft = decodeCookingSessionDraft(stored);
  if (stored && !draft) {
    await AsyncStorage.removeItem(key);
  }
  return draft;
}

export async function saveCookingSessionDraft(
  key: string,
  state: CookingSessionDraftState,
) {
  const draft: CookingSessionDraft = {
    ...state,
    version: COOKING_SESSION_DRAFT_VERSION,
    updatedAt: Date.now(),
  };
  await AsyncStorage.setItem(key, JSON.stringify(draft));
  return draft;
}

export function clearCookingSessionDraft(key: string) {
  return AsyncStorage.removeItem(key);
}
