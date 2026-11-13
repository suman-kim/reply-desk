/**
 * YouTube 화면 요소 찾는 규칙. YouTube가 화면을 바꾸면 여기만 고친다.
 * 화면 언어와 상관없게 글자 대신 요소 ID·이름을 쓴다.
 */
export const SEL = {
  /** 로그인한 사람의 프로필 사진 버튼 */
  avatar:
    '#avatar-btn, button#avatar-btn, ytd-topbar-menu-button-renderer #avatar-btn',
  /** 로그인 버튼 (로그아웃 상태) */
  signIn:
    'a[href^="https://accounts.google.com/ServiceLogin"], ytd-button-renderer a[href*="ServiceLogin"]',
  /** 댓글 영역 */
  comments: 'ytd-comments#comments',
  /** 댓글 입력 창 (누르기 전 자리) */
  simplePlaceholder:
    'ytd-comment-simplebox-renderer #simplebox-placeholder, #placeholder-area',
  /** 댓글 입력 칸 (누른 뒤) */
  editor: 'ytd-commentbox #contenteditable-root, #contenteditable-root',
  /** [댓글] 버튼 */
  submit: 'ytd-commentbox #submit-button button, ytd-commentbox #submit-button',
  /** 댓글이 막혔다는 안내 */
  commentsDisabled: 'ytd-comments ytd-message-renderer, #comments #message',
  /** 댓글 본문들 */
  commentText: 'ytd-comments #content-text',
  /** 댓글 하나 (본문에서 위로 올라가 찾는다) */
  commentThread:
    'ytd-comment-thread-renderer, ytd-comment-view-model, ytd-comment-renderer',
  /** 댓글 시각 링크 (댓글 주소, lc= 붙음) */
  commentLink: '#published-time-text a, a[href*="lc="]',
} as const;

/** 채널 ID 모양 (UC로 시작하는 24자) */
export const CHANNEL_ID_PATTERN = /UC[A-Za-z0-9_-]{22}/;
