import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** 프로필 로그인 상태 */
export enum ProfileLoginStatus {
  /** 아직 확인 안 함 (방금 만든 프로필) */
  Unknown = 'unknown',
  /** 로그인됨, 채널 확인 완료 */
  Ok = 'ok',
  /** 로그인이 풀림. 다시 로그인할 때까지 자동 배정과 게시에서 빠진다 */
  NeedsLogin = 'needs_login',
}

/**
 * 크롬 프로필 = 유튜브 계정 하나.
 * 등록한 프로필의 채널이 곧 게시가 허용되는 '내 채널'이다.
 * 비밀번호는 저장하지 않는다. 로그인은 사람이 크롬 창에서 직접 한다.
 */
@Entity({
  name: 'profile',
  comment: '크롬 프로필(유튜브 계정). 이 채널들이 내 채널 목록이 된다',
})
export class Profile {
  /** 프로필 ID */
  @PrimaryGeneratedColumn({ comment: '프로필 ID' })
  id: number;

  /** 화면에 보일 이름 (예: 유튜브1) */
  @Column({
    type: 'varchar',
    length: 40,
    unique: true,
    comment: '화면에 보일 이름 (예: 유튜브1)',
  })
  name: string;

  /** 폴더 이름 (영문·숫자·하이픈) */
  @Column({
    type: 'varchar',
    length: 40,
    unique: true,
    comment: '프로필 폴더 이름 (예: youtube1). 영문 소문자·숫자·하이픈',
  })
  slug: string;

  /** 크롬 프로필 폴더 절대 경로 */
  @Column({
    name: 'folder_path',
    type: 'text',
    comment: '크롬 프로필 폴더 절대 경로',
  })
  folderPath: string;

  /** 가린 구글 계정 (예: su***@gmail.com) */
  @Column({
    name: 'google_account_masked',
    type: 'varchar',
    length: 120,
    nullable: true,
    comment:
      '가린 구글 계정 (예: su***@gmail.com). 전체 주소는 저장하지 않는다',
  })
  googleAccountMasked: string | null;

  /** 유튜브 채널 ID */
  @Column({
    name: 'channel_id',
    type: 'varchar',
    length: 40,
    nullable: true,
    unique: true,
    comment: '로그인된 유튜브 채널 ID (UC로 시작). 내 채널 판정에 쓴다',
  })
  channelId: string | null;

  /** 유튜브 채널 이름 */
  @Column({
    name: 'channel_title',
    type: 'varchar',
    length: 200,
    nullable: true,
    comment: '로그인된 유튜브 채널 이름',
  })
  channelTitle: string | null;

  /** 유튜브 화면 언어 */
  @Column({
    name: 'ui_language',
    type: 'varchar',
    length: 20,
    nullable: true,
    comment:
      '마지막 확인 때의 유튜브 화면 언어 (예: ko). 한국어여야 게시 단계가 안정적이다',
  })
  uiLanguage: string | null;

  /** 로그인 상태 */
  @Column({
    name: 'login_status',
    type: 'enum',
    enum: ProfileLoginStatus,
    enumName: 'profile_login_status',
    default: ProfileLoginStatus.Unknown,
    comment:
      '로그인 상태 (unknown: 확인 전, ok: 로그인됨, needs_login: 다시 로그인 필요)',
  })
  loginStatus: ProfileLoginStatus;

  /** 마지막으로 로그인 상태를 확인한 시각 */
  @Column({
    name: 'last_checked_at',
    type: 'timestamptz',
    nullable: true,
    comment: '마지막으로 로그인·채널을 확인한 시각',
  })
  lastCheckedAt: Date | null;

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
