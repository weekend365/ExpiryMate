export const MAX_RECIPE_STEP_TIMER_SECONDS = 120 * 60;

const RANGE_SEPARATOR = String.raw`(?:~|〜|～|-|–|—|에서|부터)`;
const NUMBER = String.raw`\d+(?:\.\d+)?`;

function secondsFor(value: string, unit: string) {
  const amount = Number.parseFloat(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  return Math.round(amount * (unit === "분" ? 60 : 1));
}

function isOffsetOrFraction(value: string, matchEnd: number) {
  return /^\s*(?:전|의)/u.test(value.slice(matchEnd));
}

/**
 * Extracts the longest actionable Korean cooking duration from a step.
 * Ranges intentionally use their upper bound; values are capped at 120 minutes.
 */
export function extractRecipeStepTimerSeconds(value: string) {
  const candidates: number[] = [];

  const add = (seconds: number | null) => {
    if (seconds !== null) {
      candidates.push(Math.min(seconds, MAX_RECIPE_STEP_TIMER_SECONDS));
    }
  };

  const mixedRangePattern = new RegExp(
    `(${NUMBER})\\s*(분|초)\\s*${RANGE_SEPARATOR}\\s*(${NUMBER})\\s*(분|초)`,
    "gu",
  );
  for (const match of value.matchAll(mixedRangePattern)) {
    const end = (match.index ?? 0) + match[0].length;
    if (!isOffsetOrFraction(value, end)) {
      add(secondsFor(match[3]!, match[4]!));
    }
  }

  const sameUnitRangePattern = new RegExp(
    `(${NUMBER})\\s*${RANGE_SEPARATOR}\\s*(${NUMBER})\\s*(분|초)`,
    "gu",
  );
  for (const match of value.matchAll(sameUnitRangePattern)) {
    const end = (match.index ?? 0) + match[0].length;
    if (!isOffsetOrFraction(value, end)) {
      add(secondsFor(match[2]!, match[3]!));
    }
  }

  const compoundPattern = new RegExp(
    `(${NUMBER})\\s*분\\s*(${NUMBER})\\s*초`,
    "gu",
  );
  for (const match of value.matchAll(compoundPattern)) {
    const end = (match.index ?? 0) + match[0].length;
    if (!isOffsetOrFraction(value, end)) {
      const minutes = secondsFor(match[1]!, "분");
      const seconds = secondsFor(match[2]!, "초");
      add(minutes !== null && seconds !== null ? minutes + seconds : null);
    }
  }

  const simplePattern = new RegExp(`(${NUMBER})\\s*(분|초)`, "gu");
  for (const match of value.matchAll(simplePattern)) {
    const end = (match.index ?? 0) + match[0].length;
    if (!isOffsetOrFraction(value, end)) {
      add(secondsFor(match[1]!, match[2]!));
    }
  }

  return candidates.length ? Math.max(...candidates) : null;
}

export function deriveRecipeStepTimerSeconds(steps: readonly string[]) {
  return steps.map(extractRecipeStepTimerSeconds);
}
