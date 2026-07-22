import {
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { getKstDayStart } from "@expirymate/shared";
import { PrismaService } from "../../database/prisma.service";

const DEFAULT_RATE_LIMIT_MAX = 3;
const DEFAULT_RATE_LIMIT_WINDOW_SECONDS = 60;
const DEFAULT_DAILY_QUOTA = 20;
const DEFAULT_DAILY_COST_LIMIT_USD = 1;
const DEFAULT_GLOBAL_DAILY_COST_LIMIT_USD = 10;
const DEFAULT_MAX_INFLIGHT = 5;

/**
 * Recipe generation limits (rate / quota / spend / inflight).
 * Daily windows use KST midnight via shared `getKstDayStart` (P2-04).
 */
@Injectable()
export class RecipePolicyService {
  private readonly rateLimitHitsByOwner = new Map<string, number[]>();
  private inflightGenerations = 0;

  constructor(private readonly prisma: PrismaService) {}

  ensureAiEnabled() {
    const raw = process.env.RECIPE_AI_ENABLED?.trim().toLowerCase();
    if (raw === "false" || raw === "0" || raw === "off") {
      throw new ServiceUnavailableException(
        "지금은 레시피 추천을 잠시 쉬고 있어요. 조금 뒤에 다시 시도해 주세요.",
      );
    }
  }

  enforceRateLimit(ownerKey: string, now: Date) {
    const maxRequests = getNonNegativeIntegerEnv(
      "RECIPE_RATE_LIMIT_MAX",
      DEFAULT_RATE_LIMIT_MAX,
    );
    const windowSeconds = getNonNegativeIntegerEnv(
      "RECIPE_RATE_LIMIT_WINDOW_SECONDS",
      DEFAULT_RATE_LIMIT_WINDOW_SECONDS,
    );

    if (maxRequests === 0 || windowSeconds === 0) {
      return;
    }

    const nowMs = now.getTime();
    const cutoffMs = nowMs - windowSeconds * 1000;
    const hits = (this.rateLimitHitsByOwner.get(ownerKey) ?? []).filter(
      (timestamp) => timestamp > cutoffMs,
    );

    if (hits.length >= maxRequests) {
      throw new HttpException(
        "추천 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    hits.push(nowMs);
    this.rateLimitHitsByOwner.set(ownerKey, hits);
  }

  async enforceDailyQuota(ownerKey: string, now: Date) {
    const dailyQuota = getNonNegativeIntegerEnv(
      "RECIPE_DAILY_QUOTA",
      DEFAULT_DAILY_QUOTA,
    );

    if (dailyQuota === 0) {
      return;
    }

    const usedToday = await this.prisma.recipeRecommendation.count({
      where: {
        ownerKey,
        aiProvider: "openai",
        createdAt: {
          gte: getKstDayStart(now),
        },
      },
    });

    if (usedToday >= dailyQuota) {
      throw new HttpException(
        "오늘의 추천 생성 한도를 모두 사용했습니다.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async enforceDailyCostLimit(
    ownerKey: string,
    projectedCostUsd: number,
    now: Date,
  ) {
    const dailyCostLimitUsd = getNonNegativeNumberEnv(
      "RECIPE_DAILY_COST_LIMIT_USD",
      DEFAULT_DAILY_COST_LIMIT_USD,
    );

    if (dailyCostLimitUsd === 0) {
      return;
    }

    const aggregate = await this.prisma.recipeRecommendation.aggregate({
      _sum: {
        estimatedCostUsd: true,
      },
      where: {
        ownerKey,
        aiProvider: "openai",
        createdAt: {
          gte: getKstDayStart(now),
        },
      },
    });
    const spentToday = decimalToNumber(aggregate._sum.estimatedCostUsd);

    if (spentToday + projectedCostUsd > dailyCostLimitUsd) {
      throw new HttpException(
        "오늘의 추천 생성 예산을 모두 사용했습니다.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async enforceGlobalDailyCostLimit(projectedCostUsd: number, now: Date) {
    const globalDailyCostLimitUsd = getNonNegativeNumberEnv(
      "RECIPE_GLOBAL_DAILY_COST_LIMIT_USD",
      DEFAULT_GLOBAL_DAILY_COST_LIMIT_USD,
    );

    if (globalDailyCostLimitUsd === 0) {
      return;
    }

    const aggregate = await this.prisma.recipeRecommendation.aggregate({
      _sum: {
        estimatedCostUsd: true,
      },
      where: {
        aiProvider: "openai",
        createdAt: {
          gte: getKstDayStart(now),
        },
      },
    });
    const spentToday = decimalToNumber(aggregate._sum.estimatedCostUsd);

    if (spentToday + projectedCostUsd > globalDailyCostLimitUsd) {
      throw new HttpException(
        "오늘은 추천 요청이 많았어요. 내일 다시 부탁해 주세요.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async withInflightLimit<T>(run: () => Promise<T>): Promise<T> {
    const maxInflight = getNonNegativeIntegerEnv(
      "RECIPE_MAX_INFLIGHT",
      DEFAULT_MAX_INFLIGHT,
    );

    if (maxInflight === 0) {
      return run();
    }

    if (this.inflightGenerations >= maxInflight) {
      throw new HttpException(
        "지금 추천을 기다리는 분이 많아요. 잠시 후 다시 시도해 주세요.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    this.inflightGenerations += 1;
    try {
      return await run();
    } finally {
      this.inflightGenerations = Math.max(0, this.inflightGenerations - 1);
    }
  }
}

function getNonNegativeIntegerEnv(name: string, fallback: number) {
  return Math.floor(getNonNegativeNumberEnv(name, fallback));
}

function getNonNegativeNumberEnv(name: string, fallback: number) {
  const raw = process.env[name];

  if (!raw) {
    return fallback;
  }

  const value = Number(raw);

  if (!Number.isFinite(value) || value < 0) {
    return fallback;
  }

  return value;
}

function decimalToNumber(value: { toNumber?: () => number } | number | string | null) {
  if (value == null) {
    return 0;
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (typeof value.toNumber === "function") {
    return value.toNumber();
  }

  return 0;
}
