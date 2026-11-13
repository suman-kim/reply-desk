import { z } from 'zod';

/** 경로의 숫자 ID 검증. 잘못된 형식이면 500이 아니라 400으로 답한다 */
export const idParam = z.coerce
  .number({ message: 'ID는 숫자여야 해요' })
  .int('ID는 정수여야 해요')
  .positive('ID는 1 이상이어야 해요');
