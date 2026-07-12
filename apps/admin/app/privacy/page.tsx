import Link from "next/link";
import { appBrand } from "@expirymate/shared";

const contactEmail =
  process.env.PRIVACY_CONTACT_EMAIL ?? "privacy@expirymate.local";

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-10">
      <div className="rounded-[var(--radius-2xl)] border border-[var(--border)] bg-[var(--surface)] p-7 shadow-[var(--shadow-lift)]">
        <div className="inline-flex rounded-full bg-[var(--primary-soft)] px-3 py-1 text-sm font-bold text-[var(--primary)]">
          {appBrand.appNameKo} Privacy
        </div>
        <h1 className="mt-5 text-3xl font-black tracking-tight">
          개인정보처리방침
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          시행일: 2026년 6월 3일
        </p>

        <section className="mt-8 space-y-4 text-sm leading-7 text-[var(--foreground)]">
          <h2 className="text-xl font-black">수집하는 정보</h2>
          <p>
            {appBrand.appNameKo}({appBrand.appNameEn})는 계정 식별 정보, 이메일, 표시 이름, 소셜 로그인 연결
            정보, 재료명, 수량, 보관 위치, 유통기한, 알림 설정, AI 요리 추천
            요청과 결과를 서비스 제공을 위해 처리합니다.
          </p>

          <h2 className="pt-4 text-xl font-black">이용 목적</h2>
          <p>
            재료와 유통기한 관리, 알림 제공, 등록된 재료 기반 요리 추천, 계정
            인증과 복구, 서비스 안정성 유지 목적으로 사용합니다.
          </p>

          <h2 className="pt-4 text-xl font-black">AI 추천 데이터 처리</h2>
          <p>
            사용자가 요리 추천을 요청하면 재료명, 카테고리, 수량과 단위, 보관
            위치, 유통기한, 만료까지 남은 일수, 추천 조건이 서버를 통해 OpenAI
            API로 전송됩니다. 추천 요청, 당시 재료 snapshot, 추천 결과는 사용자의
            추천 히스토리 제공과 품질 개선을 위해 저장됩니다.
          </p>
          <p>
            OpenAI API 데이터는 기본적으로 모델 학습에 사용되지 않지만, 서비스
            보안과 abuse monitoring을 위해 일정 기간 보관될 수 있습니다.
          </p>

          <h2 className="pt-4 text-xl font-black">보관 및 삭제</h2>
          <p>
            사용자는 앱 설정의 계정 및 데이터 삭제 화면에서 계정과 사용자 소유
            데이터를 즉시 삭제할 수 있습니다. 삭제 시 재료, 추천 히스토리, 알림
            설정, 로그인 세션, 이메일 비밀번호 또는 소셜 로그인 연결 정보가
            제거됩니다.
          </p>

          <h2 className="pt-4 text-xl font-black">문의</h2>
          <p>
            개인정보 관련 문의는{" "}
            <a className="font-bold text-[var(--primary)]" href={`mailto:${contactEmail}`}>
              {contactEmail}
            </a>
            로 연락해 주세요.
          </p>
        </section>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/privacy/choices"
            className="rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-black text-[var(--surface)]"
          >
            데이터 삭제 안내
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
