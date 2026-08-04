# HS Baseball 기록실 (High School Baseball Stats)

KBO/MLB 공식 사이트 느낌의 고교야구 기록 사이트. 팀 전적과 선수 개인 기록을
한눈에 볼 수 있습니다. 순수 HTML/CSS/JavaScript로 만들어 **GitHub Pages**에 그대로
올릴 수 있는 정적 사이트입니다. (빌드 도구 없음)

현재는 **한 학교(Fayston)** 데이터만 들어있지만, 데이터 구조에 `school`(학교) 엔티티가
이미 있어서 나중에 주변 고등학교들을 추가해 한 곳에서 비교하도록 확장하기 쉽습니다.

## 폴더 구조

```
index.html          홈 / 대시보드 (팀 전적, 최근 경기, 톱 퍼포머)
players.html        선수 카드 그리드 (검색 + 정렬, 3D 틸트)
player.html?id=     선수 상세 (시즌 요약 + 경기별 기록)
games.html          경기 목록 (정렬 가능한 표)
game.html?id=       경기 상세 (이닝 스코어 + 박스 스코어)
leaderboards.html   선수 순위 (전 스탯 정렬)
admin.html          기록 입력 (선수/경기 추가·수정, 백업/초기화)

css/styles.css      공유 스타일 (다크 테마, 색상 팔레트 = CSS 변수)
js/data.js          데이터 레이어 (localStorage 접근은 여기서만)
js/stats.js         스탯 계산 (AVG/OBP/SLG/OPS, 집계)
js/ui.js            공통 UI (네비, 스크롤 리빌, 카운트업, 틸트)
js/home.js players.js player.js games.js game.js leaderboards.js admin.js
data/seed.json      기본(시드) 데이터 — CSV + 메타데이터에서 생성됨
data/*.csv          원본 경기 기록 (한 파일 = 한 경기)
img/players/*.jpg   웹 최적화된 선수 사진 (photos/ 원본을 축소·압축)
photos/*.png        원본 선수 사진 (고해상도, 사이트에서 직접 쓰지 않음)
scripts/build-seed.js  CSV + 선수/점수 메타데이터 -> seed.json 변환
```

## 디자인

KBO/MLB·MiLB 공식 사이트를 참고한 **다크 테마, 사진 중심** 디자인입니다.
선수 카드는 사진을 전면에 배치하고 등번호를 큰 워터마크로, 굵은 condensed
타이포(Archivo/Oswald)와 비비드한 레드 액센트를 사용합니다. 색상/폰트는
모두 `css/styles.css` 상단의 CSS 변수로 한곳에서 관리합니다.

## 로컬에서 보기

`fetch`로 `data/seed.json`을 불러오기 때문에 **로컬 파일(file://)로 바로 열면**
시드 데이터가 안 보일 수 있습니다. 간단한 정적 서버로 여세요:

```bash
python3 -m http.server 8000
# 브라우저에서 http://localhost:8000 접속
```

GitHub Pages에 올리면 별도 설정 없이 그대로 동작합니다.

## 데이터 흐름

- **첫 방문**: `data/seed.json`을 읽어 `localStorage`에 복사합니다.
- 이후 모든 추가/수정(기록 입력 페이지)은 `localStorage`에 저장됩니다.
- 모든 읽기/쓰기는 `js/data.js`(데이터 레이어)를 거칩니다. 나중에 실제 서버/DB로
  바꿀 때 이 파일만 교체하면 UI는 그대로 둘 수 있습니다.
- `기록 입력 > 데이터` 탭에서 JSON 백업을 내려받거나 시드로 초기화할 수 있습니다.

## CSV에서 시드 다시 만들기

`data/*.csv`를 수정한 뒤:

```bash
node scripts/build-seed.js
```

CSV 한 줄 구조(한 파일 = 한 경기):

```
1행: , 날짜 , ... [이닝 번호들(선택)]
2행: , 대회명 , ... [우리팀명, 이닝별 득점(선택)]
3행: , "A vs B" 매치업 , ... [상대팀명, 이닝별 득점(선택)]
4행: 안타 라벨(빈 줄)
5행: 컬럼 헤더 (이름, 타수, 득점, 계, 2루타, ...)
6행~: 선수별 기록
```

우리 팀은 항상 **Fayston** 으로 간주합니다.

선수 등번호·영문 이름·사진 경로, 그리고 경기 최종 점수, 잘못 적힌 이름 교정은
`scripts/build-seed.js` 상단의 `PLAYER_META` / `GAME_SCORES` / `NAME_FIX` 맵에
정리되어 있습니다. 명단이나 점수가 바뀌면 이 맵을 고치고 다시 빌드하세요.

### 사진 추가/교체

원본 사진을 `photos/<한글이름>.png` 로 넣은 뒤, 아래처럼 웹용으로 축소합니다
(macOS `sips` 사용, 약 4MB -> 70KB):

```bash
sips -Z 900 --setProperty format jpeg --setProperty formatOptions 80 \
  "photos/홍길동.png" --out "img/players/gildong-hong.jpg"
```

그런 다음 `PLAYER_META` 의 해당 선수 `photo` 경로를 `img/players/...` 로 지정하고
`node scripts/build-seed.js` 를 다시 실행합니다.

> 참고: 사이트는 `img/players/` 의 가벼운 사진만 사용합니다. `photos/` 원본
> (약 76MB)은 GitHub에 꼭 올릴 필요가 없으니 용량이 부담되면 빼도 됩니다.

### 데이터 갱신이 화면에 안 보일 때

데이터는 첫 방문 시 `localStorage`에 복사됩니다. seed를 다시 빌드해도 이미
저장된 브라우저에는 자동 반영되지 않습니다. `기록 입력 > 데이터 > 시드 데이터로
초기화` 를 누르면 새 seed로 다시 불러옵니다. (이번 개편처럼 저장 스키마가 바뀌면
내부 버전 키가 올라가 자동으로 재시드됩니다.)

## 계산되는 스탯

사용자는 **raw 숫자만 입력**하고, 사이트가 자동으로 계산합니다.

| 스탯 | 한글 | 공식 |
|------|------|------|
| AVG | 타율 | H / AB |
| OBP | 출루율 | (H + BB + HBP) / (AB + BB + HBP + SF) |
| SLG | 장타율 | 루타수 / AB |
| OPS | - | OBP + SLG |

- 루타수(Total Bases) = 1루타 + 2×2루타 + 3×3루타 + 4×홈런
- 비율 스탯은 소수점 3자리(예: `.312`)로 표기, 0으로 나누면 `.000`
- **타율 vs 안타율**: 의뢰 시 두 용어가 언급됐으나, 표준 야구 스탯에서 "타율"은
  batting average(H/AB) 하나뿐이라 동일하게 처리했습니다. (코드 주석에도 표기)

원본 CSV에는 표준 스탯보다 많은 항목(도루, 도루실패, 희타, 고의4구, 삼진, 병살타,
잔루, 루타수)이 있어 모두 저장하고 박스 스코어/선수 상세에서 보여줍니다.

## 참고

- 점수(이닝 기록)가 있는 경기만 승/패/무로 집계됩니다. 나머지는 "미정"으로 표시됩니다.
- 원본 CSV에는 등번호/포지션이 없어 비어 있습니다. `기록 입력`에서 채울 수 있습니다.
- 접근성: 색 대비, 모바일 대응, 키보드 입력 폼, `prefers-reduced-motion` 존중.
