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

  it("revokes AI notice acceptance without deleting recommendation history", async () => {
    const userUpdates: unknown[] = [];
    const service = new PrivacyService(
      createPrismaMock(
        {
          aiDataNoticeAcceptedAt: new Date("2026-06-03T00:00:00.000Z"),
          aiDataNoticeVersion: "test-ai-notice-v2",
        },
        [],
        [],
        [],
        userUpdates,
        3,
      ) as never,
    );

    const response = await service.revokeAiDataNotice("user_1");

    expect(response.ok).toBe(true);
    expect(response.status.hasAcceptedCurrentAiDataNotice).toBe(false);
    expect(response.status.recommendationHistoryCount).toBe(3);
    expect(userUpdates[0]).toMatchObject({
      data: {
        aiDataNoticeAcceptedAt: null,
        aiDataNoticeVersion: null,
      },
    });
  });

  it("deletes recommendation history and returns the remaining count", async () => {
    const operations: string[] = [];
    const service = new PrivacyService(
      createPrismaMock(
        {
          aiDataNoticeAcceptedAt: new Date("2026-06-03T00:00:00.000Z"),
          aiDataNoticeVersion: "test-ai-notice-v2",
        },
        operations,
        [],
        [],
        [],
        2,
      ) as never,
    );

    const response = await service.deleteRecommendationHistory("user_1");

    expect(response).toEqual({
      ok: true,
      deletedCount: 2,
      status: expect.objectContaining({
        hasAcceptedCurrentAiDataNotice: true,
        recommendationHistoryCount: 0,
      }),
    });
    expect(operations).toContain("recipeRecommendation.deleteMany");
  });

  it("deletes owned data and anonymizes the account shell", async () => {
    const operations: string[] = [];
    const updatedUsers: unknown[] = [];
    const productMasterUpdates: unknown[] = [];
    const service = new PrivacyService(
      createPrismaMock(
        {
          aiDataNoticeAcceptedAt: new Date("2026-06-03T00:00:00.000Z"),
          aiDataNoticeVersion: "test-ai-notice-v2",
        },
        operations,
        updatedUsers,
        productMasterUpdates,
      ) as never,
    );

    const response = await service.deleteAccount("user_1");

    expect(response.ok).toBe(true);
    expect(operations).toEqual([
      "pushNotificationDelivery.deleteMany",
      "pushToken.deleteMany",
      "inventoryItem.deleteMany",
      "recipeRecommendation.deleteMany",
      "subscriptionEntitlement.deleteMany",
      "notificationPreference.deleteMany",
      "refreshSession.deleteMany",
      "oneTimeAuthToken.deleteMany",
      "oAuthAccount.deleteMany",
      "passwordCredential.deleteMany",
      "productMaster.updateMany",
      "user.update",
    ]);
    expect(productMasterUpdates[0]).toEqual({
      where: { contributedByUserId: "user_1" },
      data: { contributedByUserId: null },
    });
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
  productMasterUpdates: unknown[] = [],
  topLevelUserUpdates: unknown[] = [],
  recommendationCount = 0,
) {
  let remainingRecommendations = recommendationCount;
  const user = {
    id: "user_1",
    mergedIntoUserId: null,
    deletedAt: null,
    ...userState,
  };
  const tx = {
    pushNotificationDelivery: createDeleteManyMock(
      "pushNotificationDelivery.deleteMany",
      operations,
    ),
    pushToken: createDeleteManyMock("pushToken.deleteMany", operations),
    inventoryItem: createDeleteManyMock("inventoryItem.deleteMany", operations),
    recipeRecommendation: createDeleteManyMock(
      "recipeRecommendation.deleteMany",
      operations,
      () => {
        const deleted = remainingRecommendations;
        remainingRecommendations = 0;
        return deleted;
      },
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
    productMaster: {
      updateMany: async (payload: unknown) => {
        operations.push("productMaster.updateMany");
        productMasterUpdates.push(payload);
        return { count: 1 };
      },
    },
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
      update: async (payload: unknown) => {
        topLevelUserUpdates.push(payload);
        if (
          payload &&
          typeof payload === "object" &&
          "data" in payload &&
          payload.data &&
          typeof payload.data === "object"
        ) {
          Object.assign(user, payload.data);
        }
        return {
          aiDataNoticeAcceptedAt: user.aiDataNoticeAcceptedAt,
          aiDataNoticeVersion: user.aiDataNoticeVersion,
        };
      },
    },
    recipeRecommendation: {
      count: async () => remainingRecommendations,
      deleteMany: async () => {
        operations.push("recipeRecommendation.deleteMany");
        const deleted = remainingRecommendations;
        remainingRecommendations = 0;
        return { count: deleted };
      },
    },
    $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) =>
      callback(tx),
  };
}

function createDeleteManyMock(
  name: string,
  operations: string[],
  countFactory?: () => number,
) {
  return {
    deleteMany: async () => {
      operations.push(name);
      return { count: countFactory ? countFactory() : 1 };
    },
  };
}
