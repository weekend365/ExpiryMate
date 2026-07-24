import Link from "next/link";
import { appBrand } from "@expirymate/shared";

const contactEmail =
  process.env.PRIVACY_CONTACT_EMAIL ?? "privacy@expirymate.local";

export default function PrivacyChoicesPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-10">
      <div className="rounded-[var(--radius-2xl)] border border-[var(--border)] bg-[var(--surface)] p-7 shadow-[var(--shadow-lift)]">
        <div className="inline-flex rounded-full bg-[var(--primary-soft)] px-3 py-1 text-sm font-bold text-[var(--primary)]">
          {appBrand.appNameKo} Privacy Choices
        </div>
        <h1 className="mt-5 text-3xl font-black tracking-tight">
          데이터 삭제·동의 철회 안내
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          사용자는 {appBrand.appNameKo} 앱 안에서 계정 데이터 삭제, AI 추천 동의
          철회, 추천 기록 삭제를 직접 할 수 있습니다.
        </p>

        <section className="mt-8 space-y-4 text-sm leading-7 text-[var(--foreground)]">
          <h2 className="text-xl font-black">앱에서 하는 방법</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>{appBrand.appNameKo} 앱을 엽니다.</li>
            <li>설정 탭으로 이동합니다.</li>
            <li>「개인정보와 추천 안내」를 엽니다.</li>
            <li>
              원하는 항목을 선택합니다.
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>요리 추천 안내 → 동의 철회</li>
                <li>받은 추천 기록 정리</li>
                <li>계정과 데이터 정리</li>
              </ul>
            </li>
          </ol>

          <h2 className="pt-4 text-xl font-black">항목별 삭제·철회 범위</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>AI 동의 철회:</strong> 이후 새 요리 추천 시 외부 AI로
              재료·조건이 전송되지 않습니다. 계정과 재료는 유지됩니다.
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
              생성·수정자 연결은 제거됩니다.
            </li>
          </ul>

          <h2 className="pt-4 text-xl font-black">공유 냉장고를 이용 중이라면</h2>
          <p>
            일반 구성원과 관리자는 공유 냉장고에서 나간 뒤 계정을 정리할 수
            있습니다. 다른 구성원이 있는 공유 냉장고의 소유자는 설정 → 함께
            쓰는 냉장고에서 소유권을 다른 구성원에게 넘기거나 공간을 삭제해야
            계정 정리를 마칠 수 있습니다. 구성원이 초대를 취소하면 해당 초대
            이메일은 즉시 지워지고, 수락·취소·만료된 초대 기록은 최대 30일
            이내에 서버에서 삭제됩니다.
          </p>

          <h2 className="pt-4 text-xl font-black">삭제되지 않는 데이터</h2>
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

          <h2 className="pt-4 text-xl font-black">도움이 필요한 경우</h2>
          <p>
            앱에 접근할 수 없거나 삭제·철회 요청에 문제가 있으면{" "}
            <a className="font-bold text-[var(--primary)]" href={`mailto:${contactEmail}`}>
              {contactEmail}
            </a>
            로 문의해 주세요.
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
            href="/login"
            className="rounded-full bg-[var(--surface-muted)] px-5 py-3 text-sm font-black text-[var(--foreground)]"
          >
            관리자로 들어가기
          </Link>
        </div>
      </div>
    </main>
  );
}
