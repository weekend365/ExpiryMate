---
status: archived
owner: project
last_reviewed: 2026-08-25
source_of_truth: false
---

# 프로젝트 완료 기록 · 2026-07

2026년 7월 기준 완료 작업과 당시 release candidate 상태를 보존한 기록입니다.
현재 상태 판단에는 [`../STATUS.md`](../STATUS.md)를 사용하세요.

## 완료된 주요 작업

| 구분 | 항목 |
|---|---|
| 인프라 | Railway API·Admin·Postgres, Docker, `/health`, `/ready`, seed 가드 |
| CI | lint, typecheck, test, Prisma migration, API/Admin production build |
| 인증 | 카카오·네이버·구글·Apple·이메일, HTTPS callback과 앱 deep link |
| 메일 | Resend HTTP API, `mail.devnamu.com`, 가입 확인과 비밀번호 재설정 |
| 관측성 | API·Admin Sentry와 uptime, Mobile DSN 준비 |
| 스캐너 | 바코드 ProductMaster/OFF 조회, OCR 또는 수기 유통기한 prefill |
| 공유 공간 | 개인·가족·매장 공간, 3단계 역할, 이메일·1회용 코드 초대 |
| 디자인 | 모바일 리디자인과 장고 mood 에셋, Admin 토큰 동기화 |

상세 UI 작업 기록은 [`MOBILE_REDESIGN_PROMPTS.md`](./MOBILE_REDESIGN_PROMPTS.md)를
확인하세요.

## 2026-07-24 release candidate 스냅샷

| 플랫폼 | 당시 상태 |
|---|---|
| iOS | EAS production `1.0.0 (5)`를 App Store Connect에 업로드, 처리·실기기 QA 대기 |
| Android | EAS production AAB `1.0.0 (5)` 빌드 진행, manifest 검사와 internal 제출 대기 |

당시 자동 검증은 ESLint, 전체 typecheck, 환경 키 정합성, 269개 테스트를 통과했습니다.
이 수치는 현재 테스트 개수를 의미하지 않습니다.

## 공유 공간 구현 경계

- 사용자별 개인 공간과 소유자 멤버십 백필
- 공간별 데이터 격리와 역할 기반 권한
- SHA-256으로 보관하는 7일 유효 1회용 초대 코드
- 탭 진입·앱 복귀·당겨서 새로고침 기반 동기화
- 공유 재고를 보존하기 위한 계정 삭제·소유권 제한

당시 미완료 항목은 운영 migration, 두 실계정 공유 QA, 새 모바일 빌드의 역할별 UI와
공유 알림 실수신이었습니다.

## 2026-07-20 인증·메일 스냅샷

- `devnamu.com`과 발송용 `mail.devnamu.com` 구성
- Railway에서 Resend HTTP API 사용
- 이메일 가입·확인·재발송·비밀번호 재설정 UX 구현
- HTTPS 인증 링크에서 `expirymate://` 앱 링크로 복귀하는 브리지 구현

