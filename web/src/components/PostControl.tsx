import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { keys, useActions, useAttempt, usePostCheck } from '../api/queries';
import type { DraftDetail, Topic, VideoItem } from '../api/types';
import { Badge, BrowserFrame, Button, Segmented, Spinner, StepList, type StepItem } from '../ds/inyeon';

/** 서버 단계 상태 → 디자인 시스템 StepList 상태 */
const STEP_STATE = { done: 'done', running: 'active', failed: 'failed', waiting: 'pending' } as const;

/**
 * ③ 칸 / 초안 상세의 게시: 계정 고르기 → [댓글 달기] → 진행 5단계 → 크롬 미리보기 → 결과
 * @param props.topic 주제 (쓸 프로필)
 * @param props.video 고른 영상 (없으면 null)
 * @param props.attempts 이 영상의 댓글 게시 (최근 결과를 이어서 보여 준다)
 * @param props.showBrowser 크롬 미리보기 창을 보일지
 */
export function PostControl({
  topic,
  video,
  attempts,
  showBrowser,
}: {
  topic: Topic;
  video: VideoItem | null;
  attempts: DraftDetail['attempts'];
  showBrowser: boolean;
}) {
  const { post } = useActions();
  const [choice, setChoice] = useState<string>('auto');
  // 처음에는 이 영상의 최근 게시를 이어서 보여 준다 (영상이 바뀌면 부모가 key로 새로 만든다)
  const [attemptId, setAttemptId] = useState<number | null>(attempts[0]?.id ?? null);

  const profileId = choice === 'auto' ? null : Number(choice);
  const check = usePostCheck(topic.id, video?.id ?? null, profileId);
  const attempt = useAttempt(attemptId);
  const previewSeq = useQuery({ queryKey: keys.preview(attemptId ?? 0), queryFn: () => 0, staleTime: Infinity, enabled: false });

  const running = attempt.data?.status === 'running' || post.isPending;
  const chosen = topic.profiles.find((p) => p.id === profileId);
  const profileNote =
    choice === 'auto'
      ? check.data?.profile
        ? `이번 차례: ${check.data.profile.name}`
        : '로그인된 프로필이 없어요 · [계정 관리]에서 연결해 주세요'
      : chosen?.loginStatus === 'needs_login'
        ? `${chosen.name}은(는) 로그인이 필요해요`
        : `${chosen?.name ?? ''}로 게시해요`;
  const blockText = post.error?.message ?? check.data?.block?.message ?? (check.error ? check.error.message : null);

  const steps: StepItem[] = (attempt.data?.steps ?? []).map((s) => ({
    label: s.label,
    state: STEP_STATE[s.state],
    meta:
      s.step === 'type' && attempt.data?.typing && s.state !== 'waiting'
        ? `${attempt.data.typing.typed} / ${attempt.data.typing.total}자`
        : undefined,
  }));

  const onPost = () => {
    if (!video) return;
    post.mutate({ topicId: topic.id, videoId: video.id, profileId }, { onSuccess: (a) => setAttemptId(a.id) });
  };

  // 넓으면 왼쪽은 계정·대상·버튼·진행, 오른쪽은 크롬 화면 미리보기 (좁으면 위아래)
  const browser = showBrowser ? (
    <BrowserFrame
      profile={attempt.data?.profileName ? `${attempt.data.profileName} 프로필` : '크롬 프로필'}
      url={video ? `youtube.com/watch?v=${video.youtubeId}` : 'about:blank'}
      minHeight={360}
    >
      {attempt.data?.hasPreview && attemptId ? (
        <img
          className="rd-preview"
          alt="게시 중인 크롬 화면"
          src={`/api/posting/attempts/${attemptId}/preview?seq=${previewSeq.data ?? 0}`}
        />
      ) : running ? (
        <div className="rd-box-row text-body-sm" style={{ margin: 'auto 0' }}>
          <Spinner size={20} />
          <span>크롬을 여는 중…</span>
        </div>
      ) : (
        <p className="text-body-sm rd-muted" style={{ margin: 'auto 0', textAlign: 'center' }}>
          [댓글 달기]를 누르면
          <br />이 창에서 진행 과정이 보여요
        </p>
      )}
    </BrowserFrame>
  ) : null;

  return (
    <div className="rd-cq">
    <div className={`rd-split${browser ? '' : ' is-single'}`}>
    <div className="rd-stack-16">
      <div className="rd-stack-8">
        <span className="text-label rd-ink2">게시할 계정</span>
        {topic.profiles.length === 0 ? (
          <span className="text-body-sm rd-muted">
            이 주제에 쓸 프로필이 없어요 · <Link to={`/topics/${topic.id}/edit`}>주제 설정</Link>에서 골라 주세요
          </span>
        ) : (
          <Segmented
            label="게시할 계정"
            block
            value={choice}
            onChange={setChoice}
            options={[...topic.profiles.map((p) => ({ value: String(p.id), label: p.name })), { value: 'auto', label: '자동' }]}
          />
        )}
        <span className="text-caption rd-muted">{profileNote}</span>
      </div>

      <div className="rd-target">
        <span className="text-caption rd-muted">게시 대상</span>
        <span className="text-body-strong">{video?.title ?? '영상을 먼저 골라 주세요'}</span>
        {video ? (
          video.isMine ? (
            <Badge tone="rose">내 채널</Badge>
          ) : (
            <Badge>다른 채널 · 맨 앞에 {topic.adDisclosure}</Badge>
          )
        ) : null}
      </div>

      <div className="rd-stack-8">
        <Button variant="primary" size="lg" fullWidth disabled={!check.data?.allowed || running} loading={running} onClick={onPost}>
          {running ? '게시하는 중…' : '댓글 달기'}
        </Button>
        {!running && blockText ? <span className="text-caption rd-block-reason">{blockText}</span> : null}
      </div>

      <div aria-live="polite" className="rd-stack-12">
        {steps.length > 0 ? <StepList steps={steps} /> : null}
        {attempt.data?.status === 'success' ? (
          <div className="rd-band rd-band-success">
            <span className="text-body-strong">게시 완료 · {attempt.data.profileName}</span>
            {attempt.data.commentUrl ? (
              <a href={attempt.data.commentUrl} target="_blank" rel="noreferrer" className="text-body-sm">
                댓글 보기
              </a>
            ) : null}
            {attempt.data.hasCapture ? (
              <a href={`/api/posting/attempts/${attempt.data.id}/capture`} target="_blank" rel="noreferrer" className="text-body-sm">
                게시 화면 캡처
              </a>
            ) : null}
            <Link to={`/logs?topic=${topic.id}`} className="text-body-sm">
              댓글 게시 목록
            </Link>
          </div>
        ) : null}
        {attempt.data?.status === 'failed' ? (
          <div className="rd-band rd-band-danger" role="alert">
            <span className="text-body-sm">{attempt.data.failureReason}</span>
            {attempt.data.hasCapture ? (
              <a href={`/api/posting/attempts/${attempt.data.id}/capture`} target="_blank" rel="noreferrer" className="text-body-sm">
                캡처 보기
              </a>
            ) : null}
            <Link to={`/logs?topic=${topic.id}`} className="text-body-sm">
              댓글 게시 목록
            </Link>
          </div>
        ) : null}
      </div>
    </div>
    {browser}
    </div>
    </div>
  );
}
