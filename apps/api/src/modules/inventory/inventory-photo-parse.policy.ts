import {
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { getKstDayStart } from "@expirymate/shared";
import { CodedHttpException } from "../../common/coded-http.exception";
import { PrismaService } from "../../database/prisma.service";

const DEFAULT_RATE_LIMIT_MAX = 3;
const DEFAULT_RATE_LIMIT_WINDOW_SECONDS = 60;
const DEFAULT_DAILY_COST_LIMIT_USD = 1;
const DEFAULT_GLOBAL_DAILY_COST_LIMIT_USD = 10;
const DEFAULT_MAX_INFLIGHT = 3;

@Injectable()
export class InventoryPhotoParsePolicyService {
  private readonly rateLimitHitsByOwner = new Map<string, number[]>();
  private inflightParses = 0;

  constructor(private readonly prisma: PrismaService) {}

  ensureEnabled() {
    if (!isInventoryPhotoParseEnabled()) {
      throw new ServiceUnavailableException(
        "사진으로 넣는 기능은 아직 준비 중이에요.",
      );
    }
  }

  enforceRateLimit(ownerKey: string, now: Date) {
    const maxRequests = getNonNegativeIntegerEnv(
      "INVENTORY_PHOTO_PARSE_RATE_LIMIT_MAX",
      DEFAULT_RATE_LIMIT_MAX,
    );
    const windowSeconds = getNonNegativeIntegerEnv(
      "INVENTORY_PHOTO_PARSE_RATE_LIMIT_WINDOW_SECONDS",
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
        "사진을 너무 자주 보내고 있어요. 잠시 후 다시 해볼까요?",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    hits.push(nowMs);
    this.rateLimitHitsByOwner.set(ownerKey, hits);
  }

  async enforceDailyCostLimit(
    ownerKey: string,
    projectedCostUsd: number,
    now: Date,
  ) {
    const dailyCostLimitUsd = getNonNegativeNumberEnv(
      "INVENTORY_PHOTO_PARSE_DAILY_COST_LIMIT_USD",
      DEFAULT_DAILY_COST_LIMIT_USD,
    );

    if (dailyCostLimitUsd === 0) {
      return;
    }

    const spentToday = await this.sumCostUsd({
      ownerKey,
      since: getKstDayStart(now),
    });

    if (spentToday + projectedCostUsd > dailyCostLimitUsd) {
      throw new CodedHttpException(
        HttpStatus.TOO_MANY_REQUESTS,
        "INVENTORY_PHOTO_PARSE_DAILY_BUDGET_EXHAUSTED",
        "오늘은 사진 읽기를 조금 쉬어갈까요? 내일 다시 부탁해도 괜찮아요.",
        { reason: "owner_daily_cost_limit" },
      );
    }
  }

  async enforceGlobalDailyCostLimit(projectedCostUsd: number, now: Date) {
    const globalDailyCostLimitUsd = getNonNegativeNumberEnv(
      "INVENTORY_PHOTO_PARSE_GLOBAL_DAILY_COST_LIMIT_USD",
      DEFAULT_GLOBAL_DAILY_COST_LIMIT_USD,
    );

    if (globalDailyCostLimitUsd === 0) {
      return;
    }

    const spentToday = await this.sumCostUsd({
      since: getKstDayStart(now),
    });

    if (spentToday + projectedCostUsd > globalDailyCostLimitUsd) {
      throw new CodedHttpException(
        HttpStatus.TOO_MANY_REQUESTS,
        "INVENTORY_PHOTO_PARSE_SERVICE_CAPACITY_REACHED",
        "오늘은 사진 요청이 많았어요. 내일 다시 부탁해 주세요.",
        { reason: "global_daily_cost_limit" },
      );
    }
  }

  async withInflightLimit<T>(run: () => Promise<T>): Promise<T> {
    const maxInflight = getNonNegativeIntegerEnv(
      "INVENTORY_PHOTO_PARSE_MAX_INFLIGHT",
      DEFAULT_MAX_INFLIGHT,
    );

    if (maxInflight === 0) {
      return run();
    }

    if (this.inflightParses >= maxInflight) {
      throw new CodedHttpException(
        HttpStatus.TOO_MANY_REQUESTS,
        "INVENTORY_PHOTO_PARSE_SERVICE_CAPACITY_REACHED",
        "지금 사진을 읽는 중이 많아요. 잠시 후 다시 시도해 주세요.",
        { reason: "inflight_limit" },
      );
    }

    this.inflightParses += 1;
    try {
      return await run();
    } finally {
      this.inflightParses = Math.max(0, this.inflightParses - 1);
    }
  }

  private async sumCostUsd(where: { ownerKey?: string; since: Date }) {
    const aggregate = await this.prisma.inventoryPhotoParseEvent.aggregate({
      _sum: { estimatedCostUsd: true },
      where: {
        ownerKey: where.ownerKey,
        createdAt: { gte: where.since },
      },
    });

    return decimalToNumber(aggregate._sum.estimatedCostUsd);
  }
}

export function isInventoryPhotoParseEnabled() {
  const raw = process.env.INVENTORY_PHOTO_PARSE_ENABLED?.trim().toLowerCase();
  // Enabled by default; an explicit false/0/off value remains an operational
  // kill switch for API deployments.
  return raw !== "false" && raw !== "0" && raw !== "off";
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

function decimalToNumber(
  value: { toNumber?: () => number } | number | string | null,
) {
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
