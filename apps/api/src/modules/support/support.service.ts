import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  SupportInquiryCategory,
  SupportInquiryStatus,
  supportInquiryCategoryLabels,
  type SupportInquiry,
  type SupportInquiryCreateInput,
  type SupportInquiryListResponse,
} from "@expirymate/shared";
import {
  SupportInquiryCategory as PrismaSupportInquiryCategory,
  SupportInquiryStatus as PrismaSupportInquiryStatus,
} from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { MailService } from "../auth/mail.service";

const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 50;

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);
  private readonly rateLimitHitsByUser = new Map<string, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async createInquiry(userId: string, input: SupportInquiryCreateInput) {
    this.enforceRateLimit(userId);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, displayName: true },
    });

    if (!user) {
      throw new NotFoundException("계정을 찾지 못했어요.");
    }

    const record = await this.prisma.supportInquiry.create({
      data: {
        userId,
        category: input.category as PrismaSupportInquiryCategory,
        body: input.body,
        appVersion: input.appVersion?.trim() || null,
        platform: input.platform?.trim() || null,
        status: PrismaSupportInquiryStatus.open,
      },
      include: {
        user: {
          select: { email: true, displayName: true },
        },
      },
    });

    const inbox =
      process.env.SUPPORT_INBOX_EMAIL?.trim() ||
      process.env.PRIVACY_CONTACT_EMAIL?.trim();

    if (inbox) {
      try {
        await this.mailService.sendSupportInquiryAlert({
          to: inbox,
          inquiryId: record.id,
          categoryLabel:
            supportInquiryCategoryLabels[
              record.category as SupportInquiryCategory
            ] ?? record.category,
          body: record.body,
          userId: record.userId,
          userEmail: record.user.email,
          createdAt: record.createdAt,
        });
      } catch (error) {
        this.logger.error(
          `Support inquiry mail failed for ${record.id}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    } else {
      this.logger.warn(
        `SUPPORT_INBOX_EMAIL/PRIVACY_CONTACT_EMAIL missing; skipped mail for ${record.id}`,
      );
    }

    return this.serialize(record);
  }

  async listInquiries(params: {
    page?: number;
    limit?: number;
    status?: string;
    category?: string;
  }): Promise<SupportInquiryListResponse> {
    const page = Math.max(1, Math.floor(params.page ?? 1) || 1);
    const limit = Math.min(
      MAX_LIST_LIMIT,
      Math.max(1, Math.floor(params.limit ?? DEFAULT_LIST_LIMIT) || DEFAULT_LIST_LIMIT),
    );

    const where: {
      status?: PrismaSupportInquiryStatus;
      category?: PrismaSupportInquiryCategory;
    } = {};

    if (
      params.status &&
      Object.values(SupportInquiryStatus).includes(
        params.status as SupportInquiryStatus,
      )
    ) {
      where.status = params.status as PrismaSupportInquiryStatus;
    }

    if (
      params.category &&
      Object.values(SupportInquiryCategory).includes(
        params.category as SupportInquiryCategory,
      )
    ) {
      where.category = params.category as PrismaSupportInquiryCategory;
    }

    const [totalCount, rows] = await this.prisma.$transaction([
      this.prisma.supportInquiry.count({ where }),
      this.prisma.supportInquiry.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: { email: true, displayName: true },
          },
        },
      }),
    ]);

    return {
      items: rows.map((row) => this.serialize(row)),
      page,
      limit,
      totalCount,
      hasMore: page * limit < totalCount,
    };
  }

  async closeInquiry(id: string): Promise<SupportInquiry> {
    const existing = await this.prisma.supportInquiry.findUnique({
      where: { id },
      include: {
        user: {
          select: { email: true, displayName: true },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException("문의를 찾지 못했어요.");
    }

    const record = await this.prisma.supportInquiry.update({
      where: { id },
      data: { status: PrismaSupportInquiryStatus.closed },
      include: {
        user: {
          select: { email: true, displayName: true },
        },
      },
    });

    return this.serialize(record);
  }

  private enforceRateLimit(userId: string) {
    const now = Date.now();
    const cutoff = now - RATE_LIMIT_WINDOW_MS;
    const hits = (this.rateLimitHitsByUser.get(userId) ?? []).filter(
      (timestamp) => timestamp > cutoff,
    );

    if (hits.length >= RATE_LIMIT_MAX) {
      throw new HttpException(
        "문의가 너무 자주 들어왔어요. 잠시 뒤에 다시 부탁해 주세요.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    hits.push(now);
    this.rateLimitHitsByUser.set(userId, hits);
  }

  private serialize(record: {
    id: string;
    userId: string;
    category: string;
    body: string;
    appVersion: string | null;
    platform: string | null;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    user?: { email: string | null; displayName: string | null };
  }): SupportInquiry {
    return {
      id: record.id,
      userId: record.userId,
      userEmail: record.user?.email ?? null,
      userDisplayName: record.user?.displayName ?? null,
      category: record.category as SupportInquiryCategory,
      body: record.body,
      appVersion: record.appVersion,
      platform: record.platform,
      status: record.status as SupportInquiryStatus,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
