import { appBrand } from "@expirymate/shared";
import { ActionLink } from "../../../src/components/action-control";

const contactEmail =
  process.env.PRIVACY_CONTACT_EMAIL ?? "privacy@expirymate.local";

export default function PrivacyChoicesPage() {
  return (
    <main className="mx-auto min-h-screen max-w-[var(--content-default)] px-[var(--space-md)] py-[var(--space-xl)]">
      <div className="rounded-[var(--radius-2xl)] border border-[var(--border)] bg-[var(--surface)] p-[var(--space-lg)] shadow-[var(--shadow-lift)]">
        <div className="inline-flex rounded-full bg-[var(--primary-soft)] px-[var(--space-sm)] py-[var(--space-xxs)] type-body-small-strong text-[var(--primary-foreground)]">
          {appBrand.appNameKo} Privacy Choices
        </div>
        <h1 className="mt-[var(--space-md)] type-display">
          데이터 삭제·동의 철회 안내
        </h1>
        <p className="mt-[var(--space-sm)] type-body-small text-[var(--muted)]">
          사용자는 {appBrand.appNameKo} 앱 안에서 계정 데이터 삭제, AI 안내
          동의 철회, 추천 기록 삭제를 직접 할 수 있습니다.
        </p>

        <section className="mt-[var(--space-lg)] space-y-[var(--space-sm)] type-body-small text-[var(--foreground)]">
          <h2 className="type-heading">앱에서 하는 방법</h2>
          <ol className="list-decimal space-y-[var(--space-xs)] pl-[var(--space-md)]">
            <li>{appBrand.appNameKo} 앱을 엽니다.</li>
            <li>설정 탭으로 이동합니다.</li>
            <li>「개인정보와 추천 안내」를 엽니다.</li>
            <li>
              원하는 항목을 선택합니다.
              <ul className="mt-[var(--space-xs)] list-disc space-y-[var(--space-xxs)] pl-[var(--space-md)]">
                <li>요리 추천 안내 → 동의 철회</li>
                <li>받은 추천 기록 정리</li>
                <li>계정과 데이터 정리</li>
              </ul>
            </li>
          </ol>

          <h2 className="pt-[var(--space-sm)] type-heading">항목별 삭제·철회 범위</h2>
          <ul className="list-disc space-y-[var(--space-xs)] pl-[var(--space-md)]">
            <li>
              <strong>AI 동의 철회:</strong> 이후 새 요리 추천과 사진으로 재료
              읽기 시 외부 AI로 재료·조건·사진이 전송되지 않습니다. 계정과 재료는
              유지됩니다.
            </li>
            <li>
              <strong>추천 기록 정리:</strong> 서버에 저장된 나의 AI 추천
              히스토리(요청 조건·재료 snapshot·추천 결과)만 삭제됩니다.
            </li>
            <li>
              <strong>계정과 데이터 정리:</strong> 재료와 유통기한, AI 추천
              히스토리, 알림 설정, 로그인 세션, 이메일 비밀번호 또는 소셜 로그인
              연결 정보가 즉시 삭제됩니다. 내가 보낸 공유 초대와 내 이메일로
              받은 대기 중 초대도 함께 삭제됩니다. 개인 공간 데이터는 삭제되지만
              다른 구성원과 함께 쓰는 공간의 공동 재고는 유지되고, 탈퇴자의
              생성·수정자 연결은 제거됩니다. 개인 추천 사용 원장, 광고 보상
              세션과 서비스 내 구독 권한 연결도 함께 삭제됩니다. 다만 환불·분쟁
              대응 또는 법령상 보존 의무가 있는 최소 구매 기록은 분리 보관될 수
              있습니다.
            </li>
          </ul>

          <h2 className="pt-[var(--space-sm)] type-heading">공유 냉장고를 이용 중이라면</h2>
          <p>
            일반 구성원과 관리자는 계정을 정리하면 공유 냉장고 멤버십도 함께
            제거됩니다. 다른 구성원이 있는 공유 냉장고의 소유자는 설정 → 함께
            쓰는 냉장고에서 소유권을 다른 구성원에게 넘기거나 공간을 삭제해야
            계정 정리를 마칠 수 있습니다. 초대를 취소하면 해당 초대 이메일은
            즉시 지워지고, 수락·취소·만료된 초대 기록은 최대 30일 이내에
            서버에서 삭제됩니다.
          </p>

          <h2 className="pt-[var(--space-sm)] type-heading">개인 플러스 구독을 이용 중이라면</h2>
          <p>
            계정 삭제만으로 App Store 또는 Google Play의 자동 갱신 구독이
            해지되지 않을 수 있습니다. 먼저 해당 스토어의 구독 관리에서 장고
            개인 플러스를 해지했는지 확인한 뒤 계정을 정리해 주세요. 해지는 다음
            갱신을 중단하는 절차이며 이미 결제한 기간의 환불 여부는 관련 법령과
            각 스토어 정책을 따릅니다.
          </p>

          <h2 className="pt-[var(--space-sm)] type-heading">삭제되지 않는 데이터</h2>
          <p>
            공통 상품 카탈로그처럼 특정 사용자 계정에 소유되지 않은 운영 데이터는
            삭제 대상이 아닙니다. 다른 구성원이 계속 사용하는 공유 냉장고의
            공동 재고·보관 위치도 한 구성원의 계정 정리만으로 삭제되지 않습니다.
            반면 해당 사용자가 실행한 AI 추천 기록은 계정 정리 시 삭제됩니다.
            법적 의무 또는 보안상 필요한 최소 로그가 있다면 관련 법령과 정책에
            따라 보관될 수 있습니다. OpenAI 등 외부 처리자 측에 이미 전달된
            데이터는 해당 사업자의 보관 정책(일반적으로 보안 모니터링 목적 최대
            약 30일)에 따릅니다.
          </p>

          <h2 className="pt-[var(--space-sm)] type-heading">도움이 필요한 경우</h2>
          <p>
            앱에 접근할 수 없으면 아래 이메일로 계정 삭제를 요청할 수 있습니다.
            본인 확인 후 계정과 연결 데이터를 정리합니다. 삭제·철회 과정에
            문제가 있는 경우에도{" "}
            <a className="type-body-strong text-[var(--link-text)]" href={`mailto:${contactEmail}`}>
              {contactEmail}
            </a>
            로 문의해 주세요.
          </p>
        </section>

        <div className="mt-[var(--space-lg)] flex flex-wrap gap-[var(--space-sm)]">
          <ActionLink href="/privacy" size="medium">
            개인정보처리방침
          </ActionLink>
          <ActionLink href="/login" size="medium" variant="surface">
            관리자 로그인
          </ActionLink>
        </div>
      </div>
    </main>
  );
}
