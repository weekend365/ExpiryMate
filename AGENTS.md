# 장고야 부탁해 프로젝트 규칙

이 파일은 특정 에디터가 아닌 모든 개발자와 코딩 에이전트가 따르는 저장소 공통 규칙이다.
세부 제품·운영 정책은 `docs/README.md`에 연결된 활성 정본을 우선한다.

## 1. 프로젝트 정체성과 모노레포 경계

- 이 저장소는 `pnpm` workspace다: `apps/mobile`(Expo Router), `apps/admin`(Next.js App Router),
  `apps/api`(NestJS/Prisma), `packages/shared`(공유 계약·유틸리티).
- 사용자 표시명은 **장고야 부탁해**(EN: **Jango**), 캐릭터는 **장고**다. 패키지명,
  bundle ID, 환경 키 등 기존 기술 식별자의 `expirymate` 네임스페이스는 의도적인 migration
  없이는 바꾸지 않는다.
- 사용자 노출 문구는 자연스러운 한국어를 기본으로 하고 코드 식별자는 명확한 영어를 쓴다.
- 앱 사이에 공유되는 enum, label, Zod schema, model type, 순수 유틸리티는
  `packages/shared`를 정본으로 둔다. 앱에 같은 계약을 복제하지 않는다.
- `packages/shared`는 Nest, Prisma, Next, React Native, secret 또는 앱 런타임 코드에
  의존하지 않으며 공개 항목은 `packages/shared/src/index.ts`에서 export한다.

## 2. 보안·데이터·계약 불변 조건

- 비밀값은 서버 또는 해당 앱의 환경 파일에만 둔다. `.env` 파일과 비공개 키를 commit하거나
  클라이언트 번들, 로그, 오류 응답에 노출하지 않는다. 환경별 기준은
  [`docs/dev-secrets.md`](docs/dev-secrets.md)를 따른다.
- 사용자 데이터 API는 `AuthGuard`와 서버가 해석한 owner identity로 보호한다. 클라이언트가
  보낸 `ownerKey`를 권한 근거로 신뢰하지 않으며 모든 조회·변경을 소유자 또는 공간 권한으로
  제한한다.
- API 성공·실패 envelope, serializer, 공유 schema를 우회하는 앱별 응답 형태를 만들지 않는다.
  클라이언트 HTTP 호출은 기존 `apps/mobile/src/services/api.ts`와
  `apps/admin/src/lib/api.ts`를 통한다.
- Prisma 모델 변경에는 schema, 새 migration, serializer/shared contract, seed와 관련 테스트를
  같은 변경에 포함한다. 기존 migration을 다시 쓰지 않는다.
- production DB migration, backfill, 배포, 복구 작업은 사용자의 명시적 요청 없이 실행하지
  않는다. 실행 전 [`docs/operations/deployment.md`](docs/operations/deployment.md)의 백업·검증
  절차를 확인한다.
- 인증, 공유 공간, 알림, AI 비용 한도, 광고, 제휴, 구독, 구매 복원, 개인정보 동작은 현재
  정책을 임의로 바꾸지 않는다. 제품 범위는 [`docs/product/release-scope.md`](docs/product/release-scope.md),
  수익화는 [`docs/monetization.md`](docs/monetization.md)를 우선한다.

## 3. 앱별 최소 구현 원칙

- API는 `apps/api/src/modules/<domain>`에 두고 controller는 얇게, business logic과 persistence는
  service에 둔다. Prisma record는 공통 serializer를 거쳐 ISO 날짜와 공유 계약 형태로 반환한다.
- 프런트엔드 서버 상태는 TanStack Query로 관리한다. 안정적인 query key를 유지하고 mutation
  뒤 관련 query만 무효화한다. 서버 상태를 Zustand나 로컬 component state에 중복 저장하지 않는다.
- 공유 schema가 있으면 React Hook Form과 Zod를 재사용한다. 사용자 입력·응답을 타입 단언만으로
  신뢰하지 않는다.
- 모바일 화면은 `apps/mobile/app`, feature code는 `apps/mobile/src/features`, 공통 UI는
  `apps/mobile/src/components`에 둔다. 디자인 값은 `@expirymate/shared` token과 기존 공통
  component를 사용하며 행동·구성 기준은 [`docs/design-system.md`](docs/design-system.md)를
  따른다.
- 모바일은 큰 글자, safe area, keyboard, 작은 화면, 태블릿을 함께 고려한다. 반응형 기준은
  [`docs/mobile-responsive-qa.md`](docs/mobile-responsive-qa.md)를 따른다.
- 장고 에셋과 mood 사용은 [`docs/JANGO_CHARACTER_STYLE_GUIDE.md`](docs/JANGO_CHARACTER_STYLE_GUIDE.md)를
  따른다. 화면에서 캐릭터 PNG를 직접 import하거나 사용자 문구에 구 브랜드명을 노출하지 않는다.
- Admin은 `apps/admin/app`에 route, `apps/admin/src/features`에 feature UI,
  `apps/admin/src/components`에 재사용 UI를 둔다. 기존 CSS variable과 Tailwind 패턴을 따른다.

## 4. 변경 종류별 필수 검증과 개발환경

- 작은 변경부터 관련 테스트를 먼저 실행하고, 완료 전 가능한 범위에서 `pnpm docs:check`,
  `pnpm lint`, `pnpm typecheck`, `pnpm test`를 실행한다.
- service logic, ownership/role, auth/session, 알림, 구독, AI 비용 경로를 바꾸면 성공·거부·경계값
  테스트를 추가한다.
- shared schema/utility 변경은 shared build와 contract test를, Prisma 변경은 깨끗한 DB에
  `prisma migrate deploy`를, UI 변경은 관련 화면 test와 layout screenshot 비교를 확인한다.
- 의도적인 모바일 시각 변경에만 `approve-mobile-layout-change` 라벨을 사용하고 변경 전후 캡처와
  이유를 남긴다. 회귀 검사를 통과시키기 위한 우회 수단으로 사용하지 않는다.
- 생성 파일과 branding/runtime asset은 원본을 직접 덮어쓰지 않고 해당 `*:sync`, `*:build`,
  `*:audit` script를 사용한다.

로컬·Cloud 개발환경의 시크릿과 부팅 흐름은 [`docs/dev-secrets.md`](docs/dev-secrets.md)가
정본이다. Cursor Cloud를 사용할 때만 `.cursor/environment.json`의 install/start 설정을 사용한다.
Doppler `DOPPLER_TOKEN`이 있으면 `dev` config에서 앱별 gitignored env 파일을 생성한다. Postgres가
준비된 뒤 `pnpm db:migrate`를 실행하며 seed는 필요할 때만 사용한다.
