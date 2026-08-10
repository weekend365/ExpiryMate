export const barcodeContributionTextFields = [
  "name",
  "brand",
  "category",
] as const;

export type BarcodeContributionTextField =
  (typeof barcodeContributionTextFields)[number];

type BarcodeContributionText = Partial<
  Record<BarcodeContributionTextField, string | undefined>
>;

type ModerationEnvironment = Partial<
  Pick<
    NodeJS.ProcessEnv,
    | "BARCODE_CONTRIBUTION_EXTRA_BLOCKED_TERMS"
    | "BARCODE_CONTRIBUTION_ALLOWED_TERMS"
  >
>;

// Ambiguous words are matched as complete tokens only. This keeps legitimate
// compounds from being rejected while still catching punctuation/space-based
// obfuscation such as one character per token.
const DEFAULT_TOKEN_TERMS = [
  "씨발",
  "씨바",
  "씨방",
  "씨부랄",
  "씨이발",
  "시발",
  "시이발",
  "씨팔",
  "시팔",
  "ㅅㅂ",
  "ㅆㅂ",
  "ㅂㅅ",
  "ㅈㄹ",
  "ㅈㄴ",
  "ㅅㄲ",
  "ㄲㅈ",
  "ㅁㅊ",
  "씹새끼",
  "씹새",
  "씹년",
  "씹놈",
  "씹창",
  "개새끼",
  "개색기",
  "개새",
  "개년",
  "개놈",
  "개자식",
  "개같다",
  "개같네",
  "개같은",
  "새끼",
  "병신",
  "븅신",
  "빙신",
  "지랄",
  "염병",
  "엠병",
  "존나",
  "졸라",
  "좆",
  "좆같다",
  "좆같은",
  "좆까",
  "좆나",
  "꺼져",
  "닥쳐",
  "엿먹어",
  "뻐큐",
  "빠큐",
  "미친놈",
  "미친년",
  "또라이",
  "꼴통",
  "썅",
  "썅놈",
  "썅년",
  "쌍년",
  "호로자식",
  "후레자식",
  "니미",
  "니미럴",
  "니기미",
  "니애미",
  "니애비",
  "느금마",
  "느개비",
  "창녀",
  "걸레년",
  "섹스",
  "야동",
  "야설",
  "음란",
  "성인물",
  "포르노",
  "자위",
  "성교",
  "강간",
  "윤간",
  "수간",
  "근친",
  "성노예",
  "딜도",
  "애널",
  "오르가즘",
  "사까시",
  "펠라",
  "펠라치오",
  "후장",
  "로리",
  "쇼타",
  "몰카",
  "보지",
  "자지",
  "fuck",
  "fck",
  "fuk",
  "fucc",
  "phuck",
  "fucking",
  "fucker",
  "fuckyou",
  "shit",
  "sht",
  "bullshit",
  "bitch",
  "btch",
  "biatch",
  "biotch",
  "bastard",
  "cunt",
  "dick",
  "dickhead",
  "cock",
  "pussy",
  "asshole",
  "jackass",
  "dumbass",
  "douchebag",
  "prick",
  "twat",
  "wanker",
  "whore",
  "slut",
  "slutty",
  "skank",
  "motherfucker",
  "porn",
  "porno",
  "xxx",
  "nude",
  "nudes",
  "naked",
  "fetish",
  "bdsm",
  "sex",
  "sexy",
  "hentai",
  "penis",
  "vagina",
  "anal",
  "tits",
  "boob",
  "boobs",
  "blowjob",
  "handjob",
  "gangbang",
] as const;

// These terms are sufficiently unambiguous to reject even when embedded in a
// longer token. Keep this list deliberately small to limit false positives.
const DEFAULT_SUBSTRING_TERMS = [
  "씨발",
  "개새끼",
  "씹새끼",
  "씨발놈",
  "씨발년",
  "니애미",
  "니애비",
  "느금마",
  "느개비",
  "좆",
  "창녀",
  "포르노",
  "야동",
  "야설",
  "딜도",
  "강간",
  "윤간",
  "수간",
  "성노예",
  "오르가즘",
  "펠라치오",
  "사까시",
  "fuck",
  "motherfucker",
  "fuckyou",
  "porn",
  "blowjob",
  "handjob",
  "gangbang",
] as const;

// Exact full-field exceptions only. Operators can add known legitimate product
// or brand values without weakening matches inside any other contribution.
const DEFAULT_ALLOWED_VALUES = ["시발점"] as const;

const HANGUL_INITIALS = [
  "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ",
  "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
] as const;
const HANGUL_VOWELS = [
  "ㅏ", "ㅐ", "ㅑ", "ㅒ", "ㅓ", "ㅔ", "ㅕ", "ㅖ", "ㅗ", "ㅘ",
  "ㅙ", "ㅚ", "ㅛ", "ㅜ", "ㅝ", "ㅞ", "ㅟ", "ㅠ", "ㅡ", "ㅢ",
  "ㅣ",
] as const;
const HANGUL_FINALS = [
  "", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ",
  "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ",
  "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
] as const;

export function findProhibitedBarcodeContributionFields(
  input: BarcodeContributionText,
  env: ModerationEnvironment = process.env,
): BarcodeContributionTextField[] {
  const tokenTerms = [
    ...DEFAULT_TOKEN_TERMS,
    ...parseCommaSeparatedTerms(
      env.BARCODE_CONTRIBUTION_EXTRA_BLOCKED_TERMS,
    ),
  ].map(toModerationTokens);
  const substringTerms = DEFAULT_SUBSTRING_TERMS.map(toCompactModerationText);
  const allowedValues = new Set(
    [
      ...DEFAULT_ALLOWED_VALUES,
      ...parseCommaSeparatedTerms(env.BARCODE_CONTRIBUTION_ALLOWED_TERMS),
    ].map(toNormalizedModerationText),
  );

  return barcodeContributionTextFields.filter((field) => {
    const value = input[field];
    if (!value?.trim()) return false;

    const normalized = toNormalizedModerationText(value);
    if (!normalized || allowedValues.has(normalized)) return false;

    const tokenCandidates = buildInputTokenCandidates(value);
    const compactCandidates = tokenCandidates.map((tokens) => tokens.join(""));
    return (
      tokenTerms.some((termTokens) =>
        tokenCandidates.some((tokens) =>
          containsTokenSequence(tokens, termTokens),
        ),
      ) ||
      substringTerms.some((term) =>
        compactCandidates.some((compact) => compact.includes(term)),
      )
    );
  });
}

export function toNormalizedModerationText(value: string) {
  return composeCompatibilityHangulJamo(value)
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/gu, "")
    .replace(/[\p{P}\p{S}_\s]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

function composeCompatibilityHangulJamo(value: string) {
  const characters = [...value];
  let result = "";

  for (let index = 0; index < characters.length; index += 1) {
    const initialIndex = HANGUL_INITIALS.indexOf(
      characters[index] as (typeof HANGUL_INITIALS)[number],
    );
    const vowelIndex = HANGUL_VOWELS.indexOf(
      characters[index + 1] as (typeof HANGUL_VOWELS)[number],
    );
    if (initialIndex < 0 || vowelIndex < 0) {
      result += characters[index];
      continue;
    }

    const finalCharacter = characters[index + 2];
    const nextIsSyllable =
      HANGUL_INITIALS.includes(
        finalCharacter as (typeof HANGUL_INITIALS)[number],
      ) &&
      HANGUL_VOWELS.includes(
        characters[index + 3] as (typeof HANGUL_VOWELS)[number],
      );
    const finalIndex = nextIsSyllable
      ? 0
      : HANGUL_FINALS.indexOf(
          finalCharacter as (typeof HANGUL_FINALS)[number],
        );
    const safeFinalIndex = Math.max(0, finalIndex);
    result += String.fromCodePoint(
      0xac00 + (initialIndex * 21 + vowelIndex) * 28 + safeFinalIndex,
    );
    index += safeFinalIndex > 0 ? 2 : 1;
  }

  return result;
}

function parseCommaSeparatedTerms(value: string | undefined) {
  return (
    value
      ?.split(",")
      .map((term) => term.trim())
      .filter(Boolean) ?? []
  );
}

function toModerationTokens(value: string) {
  return toNormalizedModerationText(value).split(" ").filter(Boolean);
}

function toCompactModerationText(value: string) {
  return toModerationTokens(value).join("");
}

function buildInputTokenCandidates(value: string) {
  const normalizedTokens = toModerationTokens(value);
  const leetTokens = toModerationTokens(
    value
      .normalize("NFKC")
      .toLocaleLowerCase("en-US")
      .replace(/[@4]/gu, "a")
      .replace(/[8]/gu, "b")
      .replace(/[3]/gu, "e")
      .replace(/[!1|]/gu, "i")
      .replace(/[0]/gu, "o")
      .replace(/[$5]/gu, "s")
      .replace(/[7]/gu, "t"),
  );

  const candidates = [
    normalizedTokens,
    leetTokens,
    normalizedTokens.map(collapseRepeatedCharacters),
    leetTokens.map(collapseRepeatedCharacters),
  ];

  return candidates.filter(
    (tokens, index) =>
      tokens.length > 0 &&
      candidates.findIndex((candidate) =>
        arraysEqual(candidate, tokens),
      ) === index,
  );
}

function collapseRepeatedCharacters(value: string) {
  return [...value].filter((character, index, characters) => {
    return index === 0 || character !== characters[index - 1];
  }).join("");
}

function arraysEqual(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function containsTokenSequence(inputTokens: string[], termTokens: string[]) {
  if (termTokens.length === 0) return false;

  const compactTerm = termTokens.join("");
  for (let start = 0; start < inputTokens.length; start += 1) {
    let candidate = "";
    for (let end = start; end < inputTokens.length; end += 1) {
      candidate += inputTokens[end];
      if (candidate === compactTerm) return true;
      if (candidate.length >= compactTerm.length) break;
    }
  }

  return false;
}
