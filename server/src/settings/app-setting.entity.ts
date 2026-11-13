import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * 공용 설정 (키-값). 어떤 키가 있는지와 값의 모양은 settings/setting-definitions.ts가 정한다.
 * 행이 없으면 정의의 기본값을 쓴다.
 */
@Entity({
  name: 'app_setting',
  comment:
    '공용 설정 (전체 하루 상한, AI 제공자 선택 등). 키와 값 모양은 코드가 정한다',
})
export class AppSetting {
  /** 설정 키 (예: posting.dailyCapTotal) */
  @PrimaryColumn({
    type: 'varchar',
    length: 80,
    comment: '설정 키 (예: posting.dailyCapTotal)',
  })
  key: string;

  /** 설정 값 */
  @Column({ type: 'jsonb', comment: '설정 값 (JSON)' })
  value: unknown;

  /** 고친 시각 */
  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
    comment: '마지막으로 고친 시각',
  })
  updatedAt: Date;
}
