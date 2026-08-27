import { BarcodeLookupSource } from "@expirymate/shared";
import type { ProductLookupStatus } from "./useProductScanner";

export function getScannerConfirmDescription({
  needsManualName,
  needsManualExpiry,
  catalogNameAccepted,
  needsNameConfirmation,
  productLookupStatus,
}: {
  needsManualName: boolean;
  needsManualExpiry: boolean;
  catalogNameAccepted: boolean;
  needsNameConfirmation: boolean;
  productLookupStatus: ProductLookupStatus;
}) {
  const isLookupError = productLookupStatus === "error";

  if (needsManualName && needsManualExpiry) {
    return isLookupError
      ? "상품 조회가 잠시 막혔어요. 이름과 유통기한을 알려주시면 양만 맞춰 넣을게요."
      : "목록에서 못 찾았어요. 이름과 유통기한을 알려주시면 양만 맞춰 넣을게요.";
  }

  if (needsManualExpiry) {
    return "날짜가 안 보여도 괜찮아요. 직접 골라 주시면 양만 맞춰 넣을게요.";
  }

  if (needsManualName) {
    return isLookupError
      ? "상품 조회가 잠시 막혔어요. 이름만 알려주시면 양 맞추는 화면으로 이어갈게요."
      : "목록에서 못 찾았어요. 이름만 알려주시면 양 맞추는 화면으로 이어갈게요.";
  }

  if (!catalogNameAccepted) {
    return "목록 이름은 그대로 두고, 냉장고에는 지금 이름으로 넣을게요.";
  }

  if (needsNameConfirmation) {
    return "이 이름은 아직 덜 확실해요. 맞으면 그대로, 다르면 냉장고에 넣을 이름으로 바꿔 주세요.";
  }

  return "목록에서 찾은 이름이에요. 맞으면 양만 맞춰 넣을게요.";
}

export function getScannerProductSourceLabel({
  productLookupStatus,
  needsManualName,
  productSource,
}: {
  productLookupStatus: ProductLookupStatus;
  needsManualName: boolean;
  productSource?: BarcodeLookupSource | null;
}) {
  if (productLookupStatus === "loading") {
    return "상품 정보를 찾고 있어요";
  }

  if (productLookupStatus === "error") {
    return "상품 정보를 불러오지 못했어요";
  }

  if (productSource === BarcodeLookupSource.PRODUCT_MASTER) {
    return "우리 목록에서 찾았어요";
  }

  if (productSource === BarcodeLookupSource.OPEN_FOOD_FACTS) {
    return "공개 상품 정보에서 찾았어요";
  }

  if (needsManualName) {
    return "이름을 직접 알려주세요";
  }

  return "상품 정보";
}

export function shouldContributeScannedBarcode(
  productLookupStatus: ProductLookupStatus,
) {
  return productLookupStatus !== "error";
}
