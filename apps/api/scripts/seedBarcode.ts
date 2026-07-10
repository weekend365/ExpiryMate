import { PrismaClient } from "@prisma/client";

const API_KEY = process.env.FOODSAFETY_API_KEY?.trim();
const BASE_URL = "http://openapi.foodsafetykorea.go.kr/api";
const PAGE_SIZE = 1_000;
const REQUEST_DELAY_MS = 500;
const SUCCESS_CODE = "INFO-000";
const DEFAULT_BRAND = "알 수 없음";
const DEFAULT_CATEGORY = "기타";

type FoodSafetyResult = {
  CODE?: string;
  MSG?: string;
};

type FoodSafetyRow = {
  BAR_CD?: unknown;
  PRDLST_NM?: unknown;
  BSSH_NM?: unknown;
  PRDLST_DCNM?: unknown;
};

type FoodSafetyResponse = {
  C005?: {
    RESULT?: FoodSafetyResult;
    row?: unknown[];
    total_count?: string | number;
  };
  RESULT?: FoodSafetyResult;
};

type NormalizedProduct = {
  barcode: string;
  name: string;
  brand: string;
  category: string;
  source: "foodsafety_api";
};

const prisma = new PrismaClient();

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readString(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function normalizeProduct(row: FoodSafetyRow): NormalizedProduct | null {
  const barcode = readString(row.BAR_CD);
  const name = readString(row.PRDLST_NM);
  const brand = readString(row.BSSH_NM);
  const category = readString(row.PRDLST_DCNM);

  if (!barcode || /^0+$/.test(barcode) || !/^\d+$/.test(barcode)) {
    return null;
  }

  if (!name) {
    return null;
  }

  return {
    barcode,
    name,
    brand: brand || DEFAULT_BRAND,
    category: category || DEFAULT_CATEGORY,
    source: "foodsafety_api",
  };
}

function normalizeRows(rows: unknown[]) {
  const productByBarcode = new Map<string, NormalizedProduct>();
  let invalidCount = 0;
  let duplicateCount = 0;

  for (const row of rows) {
    const product = normalizeProduct(row as FoodSafetyRow);

    if (!product) {
      invalidCount += 1;
      continue;
    }

    if (productByBarcode.has(product.barcode)) {
      duplicateCount += 1;
    }

    productByBarcode.set(product.barcode, product);
  }

  return {
    products: [...productByBarcode.values()],
    invalidCount,
    duplicateCount,
  };
}

function getApiResult(payload: FoodSafetyResponse) {
  return payload.C005?.RESULT ?? payload.RESULT;
}

async function fetchPage(startIdx: number, endIdx: number) {
  if (!API_KEY) {
    throw new Error("FOODSAFETY_API_KEY 환경변수가 필요합니다.");
  }

  const url = `${BASE_URL}/${encodeURIComponent(API_KEY)}/C005/json/${startIdx}/${endIdx}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`식품안전나라 API 요청 실패: HTTP ${response.status}`);
  }

  return (await response.json()) as FoodSafetyResponse;
}

async function upsertProducts(products: NormalizedProduct[], page: number) {
  let upsertedCount = 0;

  for (const [index, product] of products.entries()) {
    await prisma.productMaster.upsert({
      where: {
        barcode: product.barcode,
      },
      create: product,
      update: {
        name: product.name,
        category: product.category,
        source: product.source,
      },
    });

    upsertedCount += 1;

    if (upsertedCount % 100 === 0 || upsertedCount === products.length) {
      console.info(
        `[page ${page}] DB upsert ${index + 1}/${products.length}건 완료`,
      );
    }
  }

  return upsertedCount;
}

async function main() {
  let page = 1;
  let startIdx = 1;
  let totalFetched = 0;
  let totalValid = 0;
  let totalInvalid = 0;
  let totalDuplicates = 0;
  let totalUpserted = 0;

  while (true) {
    const endIdx = startIdx + PAGE_SIZE - 1;
    console.info(`[page ${page}] API 요청: ${startIdx}~${endIdx}`);

    const payload = await fetchPage(startIdx, endIdx);
    const result = getApiResult(payload);
    const resultCode = result?.CODE?.trim();
    const resultMessage = result?.MSG?.trim();

    if (resultCode && resultCode !== SUCCESS_CODE) {
      console.info(
        `[page ${page}] API 종료 코드 ${resultCode}${
          resultMessage ? ` (${resultMessage})` : ""
        }. 스크래핑을 종료합니다.`,
      );
      break;
    }

    const rows = Array.isArray(payload.C005?.row) ? payload.C005.row : [];

    if (rows.length === 0) {
      console.info(`[page ${page}] 응답 row가 비어 있어 스크래핑을 종료합니다.`);
      break;
    }

    const { products, invalidCount, duplicateCount } = normalizeRows(rows);
    const skippedCount = invalidCount + duplicateCount;

    totalFetched += rows.length;
    totalValid += products.length;
    totalInvalid += invalidCount;
    totalDuplicates += duplicateCount;

    console.info(
      `[page ${page}] 수신 ${rows.length}건, 유효 ${products.length}건, 제외 ${skippedCount}건` +
        ` (무효 ${invalidCount}건, 중복 ${duplicateCount}건)`,
    );

    const upsertedCount = await upsertProducts(products, page);
    totalUpserted += upsertedCount;

    console.info(
      `[page ${page}] 완료: 누적 수신 ${totalFetched}건, 누적 유효 ${totalValid}건, ` +
        `누적 제외 ${totalInvalid + totalDuplicates}건, 누적 upsert ${totalUpserted}건`,
    );

    startIdx += PAGE_SIZE;
    page += 1;
    await delay(REQUEST_DELAY_MS);
  }

  console.info(
    `최종 결과: 수신 ${totalFetched}건, 유효 ${totalValid}건, ` +
      `무효 ${totalInvalid}건, 중복 ${totalDuplicates}건, upsert ${totalUpserted}건`,
  );
}

main()
  .catch((error) => {
    console.error(
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
