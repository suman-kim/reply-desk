import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { CheckResult } from '../checks/check.types.js';
import type { Topic } from '../topics/topic.entity.js';
import type { Video } from '../videos/video.entity.js';
import type { VideoAnalysis } from './video-analysis.entity.js';

/**
 * 초안 작성 상태.
 * 게시 관련 상태(게시 대기·실패·게시 완료·초안만)는 저장하지 않고
 * 게시 기록과 내 채널 여부로 그때그때 계산한다(두 곳에 적어 어긋나지 않게).
 */
export enum DraftState {
  /** AI가 쓰는 중 */
  Writing = 'writing',
  /** 다 썼음 (검사 통과 여부는 check_passed) */
  Ready = 'ready',
  /** AI 작성 실패 */
  Error = 'error',
}

/**
 * 댓글 초안. 영상·주제마다 다시 생성하면 새 행이 쌓이고 가장 최근 것을 쓴다.
 */
@Entity({ name: 'draft', comment: '댓글 초안. 다시 생성하면 새 행이 쌓인다' })
@Index('ix_draft_topic_video', ['topicId', 'videoId', 'createdAt'])
export class Draft {
  /** 초안 ID */
  @PrimaryGeneratedColumn({ comment: '초안 ID' })
  id: number;

  /** 주제 ID */
  @Column({ name: 'topic_id', type: 'int', comment: '주제 ID' })
  topicId: number;

  /** 영상 ID */
  @Column({ name: 'video_id', type: 'int', comment: '영상 ID (video.id)' })
  videoId: number;

  /** 근거로 쓴 분석 ID */
  @Column({
    name: 'analysis_id',
    type: 'int',
    nullable: true,
    comment: '초안이 근거로 쓴 분석 ID',
  })
  analysisId: number | null;

  /** 주제 */
  @ManyToOne('Topic', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'topic_id' })
  topic?: Topic;

  /** 영상 */
  @ManyToOne('Video', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'video_id' })
  video?: Video;

  /** 근거 분석 */
  @ManyToOne('VideoAnalysis', { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'analysis_id' })
  analysis?: VideoAnalysis | null;

  /** 작성 상태 */
  @Column({
    type: 'enum',
    enum: DraftState,
    enumName: 'draft_state',
    default: DraftState.Writing,
    comment: '작성 상태 (writing: 쓰는 중, ready: 다 씀, error: 작성 실패)',
  })
  state: DraftState;

  /** 지금 초안 (사람이 고치면 바뀜) */
  @Column({
    type: 'text',
    default: '',
    comment: '지금 초안 글. 사람이 고치면 이 값이 바뀐다',
  })
  text: string;

  /** AI가 처음 쓴 글 */
  @Column({
    name: 'ai_text',
    type: 'text',
    default: '',
    comment: 'AI가 처음 쓴 글 (고치기 전 원본)',
  })
  aiText: string;

  /** 이 댓글을 이렇게 쓴 이유 */
  @Column({
    type: 'jsonb',
    default: () => "'[]'",
    comment: '이 댓글을 이렇게 쓴 이유 2~3개 (문자열 배열)',
  })
  reasons: string[];

  /** 사람이 고쳤는지 */
  @Column({
    type: 'boolean',
    default: false,
    comment: '사람이 직접 고쳤는지. 참이면 이유 상자에 "AI 초안 기준"을 붙인다',
  })
  edited: boolean;

  /** 자동 검사 결과 */
  @Column({
    name: 'check_results',
    type: 'jsonb',
    default: () => "'[]'",
    comment: '자동 검사 결과 [{code, label, passed, detail}]',
  })
  checkResults: CheckResult[];

  /** 자동 검사 모두 통과했는지 */
  @Column({
    name: 'check_passed',
    type: 'boolean',
    default: false,
    comment: '자동 검사를 모두 통과했는지',
  })
  checkPassed: boolean;

  /** 쓴 AI 제공자 */
  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
    comment: '초안을 쓴 AI 제공자 (gemini, claude, ollama)',
  })
  provider: string | null;

  /** 쓴 모델 이름 */
  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    comment: '초안을 쓴 모델 이름',
  })
  model: string | null;

  /** 작성 실패 원인 */
  @Column({
    name: 'error_message',
    type: 'text',
    nullable: true,
    comment: '작성 실패 원인 한 줄 (state=error일 때)',
  })
  errorMessage: string | null;

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
