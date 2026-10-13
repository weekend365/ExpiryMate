---
status: active
owner: privacy-release
last_reviewed: 2026-10-13
source_of_truth: true
data_as_of: 2026-10-13
---

# Store Privacy Declarations · Contrast Matrix

출시 전 App Store Privacy Nutrition Label / Google Play Data Safety 작성 시,
앱·API 실제 처리와 공개 방침(`/privacy`, `/privacy/choices`)이 같은지 맞추기 위한
대조표입니다. **법률 자문이 아니며**, 제출 전에 최신 제품 동작과 법무 검토로
다시 확인하세요.

관련 코드·화면:

- 방침: `apps/admin/app/privacy/page.tsx`
- 삭제·철회 안내: `apps/admin/app/privacy/choices/page.tsx`
- 앱 제어: `앱/설정 → 개인정보와 추천 안내`
- API: `GET /privacy/status`, `POST /privacy/ai-data-notice/accept|revoke`,
  `POST /privacy/recommendation-history/delete`, `POST /privacy/account/delete`

## 2026-10-13 승인 후 Android39 재심사

iOS1.4.3(51)은 승인·수동 출시 대기입니다. Android37·Data Safety의 최초 승인은 확인했지만,
결제 검증 수정39로 교체하기 위해 사용자가 기존 항목의 심사 전 복귀·39 교체·재심사를
명시적으로 허용했습니다. [39 재심사 기록](../design/reviews/release-readiness-2026-10-13/android-production-39.json)의
콘솔 미리보기에서 수집12개·공유7개 유형, 암호화·계정 생성 방식·삭제 URL이 유지됨을
확인했습니다. 폼 응답은 바꾸지 않았으며39와 함께 접수돼 현재 검토 중입니다. 관리형
게시를 유지했고 실제 공개는 아직 실행하지 않았습니다. SDK 버전·전체 실행 검증의
미완료 범위는 기존 기록대로 유지합니다.

## 2026-10-10 콘솔 대조 이력

App Store의 15개 label 유형과 정책 URL을 확인했습니다. 실제 iOS 1.4.3(49) IPA에서는
앱의 PurchaseHistory manifest 누락을 발견해 Expo 설정과 생성된 네이티브 manifest를
보완했습니다. 교체 1.4.3(50)과 최종 1.4.3(51) IPA에서 PurchaseHistory 포함·서명을
직접 확인했습니다. 최종 51은 TestFlight 월 구독·복원을 서버 영수증 및 사용자 표시로
검증한 뒤 App Review에 제출했고 현재 심사 대기 중입니다. 전체 수명주기 QA는 별개입니다.

Google Play 수정 전 신고는 8개 유형이며 Photos·Purchase history·Crash logs·Other app
performance data가 빠져 있었습니다. 광고 관련 위치·상호작용·진단이 임시 처리로 신고됐고,
기기 ID·쿠팡 검색어를 포함한 제3자 공유도 꺼져 있습니다. `Sentry.wrap`의 상호작용
breadcrumb·설치 ID·오류/성능 수집은 광고 선택과 독립적이며 opt-out이 확인되지 않았습니다.
보상 광고 SSV에서는 계정 ID의 안정적인 HMAC 식별자를 Google에 전송하므로 이 경로도
User IDs 공유와 목적에 대조해야 합니다. AD_ID 권한 제거와 비맞춤형 광고가 전체 SDK
수집·공유를 없애지는 않습니다.

[유형별 수정과 근거](../design/reviews/release-readiness-2026-10-10/store-corrections.json)를
콘솔에 저장하고 production 1.4.3(37)과 함께 심사에 제출했습니다. 현재 12개 수집 유형·
7개 공유 유형이며 누락·공유·임시 처리·필수 여부 11개 응답을 바로잡았습니다. 이름은
가입 화면·공유 계약·서버에서 선택 입력이므로 신고도 선택으로 수정했습니다.
최신 vendor 안내는 GMA 25.5.0만을 대상으로 하며 실제 설치는 25.0.0입니다. 실제 광고
초기화·SSV·Sentry 코드와 공식 안내로 보수적으로 신고했으며, 설치 버전의 정확한 vendor
확인이나 전체 SDK 실행 경로 QA를 완료한 것으로 처리하지 않습니다. 공개 게시는 승인 대기입니다.

---

## 데이터 유형 대조

| 데이터 | 수집 여부 | 목적 | 제3자 / 국외 | 사용자 제어 | App Store Label 초안 | Play Data Safety 초안 |
| --- | --- | --- | --- | --- | --- | --- |
| 계정 이메일·표시 이름 | 예 (가입·소셜 시) | 계정·복구·문의 | 메일 발송 수탁자(해당 시) | 계정 정리 | Contact Info | Personal info |
| 공유 초대 이메일·1회용 코드 해시·멤버십·역할 | 예 (공유 기능 사용 시) | 공간 초대·권한·알림 수신 설정 | 이메일 방식은 메일 발송 수탁자·같은 공간 구성원 | 초대/코드 취소(이메일 즉시 제거) · 수락·취소·만료 후 최대 30일 내 기록 삭제 · 공간 나가기·구성원 제거·공간 삭제 · 계정 정리 시 보낸/받은 초대 삭제 | Contact Info / Identifiers | Personal info / App activity |
| 소셜 로그인 식별자 | 예 (OAuth 사용 시) | 로그인 | OAuth 제공자 | 계정 정리 | Identifiers | Personal info |
| 재료·유통기한·보관 위치 | 예 | 재고·알림·추천 입력 | 호스팅 DB·선택한 공간 구성원; 추천 시 OpenAI로 snapshot | 항목 삭제·공간 삭제·계정 정리 | User Content | App activity / Personal info (제품 데이터) |
| 알림·푸시 토큰 | 예 | 유통기한 알림 | Expo Push 등 | 알림 끄기·계정 정리 | Identifiers | Device or other IDs |
| AI 추천 요청·결과·재료 snapshot·맞춤 설정·추천 행동 | 예 (추천 사용 시) | 추천 제공·히스토리·개인화 | **OpenAI(미국, 행동은 최근 요약만 전송)** | 동의 철회·기록 삭제·설정 변경·계정 정리 | User Content | App activity |
| 고객 문의 본문·주제 | 예 (인앱 문의 시) | 고객 지원 | 운영 메일 수신함·호스팅 DB | 계정 정리 시 삭제 | User Content | App activity / Personal info |
| 개인 플러스 구매·구독 검증 | 예 (구매·복원 시) | 구독 제공·복원·부정 이용 방지·환불 대응 | **Apple/Google**: 상품 ID, 거래/원거래 ID, 구매 토큰 또는 서명 거래, 구매 상태, 갱신·만료·취소·환불·철회 시각, 계정 결합 식별자. 카드번호는 미수집 | 스토어 구독 관리·복원·고객 지원·계정 정리. 계정 삭제와 스토어 해지는 별개 | Purchases → Purchase History / App Functionality | Financial info → Purchase history / App functionality · Account management |
| 쿠팡 상품 검색어 | 예 (홈·레시피·보관함·조리 완료·장보기 상품 영역 사용 시) | 관련 실물 상품 조회·외부 구매 연결 | **쿠팡 파트너스**: 정규화한 재료명 또는 직접 입력 검색어 한 건. 계정 ID·전체 재고·유통기한·수량·공간 정보는 전송하지 않음 | 상품 영역 사용·제휴 기능 플래그로 중단 가능 | User Content → Other User Content / App Functionality | App activity → Other user-generated content / App functionality (제3자 공유 여부는 최신 콘솔 정의로 재검토) |
| 비맞춤형 보상 광고 | 예 (사용자가 광고 선택 시) | 광고 제공·보상 검증·부정 이용 방지 | **Google Mobile Ads(국외)** | 광고는 매회 선택, 기능 플래그로 중단 가능, 계정 정리 시 서버 세션 삭제 | Coarse Location / Identifiers / Usage Data / Diagnostics · Third-Party Advertising · Tracking=No | Approximate location / Device or other IDs / App interactions / Diagnostics · Advertising |
| 추적(ATT·다른 회사 앱/웹 간 연결) | **아니오** | — | — | ATT 요청 없음, Android 광고 ID 권한 제거 | Tracking=No | 앱 간 추적 목적으로 광고 ID를 수집하지 않음 |
| 기기 연락처 | 아니오 | — | — | — | Not collected | Not collected |
| 사진 라이브러리·촬영 이미지(영수증/냉장고 일괄 등록) | 기능 사용 시 예. 기본 플래그 on(명시적 off 가능). 바코드/유통기한 OCR 경로와 분리 | 재료 후보 추출 | 서버를 거쳐 **OpenAI Vision**(미국). 원본은 파싱 후 폐기, DB 미보관 | AI 고지 동의·철회, 기능 플래그 | Photos or Videos | Photos and videos |
| 바코드/유통기한 OCR 카메라 프레임 | 기기 내만. 서버 미업로드 | 바코드·유통기한 인식 | 없음 | 카메라 권한 | Photos 아님 (카메라 권한 문구) | Photos 아님 |

\* 바코드/유통기한 OCR은 카메라 권한을 사용하지만 사진 라이브러리를 읽지 않으며
촬영 이미지는 기기 내 ML Kit에만 쓰고 서버에 올리지 않습니다.
영수증·냉장고 사진 일괄 등록(`INVENTORY_PHOTO_PARSE_ENABLED`)은 별도 경로입니다.
사용자가 고른 사진을 서버로 보내 OpenAI Vision으로 후보를 만들고, 원본은 파싱 후
폐기합니다. 이 경로는 기본 on이며, 명시적으로 끈 배포를 만들 때만 해당
스토어 신고 범위를 다시 대조합니다. 현재 기본 on 배포에서는 App Store
Photos or Videos / Play Photos and videos 신고와 권한 문구가 필요합니다.

스토어 권한 문구와 `PrivacyInfo.xcprivacy`는 실제 켜진 경로와 일치시킵니다.

---

## 신고 기준과 기존 제출 이력

### App Store Connect · App Privacy

아래 표는 App Store Connect에 게시한 값과 iOS 빌드에 포함된 Google Mobile Ads,
Google UMP, ML Kit, Sentry 개인정보 매니페스트를 합친 정본입니다. 계정·구매·앱
콘텐츠는 사용자에게 연결되며, SDK 진단·기타 데이터는 연결되지 않습니다. 광고
데이터와 기기 ID는 앱/SDK 처리 경로에 따라 연결됨과 연결되지 않음 양쪽에 표시될
수 있습니다. 모든 경로의 **추적에 사용 = 아니오**입니다.

| 데이터 유형 | 목적 | 사용자 연결 |
| --- | --- | --- |
| Contact Info → Name | App Functionality | 연결됨 |
| Contact Info → Email Address | App Functionality | 연결됨 |
| Identifiers → User ID | App Functionality | 연결됨 |
| Identifiers → Device ID | App Functionality · Third-Party Advertising · Analytics | 연결됨 · 연결되지 않음 |
| User Content → Photos or Videos | App Functionality | 연결됨 |
| User Content → Customer Support | App Functionality | 연결됨 |
| User Content → Other User Content | App Functionality · Product Personalization | 연결됨 |
| Purchases → Purchase History | App Functionality | 연결됨 |
| Location → Coarse Location | Third-Party Advertising | 연결됨 |
| Usage Data → Advertising Data | Third-Party Advertising · Analytics | 연결됨 · 연결되지 않음 |
| Usage Data → Product Interaction | Analytics · Third-Party Advertising | 연결됨 |
| Diagnostics → Crash Data | App Functionality · Analytics | 연결되지 않음 |
| Diagnostics → Performance Data | App Functionality · Third-Party Advertising · Analytics | 연결되지 않음 |
| Diagnostics → Other Diagnostic Data | App Functionality · Third-Party Advertising · Analytics | 연결되지 않음 |
| Other Data → Other Data Types | App Functionality · Analytics | 연결되지 않음 |

- Tracking: **No**
- Photos or Videos는 App Functionality, 사용자 시작, 필수 아님으로 신고. 원본은
  서버에 보관하지 않고 OpenAI Vision 파싱 후 폐기.
  바코드/OCR 카메라 프레임은 Photos가 아님.
- `apps/mobile/app.json`의 `ios.privacyManifests.NSPrivacyCollectedDataTypes`와
  같은 범위를 유지하며, EAS prebuild가 `PrivacyInfo.xcprivacy`를 생성

### Google Play Console · Data safety

- 사용자 데이터를 수집하거나 공유하는가: **예**
- 수집 데이터가 전송 중 암호화되는가: **예**
- 데이터 삭제 요청 방법을 제공하는가: **예**
- 제3자와 공유하는가: **예 — 쿠팡 검색어·광고 SDK 및 보상 SSV 경로**
  - 호스팅·메일·AI·푸시 제공자는 개발자 지시에 따라 처리하는 서비스 제공자
  - 공유 냉장고 구성원 공개는 사용자가 시작하고 기대하는 기능
  - 쿠팡 상품 검색에서는 검색어 한 건이 쿠팡으로 전달되므로
    `App activity → Other user-generated content`를 App functionality 목적으로 공유한다고 신고

아래는 저장·심사 제출한 응답입니다. 모든 유형은 수집=예·임시 처리=아니오입니다.
`광고 SDK 목적`은 Advertising or marketing · Analytics · Fraud prevention, security,
and compliance를 뜻합니다. SDK 공유는 해당 경로의 목적이며 필수 여부는 전체 앱의
수집(광고와 독립적인 Sentry 포함)을 기준으로 판단했습니다.

| 데이터 유형 | 공유 | 필수 여부 | 수집 목적 | 공유 목적 |
| --- | --- | --- | --- | --- |
| Personal info → Name | 아니오 | 선택 | App functionality · Account management | — |
| Personal info → Email address | 아니오 | 필수 | App functionality · Account management | — |
| Personal info → User IDs | 예 | 필수 | App functionality · Account management · Fraud prevention, security, and compliance | App functionality · Fraud prevention, security, and compliance |
| App activity → Other user-generated content | 예 | 선택 | App functionality · Personalization | App functionality |
| Photos and videos → Photos | 아니오 | 선택 | App functionality | — |
| Financial info → Purchase history | 아니오 | 선택 | App functionality · Account management | — |
| Location → Approximate location | 예 | 선택 | 광고 SDK 목적 | 광고 SDK 목적 |
| App activity → App interactions | 예 | 필수 | 광고 SDK 목적 | 광고 SDK 목적 |
| App info and performance → Crash logs | 아니오 | 필수 | Analytics | — |
| App info and performance → Diagnostics | 예 | 필수 | 광고 SDK 목적 | 광고 SDK 목적 |
| App info and performance → Other app performance data | 예 | 필수 | 광고 SDK 목적 | 광고 SDK 목적 |
| Device or other IDs | 예 | 필수 | App functionality · 광고 SDK 목적 | 광고 SDK 목적 |

외부 계정 삭제 URL:
`https://jango.devnamu.com/privacy/choices`

---

## AI 처리 요약 (스토어 심사 노트용)

1. 모바일은 OpenAI API 키를 갖지 않으며, 서버만 호출합니다.
2. 전송 항목: 재료명·카테고리·수량/단위·보관 위치·유통기한·잔여 일수·추천 조건·알레르기·제외 재료·식단·매운맛·조리도구·최근 추천 행동 요약.
3. 사진 일괄 등록(플래그 on일 때만): 사용자가 고른 영수증/냉장고 사진을 서버가 OpenAI Vision으로 보내고 원본은 파싱 후 폐기. 메타(장면, 후보 수, 토큰·추정 비용)만 비용 한도용으로 보관.
4. 서버 보관: 즐겨찾기하지 않은 추천은 생성 후 최대 90일. 하나 이상의 요리가 즐겨찾기된 추천은 마지막 즐겨찾기 해제·추천 기록 삭제·계정 정리 시까지. 사진 원본은 보관하지 않음.
5. OpenAI: 기본 API는 모델 학습에 쓰지 않으며, abuse 모니터링 정책상 최대 약 30일
   보관될 수 있음(OpenAI 정책 변경 가능).
6. 동의: 첫 추천 또는 첫 사진 파싱 전 고지 수락. 철회 후 신규 추천·사진 파싱 차단. 기록 삭제는 별도.

공유 공간의 추천은 해당 공간 구성원에게 보이지만, AI 고지 동의·사용 한도·비용은
추천을 실행한 사용자에게 적용됩니다. 즐겨찾기는 개인 데이터로 유지됩니다.

고지 버전 환경변수: `AI_DATA_NOTICE_VERSION` (기본 `ai-data-notice-v4`).
문구·보관·이전 고지가 바뀌면 버전을 올리고 재동의를 받습니다.

---

## 체크리스트

- [ ] Production `PRIVACY_POLICY_URL` / `PRIVACY_CHOICES_URL` 가 공개 HTTPS
- [ ] App Store Connect Privacy Label이 위 표와 일치
- [ ] Play Console Data Safety가 위 표와 일치
- [ ] Support / Privacy URL이 심사 메타에 동일하게 등록
- [ ] AI 동의 철회·추천 기록 삭제·계정 정리를 실기기에서 확인
- [ ] 공유 초대 이메일/1회용 코드·구성원 공개 범위·공간 나가기/삭제·소유권 이전을 2계정으로 확인
- [ ] `PrivacyInfo.xcprivacy` Required Reasons와 실제 API 사용 일치
  (`NSPrivacyCollectedDataTypes`는 Label과 별개이나 수집 유형 추가 시 검토)
- [ ] Play Console `앱에 광고 포함` = 예
- [ ] App Store Purchases / Play Purchase history 선언이 개인 플러스 구매·복원 동작과 일치
- [ ] Apple appAccountToken·Google 난독화 계정 ID가 결제 검증 목적으로만 사용되는지 확인
- [ ] AdMob 콘텐츠 등급 `G`, 아동 대상 = 아니오, 광고 단위 보상 `recipe_generation` / `1`
- [ ] 개발자 웹사이트 루트 `/app-ads.txt`에 실제 `pub-…` 값 공개
- [ ] iOS ATT 문구·요청 없음, Android merged manifest에 `AD_ID` 권한 없음
- [ ] 쿠팡 상품 영역에서 검색어 한 건만 전송되고 계정 ID·전체 재고·유통기한·수량·공간 정보가 전송되지 않는지 확인
- [ ] 쿠팡 검색어의 App Privacy / Play Data Safety 제3자 공유 분류를 최신 콘솔 문구로 확정
