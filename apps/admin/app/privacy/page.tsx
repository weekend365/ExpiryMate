import Link from "next/link";
import {
  appBrand,
  UNFAVORITED_RECIPE_RECOMMENDATION_RETENTION_DAYS,
} from "@expirymate/shared";
import { ActionLink } from "../../src/components/action-control";

const contactEmail =
  process.env.PRIVACY_CONTACT_EMAIL ?? "privacy@expirymate.local";

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto min-h-screen max-w-[var(--content-default)] px-[var(--space-md)] py-[var(--space-xl)]">
      <div className="rounded-[var(--radius-2xl)] border border-[var(--border)] bg-[var(--surface)] p-[var(--space-lg)] shadow-[var(--shadow-lift)]">
        <div className="inline-flex rounded-full bg-[var(--primary-soft)] px-[var(--space-sm)] py-[var(--space-xxs)] type-body-small-strong text-[var(--primary-foreground)]">
          {appBrand.appNameKo} Privacy
        </div>
        <h1 className="mt-[var(--space-md)] type-display">
          개인정보처리방침
        </h1>
        <p className="mt-[var(--space-sm)] type-body-small text-[var(--muted)]">
          시행일: 2026년 6월 3일 · 최종 개정: 2026년 8월 30일
        </p>

        <section className="mt-[var(--space-lg)] space-y-[var(--space-sm)] type-body-small text-[var(--foreground)]">
          <h2 className="type-heading">수집하는 정보</h2>
          <p>
            {appBrand.appNameKo}({appBrand.appNameEn})는 계정 식별 정보, 이메일, 표시 이름, 소셜 로그인 연결
            정보, 재료명, 수량, 보관 위치, 유통기한, 알림 설정, AI 요리 추천
            요청과 결과를 서비스 제공을 위해 처리합니다. 공유 냉장고를 사용하는
            경우 초대 이메일, 1회용 초대 코드의 해시값, 공간 멤버십, 역할,
            공간별 알림 수신 설정도 처리합니다.
          </p>
          <p>
            개인 플러스를 구매하거나 복원하면 상품 ID, 스토어, 구매·원거래
            식별자, 구매 토큰 또는 서명 거래 정보, 결제 상태, 갱신·만료·취소·환불·
            철회 시각, Apple appAccountToken 또는 Google 난독화 계정 ID를 처리합니다.
            카드번호와 같은 결제수단 정보는 장고 서버가 수집하지 않습니다.
          </p>
          <p>
            보상형 광고를 선택하면 Google Mobile Ads SDK가 IP 주소를 바탕으로 한
            대략적 위치, 광고 및 앱 상호작용, 진단 정보, 기기 식별자를 처리할 수
            있습니다. 광고 보상 검증을 위해 광고 세션, 거래 식별자, 광고 단위,
            검증 시각을 서버에 저장합니다. 맞춤형 광고와 앱 추적 투명성(ATT)
            추적은 사용하지 않습니다.
          </p>

          <h2 className="pt-[var(--space-sm)] type-heading">이용 목적</h2>
          <p>
            재료와 유통기한 관리, 알림 제공, 등록된 재료 기반 요리 추천, 계정
            인증과 복구, 가족·매장 구성원과의 재고 공유, 서비스 안정성 유지
            목적으로 사용합니다.
          </p>

          <h2 className="pt-[var(--space-sm)] type-heading">공유 냉장고 데이터</h2>
          <p>
            사용자가 가족 또는 매장 공간을 만들거나 참여하면 해당 공간의
            구성원은 공간 이름, 구성원의 표시 이름·가입 이메일·역할과 함께
            재고, 보관 위치, 요리 추천 기록을 볼 수 있습니다. 즐겨찾기, AI
            데이터 고지 동의, 개인 알림 시간과 푸시 토큰은 다른 구성원에게
            공유되지 않습니다.
          </p>
          <p>
            초대 이메일은 초대 링크 발송과 수락 자격 확인을 위해 사용됩니다.
            초대 링크는 7일 후 만료되며 초대받은 이메일과 로그인 이메일이
            일치해야 참여할 수 있습니다. 사용자가 1회용 초대 코드를 선택하면
            원문 대신 해시값만 서버에 보관하며, 코드는 7일 안에 먼저 수락한
            한 계정만 사용할 수 있습니다. 수락·취소가 완료되면 초대 이메일은
            즉시 식별할 수 없도록 제거하고, 수락·취소·만료된 초대 기록(이메일
            또는 코드 해시)은 목적 달성 후 최대 30일 이내에 삭제합니다.
          </p>

          <h2 className="pt-[var(--space-sm)] type-heading">AI 추천·사진 인식 데이터 처리</h2>
          <p>
            사용자가 요리 추천을 요청하면 재료명, 카테고리, 수량과 단위, 보관
            위치, 유통기한, 만료까지 남은 일수, 추천 조건, 사용자가 저장한 알레르기·
            제외 재료·식단·매운맛·조리도구 설정과 최근 즐겨찾기·조리 완료·관심없음
            요약이 서버를 통해 OpenAI API로 전송됩니다. 추천 요청, 당시 재료
            snapshot, 추천 결과와 상세 보기·조리·관심없음 행동은 추천 히스토리와
            맞춤 추천 제공을 위해 서버에 저장됩니다. 모바일 앱은 OpenAI API 키를
            저장하거나 직접 호출하지 않습니다.
          </p>
          <p>
            사용자가 영수증 또는 냉장고 사진으로 재료를 한꺼번에 넣으면, 고른
            사진이 서버를 거쳐 OpenAI Vision API로 전달되어 재료 후보를 만듭니다.
            원본 사진은 파싱이 끝나면 폐기하며 장고 서버나 데이터베이스에 보관하지
            않습니다. 비용 한도를 위해 장면 종류, 후보 수, 토큰·추정 비용만
            남길 수 있습니다. 바코드와 유통기한 스캔(OCR) 사진은 기기 안에서만
            처리하고 서버로 보내지 않습니다.
          </p>
          <p>
            OpenAI API로 전송된 데이터는 기본적으로 모델 학습에 사용되지 않습니다.
            다만 OpenAI의 보안·이상 이용(abuse) 모니터링 정책에 따라 해당 처리자
            측에서 최대 약 30일간 보관될 수 있으며, 정책은 OpenAI 공지에 따라
            변경될 수 있습니다.
          </p>

          <h2 className="pt-[var(--space-sm)] type-heading">처리위탁·국외 이전</h2>
          <p>
            서비스 제공을 위해 아래 처리자(수탁자)에게 필요한 범위의 정보를
            이전·처리할 수 있습니다.
          </p>
          <ul className="list-disc space-y-[var(--space-xs)] pl-[var(--space-md)]">
            <li>
              OpenAI, LLC(미국): AI 요리 추천 생성과, 사용자가 요청한 영수증·냉장고
              사진 재료 인식. 추천 전송 항목은 위 AI 추천 데이터 처리 절과 같고,
              사진 인식 시에는 사용자가 고른 이미지가 전달됩니다.
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
            <li>
              Google LLC(미국 등): 사용자가 선택한 비맞춤형 보상 광고 제공과
              서버측 보상 검증. IP 기반 대략적 위치, 앱·광고 상호작용, 진단,
              기기 식별자가 처리될 수 있습니다.
            </li>
            <li>
              Apple 및 Google: 개인 플러스 구매·복원, 서명 거래 또는 구매 토큰
              검증, 결제 승인, 갱신·취소·결제 유예·만료·환불·철회 상태 처리를
              위해 상품·거래·계정 결합 식별자를 처리합니다. 가족 플러스와
              일회성 추천권은 현재 판매하지 않습니다.
            </li>
            <li>
              쿠팡(쿠팡 파트너스): 홈·레시피·보관함·조리 완료·장보기 상품 영역을
              불러올 때 정규화한 재료명이나 사용자가 직접 입력한 검색어 한 건이
              서버에서 쿠팡으로 전달될 수 있고, 상품을 선택하면 쿠팡 웹·앱으로 이동합니다.
              계정 ID, 전체 냉장고 목록, 유통기한, 수량, 공간 정보는 쿠팡에
              전송하지 않습니다. 고지는{" "}
              <Link className="type-body-strong text-[var(--link-text)]" href="/partners">
                쿠팡 파트너스 안내
              </Link>
              를 따릅니다.
            </li>
          </ul>
          <p>
            국외 이전은 AI 추천 요청 시점 및 인프라·메일·푸시 서비스 이용 시
            발생하며, 사용자는 앱에서 AI 동의를 거두거나 추천 기록을 삭제하거나
            계정을 정리하는 방식으로 이전·처리를 제한할 수 있습니다.
          </p>

          <h2 className="pt-[var(--space-sm)] type-heading">보관 기간</h2>
          <ul className="list-disc space-y-[var(--space-xs)] pl-[var(--space-md)]">
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
              공유 초대 이메일·1회용 코드 해시: 초대가 유효한 동안(최대 7일)
              보관합니다. 수락·취소 시 초대 이메일은 즉시 제거하고, 수락·취소·만료된
              초대 기록은 최대 30일 이내에 삭제합니다. 계정 정리 시에는 내가 보낸
              초대와 내 이메일로 받은 대기 중 초대를 함께 삭제합니다.
            </li>
            <li>
              AI 추천 히스토리(요청 조건·재료 snapshot·추천 결과): 즐겨찾기하지 않은
              추천은 생성 후 최대{" "}
              {UNFAVORITED_RECIPE_RECOMMENDATION_RETENTION_DAYS}일간 보관한 뒤 자동
              삭제합니다. 요리 하나라도 즐겨찾기한 추천은 마지막 즐겨찾기를
              해제하거나, 사용자가 앱에서 추천 기록을 삭제하거나, 계정을 정리할
              때까지 보관합니다. 공유 공간에 표시된 추천에도 같은 기준을 적용합니다.
            </li>
            <li>
              AI 데이터 고지 동의 기록: 동의를 유지하는 동안 보관하며, 동의를
              거두면 동의 시각·버전 정보를 즉시 지웁니다.
            </li>
            <li>
              추천·사진 사용 원장과 광고 보상 세션: 서비스 제공과 중복 지급 방지를
              위해 계정 유지 기간 동안 보관하며 계정 정리 시 함께 삭제합니다.
              광고 거래 식별자는 운영 로그에 남기지 않습니다.
            </li>
            <li>
              구독 구매·검증·권한 기록: 구독 제공, 복원, 중복 권한 방지, 환불·분쟁
              대응과 법적 의무를 위해 구독 및 계정 유지 기간과 관계 법령상 필요한
              기간 동안 보관할 수 있습니다. 계정 정리 시 서비스 권한 연결은
              제거하되 법령상 보존 의무가 있는 최소 결제 기록은 분리 보관합니다.
            </li>
            <li>
              OpenAI API 측 보관: 위 AI 추천 데이터 처리 절(최대 약 30일, 정책
              변경 가능)을 따릅니다. 사진 일괄 등록에 보낸 이미지도 같은 처리자
              정책을 따릅니다.
            </li>
            <li>
              사진 파싱 메타: 장면 종류, 후보 수, 토큰·추정 비용. 원본 사진은
              파싱 후 폐기하며 계정 정리 시 메타도 삭제합니다.
            </li>
            <li>
              법령상 보관이 필요한 최소 기록(해당하는 경우): 관련 법령에서 정한
              기간.
            </li>
          </ul>

          <h2 className="pt-[var(--space-sm)] type-heading">동의 철회·삭제 방법</h2>
          <p>
            앱 설정 → 개인정보와 추천 안내에서 다음을 직접 실행할 수 있습니다.
          </p>
          <ul className="list-disc space-y-[var(--space-xs)] pl-[var(--space-md)]">
            <li>
              요리 추천 안내 동의 철회: 이후 새 추천 요청과 사진으로 재료 읽기가
              멈춥니다. OpenAI로 데이터가 전송되지 않습니다. 이미 저장된 추천 기록은
              별도 삭제 전까지 남을 수 있습니다.
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
            개인 플러스는 App Store 또는 Google Play의 자동 갱신 구독입니다.
            계정 삭제와 스토어 구독 해지는 별개이며, 계정을 삭제해도 스토어의
            자동 갱신이 해지되지 않을 수 있습니다. 계정 삭제 전에 해당 스토어의
            구독 관리에서 해지 여부를 확인해 주세요. 복원이나 다른 장고 계정에
            연결된 구매에 도움이 필요하면 아래 문의처로 연락할 수 있습니다.
          </p>
          <p>
            자세한 삭제 절차는{" "}
            <Link className="type-body-strong text-[var(--link-text)]" href="/privacy/choices">
              데이터 삭제 안내
            </Link>
            를 참고해 주세요.
          </p>

          <h2 className="pt-[var(--space-sm)] type-heading">문의</h2>
          <p>
            개인정보 관련 문의는{" "}
            <a className="type-body-strong text-[var(--link-text)]" href={`mailto:${contactEmail}`}>
              {contactEmail}
            </a>
            로 연락해 주세요.
          </p>
        </section>

        <div className="mt-[var(--space-lg)] flex flex-wrap gap-[var(--space-sm)]">
          <ActionLink href="/privacy/choices" size="medium">
            데이터 삭제 안내
          </ActionLink>
          <ActionLink href="/terms" size="medium" variant="surface">
            이용약관
          </ActionLink>
          <ActionLink href="/partners" size="medium" variant="surface">
            쿠팡 파트너스 안내
          </ActionLink>
          <ActionLink href="/login" size="medium" variant="surface">
            관리자 로그인
          </ActionLink>
        </div>
      </div>
    </main>
  );
}
