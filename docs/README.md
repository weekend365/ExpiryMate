---
status: active
owner: project
last_reviewed: 2026-08-29
source_of_truth: true
---

# 문서 인덱스

문서는 역할별 정본 하나를 원칙으로 합니다. `active` 문서는 현재 기준, `draft`는 확정 전,
`archived`는 역사적 참고입니다. 코드나 설정에서 자동으로 확인할 수 있는 정보는 문서에
복제하지 않고 해당 파일을 링크합니다.

## 프로젝트

| 문서 | 용도 | 담당 | 정본 |
|---|---|---|---|
| [프로젝트 현황](./STATUS.md) | 현재 Phase, P0/P1, 블로커 | product-release | Yes |
| [출시 로드맵](./ROADMAP.md) | 단계와 출시 인수 기준 | product-release | Yes |
| [프로젝트 안내](./PROJECT.md) | 기존 링크 호환용 허브 | project | No |
| [출시·업데이트 범위](./product/release-scope.md) | 현재와 이후 기능 경계 | product | Yes |

## 개발·운영

| 문서 | 용도 | 담당 | 정본 |
|---|---|---|---|
| [시크릿 설정](./dev-secrets.md) | Doppler, EAS, Railway, Cursor Cloud | platform | Yes |
| [배포·운영 런북](./operations/deployment.md) | migration, 배포, 장애 1차 대응 | platform | Yes |
| [iOS·EAS production](./ios-eas-production.md) | iOS capability, build, submit | mobile-release | Yes |
| [모바일 반응형 QA](./mobile-responsive-qa.md) | 글자·화면 크기 조합과 회귀 기준 | mobile-design | Yes |

## 제품·디자인

| 문서 | 용도 | 담당 | 정본 |
|---|---|---|---|
| [장고 캐릭터 스타일](./JANGO_CHARACTER_STYLE_GUIDE.md) | 캐릭터 제작과 사용 규칙 | design | Yes |
| [홈 빠른 동작 UX 개선안](./product/home-quick-actions-ux-improvements.md) | 홈 등록 진입과 바코드·사진 등록 흐름 개선 가설 | mobile-design | Draft |
| [수익화 운영 기준](./monetization.md) | 광고·파트너스 정책과 QA | product | Yes |

## 스토어 운영·업데이트

| 문서 | 상태 | 용도 |
|---|---|---|
| [메타데이터 초안](./store-metadata-draft.md) | Draft | 설명, 키워드, 심사 노트 |
| [개인정보 선언 대조표](./store-privacy-declarations.md) | Active | App Privacy·Data Safety 대조 |
| [스크린샷 제출 가이드](./store-screenshot-submission-guide.md) | Active | 촬영, 후가공, 제출 규격 |
| [개인 플러스 스토어 설정](./subscription-store-rollout.md) | Active | Apple·Google 상품, 알림, QA, rollout |

## 아카이브

완료·폐기·대체된 문서는 [`archive/`](./archive/README.md)에 보존합니다. 아카이브의
내용을 현재 의사결정 근거로 사용하지 않습니다.

## 문서 작성 규칙

`docs/`의 Markdown 문서는 다음 front matter를 사용합니다.

```yaml
---
status: active # draft | active | deprecated | archived
owner: team-or-domain
last_reviewed: YYYY-MM-DD
source_of_truth: true
---
```

- 문서 하나에는 한 가지 역할만 둡니다.
- 동일한 상세 정보를 여러 파일에 복사하지 않고 정본을 링크합니다.
- 외부 서비스 상태처럼 시점이 중요한 정보에는 `data_as_of`를 추가합니다.
- 완료된 실행 계획은 아카이브로 옮기고 활성 문서의 링크를 갱신합니다.
- 변경 후 `pnpm docs:check`로 메타데이터와 내부 링크를 검사합니다.
