import { useEffect, useRef, useState } from 'react';
import { useActions } from '../api/queries';
import type { DraftDetail, Topic } from '../api/types';
import { Button, CheckList, Field, ReasonBox } from '../ds/inyeon';
import { countChars } from '../lib/format';
import { EmptyBox, ErrorBand, LoadingBox } from './StateBox';

/** 고친 글을 저장하기까지 기다리는 시간 (치는 동안 매번 저장하지 않게) */
const SAVE_DELAY_MS = 700;

/**
 * ② 칸 본문 / 초안 상세: 고른 이유 → 고민 한 줄 → 근거 장면 → 초안(고치기) → 쓴 이유 → 자동 검사 → [다시 생성]
 * @param props.topic 주제 (글자 수 범위)
 * @param props.detail 영상·분석·초안
 */
export function DraftReview({ topic, detail }: { topic: Topic; detail: DraftDetail }) {
  const { regenerate, editDraft } = useActions();
  const { video, analysis, draft } = detail;
  const [text, setText] = useState(draft?.text ?? '');
  const [dirty, setDirty] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 서버의 글이 바뀌면(다시 생성 등) 고치는 중이 아닐 때만 따라간다
  useEffect(() => {
    if (!dirty) setText(draft?.text ?? '');
  }, [draft?.id, draft?.text, dirty]);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const regen = (reanalyze: boolean) => regenerate.mutate({ topicId: topic.id, videoId: video.id, reanalyze });
  const regenButtons = (
    <div className="rd-row">
      <Button variant="secondary" loading={regenerate.isPending} disabled={video.commented} onClick={() => regen(false)}>
        다시 생성
      </Button>
      <Button variant="ghost" disabled={regenerate.isPending || video.commented} onClick={() => regen(true)}>
        분석부터 다시
      </Button>
    </div>
  );
  const regenError = regenerate.error ? <ErrorBand error={regenerate.error} /> : null;

  if (!draft) {
    // 불러오기는 초안을 쓰지 않는다 · 이 영상을 골랐을 때 여기서 쓴다 (② 칸의 주요 버튼)
    return (
      <>
        <EmptyBox>
          아직 이 영상의 초안이 없어요
          <br />
          [초안 작성]을 누르면 영상을 분석하고 댓글 초안을 써요
        </EmptyBox>
        {regenError}
        <Button variant="primary" fullWidth loading={regenerate.isPending} disabled={video.commented} onClick={() => regen(false)}>
          초안 작성
        </Button>
        {video.commented ? <span className="text-caption rd-block-reason">이미 댓글을 단 영상이라 초안을 쓰지 않아요</span> : null}
      </>
    );
  }
  if (draft.state === 'writing') {
    return <LoadingBox>영상을 분석하고 초안을 쓰는 중…</LoadingBox>;
  }
  if (draft.state === 'error') {
    return (
      <>
        <div className="rd-band rd-band-danger" role="alert">
          <span className="text-body-sm">{draft.errorMessage ?? '초안을 쓰지 못했어요 · [다시 생성]을 눌러 주세요'}</span>
        </div>
        {regenError}
        {regenButtons}
      </>
    );
  }

  /** 글을 고치면 잠시 뒤 저장하고, 서버가 바로 다시 검사한다 */
  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const next = e.target.value;
    setText(next);
    setDirty(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (next.trim().length === 0) return;
      editDraft.mutate({ draftId: draft.id, text: next }, { onSettled: () => setDirty(false) });
    }, SAVE_DELAY_MS);
  };

  const n = countChars(text);
  const bad = n < topic.minLength || n > topic.maxLength;
  const saveNote = video.commented
    ? '이미 댓글을 단 영상이라 고칠 수 없어요'
    : editDraft.isPending || dirty
      ? '저장하고 다시 검사하는 중…'
      : editDraft.error
        ? editDraft.error.message
        : '고치면 바로 다시 검사해요';

  // 넓으면 왼쪽은 판단 근거(고른 이유·고민·장면), 오른쪽은 초안과 검사 (좁으면 위아래)
  return (
    <div className="rd-cq">
      <div className={`rd-split${analysis ? '' : ' is-single'}`}>
      {analysis ? (
        <div className="rd-stack-16">
          <ReasonBox tone="accent" label="이 영상을 고른 이유" items={analysis.pickReasons} />
          <ReasonBox tone="rose" label="영상 속 고민 한 줄">
            {analysis.worry}
          </ReasonBox>
          <div className="rd-stack-8">
            <span className="text-label rd-ink2">근거로 쓴 장면 · 댓글</span>
            {analysis.scenes.map((s, i) => (
              <div className="rd-scene" key={i}>
                <span className="text-mono rd-scene-time">{s.time ?? (s.source === 'comment' ? '인기 댓글' : '영상 설명')}</span>
                <span className="text-body-sm">“{s.quote}”</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="rd-stack-16">
      <Field
        label="댓글 초안"
        multiline
        rows={5}
        value={text}
        onChange={onChange}
        readOnly={video.commented}
        counter={`${n} / ${topic.maxLength}자`}
        counterInvalid={bad}
        hint={saveNote}
      />
      <ReasonBox
        tone="neutral"
        label="이 댓글을 이렇게 쓴 이유"
        items={draft.reasons}
        note={draft.edited ? '직접 고친 초안이에요 · 이유는 AI 초안 기준이에요' : `${draft.provider ?? 'AI'} · ${draft.model ?? ''}`}
      />
      <CheckList items={draft.checkResults.map((r) => ({ label: `${r.label} · ${r.detail}`, ok: r.passed }))} />
      {regenError}
      {regenButtons}
      </div>
      </div>
    </div>
  );
}
