import Link from "next/link";

const contactEmail =
  process.env.PRIVACY_CONTACT_EMAIL ?? "privacy@expirymate.local";

export default function PrivacyChoicesPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-10">
      <div className="rounded-[32px] border border-[var(--border)] bg-[var(--surface)] p-7 shadow-[0_30px_80px_rgba(29,39,32,0.08)]">
        <div className="inline-flex rounded-full bg-[var(--primary-soft)] px-3 py-1 text-sm font-bold text-[var(--primary)]">
          ExpiryMate Privacy Choices
        </div>
        <h1 className="mt-5 text-3xl font-black tracking-tight">
          데이터 삭제 안내
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          사용자는 ExpiryMate 앱 안에서 계정과 사용자 데이터를 직접 삭제할 수
          있습니다.
        </p>

        <section className="mt-8 space-y-4 text-sm leading-7 text-[var(--foreground)]">
          <h2 className="text-xl font-black">앱에서 삭제하는 방법</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>ExpiryMate 앱을 엽니다.</li>
            <li>설정 탭으로 이동합니다.</li>
            <li>개인정보 및 AI 데이터 섹션에서 데이터 삭제를 선택합니다.</li>
            <li>확인 문구를 입력하고 계정 및 데이터 삭제를 실행합니다.</li>
          </ol>

          <h2 className="pt-4 text-xl font-black">삭제되는 데이터</h2>
          <p>
            재료와 유통기한, AI 추천 히스토리와 저장된 snapshot, 알림 설정,
            로그인 세션, 이메일 비밀번호 또는 소셜 로그인 연결 정보가 즉시
            삭제됩니다.
          </p>

          <h2 className="pt-4 text-xl font-black">삭제되지 않는 데이터</h2>
          <p>
            공통 상품 카탈로그처럼 특정 사용자 계정에 소유되지 않은 운영 데이터는
            삭제 대상이 아닙니다. 법적 의무 또는 보안상 필요한 최소 로그가 있다면
            관련 법령과 정책에 따라 보관될 수 있습니다.
          </p>

          <h2 className="pt-4 text-xl font-black">도움이 필요한 경우</h2>
          <p>
            앱에 접근할 수 없거나 삭제 요청에 문제가 있으면{" "}
            <a className="font-bold text-[var(--primary)]" href={`mailto:${contactEmail}`}>
              {contactEmail}
            </a>
            로 문의해 주세요.
          </p>
        </section>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/privacy"
            className="rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-black text-white"
          >
            개인정보처리방침
          </Link>
          <Link
            href="/login"
            className="rounded-full bg-[var(--surface-muted)] px-5 py-3 text-sm font-black text-[var(--foreground)]"
          >
            관리자 로그인
          </Link>
        </div>
      </div>
    </main>
  );
}
