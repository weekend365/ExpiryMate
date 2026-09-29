# 추가 포즈의 BIBLE 수치 검수

`mascot:measure`로 생성한 기록. 원화 수정·자동 승인을 수행하지 않는다.

실측값의 범위 내 여부와 오차를 고려한 최종 판정은 구분한다. ±3px/1024px의 좌표 관찰 오차를 원본 크기로 환산하고, 두 경계의 차이인 분자·분모에 각각 ±2배를 전파한 보수적 구간이다. 통계적 신뢰구간이나 원근 복원 결과는 아니다. 허용 범위는 넓히지 않는다.

키트 포즈의 기존 측정은 ../kit-v3/manifest.json에 보존한다. 이 문서는 추가 제작한 5종만 직접 측정한 결과다.

## 측정 입력과 시각 증거

[입력·영역·원본 해시](./inputs.json) · [전체 수치·좌표·판정](./results.json) · [측정 방법과 한계](./README.md)

겹쳐 그린 선: 파랑=외곽 선택 영역, 청록=추출한 외곽 픽셀, 자홍=얼굴 좌표틀, 주황=표정 선택 영역, 빨강=측정한 표정 경계·중심.

## empty: needs-review

[측정선 이미지](./overlays/empty.png)

원본 SHA-256: `13e76d3b481f4e1a46d27d6b897818f66c45f5f9c6bb27c5449ff13dcae8eabd`. 얼굴 폭 616.317900px, 높이 483.063524px, 외곽 기준 회전 0.664037°.

| 항목 | 실측값 | BIBLE 범위 | 오차 구간 | 실측값 범위 내 여부 | 최종 판정 |
| --- | ---: | --- | --- | --- | --- |
| face.width/height | 1.275853 | 1.254400–1.305600 | 1.241754–1.311004 | within-range | needs-review |
| leftEye.width/W | 0.105552 | 0.097850–0.108150 | 0.092527–0.118891 | within-range | needs-review |
| leftEye.height/W | 0.149452 | 0.150100–0.165900 | 0.135910–0.163321 | outside-range | needs-review |
| leftEye.u | 0.321288 | 0.308000–0.338000 | 0.305722–0.337230 | within-range | needs-review |
| leftEye.v | 0.500452 | 0.488000–0.528000 | 0.477972–0.523628 | within-range | needs-review |
| rightEye.width/W | 0.105646 | 0.097850–0.108150 | 0.092620–0.118987 | within-range | needs-review |
| rightEye.height/W | 0.151149 | 0.150100–0.165900 | 0.137587–0.165039 | within-range | needs-review |
| rightEye.u | 0.709246 | 0.696000–0.726000 | 0.689109–0.729870 | within-range | needs-review |
| rightEye.v | 0.522687 | 0.488000–0.528000 | 0.499873–0.546206 | within-range | needs-review |
| eyeSpacing/W | 0.387958 | 0.376000–0.400000 | 0.371606–0.404705 | within-range | needs-review |
| mouth.u | 0.511420 | 0.498000–0.528000 | 0.493614–0.529657 | within-range | needs-review |
| mouth.v | 0.616274 | 0.569000–0.619000 | 0.592058–0.641238 | within-range | needs-review |
| mouth.width/W | 0.136397 | 0.090000–0.130000 | 0.123009–0.150109 | outside-range | needs-review |
| leftCheek.width/W | 0.120135 | 0.106931–0.130693 | 0.106938–0.133650 | within-range | needs-review |
| leftCheek.height/F | 0.095315 | 0.086802–0.106091 | 0.078905–0.112233 | within-range | needs-review |
| leftCheek.u | 0.237323 | 0.229000–0.259000 | 0.222746–0.252253 | within-range | needs-review |
| leftCheek.v | 0.638391 | 0.635000–0.675000 | 0.613843–0.663697 | within-range | needs-review |
| rightCheek.width/W | 0.120192 | 0.106931–0.130693 | 0.106994–0.133707 | within-range | needs-review |
| rightCheek.height/F | 0.093485 | 0.086802–0.106091 | 0.077102–0.110375 | within-range | needs-review |
| rightCheek.u | 0.784487 | 0.777000–0.807000 | 0.763463–0.806018 | within-range | needs-review |
| rightCheek.v | 0.678878 | 0.637000–0.677000 | 0.653724–0.704809 | outside-range | needs-review |

## worry: needs-review

[측정선 이미지](./overlays/worry.png)

원본 SHA-256: `c5a017c9f048914ccb5ab30c87be83ff791b413a2f35c9452d92d59fb35f90c1`. 얼굴 폭 618.065262px, 높이 482.470006px, 외곽 기준 회전 0.887757°.

| 항목 | 실측값 | BIBLE 범위 | 오차 구간 | 실측값 범위 내 여부 | 최종 판정 |
| --- | ---: | --- | --- | --- | --- |
| face.width/height | 1.281044 | 1.254400–1.305600 | 1.246826–1.316320 | within-range | needs-review |
| leftEye.width/W | 0.103762 | 0.097850–0.108150 | 0.090795–0.117042 | within-range | needs-review |
| leftEye.height/W | 0.147542 | 0.142200–0.165900 | 0.134060–0.161348 | within-range | needs-review |
| leftEye.u | 0.322730 | 0.308000–0.338000 | 0.307190–0.338644 | within-range | needs-review |
| leftEye.v | 0.498167 | 0.488000–0.528000 | 0.475694–0.521336 | within-range | needs-review |
| rightEye.width/W | 0.105129 | 0.097850–0.108150 | 0.092146–0.118425 | within-range | needs-review |
| rightEye.height/W | 0.149160 | 0.142200–0.165900 | 0.135659–0.162986 | within-range | needs-review |
| rightEye.u | 0.709092 | 0.696000–0.726000 | 0.689013–0.729654 | within-range | needs-review |
| rightEye.v | 0.524655 | 0.488000–0.528000 | 0.501784–0.548233 | within-range | needs-review |
| eyeSpacing/W | 0.386362 | 0.376000–0.400000 | 0.370074–0.403041 | within-range | needs-review |
| mouth.u | 0.507950 | 0.498000–0.528000 | 0.490234–0.526092 | within-range | needs-review |
| mouth.v | 0.595493 | 0.569000–0.619000 | 0.571559–0.620167 | within-range | needs-review |
| mouth.width/W | 0.128029 | 0.090000–0.130000 | 0.114776–0.141600 | within-range | needs-review |
| leftCheek.width/W | 0.118272 | 0.106931–0.130693 | 0.105134–0.131726 | within-range | needs-review |
| leftCheek.height/F | 0.093677 | 0.086802–0.106091 | 0.077271–0.110590 | within-range | needs-review |
| leftCheek.u | 0.239528 | 0.229000–0.259000 | 0.224965–0.254441 | within-range | needs-review |
| leftCheek.v | 0.638818 | 0.635000–0.675000 | 0.614234–0.664162 | within-range | needs-review |
| rightCheek.width/W | 0.119890 | 0.106931–0.130693 | 0.106733–0.133363 | within-range | needs-review |
| rightCheek.height/F | 0.095524 | 0.086802–0.106091 | 0.079090–0.112466 | within-range | needs-review |
| rightCheek.u | 0.786097 | 0.777000–0.807000 | 0.765113–0.807586 | within-range | needs-review |
| rightCheek.v | 0.676553 | 0.637000–0.677000 | 0.651403–0.702480 | within-range | needs-review |

## speak: needs-review

[측정선 이미지](./overlays/speak.png)

원본 SHA-256: `bfccbdb69d9f309679d7fd9ac66ed0c6d2e47ecfef7ef8779dde42bab404b760`. 얼굴 폭 629.000000px, 높이 488.000000px, 외곽 기준 회전 0.000000°.

| 항목 | 실측값 | BIBLE 범위 | 오차 구간 | 실측값 범위 내 여부 | 최종 판정 |
| --- | ---: | --- | --- | --- | --- |
| face.width/height | 1.288934 | 1.254400–1.305600 | 1.254982–1.323925 | within-range | needs-review |
| leftEye.width/W | 0.103339 | 0.097850–0.108150 | 0.090599–0.116380 | within-range | needs-review |
| leftEye.height/W | 0.158983 | 0.150100–0.165900 | 0.145600–0.172681 | within-range | needs-review |
| leftEye.u | 0.322734 | 0.308000–0.338000 | 0.307461–0.338369 | within-range | needs-review |
| leftEye.v | 0.509221 | 0.488000–0.528000 | 0.486835–0.532293 | within-range | needs-review |
| rightEye.width/W | 0.104928 | 0.097850–0.108150 | 0.092170–0.117988 | within-range | needs-review |
| rightEye.height/W | 0.157393 | 0.150100–0.165900 | 0.144029–0.171073 | within-range | needs-review |
| rightEye.u | 0.709857 | 0.696000–0.726000 | 0.690114–0.730067 | within-range | needs-review |
| rightEye.v | 0.510246 | 0.488000–0.528000 | 0.487844–0.533333 | within-range | needs-review |
| eyeSpacing/W | 0.387122 | 0.376000–0.400000 | 0.371106–0.403518 | within-range | needs-review |
| mouth.u | 0.511129 | 0.498000–0.528000 | 0.493680–0.528990 | within-range | needs-review |
| mouth.v | 0.606557 | 0.569000–0.619000 | 0.582727–0.631117 | within-range | needs-review |
| mouth.width/W | 0.127186 | 0.100000–0.150000 | 0.114171–0.140509 | within-range | pass |
| mouth.height/F | 0.112705 | 0.080000–0.130000 | 0.096200–0.129715 | within-range | pass |
| leftCheek.width/W | 0.119237 | 0.106931–0.130693 | 0.106313–0.132466 | within-range | needs-review |
| leftCheek.height/F | 0.096311 | 0.086802–0.106091 | 0.080050–0.113071 | within-range | needs-review |
| leftCheek.u | 0.244833 | 0.229000–0.259000 | 0.230459–0.259546 | within-range | needs-review |
| leftCheek.v | 0.655738 | 0.635000–0.675000 | 0.631178–0.681049 | within-range | needs-review |
| rightCheek.width/W | 0.119237 | 0.106931–0.130693 | 0.106313–0.132466 | within-range | needs-review |
| rightCheek.height/F | 0.094262 | 0.086802–0.106091 | 0.078031–0.110990 | within-range | needs-review |
| rightCheek.u | 0.790143 | 0.777000–0.807000 | 0.769473–0.811302 | within-range | needs-review |
| rightCheek.v | 0.658811 | 0.637000–0.677000 | 0.634206–0.684169 | within-range | needs-review |

## point: needs-review

[측정선 이미지](./overlays/point.png)

원본 SHA-256: `ecce2f8b79bcbe2c6568cac3eab825b4419f6361692994ad9756a9b7d905c985`. 얼굴 폭 627.458775px, 높이 489.350597px, 외곽 기준 회전 -0.399396°.

| 항목 | 실측값 | BIBLE 범위 | 오차 구간 | 실측값 범위 내 여부 | 최종 판정 |
| --- | ---: | --- | --- | --- | --- |
| face.width/height | 1.282227 | 1.254400–1.305600 | 1.248466–1.317018 | within-range | needs-review |
| leftEye.width/W | 0.103834 | 0.097850–0.108150 | 0.091058–0.116914 | within-range | needs-review |
| leftEye.height/W | 0.159436 | 0.150100–0.165900 | 0.146016–0.173174 | within-range | needs-review |
| leftEye.u | 0.322259 | 0.308000–0.338000 | 0.306954–0.337926 | within-range | needs-review |
| leftEye.v | 0.506308 | 0.488000–0.528000 | 0.484025–0.529270 | within-range | needs-review |
| rightEye.width/W | 0.105339 | 0.097850–0.108150 | 0.092545–0.118436 | within-range | needs-review |
| rightEye.height/W | 0.159425 | 0.150100–0.165900 | 0.146005–0.173163 | within-range | needs-review |
| rightEye.u | 0.708740 | 0.696000–0.726000 | 0.688962–0.728987 | within-range | needs-review |
| rightEye.v | 0.509805 | 0.488000–0.528000 | 0.487470–0.532820 | within-range | needs-review |
| eyeSpacing/W | 0.386481 | 0.376000–0.400000 | 0.370433–0.402910 | within-range | needs-review |
| mouth.u | 0.512372 | 0.498000–0.528000 | 0.494867–0.530292 | within-range | needs-review |
| mouth.v | 0.594616 | 0.569000–0.619000 | 0.571026–0.618924 | within-range | pass |
| mouth.width/W | 0.130794 | 0.114300–0.139700 | 0.117705–0.144193 | within-range | needs-review |
| mouth.height/F | 0.092512 | 0.077400–0.094600 | 0.076350–0.109166 | within-range | needs-review |
| leftCheek.width/W | 0.118011 | 0.106931–0.130693 | 0.105070–0.131258 | within-range | needs-review |
| leftCheek.height/F | 0.094242 | 0.086802–0.106091 | 0.078055–0.110923 | within-range | needs-review |
| leftCheek.u | 0.241017 | 0.229000–0.259000 | 0.226652–0.255721 | within-range | needs-review |
| leftCheek.v | 0.650661 | 0.635000–0.675000 | 0.626243–0.675824 | within-range | needs-review |
| rightCheek.width/W | 0.122781 | 0.106931–0.130693 | 0.109785–0.136085 | within-range | needs-review |
| rightCheek.height/F | 0.094228 | 0.086802–0.106091 | 0.078041–0.110908 | within-range | needs-review |
| rightCheek.u | 0.790015 | 0.777000–0.807000 | 0.769297–0.811225 | within-range | needs-review |
| rightCheek.v | 0.655568 | 0.637000–0.677000 | 0.631077–0.680806 | within-range | needs-review |

## icon-crop: fail

[측정선 이미지](./overlays/icon-crop.png)

원본 SHA-256: `73e96854683f9c76ea328989a8a19a5a6d6bde4b3437be23848e35f04a178eb7`. 얼굴 폭 757.509767px, 높이 556.530859px, 외곽 기준 회전 -0.336585°.

| 항목 | 실측값 | BIBLE 범위 | 오차 구간 | 실측값 범위 내 여부 | 최종 판정 |
| --- | ---: | --- | --- | --- | --- |
| face.width/height | 1.361128 | 1.254400–1.305600 | 1.330361–1.392718 | outside-range | fail |
| leftEye.width/W | 0.105716 | 0.097850–0.108150 | 0.095094–0.116546 | within-range | needs-review |
| leftEye.height/W | 0.155841 | 0.150100–0.165900 | 0.144737–0.167162 | within-range | needs-review |
| leftEye.u | 0.316612 | 0.308000–0.338000 | 0.303964–0.329508 | within-range | needs-review |
| leftEye.v | 0.529993 | 0.488000–0.528000 | 0.510056–0.550463 | outside-range | needs-review |
| rightEye.width/W | 0.149256 | 0.100000–0.120000 | 0.138215–0.160512 | outside-range | fail |
| rightEye.height/F | 0.094725 | 0.070000–0.100000 | 0.080460–0.109371 | within-range | needs-review |
| rightEye.u | 0.719733 | 0.696000–0.726000 | 0.703213–0.736578 | within-range | needs-review |
| rightEye.v | 0.544675 | 0.488000–0.528000 | 0.524547–0.565342 | outside-range | needs-review |
| eyeSpacing/W | 0.403121 | 0.376000–0.400000 | 0.389642–0.416865 | outside-range | needs-review |
| mouth.u | 0.511042 | 0.498000–0.528000 | 0.496526–0.525843 | within-range | needs-review |
| mouth.v | 0.622078 | 0.569000–0.619000 | 0.600941–0.643780 | outside-range | needs-review |
| mouth.width/W | 0.138695 | 0.114300–0.139700 | 0.127756–0.149848 | within-range | needs-review |
| mouth.height/F | 0.099416 | 0.077400–0.094600 | 0.085090–0.114125 | outside-range | needs-review |
| leftCheek.width/W | 0.118855 | 0.106931–0.130693 | 0.108106–0.129814 | within-range | pass |
| leftCheek.height/F | 0.095442 | 0.086802–0.106091 | 0.081168–0.110099 | within-range | needs-review |
| leftCheek.u | 0.246003 | 0.229000–0.259000 | 0.234034–0.258208 | within-range | pass |
| leftCheek.v | 0.677655 | 0.635000–0.675000 | 0.655794–0.700101 | outside-range | needs-review |
| rightCheek.width/W | 0.120175 | 0.106931–0.130693 | 0.109414–0.131147 | within-range | needs-review |
| rightCheek.height/F | 0.097229 | 0.086802–0.106091 | 0.082931–0.111909 | within-range | needs-review |
| rightCheek.u | 0.781316 | 0.777000–0.807000 | 0.764204–0.798764 | within-range | needs-review |
| rightCheek.v | 0.679261 | 0.637000–0.677000 | 0.657379–0.701728 | outside-range | needs-review |

