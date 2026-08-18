import { normalizeRecipeTerm } from "../recipes/recipe-ranking";

const COUPANG_SEARCH_ORIGIN = "https://www.coupang.com";

const SEARCH_ALIASES: Record<string, string> = {
  달걀: "계란",
  계란: "계란",
  난류: "계란",
};

const BLOCKED_SHOPPING_TERMS = [
  "성인",
  "담배",
  "전자담배",
  "주류",
  "소주",
  "맥주",
  "와인",
  "의약품",
  "비아그라",
  "화약",
  "총기",
  "노트북",
  "스마트폰",
  "휴대폰",
  "태블릿",
  "텔레비전",
  "화장품",
  "의류",
  "신발",
  "가방",
];

export function isBlockedShoppingText(value: string) {
  const normalized = normalizeRecipeTerm(value);
  return BLOCKED_SHOPPING_TERMS.some((term) =>
    normalized.includes(normalizeRecipeTerm(term)),
  );
}

export function resolveCoupangSearchQuery(ingredientName: string) {
  const trimmed = ingredientName.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = normalizeRecipeTerm(trimmed);
  if (!normalized) {
    return null;
  }

  if (isBlockedShoppingText(normalized)) {
    return null;
  }

  return SEARCH_ALIASES[normalized] ?? trimmed;
}

export function buildCoupangSearchUrl(query: string) {
  const params = new URLSearchParams({
    component: "",
    q: query,
    channel: "user",
  });
  return `${COUPANG_SEARCH_ORIGIN}/np/search?${params.toString()}`;
}

export function parseCoupangPartnerTrackingUrl(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.protocol !== "https:") {
    return null;
  }

  const host = url.hostname.toLowerCase();
  const allowed =
    host === "link.coupang.com" ||
    host === "www.coupang.com" ||
    host === "coupang.com" ||
    host === "coupa.ng" ||
    host.endsWith(".coupang.com") ||
    host.endsWith(".coupa.ng");

  return allowed ? url.toString() : null;
}

export function readCoupangPartnersTrackingLink() {
  return parseCoupangPartnerTrackingUrl(
    process.env.COUPANG_PARTNERS_TRACKING_LINK ?? "",
  );
}
