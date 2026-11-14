/**
 * 장면마다 내레이션 음성을 만든다 (macOS say, 한국어 목소리 Yuna).
 * 결과: <out>/audio/<장면>.wav 와 <out>/audio/durations.json (장면별 음성 길이와 자막 줄별 시작·끝 초)
 * 사용: node tts.mjs <out 폴더>
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SCENES } from './scenes.mjs';

/** 출력 폴더 */
const out = process.argv[2] ?? 'out';
/** 목소리 (한국어를 제대로 읽는 것은 Yuna) */
const VOICE = process.env.VOICE ?? 'Yuna';
/** 말 빠르기 (분당 낱말, 기본 175쯤) */
const RATE = process.env.RATE ?? '190';
/** 자막 줄 사이 쉬는 시간 (초) */
const GAP = 0.25;

mkdirSync(join(out, 'audio'), { recursive: true });

/**
 * 파일 길이 (초)
 * @param file 소리 파일
 */
const durationOf = (file) =>
  Number(
    execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file])
      .toString()
      .trim(),
  );

const result = {};
for (const scene of SCENES) {
  // 자막 줄마다 따로 읽고 사이에 짧게 쉰다 → 자막 시간을 정확히 맞출 수 있다
  const parts = [];
  const timing = [];
  let at = 0;
  scene.captions.forEach((line, i) => {
    const aiff = join(out, 'audio', `${scene.id}-${i}.aiff`);
    execFileSync('say', ['-v', VOICE, '-r', RATE, '-o', aiff, line]);
    const d = durationOf(aiff);
    timing.push({ text: line, start: at, end: at + d });
    parts.push(aiff);
    at += d + GAP;
  });
  // 줄들을 쉬는 시간과 함께 이어 붙인다 (48kHz 모노 wav)
  const wav = join(out, 'audio', `${scene.id}.wav`);
  const inputs = parts.flatMap((p) => ['-i', p]);
  const filter =
    parts.map((_, i) => `[${i}:a]aresample=48000,apad=pad_dur=${GAP}[a${i}]`).join(';') +
    ';' +
    parts.map((_, i) => `[a${i}]`).join('') +
    `concat=n=${parts.length}:v=0:a=1[out]`;
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...inputs, '-filter_complex', filter, '-map', '[out]', '-ac', '1', wav]);
  result[scene.id] = { duration: durationOf(wav), captions: timing };
  console.log(`${scene.id}: ${result[scene.id].duration.toFixed(1)}초`);
}
writeFileSync(join(out, 'audio', 'durations.json'), JSON.stringify(result, null, 2));
const total = Object.values(result).reduce((s, r) => s + r.duration, 0);
console.log(`내레이션 합계 ${total.toFixed(1)}초`);
