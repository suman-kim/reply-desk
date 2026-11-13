import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1794527840491 implements MigrationInterface {
  name = 'Init1794527840491';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."draft_state" AS ENUM('writing', 'ready', 'error')`,
    );
    await queryRunner.query(
      `CREATE TABLE "draft" ("id" SERIAL NOT NULL, "topic_id" integer NOT NULL, "video_id" integer NOT NULL, "analysis_id" integer, "state" "public"."draft_state" NOT NULL DEFAULT 'writing', "text" text NOT NULL DEFAULT '', "ai_text" text NOT NULL DEFAULT '', "reasons" jsonb NOT NULL DEFAULT '[]', "edited" boolean NOT NULL DEFAULT false, "check_results" jsonb NOT NULL DEFAULT '[]', "check_passed" boolean NOT NULL DEFAULT false, "provider" character varying(20), "model" character varying(100), "error_message" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_0b2b03d3f2c998450423648bc65" PRIMARY KEY ("id")); COMMENT ON COLUMN "draft"."id" IS '초안 ID'; COMMENT ON COLUMN "draft"."topic_id" IS '주제 ID'; COMMENT ON COLUMN "draft"."video_id" IS '영상 ID (video.id)'; COMMENT ON COLUMN "draft"."analysis_id" IS '초안이 근거로 쓴 분석 ID'; COMMENT ON COLUMN "draft"."state" IS '작성 상태 (writing: 쓰는 중, ready: 다 씀, error: 작성 실패)'; COMMENT ON COLUMN "draft"."text" IS '지금 초안 글. 사람이 고치면 이 값이 바뀐다'; COMMENT ON COLUMN "draft"."ai_text" IS 'AI가 처음 쓴 글 (고치기 전 원본)'; COMMENT ON COLUMN "draft"."reasons" IS '이 댓글을 이렇게 쓴 이유 2~3개 (문자열 배열)'; COMMENT ON COLUMN "draft"."edited" IS '사람이 직접 고쳤는지. 참이면 이유 상자에 "AI 초안 기준"을 붙인다'; COMMENT ON COLUMN "draft"."check_results" IS '자동 검사 결과 [{code, label, passed, detail}]'; COMMENT ON COLUMN "draft"."check_passed" IS '자동 검사를 모두 통과했는지'; COMMENT ON COLUMN "draft"."provider" IS '초안을 쓴 AI 제공자 (gemini, claude, ollama)'; COMMENT ON COLUMN "draft"."model" IS '초안을 쓴 모델 이름'; COMMENT ON COLUMN "draft"."error_message" IS '작성 실패 원인 한 줄 (state=error일 때)'; COMMENT ON COLUMN "draft"."created_at" IS '만든 시각'; COMMENT ON COLUMN "draft"."updated_at" IS '마지막으로 고친 시각'`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_draft_topic_video" ON "draft"  ("topic_id", "video_id", "created_at") `,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "draft" IS '댓글 초안. 다시 생성하면 새 행이 쌓인다'`,
    );
    await queryRunner.query(
      `CREATE TABLE "video_analysis" ("id" SERIAL NOT NULL, "topic_id" integer NOT NULL, "video_id" integer NOT NULL, "worry" text NOT NULL, "pick_reasons" jsonb NOT NULL, "scenes" jsonb NOT NULL, "scene_keywords" text array NOT NULL DEFAULT '{}', "provider" character varying(20) NOT NULL, "model" character varying(100) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_dd0f97ac4f6efc689f1ce06daf1" PRIMARY KEY ("id")); COMMENT ON COLUMN "video_analysis"."id" IS '분석 ID'; COMMENT ON COLUMN "video_analysis"."topic_id" IS '주제 ID'; COMMENT ON COLUMN "video_analysis"."video_id" IS '영상 ID (video.id)'; COMMENT ON COLUMN "video_analysis"."worry" IS '영상 속 고민 한 줄 (금색 상자)'; COMMENT ON COLUMN "video_analysis"."pick_reasons" IS '이 영상을 고른 이유 2~3개 (문자열 배열)'; COMMENT ON COLUMN "video_analysis"."scenes" IS '근거 장면·인기 댓글 [{time, quote, source}]'; COMMENT ON COLUMN "video_analysis"."scene_keywords" IS '장면 언급 자동 검사에 쓰는 핵심 단어 (예: {확신,텀,읽씹})'; COMMENT ON COLUMN "video_analysis"."provider" IS '분석한 AI 제공자 (gemini, claude, ollama)'; COMMENT ON COLUMN "video_analysis"."model" IS '분석한 모델 이름'; COMMENT ON COLUMN "video_analysis"."created_at" IS '분석한 시각'`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_video_analysis_topic_video" ON "video_analysis"  ("topic_id", "video_id", "created_at") `,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "video_analysis" IS 'AI 영상 분석 결과: 고민 한 줄, 고른 이유, 근거 장면'`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."post_status" AS ENUM('running', 'success', 'failed')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."post_step" AS ENUM('open_profile', 'find_comment_box', 'type', 'submit', 'verify')`,
    );
    await queryRunner.query(
      `CREATE TABLE "post_attempt" ("id" SERIAL NOT NULL, "draft_id" integer, "topic_id" integer, "video_id" integer NOT NULL, "profile_id" integer, "comment_text" text NOT NULL, "status" "public"."post_status" NOT NULL DEFAULT 'running', "failed_step" "public"."post_step", "failure_reason" text, "screenshot_path" text, "comment_url" text, "started_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "finished_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_e5e13d03f662293cb4ff3e02ef8" PRIMARY KEY ("id")); COMMENT ON COLUMN "post_attempt"."id" IS '게시 시도 ID'; COMMENT ON COLUMN "post_attempt"."draft_id" IS '게시한 초안 ID. 초안이 지워져도 기록은 남는다'; COMMENT ON COLUMN "post_attempt"."topic_id" IS '주제 ID. 주제가 지워져도 기록은 남는다'; COMMENT ON COLUMN "post_attempt"."video_id" IS '영상 ID (video.id)'; COMMENT ON COLUMN "post_attempt"."profile_id" IS '게시한 프로필 ID. 프로필이 지워져도 기록은 남는다'; COMMENT ON COLUMN "post_attempt"."comment_text" IS '게시한 댓글 글. 초안이 바뀌어도 남도록 사본을 둔다'; COMMENT ON COLUMN "post_attempt"."status" IS '결과 (running: 진행 중, success: 게시 완료, failed: 실패)'; COMMENT ON COLUMN "post_attempt"."failed_step" IS '실패한 단계 (open_profile, find_comment_box, type, submit, verify)'; COMMENT ON COLUMN "post_attempt"."failure_reason" IS '실패 원인 한 줄 (예: 로그인이 풀림)'; COMMENT ON COLUMN "post_attempt"."screenshot_path" IS '실패 순간 화면 캡처 파일 경로'; COMMENT ON COLUMN "post_attempt"."comment_url" IS '게시된 댓글 주소 ([댓글 보기])'; COMMENT ON COLUMN "post_attempt"."started_at" IS '게시를 시작한 시각'; COMMENT ON COLUMN "post_attempt"."finished_at" IS '게시가 끝난 시각 (성공·실패)'`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_post_attempt_started" ON "post_attempt"  ("started_at") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_post_attempt_video_running" ON "post_attempt"  ("video_id") WHERE "status" = 'running'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_post_attempt_video_success" ON "post_attempt"  ("video_id") WHERE "status" = 'success'`,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "post_attempt" IS '게시 시도 기록(게시 기록 표). 영상당 1개·하루 상한을 이 표로 판단'`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."profile_login_status" AS ENUM('unknown', 'ok', 'needs_login')`,
    );
    await queryRunner.query(
      `CREATE TABLE "profile" ("id" SERIAL NOT NULL, "name" character varying(40) NOT NULL, "slug" character varying(40) NOT NULL, "folder_path" text NOT NULL, "google_account_masked" character varying(120), "channel_id" character varying(40), "channel_title" character varying(200), "ui_language" character varying(20), "login_status" "public"."profile_login_status" NOT NULL DEFAULT 'unknown', "last_checked_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_0046bf0859cceb5f1744df2a360" UNIQUE ("name"), CONSTRAINT "UQ_320e259757524e1b21cd08d0f1f" UNIQUE ("slug"), CONSTRAINT "UQ_21af1f1a1693dc353c2b2467b95" UNIQUE ("channel_id"), CONSTRAINT "PK_3dd8bfc97e4a77c70971591bdcb" PRIMARY KEY ("id")); COMMENT ON COLUMN "profile"."id" IS '프로필 ID'; COMMENT ON COLUMN "profile"."name" IS '화면에 보일 이름 (예: 유튜브1)'; COMMENT ON COLUMN "profile"."slug" IS '프로필 폴더 이름 (예: youtube1). 영문 소문자·숫자·하이픈'; COMMENT ON COLUMN "profile"."folder_path" IS '크롬 프로필 폴더 절대 경로'; COMMENT ON COLUMN "profile"."google_account_masked" IS '가린 구글 계정 (예: su***@gmail.com). 전체 주소는 저장하지 않는다'; COMMENT ON COLUMN "profile"."channel_id" IS '로그인된 유튜브 채널 ID (UC로 시작). 내 채널 판정에 쓴다'; COMMENT ON COLUMN "profile"."channel_title" IS '로그인된 유튜브 채널 이름'; COMMENT ON COLUMN "profile"."ui_language" IS '마지막 확인 때의 유튜브 화면 언어 (예: ko). 한국어여야 게시 단계가 안정적이다'; COMMENT ON COLUMN "profile"."login_status" IS '로그인 상태 (unknown: 확인 전, ok: 로그인됨, needs_login: 다시 로그인 필요)'; COMMENT ON COLUMN "profile"."last_checked_at" IS '마지막으로 로그인·채널을 확인한 시각'; COMMENT ON COLUMN "profile"."created_at" IS '만든 시각'; COMMENT ON COLUMN "profile"."updated_at" IS '마지막으로 고친 시각'`,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "profile" IS '크롬 프로필(유튜브 계정). 이 채널들이 내 채널 목록이 된다'`,
    );
    await queryRunner.query(
      `CREATE TABLE "app_setting" ("key" character varying(80) NOT NULL, "value" jsonb NOT NULL, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_0d66bfb0d9f93124a4549d21af0" PRIMARY KEY ("key")); COMMENT ON COLUMN "app_setting"."key" IS '설정 키 (예: posting.dailyCapTotal)'; COMMENT ON COLUMN "app_setting"."value" IS '설정 값 (JSON)'; COMMENT ON COLUMN "app_setting"."updated_at" IS '마지막으로 고친 시각'`,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "app_setting" IS '공용 설정 (전체 하루 상한, AI 제공자 선택 등). 키와 값 모양은 코드가 정한다'`,
    );
    await queryRunner.query(
      `CREATE TABLE "topic_profile" ("topic_id" integer NOT NULL, "profile_id" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_346024eaf12e65aa951f5371f7c" PRIMARY KEY ("topic_id", "profile_id")); COMMENT ON COLUMN "topic_profile"."topic_id" IS '주제 ID'; COMMENT ON COLUMN "topic_profile"."profile_id" IS '프로필 ID'; COMMENT ON COLUMN "topic_profile"."created_at" IS '연결한 시각'`,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "topic_profile" IS '주제가 게시에 쓸 크롬 프로필 연결'`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."video_sort_by" AS ENUM('view_count', 'date')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."topic_status" AS ENUM('active', 'paused')`,
    );
    await queryRunner.query(
      `CREATE TABLE "topic" ("id" SERIAL NOT NULL, "name" character varying(60) NOT NULL, "brand_target" character varying(200) NOT NULL, "brand_word" character varying(40) NOT NULL, "keywords" text array NOT NULL, "video_window_days" integer NOT NULL DEFAULT '7', "video_sort_by" "public"."video_sort_by" NOT NULL DEFAULT 'view_count', "fetch_limit" integer NOT NULL DEFAULT '5', "tone" text NOT NULL DEFAULT '', "min_length" integer NOT NULL DEFAULT '40', "max_length" integer NOT NULL DEFAULT '120', "banned_words" text array NOT NULL DEFAULT '{}', "daily_cap" integer NOT NULL DEFAULT '5', "status" "public"."topic_status" NOT NULL DEFAULT 'active', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_33aa4ecb4e4f20aa0157ea7ef61" PRIMARY KEY ("id")); COMMENT ON COLUMN "topic"."id" IS '주제 ID'; COMMENT ON COLUMN "topic"."name" IS '주제 이름 (예: 운명원 연애 사주)'; COMMENT ON COLUMN "topic"."brand_target" IS '유도 대상 한 줄 설명 (예: 운명원 · 연애 사주 잘 보는 곳). 댓글 작성에 쓴다'; COMMENT ON COLUMN "topic"."brand_word" IS '브랜드 언급 자동 검사에 쓰는 단어 (예: 운명원)'; COMMENT ON COLUMN "topic"."keywords" IS '영상 검색 키워드 목록 (예: {연애,썸,재회})'; COMMENT ON COLUMN "topic"."video_window_days" IS '최근 며칠 안에 올라온 영상만 불러올지 (일)'; COMMENT ON COLUMN "topic"."video_sort_by" IS '영상 정렬 기준 (view_count: 조회수 높은 순, date: 최신순)'; COMMENT ON COLUMN "topic"."fetch_limit" IS '[영상 불러오기] 한 번에 가져와 초안까지 쓸 영상 수'; COMMENT ON COLUMN "topic"."tone" IS '댓글 말투 설명 (예: 20~30대 시청자, 공감형 구어체)'; COMMENT ON COLUMN "topic"."min_length" IS '댓글 최소 글자 수 (자동 검사)'; COMMENT ON COLUMN "topic"."max_length" IS '댓글 최대 글자 수 (자동 검사)'; COMMENT ON COLUMN "topic"."banned_words" IS '주제별 추가 금지 표현. 공통 금지(링크·해시태그·지어낸 후기)와 함께 검사한다'; COMMENT ON COLUMN "topic"."daily_cap" IS '이 주제의 하루 게시 상한. 전체 하루 상한 안에서 나눠 쓴다'; COMMENT ON COLUMN "topic"."status" IS '주제 상태 (active: 진행 중, paused: 일시정지)'; COMMENT ON COLUMN "topic"."created_at" IS '만든 시각'; COMMENT ON COLUMN "topic"."updated_at" IS '마지막으로 고친 시각'`,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "topic" IS '주제(홍보 대상). 불러오기·초안·게시가 이 단위로 돈다'`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."topic_video_source" AS ENUM('search', 'manual')`,
    );
    await queryRunner.query(
      `CREATE TABLE "topic_video" ("id" SERIAL NOT NULL, "topic_id" integer NOT NULL, "video_id" integer NOT NULL, "source" "public"."topic_video_source" NOT NULL, "rank" integer, "fetched_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ec71a2532f67b620f1354906843" PRIMARY KEY ("id")); COMMENT ON COLUMN "topic_video"."id" IS '주제별 영상 ID'; COMMENT ON COLUMN "topic_video"."topic_id" IS '주제 ID'; COMMENT ON COLUMN "topic_video"."video_id" IS '영상 ID (video.id)'; COMMENT ON COLUMN "topic_video"."source" IS '들어온 경로 (search: 불러오기, manual: 링크 직접 입력)'; COMMENT ON COLUMN "topic_video"."rank" IS '마지막 불러오기에서의 순위 (1부터). 이번 결과에 없거나 직접 추가한 영상은 NULL'; COMMENT ON COLUMN "topic_video"."fetched_at" IS '마지막으로 목록에 들어온 시각'; COMMENT ON COLUMN "topic_video"."created_at" IS '처음 들어온 시각'; COMMENT ON COLUMN "topic_video"."updated_at" IS '마지막으로 고친 시각'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_topic_video_topic_video" ON "topic_video"  ("topic_id", "video_id") `,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "topic_video" IS '주제별 영상 목록(① 칸). 불러오기 순위와 들어온 경로'`,
    );
    await queryRunner.query(
      `CREATE TABLE "video" ("id" SERIAL NOT NULL, "youtube_id" character varying(20) NOT NULL, "title" text NOT NULL, "channel_id" character varying(40) NOT NULL, "channel_title" character varying(200) NOT NULL, "published_at" TIMESTAMP WITH TIME ZONE NOT NULL, "view_count" bigint NOT NULL DEFAULT '0', "duration_sec" integer NOT NULL DEFAULT '0', "thumbnail_url" text, "stats_updated_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_496c467e9c79cff4b9490b34271" UNIQUE ("youtube_id"), CONSTRAINT "PK_1a2f3856250765d72e7e1636c8e" PRIMARY KEY ("id")); COMMENT ON COLUMN "video"."id" IS '내부 영상 ID'; COMMENT ON COLUMN "video"."youtube_id" IS '유튜브 영상 ID (watch?v= 뒤의 11자)'; COMMENT ON COLUMN "video"."title" IS '영상 제목'; COMMENT ON COLUMN "video"."channel_id" IS '영상을 올린 채널 ID. 내 채널 판정에 쓴다'; COMMENT ON COLUMN "video"."channel_title" IS '영상을 올린 채널 이름'; COMMENT ON COLUMN "video"."published_at" IS '영상을 올린 시각'; COMMENT ON COLUMN "video"."view_count" IS '조회수 (stats_updated_at 시점 값)'; COMMENT ON COLUMN "video"."duration_sec" IS '영상 길이 (초)'; COMMENT ON COLUMN "video"."thumbnail_url" IS '썸네일 이미지 주소'; COMMENT ON COLUMN "video"."stats_updated_at" IS '조회수 등 통계를 마지막으로 받은 시각'; COMMENT ON COLUMN "video"."created_at" IS '처음 저장한 시각'; COMMENT ON COLUMN "video"."updated_at" IS '마지막으로 고친 시각'`,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "video" IS '유튜브 영상. 숫자 값은 YouTube API에서 코드가 넣는다'`,
    );
    await queryRunner.query(
      `ALTER TABLE "draft" ADD CONSTRAINT "FK_d6a7fa69c5741b15d8cdf8e5291" FOREIGN KEY ("topic_id") REFERENCES "topic"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "draft" ADD CONSTRAINT "FK_ad3c51833bd7b6e3ec2fd420584" FOREIGN KEY ("video_id") REFERENCES "video"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "draft" ADD CONSTRAINT "FK_a764efafd4fe6b03df721e034dd" FOREIGN KEY ("analysis_id") REFERENCES "video_analysis"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "video_analysis" ADD CONSTRAINT "FK_ca2602cb6d2d97ffb104a20ab3f" FOREIGN KEY ("topic_id") REFERENCES "topic"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "video_analysis" ADD CONSTRAINT "FK_7bde25cfb48afe0d2fba4482873" FOREIGN KEY ("video_id") REFERENCES "video"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "post_attempt" ADD CONSTRAINT "FK_571505f945a292614ee4937b90c" FOREIGN KEY ("draft_id") REFERENCES "draft"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "post_attempt" ADD CONSTRAINT "FK_fa0ec72523f91ebd6a486b36cc2" FOREIGN KEY ("topic_id") REFERENCES "topic"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "post_attempt" ADD CONSTRAINT "FK_65393342404c747be8331c06591" FOREIGN KEY ("video_id") REFERENCES "video"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "post_attempt" ADD CONSTRAINT "FK_9684d6b11c79e20de259b90ba9b" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "topic_profile" ADD CONSTRAINT "FK_bd14c5e45c12a484bc505ee3d59" FOREIGN KEY ("topic_id") REFERENCES "topic"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "topic_profile" ADD CONSTRAINT "FK_811fcc86762d496e6dfd8f10b90" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "topic_video" ADD CONSTRAINT "FK_545f3f577dad8d42c7334f7a379" FOREIGN KEY ("topic_id") REFERENCES "topic"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "topic_video" ADD CONSTRAINT "FK_ad01608bb1a41a10554a7710325" FOREIGN KEY ("video_id") REFERENCES "video"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "topic_video" DROP CONSTRAINT "FK_ad01608bb1a41a10554a7710325"`,
    );
    await queryRunner.query(
      `ALTER TABLE "topic_video" DROP CONSTRAINT "FK_545f3f577dad8d42c7334f7a379"`,
    );
    await queryRunner.query(
      `ALTER TABLE "topic_profile" DROP CONSTRAINT "FK_811fcc86762d496e6dfd8f10b90"`,
    );
    await queryRunner.query(
      `ALTER TABLE "topic_profile" DROP CONSTRAINT "FK_bd14c5e45c12a484bc505ee3d59"`,
    );
    await queryRunner.query(
      `ALTER TABLE "post_attempt" DROP CONSTRAINT "FK_9684d6b11c79e20de259b90ba9b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "post_attempt" DROP CONSTRAINT "FK_65393342404c747be8331c06591"`,
    );
    await queryRunner.query(
      `ALTER TABLE "post_attempt" DROP CONSTRAINT "FK_fa0ec72523f91ebd6a486b36cc2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "post_attempt" DROP CONSTRAINT "FK_571505f945a292614ee4937b90c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "video_analysis" DROP CONSTRAINT "FK_7bde25cfb48afe0d2fba4482873"`,
    );
    await queryRunner.query(
      `ALTER TABLE "video_analysis" DROP CONSTRAINT "FK_ca2602cb6d2d97ffb104a20ab3f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "draft" DROP CONSTRAINT "FK_a764efafd4fe6b03df721e034dd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "draft" DROP CONSTRAINT "FK_ad3c51833bd7b6e3ec2fd420584"`,
    );
    await queryRunner.query(
      `ALTER TABLE "draft" DROP CONSTRAINT "FK_d6a7fa69c5741b15d8cdf8e5291"`,
    );
    await queryRunner.query(`COMMENT ON TABLE "video" IS NULL`);
    await queryRunner.query(`DROP TABLE "video"`);
    await queryRunner.query(`COMMENT ON TABLE "topic_video" IS NULL`);
    await queryRunner.query(`DROP INDEX "public"."uq_topic_video_topic_video"`);
    await queryRunner.query(`DROP TABLE "topic_video"`);
    await queryRunner.query(`DROP TYPE "public"."topic_video_source"`);
    await queryRunner.query(`COMMENT ON TABLE "topic" IS NULL`);
    await queryRunner.query(`DROP TABLE "topic"`);
    await queryRunner.query(`DROP TYPE "public"."topic_status"`);
    await queryRunner.query(`DROP TYPE "public"."video_sort_by"`);
    await queryRunner.query(`COMMENT ON TABLE "topic_profile" IS NULL`);
    await queryRunner.query(`DROP TABLE "topic_profile"`);
    await queryRunner.query(`COMMENT ON TABLE "app_setting" IS NULL`);
    await queryRunner.query(`DROP TABLE "app_setting"`);
    await queryRunner.query(`COMMENT ON TABLE "profile" IS NULL`);
    await queryRunner.query(`DROP TABLE "profile"`);
    await queryRunner.query(`DROP TYPE "public"."profile_login_status"`);
    await queryRunner.query(`COMMENT ON TABLE "post_attempt" IS NULL`);
    await queryRunner.query(
      `DROP INDEX "public"."uq_post_attempt_video_success"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_post_attempt_video_running"`,
    );
    await queryRunner.query(`DROP INDEX "public"."ix_post_attempt_started"`);
    await queryRunner.query(`DROP TABLE "post_attempt"`);
    await queryRunner.query(`DROP TYPE "public"."post_step"`);
    await queryRunner.query(`DROP TYPE "public"."post_status"`);
    await queryRunner.query(`COMMENT ON TABLE "video_analysis" IS NULL`);
    await queryRunner.query(
      `DROP INDEX "public"."ix_video_analysis_topic_video"`,
    );
    await queryRunner.query(`DROP TABLE "video_analysis"`);
    await queryRunner.query(`COMMENT ON TABLE "draft" IS NULL`);
    await queryRunner.query(`DROP INDEX "public"."ix_draft_topic_video"`);
    await queryRunner.query(`DROP TABLE "draft"`);
    await queryRunner.query(`DROP TYPE "public"."draft_state"`);
  }
}
