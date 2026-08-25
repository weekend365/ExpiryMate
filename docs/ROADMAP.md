---
status: active
owner: product-release
last_reviewed: 2026-08-25
source_of_truth: true
---

# 출시 로드맵과 인수 기준

제품 단계와 각 단계의 완료 조건을 관리합니다. 지금 해야 할 일과 블로커는
[`STATUS.md`](./STATUS.md)가 정본입니다.

## 단계

| Phase | 목표 | 완료 조건 |
|---|---|---|
| 0 ✅ | 외부 접속 가능 | Railway API/Admin/DB, readiness, CI, 인증 하드닝 |
| 1 ✅ | 실사용 검증 | 핵심 실기기 QA, uptime, API/Admin Sentry, 이메일·소셜 인증 |
| 2 👈 | 스토어 공개 | 운영 migration, 공유 2계정 QA, production 빌드, 스토어 승인 |
| 3 | 안정 운영 | 알림, 백업, 비용 한도, 장애 런북 검증 |
| 4 | 수익화·성장 | 수익화 rollout, 카탈로그, 분석, 실시간 협업 검토 |

## Phase 2 인수 기준

- [ ] Railway 공유 공간 migration 적용과 기존 데이터 백필 확인
- [ ] 공유 기능 포함 iOS production 빌드와 TestFlight QA
- [ ] Android production AAB internal QA와 Play Console 제출 준비
- [ ] 두 계정 공유 시나리오와 로그인·스캔·추천·삭제 회귀 QA
- [ ] App Store Privacy Label과 Play Data Safety 대조
- [ ] Support URL, 스크린샷, 설명, 심사 노트 확정
- [x] 초대 개인정보 보관·삭제 정책과 공개 방침 일치
- [x] Sign in with Apple TestFlight 검증

## 두 계정 필수 시나리오

- A가 가족 또는 매장 공간을 만들고 B를 이메일 또는 1회용 코드로 초대
- 미가입·로그아웃 상태의 B가 가입 또는 로그인 후 초대 흐름으로 복귀
- 초대 취소·만료·재사용 차단과 동시 수락 1명 성공
- A/B가 등록·수정·소진한 재고가 진입·복귀·새로고침 시 일치
- 소유자·관리자·구성원의 UI와 API 권한이 동일하게 제한
- 초대 알림 기본값, 공간별 알림, 나가기·제거·소유권 이전 검증
- 계정 삭제가 다른 구성원의 공유 재고를 제거하지 않음

## 출시 실행 순서

1. 운영 DB 백업과 복구 가능 여부를 확인합니다.
2. API migration을 적용하고 `/ready`와 백필 누락을 확인합니다.
3. iOS TestFlight와 Android internal release candidate를 배포합니다.
4. 두 계정 공유 QA와 기존 핵심 기능 회귀를 완료합니다.
5. 고정된 빌드 기준으로 스토어 문구와 개인정보 선언을 대조해 제출합니다.

## Go / No-Go

**Go:** migration·백필 정상, `/ready` 200, 초대·역할·공유 재고 검증 통과,
기존 핵심 기능 회귀 없음, 스토어 선언과 실제 동작 일치.

**No-Go:** migration 누락, 다른 공간 데이터 노출, 권한 우회, 초대 이메일 불일치 수락,
새 빌드 크래시, 계정 삭제로 공유 데이터가 예기치 않게 제거되는 경우.

