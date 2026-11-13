import { Draft } from '../drafts/draft.entity.js';
import { VideoAnalysis } from '../drafts/video-analysis.entity.js';
import { PostAttempt } from '../posting/post-attempt.entity.js';
import { Profile } from '../profiles/profile.entity.js';
import { AppSetting } from '../settings/app-setting.entity.js';
import { TopicProfile } from '../topics/topic-profile.entity.js';
import { Topic } from '../topics/topic.entity.js';
import { TopicVideo } from '../videos/topic-video.entity.js';
import { Video } from '../videos/video.entity.js';

/**
 * 모든 엔티티 목록. 앱과 마이그레이션 CLI가 같은 목록을 쓴다.
 * 새 엔티티를 만들면 여기에 추가한다.
 */
export const ENTITIES = [
  Topic,
  TopicProfile,
  Profile,
  Video,
  TopicVideo,
  VideoAnalysis,
  Draft,
  PostAttempt,
  AppSetting,
];
