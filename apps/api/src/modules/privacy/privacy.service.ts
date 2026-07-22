import {
  Injectable,
  PreconditionFailedException,
  UnauthorizedException,
} from "@nestjs/common";
import { AccountType, UserRole } from "@prisma/client";
import type {
  DeleteAccountResponse,
  DeleteRecommendationHistoryResponse,
  PrivacyStatus,
  RevokeAiDataNoticeResponse,
} from "@expirymate/shared";
import { PrismaService } from "../../database/prisma.service";

const DEFAULT_CONTACT_EMAIL = "privacy@expirymate.local";
/** Bumped in P1-12 when retention / transfer / withdrawal disclosures changed. */
const DEFAULT_AI_DATA_NOTICE_VERSION = "ai-data-notice-v2";

@Injectable()
export class PrivacyService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus(userId: string): Promise<PrivacyStatus> {
    const user = await this.findActiveUser(userId);
    const recommendationHistoryCount = await this.countRecommendationHistory(userId);

    return this.buildStatus({
      aiDataNoticeAcceptedAt: user.aiDataNoticeAcceptedAt,
      aiDataNoticeVersion: user.aiDataNoticeVersion,
      recommendationHistoryCount,
    });
  }

  async acceptAiDataNotice(userId: string) {
    await this.findActiveUser(userId);

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        aiDataNoticeAcceptedAt: new Date(),
        aiDataNoticeVersion: getAiDataNoticeVersion(),
      },
      select: {
        aiDataNoticeAcceptedAt: true,
        aiDataNoticeVersion: true,
      },
    });

    return {
      ok: true as const,
      status: this.buildStatus({
        ...user,
        recommendationHistoryCount: await this.countRecommendationHistory(userId),
      }),
    };
  }

  async revokeAiDataNotice(userId: string): Promise<RevokeAiDataNoticeResponse> {
    await this.findActiveUser(userId);

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        aiDataNoticeAcceptedAt: null,
        aiDataNoticeVersion: null,
      },
      select: {
        aiDataNoticeAcceptedAt: true,
        aiDataNoticeVersion: true,
      },
    });

    return {
      ok: true,
      status: this.buildStatus({
        ...user,
        recommendationHistoryCount: await this.countRecommendationHistory(userId),
      }),
    };
  }

  async deleteRecommendationHistory(
    userId: string,
  ): Promise<DeleteRecommendationHistoryResponse> {
    await this.findActiveUser(userId);

    const result = await this.prisma.recipeRecommendation.deleteMany({
      where: { ownerKey: userId },
    });

    return {
      ok: true,
      deletedCount: result.count,
      status: await this.getStatus(userId),
    };
  }

  async ensureAiDataNoticeAccepted(userId: string) {
    const status = await this.getStatus(userId);

    if (!status.hasAcceptedCurrentAiDataNotice) {
      throw new PreconditionFailedException(
        "AI 추천을 받으려면 AI 데이터 고지 동의가 필요합니다.",
      );
    }
  }

  async deleteAccount(userId: string): Promise<DeleteAccountResponse> {
    await this.findActiveUser(userId);

    const deletedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.pushNotificationDelivery.deleteMany({ where: { ownerKey: userId } });
      await tx.pushToken.deleteMany({ where: { ownerKey: userId } });
      await tx.inventoryItem.deleteMany({ where: { ownerKey: userId } });
      await tx.recipeRecommendation.deleteMany({ where: { ownerKey: userId } });
      await tx.subscriptionEntitlement.deleteMany({ where: { ownerKey: userId } });
      await tx.notificationPreference.deleteMany({ where: { ownerKey: userId } });
      await tx.refreshSession.deleteMany({ where: { userId } });
      await tx.oneTimeAuthToken.deleteMany({ where: { userId } });
      await tx.oAuthAccount.deleteMany({ where: { userId } });
      await tx.passwordCredential.deleteMany({ where: { userId } });
      // Keep shared barcode catalog rows, but drop the deleted user's identity.
      await tx.productMaster.updateMany({
        where: { contributedByUserId: userId },
        data: { contributedByUserId: null },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          email: null,
          displayName: null,
          role: UserRole.user,
          accountType: AccountType.anonymous,
          emailVerifiedAt: null,
          aiDataNoticeAcceptedAt: null,
          aiDataNoticeVersion: null,
          mergedIntoUserId: null,
          deletedAt,
        },
      });
    });

    return {
      ok: true,
      deletedAt: deletedAt.toISOString(),
    };
  }

  private async countRecommendationHistory(userId: string) {
    return this.prisma.recipeRecommendation.count({
      where: { ownerKey: userId },
    });
  }

  private async findActiveUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        mergedIntoUserId: true,
        deletedAt: true,
        aiDataNoticeAcceptedAt: true,
        aiDataNoticeVersion: true,
      },
    });

    if (!user || user.deletedAt || user.mergedIntoUserId) {
      throw new UnauthorizedException("로그인이 필요합니다.");
    }

    return user;
  }

  private buildStatus(user: {
    aiDataNoticeAcceptedAt: Date | null;
    aiDataNoticeVersion: string | null;
    recommendationHistoryCount: number;
  }): PrivacyStatus {
    const aiDataNoticeVersion = getAiDataNoticeVersion();

    return {
      privacyPolicyUrl: getPrivacyPolicyUrl(),
      privacyChoicesUrl: getPrivacyChoicesUrl(),
      contactEmail: process.env.PRIVACY_CONTACT_EMAIL ?? DEFAULT_CONTACT_EMAIL,
      aiDataNoticeVersion,
      aiDataNoticeAcceptedAt:
        user.aiDataNoticeAcceptedAt && user.aiDataNoticeVersion === aiDataNoticeVersion
          ? user.aiDataNoticeAcceptedAt.toISOString()
          : null,
      hasAcceptedCurrentAiDataNotice:
        Boolean(user.aiDataNoticeAcceptedAt) &&
        user.aiDataNoticeVersion === aiDataNoticeVersion,
      recommendationHistoryCount: user.recommendationHistoryCount,
    };
  }
}

function getAiDataNoticeVersion() {
  return process.env.AI_DATA_NOTICE_VERSION ?? DEFAULT_AI_DATA_NOTICE_VERSION;
}

function getPrivacyPolicyUrl() {
  return (
    process.env.PRIVACY_POLICY_URL ??
    `${getPublicBaseUrl()}/privacy`
  );
}

function getPrivacyChoicesUrl() {
  return (
    process.env.PRIVACY_CHOICES_URL ??
    `${getPublicBaseUrl()}/privacy/choices`
  );
}

function getPublicBaseUrl() {
  return (process.env.ADMIN_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
