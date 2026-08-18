import Link from "next/link";
import { appBrand } from "@expirymate/shared";

const contactEmail =
  process.env.PRIVACY_CONTACT_EMAIL ?? "privacy@expirymate.local";

const COUPANG_DISCLOSURE =
  "이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.";

export const dynamic = "force-dynamic";

export const metadata = {
  title: `쿠팡 파트너스 안내 · ${appBrand.appNameKo}`,
  description: `${appBrand.appNameKo}의 레시피와 장보기에서 제공하는 쿠팡 파트너스 상품 안내입니다.`,
};

export default function PartnersPage() {
  const partnerLink = readCoupangPartnersPublicLink();
  const partnerLabel =
    process.env["COUPANG_PARTNERS_PUBLIC_LINK_LABEL"]?.trim() ||
    "식재료 쿠팡에서 찾아보기";

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-10">
      <div className="rounded-[var(--radius-2xl)] border border-[var(--border)] bg-[var(--surface)] p-7 shadow-[var(--shadow-lift)]">
        <div className="inline-flex rounded-full bg-[var(--primary-soft)] px-3 py-1 text-sm font-bold text-[var(--primary)]">
          {appBrand.appNameKo} Partners
        </div>
        <h1 className="mt-5 text-3xl font-black tracking-tight">
          쿠팡 파트너스 안내
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          시행일: 2026년 8월 18일
        </p>

        <section className="mt-8 space-y-4 text-sm leading-7 text-[var(--foreground)]">
          <h2 className="text-xl font-black">이 페이지의 역할</h2>
          <p>
            {appBrand.appNameKo}({appBrand.appNameEn})는 식재료·유통기한 관리와
            AI 요리 추천을 제공합니다. 레시피의 부족 재료와 별도 장보기 화면에서
            관련 상품 또는 쿠팡 검색 링크를 안내할 수 있습니다. 이 페이지는 그
            제휴 안내와 경제적 이해관계를 공개합니다.
          </p>

          <h2 className="pt-4 text-xl font-black">앱에서 어떻게 쓰이나</h2>
          <p>
            레시피 상세에서는 부족한 선택 재료별 관련 상품을, 장보기 화면에서는
            사용자가 직접 검색한 재료와 최근 30일 안에 모두 소비한 재료의 관련
            상품을 보여 줄 수 있습니다. 홈에는 장보기 화면으로 이동하는 빠른
            동작만 두며, 유통기한 알림에 상품 배너를 넣지 않습니다.
          </p>
          <p>
            링크를 여는 것은 선택입니다. 장고 플러스 구독 혜택과 무관하며,
            추천을 받기 위해 구매할 필요는 없습니다.
          </p>

          <h2 className="pt-4 text-xl font-black">경제적 이해관계 표시</h2>
          <p>
            쿠팡 파트너스 활동으로 게재된 안내는 추천 내용과 같은 언어로, 본문과
            구별되게 표시합니다.
          </p>
          <p
            className="rounded-[var(--radius-lg)] bg-[var(--primary-soft)] px-4 py-4 text-base font-black leading-7 text-[var(--foreground)]"
            role="note"
          >
            {COUPANG_DISCLOSURE}
          </p>

          <h2 className="pt-4 text-xl font-black">식재료 찾아보기</h2>
          <p>
            앱은 쿠팡 파트너스 API에서 받은 상품명·이미지·현재 표시 가격·배송
            정보와 제휴 URL을 최대 3개까지 표시할 수 있습니다. 검색 결과가 없거나
            API를 사용할 수 없으면 아래와 같은 제휴 검색 링크로 전환합니다.
            가격과 재고는 조회 뒤 바뀔 수 있으므로 쿠팡에서 최종 확인해 주세요.
          </p>
          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-muted)] p-5">
            <p className="text-xs font-bold tracking-wide text-[var(--primary)]">
              있으면 더 맛있어져요
            </p>
            <p className="mt-2 text-lg font-black">식재료</p>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              요리에 필요한 재료를 쿠팡에서 둘러볼 수 있어요.
            </p>
            {partnerLink ? (
              <div className="mt-4 space-y-2">
                <a
                  className="inline-flex min-h-12 items-center rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-black text-[var(--surface)]"
                  href={partnerLink}
                  rel="noopener noreferrer sponsored"
                  target="_blank"
                >
                  {partnerLabel}
                </a>
                <p className="break-all text-xs leading-5 text-[var(--muted)]">
                  {partnerLink}
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
                파트너스 상품 링크는 운영 설정 후 이 자리에 표시됩니다.
              </p>
            )}
          </div>

          <h2 className="pt-4 text-xl font-black">결제와 개인정보</h2>
          <p>
            상품 결제와 배송은 쿠팡에서 이루어집니다. App Store 또는 Google Play
            인앱결제가 아니며, {appBrand.appNameKo}가 대금을 받지 않습니다.
            상품을 누른 경우에만 쿠팡 웹 또는 앱으로 이동합니다. 상품 영역을
            불러올 때 정규화한 재료명 또는 사용자가 직접 입력한 검색어 한 건이
            서버에서 쿠팡으로 전달될 수 있습니다. 계정 ID, 전체 냉장고 목록,
            유통기한, 수량, 공간 정보, 기기 광고 식별자는 쿠팡에 보내지 않습니다.
          </p>

          <h2 className="pt-4 text-xl font-black">문의</h2>
          <p>
            제휴 안내와 서비스 관련 문의는{" "}
            <a
              className="font-bold text-[var(--primary)]"
              href={`mailto:${contactEmail}`}
            >
              {contactEmail}
            </a>
            로 보내 주세요.
          </p>
        </section>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/terms"
            className="rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-black text-[var(--surface)]"
          >
            이용약관
          </Link>
          <Link
            href="/privacy"
            className="rounded-full bg-[var(--surface-muted)] px-5 py-3 text-sm font-black text-[var(--foreground)]"
          >
            개인정보처리방침
          </Link>
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
