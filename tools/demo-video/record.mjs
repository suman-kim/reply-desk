/**
 * 시연 영상 녹화 (RD-34). 대시보드 크롬을 자동으로 조작하면서 주 모니터 전체를 녹화하고, 장면 시작·끝을 timeline.json에 남긴다.
 * 자막·음성은 edit.mjs가 입힌다. 장면 내용: docs/demo/2026-11-14-demo-video-script.md, scenes.mjs
 *
 * 사용: node record.mjs <out 폴더>
 *   DRY=1        연습: 주제 이름에 '(연습)'을 붙이고 [댓글 달기]는 누르지 않으며, 끝나면 연습 주제를 지운다
 *   NO_RECORD=1  화면을 녹화하지 않는다 (클릭 순서만 확인)
 *   SCREEN=1     ffmpeg avfoundation 화면 번호 (기본 1 = Capture screen 0)
 * 준비: 서버(localhost:4100)·화면(localhost:5173)이 떠 있고, '개인계정' 프로필이 로그인되어 있어야 한다.
 * 주의: DRY가 아니면 실제 유튜브에 공개 댓글이 하나 달린다.
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '../../server/node_modules/playwright-core/index.mjs';

/** 출력 폴더 */
const out = process.argv[2] ?? 'out';
/** 연습인지 */
const DRY = process.env.DRY === '1';
/** 녹화하지 않는지 */
const NO_RECORD = process.env.NO_RECORD === '1';
/** 녹화할 화면 번호 */
const SCREEN = process.env.SCREEN ?? '1';
/** 서버 API */
const API = 'http://localhost:4100/api';
/** 대시보드 */
const WEB = 'http://localhost:5173';
/** 게시할 계정 */
const POST_PROFILE = '개인계정';
/** 계정 추가 장면에서 만들었다 지우는 시연용 프로필 */
const DEMO_PROFILE = '유튜브2';
/** 주제 이름 */
const TOPIC_NAME = DRY ? '운명원 연애 사주 (연습)' : '운명원 연애 사주';
/** 장면별 내레이션 길이 (tts.mjs 결과). 장면을 최소 이만큼 보여 준다 */
const NARRATION = JSON.parse(readFileSync(join(out, 'audio', 'durations.json'), 'utf8'));

/** 화면 배치 (주 모니터 논리 크기 1920×1080, 위 25는 메뉴 막대) */
const FULL = { left: 0, top: 25, width: 1920, height: 1055 };
const LEFT = { left: 0, top: 25, width: 820, height: 1055 };
const RIGHT = { left: 820, top: 25, width: 1100, height: 1055 };

mkdirSync(out, { recursive: true });

// ───────────────────────── 시간 기록 ─────────────────────────
/** 녹화를 시작한 시각 (ms) */
let t0 = Date.now();
/** 지금까지 걸린 초 */
const now = () => (Date.now() - t0) / 1000;
/** 장면 기록 */
const timeline = { sync: null, scenes: [] };
/** 지금 장면 */
let scene = null;

/**
 * 장면을 시작한다
 * @param id 장면 이름 (scenes.mjs)
 */
function begin(id) {
  scene = { id, start: now(), end: null, segments: [] };
  timeline.scenes.push(scene);
  console.log(`▶ ${id} ${scene.start.toFixed(1)}s`);
}

/**
 * 장면을 끝낸다. 내레이션보다 짧으면 그만큼 더 보여 준다
 * @param page 대시보드
 * @param extra 내레이션 뒤에 더 둘 초
 */
async function end(page, extra = 1) {
  const shown = now() - scene.start - scene.segments.reduce((s, g) => s + (g.end - g.start), 0);
  const need = (NARRATION[scene.id]?.duration ?? 0) + extra - shown;
  if (need > 0) await page.waitForTimeout(need * 1000);
  scene.end = now();
  console.log(`■ ${scene.id} ${scene.end.toFixed(1)}s`);
}

/**
 * 기다리는 구간을 표시한다 (편집에서 빨리 감거나 자른다)
 * @param kind wait: 빨리 감기, cut: 잘라 냄
 * @param fn 그동안 할 일
 */
async function segment(kind, fn) {
  const g = { kind, start: now(), end: null };
  scene.segments.push(g);
  try {
    return await fn();
  } finally {
    g.end = now();
  }
}

// ───────────────────────── 서버 API ─────────────────────────
/**
 * 서버 API를 부른다
 * @param method 방법
 * @param path 경로
 * @param body 보낼 값
 */
async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

/**
 * 조건이 맞을 때까지 기다린다
 * @param fn 확인 (참이면 끝)
 * @param timeoutMs 최대 시간
 * @param everyMs 확인 간격
 */
async function until(fn, timeoutMs, everyMs = 2000) {
  const stop = Date.now() + timeoutMs;
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v;
    if (Date.now() > stop) throw new Error('기다리는 시간이 지났어요');
    await new Promise((r) => setTimeout(r, everyMs));
  }
}

// ───────────────────── 바깥 크롬 창 (CDP) ─────────────────────
/**
 * 프로필 폴더로 열린 크롬의 창 위치·상태를 바꾼다 (원격 연결 포트로 CDP를 직접 부른다. macOS 권한이 필요 없다)
 * @param profileDir 프로필 폴더
 * @param bounds 창 위치·크기 또는 { windowState }
 */
async function placeChrome(profileDir, bounds) {
  // 크롬이 막 켜졌으면 포트 파일·탭이 늦게 생긴다: 될 때까지 몇 번 다시 한다
  return until(() => placeChromeOnce(profileDir, bounds).then(() => true), 30000, 1000);
}

/**
 * placeChrome 한 번 시도
 * @param profileDir 프로필 폴더
 * @param bounds 창 위치·크기 또는 { windowState }
 */
async function placeChromeOnce(profileDir, bounds) {
  const file = join(profileDir, 'DevToolsActivePort');
  const [port, path] = (await until(async () => existsSync(file) && readFileSync(file, 'utf8'), 20000, 500)).split('\n');
  const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`);
  await new Promise((r, j) => ((ws.onopen = r), (ws.onerror = j)));
  let id = 0;
  const pending = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    pending.get(m.id)?.(m);
  };
  const send = (method, params = {}) =>
    new Promise((r) => {
      id += 1;
      pending.set(id, r);
      ws.send(JSON.stringify({ id, method, params }));
    });
  const targets = (await send('Target.getTargets')).result.targetInfos.filter((t) => t.type === 'page');
  if (targets.length === 0) throw new Error('크롬 탭이 없어요');
  const { windowId } = (await send('Browser.getWindowForTarget', { targetId: targets[0].targetId })).result;
  // 최소화된 창은 먼저 보통 상태로 되돌려야 위치를 바꿀 수 있다
  await send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'normal' } });
  await send('Browser.setWindowBounds', { windowId, bounds });
  ws.close();
}

/**
 * 대시보드 크롬 창 위치를 바꾼다
 * @param page 대시보드
 * @param bounds 위치·크기
 */
async function placeDashboard(page, bounds) {
  const cdp = await page.context().newCDPSession(page);
  const { windowId } = await cdp.send('Browser.getWindowForTarget');
  await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'normal' } });
  await cdp.send('Browser.setWindowBounds', { windowId, bounds });
  await cdp.detach();
  await page.waitForTimeout(600);
}

// ───────────────────── 화면 위 가짜 커서 ─────────────────────
/** 대시보드에 넣는 가짜 커서 (자동 클릭은 실제 마우스가 움직이지 않아 보는 사람이 따라오게 그린다) */
const CURSOR_SCRIPT = () => {
  const ensure = () => {
    let c = document.getElementById('__demo_cursor');
    if (c || !document.body) return c;
    const style = document.createElement('style');
    style.textContent = `
      #__demo_cursor{position:fixed;left:0;top:0;width:26px;height:26px;z-index:2147483647;pointer-events:none;
        transition:transform .55s cubic-bezier(.3,.7,.2,1);transform:translate(960px,540px)}
      #__demo_cursor svg{filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}
      .__demo_ring{position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;z-index:2147483646;
        pointer-events:none;border:3px solid #6a45ff;animation:__demo_ring .6s ease-out forwards}
      @keyframes __demo_ring{from{transform:scale(.3);opacity:1}to{transform:scale(1.4);opacity:0}}
      #__demo_flash{position:fixed;inset:0;background:#ff00ff;z-index:2147483647}`;
    document.head.appendChild(style);
    c = document.createElement('div');
    c.id = '__demo_cursor';
    c.innerHTML =
      '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 2l15 10-7 1.5L8.5 21z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.body.appendChild(c);
    return c;
  };
  window.__demo = {
    move(x, y) {
      const c = ensure();
      if (c) c.style.transform = `translate(${x - 4}px, ${y - 2}px)`;
    },
    pulse(x, y) {
      const r = document.createElement('div');
      r.className = '__demo_ring';
      r.style.left = `${x}px`;
      r.style.top = `${y}px`;
      document.body.appendChild(r);
      setTimeout(() => r.remove(), 700);
    },
    flash(ms) {
      const f = document.createElement('div');
      f.id = '__demo_flash';
      document.body.appendChild(f);
      setTimeout(() => f.remove(), ms);
    },
  };
  document.addEventListener('DOMContentLoaded', ensure);
};

/**
 * 요소로 가짜 커서를 옮긴다
 * @param page 대시보드
 * @param locator 요소
 */
async function point(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) return null;
  const x = box.x + Math.min(box.width / 2, 120);
  const y = box.y + box.height / 2;
  await page.evaluate(([x, y]) => window.__demo?.move(x, y), [x, y]);
  await page.waitForTimeout(650);
  return { x, y };
}

/**
 * 가짜 커서로 가리킨 뒤 누른다
 * @param page 대시보드
 * @param locator 요소
 * @param wait 누른 뒤 기다릴 ms
 */
async function click(page, locator, wait = 500) {
  const at = await point(page, locator);
  if (at) await page.evaluate(([x, y]) => window.__demo?.pulse(x, y), [at.x, at.y]);
  await locator.click();
  await page.waitForTimeout(wait);
}

/**
 * 글자를 한 글자씩 친다
 * @param page 대시보드
 * @param locator 입력칸
 * @param text 글
 */
async function type(page, locator, text) {
  await click(page, locator, 200);
  await locator.fill('');
  await locator.pressSequentially(text, { delay: 55 });
  await page.waitForTimeout(300);
}

// ───────────────────────── 녹화 ─────────────────────────
/** ffmpeg 녹화 프로세스 */
let recorder = null;

/** 주 모니터 녹화를 시작한다 */
function startRecording() {
  t0 = Date.now();
  if (NO_RECORD) return;
  recorder = spawn(
    'ffmpeg',
    ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'avfoundation', '-pixel_format', 'nv12', '-framerate', '30', '-capture_cursor', '0',
      '-i', `${SCREEN}:none`, '-c:v', 'h264_videotoolbox', '-b:v', '24M', '-pix_fmt', 'yuv420p', join(out, 'raw.mkv')],
    { stdio: ['pipe', 'inherit', 'inherit'] },
  );
}

/** 녹화를 멈추고 파일을 마무리한다 */
async function stopRecording() {
  if (!recorder) return;
  recorder.stdin.write('q');
  await new Promise((r) => recorder.on('exit', r));
}

// ───────────────────────── 장면들 ─────────────────────────
const profiles = await api('GET', '/profiles');
const poster = profiles.find((p) => p.name === POST_PROFILE);
if (!poster || poster.loginStatus !== 'ok') throw new Error(`${POST_PROFILE} 프로필이 로그인되어 있지 않아요`);
// 지난 실행에서 남은 시연용 프로필은 지운다
for (const p of profiles.filter((p) => p.name === DEMO_PROFILE)) await api('DELETE', `/profiles/${p.id}`);

// 게시할 계정의 크롬을 미리 열어 오른쪽에 두고 최소화한다 (게시할 때 이 창에 새 탭으로 붙는다)
await api('POST', `/profiles/${poster.id}/login`);
await placeChrome(poster.folderPath, RIGHT);
await placeChrome(poster.folderPath, { windowState: 'minimized' });

const browser = await chromium.launch({
  channel: 'chrome',
  headless: false,
  ignoreDefaultArgs: ['--enable-automation'],
  args: [`--window-position=${FULL.left},${FULL.top}`, `--window-size=${FULL.width},${FULL.height}`, '--no-first-run', '--hide-crash-restore-bubble'],
});
const context = await browser.newContext({ viewport: null, locale: 'ko-KR' });
await context.addInitScript(CURSOR_SCRIPT);
const page = await context.newPage();
await page.goto(`${WEB}/accounts`);
await placeDashboard(page, FULL);
await page.waitForTimeout(1500);

startRecording();
await page.waitForTimeout(2500);
// 맞춤 표시: 녹화 시각과 이 스크립트 시각을 맞추려고 화면 전체를 0.5초 자홍색으로 칠한다
timeline.sync = now();
await page.evaluate(() => window.__demo?.flash(500));
await page.waitForTimeout(1200);

/** 이번에 만든 주제 */
let topic = null;
/** 시연용 프로필 폴더 (끝나면 지운다) */
let demoFolder = null;
/** 고른 영상 */
let picked = null;

try {
  // ── ① 계정 연결 ──
  begin('account');
  await page.waitForTimeout(1200);
  await click(page, page.locator('header.rd-header button', { hasText: '새 프로필 추가' }));
  const modal = page.getByRole('dialog', { name: '새 프로필 추가' });
  await type(page, modal.locator('#rd-pname'), DEMO_PROFILE);
  await click(page, modal.getByRole('button', { name: '폴더 만들고 다음' }), 1200);
  const demo = (await api('GET', '/profiles')).find((p) => p.name === DEMO_PROFILE);
  demoFolder = demo.folderPath;
  await click(page, modal.getByRole('button', { name: '크롬 열기' }), 800);
  // 열린 시연용 크롬(구글 로그인 화면)을 오른쪽에 둔다
  await placeChrome(demo.folderPath, RIGHT).catch((e) => console.warn('시연 크롬 위치:', e.message));
  await page.waitForTimeout(4000);
  // 로그인은 하지 않는다: 시연용 크롬을 닫고 창을 닫는다
  try {
    execFileSync('pkill', ['-f', `user-data-dir=${demo.folderPath}`]);
  } catch {
    /* 이미 닫혔으면 괜찮다 */
  }
  await page.waitForTimeout(800);
  await point(page, modal.locator('.rd-wz'));
  await page.waitForTimeout(1500);
  await page.keyboard.press('Escape');
  await point(page, page.locator('article.rd-acard').first());
  await end(page);
  // 시연용 프로필은 목록에서 바로 지운다 (주제의 '쓸 프로필'에 보이지 않게)
  await api('DELETE', `/profiles/${demo.id}`);

  // ── ② 주제 만들기 ──
  begin('topic');
  await click(page, page.getByRole('link', { name: '새 주제 만들기' }).first(), 1000);
  await type(page, page.getByPlaceholder('예: 운명원 연애 사주'), TOPIC_NAME);
  await type(page, page.getByPlaceholder('예: 운명원 · 연애 사주 잘 보는 곳'), '운명원 · 연애 사주 잘 보는 곳');
  const tag = page.getByPlaceholder('예: 연애');
  for (const k of ['연애', '썸', '재회', '사주']) {
    await type(page, tag, k);
    await page.keyboard.press('Enter');
  }
  await click(page, page.getByRole('button', { name: '7일 안' }));
  await click(page, page.getByRole('button', { name: '조회수 높은 순' }));
  await click(page, page.getByRole('button', { name: '20개' }));
  await click(page, page.getByRole('group', { name: '쓸 프로필' }).getByText(POST_PROFILE));
  await click(page, page.getByRole('button', { name: '주제 만들기' }), 1500);
  await page.waitForURL(/\/t\/\d+\/dashboard/, { timeout: 15000 });
  topic = (await api('GET', '/topics')).find((t) => t.name === TOPIC_NAME);
  // 화면에서 숨긴 브랜드 단어(검사용)는 API로 넣는다
  await api('PATCH', `/topics/${topic.id}`, { brandWord: '운명원' });
  await end(page, 0.5);

  // ── ③ 영상 불러오기 ──
  begin('load');
  await page.waitForTimeout(800);
  await click(page, page.getByRole('button', { name: '영상 불러오기' }), 300);
  await segment('wait', () =>
    until(async () => (await api('GET', `/topics/${topic.id}/videos`)).length > 0 && (await page.locator('a.rd-vlink').count()) > 0, 120000, 1000),
  );
  await page.waitForTimeout(1500);
  await point(page, page.locator('a.rd-vlink').first());
  await page.waitForTimeout(1200);
  const sort = page.getByRole('group', { name: '정렬' });
  await click(page, sort.getByRole('button', { name: '관련도' }), 1200);
  await click(page, sort.getByRole('button', { name: '최신' }), 1200);
  await click(page, sort.getByRole('button', { name: '조회수' }), 1000);
  await point(page, page.getByPlaceholder('검색에 안 나온 영상 링크 붙여넣기'));
  await end(page);

  // ── ④ 영상 고르기 · 초안 작성 ──
  begin('draft');
  const videos = await api('GET', `/topics/${topic.id}/videos`);
  const candidates = videos.filter((v) => !v.isMine && !v.commented && /연애|사주|썸|재회|이별|결혼|짝사랑/.test(v.title));
  if (candidates.length === 0) throw new Error('고를 영상이 없어요');
  for (const v of candidates.slice(0, 3)) {
    const link = page.locator(`a.rd-vlink[href="/t/${topic.id}/videos/${v.id}"]`).first();
    if ((await link.count()) === 0) continue;
    await click(page, link, 1500);
    await click(page, page.getByRole('button', { name: '초안 작성' }), 300);
    // 분석·작성을 기다린다. 검사에 걸리면 [다시 생성] (그 구간은 편집에서 잘라 낸다)
    let detail = await segment('wait', () =>
      until(async () => {
        const d = await api('GET', `/topics/${topic.id}/videos/${v.id}/draft`);
        return d.draft && d.draft.state !== 'writing' ? d : null;
      }, 240000),
    );
    for (let i = 0; i < 2 && !(detail.draft.state === 'ready' && detail.draft.checkPassed); i++) {
      detail = await segment('cut', async () => {
        await page.getByRole('button', { name: '다시 생성' }).click();
        return until(async () => {
          const d = await api('GET', `/topics/${topic.id}/videos/${v.id}/draft`);
          return d.draft && d.draft.state !== 'writing' ? d : null;
        }, 240000);
      });
    }
    if (detail.draft.state === 'ready' && detail.draft.checkPassed) {
      picked = v;
      break;
    }
    // 이 영상은 포기하고 목록으로 (편집에서 잘라 낸다)
    await segment('cut', () => page.getByRole('link', { name: '영상 목록' }).first().click());
  }
  if (!picked) throw new Error('검사를 통과한 초안을 만들지 못했어요');
  await page.waitForTimeout(1000);
  // 판단 근거 → 시청자 고민 → 초안 → 자동 검사 → 쓴 이유
  await point(page, page.locator('.rd-tm').first());
  await page.waitForTimeout(1500);
  await point(page, page.locator('.rd-worry'));
  await page.waitForTimeout(2500);
  await point(page, page.locator('textarea.rd-dc-text'));
  await page.waitForTimeout(2500);
  await point(page, page.locator('.rd-dc-checks'));
  await page.waitForTimeout(2500);
  await point(page, page.locator('.rd-dc-why'));
  await end(page);

  // ── ⑤ 댓글 달기 ──
  begin('post');
  await placeDashboard(page, LEFT);
  await placeChrome(poster.folderPath, RIGHT);
  await page.waitForTimeout(1000);
  const postButton = page.getByRole('button', { name: '댓글 달기' });
  await point(page, postButton);
  await page.waitForTimeout(1200);
  if (DRY) {
    console.log('연습이라 [댓글 달기]는 누르지 않아요');
    await page.waitForTimeout(3000);
  } else {
    await click(page, postButton, 500);
    const done = await until(async () => {
      const d = await api('GET', `/topics/${topic.id}/videos/${picked.id}/draft`);
      const a = d.attempts[0];
      return a && a.status !== 'running' ? a : null;
    }, 300000, 1000);
    console.log(`게시 결과: ${done.status} ${done.commentUrl ?? done.failureReason ?? ''}`);
    await page.waitForTimeout(4000);
  }
  await end(page, 0.5);

  // ── ⑥ 운영 규칙 · 게시 기록 ──
  begin('rules');
  await placeChrome(poster.folderPath, { windowState: 'minimized' });
  await placeDashboard(page, FULL);
  await point(page, page.locator('.rd-pc').first());
  await page.waitForTimeout(2500);
  await click(page, page.getByRole('link', { name: '댓글 게시 목록' }).first(), 1500);
  await point(page, page.locator('main').getByRole('link').first());
  await end(page);

  // ── ⑦ 설정 ──
  begin('settings');
  await click(page, page.getByRole('link', { name: '설정', exact: true }).first(), 1200);
  for (const tab of ['게시', 'AI', 'Ollama', '프롬프트']) {
    await click(page, page.getByRole('tab', { name: tab }), 2200);
  }
  await click(page, page.getByRole('link', { name: '주제 설정' }).first(), 1200);
  for (const tab of ['홍보 대상', '영상 찾기', '댓글', '게시']) {
    await click(page, page.getByRole('tab', { name: tab }), 1600);
  }
  await end(page);

  // ── 끝 (대시보드로) ──
  begin('outro');
  await click(page, page.getByRole('link', { name: '대시보드' }).first(), 1000);
  await end(page, 0);
} finally {
  await stopRecording();
  writeFileSync(join(out, 'timeline.json'), JSON.stringify({ ...timeline, topicId: topic?.id ?? null, videoId: picked?.id ?? null }, null, 2));
  await browser.close();
  // 연습 주제는 지운다 (불러온 영상·초안도 함께)
  if (DRY && topic) await api('DELETE', `/topics/${topic.id}`).catch((e) => console.warn('연습 주제 지우기:', e.message));
  // 시연용 프로필 폴더는 지운다 (이 스크립트가 만든 것만, 게시 계정 폴더는 건드리지 않는다)
  if (demoFolder && demoFolder !== poster.folderPath && existsSync(demoFolder)) {
    rmSync(demoFolder, { recursive: true, force: true });
  }
  console.log('끝');
}
