/**
 * 자막·장면 제목·제목 카드 그림을 만든다 (ffmpeg에 글자 그리기 기능이 없어 브라우저로 투명 PNG를 그린다).
 * 결과: <out>/captions/<장면>-<줄>.png (화면 아래 자막), <out>/captions/<장면>-title.png (왼쪽 위 장면 이름),
 *       <out>/captions/card-intro.png · card-outro.png (처음·끝 카드, 1920×1080)
 * 사용: node captions.mjs <out 폴더>
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '../../server/node_modules/playwright-core/index.mjs';
import { SCENES } from './scenes.mjs';

/** 출력 폴더 */
const out = process.argv[2] ?? 'out';
mkdirSync(join(out, 'captions'), { recursive: true });

/** 공통 글꼴 (맥 기본 한글 글꼴) */
const FONT = `font-family: 'Apple SD Gothic Neo', 'Pretendard', sans-serif;`;

/**
 * 글자를 HTML에 안전하게 넣는다
 * @param s 글
 */
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });

/**
 * HTML 한 장을 투명 PNG로 찍는다
 * @param html 본문
 * @param file 저장할 파일
 * @param transparent 배경을 투명하게
 */
async function shot(html, file, transparent = true) {
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;width:1920px;height:1080px;background:${transparent ? 'transparent' : '#111318'};${FONT}}
  </style></head><body>${html}</body></html>`);
  await page.screenshot({ path: file, omitBackground: transparent });
}

for (const scene of SCENES) {
  // 아래 자막: 반투명 검은 띠 위 흰 글자
  for (const [i, line] of scene.captions.entries()) {
    await shot(
      `<div style="position:absolute;left:0;right:0;bottom:64px;display:flex;justify-content:center">
        <div style="max-width:1500px;padding:14px 28px;border-radius:14px;background:rgba(10,12,16,.78);color:#fff;
          font-size:38px;font-weight:600;line-height:1.35;text-align:center;letter-spacing:-.3px">${esc(line)}</div>
      </div>`,
      join(out, 'captions', `${scene.id}-${i}.png`),
    );
  }
  // 왼쪽 위 장면 이름
  await shot(
    `<div style="position:absolute;left:36px;top:44px;padding:10px 20px;border-radius:999px;background:#6a45ff;color:#fff;
      font-size:28px;font-weight:700;box-shadow:0 6px 24px rgba(0,0,0,.25)">${esc(scene.title)}</div>`,
    join(out, 'captions', `${scene.id}-title.png`),
  );
}

// 처음·끝 카드 (어두운 바탕)
const card = (big, small) => `
  <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;color:#fff">
    <div style="padding:8px 18px;border-radius:999px;background:#6a45ff;font-size:26px;font-weight:700">TRACK 2 · 마케팅 AI 에이전트</div>
    <div style="font-size:84px;font-weight:800;letter-spacing:-2px">${esc(big)}</div>
    <div style="font-size:34px;color:#c9c9d6">${esc(small)}</div>
  </div>`;
await shot(card('유튜브 댓글 에이전트', '주제: 운명원 연애 사주 · 영상 불러오기 → 고르기 → 크롬 프로필로 직접 타이핑'), join(out, 'captions', 'card-intro.png'), false);

// ───────── 엔딩: 작동 방식 · 기획 의도 (아래 190px은 자막 자리로 비운다) ─────────
/** 역할 색: 코드 · AI · 사람 · 크롬 */
const ROLE = { 코드: '#19b394', AI: '#8b6cff', 사람: '#f0a23b', 크롬: '#3d8bfd' };
/**
 * 역할 배지
 * @param role 역할 이름
 */
const tag = (role) =>
  `<span style="display:inline-block;padding:4px 12px;border-radius:999px;background:${ROLE[role]};color:#fff;font-size:22px;font-weight:700">${role}</span>`;
/**
 * 상자 하나 (제목 + 줄 목록)
 * @param head 머리 (HTML)
 * @param lines 줄
 * @param extra 상자 스타일 덧붙임
 */
const box = (head, lines, extra = '') => `
  <div style="flex:1;min-width:0;padding:26px 28px;border-radius:22px;background:#1c1f27;border:1px solid #2b2f3a;${extra}">
    <div style="display:flex;align-items:center;gap:12px;font-size:35px;font-weight:800;color:#fff;margin-bottom:20px">${head}</div>
    ${lines.map((l) => `<div style="font-size:29px;line-height:1.5;color:#c9ccd8;margin-top:10px">· ${esc(l)}</div>`).join('')}
  </div>`;
/** 화살표 */
const arrow = `<div style="flex:none;align-self:center;font-size:44px;color:#5a5f6e">→</div>`;
/**
 * 엔딩 한 장 (제목 · 부제 · 본문)
 * @param title 제목
 * @param sub 부제
 * @param body 본문 HTML
 */
const slide = (title, sub, body) => `
  <div style="position:absolute;left:96px;right:96px;top:72px;bottom:190px;display:flex;flex-direction:column;gap:30px;color:#fff">
    <div>
      <div style="font-size:60px;font-weight:800;letter-spacing:-1.5px">${esc(title)}</div>
      <div style="font-size:28px;color:#a9adbb;margin-top:10px">${esc(sub)}</div>
    </div>
    <div style="flex:1;display:flex;flex-direction:column;gap:22px;min-height:0">${body}</div>
  </div>`;

await shot(
  slide('작동 방식', '숫자는 코드 · 판단은 AI · 검증은 코드 · 결정은 사람', `
    <div style="display:flex;gap:18px;flex:1">
      ${box(`${tag('코드')} 영상 모으기`, ['유튜브 API로 검색어 영상 검색', '조회수·올린 시각은 API 값 그대로', '최근 검색을 재사용해 할당량 절약'])}
      ${arrow}
      ${box(`${tag('AI')} 판단 · 초안`, ['주제와 맞는 정도 0~100%', '근거 장면과 고른 이유', '시청자 고민 한 줄 → 댓글 초안'])}
      ${arrow}
      ${box(`${tag('코드')} 검증`, ['인용이 원문에 있는지 대조', '자동 검사 8가지', '걸리면 이유를 붙여 다시 쓰기'])}
      ${arrow}
      ${box(`${tag('사람')} → ${tag('크롬')} 게시`, ['사람이 확인하고 [댓글 달기]', '크롬 프로필로 한 글자씩 입력', '올라간 내 댓글까지 확인'])}
    </div>`),
  join(out, 'captions', 'card-logic.png'),
  false,
);
await shot(
  slide('판단은 AI, 사실 확인은 코드', 'AI가 숫자나 인용을 지어내도 화면과 댓글에 그대로 나가지 않게', `
    <div style="display:flex;gap:22px;flex:1">
      ${box(`${tag('AI')} 하는 일`, ['이 영상이 주제와 얼마나 맞는지 (0~100%)', '이 영상을 고른 이유', '근거 장면과 장면 핵심 단어', '시청자 고민 한 줄과 댓글 초안'])}
      ${box(`${tag('코드')} 하는 일`, ['조회수·올린 시각·채널은 API 값을 코드가 넣음', '인용이 영상 설명·인기 댓글 원문에 없으면 버림', '근거 장면이 하나도 안 남으면 분석 실패로 알림', '매칭 %는 색으로만 알리고 막지 않음 → 판단은 사람'])}
    </div>`),
  join(out, 'captions', 'card-facts.png'),
  false,
);
await shot(
  slide('초안을 사람처럼', '같은 지시로는 같은 글만 나온다 → 초안마다 코드가 글 모양을 바꾼다', `
    <div style="display:flex;gap:22px;flex:1">
      ${box(`${tag('코드')} 글 모양 카드 (예)`, ['쓰는 사람: 20대 후반 직장인', '말투: 반말 혼잣말 · 시작: 질문으로', '브랜드: 들은 말로, 글 가운데에', '길이: 짧게 · 장면 단어는 꼭 넣기', '최근에 쓴 조합은 피해서 고름'])}
      ${box(`${tag('코드')} 말버릇 피하기 · 자동 검사`, ['최근 초안 30% 이상에 나온 말 → 쓰지 말 것', '\'진짜\' 17/18 → 2/10, \'운명원 같은 곳\' 11/18 → 0/10', '글자 수 · 장면 언급 · 브랜드 한 번 · 링크/해시태그', '지어낸 후기 · 금지 표현 · 최근 초안과 다름', '걸리면 걸린 이유를 붙여 한 번 더 쓰기'])}
    </div>`),
  join(out, 'captions', 'card-human.png'),
  false,
);
await shot(
  slide('게시와 운영 규칙', '사람처럼 입력하고, 규칙은 코드와 데이터베이스가 지킨다', `
    <div style="display:flex;gap:12px">
      ${['프로필 열기', '댓글 창 찾기', '한 글자씩 입력', '게시', '내 댓글 확인']
        .map((t, i) => `<div style="flex:1;padding:18px 0;border-radius:16px;background:#1b2a44;border:1px solid #2c4a7a;text-align:center;font-size:27px;font-weight:700;color:#cfe0ff">${i + 1}. ${t}</div>`)
        .join(arrow)}
    </div>
    <div style="display:flex;gap:22px;flex:1">
      ${box(`${tag('코드')} 운영 규칙`, ['영상당 댓글 1개 (기본): 차단 규칙이 막음', '같은 초안 두 번 게시: 데이터베이스가 직접 막음', '하루 상한: 전체 · 주제별', '같은 영상 동시 게시 막기', '계정 차례 자동 배정 · 로그인 풀린 계정은 뺌'])}
      ${box(`${tag('크롬')} 기록과 안전`, ['계정마다 따로 둔 크롬 프로필 (비밀번호 저장 안 함)', '성공·실패를 시간순 기록, 실패하면 단계·원인·캡처', '다른 채널 영상에는 맨 앞에 [광고] 표시', '게시는 사람이 눌러야만 시작'])}
    </div>`),
  join(out, 'captions', 'card-safety.png'),
  false,
);
await shot(
  slide('기획 의도', '왜 이렇게 설계했나', `
    <div style="display:flex;flex-direction:column;gap:20px;flex:1;justify-content:center">
      ${[
        ['광고가 아니라 시청자 한 사람의 이야기처럼', '영상 속 장면을 짚고, 시청자 고민 한 줄을 가진 사람이 쓴 것처럼, 매번 다른 모양으로'],
        ['판단은 AI, 숫자와 규칙은 코드, 마지막 결정은 사람', 'AI가 틀려도 지어낸 숫자·인용은 걸러지고, 게시는 사람이 확인한 것만'],
        ['비용과 할당량을 아끼는 구조', '초안은 고른 영상만 쓰고, 유튜브 검색은 재사용·새 영상만 검색'],
      ]
        .map(([a, b]) => `<div style="padding:24px 30px;border-radius:20px;background:#1c1f27;border-left:6px solid #6a45ff">
          <div style="font-size:36px;font-weight:800">${esc(a)}</div>
          <div style="font-size:25px;color:#a9adbb;margin-top:8px">${esc(b)}</div></div>`)
        .join('')}
    </div>`),
  join(out, 'captions', 'card-intent.png'),
  false,
);

await browser.close();
console.log('자막 그림 완료');
