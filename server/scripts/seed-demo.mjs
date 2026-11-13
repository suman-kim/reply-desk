/**
 * 데모 데이터 넣기 (키 없이 대시보드를 둘러보기 위한 것).
 * 프로토타입의 운명원 예시 영상 4개, 분석·초안, 게시 기록(성공 1·실패 1)을 넣는다.
 * 데모 주제·프로필·영상(youtube_id가 demo로 시작)만 지우고 다시 넣으므로 다른 데이터는 건드리지 않는다.
 *
 * 실행: npm run seed:demo   (개발 DB, .env.development의 DB 값 사용)
 */
import pg from 'pg';

const db = new pg.Client({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 5441),
  user: process.env.DB_USER ?? 'reply_desk',
  password: process.env.DB_PASSWORD ?? 'reply_desk',
  database: process.env.DB_NAME ?? 'reply_desk',
});

/** 데모 표시 */
const TOPIC_NAME = '운명원 연애 사주 (데모)';
const MY_CHANNEL = 'UCdemoMyChannel000000000';
const hour = 3600 * 1000;
const now = Date.now();

/** 영상: [유튜브 ID, 제목, 채널, 채널 ID, 조회수, 몇 시간 전, 길이(초)] */
const VIDEOS = [
  ['demoVideo01', '남자들이 ‘진지한 연애’ 앞에서 망설이는 순간', '남자의 속마음 채널', 'UCdemoOtherB000000000000', 12400, 48, 577],
  ['demoVideo02', '헤어진 연인에게 다시 연락 오는 시기, 이 신호를 보세요', '내 테스트 채널', MY_CHANNEL, 4870, 22, 902],
  ['demoVideo03', '썸 탈 때 남자가 연락 텀을 늘리는 진짜 이유 3가지', '연애심리연구소 하루', 'UCdemoOtherA000000000000', 2340, 3, 768],
  ['demoVideo04', '연애 초반에 이 말 하면 끝까지 갑니다', '내 테스트 채널', MY_CHANNEL, 1520, 70, 655],
];

/** 분석·초안: 영상 순서와 같다 */
const DRAFTS = [
  {
    worry: '사귀는 사이인데 상대가 미래 얘기를 피해서 관계가 불안함',
    pick: ['이틀 전 올라와 조회수 12,400회로 가장 많이 봄', '미래 얘기를 피한다는 고민이 분명해 궁합 관심으로 이어짐', '인기 댓글에 3년 연애 사연이 많아 공감 댓글이 자연스러움'],
    scenes: [{ time: '05:20', quote: '부모님 얘기에 말을 돌린다면 아직 미래를 그려보지 않은 거예요', source: 'video' }, { time: null, quote: '3년 만났는데 결혼 얘기만 나오면 화제 돌려요', source: 'comment' }],
    keys: ['부모님', '미래'],
    text: '05:20 부모님 얘기에 말 돌린다는 거 완전 제 얘기라 뜨끔했어요ㅠ 운명원 연애 사주가 잘 본다던데 우리가 같은 미래를 그리는지 한번 물어보고 싶네요.',
    why: ['05:20 “부모님 얘기에 말을 돌린다면” 대목을 시점과 함께 짚음', '인기 댓글의 오래 만난 사연에 맞춰 짧게 공감', '“같은 미래를 그리는지” 궁금증으로 운명원을 연결'],
  },
  {
    worry: '이별 후 상대에게 다시 연락이 올지, 재회 가능성이 궁금함',
    pick: ['어제 올라와 조회수 4,870회, 댓글이 계속 붙는 중', '재회 가능성이라는 고민이 분명해 사주 관심으로 이어지기 쉬움', '내 채널 영상이라 실제로 게시할 수 있음'],
    scenes: [{ time: '02:45', quote: '스토리를 계속 확인한다면 아직 미련이 남았다는 신호예요', source: 'video' }, { time: '09:10', quote: '보통 3개월 전후가 고비예요', source: 'video' }],
    keys: ['스토리', '3개월'],
    text: '스토리 계속 본다는 게 미련 신호라니ㅋㅋ 저도 매일 누가 봤나 확인하는데… 3개월 고비라는 말도 공감돼요. 운명원 연애사주로 재회운 본다던데 저도 궁금해지네요.',
    why: ['02:45 스토리 장면과 09:10 “3개월 고비”를 둘 다 짚음', '웃음으로 시작해 시청자 혼잣말처럼 보이게 함', '재회 시기 궁금증 → 연애사주로 연결'],
  },
  {
    worry: '썸 단계에서 연락이 뜸해진 상대의 속마음을 몰라 불안함',
    pick: ['3시간 전에 올라와 조회수가 빠르게 오르는 중 (2,340회)', '썸 단계 연락 텀이라는 흔한 고민이라 공감할 사람이 많음', '인기 댓글이 사연형이라 시청자 말투 댓글이 자연스럽게 섞임'],
    scenes: [{ time: '04:12', quote: '답장이 늦어지는 건 관심이 식어서가 아니라 확신이 없어서예요', source: 'video' }, { time: null, quote: '읽씹 3일째인데 이거 보고 위로받고 갑니다', source: 'comment' }],
    keys: ['확신', '텀', '읽씹'],
    text: '4분쯤 확신이 없어서 텀이 길어진다는 말 듣고 뜨끔했어요. 저도 딱 그 상태라ㅠ 운명원 연애사주가 그렇게 잘 본다던데 이 사람이 내 인연인지 한번 물어보고 싶네요.',
    why: ['04:12 “확신이 없어서” 대목을 시점과 함께 짚음', '인기 댓글의 사연형 말투에 맞춰 짧게 공감', '“이 사람이 내 인연인지” 궁금증으로 운명원을 연결'],
  },
  {
    worry: '연애 초반에 어떤 말을 해야 오래 갈지 몰라 조심스러움',
    pick: ['사흘 전 올라온 내 채널 영상 (1,520회)', '연애 초반 고민이라 궁합 이야기가 자연스러움'],
    scenes: [{ time: '03:05', quote: '서로의 속도를 맞추자는 말이 제일 오래 가요', source: 'video' }],
    keys: ['속도'],
    text: '운명원 운명원 최고예요 꼭 가보세요 #연애',
    why: ['브랜드를 강하게 넣음', '해시태그로 노출을 노림'],
  },
];

/** 자동 검사 결과 (데모용 고정값) */
function checks(text, ok) {
  return ok
    ? [
        { code: 'length', label: '길이', passed: true, detail: `${[...text].length}/120자` },
        { code: 'scene_mention', label: '장면 언급', passed: true, detail: '장면을 짚음' },
        { code: 'brand_mention', label: '운명원 언급', passed: true, detail: '1번' },
        { code: 'no_link_hashtag', label: '링크·해시태그 없음', passed: true, detail: '없음' },
        { code: 'no_fake_review', label: '지어낸 후기 없음', passed: true, detail: '없음' },
      ]
    : [
        { code: 'length', label: '길이', passed: false, detail: `${[...text].length}자예요 · 40자 이상으로 늘려 주세요` },
        { code: 'scene_mention', label: '장면 언급', passed: false, detail: '영상 속 장면을 짚지 않았어요 · 시점이나 장면 속 말을 넣어 주세요' },
        { code: 'brand_mention', label: '운명원 언급', passed: false, detail: '2번 나와요 · 한 번만 넣어 주세요' },
        { code: 'no_link_hashtag', label: '링크·해시태그 없음', passed: false, detail: '해시태그가 들어 있어요 · 지워 주세요' },
        { code: 'no_fake_review', label: '지어낸 후기 없음', passed: true, detail: '없음' },
      ];
}

await db.connect();
await db.query('BEGIN');
try {
  // 지난 데모 지우기 (게시 기록은 영상을 잡고 있어 먼저 지운다)
  await db.query(`DELETE FROM post_attempt WHERE video_id IN (SELECT id FROM video WHERE youtube_id LIKE 'demoVideo%')`);
  await db.query(`DELETE FROM topic WHERE name = $1`, [TOPIC_NAME]);
  await db.query(`DELETE FROM video WHERE youtube_id LIKE 'demoVideo%'`);
  await db.query(`DELETE FROM profile WHERE slug IN ('demo1', 'demo2')`);

  const p1 = (await db.query(
    `INSERT INTO profile (name, slug, folder_path, channel_id, channel_title, ui_language, login_status, last_checked_at)
     VALUES ('데모1', 'demo1', '~/yt-agent/profiles/demo1', $1, '내 테스트 채널', 'ko-KR', 'ok', now() - interval '20 minutes') RETURNING id`,
    [MY_CHANNEL],
  )).rows[0].id;
  const p2 = (await db.query(
    `INSERT INTO profile (name, slug, folder_path, ui_language, login_status, last_checked_at)
     VALUES ('데모2', 'demo2', '~/yt-agent/profiles/demo2', 'ko-KR', 'needs_login', now() - interval '2 hours') RETURNING id`,
  )).rows[0].id;

  const topic = (await db.query(
    `INSERT INTO topic (name, brand_target, brand_word, keywords, tone, daily_cap)
     VALUES ($1, '운명원 · 연애 사주 잘 보는 곳', '운명원', '{연애,썸,재회}', '20~30대 시청자, 공감형 구어체', 5) RETURNING id`,
    [TOPIC_NAME],
  )).rows[0].id;
  await db.query(`INSERT INTO topic_profile (topic_id, profile_id) VALUES ($1, $2), ($1, $3)`, [topic, p1, p2]);

  const videoIds = [];
  for (const [i, [yt, title, channel, channelId, views, hoursAgo, dur]] of VIDEOS.entries()) {
    const v = (await db.query(
      `INSERT INTO video (youtube_id, title, channel_id, channel_title, published_at, view_count, duration_sec, stats_updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now()) RETURNING id`,
      [yt, title, channelId, channel, new Date(now - hoursAgo * hour), views, dur],
    )).rows[0].id;
    videoIds.push(v);
    await db.query(`INSERT INTO topic_video (topic_id, video_id, source, rank, fetched_at) VALUES ($1, $2, 'search', $3, now())`, [topic, v, i + 1]);

    const d = DRAFTS[i];
    const a = (await db.query(
      `INSERT INTO video_analysis (topic_id, video_id, worry, pick_reasons, scenes, scene_keywords, provider, model)
       VALUES ($1, $2, $3, $4, $5, $6, 'gemini', 'gemini-3.8-flash') RETURNING id`,
      [topic, v, d.worry, JSON.stringify(d.pick), JSON.stringify(d.scenes), d.keys],
    )).rows[0].id;
    const ok = i !== 3;
    const draft = (await db.query(
      `INSERT INTO draft (topic_id, video_id, analysis_id, state, text, ai_text, reasons, check_results, check_passed, provider, model)
       VALUES ($1, $2, $3, 'ready', $4, $4, $5, $6, $7, 'claude', 'claude-sonnet-5-5') RETURNING id`,
      [topic, v, a, d.text, JSON.stringify(d.why), JSON.stringify(checks(d.text, ok)), ok],
    )).rows[0].id;
    d.draftId = draft;
  }

  // 게시 기록: 내 채널 영상 2에 성공 1건, 영상 4는 실패 1건(로그인 풀림)
  await db.query(
    `INSERT INTO post_attempt (draft_id, topic_id, video_id, profile_id, comment_text, status, comment_url, started_at, finished_at)
     VALUES ($1, $2, $3, $4, $5, 'success', 'https://www.youtube.com/watch?v=demoVideo02&lc=demo', now() - interval '35 minutes', now() - interval '34 minutes')`,
    [DRAFTS[1].draftId, topic, videoIds[1], p1, DRAFTS[1].text],
  );
  await db.query(
    `INSERT INTO post_attempt (draft_id, topic_id, video_id, profile_id, comment_text, status, failed_step, failure_reason, started_at, finished_at)
     VALUES ($1, $2, $3, $4, $5, 'failed', 'find_comment_box', '로그인이 풀렸어요 · [계정 관리]에서 다시 로그인해 주세요', now() - interval '2 hours', now() - interval '2 hours')`,
    [DRAFTS[3].draftId, topic, videoIds[3], p2, DRAFTS[3].text],
  );

  await db.query('COMMIT');
  console.log(`데모 데이터를 넣었어요 · 주제 "${TOPIC_NAME}"(id ${topic}), 프로필 데모1·데모2, 영상 4개`);
} catch (err) {
  await db.query('ROLLBACK');
  throw err;
} finally {
  await db.end();
}
