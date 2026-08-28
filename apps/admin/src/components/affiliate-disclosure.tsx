import { COUPANG_PARTNERS_DISCLOSURE } from "@expirymate/shared";

export function AffiliateDisclosure({
  disclosure = COUPANG_PARTNERS_DISCLOSURE,
}: {
  disclosure?: string;
}) {
  return (
    <aside
      className="type-body-small text-[var(--disclosure-text)]"
      aria-label="쿠팡 파트너스 제휴 고지"
    >
      {disclosure}
    </aside>
  );
}
