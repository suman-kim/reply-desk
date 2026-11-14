/**
 * 광고 표시. 다른 채널 영상에 다는 댓글은 업체 홍보라는 표시(예: [광고])를 초안 맨 앞에 붙여 준다
 * (표시·광고법, 공정위 추천·보증 심사지침: 경제적 이해관계를 첫 부분에 밝힌다).
 * 내 채널 영상에는 붙이지 않는다.
 * 붙이기만 하고 검사·차단은 하지 않는다(RD-28): 사람이 지우고 게시해도 된다.
 */

/**
 * 이 영상의 초안에 붙일 광고 표시
 * @param adDisclosure 주제의 광고 표시 (예: [광고]). 빈칸이면 붙이지 않는다
 * @param isMine 내 채널 영상인지
 * @returns 붙일 표시 글자, 붙이지 않으면 null
 */
export function requiredDisclosure(
  adDisclosure: string,
  isMine: boolean,
): string | null {
  const mark = adDisclosure.trim();
  return isMine || mark === '' ? null : mark;
}

/**
 * 광고 표시를 맨 앞에 붙인다. 글 안 다른 곳에 있던 표시는 빼서 한 번만 둔다.
 * @param text 댓글
 * @param disclosure 광고 표시
 */
export function withDisclosure(text: string, disclosure: string): string {
  return `${disclosure} ${stripDisclosure(text, disclosure)}`;
}

/**
 * 광고 표시를 뺀 본문 (길이·해시태그 검사는 본문만 본다)
 * @param text 댓글
 * @param disclosure 광고 표시
 */
export function stripDisclosure(text: string, disclosure: string): string {
  return text.split(disclosure).join(' ').replace(/\s+/g, ' ').trim();
}
