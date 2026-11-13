import { z } from 'zod';

/**
 * zod 기본 오류 문구를 한국어로 바꾼다.
 * 스키마에 직접 적은 문구가 먼저 쓰이고, 적지 않은 검사만 이 문구가 나온다.
 * main.ts에서 가장 먼저 import한다.
 */
z.config(z.locales.ko());
