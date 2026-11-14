/** 주제 첫 글자 칸의 색 (주제 ID로 고른다. 글자는 4.5:1 이상) */
const AVATAR_TONES: [string, string][] = [
  ['#f0ecff', '#4f2fe0'],
  ['#fff0e6', '#a34a12'],
  ['#e3f4ef', '#0f6b5c'],
  ['#e9f1ff', '#1b5bc4'],
  ['#fdebf3', '#a3245e'],
  ['#f1f1ee', '#4b4b52'],
];

/**
 * 주제 첫 글자 칸의 색
 * @param id 주제 ID
 */
export function topicTone(id: number): { background: string; color: string } {
  const [background, color] = AVATAR_TONES[Math.abs(id - 1) % AVATAR_TONES.length];
  return { background, color };
}
