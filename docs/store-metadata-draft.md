# App Store · 스토어 메타 초안 (장고야 부탁해)

App Store Connect **앱 정보 / 1.0 버전 / App Privacy / 심사 노트**에 그대로 옮기기 위한 초안입니다.  
Privacy Label 데이터 유형 근거: [`store-privacy-declarations.md`](./store-privacy-declarations.md)

> 법률 자문 아님. 제출 전 최신 제품 동작과 문구를 한 번 더 확인하세요.

---

## 1. URL (지금 바로 등록)

커스텀 도메인 전까지 Railway Admin HTTPS 사용.

| 용도 | URL |
|------|-----|
| Privacy Policy | `https://admin-production-da74.up.railway.app/privacy` |
| 데이터 삭제 / 선택 | `https://admin-production-da74.up.railway.app/privacy/choices` |
| Support (임시) | `https://admin-production-da74.up.railway.app/privacy/choices` |
| Marketing (없으면 비움 또는 Support와 동일) | 비워 두거나 Support와 동일 |

문의 메일(방침에 노출): `PRIVACY_CONTACT_EMAIL` / 운영 연락처와 동일하게 맞출 것.
인앱 고객 문의 수신: `SUPPORT_INBOX_EMAIL` (없으면 `PRIVACY_CONTACT_EMAIL`로 알림).

App Store Connect → **앱 정보**에 Privacy · Support URL을 위와 같이 넣습니다.
앱 안 문의: 설정 → **장고에게 물어보기** (티켓 저장 + 운영 메일 알림).

---

## 2. 버전 로컬라이제이션 (한국어)

### 이름
`장고야 부탁해` (30자 이내 · 이미 앱 레코드와 동일 권장)

### 부제목 (30자 이내)
`유통기한 챙기고, 오늘 뭐 해먹을지`

### 프로모션 텍스트 (170자 · 선택, 심사 없이 변경 가능)
```
냉장고 속 재료와 유통기한을 가볍게 기록하고, 임박한 재료로 오늘 요리를 추천받아요. 장고가 옆에 있는 기분으로.
```

### 설명
```
장고야 부탁해는 냉장고·팬트리 재료와 유통기한을 편하게 챙기고, 임박한 재료로 오늘의 요리를 추천받는 앱이에요.

• 재료와 유통기한을 직접 등록하거나, 바코드·유통기한 스캔으로 빠르게 넣어요
• 보관함에서 임박·만료 상태를 한눈에 살펴요
• 알림으로 유통기한 전에 부드럽게 알려 드려요
• 보관 재료를 바탕으로 장고가 요리 추천을 만들어 드려요 (동의 후 · 서버를 통해 AI 처리)
• 카카오, 네이버, 구글, Apple, 이메일로 로그인할 수 있어요

계정과 추천 기록은 설정에서 정리할 수 있어요. 개인정보 안내와 데이터 삭제 방법은 앱 안과 웹 방침에서 확인할 수 있어요.
```

### 키워드 (100자, 쉼표 구분, 공백 최소화)
```
유통기한,냉장고,재고,재료,요리추천,식재료,알림,바코드,팬트리,장고
```

### 새로운 기능 (1.0)
```
첫 버전이에요. 재료·유통기한 관리, 알림, 요리 추천을 한곳에서 시작해 보세요.
```

---

## 3. 스크린샷 촬영 가이드

필수: **iPhone 6.5"**(또는 Connect가 요구하는 최신 사이즈) 최소 1장, 권장 3~5장.

| 순서 | 화면 | 캡션 힌트 (이미지에 텍스트 오버레이 시) |
|------|------|----------------------------------------|
| 1 | 홈 (임박 요약 + 장고) | 오늘 냉장고 상태를 한눈에 |
| 2 | 보관함 목록 | 재료와 유통기한을 편하게 |
| 3 | 재료 등록 스텝 | 이름만 알려주시면 돼요 |
| 4 | 요리 추천 결과 | 임박 재료로 오늘 뭐 해먹을지 |
| 5 | 알림/설정 또는 로그인 | 놓치기 전에 알려 드려요 |

- 실기기 TestFlight에서 찍거나, 시뮬레이터 6.5"에 가까운 기종 사용
- 개인 이메일·실명·민감 메모가 안 보이게
- 다크 모드 아님(앱은 라이트 UI)

---

## 4. App Privacy (Nutrition Label) 입력 요지

**추적(Tracking):** 사용 안 함  
**광고 목적 수집:** 해당 없음 (MVP)

선언할 수집(요지):

| Label 유형 | 예시 | 목적 | 사용자에게 연결 / 추적 |
|------------|------|------|------------------------|
| Contact Info | 이메일 | App Functionality | 연결됨 / 추적 아님 |
| Identifiers | 사용자 ID, 기기(푸시 토큰) | App Functionality | 연결됨 / 추적 아님 |
| User Content | 재료·유통기한·추천 관련 내용·고객 문의 본문 | App Functionality | 연결됨 / 추적 아님 |
| Purchases | (IAP 검증 시) 구매 이력 | App Functionality | 연결됨 / 추적 아님 |

제3자: 호스팅·메일 수탁·**OpenAI(미국, 추천 시)** · OAuth 제공자 · Expo Push.  
상세는 `store-privacy-declarations.md` 표와 `/privacy` 본문을 따릅니다.

카메라: 바코드/OCR용 — Privacy Label의 “Photos” 라이브러리와 혼동하지 말 것. 카메라 사용은 권한 문구로 설명.

---

## 5. 심사 노트 (Review Notes) — 복사해서 붙여넣기

```
【앱 개요】
장고야 부탁해(Jango)는 식재료·유통기한 관리와 AI 요리 추천 앱입니다. 로그인이 필요합니다.

【데모 계정】
가능하면 아래를 사용하거나, Sign in with Apple / 카카오 로그인을 이용해 주세요.
- (제출 전 심사 전용 이메일 계정·비밀번호를 여기에 기입)

【Sign in with Apple】
카카오·네이버·구글 등 제3자 로그인을 제공하므로 Sign in with Apple을 함께 제공합니다. TestFlight에서 검증했습니다.

【AI 추천】
- 클라이언트에 OpenAI API 키 없음. 서버만 호출합니다.
- 첫 추천 전 AI 데이터 고지 동의가 필요합니다.
- 전송: 재료명·카테고리·수량/단위·보관위치·유통기한·잔여일·추천 조건.
- 동의 철회·추천 기록 삭제·계정 삭제는 설정 → 개인정보와 추천 안내에서 가능합니다.
- Privacy: https://admin-production-da74.up.railway.app/privacy
- Choices / 삭제 안내: https://admin-production-da74.up.railway.app/privacy/choices

【계정 삭제】
설정 → 개인정보와 추천 안내 → 계정 정리(삭제). 서버에서 재고·추천·토큰 등을 삭제합니다.

【카메라】
바코드·유통기한 스캔(OCR)에만 사용합니다. Expo Go가 아닌 스토어/TestFlight 빌드에서 동작합니다.

【구독】
네이티브 구매 UI는 아직 없습니다. 서버 영수증 검증 API만 준비되어 있습니다. (해당 없으면 “In-App Purchases 없음”으로 맞춰 주세요.)
```

---

## 6. App Store Connect 작업 순서

1. **앱 정보** — Privacy / Support URL
2. **App Privacy** — 위 요지로 질문 응답 저장
3. **1.0 준비 중** — 한국어 설명·키워드·스크린샷·빌드 선택(TestFlight 통과 빌드)
4. **심사 정보** — 연락처, 데모 계정, 위 심사 노트
5. **심사에 추가** → 제출

---

## 7. 남은 준비물 체크

- [ ] Support/Privacy URL이 브라우저에서 열리는지
- [ ] 심사 전용 데모 이메일 계정 준비(또는 Apple 로그인만으로 가능한지 명시)
- [ ] 6.5" 스크린샷 3장 이상
- [ ] App Privacy 질문 저장
- [ ] 연령 등급·수출 규정(암호화: 앱은 `usesNonExemptEncryption: false` 설정됨)
- [ ] (병행) Play Data Safety는 같은 표로 Android 때 작성
