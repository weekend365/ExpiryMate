type DateParts = {
  year: number;
  month: number;
  day: number;
};

const FULL_YEAR_DOTTED_OR_DASHED =
  /(?:^|\D)((?:19|20)\d{2})[.-](\d{1,2})[.-](\d{1,2})(?!\d)/g;
const FULL_YEAR_KOREAN =
  /(?:^|\D)((?:19|20)\d{2})년(\d{1,2})월(\d{1,2})일/g;
const COMPACT_FULL_YEAR =
  /(?:^|\D)((?:19|20)\d{2})(\d{2})(\d{2})(?!\d)/g;
const SHORT_YEAR_DOTTED_OR_DASHED =
  /(?:^|\D)(\d{2})[.-](\d{1,2})[.-](\d{1,2})(?!\d)/g;

export function parseExpirationDate(text: string | null | undefined): string | null {
  if (!text) {
    return null;
  }

  const normalized = text.replace(/\s+/g, "");

  return (
    findValidDate(normalized, FULL_YEAR_DOTTED_OR_DASHED, ([year, month, day]) => ({
      year: Number(year),
      month: Number(month),
      day: Number(day),
    })) ??
    findValidDate(normalized, FULL_YEAR_KOREAN, ([year, month, day]) => ({
      year: Number(year),
      month: Number(month),
      day: Number(day),
    })) ??
    findValidDate(normalized, COMPACT_FULL_YEAR, ([year, month, day]) => ({
      year: Number(year),
      month: Number(month),
      day: Number(day),
    })) ??
    findValidDate(normalized, SHORT_YEAR_DOTTED_OR_DASHED, ([year, month, day]) => ({
      year: 2000 + Number(year),
      month: Number(month),
      day: Number(day),
    }))
  );
}

function findValidDate(
  text: string,
  pattern: RegExp,
  toParts: (groups: string[]) => DateParts,
) {
  pattern.lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const date = formatDateIfValid(toParts(match.slice(1)));

    if (date) {
      return date;
    }
  }

  return null;
}

function formatDateIfValid({ year, month, day }: DateParts) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}
