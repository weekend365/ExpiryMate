const RANGE_SEPARATOR = String.raw`(?:~|〜|～|-|–|—|에서|부터)`;
const NUMBER = String.raw`\d+(?:[.,]\d+)?`;
const COOKING_TIME_PATTERN = new RegExp(
  `(${NUMBER}\\s*(?:분|초)\\s*${RANGE_SEPARATOR}\\s*${NUMBER}\\s*(?:분|초)|${NUMBER}\\s*${RANGE_SEPARATOR}\\s*${NUMBER}\\s*(?:분|초)|${NUMBER}\\s*(?:분|초))`,
  "gu",
);

export interface CookingStepTextToken {
  value: string;
  isTime: boolean;
}

/** Splits only actionable cooking durations so they can use the signature color. */
export function splitCookingStepText(text: string): CookingStepTextToken[] {
  const tokens: CookingStepTextToken[] = [];
  let cursor = 0;

  COOKING_TIME_PATTERN.lastIndex = 0;
  for (const match of text.matchAll(COOKING_TIME_PATTERN)) {
    const value = match[0];
    const start = match.index ?? 0;
    const end = start + value.length;

    // Keep fractions and relative offsets as ordinary copy, matching timer extraction.
    if (/^\s*(?:전|의)/u.test(text.slice(end))) {
      continue;
    }

    if (start > cursor) {
      tokens.push({ value: text.slice(cursor, start), isTime: false });
    }
    tokens.push({ value, isTime: true });
    cursor = end;
  }

  if (cursor < text.length) {
    tokens.push({ value: text.slice(cursor), isTime: false });
  }

  return tokens.length ? tokens : [{ value: text, isTime: false }];
}
