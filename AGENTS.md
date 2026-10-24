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
- 모바일 화면·사용자 흐름·장고 상호작용·공유 디자인 토큰을 작업하기 전에
  [`docs/design-system.md`](docs/design-system.md)의 변경 범위·보존 기준을 먼저 읽는다. 기본값은
  기존 UI/UX 보존이며 손그림 스타일은 캐릭터·배경 이미지에만 적용한다. 카드·말풍선·버튼·
  제목·기능 아이콘·UI 글꼴에는 그림체를 확장하지 않는다. 탭·정보 묶음·조작
  위치·입력 단계 변경은 해당 범위의 명시적 요청이 있을 때만 수행한다. 철회한 전체 개편을
  자동 재개하지 않는다. 공통 기본값 변경 전 영향 화면을 확인하고 대표 화면 전후 검토 후
  요청 범위에 적용한다. 변경 기록에는 보존 요소·변경 요소·주요 상태·접근성 확인 결과를 남긴다.
- 모바일은 큰 글자, safe area, keyboard, 작은 화면, 태블릿을 함께 고려한다. 반응형 기준은
  [`docs/mobile-responsive-qa.md`](docs/mobile-responsive-qa.md)를 따른다.
- 장고 에셋과 mood 사용은 [`docs/JANGO_CHARACTER_STYLE_GUIDE.md`](docs/JANGO_CHARACTER_STYLE_GUIDE.md)를
  따른다. 화면에서 캐릭터 PNG를 직접 import하거나 사용자 문구에 구 브랜드명을 노출하지 않는다.
- 장고의 활성 제작 기준은 [v18 원본 32종](design/jango/emoticons/kakao-32/v18/source-originals)이며
  [활성 참조](design/jango/style-master.json)는 [v18 등록 기록](design/jango/masters/v18/master.json)을 가리킨다.
  앱·브랜딩·이모티콘·SNS·영상의 신규 장고는 24번과 해당 원화의 크레파스 선·불투명 색면·민트·차콜·살구 볼터치·약한 종이 결을 따른다.
  [MASTER 목록](design/jango/master-set.json)의 원본 바이트·출처·해시와 기존 검수는 보존한다.
  [BIBLE](design/jango/reference/JANGO-CHARACTER-BIBLE.md)·[STYLE GUIDE](design/jango/reference/JANGO-STYLE-GUIDE.md)와
  [채택 범위](design/jango/reference/STYLE-MASTER-ADOPTION.md)를 따른다. 장면의 여성·배경·대사는 필수 요소가 아니다.
  장고는 다정하지만 허당인 생활 친구다. v21에서 반영한 성격·이모티콘 표현 확장은 BIBLE을 따른다.
  기본형 재현의 얼굴 좌표·입 네 모드를 모든 표현의 상한으로 삼지 않는다. 새 표현은 의도를 기록해 검토하고,
  잘 작동하는 원화·문구는 재사용한다. 서체 비교·공통 글자 크기·감정별 문구 배치·작은 출력 검토는 STYLE GUIDE를 따른다.
  기존 앱 기본·아이콘·스플래시는 v18 24번 파생을 유지한다. v19 교체는 중단했고 자동 재개하지 않는다.
  새 앱 작화와 문구 포함 이모티콘은 모자부터 두 신발까지 전신을 기본으로 하며 자연스러운 가림은 허용한다.
  문구 공간 때문에 하반신을 자르지 않고 기존 원본의 하반신 프레이밍은 덮어쓰지 않는다.
  제작·수정 전 [검수 안내](design/jango/quality/README.md)의 매체별 준비와 실제 참조·해시 기록을
  따른다. 현행 이모티콘·스타일 참조 후보는 `jango:prepare`를 사용한다. SNS 카툰은 BIBLE의
  표현 확장에 따라 표정·입·포즈·소품·의상·비율·반전·색 변형을 별도 후보로 제작하고
  구조·질감·캐릭터 인지를 검토·보정한 뒤 사용자의 SNS 채택 범위에서 재사용한다.
  활성 v18 MASTER·해당 표정/포즈·매체별 승인 참조의 역할을 구분하고 채택 파생본도 원본까지 계보를 남긴다.
  신규 jango:prepare는 handdrawn-crayon을 기본으로 쓰고 colored-pencil은 과거 감사 전용으로 남긴다.
  사용자 MASTER 채택·앱 사용 허용·SNS 채택·서명된 이모티콘 출시는 구분한다.
  불확실한 측정을 통과로 처리하지 않고, 이모티콘 최종 출력은 `jango:promote`·`jango:export`를 사용한다.
  에이전트는 검수 서명을 만들거나 통과를 위해 ROI·수치·신뢰 키를 변경하지 않는다.
- SNS 카툰 연재는 [승인 v6·현행 제작 정책](design/jango/cartoon-series.json)과
  [카툰 릴스 제작·검수 정본](design/jango/reference/SNS-CARTOON-GUIDE.md)을 따른다. 신규 기본 형식은 처음부터
  9:16으로 구성한 1080×1920 카툰 릴스이며 가벼운 확대 또는 이동·고정 말풍선/대사·사용 권한이 확인된 BGM을 쓴다.
  기본 BGM은 **Monkeys Spinning Monkeys — Kevin MacLeod**다. [음원·사용 근거](design/jango/audio/monkeys-spinning-monkeys/license.json)를
  재사용하고 회차별 구간·편집·CC BY 4.0 크레딧을 기록한다. 사용자가 다른 음악을 지정하면 해당 요청을 우선한다.
  캐러셀은 별도 요청 시 제작한다. v18은 캐릭터 정본, v6는 장면 통합·이야기·한글·앱 효용의 품질 참조다.
  v6의 4:5 구도·2화의 여백 삽입 변환·철회된 v1/v2 단순 콜라주를 신규 기본값으로 되살리지 않는다.
  실제 승인 참조·공식 imagegen 작화·별도 한글 조립·기능과 예시 구분을 지키고, 콘티 확인 후 제작한다.
  원본·360×640 전체 재생·Instagram UI 겹침·프로필 커버·음악 권한/음향을 검수하고 승인 범위에 따라 게시한다.
  기존 원본·승인 해시는 보존하며 현행 규격과 가이드 해시는 `currentProductionPolicy`에서 확인한다.
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
- 화면 검토의 임시 캡처·UI 구조 XML·중복 이미지·철회된 시안은 확인 후 정리한다. 전후 비교에
  필요한 최소 화면과 결정 기록, 활성 원본·출처·회귀 검사 자료는 남기고 삭제 전 참조와 해시를 확인한다.
  새 임시 자료는 가능하면 저장소 밖의 임시 경로에 만들고, 검토가 끝난 뒤 필요한 결과만 보존한다.
- 생성 파일과 branding/runtime asset은 원본을 직접 덮어쓰지 않고 해당 `*:sync`, `*:build`,
  `*:audit` script를 사용한다.

로컬·Cloud 개발환경의 시크릿과 부팅 흐름은 [`docs/dev-secrets.md`](docs/dev-secrets.md)가
정본이다. Cursor Cloud를 사용할 때만 `.cursor/environment.json`의 install/start 설정을 사용한다.
Doppler `DOPPLER_TOKEN`이 있으면 `dev` config에서 앱별 gitignored env 파일을 생성한다. Postgres가
준비된 뒤 `pnpm db:migrate`를 실행하며 seed는 필요할 때만 사용한다.
