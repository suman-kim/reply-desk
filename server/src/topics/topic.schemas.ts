import { z } from 'zod';
import { TopicStatus, VideoSortBy } from './topic.entity.js';

/** 문자열 목록: 앞뒤 공백을 지우고 빈 값·중복을 뺀다 */
const wordList = (max: number) =>
  z
    .array(z.string().trim().max(40, '한 단어는 40자까지예요'))
    .max(max, `${max}개까지 넣을 수 있어요`)
    .transform((list) => [...new Set(list.filter((w) => w.length > 0))]);

/** 주제 필드 (만들기·고치기 공통) */
const topicFields = {
  /** 주제 이름 */
  name: z
    .string()
    .trim()
    .min(1, '주제 이름을 적어 주세요')
    .max(60, '주제 이름은 60자까지예요'),
  /** 유도 대상 한 줄 */
  brandTarget: z
    .string()
    .trim()
    .min(1, '유도 대상을 적어 주세요')
    .max(200, '유도 대상은 200자까지예요'),
  /** 브랜드 언급 검사 단어 (등록 화면에서는 받지 않는다. 비어 있으면 브랜드 언급 검사·AI 지시를 건너뛴다) */
  brandWord: z.string().trim().max(40, '브랜드 단어는 40자까지예요'),
  /** 검색 키워드 */
  keywords: wordList(10).refine(
    (l) => l.length > 0,
    '검색 키워드를 하나 이상 넣어 주세요',
  ),
  /** 최근 며칠 (0이면 기간 제한 없음) */
  videoWindowDays: z
    .number()
    .int()
    .min(0, '0(무제한) 이상이어야 해요')
    .max(30, '30일까지 고를 수 있어요'),
  /** 정렬 기준 */
  videoSortBy: z.enum(VideoSortBy),
  /** 한 번에 불러올 영상 수 (0이면 무제한: 검색 결과 끝까지, 최대 500개) */
  fetchLimit: z
    .number()
    .int()
    .min(0, '0(무제한) 이상이어야 해요')
    .max(50, '50개까지 고르거나 무제한(0)으로 해 주세요'),
  /** 댓글 말투 */
  tone: z.string().trim().max(500, '말투 설명은 500자까지예요'),
  /** 최소 글자 수 */
  minLength: z
    .number()
    .int()
    .min(10, '최소 글자 수는 10자 이상이에요')
    .max(500),
  /** 최대 글자 수 */
  maxLength: z.number().int().min(10).max(500, '최대 글자 수는 500자까지예요'),
  /** 추가 금지 표현 */
  bannedWords: wordList(50),
  /** 다른 채널 영상 초안 맨 앞에 붙이는 광고 표시. 빈칸이면 붙이지 않는다 (RD-28: 글자 검사 없음) */
  adDisclosure: z.string().trim().max(20, '광고 표시는 20자까지예요'),
  /** 주제 하루 상한 */
  dailyCap: z.number().int().min(1, '하루 상한은 1 이상이에요').max(50),
  /** 상태 */
  status: z.enum(TopicStatus),
};

/** 최소·최대 글자 수 순서 검사 */
const lengthOrder = (v: { minLength?: number; maxLength?: number }) =>
  v.minLength === undefined ||
  v.maxLength === undefined ||
  v.minLength <= v.maxLength;
const lengthOrderMessage = {
  message: '최소 글자 수가 최대 글자 수보다 클 수 없어요',
  path: ['minLength'],
};

/** 주제 만들기 요청. 계획서의 예시 값을 기본값으로 둔다 */
export const createTopicSchema = z
  .object({
    ...topicFields,
    brandWord: topicFields.brandWord.default(''),
    videoWindowDays: topicFields.videoWindowDays.default(7),
    videoSortBy: topicFields.videoSortBy.default(VideoSortBy.ViewCount),
    fetchLimit: topicFields.fetchLimit.default(5),
    tone: topicFields.tone.default(''),
    minLength: topicFields.minLength.default(40),
    maxLength: topicFields.maxLength.default(120),
    bannedWords: topicFields.bannedWords.default([]),
    adDisclosure: topicFields.adDisclosure.default('[광고]'),
    dailyCap: topicFields.dailyCap.default(5),
    status: topicFields.status.default(TopicStatus.Active),
    /** 쓸 프로필 ID 목록 */
    profileIds: z.array(z.number().int().positive()).max(20).default([]),
  })
  .refine(lengthOrder, lengthOrderMessage);
export type CreateTopicDto = z.infer<typeof createTopicSchema>;

/** 주제 고치기 요청 (보낸 값만 바꾼다) */
export const updateTopicSchema = z
  .object({
    ...topicFields,
    /** 쓸 프로필 ID 목록 (보내면 통째로 바꾼다) */
    profileIds: z.array(z.number().int().positive()).max(20),
  })
  .partial()
  .refine(lengthOrder, lengthOrderMessage);
export type UpdateTopicDto = z.infer<typeof updateTopicSchema>;
