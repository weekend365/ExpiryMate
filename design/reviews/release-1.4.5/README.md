# 1.4.5 양대 스토어 출시 작업

2026-11-01 사용자가 변경사항 커밋·푸시·빌드·양대 스토어 배포를 요청했다.
직전 장고 크기 복원, 생활 공간 배경 v2, 사진 등록 전처리·인식 지침·중복 검토 수정을 포함한다.
출시 버전1.4.5, QA 버전1.4.6이며 EAS 원격 빌드 번호 자동 증가를 유지한다.
기존 판매 국가·구독·가격·상품·사용 한도·데이터 계약을 유지한다.

코드 검사와 스토어 업로드·심사 제출·공개 완료는 각각 확인해 기록한다.
EAS 제출은 명시적인 새 production 빌드 ID를 사용한다. iOS는 승인 후 전체 공개,
Android는 내부 트랙 업로드 후 동일 AAB를 production 전체 제공으로 제출하는 기존 경로를 따른다.
실제 공개 확인 전에는 출시 완료로 기록하지 않는다.

## 기존 검증과 한계

[사진 수정 검증](../photo-intake-quality-20261101/README.md): 전체1,533개 통과, 기존 DB6개 제외,
관련83개 통과, 실제 등록 컴포넌트의9개 글자·폭 조합 전후 확인.
실제 인식률 비교는 공개 사진15장 중7장만 동일 해시로 확보했고 로컬 API키401로 중단됐다.
모의 테스트를 실제 정확도 향상으로 해석하지 않는다. 새 모듈 포함 네이티브 설치본에서 회전·
사진 선명도·카메라·키보드·safe area 확인은 별도 검증 대상이다.
이전1.4.4의 TestFlight 가격 불일치 기록도 통과로 바꾸지 않는다.

[배경 검증](../background-quality-20261101/README.md),
[장고 크기 복원](../jango-size-rollback-20261101/README.md)을 보존한다.
Prisma schema/migration 변경은 없다. API main 연동 자동 배포의 SHA와 health/ready를 확인한다.
출력 상한 환경변수는 기존 값부터 확인하며 모델·비용·광고·구독 정책을 변경하지 않는다.

현재 문서는 작업 시작 기록이며 빌드·심사·공개 결과는 후속 기록에서 확정한다.

## iOS 버전 동기화

첫 Android48은1.4.5로 생성됐지만 iOS67의 EAS 메타데이터는 추적된 Info.plist의1.4.4였다.
iOS67은 스토어 제출 전에 취소했다. EAS production 환경에서 공식
`eas-sync-native-config.cjs`를 실행해 Info.plist의 버전 한 줄만1.4.5로 동기화했다.
Android48은 올바른 버전·앱 코드로 진행 중이므로 유지한다. 최종 iOS 재빌드와 Android48의
소스 차이는 iOS 버전 설정 및 출시 기록으로 한정하고, 앱 소스·배경은 동일한 해시로 확인한다.
Android 취소 시도는 자동 승인 검토가 불필요한 비용·진행 손실을 이유로 거절해 실행하지 않았다.

## 빌드·업로드·심사

Android1.4.5(48)와 iOS1.4.5(68) production 빌드를 완료했다.
[빌드·업로드 ID](builds-and-uploads.json), [Android 결과물](android-artifact.json),
[iOS 결과물](ios-artifact.json)에 버전·해시·운영 API·배경11종 일치를 기록한다.
iOS68의 요청 클라이언트가 오류를 표시했지만 원격 조회로 이미 정상 완료된 빌드를 확인해 재사용했다.
iOS IPA는 Apple에서 VALID 처리됐으며 [App Review 제출](ios-review-submission.json)은
WAITING_FOR_REVIEW·AFTER_APPROVAL이다. 이는 공개 완료가 아니다.

[CI 원본 결과](ci-status.json)는 원화 재현의 기존20초 제한 초과로 실패했다.
검사·ROI·판정·시간 제한은 유지하며 CI worker 경쟁만 줄이는 순차 실행으로 조정한다.
로컬 야간 실행도 타이머·worker 통신 제한을 초과했으므로 통과로 바꾸지 않는다.

## 남은 외부 조건

[Android 출시 권한](android-release-blocker.json): 내부 트랙48은completed이나 production
승격 요청에 Google403이 반환됐다. 권한을 확대하지 않았으며 브라우저 연결도 사용할 수 없다.
관리자 콘솔에서48을100%로 승격해 심사 제출하거나 관리자 브라우저 연결이 필요하다.
[사진 공급자 인증](photo-provider-blocker.json): 운영 키도401 invalid_api_key이며 사용자에게
Railway api/production 키 갱신을 요청했다. 모델·계약·비용 한도는 유지한다.
따라서 양대 스토어 공개 완료 및 사진 인식 실호출 검증 완료로 기록하지 않는다.
