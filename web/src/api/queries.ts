import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './http';
import type {
  AiModelList,
  AiProviderId,
  AiProviderInfo,
  AttemptView,
  Draft,
  DraftDetail,
  DraftListRow,
  DraftListStatus,
  DraftProgress,
  LoginCheckView,
  OpenLoginView,
  PostCheck,
  PostLogRow,
  Profile,
  SettingView,
  TodayQuota,
  Topic,
  TopicInput,
  VideoComments,
  VideoItem,
} from './types';

/**
 * 데이터 키. 실시간 이벤트(live/useLiveEvents)가 이 키로 캐시를 고치거나 다시 읽게 한다.
 */
export const keys = {
  /** 주제 목록 */
  topics: ['topics'] as const,
  /** 주제 하나 */
  topic: (id: number) => ['topics', id] as const,
  /** 주제의 영상 목록 (①) */
  videos: (topicId: number) => ['videos', topicId] as const,
  /** ② 칸 / 초안 상세 */
  draft: (topicId: number, videoId: number) => ['draft', topicId, videoId] as const,
  /** 자동 작성 진행률 */
  progress: (topicId: number) => ['progress', topicId] as const,
  /** 게시 판단 (③) */
  postCheck: (topicId: number, videoId: number | null, profileId: number | null) =>
    ['postCheck', topicId, videoId, profileId] as const,
  /** 게시 상태 */
  attempt: (id: number) => ['attempt', id] as const,
  /** 미리보기 번호 */
  preview: (id: number) => ['preview', id] as const,
  /** 프로필 목록 */
  profiles: ['profiles'] as const,
  /** 오늘 게시 현황 */
  today: ['today'] as const,
  /** 게시 기록 (주제 ID 또는 전체) */
  logs: (topicId: number | null) => ['logs', topicId] as const,
  /** 초안 목록 */
  drafts: (filter: object) => ['drafts', filter] as const,
  /** 설정 */
  settings: ['settings'] as const,
  /** AI 제공자 */
  providers: ['providers'] as const,
  /** 제공자의 모델 고르기 목록 */
  aiModels: (provider: AiProviderId) => ['aiModels', provider] as const,
  /** 영상 보기 창 댓글 */
  comments: (topicId: number, videoId: number) => ['comments', topicId, videoId] as const,
};

/** 주제 목록 */
export const useTopics = () => useQuery({ queryKey: keys.topics, queryFn: () => api<Topic[]>('GET', '/topics') });

/**
 * 주제 하나
 * @param id 주제 ID (없으면 부르지 않음)
 */
export const useTopic = (id: number | null) =>
  useQuery({ queryKey: keys.topic(id ?? 0), queryFn: () => api<Topic>('GET', `/topics/${id}`), enabled: !!id });

/**
 * 주제의 영상 목록
 * @param topicId 주제 ID
 */
export const useVideos = (topicId: number | null) =>
  useQuery({
    queryKey: keys.videos(topicId ?? 0),
    queryFn: () => api<VideoItem[]>('GET', `/topics/${topicId}/videos`),
    enabled: !!topicId,
  });

/**
 * ② 칸 / 초안 상세
 * @param topicId 주제 ID
 * @param videoId 영상 ID
 */
export const useDraftDetail = (topicId: number | null, videoId: number | null) =>
  useQuery({
    queryKey: keys.draft(topicId ?? 0, videoId ?? 0),
    queryFn: () => api<DraftDetail>('GET', `/topics/${topicId}/videos/${videoId}/draft`),
    enabled: !!topicId && !!videoId,
  });

/**
 * 자동 작성 진행률 (실시간 이벤트가 채운다)
 * @param topicId 주제 ID
 */
/**
 * 영상 보기 창의 인기 댓글 (서버가 5분 받아 둔다)
 * @param topicId 주제 ID
 * @param videoId 영상 ID (null이면 받지 않는다)
 */
export const useVideoComments = (topicId: number, videoId: number | null) =>
  useQuery({
    queryKey: keys.comments(topicId, videoId ?? 0),
    queryFn: () => api<VideoComments>('GET', `/topics/${topicId}/videos/${videoId}/comments?limit=50`),
    enabled: !!videoId,
    staleTime: 5 * 60_000,
  });

export const useDraftProgress = (topicId: number | null) =>
  useQuery({
    queryKey: keys.progress(topicId ?? 0),
    queryFn: () => api<DraftProgress | null>('GET', `/topics/${topicId}/drafts/progress`),
    enabled: !!topicId,
  });

/**
 * 게시 판단
 * @param topicId 주제 ID
 * @param videoId 영상 ID
 * @param profileId 프로필 ID (없으면 자동 배정)
 */
export const usePostCheck = (topicId: number | null, videoId: number | null, profileId: number | null) =>
  useQuery({
    queryKey: keys.postCheck(topicId ?? 0, videoId, profileId),
    queryFn: () => {
      const q = new URLSearchParams();
      if (videoId) q.set('videoId', String(videoId));
      if (profileId) q.set('profileId', String(profileId));
      return api<PostCheck>('GET', `/topics/${topicId}/post-check?${q}`);
    },
    enabled: !!topicId,
  });

/**
 * 게시 상태 (실시간 이벤트가 진행을 채운다)
 * @param id 게시 시도 ID
 */
export const useAttempt = (id: number | null) =>
  useQuery({
    queryKey: keys.attempt(id ?? 0),
    queryFn: () => api<AttemptView>('GET', `/posting/attempts/${id}`),
    enabled: !!id,
  });

/** 프로필 목록 */
export const useProfiles = () => useQuery({ queryKey: keys.profiles, queryFn: () => api<Profile[]>('GET', '/profiles') });

/** 오늘 게시 현황 */
export const useToday = () => useQuery({ queryKey: keys.today, queryFn: () => api<TodayQuota>('GET', '/posting/today') });

/**
 * 게시 기록
 * @param topicId 주제 ID (null이면 전체)
 */
export const useLogs = (topicId: number | null) =>
  useQuery({
    queryKey: keys.logs(topicId),
    queryFn: () => api<PostLogRow[]>('GET', `/posting/logs${topicId ? `?topicId=${topicId}` : ''}`),
  });

/** 초안 목록 조건 */
export interface DraftFilter {
  /** 상태 */
  status?: DraftListStatus;
  /** 주제 ID */
  topicId?: number;
  /** 검색어 */
  q?: string;
}

/**
 * 초안 목록
 * @param filter 조건
 */
export const useDrafts = (filter: DraftFilter) =>
  useQuery({
    queryKey: keys.drafts(filter),
    queryFn: () => {
      const q = new URLSearchParams();
      if (filter.status) q.set('status', filter.status);
      if (filter.topicId) q.set('topicId', String(filter.topicId));
      if (filter.q) q.set('q', filter.q);
      return api<{ rows: DraftListRow[]; counts: Record<DraftListStatus, number> }>('GET', `/drafts?${q}`);
    },
    placeholderData: (prev) => prev,
  });

/** 설정 */
export const useSettings = () => useQuery({ queryKey: keys.settings, queryFn: () => api<SettingView[]>('GET', '/settings') });

/** AI 제공자 */
export const useAiProviders = () =>
  useQuery({ queryKey: keys.providers, queryFn: () => api<AiProviderInfo[]>('GET', '/settings/ai/providers') });

/**
 * 제공자의 모델 고르기 목록 (서버가 10분 동안 받아 둔다)
 * @param provider 제공자
 */
export const useAiModels = (provider: AiProviderId) =>
  useQuery({
    queryKey: keys.aiModels(provider),
    queryFn: () => api<AiModelList>('GET', `/settings/ai/providers/${provider}/models`),
    staleTime: 10 * 60_000,
  });

/**
 * 바꾸는 요청 모음. 성공하면 관련 데이터를 다시 읽는다.
 */
export function useActions() {
  const qc = useQueryClient();
  /** 키 앞부분으로 다시 읽기 */
  const refresh = (...prefixes: string[]) =>
    Promise.all(prefixes.map((p) => qc.invalidateQueries({ queryKey: [p] })));

  return {
    /** 모델 목록 새로 받기 (키를 넣었거나 모델을 새로 받았을 때) */
    refreshAiModels: useMutation({
      mutationFn: (provider: AiProviderId) => api<AiModelList>('GET', `/settings/ai/providers/${provider}/models?refresh=1`),
      onSuccess: (list) => {
        qc.setQueryData(keys.aiModels(list.provider), list);
        void refresh('providers');
      },
    }),
    /** 주제 만들기 */
    createTopic: useMutation({
      mutationFn: (input: TopicInput) => api<Topic>('POST', '/topics', input),
      onSuccess: () => refresh('topics', 'profiles'),
    }),
    /** 주제 고치기 */
    updateTopic: useMutation({
      mutationFn: ({ id, input }: { id: number; input: Partial<TopicInput> }) => api<Topic>('PATCH', `/topics/${id}`, input),
      onSuccess: () => refresh('topics', 'profiles', 'postCheck'),
    }),
    /** 주제 지우기 */
    deleteTopic: useMutation({
      mutationFn: (id: number) => api<{ id: number }>('DELETE', `/topics/${id}`),
      onSuccess: () => refresh('topics', 'profiles', 'drafts'),
    }),
    /** [영상 불러오기] + 자동 작성 */
    load: useMutation({
      mutationFn: (topicId: number) =>
        api<{ videos: VideoItem[] }>('POST', `/topics/${topicId}/load`),
      onSuccess: (res, topicId) => {
        // 불러오기는 영상만 받는다 (초안은 ②의 [초안 작성]에서)
        qc.setQueryData(keys.videos(topicId), res.videos);
      },
    }),
    /** 링크 직접 추가 */
    addVideo: useMutation({
      mutationFn: ({ topicId, url }: { topicId: number; url: string }) =>
        api<VideoItem>('POST', `/topics/${topicId}/videos`, { url }),
      onSuccess: () => refresh('videos'),
    }),
    /** [다시 생성] */
    regenerate: useMutation({
      mutationFn: ({ topicId, videoId, reanalyze }: { topicId: number; videoId: number; reanalyze: boolean }) =>
        api<DraftDetail>('POST', `/topics/${topicId}/videos/${videoId}/draft`, { reanalyze }),
      onSuccess: (res, v) => {
        qc.setQueryData(keys.draft(v.topicId, v.videoId), res);
        return refresh('videos', 'drafts', 'postCheck');
      },
    }),
    /** 초안 고치기 */
    editDraft: useMutation({
      mutationFn: ({ draftId, text }: { draftId: number; text: string }) => api<Draft>('PATCH', `/drafts/${draftId}`, { text }),
      onSuccess: (saved) => {
        qc.setQueryData<DraftDetail>(keys.draft(saved.topicId, saved.videoId), (old) => (old ? { ...old, draft: saved } : old));
        return refresh('postCheck', 'drafts', 'topics');
      },
    }),
    /** [댓글 달기] */
    post: useMutation({
      mutationFn: ({ topicId, videoId, profileId }: { topicId: number; videoId: number; profileId: number | null }) =>
        api<AttemptView>('POST', `/topics/${topicId}/videos/${videoId}/post`, profileId ? { profileId } : {}),
      onSuccess: (attempt) => {
        qc.setQueryData(keys.attempt(attempt.id), attempt);
        return refresh('postCheck', 'logs', 'draft');
      },
    }),
    /** 프로필 만들기 */
    createProfile: useMutation({
      mutationFn: (input: { name: string; slug?: string }) => api<Profile>('POST', '/profiles', input),
      onSuccess: () => refresh('profiles'),
    }),
    /** 프로필 지우기 */
    deleteProfile: useMutation({
      mutationFn: (id: number) => api<{ id: number }>('DELETE', `/profiles/${id}`),
      onSuccess: () => refresh('profiles', 'topics', 'postCheck'),
    }),
    /** [크롬 열고 직접 로그인] */
    openLogin: useMutation({
      mutationFn: (id: number) => api<OpenLoginView>('POST', `/profiles/${id}/login`),
    }),
    /** [로그인 확인] */
    checkLogin: useMutation({
      mutationFn: (id: number) => api<LoginCheckView>('POST', `/profiles/${id}/check`),
      onSuccess: () => refresh('profiles', 'topics', 'postCheck', 'videos'),
    }),
    /** 설정 바꾸기 */
    updateSetting: useMutation({
      mutationFn: ({ key, value }: { key: string; value: unknown }) => api<SettingView>('PUT', `/settings/${key}`, { value }),
      onSuccess: () => refresh('settings', 'providers', 'today', 'postCheck'),
    }),
    /** 설정 기본값으로 */
    resetSetting: useMutation({
      mutationFn: (key: string) => api<SettingView>('DELETE', `/settings/${key}`),
      onSuccess: () => refresh('settings', 'providers', 'today', 'postCheck'),
    }),
  };
}
