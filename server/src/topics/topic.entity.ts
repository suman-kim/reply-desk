import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { TopicProfile } from './topic-profile.entity.js';

/** 주제 상태 */
export enum TopicStatus {
  /** 진행 중: 불러오기·초안·게시를 할 수 있다 */
  Active = 'active',
  /** 일시정지: 게시가 막힌다 */
  Paused = 'paused',
}

/** 영상 정렬 기준 */
export enum VideoSortBy {
  /** 조회수 높은 순 */
  ViewCount = 'view_count',
  /** 최신순 */
  Date = 'date',
}

/**
 * 주제 = 홍보 대상 하나.
 * ①②③ 과정과 기록은 고른 주제 안에서만 돈다.
 */
@Entity({
  name: 'topic',
  comment: '주제(홍보 대상). 불러오기·초안·게시가 이 단위로 돈다',
})
export class Topic {
  /** 주제 ID */
  @PrimaryGeneratedColumn({ comment: '주제 ID' })
  id: number;

  /** 주제 이름 (예: 운명원 연애 사주) */
  @Column({
    type: 'varchar',
    length: 60,
    comment: '주제 이름 (예: 운명원 연애 사주)',
  })
  name: string;

  /** 유도 대상 한 줄 설명. 댓글 작성 프롬프트에 들어간다 */
  @Column({
    name: 'brand_target',
    type: 'varchar',
    length: 200,
    comment:
      '유도 대상 한 줄 설명 (예: 운명원 · 연애 사주 잘 보는 곳). 댓글 작성에 쓴다',
  })
  brandTarget: string;

  /** 브랜드 언급 검사에 쓰는 단어 (예: 운명원) */
  @Column({
    name: 'brand_word',
    type: 'varchar',
    length: 40,
    comment:
      '브랜드 언급 자동 검사에 쓰는 단어 (예: 운명원). 비어 있으면 브랜드 언급 검사와 AI 지시를 건너뛴다',
  })
  brandWord: string;

  /** 영상 검색 키워드 목록 */
  @Column({
    type: 'text',
    array: true,
    comment: '영상 검색 키워드 목록 (예: {연애,썸,재회})',
  })
  keywords: string[];

  /** 최근 며칠 안에 올라온 영상만 볼지 */
  @Column({
    name: 'video_window_days',
    type: 'int',
    default: 7,
    comment: '최근 며칠 안에 올라온 영상만 불러올지 (일). 0이면 기간 제한 없음',
  })
  videoWindowDays: number;

  /** 영상 정렬 기준 */
  @Column({
    name: 'video_sort_by',
    type: 'enum',
    enum: VideoSortBy,
    enumName: 'video_sort_by',
    default: VideoSortBy.ViewCount,
    comment: '영상 정렬 기준 (view_count: 조회수 높은 순, date: 최신순)',
  })
  videoSortBy: VideoSortBy;

  /** 한 번에 불러올 영상 수 */
  @Column({
    name: 'fetch_limit',
    type: 'int',
    default: 5,
    comment:
      '[영상 불러오기] 한 번에 가져올 영상 수. 0이면 무제한(검색 결과 끝까지, 최대 500개)',
  })
  fetchLimit: number;

  /** 댓글 말투 설명 */
  @Column({
    type: 'text',
    default: '',
    comment: '댓글 말투 설명 (예: 20~30대 시청자, 공감형 구어체)',
  })
  tone: string;

  /** 댓글 최소 글자 수 */
  @Column({
    name: 'min_length',
    type: 'int',
    default: 40,
    comment: '댓글 최소 글자 수 (자동 검사)',
  })
  minLength: number;

  /** 댓글 최대 글자 수 */
  @Column({
    name: 'max_length',
    type: 'int',
    default: 120,
    comment: '댓글 최대 글자 수 (자동 검사)',
  })
  maxLength: number;

  /** 주제별 추가 금지 표현 */
  @Column({
    name: 'banned_words',
    type: 'text',
    array: true,
    default: () => "'{}'",
    comment:
      '주제별 추가 금지 표현. 공통 금지(링크·해시태그·지어낸 후기)와 함께 검사한다',
  })
  bannedWords: string[];

  /** 다른 채널 영상 댓글 맨 앞에 붙이는 광고 표시 */
  @Column({
    name: 'ad_disclosure',
    type: 'varchar',
    length: 20,
    default: '[광고]',
    comment:
      '다른 채널 영상 댓글 맨 앞에 붙이는 광고 표시 (예: [광고]). 내 채널 영상에는 붙이지 않는다',
  })
  adDisclosure: string;

  /** 이 주제의 하루 게시 상한 */
  @Column({
    name: 'daily_cap',
    type: 'int',
    default: 5,
    comment: '이 주제의 하루 게시 상한. 전체 하루 상한 안에서 나눠 쓴다',
  })
  dailyCap: number;

  /** 주제 상태 */
  @Column({
    type: 'enum',
    enum: TopicStatus,
    enumName: 'topic_status',
    default: TopicStatus.Active,
    comment: '주제 상태 (active: 진행 중, paused: 일시정지)',
  })
  status: TopicStatus;

  /** 이 주제가 쓸 프로필 연결 */
  @OneToMany('TopicProfile', 'topic')
  topicProfiles?: TopicProfile[];

  /** 만든 시각 */
  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    comment: '만든 시각',
  })
  createdAt: Date;

  /** 고친 시각 */
  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
    comment: '마지막으로 고친 시각',
  })
  updatedAt: Date;
}
