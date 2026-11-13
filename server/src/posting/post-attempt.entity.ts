import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Draft } from '../drafts/draft.entity.js';
import type { Profile } from '../profiles/profile.entity.js';
import type { Topic } from '../topics/topic.entity.js';
import type { Video } from '../videos/video.entity.js';

/** 게시 시도 결과 */
export enum PostStatus {
  /** 게시 진행 중 */
  Running = 'running',
  /** 게시 완료 (내 댓글 확인까지 끝남) */
  Success = 'success',
  /** 실패 */
  Failed = 'failed',
}

/** 게시 진행 5단계 */
export enum PostStep {
  /** 프로필 여는 중 */
  OpenProfile = 'open_profile',
  /** 댓글 창 찾는 중 */
  FindCommentBox = 'find_comment_box',
  /** 한 글자씩 입력 중 */
  Type = 'type',
  /** 게시 */
  Submit = 'submit',
  /** 내 댓글 확인 */
  Verify = 'verify',
}

/**
 * 게시 시도 기록 = 게시 기록 표의 한 행.
 * 운영 규칙은 이 표로 DB가 직접 막는다.
 * - 영상당 댓글 1개: status='success'인 행은 영상마다 하나만 (부분 유일 인덱스)
 * - 같은 영상에 동시에 두 번 게시: status='running'인 행도 영상마다 하나만
 * - 하루 상한: 한국 시간 날짜로 status='success' 행 수를 센다
 */
@Entity({
  name: 'post_attempt',
  comment: '게시 시도 기록(게시 기록 표). 영상당 1개·하루 상한을 이 표로 판단',
})
@Index('uq_post_attempt_video_success', ['videoId'], {
  unique: true,
  where: `"status" = 'success'`,
})
@Index('uq_post_attempt_video_running', ['videoId'], {
  unique: true,
  where: `"status" = 'running'`,
})
@Index('ix_post_attempt_started', ['startedAt'])
export class PostAttempt {
  /** 게시 시도 ID */
  @PrimaryGeneratedColumn({ comment: '게시 시도 ID' })
  id: number;

  /** 게시한 초안 ID */
  @Column({
    name: 'draft_id',
    type: 'int',
    nullable: true,
    comment: '게시한 초안 ID. 초안이 지워져도 기록은 남는다',
  })
  draftId: number | null;

  /** 주제 ID */
  @Column({
    name: 'topic_id',
    type: 'int',
    nullable: true,
    comment: '주제 ID. 주제가 지워져도 기록은 남는다',
  })
  topicId: number | null;

  /** 영상 ID */
  @Column({ name: 'video_id', type: 'int', comment: '영상 ID (video.id)' })
  videoId: number;

  /** 게시한 프로필 ID */
  @Column({
    name: 'profile_id',
    type: 'int',
    nullable: true,
    comment: '게시한 프로필 ID. 프로필이 지워져도 기록은 남는다',
  })
  profileId: number | null;

  /** 초안 */
  @ManyToOne('Draft', { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'draft_id' })
  draft?: Draft | null;

  /** 주제 */
  @ManyToOne('Topic', { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'topic_id' })
  topic?: Topic | null;

  /** 영상 (게시 기록이 있는 영상은 지우지 않는다) */
  @ManyToOne('Video', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'video_id' })
  video?: Video;

  /** 프로필 */
  @ManyToOne('Profile', { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'profile_id' })
  profile?: Profile | null;

  /** 게시한 댓글 글 (그 순간의 사본) */
  @Column({
    name: 'comment_text',
    type: 'text',
    comment: '게시한 댓글 글. 초안이 바뀌어도 남도록 사본을 둔다',
  })
  commentText: string;

  /** 결과 */
  @Column({
    type: 'enum',
    enum: PostStatus,
    enumName: 'post_status',
    default: PostStatus.Running,
    comment: '결과 (running: 진행 중, success: 게시 완료, failed: 실패)',
  })
  status: PostStatus;

  /** 실패한 단계 */
  @Column({
    name: 'failed_step',
    type: 'enum',
    enum: PostStep,
    enumName: 'post_step',
    nullable: true,
    comment:
      '실패한 단계 (open_profile, find_comment_box, type, submit, verify)',
  })
  failedStep: PostStep | null;

  /** 실패 원인 한 줄 */
  @Column({
    name: 'failure_reason',
    type: 'text',
    nullable: true,
    comment: '실패 원인 한 줄 (예: 로그인이 풀림)',
  })
  failureReason: string | null;

  /** 실패 순간 화면 캡처 경로 */
  @Column({
    name: 'screenshot_path',
    type: 'text',
    nullable: true,
    comment: '실패 순간 화면 캡처 파일 경로',
  })
  screenshotPath: string | null;

  /** 게시된 댓글 주소 */
  @Column({
    name: 'comment_url',
    type: 'text',
    nullable: true,
    comment: '게시된 댓글 주소 ([댓글 보기])',
  })
  commentUrl: string | null;

  /** 시작 시각 */
  @Column({
    name: 'started_at',
    type: 'timestamptz',
    default: () => 'now()',
    comment: '게시를 시작한 시각',
  })
  startedAt: Date;

  /** 끝난 시각 */
  @Column({
    name: 'finished_at',
    type: 'timestamptz',
    nullable: true,
    comment: '게시가 끝난 시각 (성공·실패)',
  })
  finishedAt: Date | null;
}
