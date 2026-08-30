import Link from "next/link";
import { appBrand } from "@expirymate/shared";

const contactEmail =
  process.env.PRIVACY_CONTACT_EMAIL ?? "privacy@expirymate.local";

export default function TermsPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-10">
      <div className="rounded-[var(--radius-2xl)] border border-[var(--border)] bg-[var(--surface)] p-7 shadow-[var(--shadow-lift)]">
        <div className="inline-flex rounded-full bg-[var(--primary-soft)] px-3 py-1 text-sm font-bold text-[var(--primary)]">
          {appBrand.appNameKo} Terms
        </div>
        <h1 className="mt-5 text-3xl font-black tracking-tight">이용약관</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          시행일: 2026년 8월 1일 · 최종 개정: 2026년 8월 30일
        </p>

        <section className="mt-8 space-y-4 text-sm leading-7 text-[var(--foreground)]">
          <h2 className="text-xl font-black">서비스와 계정</h2>
          <p>
            {appBrand.appNameKo}는 식재료·유통기한 관리, 알림, 공유 냉장고,
            AI 요리 추천을 제공합니다. 사용자는 정확한 계정 정보를 사용하고
            계정 접근 수단을 안전하게 관리해야 합니다.
          </p>

          <h2 className="pt-4 text-xl font-black">추천과 이용 한도</h2>
          <p>
            요리 추천은 참고 정보이며 식품의 실제 상태, 알레르기, 조리 안전을
            사용자가 직접 확인해야 합니다. 무료·광고·개인 플러스 AI 이용량은
            한국 시간 기준으로 초기화되며, 작업이 정상적으로 완료된 경우에만
            1회로 계산합니다. 생성 실패·취소·서버 오류는 사용량에서 제외합니다.
          </p>

          <h2 className="pt-4 text-xl font-black">보상형 광고</h2>
          <p>
            무료 추천을 모두 사용한 이용자는 원할 때 보상형 광고를 선택할 수
            있습니다. 광고 한 편을 끝까지 보고 서버 검증이 완료되면 당일 사용할
            추천 1회가 지급됩니다. 광고 추천권은 당일 자정에 만료되며 양도하거나
            다음 날로 이월할 수 없습니다.
          </p>

          <h2 className="pt-4 text-xl font-black">장고 개인 플러스</h2>
          <p>
            장고 개인 플러스는 App Store 또는 Google Play에서 판매하는 자동 갱신
            구독입니다. 월간은 4,900원, 연간은 39,000원이며 무료 체험은 제공하지
            않습니다. 실제 청구 금액과 통화는 결제 전에 스토어 화면에 표시된 값을
            따릅니다. 구독에는 광고 없는 요리 추천·사진 일괄 등록, 월간·일일 AI
            한도, 30/90일 소비·폐기 분석과 폐기 예방 제안이 포함됩니다. 가족
            플러스와 일회성 추천권은 현재 판매하지 않습니다.
          </p>
          <p>
            결제를 승인하면 선택한 기간마다 구독이 자동 갱신되고 스토어 계정에
            요금이 청구됩니다. 다음 갱신을 원하지 않으면 현재 결제 기간이 끝나기
            전에 App Store 또는 Google Play의 구독 관리에서 해지해야 합니다.
            해지해도 이미 결제한 기간이 끝날 때까지 혜택이 유지될 수 있습니다.
            환불, 결제 보류, 철회와 권한 종료는 관련 법령 및 Apple·Google의 결제
            정책과 서버가 확인한 구매 상태를 따릅니다. 가격 인상 또는 무료 체험
            도입 시에는 원칙적으로 적용 30일 전 별도 동의·고지 절차를 제공합니다.
          </p>
          <p>
            구매 복원은 같은 스토어 계정으로 진행합니다. 구매가 다른 장고 계정에
            연결된 경우 보안을 위해 자동 이전하지 않으며 고객 지원을 통해 본인과
            구매 상태를 확인합니다. 장고 계정 삭제는 스토어 구독 해지와 별개이므로,
            계정 삭제 전에 스토어에서 구독 상태를 직접 확인해야 합니다.
          </p>

          <h2 className="pt-4 text-xl font-black">쿠팡 파트너스</h2>
          <p>
            홈·레시피·보관함·조리 완료·장보기에서 관련 재료를 안내할 때 쿠팡
            파트너스 링크를 제공할 수 있습니다. 결제는 쿠팡에서 이루어지며 App
            Store 또는 Google Play 인앱결제가 아닙니다. 제휴 안내는 선택 사항이며
            광고 보상이나 추천 이용량과 무관합니다. 자세한 고지는{" "}
            <Link className="font-bold text-[var(--primary)]" href="/partners">
              쿠팡 파트너스 안내
            </Link>
            를 참고해 주세요.
          </p>

          <h2 className="pt-4 text-xl font-black">서비스 변경과 제한</h2>
          <p>
            안정성·보안 장애 때 신규 구독 판매나 AI 작업 시작을 일시 중단할 수
            있습니다. 이미 활성화된 구독자의 약정 한도를 원가 사정만으로 결제
            기간 중 낮추지 않습니다. 중요한 변경은 앱 또는 공개 안내를 통해
            알립니다. 부정한 광고 보상 획득, 한도 우회, 타인의 계정 사용은 제한될
            수 있습니다.
          </p>

          <h2 className="pt-4 text-xl font-black">문의</h2>
          <p>
            서비스와 제휴 관련 문의는{" "}
            <a className="font-bold text-[var(--primary)]" href={`mailto:${contactEmail}`}>
              {contactEmail}
            </a>
            로 보내 주세요.
          </p>
        </section>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/privacy"
            className="rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-black text-[var(--surface)]"
          >
            개인정보처리방침
          </Link>
          <Link
            href="/partners"
            className="rounded-full bg-[var(--surface-muted)] px-5 py-3 text-sm font-black text-[var(--foreground)]"
          >
            쿠팡 파트너스 안내
          </Link>
          <Link
            href="/privacy/choices"
            className="rounded-full bg-[var(--surface-muted)] px-5 py-3 text-sm font-black text-[var(--foreground)]"
          >
            데이터 삭제 안내
          </Link>
        </div>
      </div>
    </main>
  );
}
