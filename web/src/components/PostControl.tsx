import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { keys, useActions, useAttempt, usePostCheck } from '../api/queries';
import type { DraftDetail, Topic, VideoItem } from '../api/types';
import { Badge, BrowserFrame, Button, Glyph, Segmented, Spinner, StepList, type StepItem } from '../ds';
import { formatElapsed } from '../lib/format';
import { paths } from '../nav/paths';
import { Icon } from './Icon';

/** 서버 단계 상태 → 디자인 시스템 StepList 상태 */
const STEP_STATE = { done: 'done', running: 'active', failed: 'failed', waiting: 'pending' } as const;

/**
 * 작업 상세 B칸의 '댓글 달기' 카드 (RD-26).
 * 게시 전: 게시할 계정 · 게시 대상 · [댓글 달기] (막히면 사유 한 줄)
 * 게시 중: 진행 5단계(입력은 글자 수) · 크롬 화면 미리보기
 * 게시 후: 완료 표시 · 걸린 시간 · 다음 할 일(다음 영상 · 댓글 보기 · 게시 목록 · 새 초안 쓰고 한 번 더 달기) / 실패면 원인 · 캡처 · [다시 시도]
 * @param props.topic 주제 (쓸 프로필)
 * @param props.video 영상
 * @param props.draftId 지금 초안 ID (이 초안의 게시만 이어서 보여 준다, RD-27)
 * @param props.attempts 이 영상의 댓글 게시 (최근 순, 예전 초안 것도 섞여 있다)
 * @param props.next 게시를 마친 뒤 '다음 할 일' 맨 앞 버튼 (다음 영상으로)
 */
export function PostControl({
  topic,
  video,
  draftId,
  attempts,
  next,
}: {
  topic: Topic;
  video: VideoItem;
  draftId: number | null;
  attempts: DraftDetail['attempts'];
  next?: ReactNode;
}) {
  const { post, regenerate } = useActions();
  const [choice, setChoice] = useState<string>('auto');
  // 처음에는 지금 초안의 최근 게시를 이어서 보여 준다. 예전 초안의 '게시 완료'는 잇지 않는다
  // (영상·초안이 바뀌면 부모가 key로 새로 만든다)
  const [attemptId, setAttemptId] = useState<number | null>(() => attempts.find((x) => x.draftId === draftId)?.id ?? null);

  const profileId = choice === 'auto' ? null : Number(choice);
  const check = usePostCheck(topic.id, video.id, profileId);
  const attempt = useAttempt(attemptId);
  const previewSeq = useQuery({ queryKey: keys.preview(attemptId ?? 0), queryFn: () => 0, staleTime: Infinity, enabled: false });

  const a = attempt.data;
  const running = a?.status === 'running' || post.isPending;
  const done = a?.status === 'success' || (!running && video.commented);
  const chosen = topic.profiles.find((p) => p.id === profileId);
  const profileNote =
    choice === 'auto'
      ? check.data?.profile
        ? `이번 차례: ${check.data.profile.name}`
        : '로그인된 프로필이 없어요 · 계정 관리에서 연결해 주세요'
      : chosen?.loginStatus === 'needs_login'
        ? `${chosen.name}은(는) 로그인이 필요해요`
        : `${chosen?.name ?? ''}로 게시해요`;
  const blockText = post.error?.message ?? check.data?.block?.message ?? (check.error ? check.error.message : null);

  const steps: StepItem[] = (a?.steps ?? []).map((s) => ({
    label: s.label,
    state: STEP_STATE[s.state],
    meta: s.step === 'type' && a?.typing && s.state !== 'waiting' ? `${a.typing.typed} / ${a.typing.total}자` : undefined,
  }));

  const onPost = () => {
    post.mutate({ topicId: topic.id, videoId: video.id, profileId }, { onSuccess: (r) => setAttemptId(r.id) });
  };

  if (done) {
    return (
      <div className="rd-card rd-pc">
        <div className="rd-pc-done" aria-live="polite">
          <div className="rd-pc-done-head">
            <span className="rd-pc-done-mark" aria-hidden="true">
              <Glyph name="check" size={18} />
            </span>
            <div className="rd-stack" style={{ minWidth: 0 }}>
              <span className="text-heading rd-success">게시 완료{a?.profileName ? ` · ${a.profileName}` : ''}</span>
              <span className="text-caption rd-muted">
                {a?.status === 'success'
                  ? `내 댓글이 영상에 올라간 것까지 확인했어요 · ${formatElapsed(a.startedAt, a.finishedAt)} 걸림`
                  : '이 영상에는 이미 댓글을 달았어요'}
              </span>
            </div>
          </div>
          <div className="rd-stack-8">
            <span className="text-label rd-ink2">다음 할 일</span>
            <div className="rd-row">
              {next}
              {a?.commentUrl ? (
                <a href={a.commentUrl} target="_blank" rel="noreferrer" className="dk-btn dk-btn-secondary dk-btn-md">
                  댓글 보기
                  <Icon name="external" size={14} />
                </a>
              ) : null}
              <Link to={paths.topic(topic.id, 'logs')} className="dk-btn dk-btn-ghost dk-btn-md">
                게시 목록에서 보기
              </Link>
            </div>
          </div>
          {/* 같은 영상에 댓글 더 달기 (RD-27): 새 초안을 써서 평소처럼 검사하고 게시한다 */}
          <div className="rd-pc-more">
            <span className="text-caption rd-muted">
              게시한 초안은 고칠 수 없어요 · 같은 영상에 댓글을 더 달려면 새 초안을 써요 (이미 단 댓글과 겹치지 않게 써요)
            </span>
            <Button
              variant="secondary"
              loading={regenerate.isPending}
              leading={<Icon name="plus" size={16} />}
              onClick={() => regenerate.mutate({ topicId: topic.id, videoId: video.id, reanalyze: false })}
            >
              새 초안 쓰고 한 번 더 달기
            </Button>
            {regenerate.error ? <span className="dk-field-error">{regenerate.error.message}</span> : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rd-card rd-pc">
      <div className="rd-pc-grid">
        <span className="text-label rd-ink">게시할 계정</span>
        <div className="rd-stack-8" style={{ minWidth: 0 }}>
          {topic.profiles.length === 0 ? (
            <span className="text-body-sm rd-muted">
              이 주제에 쓸 프로필이 없어요 · <Link to={paths.topic(topic.id, 'settings')}>주제 설정</Link>에서 골라 주세요
            </span>
          ) : (
            <Segmented
              label="게시할 계정"
              value={choice}
              onChange={setChoice}
              options={[{ value: 'auto', label: '자동' }, ...topic.profiles.map((p) => ({ value: String(p.id), label: p.name }))]}
            />
          )}
          <span className="text-caption rd-muted">{profileNote}</span>
        </div>
        <span className="text-label rd-ink">게시 대상</span>
        <span className="rd-row-tight" style={{ minWidth: 0 }}>
          <span className="text-body-sm rd-clamp-1 rd-ink">{video.title}</span>
          {video.isMine ? <Badge tone="accent">내 채널</Badge> : <Badge>다른 채널</Badge>}
        </span>
      </div>

      {!running ? (
        <div className="rd-stack-8">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={!check.data?.allowed}
            leading={<Icon name="logs" size={18} />}
            onClick={onPost}
          >
            {a?.status === 'failed' ? '다시 시도' : '댓글 달기'}
          </Button>
          <span className="text-caption rd-block-reason">
            {blockText ?? '크롬 프로필을 열어 한 글자씩 입력하고, 올라간 것까지 확인해요'}
          </span>
        </div>
      ) : null}

      {steps.length > 0 || running ? (
        <div className="rd-stack-12" aria-live="polite">
          {steps.length > 0 ? <StepList steps={steps} /> : null}
          {running || a?.status === 'failed' ? (
            <BrowserFrame
              profile={a?.profileName ? `${a.profileName} 프로필` : '크롬 프로필'}
              url={`youtube.com/watch?v=${video.youtubeId}`}
              minHeight={200}
            >
              {a?.hasPreview && attemptId ? (
                <img className="rd-preview" alt="게시 중인 크롬 화면" src={`/api/posting/attempts/${attemptId}/preview?seq=${previewSeq.data ?? 0}`} />
              ) : (
                <div className="rd-box-row text-body-sm" style={{ margin: 'auto 0' }}>
                  {running ? <Spinner size={20} /> : null}
                  <span>{running ? '크롬을 여는 중…' : '미리보기 화면이 없어요'}</span>
                </div>
              )}
            </BrowserFrame>
          ) : null}
        </div>
      ) : null}

      {a?.status === 'failed' ? (
        <div className="rd-band rd-band-danger" role="alert">
          <span className="text-body-sm">{a.failureReason ?? '게시하지 못했어요'}</span>
          <span className="rd-row-tight">
            {a.hasCapture ? (
              <a href={`/api/posting/attempts/${a.id}/capture`} target="_blank" rel="noreferrer" className="text-body-sm">
                캡처 보기
              </a>
            ) : null}
            <Link to={paths.topic(topic.id, 'logs')} className="text-body-sm">
              댓글 게시 목록
            </Link>
          </span>
        </div>
      ) : null}
    </div>
  );
}
