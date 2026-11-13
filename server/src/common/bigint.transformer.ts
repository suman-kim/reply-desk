import type { ValueTransformer } from 'typeorm';

/**
 * PostgreSQL bigint(문자열로 읽힘) ↔ JS number 변환.
 * 조회수처럼 2^53을 넘지 않는 값에만 쓴다.
 */
export const bigintToNumber: ValueTransformer = {
  /** 저장할 때: number 그대로 넘긴다 */
  to: (value: number | null | undefined) => value,
  /** 읽을 때: 문자열을 number로 바꾼다 */
  from: (value: string | null) => (value === null ? null : Number(value)),
};
