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
          시행일: 2026년 6월 3일 · 최종 개정: 2026년 7월 24일
        </p>

        <section className="mt-8 space-y-4 text-sm leading-7 text-[var(--foreground)]">
          <h2 className="text-xl font-black">수집하는 정보</h2>
          <p>
            {appBrand.appNameKo}({appBrand.appNameEn})는 계정 식별 정보, 이메일, 표시 이름, 소셜 로그인 연결
            정보, 재료명, 수량, 보관 위치, 유통기한, 알림 설정, AI 요리 추천
            요청과 결과를 서비스 제공을 위해 처리합니다. 공유 냉장고를 사용하는
            경우 초대 이메일, 1회용 초대 코드의 해시값, 공간 멤버십, 역할,
            공간별 알림 수신 설정도 처리합니다.
          </p>

          <h2 className="pt-4 text-xl font-black">이용 목적</h2>
          <p>
            재료와 유통기한 관리, 알림 제공, 등록된 재료 기반 요리 추천, 계정
            인증과 복구, 가족·매장 구성원과의 재고 공유, 서비스 안정성 유지
            목적으로 사용합니다.
          </p>

          <h2 className="pt-4 text-xl font-black">공유 냉장고 데이터</h2>
          <p>
            사용자가 가족 또는 매장 공간을 만들거나 참여하면 해당 공간의
            구성원은 공간 이름, 구성원의 표시 이름·가입 이메일·역할과 함께
            재고, 보관 위치, 요리 추천 기록을 볼 수 있습니다. 즐겨찾기, 구독,
            AI 데이터 고지 동의, 개인 알림 시간과 푸시 토큰은 다른 구성원에게
            공유되지 않습니다.
          </p>
          <p>
            초대 이메일은 초대 링크 발송과 수락 자격 확인을 위해 사용됩니다.
            초대 링크는 7일 후 만료되며 초대받은 이메일과 로그인 이메일이
            일치해야 참여할 수 있습니다. 사용자가 1회용 초대 코드를 선택하면
            원문 대신 해시값만 서버에 보관하며, 코드는 7일 안에 먼저 수락한
            한 계정만 사용할 수 있습니다.
          </p>

          <h2 className="pt-4 text-xl font-black">AI 추천 데이터 처리</h2>
          <p>
            사용자가 요리 추천을 요청하면 재료명, 카테고리, 수량과 단위, 보관
            위치, 유통기한, 만료까지 남은 일수, 추천 조건이 서버를 통해 OpenAI
            API로 전송됩니다. 추천 요청, 당시 재료 snapshot, 추천 결과는 사용자의
            추천 히스토리 제공을 위해 서버에 저장됩니다. 모바일 앱은 OpenAI API
            키를 저장하거나 직접 호출하지 않습니다.
          </p>
          <p>
            OpenAI API로 전송된 데이터는 기본적으로 모델 학습에 사용되지 않습니다.
            다만 OpenAI의 보안·이상 이용(abuse) 모니터링 정책에 따라 해당 처리자
            측에서 최대 약 30일간 보관될 수 있으며, 정책은 OpenAI 공지에 따라
            변경될 수 있습니다.
          </p>

          <h2 className="pt-4 text-xl font-black">처리위탁·국외 이전</h2>
          <p>
            서비스 제공을 위해 아래 처리자(수탁자)에게 필요한 범위의 정보를
            이전·처리할 수 있습니다.
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              OpenAI, LLC(미국): AI 요리 추천 생성. 전송 항목은 위 AI 추천 데이터
              처리 절과 같습니다.
            </li>
            <li>
              클라우드 호스팅·데이터베이스 사업자(서비스 인프라 운영 지역에 따라
              국내 또는 해외에 서버가 위치할 수 있음): 계정·재료·알림·추천 기록
              저장.
            </li>
            <li>
              이메일 발송 사업자(예: 인증·계정 안내 메일): 이메일 주소와 메일
              본문에 필요한 최소 정보.
            </li>
            <li>
              푸시 알림 전달 사업자(예: Expo Push): 기기 푸시 토큰과 알림 내용.
            </li>
          </ul>
          <p>
            국외 이전은 AI 추천 요청 시점 및 인프라·메일·푸시 서비스 이용 시
            발생하며, 사용자는 앱에서 AI 동의를 거두거나 추천 기록을 삭제하거나
            계정을 정리하는 방식으로 이전·처리를 제한할 수 있습니다.
          </p>

          <h2 className="pt-4 text-xl font-black">보관 기간</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              계정·개인 공간 재료·알림 설정: 회원 탈퇴(계정 정리) 시까지.
              탈퇴 시 즉시 삭제하거나 식별할 수 없도록 처리합니다.
            </li>
            <li>
              공유 공간 재고·보관 위치: 공간을 삭제할 때까지 또는 공간 운영에
              필요한 동안 보관합니다. 일반 구성원이 탈퇴해도 다른 구성원의 공동
              재고는 삭제되지 않으며 탈퇴자의 생성·수정자 연결은 제거됩니다.
            </li>
            <li>
              AI 추천 히스토리(요청 조건·재료 snapshot·추천 결과): 사용자가 앱에서
              추천 기록을 삭제하거나 계정을 정리할 때까지 보관합니다. 공유 공간에
              표시된 추천도 이를 실행한 사용자가 기록을 정리하면 삭제됩니다.
            </li>
            <li>
              AI 데이터 고지 동의 기록: 동의를 유지하는 동안 보관하며, 동의를
              거두면 동의 시각·버전 정보를 즉시 지웁니다.
            </li>
            <li>
              OpenAI API 측 보관: 위 AI 추천 데이터 처리 절(최대 약 30일, 정책
              변경 가능)을 따릅니다.
            </li>
            <li>
              법령상 보관이 필요한 최소 기록(해당하는 경우): 관련 법령에서 정한
              기간.
            </li>
          </ul>

          <h2 className="pt-4 text-xl font-black">동의 철회·삭제 방법</h2>
          <p>
            앱 설정 → 개인정보와 추천 안내에서 다음을 직접 실행할 수 있습니다.
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              요리 추천 안내 동의 철회: 이후 새 추천 요청 시 OpenAI로 데이터가
              전송되지 않습니다. 이미 저장된 추천 기록은 별도 삭제 전까지 남을 수
              있습니다.
            </li>
            <li>
              추천 기록만 삭제: 서버에 저장된 나의 AI 추천 히스토리만 지웁니다.
              계정과 재료는 유지됩니다.
            </li>
            <li>
              계정과 데이터 정리: 개인 공간 재료, 개인 추천 히스토리, 알림 설정,
              로그인 세션, 이메일 비밀번호 또는 소셜 로그인 연결 정보를 즉시
              제거합니다. 공유 공간의 공동 재고는 다른 구성원을 위해 유지됩니다.
              다른 구성원이 있는 공간의 소유자는 먼저 소유권을 이전하거나
              공간을 삭제해야 계정을 정리할 수 있습니다.
            </li>
          </ul>
          <p>
            자세한 삭제 절차는{" "}
            <Link className="font-bold text-[var(--primary)]" href="/privacy/choices">
              데이터 삭제 안내
            </Link>
            를 참고해 주세요.
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
            관리자로 들어가기
          </Link>
        </div>
      </div>
    </main>
  );
}
