const DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MINUTES = 9 * 60;
const KST_TIME_ZONE = "Asia/Seoul";

export const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const isDateOnlyString = (value: string) => {
  return parseDateOnlyParts(value) !== null;
};

export const toKstDateOnly = (value: Date | string) => {
  if (typeof value === "string" && isDateOnlyString(value)) {
    return value;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date value");
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: KST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Invalid date value");
  }

  return `${year}-${month}-${day}`;
};

export const dateOnlyToUtcDate = (value: string) => {
  const parts = parseDateOnlyParts(value);

  if (!parts) {
    throw new Error("Invalid date-only value");
  }

  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
};

export const dateOnlyToKstStartDate = (value: string) => {
  return new Date(dateOnlyToUtcDate(value).getTime() - KST_OFFSET_MINUTES * 60 * 1000);
};

/**
 * Instant of the start of the KST calendar day that contains `now`.
 * Use for daily quota/cost windows so resets follow Asia/Seoul, not server TZ.
 */
export const getKstDayStart = (now: Date | string = new Date()) => {
  return dateOnlyToKstStartDate(toKstDateOnly(now));
};

/**
 * Half-open KST day window: `[start, endExclusive)`.
 */
export const getKstDayWindow = (now: Date | string = new Date()) => {
  const dateOnly = toKstDateOnly(now);
  const start = dateOnlyToKstStartDate(dateOnly);
  const endExclusive = dateOnlyToKstStartDate(addDaysToDateOnly(dateOnly, 1));
  return { start, endExclusive };
};

export const addDaysToDateOnly = (value: Date | string, days: number) => {
  const base = dateOnlyToUtcDate(toKstDateOnly(value));
  base.setUTCDate(base.getUTCDate() + days);
  return toKstDateOnly(base);
};

export const addDays = (value: Date | string, days: number) => {
  return dateOnlyToUtcDate(addDaysToDateOnly(value, days));
};

export const toIsoDate = (value: Date | string) => {
  return toKstDateOnly(value);
};

export const formatDateKorean = (value: Date | string) => {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: KST_TIME_ZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(toDisplayDate(value));
};

export const formatDateKoreanCompact = (value: Date | string) => {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: KST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(toDisplayDate(value));
};

export const calculateDaysLeftUntilExpiry = (
  expiryDate: Date | string,
  now: Date | string = new Date(),
) => {
  const target = dateOnlyDayIndex(toKstDateOnly(expiryDate));
  const current = dateOnlyDayIndex(toKstDateOnly(now));

  return target - current;
};

function dateOnlyDayIndex(value: string) {
  return Math.floor(dateOnlyToUtcDate(value).getTime() / DAY_MS);
}

function toDisplayDate(value: Date | string) {
  return dateOnlyToUtcDate(toKstDateOnly(value));
}

function parseDateOnlyParts(value: string) {
  const match = DATE_ONLY_PATTERN.exec(value);

  if (!match) {
    return null;
  }

  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}
