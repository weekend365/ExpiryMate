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

---

## 데이터 유형 대조

| 데이터 | 수집 여부 | 목적 | 제3자 / 국외 | 사용자 제어 | App Store Label 초안 | Play Data Safety 초안 |
| --- | --- | --- | --- | --- | --- | --- |
| 계정 이메일·표시 이름 | 예 (가입·소셜 시) | 계정·복구·문의 | 메일 발송 수탁자(해당 시) | 계정 정리 | Contact Info | Personal info |
| 공유 초대 이메일·1회용 코드 해시·멤버십·역할 | 예 (공유 기능 사용 시) | 공간 초대·권한·알림 수신 설정 | 이메일 방식은 메일 발송 수탁자·같은 공간 구성원 | 초대/코드 취소·공간 나가기·구성원 제거·공간 삭제 | Contact Info / Identifiers | Personal info / App activity |
| 소셜 로그인 식별자 | 예 (OAuth 사용 시) | 로그인 | OAuth 제공자 | 계정 정리 | Identifiers | Personal info |
| 재료·유통기한·보관 위치 | 예 | 재고·알림·추천 입력 | 호스팅 DB·선택한 공간 구성원; 추천 시 OpenAI로 snapshot | 항목 삭제·공간 삭제·계정 정리 | User Content | App activity / Personal info (제품 데이터) |
| 알림·푸시 토큰 | 예 | 유통기한 알림 | Expo Push 등 | 알림 끄기·계정 정리 | Identifiers / Diagnostics(해당 시) | App info and performance / Device IDs |
| AI 추천 요청·결과·재료 snapshot | 예 (추천 사용 시) | 추천 제공·히스토리 | **OpenAI(미국)** | 동의 철회·기록 삭제·계정 정리 | User Content | App activity |
| 고객 문의 본문·주제 | 예 (인앱 문의 시) | 고객 지원 | 운영 메일 수신함·호스팅 DB | 계정 정리 시 삭제 | User Content | App activity / Personal info |
| 결제/구독 영수증 검증 | 예 (IAP 사용 시) | 구독 확인 | Apple/Google | 스토어 구독 관리 | Purchases | Financial info |
| 추적(광고 ID 등) | **아니오** | — | — | — | Data Not Collected / Tracking=No | Data is not collected for ads tracking |
| 기기 연락처·사진 라이브러리(일반) | 아니오* | — | — | — | Not collected | Not collected |

\* 바코드/OCR은 카메라 권한을 사용하지만 사진 라이브러리를 읽지 않습니다.
OCR 촬영 이미지는 기기 내 ML Kit 텍스트 인식에만 사용하고 서버에 업로드하지 않습니다.
스토어 권한 문구와 `PrivacyInfo.xcprivacy`는 이 실제 동작과 일치시킵니다.

---

## AI 처리 요약 (스토어 심사 노트용)

1. 모바일은 OpenAI API 키를 갖지 않으며, 서버만 호출합니다.
2. 전송 항목: 재료명·카테고리·수량/단위·보관 위치·유통기한·잔여 일수·추천 조건.
3. 서버 보관: 사용자가 추천 기록을 지우거나 계정을 정리할 때까지.
4. OpenAI: 기본 API는 모델 학습에 쓰지 않으며, abuse 모니터링 정책상 최대 약 30일
   보관될 수 있음(OpenAI 정책 변경 가능).
5. 동의: 첫 추천 전 고지 수락. 철회 후 신규 추천 차단. 기록 삭제는 별도.

공유 공간의 추천은 해당 공간 구성원에게 보이지만, AI 고지 동의·사용 한도·비용은
추천을 실행한 사용자에게 적용됩니다. 즐겨찾기는 개인 데이터로 유지됩니다.

고지 버전 환경변수: `AI_DATA_NOTICE_VERSION` (기본 `ai-data-notice-v2`).
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
