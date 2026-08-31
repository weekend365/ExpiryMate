import { appBrand } from "@expirymate/shared";
import { ActionLink } from "../../src/components/action-control";
import { AffiliateCta } from "../../src/components/affiliate-cta";
import { AffiliateDisclosure } from "../../src/components/affiliate-disclosure";

const contactEmail =
  process.env.PRIVACY_CONTACT_EMAIL ?? "privacy@expirymate.local";

export const dynamic = "force-dynamic";

export const metadata = {
  title: `쿠팡 파트너스 안내 · ${appBrand.appNameKo}`,
  description: `${appBrand.appNameKo}의 홈·레시피·보관함·조리 완료·장보기에서 제공하는 쿠팡 파트너스 상품 안내입니다.`,
};

export default function PartnersPage() {
  const partnerLink = readCoupangPartnersPublicLink();

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-[var(--space-md)] py-[var(--space-xl)]">
      <div className="rounded-[var(--radius-2xl)] border border-[var(--border)] bg-[var(--surface)] p-[var(--space-md)] shadow-[var(--shadow-lift)]">
        <div className="type-label inline-flex rounded-full bg-[var(--primary-soft)] px-[var(--space-sm)] py-[var(--space-xxs)] text-[var(--link-text)]">
          {appBrand.appNameKo} Partners
        </div>
        <h1 className="type-display mt-[var(--space-md)] tracking-tight">
          쿠팡 파트너스 안내
        </h1>
        <p className="type-body-small mt-[var(--space-sm)] text-[var(--muted)]">
          시행일: 2026년 8월 18일 · 최종 개정: 2026년 8월 30일
        </p>

        <section className="type-body mt-[var(--space-lg)] space-y-[var(--space-sm)] text-[var(--foreground)]">
          <h2 className="type-heading">이 페이지의 역할</h2>
          <p>
            {appBrand.appNameKo}({appBrand.appNameEn})는 식재료·유통기한 관리와
            AI 요리 추천을 제공합니다. 홈, 레시피, 보관함, 조리 완료와 장보기
            화면에서 관련 상품 또는 쿠팡 검색 링크를 안내할 수 있습니다. 이
            페이지는 그 제휴 안내와 경제적 이해관계를 공개합니다.
          </p>

          <h2 className="type-heading pt-[var(--space-sm)]">앱에서 어떻게 쓰이나</h2>
          <p>
            레시피 상세에서는 있으면 좋은 선택 재료를, 보관함과 조리 완료에서는
            모두 사용한 재료를 장보기로 이어 줍니다. 장보기 화면에서는 사용자가
            직접 검색한 재료와 최근 30일 안에 모두 소비한 재료의 관련 상품을
            보여 줄 수 있습니다. 홈에는 최근 소비 또는 반복 소비 시점에 맞춘
            상품 한 개를 미리 보여 줄 수 있습니다. 유통기한 알림에는 상품 배너를
            넣지 않습니다.
          </p>
          <p>
            링크를 여는 것은 선택입니다. 개인 플러스 구독 여부, 광고 보상 또는
            추천 이용량과 관계없이 쿠팡에서 구매할 필요는 없습니다.
          </p>

          <h2 className="type-heading pt-[var(--space-sm)]">경제적 이해관계 표시</h2>
          <p>
            쿠팡 파트너스 활동으로 게재된 안내는 추천 내용과 같은 언어로, 본문과
            구별되게 표시합니다.
          </p>
          <h2 className="type-heading pt-[var(--space-sm)]">식재료 찾아보기</h2>
          <p>
            앱은 쿠팡 파트너스 API에서 받은 상품명·이미지·현재 표시 가격·배송
            정보와 제휴 URL을 최대 3개까지 표시할 수 있습니다. 검색 결과가 없거나
            API를 사용할 수 없으면 아래와 같은 제휴 검색 링크로 전환합니다.
            가격과 재고는 조회 뒤 바뀔 수 있으므로 쿠팡에서 최종 확인해 주세요.
          </p>
          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-muted)] p-[var(--space-md)]">
            <p className="type-caption-strong tracking-wide text-[var(--link-text)]">
              있으면 더 맛있어져요
            </p>
            <p className="type-subheading mt-[var(--space-xs)]">식재료</p>
            <p className="type-body-small mt-[var(--space-xxs)] text-[var(--muted)]">
              요리에 필요한 재료를 쿠팡에서 둘러볼 수 있어요.
            </p>
            {partnerLink ? (
              <div className="mt-[var(--space-sm)] space-y-[var(--space-xs)]">
                <AffiliateCta href={partnerLink} contextLabel="식재료" />
                <p className="type-caption break-all text-[var(--muted)]">
                  {partnerLink}
                </p>
              </div>
            ) : (
              <p className="type-body-small mt-[var(--space-sm)] text-[var(--muted)]">
                파트너스 상품 링크는 운영 설정 후 이 자리에 표시됩니다.
              </p>
            )}
          </div>

          <h2 className="type-heading pt-[var(--space-sm)]">결제와 개인정보</h2>
          <p>
            상품 결제와 배송은 쿠팡에서 이루어집니다. App Store 또는 Google Play
            인앱결제가 아니며, {appBrand.appNameKo}가 대금을 받지 않습니다.
            상품을 누른 경우에만 쿠팡 웹 또는 앱으로 이동합니다. 상품 영역을
            불러올 때 정규화한 재료명 또는 사용자가 직접 입력한 검색어 한 건이
            서버에서 쿠팡으로 전달될 수 있습니다. 계정 ID, 전체 냉장고 목록,
            유통기한, 수량, 공간 정보, 기기 광고 식별자는 쿠팡에 보내지 않습니다.
          </p>

          <h2 className="type-heading pt-[var(--space-sm)]">문의</h2>
          <p>
            제휴 안내와 서비스 관련 문의는{" "}
            <a
              className="type-body-strong text-[var(--link-text)]"
              href={`mailto:${contactEmail}`}
            >
              {contactEmail}
            </a>
            로 보내 주세요.
          </p>
        </section>

        <div className="mt-[var(--space-lg)] flex flex-wrap gap-[var(--space-xs)]">
          <ActionLink href="/terms">
            이용약관
          </ActionLink>
          <ActionLink href="/privacy" variant="surface">
            개인정보처리방침
          </ActionLink>
        </div>
        <div className="mt-[var(--space-lg)]">
          <AffiliateDisclosure />
        </div>
      </div>
    </main>
  );
}

function readCoupangPartnersPublicLink() {
  const raw =
    process.env["COUPANG_PARTNERS_PUBLIC_LINK"]?.trim() ||
    "https://link.coupang.com/a/ggaBkYvlhQ";
  if (!raw) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(raw);
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
    host.endsWith(".coupang.com");

  return allowed ? url.toString() : null;
}
