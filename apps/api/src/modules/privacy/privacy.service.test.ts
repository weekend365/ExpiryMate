import { PreconditionFailedException } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PrivacyService } from "./privacy.service";

describe("PrivacyService", () => {
  const originalAiDataNoticeVersion = process.env.AI_DATA_NOTICE_VERSION;

  beforeEach(() => {
    process.env.AI_DATA_NOTICE_VERSION = "test-ai-notice-v2";
  });

  afterEach(() => {
    process.env.AI_DATA_NOTICE_VERSION = originalAiDataNoticeVersion;
  });

  it("rejects recipe generation when the current AI notice was not accepted", async () => {
    const service = new PrivacyService(
      createPrismaMock({
        aiDataNoticeAcceptedAt: null,
        aiDataNoticeVersion: null,
      }) as never,
    );

    await expect(service.ensureAiDataNoticeAccepted("user_1")).rejects.toThrow(
      PreconditionFailedException,
    );
  });

  it("allows recipe generation when the current AI notice was accepted", async () => {
    const service = new PrivacyService(
      createPrismaMock({
        aiDataNoticeAcceptedAt: new Date("2026-06-03T00:00:00.000Z"),
        aiDataNoticeVersion: "test-ai-notice-v2",
      }) as never,
    );

    await expect(
      service.ensureAiDataNoticeAccepted("user_1"),
    ).resolves.toBeUndefined();
  });

  it("deletes owned data and anonymizes the account shell", async () => {
    const operations: string[] = [];
    const updatedUsers: unknown[] = [];
    const service = new PrivacyService(
      createPrismaMock(
        {
          aiDataNoticeAcceptedAt: new Date("2026-06-03T00:00:00.000Z"),
          aiDataNoticeVersion: "test-ai-notice-v2",
        },
        operations,
        updatedUsers,
      ) as never,
    );

    const response = await service.deleteAccount("user_1");

    expect(response.ok).toBe(true);
    expect(operations).toEqual([
      "inventoryItem.deleteMany",
      "recipeRecommendation.deleteMany",
      "subscriptionEntitlement.deleteMany",
      "notificationPreference.deleteMany",
      "refreshSession.deleteMany",
      "oneTimeAuthToken.deleteMany",
      "oAuthAccount.deleteMany",
      "passwordCredential.deleteMany",
      "user.update",
    ]);
    expect(updatedUsers[0]).toMatchObject({
      data: {
        email: null,
        displayName: null,
        emailVerifiedAt: null,
        aiDataNoticeAcceptedAt: null,
        aiDataNoticeVersion: null,
      },
    });
  });
});

function createPrismaMock(
  userState: {
    aiDataNoticeAcceptedAt: Date | null;
    aiDataNoticeVersion: string | null;
  },
  operations: string[] = [],
  updatedUsers: unknown[] = [],
) {
  const user = {
    id: "user_1",
    mergedIntoUserId: null,
    deletedAt: null,
    ...userState,
  };
  const tx = {
    inventoryItem: createDeleteManyMock("inventoryItem.deleteMany", operations),
    recipeRecommendation: createDeleteManyMock(
      "recipeRecommendation.deleteMany",
      operations,
    ),
    subscriptionEntitlement: createDeleteManyMock(
      "subscriptionEntitlement.deleteMany",
      operations,
    ),
    notificationPreference: createDeleteManyMock(
      "notificationPreference.deleteMany",
      operations,
    ),
    refreshSession: createDeleteManyMock("refreshSession.deleteMany", operations),
    oneTimeAuthToken: createDeleteManyMock(
      "oneTimeAuthToken.deleteMany",
      operations,
    ),
    oAuthAccount: createDeleteManyMock("oAuthAccount.deleteMany", operations),
    passwordCredential: createDeleteManyMock(
      "passwordCredential.deleteMany",
      operations,
    ),
    user: {
      update: async (payload: unknown) => {
        operations.push("user.update");
        updatedUsers.push(payload);
        return user;
      },
    },
  };

  return {
    user: {
      findUnique: async () => user,
      update: async () => user,
    },
    $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) =>
      callback(tx),
  };
}

function createDeleteManyMock(name: string, operations: string[]) {
  return {
    deleteMany: async () => {
      operations.push(name);
      return { count: 1 };
    },
  };
}
