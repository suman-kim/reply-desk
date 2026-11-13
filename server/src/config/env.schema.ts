import { homedir } from 'node:os';
import { z } from 'zod';

/**
 * 환경 변수 검증 스키마.
 * 로컬 개발 기본값을 두어 .env 없이도 서버가 뜬다.
 * 비밀 값(API 키)은 비어 있어도 서버는 뜨고, 그 기능을 쓸 때 원인과 함께 막힌다.
 */
export const envSchema = z.object({
  /** 실행 환경 */
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  /** API 서버 포트 */
  PORT: z.coerce.number().int().positive().default(4100),

  /** PostgreSQL 호스트 */
  DB_HOST: z.string().default('127.0.0.1'),
  /** PostgreSQL 포트 */
  DB_PORT: z.coerce.number().int().positive().default(5441),
  /** PostgreSQL 사용자 */
  DB_USER: z.string().default('reply_desk'),
  /** PostgreSQL 비밀번호 */
  DB_PASSWORD: z.string().default('reply_desk'),
  /** PostgreSQL DB 이름 */
  DB_NAME: z.string().default('reply_desk'),

  /** YouTube Data API v3 키 */
  YOUTUBE_API_KEY: z.string().default(''),
  /** 크롬 프로필 폴더의 상위 폴더 (~ 사용 가능) */
  PROFILES_ROOT: z
    .string()
    .default('~/yt-agent/profiles')
    .transform((p) => (p.startsWith('~') ? homedir() + p.slice(1) : p)),

  /** 게시 실패 캡처를 둘 폴더 (~ 사용 가능) */
  SCREENSHOTS_DIR: z
    .string()
    .default('~/yt-agent/screenshots')
    .transform((p) => (p.startsWith('~') ? homedir() + p.slice(1) : p)),

  /** Gemini API 키 */
  GEMINI_API_KEY: z.string().default(''),
  /** Anthropic(Claude) API 키 */
  ANTHROPIC_API_KEY: z.string().default(''),
  /** OpenAI API 키 */
  OPENAI_API_KEY: z.string().default(''),
});

/** 검증을 통과한 환경 변수 타입 */
export type Env = z.infer<typeof envSchema>;
