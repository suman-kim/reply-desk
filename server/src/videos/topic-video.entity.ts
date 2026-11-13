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
import type { Topic } from '../topics/topic.entity.js';
import type { Video } from './video.entity.js';

/** 영상이 주제에 들어온 경로 */
export enum TopicVideoSource {
  /** [영상 불러오기] 검색 결과 */
  Search = 'search',
  /** 링크 직접 입력 */
  Manual = 'manual',
}

/**
 * 주제별 영상 목록 (① 칸). 불러오기를 다시 하면 순위가 새로 매겨진다.
 */
@Entity({
  name: 'topic_video',
  comment: '주제별 영상 목록(① 칸). 불러오기 순위와 들어온 경로',
})
@Index('uq_topic_video_topic_video', ['topicId', 'videoId'], { unique: true })
export class TopicVideo {
  /** ID */
  @PrimaryGeneratedColumn({ comment: '주제별 영상 ID' })
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

  /** 들어온 경로 */
  @Column({
    type: 'enum',
    enum: TopicVideoSource,
    enumName: 'topic_video_source',
    comment: '들어온 경로 (search: 불러오기, manual: 링크 직접 입력)',
  })
  source: TopicVideoSource;

  /** 마지막 불러오기에서의 순위 */
  @Column({
    type: 'int',
    nullable: true,
    comment:
      '마지막 불러오기에서의 순위 (1부터). 이번 결과에 없거나 직접 추가한 영상은 NULL',
  })
  rank: number | null;

  /** 마지막으로 목록에 들어온 시각 */
  @Column({
    name: 'fetched_at',
    type: 'timestamptz',
    comment: '마지막으로 목록에 들어온 시각',
  })
  fetchedAt: Date;

  /** 처음 들어온 시각 */
  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    comment: '처음 들어온 시각',
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
