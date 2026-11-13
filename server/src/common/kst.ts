/** 한국 표준시와 UTC의 차이 (한국은 서머타임이 없어 늘 9시간) */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 한국 시간으로 '오늘' 하루의 시작과 끝(UTC Date)을 구한다. 하루 게시 상한을 셀 때 쓴다.
 * @param now 기준 시각 (테스트에서 바꿔 넣는다)
 * @returns start 이상, end 미만
 */
export function kstDayRange(now: Date = new Date()): {
  start: Date;
  end: Date;
} {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const start = new Date(
    Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) -
      KST_OFFSET_MS,
  );
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}
