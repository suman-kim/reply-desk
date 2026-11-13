/**
 * 크롬(YouTube) 조작 인터페이스.
 * 게시 단계와 로그인 확인은 이 인터페이스만 알고, 실제 구현(Playwright)은 DI 토큰으로 넣는다.
 * 테스트에서는 가짜 구현을 넣어 실제 YouTube에 댓글을 달지 않는다.
 */

/** 댓글 창 찾기 결과 */
export type CommentBoxResult =
  /** 댓글 창을 찾았다 */
  | 'ok'
  /** 로그인이 풀려 댓글 창 대신 로그인 버튼이 보인다 */
  | 'login_required'
  /** 댓글이 막힌 영상이다 */
  | 'comments_disabled'
  /** 제한 시간 안에 댓글 창이 뜨지 않았다 */
  | 'timeout';

/** 열린 YouTube 탭 하나 */
export interface YoutubePage {
  /**
   * 영상 화면을 연다 (한국어 화면으로)
   * @param youtubeId 유튜브 영상 ID
   */
  openVideo(youtubeId: string): Promise<void>;
  /**
   * 아래로 내려 댓글 입력 창을 찾고 누른다
   * @param timeoutMs 제한 시간
   */
  findCommentBox(timeoutMs: number): Promise<CommentBoxResult>;
  /**
   * 사람처럼 한 글자씩 입력한다
   * @param text 댓글
   * @param onProgress 한 글자 칠 때마다 (친 글자 수, 전체 글자 수)
   */
  typeComment(
    text: string,
    onProgress: (typed: number, total: number) => void,
  ): Promise<void>;
  /**
   * [댓글] 버튼을 누른다
   * @returns 눌렸고 입력 창이 비워졌으면 true
   */
  submit(): Promise<boolean>;
  /**
   * 방금 단 내 댓글을 찾는다
   * @param text 단 댓글
   * @param timeoutMs 제한 시간
   * @returns 찾으면 댓글 주소(못 읽으면 null)를 담은 값, 못 찾으면 null
   */
  findOwnComment(
    text: string,
    timeoutMs: number,
  ): Promise<{ url: string | null } | null>;
  /**
   * 지금 화면을 찍는다
   * @param type 미리보기는 jpeg, 실패 캡처는 png
   */
  screenshot(type: 'jpeg' | 'png'): Promise<Buffer>;
  /** 크롬을 닫는다 */
  close(): Promise<void>;
}

/** 로그인 확인 결과 */
export interface LoginCheckResult {
  /** 로그인되어 있는지 */
  loggedIn: boolean;
  /** 채널 ID (로그인했지만 채널이 없으면 null) */
  channelId: string | null;
  /** 채널 이름 */
  channelTitle: string | null;
  /** 유튜브 화면 언어 (예: ko-KR) */
  uiLanguage: string | null;
}

/** 크롬 다루기 */
export interface YoutubeBrowser {
  /**
   * 프로필 폴더로 크롬을 띄워 YouTube 탭을 연다 (게시용)
   * @param profileDir 크롬 프로필 폴더
   * @param opts.headless 창 없이 띄울지
   * @throws ProfileInUseError 같은 프로필의 크롬이 이미 열려 있으면
   */
  openPage(
    profileDir: string,
    opts: { headless: boolean },
  ): Promise<YoutubePage>;
  /**
   * 창 없이 띄워 로그인·채널·화면 언어를 읽는다
   * @param profileDir 크롬 프로필 폴더
   * @throws ProfileInUseError 같은 프로필의 크롬이 이미 열려 있으면
   */
  checkLogin(profileDir: string): Promise<LoginCheckResult>;
  /**
   * 사람이 로그인하도록 일반 크롬을 그 프로필로 연다 (자동화 크롬은 구글이 로그인을 막는다)
   * @param profileDir 크롬 프로필 폴더
   */
  openForManualLogin(profileDir: string): Promise<void>;
}

/** DI 토큰 */
export const YOUTUBE_BROWSER = Symbol('YOUTUBE_BROWSER');

/** 같은 프로필의 크롬이 이미 열려 있다 */
export class ProfileInUseError extends Error {
  constructor() {
    super(
      '같은 프로필의 크롬이 이미 열려 있어요 · 그 창을 닫고 다시 시도해 주세요',
    );
    this.name = 'ProfileInUseError';
  }
}
