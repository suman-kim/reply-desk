/**
 * 서버 응답 타입. server/src 의 같은 이름 타입을 화면에서 쓰는 만큼만 옮겼다.
 * 서버를 고치면 여기도 함께 고친다.
 */

/** 프로필 로그인 상태 */
export type LoginStatus = 'unknown' | 'ok' | 'needs_login';

/** 주제 (GET /topics) */
export interface Topic {
  /** 주제 ID */
  id: number;
  /** 주제 이름 */
  name: string;
  /** 유도 대상 한 줄 */
  brandTarget: string;
  /** 브랜드 언급 검사 단어 */
  brandWord: string;
  /** 검색 키워드 */
  keywords: string[];
  /** 최근 며칠 */
  videoWindowDays: number;
  /** 정렬 기준 */
  videoSortBy: 'view_count' | 'date';
  /** 한 번에 불러올 영상 수 */
  fetchLimit: number;
  /** 댓글 말투 */
  tone: string;
  /** 최소 글자 수 */
  minLength: number;
  /** 최대 글자 수 */
  maxLength: number;
  /** 추가 금지 표현 */
  bannedWords: string[];
  /** 다른 채널 영상 댓글 맨 앞에 붙이는 광고 표시 (예: [광고]) */
  adDisclosure: string;
  /** 주제 하루 상한 */
  dailyCap: number;
  /** 상태 */
  status: 'active' | 'paused';
  /** 쓸 프로필 */
  profiles: { id: number; name: string; loginStatus: LoginStatus }[];
  /** 오늘 게시 수 */
  postedToday: number;
  /** 게시 대기 초안 수 */
  pendingDrafts: number;
}

/** 주제 만들기·고치기 요청 */
export type TopicInput = Pick<
  Topic,
  | 'name'
  | 'brandTarget'
  | 'keywords'
  | 'videoWindowDays'
  | 'videoSortBy'
  | 'fetchLimit'
  | 'tone'
  | 'minLength'
  | 'maxLength'
  | 'bannedWords'
  | 'adDisclosure'
  | 'dailyCap'
  | 'status'
> & { profileIds: number[] };

/** 프로필 (GET /profiles) */
export interface Profile {
  /** 프로필 ID */
  id: number;
  /** 이름 (유튜브1) */
  name: string;
  /** 폴더 이름 */
  slug: string;
  /** 폴더 경로 */
  folderPath: string;
  /** 가린 구글 계정 */
  googleAccountMasked: string | null;
  /** 채널 ID */
  channelId: string | null;
  /** 채널 이름 */
  channelTitle: string | null;
  /** 화면 언어 */
  uiLanguage: string | null;
  /** 로그인 상태 */
  loginStatus: LoginStatus;
  /** 마지막 확인 시각 */
  lastCheckedAt: string | null;
  /** 오늘 게시 수 */
  postedToday: number;
  /** 쓰는 주제 */
  topics: { id: number; name: string }[];
}

/** [크롬 열기] 결과 */
export interface OpenLoginView {
  /** 화면에 보일 한 줄 (다음 할 일) */
  message: string;
  /** 원격 연결 없이 열려 있던 크롬을 닫고 다시 열었는지 */
  restarted: boolean;
}

/** 로그인 확인 결과 (POST /profiles/:id/check) */
export interface LoginCheckView {
  /** 고친 프로필 */
  profile: Profile;
  /** 결과 한 줄 */
  message: string;
  /** 경고인지 */
  warning: boolean;
}

/** 초안 작성 상태 */
export type DraftState = 'writing' | 'ready' | 'error';

/** ① 영상 카드 (GET /topics/:id/videos) */
export interface VideoItem {
  /** 내부 영상 ID */
  id: number;
  /** 유튜브 영상 ID */
  youtubeId: string;
  /** 유튜브 주소 */
  url: string;
  /** 제목 */
  title: string;
  /** 채널 이름 */
  channelTitle: string;
  /** 올린 시각 */
  publishedAt: string;
  /** 조회수 */
  viewCount: number;
  /** 길이(초) */
  durationSec: number;
  /** 썸네일 */
  thumbnailUrl: string | null;
  /** 불러오기 순위 */
  rank: number | null;
  /** 들어온 경로 */
  source: 'search' | 'manual';
  /** 내 채널 영상 */
  isMine: boolean;
  /** 댓글 완료 */
  commented: boolean;
  /** 최근 초안 상태 */
  draftState: DraftState | 'none';
  /** 최근 초안 검사 통과 */
  checkPassed: boolean;
}

/** 자동 작성 진행률 */
export interface DraftProgress {
  /** 묶음 영상 수 */
  total: number;
  /** 끝난 수 */
  done: number;
  /** 실패 수 */
  failed: number;
  /** 도는 중 */
  running: boolean;
  /** 지금 쓰는 영상 */
  currentVideoId: number | null;
  /** 마지막 실패 원인 */
  lastError: string | null;
}

/** 근거 장면 */
export interface EvidenceScene {
  /** 시점 (04:12), 댓글이면 null */
  time: string | null;
  /** 인용 */
  quote: string;
  /** 출처 */
  source: 'video' | 'comment';
}

/** 영상 분석 */
export interface Analysis {
  /** 분석 ID */
  id: number;
  /** 고민 한 줄 */
  worry: string;
  /** 고른 이유 */
  pickReasons: string[];
  /** 근거 장면 */
  scenes: EvidenceScene[];
  /** 분석한 AI */
  provider: string;
  /** 모델 */
  model: string;
}

/** 자동 검사 결과 한 줄 */
export interface CheckResult {
  /** 검사 코드 */
  code: string;
  /** 검사 이름 */
  label: string;
  /** 통과 */
  passed: boolean;
  /** 결과 설명 */
  detail: string;
}

/** 초안 */
export interface Draft {
  /** 초안 ID */
  id: number;
  /** 주제 ID */
  topicId: number;
  /** 영상 ID */
  videoId: number;
  /** 작성 상태 */
  state: DraftState;
  /** 지금 글 */
  text: string;
  /** AI 원본 */
  aiText: string;
  /** 쓴 이유 */
  reasons: string[];
  /** 사람이 고쳤는지 */
  edited: boolean;
  /** 검사 결과 */
  checkResults: CheckResult[];
  /** 검사 통과 */
  checkPassed: boolean;
  /** 쓴 AI */
  provider: string | null;
  /** 모델 */
  model: string | null;
  /** 작성 실패 원인 */
  errorMessage: string | null;
  /** 만든 시각 */
  createdAt: string;
  /** 고친 시각 */
  updatedAt: string;
}

/** 초안 목록 상태 */
export type DraftListStatus = 'pending' | 'failed' | 'check_failed' | 'posted' | 'writing' | 'error';

/** 게시 결과 */
export type PostStatus = 'running' | 'success' | 'failed';

/** 게시 단계 */
export type PostStep = 'open_profile' | 'find_comment_box' | 'type' | 'submit' | 'verify';

/** ② 칸 / 초안 상세 (GET /topics/:id/videos/:videoId/draft) */
export interface DraftDetail {
  /** 영상 */
  video: VideoItem;
  /** 최근 분석 */
  analysis: Analysis | null;
  /** 최근 초안 */
  draft: Draft | null;
  /** 목록 상태 */
  status: { code: DraftListStatus; label: string } | null;
  /** 이 영상의 게시 기록 */
  attempts: {
    id: number;
    status: PostStatus;
    failedStep: PostStep | null;
    failureReason: string | null;
    startedAt: string;
    commentUrl: string | null;
  }[];
}

/** 진행 단계 한 줄 */
export interface StepView {
  /** 단계 */
  step: PostStep;
  /** 이름 */
  label: string;
  /** 상태 */
  state: 'done' | 'running' | 'failed' | 'waiting';
}

/** 게시 상태 (GET /posting/attempts/:id) */
export interface AttemptView {
  /** 게시 시도 ID */
  id: number;
  /** 결과 */
  status: PostStatus;
  /** 프로필 이름 */
  profileName: string | null;
  /** 진행 5단계 */
  steps: StepView[];
  /** 입력 진행 */
  typing: { typed: number; total: number } | null;
  /** 실패 원인 */
  failureReason: string | null;
  /** 실패 캡처 있음 */
  hasCapture: boolean;
  /** 미리보기 있음 */
  hasPreview: boolean;
  /** 댓글 주소 */
  commentUrl: string | null;
  /** 시작 */
  startedAt: string;
  /** 끝 */
  finishedAt: string | null;
}

/** 게시 판단 (GET /topics/:id/post-check) */
export interface PostCheck {
  /** 버튼 열림 */
  allowed: boolean;
  /** 막힌 사유 */
  block: { code: string; message: string } | null;
  /** 게시할 프로필 */
  profile: { id: number; name: string } | null;
  /** 자동 배정인지 */
  autoAssigned: boolean;
  /** 오늘 현황 */
  today: { posted: number; cap: number; topicPosted: number; topicCap: number };
}

/** 오늘 게시 현황 (GET /posting/today) */
export interface TodayQuota {
  /** 오늘 전체 */
  posted: number;
  /** 전체 상한 */
  cap: number;
  /** 주제별 */
  byTopic: Record<string, number>;
}

/** 게시 기록 한 행 (GET /posting/logs) */
export interface PostLogRow {
  /** 게시 시도 ID */
  id: number;
  /** 시작 */
  startedAt: string;
  /** 영상 */
  video: { id: number; youtubeId: string; title: string } | null;
  /** 주제 */
  topic: { id: number; name: string } | null;
  /** 프로필 이름 */
  profileName: string | null;
  /** 댓글 */
  commentText: string;
  /** 결과 */
  status: PostStatus;
  /** 실패 원인 */
  failureReason: string | null;
  /** 캡처 있음 */
  hasScreenshot: boolean;
  /** 댓글 주소 */
  commentUrl: string | null;
}

/** 초안 목록 한 행 (GET /drafts) */
export interface DraftListRow {
  /** 초안 ID */
  id: number;
  /** 주제 */
  topic: { id: number; name: string };
  /** 영상 */
  video: { id: number; youtubeId: string; title: string; channelTitle: string; isMine: boolean };
  /** 글 */
  text: string;
  /** 고쳤는지 */
  edited: boolean;
  /** 상태 */
  status: DraftListStatus;
  /** 상태 이름 */
  statusLabel: string;
  /** 작성 실패 원인 */
  errorMessage: string | null;
  /** 고친 시각 */
  updatedAt: string;
}

/** 설정 한 줄 (GET /settings) */
export interface SettingView {
  /** 키 */
  key: string;
  /** 이름 */
  label: string;
  /** 도움말 */
  help: string;
  /** 지금 값 */
  value: unknown;
  /** 기본값 */
  defaultValue: unknown;
  /** 기본값인지 */
  isDefault: boolean;
}

/** AI 제공자 */
export type AiProviderId = 'gemini' | 'claude' | 'openai' | 'ollama';

/** AI 제공자 안내 (GET /settings/ai/providers) */
/** 역할별 프롬프트 안내 (GET /settings/prompts). 값은 설정 prompt.analysis·prompt.drafting */
export interface PromptInfo {
  /** 설정 키 */
  key: string;
  /** 덩이 (지시·자료 틀·다시 쓸 때) */
  parts: {
    /** 설정 값 안의 칸 이름 (system, user, retry) */
    field: string;
    /** 화면 이름 */
    label: string;
    /** 무엇을 쓰는 덩이인지 */
    help: string;
    /** 쓸 수 있는 {{자리}} */
    vars: { name: string; help: string }[];
  }[];
  /** AI에게 함께 보내는 답의 모양 (읽기만, label은 우리말 이름) */
  response: { name: string; label: string; description: string }[];
}

/** 프롬프트 예시 보기 (POST /settings/prompts/preview) */
export interface PromptPreview {
  /** 채운 값의 출처 (주제는 실제, 영상은 예시) */
  basis: { topicName: string; videoTitle: string; watchesVideo: boolean };
  /** 지시 */
  system: string;
  /** 자료 틀을 채운 글 (slot이 있으면 빈칸에서 온 값) */
  user: { text: string; slot: string | null }[];
  /** 다시 쓸 때 덧붙이는 글 (작성만) */
  retry: { text: string; slot: string | null }[] | null;
}

/** 영상 보기 창의 인기 댓글 (GET /topics/:id/videos/:videoId/comments) */
export interface VideoComments {
  /** 댓글이 막힌 영상인지 */
  disabled: boolean;
  /** 댓글 (관련성 순) */
  comments: {
    /** 댓글 ID */
    id: string;
    /** 쓴 사람 */
    author: string;
    /** 쓴 사람 사진 */
    authorImageUrl: string | null;
    /** 본문 */
    text: string;
    /** 좋아요 수 */
    likeCount: number;
    /** 답글 수 */
    replyCount: number;
    /** 쓴 시각 (ISO) */
    publishedAt: string;
  }[];
}

/** 모델 고르기 목록 (GET /settings/ai/providers/:id/models) */
export interface AiModelList {
  /** 제공자 */
  provider: AiProviderId;
  /** live = 제공자 API에서 받음, recommended = 키가 없거나 받지 못해 추천 목록 */
  source: 'live' | 'recommended';
  /** 모델 (추천이 앞) */
  models: {
    /** 모델 ID (저장하는 값) */
    id: string;
    /** 화면 이름 */
    label: string;
    /** 추천 모델인지 */
    recommended: boolean;
    /** 가격·무료 여부·한 줄 설명 (가격표에 없으면 null) */
    pricing: {
      /** 입력 100만 토큰 가격 (달러) */
      inputPerM: number;
      /** 출력 100만 토큰 가격 (달러) */
      outputPerM: number;
      /** 무료로 쓸 수 있는지 */
      free: boolean;
      /** 어떤 모델인지 한 줄 */
      summary: string;
      /** 알아 둘 것 (가격 인상 예정 등) */
      note?: string;
    } | null;
  }[];
  /** 추천 목록인 이유 같은 안내 한 줄 */
  note: string | null;
  /** 가격표 출처와 확인한 날 (Ollama는 null) */
  pricingSource: { url: string; checkedAt: string } | null;
}

export interface AiProviderInfo {
  /** ID */
  id: AiProviderId;
  /** 이름 */
  label: string;
  /** 쓸 수 있는지 */
  ready: boolean;
  /** 안내 */
  note: string;
  /** 영상을 직접 보는지 */
  canWatchVideo: boolean;
  /** 모델 예시 */
  modelExamples: string[];
}
