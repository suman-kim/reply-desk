import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Topic } from '../topics/topic.entity.js';
import type { Video } from '../videos/video.entity.js';

/** 근거 장면 하나 */
export interface EvidenceScene {
  /** 시점 (예: 04:12). 인기 댓글이면 null */
  time: string | null;
  /** 원문 인용 */
  quote: string;
  /** 출처 (video: 영상 속 장면, comment: 인기 댓글) */
  source: 'video' | 'comment';
}

/**
 * AI가 영상을 보고 뽑은 분석 (② 칸 위쪽).
 * 다시 분석하면 새 행이 쌓이고, 가장 최근 행을 쓴다.
 */
@Entity({
  name: 'video_analysis',
  comment: 'AI 영상 분석 결과: 주제와 매칭(%)·이유, 고른 이유, 근거 장면',
})
@Index('ix_video_analysis_topic_video', ['topicId', 'videoId', 'createdAt'])
export class VideoAnalysis {
  /** 분석 ID */
  @PrimaryGeneratedColumn({ comment: '분석 ID' })
  id: number;

  /** 주제 ID */
  @Column({ name: 'topic_id', type: 'int', comment: '주제 ID' })
  topicId: number;

  /** 영상 ID */
  @Column({ name: 'video_id', type: 'int', comment: '영상 ID (video.id)' })
  videoId: number;

  /** 주제 */
  @ManyToOne('Topic', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'topic_id' })
  topic?: Topic;

  /** 영상 */
  @ManyToOne('Video', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'video_id' })
  video?: Video;

  /** 주제와 매칭 퍼센트 (0~100, AI 판단). 이 기능 전에 한 분석은 null */
  @Column({
    name: 'topic_match',
    type: 'smallint',
    nullable: true,
    comment:
      '이 영상이 주제(홍보 대상·관심 키워드)와 얼마나 맞는지 0~100 (AI 판단). 이 기능 전에 한 분석은 null',
  })
  topicMatch: number | null;

  /** 매칭 퍼센트를 그렇게 매긴 이유 한 줄 */
  @Column({
    name: 'topic_match_reason',
    type: 'text',
    nullable: true,
    comment: '주제 매칭 퍼센트를 그렇게 매긴 이유 한 줄 (AI)',
  })
  topicMatchReason: string | null;

  /** 이 영상을 고른 이유 2~3개 */
  @Column({
    name: 'pick_reasons',
    type: 'jsonb',
    comment: '이 영상을 고른 이유 2~3개 (문자열 배열)',
  })
  pickReasons: string[];

  /** 근거 장면·인기 댓글 */
  @Column({
    type: 'jsonb',
    comment: '근거 장면·인기 댓글 [{time, quote, source}]',
  })
  scenes: EvidenceScene[];

  /** 장면 언급 검사에 쓰는 핵심 단어 */
  @Column({
    name: 'scene_keywords',
    type: 'text',
    array: true,
    default: () => "'{}'",
    comment: '장면 언급 자동 검사에 쓰는 핵심 단어 (예: {확신,텀,읽씹})',
  })
  sceneKeywords: string[];

  /** 분석한 AI 제공자 */
  @Column({
    type: 'varchar',
    length: 20,
    comment: '분석한 AI 제공자 (gemini, claude, ollama)',
  })
  provider: string;

  /** 분석한 모델 이름 */
  @Column({ type: 'varchar', length: 100, comment: '분석한 모델 이름' })
  model: string;

  /** 분석한 시각 */
  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    comment: '분석한 시각',
  })
  createdAt: Date;
}
