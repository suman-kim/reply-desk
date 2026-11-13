import { Init1794527840491 } from './migrations/1794527840491-Init.js';
import { TopicAdDisclosure1794540000000 } from './migrations/1794540000000-TopicAdDisclosure.js';

/**
 * 적용할 마이그레이션 목록 (오래된 것부터).
 * `npm run migration:generate -- src/database/migrations/<이름>`으로 만든 뒤 여기에 추가한다.
 * 파일 경로(glob) 대신 클래스를 직접 넣어 빌드(dist)와 테스트(vitest)가 같은 목록을 쓴다.
 */
export const MIGRATIONS = [Init1794527840491, TopicAdDisclosure1794540000000];
