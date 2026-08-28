# 장고야 부탁해 (Jango)

유통기한 기반 재고 관리, 만료 알림, AI 레시피 추천을 제공하는 한국어 우선 앱입니다.
모바일 사용자 화면, 운영 Admin, 단일 REST API를 pnpm monorepo로 관리합니다.

> 사용자 표시명은 **장고야 부탁해**, 마스코트는 **장고**입니다. 패키지와 bundle ID의
> `@expirymate/*`, `com.expirymate.mobile`은 호환성을 위해 유지합니다.

현재 출시 단계와 다음 작업은 [프로젝트 현황](./docs/STATUS.md), 전체 문서 탐색은
[문서 인덱스](./docs/README.md)를 확인하세요.

## 저장소 구성

| 경로 | 역할 | 주요 기술 |
|---|---|---|
| `apps/mobile` | 사용자 모바일 앱 | Expo, React Native, Expo Router |
| `apps/admin` | 내부 운영 도구 | Next.js App Router |
| `apps/api` | Mobile·Admin 공용 API | NestJS, Prisma, PostgreSQL |
| `packages/shared` | 공유 타입·스키마·유틸리티 | TypeScript, Zod |
| `docs` | 제품·디자인·운영 문서 | [문서 인덱스](./docs/README.md) |

## 요구사항

- Node.js 22
- pnpm 9.15
- PostgreSQL 16 또는 Docker
- 네이티브 스캐너 개발 시 Android Studio 또는 Xcode

## 처음 실행

### 1. 의존성 설치

```bash
pnpm install
```

### 2. 환경변수 준비

Doppler를 사용할 수 있다면 공유 `dev` 설정을 내려받습니다.

```bash
doppler secrets download -p expirymate-api -c dev --no-file --format env > apps/api/.env
doppler secrets download -p expirymate-admin -c dev --no-file --format env > apps/admin/.env.local
doppler secrets download -p expirymate-mobile -c dev --no-file --format env > apps/mobile/.env
```

Doppler 없이 실행할 때는 각 앱의 `.env.example`을 복사하고 필요한 값을 채웁니다.
환경별 정본과 안전 규칙은 [시크릿 설정 가이드](./docs/dev-secrets.md)를 따릅니다.

### 3. DB 준비

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

`prisma migrate dev`는 shadow database를 사용하므로 로컬 DB 사용자는 `CREATEDB` 권한이
필요합니다. 운영 DB에서는 `pnpm db:seed`를 실행하지 않습니다.

### 4. 앱 실행

모든 서비스를 함께 실행합니다.

```bash
pnpm dev
```

필요한 서비스만 실행할 수도 있습니다.

```bash
pnpm dev:api
pnpm dev:admin
pnpm dev:mobile
```

| 서비스 | 로컬 주소 |
|---|---|
| API | `http://localhost:4000` |
| API readiness | `http://localhost:4000/ready` |
| Admin | `http://localhost:3000` |
| Mobile | Expo가 출력하는 QR 또는 emulator |

실기기에서 Mobile을 실행할 때 `localhost`는 개발 PC가 아니라 휴대폰 자신을 가리킵니다.
`EXPO_PUBLIC_API_BASE_URL`에 같은 네트워크의 개발 PC 주소를 사용하고 Expo를 재시작하세요.

## 네이티브 스캐너

바코드와 OCR 스캐너는 Expo Go에서 동작하지 않습니다. development build 또는 EAS
빌드를 사용합니다. 영수증·냉장고 사진 일괄 등록도 카메라/앨범을 쓰므로 같은
네이티브 빌드가 필요합니다. API 플래그 `INVENTORY_PHOTO_PARSE_ENABLED`와 모바일
`EXPO_PUBLIC_INVENTORY_PHOTO_PARSE_ENABLED`는 기본 on이며, `false`/`0`/`off`를
명시하면 API와 모바일 진입점을 끌 수 있습니다. 두 환경의 값을 함께 맞추세요.

```bash
pnpm --filter @expirymate/mobile exec expo run:android
pnpm --filter @expirymate/mobile exec expo run:ios --device
```

사진 일괄 등록의 무료 1회·보상형 광고 3회 정책과 배포 절차는
[`docs/inventory-photo-parse-reward-policy.md`](./docs/inventory-photo-parse-reward-policy.md)를 참고하세요.

iOS 서명과 production 제출은 [iOS·EAS production 런북](./docs/ios-eas-production.md)을
확인하세요.

## 주요 명령

| 명령 | 용도 |
|---|---|
| `pnpm lint` | 전체 ESLint 검사 |
| `pnpm typecheck` | Prisma·shared를 포함한 전체 타입 검사 |
| `pnpm test` | 패키지별 테스트 |
| `pnpm docs:check` | 문서 메타데이터와 내부 링크 검사 |
| `pnpm validate:env-parity` | 환경변수 예시 간 키 정합성 검사 |
| `pnpm db:migrate:deploy` | 대상 DB에 production migration 적용 |
| `pnpm docker:up` | 로컬 Docker 서비스 시작 |
| `pnpm docker:down` | 로컬 Docker 서비스 종료 |

## 개발 원칙

- 인증된 사용자만 앱 기능에 접근합니다.
- 재고, 추천, 설정 API는 서버가 토큰과 공간 권한을 검증합니다.
- 날짜-only 유통기한은 사용자 달력 날짜로 다루며 임의의 UTC 변환을 피합니다.
- 실제 시크릿과 서비스 계정 파일은 커밋하지 않습니다.
- 배포와 migration은 [운영 런북](./docs/operations/deployment.md)을 따릅니다.
- 기능 범위가 바뀌면 [출시 범위](./docs/product/release-scope.md)와
  [프로젝트 현황](./docs/STATUS.md)을 함께 갱신합니다.

## 문서 바로가기

- [프로젝트 현황과 우선순위](./docs/STATUS.md)
- [출시 로드맵과 인수 기준](./docs/ROADMAP.md)
- [반응형 QA 기준](./docs/mobile-responsive-qa.md)
- [장고 캐릭터 스타일](./docs/JANGO_CHARACTER_STYLE_GUIDE.md)
- [수익화 운영 기준](./docs/monetization.md)
- [스토어 제출 문서](./docs/README.md#스토어-출시)
