유튜브 댓글 에이전트 대시보드를 위한 디자인 시스템이에요. 홍보 대상(주제)별로 영상을 고르고, AI가 쓴 댓글 초안과 **그렇게 판단한 이유**를 보여준 뒤, 사람이 눌러 게시하는 관제 화면에 맞춰 만들었어요. 흰 바탕, 쿨그레이 면, 일렉트릭 블루 하나, 연애 고민 자리에만 쓰는 로즈 핑크, 굵고 좁은 자간의 제목이 이 시스템의 얼굴이에요.

## 원칙

1. **흰 바탕, 면으로 나누기.** 페이지는 `ground`(흰색)예요. 구역은 테두리 대신 `surface-sunken` 회색 면으로 나누고, 패널만 머리카락 같은 `line` 테두리를 둬요. 그림자는 회색 면 위에 떠오른 흰 조각(선택된 주제, 세그먼트 칸)에만 써요.
2. **원색은 하나.** `accent`(일렉트릭 블루)는 주요 버튼, 선택, 진행, 포커스에만 써요. 패널마다 파란 버튼은 하나까지예요.
3. **글자로 위계.** 화면 이름 `text-display` 30, 주제 `text-title` 22, 패널 `text-heading` 18을 굵게, 좁은 자간으로 써요. 패널 번호는 원 대신 작은 `text-eyebrow` "STEP 01" 라벨이에요.
4. **결과 옆에 이유.** AI가 고르거나 쓴 것 옆에는 항상 `ReasonBox`로 이유를 붙여요. 이유 속 숫자는 코드가 넣은 값만 써요.
5. **막을 땐 이유를.** 비활성 버튼 아래에는 원인 한 줄이 항상 붙어요. 자동으로 도는 일은 스피너와 진행 숫자("2/5", "34 / 91자")로 보여줘요.

## 말투

- 해요체로 짧게 써요. 한 덩어리에 한 가지만 말해요.
- 버튼은 동사형이에요: "영상 불러오기", "댓글 달기", "다시 생성".
- 진행은 "~중…"으로 써요: "초안 작성 중", "한 글자씩 입력 중".
- 막힘·실패는 원인 다음에 할 일을 써요: "댓글 창이 20초 안에 뜨지 않았어요 · 캡처를 확인하세요".
- 피하는 말: "오류가 발생했습니다", "처리 중입니다", "권한이 없습니다", 느낌표, 이모지.

## 색

| 쓰임 | 토큰 |
| --- | --- |
| 페이지 바탕 / 카드 | `ground` / `surface` (둘 다 흰색), 카드 테두리 `line` |
| 회색 면 (사이드바, 입력창, 보조 버튼, 회색 이유 상자) | `surface-sunken`, 그 위 hover `surface-hover` |
| 글자 | `ink` 제목·본문, `ink-2` 보조, `ink-3` 안내·대기 |
| 주요 버튼, 선택, 진행, 포커스 | `accent` + `on-accent`, 옅은 바탕 `accent-soft` 위 글자 `accent-ink` |
| 두 번째 강한 버튼 | `ink` 바탕 + `on-ink` (`dark` 버튼) |
| 사람의 연애 고민, 내 채널 | `rose-soft` 바탕 + `rose-ink` 글자. 원색 `rose`는 장식에만 |
| 성공 / 실패 / 주의 | `success-*` / `danger-*` / `warning-*` (soft 바탕 + ink 글자) |

- 모든 글자 조합은 4.5:1 이상이에요. `ink-3`은 `ground`, `surface-sunken`, `accent-soft`, `rose-soft` 위에서 써도 돼요.
- 성공과 실패는 색만으로 나누지 않고 체크·X 아이콘과 글자를 함께 써요.
- 그라데이션, 왼쪽 굵은 테두리 카드, 네온 효과, 큰 그림자는 쓰지 않아요.

## 글꼴

Pretendard Variable 하나로 모든 한글·영문을 써요(`--font-sans`, SIL OFL 1.1, `fonts/PretendardVariable.woff2`). 시점·시각·글자 수·URL만 고정폭 `--font-mono`로 써요. 제목은 자간을 -0.02~-0.03em으로 좁히고, 숫자가 나란히 비교되는 곳(조회수, 순위, 카운터)은 `font-variant-numeric: tabular-nums`를 켜요.

## 간격·모서리·그림자

- 간격은 4의 배수예요(`space-1` 4 … `space-8` 32). 페이지 좌우 `space-8`, 패널 사이 `space-5`, 패널 안쪽 `space-6`, 패널 안 요소 사이 `space-4`.
- 모서리는 크고 부드러워요: 버튼·입력 `radius-md` 12, 이유 상자·영상 카드 `radius-lg` 16, 패널·사이드바 `radius-xl` 24, 배지 `radius-pill`.
- 그림자는 `shadow-card` 하나를 회색 면 위 흰 조각에만, `shadow-pop`은 떠 있는 시트에만 써요.
- 누르는 영역은 44px 이상이에요.

## 아이콘

전용 아이콘 세트는 없어요. 24 격자, 선 두께 2~2.4, 둥근 끝의 선 아이콘을 `currentColor`로 그려요(체크, X, 재생). 이모지는 쓰지 않아요. 로고는 아직 없어서 이름을 글자로만 써요.

## 컴포넌트

| 컴포넌트 | 쓰는 곳 |
| --- | --- |
| `TopicItem` | 왼쪽 주제 사이드바 (회색 판 위) |
| `StatPill` | 헤더의 오늘 전체 게시 n/10, 주제별 몫 |
| `Panel` | ①②③ 세 칸, 게시 기록 |
| `Button`, `Segmented`, `Field` | 동작, 계정·기간 선택, 링크·초안·주제 설정 입력 |
| `VideoCard`, `Badge`, `Spinner` | ① 영상 목록과 상태 |
| `ReasonBox`, `CheckList` | ② 고른 이유, 고민 한 줄, 쓴 이유, 자동 검사 |
| `StepList`, `BrowserFrame` | ③ 게시 진행과 크롬 미리보기 |
| `LogTable` | 게시 기록 (주제별·전체) |

화면 구성: 위에 헤더(화면 이름, `StatPill`), 왼쪽에 회색 주제 사이드바, 오른쪽에 선택한 주제의 제목 줄과 세 칸(① 1 : ② 1.3 : ③ 1), 아래에 게시 기록이에요. 좁은 화면에서는 사이드바 → ① → ② → ③ → 기록 순으로 쌓여요.

## 다른 화면에서 쓰기

- 전역 이름(namespace)은 `Inyeon`이에요. `components/bundle.js`가 `window.Inyeon`에 컴포넌트를 올려요. React 18이 페이지에 먼저 있어야 해요.
- 불러오는 순서: `tokens.css` → `components/bundle.css` → `components/bundle.js`. 글꼴은 `tokens.css`의 `@font-face`가 `fonts/PretendardVariable.woff2`를 불러요.
- Design 캔버스에서는 위 세 파일과 `fonts/` 폴더를 함께 복사하고, 아트보드 바깥 요소에 `font-family: var(--font-sans); background: var(--ground); color: var(--ink)`를 줘요.
- 예: `<x-import component-from-global-scope="Inyeon.Button" variant="primary">댓글 달기</x-import>`
- 클래스 접두사는 `iy-`예요. 링크를 버튼처럼 보이게 할 때는 `iy-btn iy-btn-secondary iy-btn-md`처럼 클래스를 붙여요. 값을 직접 쓰지 말고 `var(--토큰)`으로 써요.
