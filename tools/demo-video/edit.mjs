/**
 * 시연 영상 편집 (RD-34): 녹화(raw.mkv) + 장면 기록(timeline.json) + 음성(audio/) + 자막 그림(captions/) → final.mp4
 * - 녹화 시작 직후의 자홍색 화면으로 녹화 시각과 스크립트 시각을 맞춘다
 * - 기다리는 구간(wait)은 3초로 줄이고, 잘라 낼 구간(cut)은 뺀다
 * - 장면이 내레이션보다 짧으면 마지막 화면을 늘이고, 많이 길면 조금 빠르게 한다 (게시 장면은 거의 그대로)
 * - 처음·끝은 제목 카드
 * 사용: node edit.mjs <out 폴더>
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SCENES } from './scenes.mjs';

/** 작업 폴더 */
const out = process.argv[2] ?? 'out';
const timeline = JSON.parse(readFileSync(join(out, 'timeline.json'), 'utf8'));
const narration = JSON.parse(readFileSync(join(out, 'audio', 'durations.json'), 'utf8'));
const parts = join(out, 'parts');
mkdirSync(parts, { recursive: true });

/** 결과 화면 */
const W = 1920;
const H = 1080;
const FPS = 30;
/** 기다리는 구간을 줄인 길이 (초) */
const WAIT_TO = 3;
/** 장면 끝에 내레이션 뒤로 두는 여유 (초) */
const TAIL = 0.6;

/**
 * ffmpeg 실행
 * @param args 인자
 */
const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });

/**
 * 녹화에서 자홍색 맞춤 화면이 처음 나온 시각 (초)
 */
function findSync() {
  const buf = execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-t', '30', '-i', join(out, 'raw.mkv'),
    '-vf', `fps=${FPS},scale=4:4,format=rgb24`, '-f', 'rawvideo', '-'], { maxBuffer: 1 << 26 });
  const frame = 4 * 4 * 3;
  for (let i = 0; i * frame < buf.length; i++) {
    // 가운데 픽셀 (1,1)
    const o = i * frame + (1 * 4 + 1) * 3;
    if (buf[o] > 200 && buf[o + 1] < 90 && buf[o + 2] > 200) return i / FPS;
  }
  throw new Error('녹화에서 맞춤 화면(자홍색)을 찾지 못했어요');
}

/** 녹화 시각 = 스크립트 시각 + offset */
const offset = findSync() - timeline.sync;
console.log(`맞춤: ${offset.toFixed(2)}초`);

/**
 * 장면의 녹화 조각 목록 (자를 구간은 빼고, 기다리는 구간은 빠르기를 정한다)
 * @param rec 장면 기록
 */
function piecesOf(rec) {
  const marks = [...rec.segments].sort((a, b) => a.start - b.start);
  const pieces = [];
  let at = rec.start;
  for (const g of marks) {
    if (g.start > at) pieces.push({ start: at, end: g.start, speed: 1 });
    const len = g.end - g.start;
    if (g.kind === 'wait' && len > 0.1) pieces.push({ start: g.start, end: g.end, speed: Math.max(1, len / WAIT_TO) });
    at = Math.max(at, g.end);
  }
  if (rec.end > at) pieces.push({ start: at, end: rec.end, speed: 1 });
  return pieces.filter((p) => p.end - p.start > 0.05);
}

/**
 * 장면 하나를 만든다
 * @param scene 장면 (scenes.mjs)
 * @param index 순서
 */
function buildScene(scene, index) {
  const n = narration[scene.id];
  const file = join(parts, `${String(index).padStart(2, '0')}-${scene.id}.mp4`);
  const rec = timeline.scenes.find((s) => s.id === scene.id && s.end);
  const card = scene.id === 'intro' ? 'card-intro.png' : scene.id === 'outro' ? 'card-outro.png' : null;
  const target = n.duration + TAIL;
  const inputs = [];
  const filters = [];
  let video;
  let length;

  if (card || !rec) {
    // 제목 카드: 그림 한 장을 내레이션 길이만큼
    inputs.push('-loop', '1', '-t', String(target), '-i', join(out, 'captions', card ?? 'card-intro.png'));
    filters.push(`[0:v]scale=${W}:${H},fps=${FPS},format=yuv420p[v0]`);
    video = 'v0';
    length = target;
  } else {
    const pieces = piecesOf(rec);
    pieces.forEach((p, i) => {
      inputs.push('-ss', (p.start + offset).toFixed(3), '-t', (p.end - p.start).toFixed(3), '-i', join(out, 'raw.mkv'));
      filters.push(`[${i}:v]scale=${W}:${H}:flags=lanczos,fps=${FPS},setpts=(PTS-STARTPTS)/${p.speed.toFixed(4)},format=yuv420p[p${i}]`);
    });
    filters.push(`${pieces.map((_, i) => `[p${i}]`).join('')}concat=n=${pieces.length}:v=1:a=0[cat]`);
    const raw = pieces.reduce((s, p) => s + (p.end - p.start) / p.speed, 0);
    // 많이 길면 조금 빠르게 (게시 장면은 타이핑이 보이도록 거의 그대로)
    const maxSpeed = scene.id === 'post' ? 1.2 : 1.6;
    const speed = raw > target + 3 ? Math.min(maxSpeed, raw / (target + 2)) : 1;
    length = Math.max(raw / speed, target);
    filters.push(`[cat]setpts=PTS/${speed.toFixed(4)},tpad=stop_mode=clone:stop_duration=${Math.max(0, target - raw / speed + 0.1).toFixed(2)},trim=duration=${length.toFixed(3)}[v0]`);
    video = 'v0';
  }

  // 장면 이름 (카드가 아닐 때) + 자막 줄마다
  let base = inputs.filter((x) => x === '-i').length;
  if (!card) {
    inputs.push('-i', join(out, 'captions', `${scene.id}-title.png`));
    filters.push(`[${video}][${base}:v]overlay=0:0[t]`);
    video = 't';
    base += 1;
  }
  n.captions.forEach((c, i) => {
    inputs.push('-i', join(out, 'captions', `${scene.id}-${i}.png`));
    filters.push(`[${video}][${base}:v]overlay=0:0:enable='between(t,${c.start.toFixed(2)},${(c.end + 0.2).toFixed(2)})'[c${i}]`);
    video = `c${i}`;
    base += 1;
  });
  // 음성: 내레이션을 장면 길이에 맞춰 뒤를 무음으로 채운다
  inputs.push('-i', join(out, 'audio', `${scene.id}.wav`));
  filters.push(`[${base}:a]aresample=48000,apad,atrim=duration=${length.toFixed(3)}[a]`);

  ff([...inputs, '-filter_complex', filters.join(';'), '-map', `[${video}]`, '-map', '[a]',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-r', String(FPS), '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-ac', '2', '-t', length.toFixed(3), file]);
  console.log(`${scene.id}: ${length.toFixed(1)}초`);
  return file;
}

const files = SCENES.map(buildScene);
const list = join(parts, 'list.txt');
writeFileSync(list, files.map((f) => `file '${f}'`).join('\n'));
ff(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', join(out, 'final.mp4')]);
const total = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', join(out, 'final.mp4')]).toString());
console.log(`완성: ${join(out, 'final.mp4')} (${Math.floor(total / 60)}분 ${Math.round(total % 60)}초)`);
