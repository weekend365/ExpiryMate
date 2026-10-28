# 1.4.4 양대 스토어 출시 기록

**2026-10-28 최종 확인: 양대 스토어 전체 공개 완료.**
[최종 공개 확인](full-public-release.json)에서 iOS `1.4.4(66)`의 `READY_FOR_SALE`·공개
App Store 조회와 Android `1.4.4(47)`의 production `completed`(전체 사용자 제공)를 확인했다.
iOS 공개 시각은 10월 26일 06:27:30 KST다. Google 응답에는 정확한 게시 시각이 없어
확인 날짜만 기록한다. 이번 마무리에서는 새 빌드나 운영 변경을 수행하지 않았다.

장고 중심 디자인과 생활 공간 배경 6종·27개 화면을 포함하는 업데이트다.
원본·프롬프트·해시와 Web 검증은 [장고 적용 기록](../jango-character-20261025/README.md),
[배경 적용 기록](../backgrounds-20261025/README.md)을 따른다.

사용자는 2026-10-25 “그냥 양대 스토어에 바로 배포해줘.”에 이어 “바로 전체 공개해”를
명시했다. 이번 1.4.4는 추가 가격 조사·기기 검증 대기를 해제하고 스토어 심사 승인 후
전체 공개한다. 기존 TestFlight 가격 불일치와 새 디자인의 전체 네이티브 검증은 미통과로
남기며, [출시 지시와 한계](release-authorization.json)에 범위를 기록했다.
스토어 업로드·심사 제출·공개 완료를 각각 구분해 기록했다.

- 출시 버전: 1.4.4, QA 버전: 1.4.5. EAS 원격 빌드 번호 자동 증가 사용.
- [테스트 잔재 정리](test-fixture-cleanup.json): 원본과 동일한 테스트 파일 9개만 제거.
- [Android 운영 푸시 설정](android-production-client-config.json): 기존 비공개 클라이언트
  파일을 production·preview에 배정했다. 파일 내용·FCM 자격증명·접근 권한은 보존했다.
- 사전 검사: 문서·린트·타입·배경 원본 일치·장고 등록 검사를 통과했다.
  [로컬 검사](local-validation.json)와 [CI 결과](ci-status.json)를 구분한다. CI의 원화
  재현 검사 1건은 20초 제한을 초과했으며 통과로 바꾸거나 제한값을 늘리지 않았다.

가격은 StoreKit 응답을 그대로 표시한다. 미확인 가격을 환산하거나 운영 구독·국가·서버
설정으로 우회하지 않았다. API·DB 계약 변경은 없다.

## iOS 심사 제출

[iOS 1.4.4(66) 제출 기록](ios-review-submission.json)은 10월 25일의 `WAITING_FOR_REVIEW` 이력이다.
`AFTER_APPROVAL`이며 단계적 출시가 없어 승인 후 전체 공개한다.
[현재 App Store 상태](app-store-public-status.json)는 심사 `COMPLETE`·공개 `READY_FOR_SALE`다.
[최종 IPA 검사](ios-artifact.json)에서 출시 식별자·버전·운영 API·새 배경 6종을 확인했다.
첫 빌드 65의 최신 Xcode 오류와 SDK 54용 Xcode 26.0 재빌드는 [재빌드 기록](build-retry.json)에 둔다.
Android 47과 iOS 66의 앱 코드는 같고 iOS 빌드 이미지 설정 커밋만 다르다.
[로컬 검사](local-validation.json)는 장고 41·shared 162·API 618·mobile 679개 통과이며,
기본 제외되는 DB 6개와 미완료 기기 검증을 통과로 합산하지 않는다.
[운영 API 상태](production-readiness.json)는 main 연동 자동 배포 후 health·ready 200이다.

## Android 전체 공개

[Google Play production 조회](google-play-production.json)에서 버전 코드 `47`의
`status=completed`를 확인했다. [Google 공식 상태 정의](https://developers.google.com/android-publisher/api-ref/rest/v3/edits.tracks#Status)에
따라 전체 사용자에게 제공되는 상태다. 10월 25일 콘솔에서 출시율 100%·기존 대상 국가 전체를
선택하고 심사에 전송했으며 관리형 게시를 꺼 승인 후 자동 게시되도록 했다.
[최종 AAB 검사](android-artifact.json)는 출시 식별자·버전·운영 API·새 배경 6종·Firebase
앱 ID 리소스와 bundletool 검증을 확인했다. Google Play의 R8 가독화 파일 미첨부 경고는
출시를 막는 오류가 아니었으며 새 기능 검증 통과로 해석하지 않는다.

## 마무리 확인과 한계

[10월 28일 운영 확인](production-readiness-20261028.json)은 health·ready 200이다.
보존한 바이너리 해시를 다시 대조한 뒤 임시 빌드 체크아웃·바이너리·중간 로그를
[정리했다](cleanup.json).
원본 배경·출처·프롬프트·앱 runtime과 필요한 검증 기록은 저장소에 보존한다.
기존 TestFlight 가격 불일치, 전체 네이티브 검증과 CI 시간 초과는 미완료로 남긴다.
실제 공개 완료를 해당 검증 항목의 통과로 바꾸지 않는다.
