import { ExpirySource } from "@expirymate/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
  },
}));

describe("registration store space scoping", () => {
  beforeEach(async () => {
    const { useRegistrationStore } = await import("./registration-store");
    useRegistrationStore.setState({
      prefills: {},
      drafts: {},
      lastStorageLocations: {},
      preferredEntryMethods: {},
      photoDrafts: {},
      rewardNotice: null,
    });
  });

  it("remembers the preferred method and photo draft per space", async () => {
    const {
      photoDraftForSpace,
      preferredEntryMethodForSpace,
      useRegistrationStore,
    } = await import("./registration-store");
    const spaceId = "space-house";
    const store = useRegistrationStore.getState();

    store.setPreferredEntryMethod(spaceId, "photo");
    store.setPhotoDraft(spaceId, [
      {
        localId: "draft-1",
        displayName: "우유",
        quantity: 1,
        unit: "개",
        unitCode: undefined,
        storageLocation: "fridge",
        expiryDate: null,
        expirySource: ExpirySource.UNKNOWN,
        needsReview: false,
      },
    ]);

    const state = useRegistrationStore.getState();
    expect(preferredEntryMethodForSpace(state, spaceId)).toBe("photo");
    expect(photoDraftForSpace(state, spaceId)?.[0]?.displayName).toBe("우유");

    store.clearPhotoDraft(spaceId);
    expect(photoDraftForSpace(useRegistrationStore.getState(), spaceId)).toBeNull();
  });

  it("keeps draft and last location isolated per space", async () => {
    const {
      draftForSpace,
      lastStorageLocationForSpace,
      prefillForSpace,
      useRegistrationStore,
    } = await import("./registration-store");
    const personal = "personal_user-a";
    const household = "space-house";

    useRegistrationStore.getState().setDraft(personal, {
      displayName: "우유",
      storageLocation: "fridge",
    });
    useRegistrationStore.getState().setLastStorageLocation(personal, "fridge");
    useRegistrationStore.getState().setPrefill(household, {
      displayName: "계란",
    });
    useRegistrationStore.getState().setDraft(household, {
      displayName: "계란",
      storageLocation: "custom_pantry",
    });
    useRegistrationStore
      .getState()
      .setLastStorageLocation(household, "custom_pantry");

    const state = useRegistrationStore.getState();
    expect(draftForSpace(state, personal)?.displayName).toBe("우유");
    expect(lastStorageLocationForSpace(state, personal)).toBe("fridge");
    expect(prefillForSpace(state, personal)).toBeNull();
    expect(draftForSpace(state, household)?.storageLocation).toBe(
      "custom_pantry",
    );
    expect(lastStorageLocationForSpace(state, household)).toBe("custom_pantry");
    expect(prefillForSpace(state, household)?.displayName).toBe("계란");
  });

  it("clears one space without wiping the other", async () => {
    const { draftForSpace, useRegistrationStore } = await import(
      "./registration-store"
    );
    const personal = "personal_user-a";
    const household = "space-house";
    const store = useRegistrationStore.getState();

    store.setDraft(personal, { displayName: "우유" });
    store.setDraft(household, { displayName: "계란" });
    store.clearDraft(household);

    const state = useRegistrationStore.getState();
    expect(draftForSpace(state, personal)?.displayName).toBe("우유");
    expect(draftForSpace(state, household)).toBeNull();
  });

  it("clears every space when logout passes no id", async () => {
    const { draftForSpace, prefillForSpace, useRegistrationStore } =
      await import("./registration-store");
    const store = useRegistrationStore.getState();

    store.setDraft("space-a", { displayName: "우유" });
    store.setPrefill("space-b", { displayName: "계란" });
    store.clearDraft();
    store.clearPrefill();

    const state = useRegistrationStore.getState();
    expect(draftForSpace(state, "space-a")).toBeNull();
    expect(prefillForSpace(state, "space-b")).toBeNull();
  });
});
