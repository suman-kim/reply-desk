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
await shot(card('숫자는 코드, 판단은 AI, 검증은 코드', '유튜브 댓글 에이전트 · reply-desk'), join(out, 'captions', 'card-outro.png'), false);

await browser.close();
console.log('자막 그림 완료');
