import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { bigintToNumber } from '../common/bigint.transformer.js';

/**
 * 유튜브 영상. 여러 주제가 같은 영상을 함께 쓸 수 있어 주제와 따로 둔다.
 * 숫자(조회수·시각·길이)는 모두 YouTube API에서 코드가 넣은 값이다. AI가 쓰지 않는다.
 */
@Entity({
  name: 'video',
  comment: '유튜브 영상. 숫자 값은 YouTube API에서 코드가 넣는다',
})
export class Video {
  /** 내부 영상 ID */
  @PrimaryGeneratedColumn({ comment: '내부 영상 ID' })
  id: number;

  /** 유튜브 영상 ID (11자) */
  @Column({
    name: 'youtube_id',
    type: 'varchar',
    length: 20,
    unique: true,
    comment: '유튜브 영상 ID (watch?v= 뒤의 11자)',
  })
  youtubeId: string;

  /** 영상 제목 */
  @Column({ type: 'text', comment: '영상 제목' })
  title: string;

  /** 올린 채널 ID */
  @Column({
    name: 'channel_id',
    type: 'varchar',
    length: 40,
    comment: '영상을 올린 채널 ID. 내 채널 판정에 쓴다',
  })
  channelId: string;

  /** 올린 채널 이름 */
  @Column({
    name: 'channel_title',
    type: 'varchar',
    length: 200,
    comment: '영상을 올린 채널 이름',
  })
  channelTitle: string;

  /** 올린 시각 */
  @Column({
    name: 'published_at',
    type: 'timestamptz',
    comment: '영상을 올린 시각',
  })
  publishedAt: Date;

  /** 조회수 */
  @Column({
    name: 'view_count',
    type: 'bigint',
    default: 0,
    transformer: bigintToNumber,
    comment: '조회수 (stats_updated_at 시점 값)',
  })
  viewCount: number;

  /** 영상 길이(초) */
  @Column({
    name: 'duration_sec',
    type: 'int',
    default: 0,
    comment: '영상 길이 (초)',
  })
  durationSec: number;

  /** 썸네일 주소 */
  @Column({
    name: 'thumbnail_url',
    type: 'text',
    nullable: true,
    comment: '썸네일 이미지 주소',
  })
  thumbnailUrl: string | null;

  /** 통계를 마지막으로 받은 시각 */
  @Column({
    name: 'stats_updated_at',
    type: 'timestamptz',
    comment: '조회수 등 통계를 마지막으로 받은 시각',
  })
  statsUpdatedAt: Date;

  /** 처음 저장한 시각 */
  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    comment: '처음 저장한 시각',
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
