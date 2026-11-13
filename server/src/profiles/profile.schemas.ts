import { z } from 'zod';

/** 프로필 폴더 이름 규칙: 영문 소문자로 시작, 소문자·숫자·하이픈 */
export const SLUG_PATTERN = /^[a-z][a-z0-9-]{1,39}$/;

/** 프로필 만들기 요청 */
export const createProfileSchema = z.object({
  /** 화면에 보일 이름 (예: 유튜브4) */
  name: z
    .string()
    .trim()
    .min(1, '이름을 적어 주세요')
    .max(40, '이름은 40자까지예요'),
  /** 폴더 이름 (예: youtube4). 비우면 이름에서 만든다 */
  slug: z
    .string()
    .trim()
    .regex(
      SLUG_PATTERN,
      '폴더 이름은 영문 소문자로 시작하고 소문자·숫자·하이픈만 써요 (예: youtube4)',
    )
    .optional(),
});
export type CreateProfileDto = z.infer<typeof createProfileSchema>;

/** 프로필 고치기 요청 (이름만 바꿀 수 있다. 폴더를 바꾸면 로그인이 풀린다) */
export const updateProfileSchema = z.object({
  /** 새 이름 */
  name: z
    .string()
    .trim()
    .min(1, '이름을 적어 주세요')
    .max(40, '이름은 40자까지예요'),
});
export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;

/**
 * 이름에서 폴더 이름을 만든다. "유튜브4"처럼 한글이면 youtube + 숫자로 바꾸고,
 * 영문이 없으면 profile-<번호>를 쓴다.
 * @param name 프로필 이름
 * @param fallbackNumber 영문을 만들 수 없을 때 붙일 번호
 */
export function slugFromName(name: string, fallbackNumber: number): string {
  const replaced = name.replace(/유튜브/g, 'youtube').toLowerCase();
  const slug = replaced
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/^[0-9-]+/, '');
  return SLUG_PATTERN.test(slug) ? slug : `profile-${fallbackNumber}`;
}
