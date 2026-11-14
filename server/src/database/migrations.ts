import { Init1794527840491 } from './migrations/1794527840491-Init.js';
import { TopicAdDisclosure1794540000000 } from './migrations/1794540000000-TopicAdDisclosure.js';
import { TopicOptionalBrandUnlimitedWindow1794550000000 } from './migrations/1794550000000-TopicOptionalBrandUnlimitedWindow.js';
import { TopicFetchLimitUnlimited1794560000000 } from './migrations/1794560000000-TopicFetchLimitUnlimited.js';
import { PostAttemptSuccessCapture1794570000000 } from './migrations/1794570000000-PostAttemptSuccessCapture.js';
import { AnalysisTopicMatch1794580000000 } from './migrations/1794580000000-AnalysisTopicMatch.js';
import { TopicVideoRelevanceKeywords1794590000000 } from './migrations/1794590000000-TopicVideoRelevanceKeywords.js';
import { DropAdDisclosureCheck1794600000000 } from './migrations/1794600000000-DropAdDisclosureCheck.js';
import { DraftViewerWorry1794620000000 } from './migrations/1794620000000-DraftViewerWorry.js';
import { DraftStyle1794630000000 } from './migrations/1794630000000-DraftStyle.js';

/**
 * 적용할 마이그레이션 목록 (오래된 것부터).
 * `npm run migration:generate -- src/database/migrations/<이름>`으로 만든 뒤 여기에 추가한다.
 * 파일 경로(glob) 대신 클래스를 직접 넣어 빌드(dist)와 테스트(vitest)가 같은 목록을 쓴다.
 */
export const MIGRATIONS = [
  Init1794527840491,
  TopicAdDisclosure1794540000000,
  TopicOptionalBrandUnlimitedWindow1794550000000,
  TopicFetchLimitUnlimited1794560000000,
  PostAttemptSuccessCapture1794570000000,
  AnalysisTopicMatch1794580000000,
  TopicVideoRelevanceKeywords1794590000000,
  DropAdDisclosureCheck1794600000000,
  DraftViewerWorry1794620000000,
  DraftStyle1794630000000,
];
