export const PROHIBITED_BARCODE_CONTRIBUTION_CODE =
  "BARCODE_CONTRIBUTION_PROHIBITED_CONTENT";

export const barcodeContributionFieldLabels = {
  name: "상품명",
  brand: "브랜드",
  category: "카테고리",
} as const;

export type BarcodeContributionField =
  keyof typeof barcodeContributionFieldLabels;

const supportedFields = Object.keys(
  barcodeContributionFieldLabels,
) as BarcodeContributionField[];

export function getProhibitedBarcodeContributionFields(
  error: unknown,
): BarcodeContributionField[] | null {
  if (!isRecord(error) || error.code !== PROHIBITED_BARCODE_CONTRIBUTION_CODE) {
    return null;
  }

  const details = error.details;
  if (!isRecord(details) || !Array.isArray(details.fields)) {
    return [];
  }

  const fields = details.fields;
  return supportedFields.filter((field) => fields.includes(field));
}

export function getBarcodeContributionModerationMessage(
  fields: BarcodeContributionField[],
) {
  const fieldLabel =
    fields.length > 0
      ? fields.map((field) => barcodeContributionFieldLabels[field]).join("·")
      : "상품 정보";

  return `${fieldLabel}에 사용할 수 없는 표현이 있어요. 문구를 수정하거나 기여 없이 계속해 주세요.`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
