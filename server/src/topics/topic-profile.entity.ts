import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import type { Profile } from '../profiles/profile.entity.js';
import type { Topic } from './topic.entity.js';

/**
 * 주제가 게시에 쓸 프로필 연결 (주제 N : 프로필 N).
 * 자동 배정은 이 목록 안에서 돌아가며 고른다.
 */
@Entity({ name: 'topic_profile', comment: '주제가 게시에 쓸 크롬 프로필 연결' })
export class TopicProfile {
  /** 주제 ID */
  @PrimaryColumn({ name: 'topic_id', type: 'int', comment: '주제 ID' })
  topicId: number;

  /** 프로필 ID */
  @PrimaryColumn({ name: 'profile_id', type: 'int', comment: '프로필 ID' })
  profileId: number;

  /** 주제 */
  @ManyToOne('Topic', 'topicProfiles', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'topic_id' })
  topic?: Topic;

  /** 프로필 */
  @ManyToOne('Profile', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'profile_id' })
  profile?: Profile;

  /** 연결한 시각 */
  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    comment: '연결한 시각',
  })
  createdAt: Date;
}
