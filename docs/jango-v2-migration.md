---
status: active
owner: design
last_reviewed: 2026-09-29
source_of_truth: false
---

# 장고 v2 적용·검증 기록

## 변경 범위

2026-09-29 키트의 v3 PNG를 기반으로 캐릭터·공유 UI 색상·브랜딩을 함께 교체했다.
외부 참조 위치는 `/Users/namu/Documents/Codex/2026-09-29/JANGO-Character-Kit`다.
필요한 원본만 [제작 폴더](../design/jango/README.md)에 보존했으므로 빌드가 개인 Documents 경로에 의존하지 않는다.
형태·사용 정책은 [캐릭터 가이드 v2](./JANGO_CHARACTER_STYLE_GUIDE.md)가 정본이다.

- 8개 mood와 전용 윙크·양손 엄지척 아이콘. LOVE는 참조 전용이다.
- BIBLE 측정 근거인 이전 idle과 v3 적용 원본을 분리하고 해시를 기록했다.
- 추가 5개 포즈의 image_gen 참조 편집 지시문은 `design/jango/generated/prompts.json`에 있다.
- 1254px 정사각형 전체를 균일하게 1024px로 축소한다. 얼굴을 따로 늘이지 않는다.
- 전신·소형 각 3배율, 총 48개 파일을 생성한다. 소형 크롭 `(97, 0, 830)`은 유지한다.
- 공유 민트 50–900 단계, 아이보리 배경, 차콜 본문을 모바일·Admin에 반영했다.
- 컨트롤 테두리 `borderControl`을 `#7B887F`로 보정했다. 가장 어두운 적용 표면에서도 대비 3.07:1 이상이다.
- Admin의 레이어 없는 `a { color: inherit }`가 CTA 글자색을 덮어쓰던 문제를 base 레이어로 옮겼다.
- 앱 아이콘·adaptive·monochrome·알림 실루엣·88pt 스플래시·추적 중인 iOS 이미지를 재생성했다.
- Google Play 피처 그래픽과 App Store 세로 캠페인 이미지를 원본·토큰·Pretendard로 재현 가능하게 합성한다.

## 재생성

이번 검증 환경은 Node 21.4.0, Python 3.13, Pillow 11.3.0이었다. 저장소 CI의 Node 22 설정은 유지한다.
Pillow는 가상환경에 `pip install -r apps/mobile/scripts/requirements-artwork.txt`로 설치한다.

```sh
pnpm --filter @expirymate/shared build
pnpm --filter @expirymate/mobile mascot:sync
pnpm --filter @expirymate/mobile mascot:build
pnpm --filter @expirymate/mobile branding:sync
pnpm --filter @expirymate/mobile store:sync
pnpm --filter @expirymate/mobile mascot:audit
pnpm --filter @expirymate/mobile branding:audit
pnpm --filter @expirymate/mobile store:audit
```

원본 파일은 변경하지 않는다. 생성 포즈의 alpha=1/255 양자화 먼지만 manifest에 기록된 설정에 따라
파생 파일에서 제거한다. 기존 파생 검사는 해시·비율 유지·포즈별 경계·투명 여백·파일 규격·재생성 일치를 확인한다.
추가된 해부학적 검사는 원본의 얼굴 외곽·눈·입·볼터치를 별도로 측정한다.
전체 형태의 의미를 자동 판정하거나 새 원본을 자동 승인하는 것은 아니다.

## 완료한 자동 검증

아래 전체 테스트 수는 최초 교체 시점 기록이다. 이후 추가 제작 5종의
[해부학적 수치 검수](../design/jango/measurements/README.md)를 도입했다.
현재 아이콘 얼굴 비율·윙크 눈 폭은 미달이며 다른 포즈에도 재검토 항목이 남아,
`mascot:anatomy:audit` 및 이를 포함한 `mascot:audit`는 종료 코드 1을 반환한다.
이는 검사 코드 오류가 아닌 원화·측정 불확실성에 대한 판정이며, 이번 보완에서는 원화를 수정하지 않았다.

수치 검수 보완 후 shared build·문서·린트·타입 검사 및 전체 테스트는 통과했다.
shared 156개, API 509개, mobile 530개 — 총 1,195개 통과, 기존 API 4개 skip이다.
새 테스트는 합성 도형의 오류 검출과 측정 기록 재현성을 확인한다. 실제 원화의 기준 충족 여부는
별도 anatomy audit가 실패로 표시하며, 이 실패를 전체 테스트 통과와 혼동하지 않는다.
원본·런타임·브랜딩·스토어 PNG 81개의 작업 전후 해시가 동일함을 확인했다.

- shared build, 토큰 계약·대비 검사: 통과. 기본·눌림·선택·비활성 글자색과 초점·컨트롤 경계를 검사한다.
- 기존 파생 검사: 9개 제작 마스터, 48개 런타임, 소형 크롭 픽셀 불일치 0, 브랜딩 검사 통과. 신규 수치 검사는 위 상태를 따른다.
- 왜곡 입력·가장자리 잘림·오래된 파생 파일 거부 및 48개 재생성 테스트: 통과.
- `branding:audit`, `store:audit`: 통과. store audit은 규격뿐 아니라 새 합성 결과의 전체 픽셀과 비교한다.
- `pnpm docs:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`: 최종 통과.
  shared 155개, API 509개, mobile 519개 — 총 1,183개 통과, 기존 API 4개 skip.
  48개 런타임 재생성 테스트는 mood별로 나누되 픽셀 오차 0 조건을 그대로 유지한다.
- Android ARM64 debug native build: 통과. 로컬 설치 NDK 28.2를 임시 Gradle init script로 지정했다.
  저장소의 NDK 설정은 바꾸지 않았다. 오프라인 빌드 570개 task가 완료됐다.

## 시각 검증과 증거

로컬 증거는 gitignored `apps/mobile/e2e/results/jango-v2/`에 저장한다.
원본 결과와 실패 캡처를 함께 남기며 기존 회귀 기준선을 덮어쓰지 않는다.

- `mascot-sizes-before-after.png`: 이전/현재 8개 mood, 밝고 어두운 배경, 64/72/112/160px 비교.
- `admin/`: 로그인·대시보드·재료·제품·수익화 5개 실제 브라우저 캡처 및 `review.json`.
  브라우저 오류 0, 공유 CSS 변수 반영, CTA의 흰색 글자를 확인했다.
- `onboarding-default.png`, `login-default.png`: 기본 1080×2220 Android 화면 확인.
- `icon-sizes-review.png`: 전용 아이콘 원본을 밝고 어두운 배경에서 64/72/112/160px로 확인.
- `current/`: 6개 프로필 × 홈·보관함·추천·사진 등록·스캐너·오류·요리·장보기,
  총 48개 화면 진입·캡처. `current-capture-report.json`의 `ready`는 화면 진입 확인이며 시각 QA 전체 통과를 뜻하지 않는다.
- `baseline/`: 변경 전 HEAD를 별도 디렉터리에서 실행했다. 두 휴대폰 프로필의
  홈·보관함·추천 6개 비교에서 공통 testID의 경계 좌표 변경은 0이었다.
  `before-after-{home,inventory,recommendations}.png`와 `before-after-report.json`에 결과가 있다.
- 테두리 대비 보정 후 일반 휴대폰·작은 화면 큰 글자·가로 태블릿은 재촬영했다.
  다른 3개 프로필은 같은 캐릭터·팔레트에서 테두리 보정 직전에 촬영한 레이아웃 증거다.
- 최초 태블릿 회전 설정이 실제 프레임에 적용되지 않아 창 크기를 직접 지정한
  **1600×1200**으로 재촬영했다. 초기 1200×1600 프레임은 `tablet-portrait-initial/`에 따로 보존했다.

촬영은 별도 로컬 fixture DB/API를 사용했다. Expo 개발 환경이 `.env`를 별도 병합하는 동작은
임시 Metro 제외 설정으로 분리했고 저장소의 환경 파일은 변경하지 않았다.
Play 결제가 연결되지 않은 에뮬레이터의 `[Expo-IAP]` 개발 로그 오버레이만 촬영 중 제외했다.
이는 결제·카메라 인식·실제 기기 동작을 검증한 결과가 아니다.

큰 글자·좁은 화면의 긴 말풍선 줄바꿈은 변경 전 홈에서도 재현된다.
카메라 권한 안내의 긴 줄바꿈과 CTA 도달 가능성은 추가 개선·실기기 검증이 필요하다.
`existing-large-text-comparison.png`에 기존 증거를 남겼으며 해당 접근성 조합을 완전 통과로 표시하지 않았다.
앱의 기능·레이아웃 구조를 바꾸는 수정은 이번 캐릭터·팔레트 교체에 섞지 않았다.
초기 자동화 실패·System UI 일시 정지·재촬영 결과도 보존했고 기준선을 완화하지 않았다.

## 스토어·추가 상태 확인

새 묶음은 [2026-09-29 Jango v2 제출 후보](../store-assets/submissions/2026-09-29-jango-v2/README.md)에 있다.
합성 그래픽 2종을 포함한다. 새로 촬영했던 Android 실제 UI 1080×1920 스크린샷 6장은
사용자의 스크린샷 전용 롤백 요청으로 제출 묶음에서 제외했다. 기존 `output/marketing/` 제출 스크린샷은 그대로 유지한다.
새 캡처와 당시 manifest는 gitignored QA 폴더의 `rolled-back-store-screenshots/`에만 보존한다.
그래픽 2종과 캐릭터·아이콘·팔레트 변경은 이번 롤백 대상이 아니다.

추가로 `supplemental/completion.png`, `empty-home.png`, `empty-inventory.png`를 캡처해
완료·빈 상태 캐릭터를 확인했다. 빈 상태는 별도 로컬 계정을 실제 클라이언트 로그인 경로로 사용했다.
재료 넣기 시트는 로컬 QA 캡처 `rolled-back-store-screenshots/06-add-ingredients.png`에서 확인했다.

## 플랫폼 제약과 운영 반영

이 Mac은 Xcode 라이선스에 동의하지 않은 상태여서 iOS Simulator와 native build를 실행할 수 없었다.
따라서 iOS 화면 검증과 실제 iPhone 스토어 스크린샷 재촬영은 미완료다.
Android 에뮬레이터의 화면 크기 변경은 실제 태블릿·폴더블 하드웨어 검증을 대신하지 않는다.

기존 `output/marketing/`의 제출본·SNS·영상은 보존한다. 실제 배포·스토어 업로드는 실행하지 않았다.
`approve-mobile-layout-change` 라벨은 PR에서 캡처와 의도적 변경 사유를 검토한 뒤에만 사용한다.
이 작업은 PR이나 기준선 자동 승인을 생성하지 않았다.

롤백 시 `design/jango`, 캐릭터 가이드, shared 색상, 생성 스크립트·설정,
앱 마스터·runtime·브랜딩·스토어 파생 파일을 하나의 변경 단위로 되돌린다.
서버 계약·DB schema·브랜드명·기술 식별자는 변경하지 않았다.
