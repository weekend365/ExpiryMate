import { HttpException, HttpStatus } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SupportInquiryCategory } from "@expirymate/shared";
import { SupportService } from "./support.service";

describe("SupportService", () => {
  const prisma = {
    user: {
      findUnique: vi.fn(),
    },
    supportInquiry: {
      create: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  const mailService = {
    sendSupportInquiryAlert: vi.fn(),
  };

  let service: SupportService;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPPORT_INBOX_EMAIL = "support@example.com";
    service = new SupportService(prisma as never, mailService as never);

    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      displayName: "테스터",
    });
    prisma.supportInquiry.create.mockImplementation(async ({ data }) => ({
      id: "inquiry-1",
      userId: data.userId,
      category: data.category,
      body: data.body,
      appVersion: data.appVersion,
      platform: data.platform,
      status: data.status,
      createdAt: new Date("2026-07-23T00:00:00.000Z"),
      updatedAt: new Date("2026-07-23T00:00:00.000Z"),
      user: {
        email: "user@example.com",
        displayName: "테스터",
      },
    }));
  });

  it("creates an inquiry and notifies the inbox", async () => {
    const result = await service.createInquiry("user-1", {
      category: SupportInquiryCategory.BUG,
      body: "알림이 오지 않아요. 설정은 켜 두었어요.",
      platform: "ios",
      appVersion: "1.0.0",
    });

    expect(result.id).toBe("inquiry-1");
    expect(mailService.sendSupportInquiryAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "support@example.com",
        inquiryId: "inquiry-1",
        userId: "user-1",
      }),
    );
  });

  it("still returns the ticket when mail delivery fails", async () => {
    mailService.sendSupportInquiryAlert.mockRejectedValueOnce(
      new Error("smtp down"),
    );

    await expect(
      service.createInquiry("user-1", {
        category: SupportInquiryCategory.OTHER,
        body: "문의를 남기고 싶어요. 확인 부탁드려요.",
      }),
    ).resolves.toMatchObject({ id: "inquiry-1" });
  });

  it("rate-limits repeated creates from the same user", async () => {
    const payload = {
      category: SupportInquiryCategory.ACCOUNT,
      body: "로그인이 안 돼요. 도와주실 수 있을까요?",
    };

    await service.createInquiry("user-1", payload);
    await service.createInquiry("user-1", payload);
    await service.createInquiry("user-1", payload);

    await expect(service.createInquiry("user-1", payload)).rejects.toBeInstanceOf(
      HttpException,
    );

    try {
      await service.createInquiry("user-1", payload);
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  });

  it("lists inquiries for admin", async () => {
    prisma.$transaction.mockResolvedValue([
      1,
      [
        {
          id: "inquiry-1",
          userId: "user-1",
          category: "bug",
          body: "본문",
          appVersion: null,
          platform: "ios",
          status: "open",
          createdAt: new Date("2026-07-23T00:00:00.000Z"),
          updatedAt: new Date("2026-07-23T00:00:00.000Z"),
          user: { email: "user@example.com", displayName: "테스터" },
        },
      ],
    ]);

    const result = await service.listInquiries({ page: 1, limit: 20 });

    expect(result.totalCount).toBe(1);
    expect(result.items[0]?.userEmail).toBe("user@example.com");
    expect(result.hasMore).toBe(false);
  });
});
