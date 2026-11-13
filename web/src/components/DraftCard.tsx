import { useEffect, useId, useRef, useState } from 'react';
import { useActions } from '../api/queries';
import type { DraftDetail, Topic } from '../api/types';
import { Badge, Button, CheckList, Spinner } from '../ds';
import { countChars } from '../lib/format';
import { Icon } from './Icon';
import { ErrorBand } from './StateBox';
import { StatusBadge } from './StatusBadge';

/** 고친 글을 저장하기까지 기다리는 시간 (치는 동안 매번 저장하지 않게) */
const SAVE_DELAY_MS = 700;

/**
 * 작업 상세 B칸의 '댓글 초안' 카드 (RD-26): 상태 · 글자 수 → 초안(고치면 바로 다시 검사) → 광고 표시 안내 · [다시 생성]
 * → 자동 검사 → 이렇게 쓴 이유(접기).
 * 초안이 없으면 [초안 작성], 쓰는 중이면 진행, 실패면 원인과 [다시 생성].
 * @param props.topic 주제 (글자 수 범위 · 광고 표시)
 * @param props.detail 영상·분석·초안
 */
export function DraftCard({ topic, detail }: { topic: Topic; detail: DraftDetail }) {
  const { regenerate, editDraft } = useActions();
  const { video, draft } = detail;
  const fid = useId();
  const [text, setText] = useState(draft?.text ?? '');
  const [dirty, setDirty] = useState(false);
  const [whyOpen, setWhyOpen] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 서버의 글이 바뀌면(다시 생성 등) 고치는 중이 아닐 때만 따라간다 (그리는 중에 맞추는 파생 상태)
  const serverKey = `${draft?.id ?? 0}:${draft?.text ?? ''}`;
  const [seen, setSeen] = useState(serverKey);
  if (!dirty && seen !== serverKey) {
    setSeen(serverKey);
    setText(draft?.text ?? '');
  }
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const locked = video.commented;
  const regen = (reanalyze: boolean) => regenerate.mutate({ topicId: topic.id, videoId: video.id, reanalyze });
  const regenButtons = (
    <div className="rd-row-tight">
      <Button size="sm" loading={regenerate.isPending} disabled={locked} leading={<Icon name="refresh" size={14} />} onClick={() => regen(false)}>
        다시 생성
      </Button>
      <Button variant="ghost" size="sm" disabled={regenerate.isPending || locked} onClick={() => regen(true)}>
        분석부터 다시
      </Button>
    </div>
  );
  const regenError = regenerate.error ? <ErrorBand error={regenerate.error} /> : null;
  const status = detail.status ? <StatusBadge status={detail.status.code} label={detail.status.label} /> : null;
  const head = (counter?: React.ReactNode) => (
    <div className="rd-dc-head">
      <div className="rd-row-tight">
        <label className="text-heading" htmlFor={fid}>
          댓글 초안
        </label>
        {status}
      </div>
      {counter}
    </div>
  );

  if (!draft) {
    // 불러오기는 초안을 쓰지 않는다 · 이 영상을 골랐을 때 여기서 쓴다
    return (
      <div className="rd-card rd-dc">
        {head()}
        <div className="rd-dc-empty">
          <span className="text-body-strong rd-ink">아직 이 영상의 초안이 없어요</span>
          <span className="text-caption rd-muted">[초안 작성]을 누르면 영상을 분석하고 주제에 맞는 댓글 초안을 써요</span>
        </div>
        {regenError}
        <Button variant="primary" size="lg" fullWidth loading={regenerate.isPending} disabled={locked} onClick={() => regen(false)}>
          초안 작성
        </Button>
        {locked ? <span className="text-caption rd-block-reason">이미 댓글을 단 영상이라 초안을 쓰지 않아요</span> : null}
      </div>
    );
  }
  if (draft.state === 'writing') {
    return (
      <div className="rd-card rd-dc">
        {head()}
        <div className="rd-dc-empty" role="status">
          <Spinner size={20} />
          <span className="text-body-strong rd-ink">영상을 분석하고 초안을 쓰는 중…</span>
          <span className="text-caption rd-muted">보통 30초~1분 걸려요 · 다른 화면으로 가도 계속 써요</span>
        </div>
      </div>
    );
  }
  if (draft.state === 'error') {
    return (
      <div className="rd-card rd-dc">
        {head()}
        <div className="rd-band rd-band-danger" role="alert">
          <span className="text-body-sm">{draft.errorMessage ?? '초안을 쓰지 못했어요 · [다시 생성]을 눌러 주세요'}</span>
        </div>
        {regenError}
        {regenButtons}
      </div>
    );
  }

  /** 글을 고치면 잠시 뒤 저장하고, 서버가 바로 다시 검사한다 */
  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
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
  const failed = draft.checkResults.filter((r) => !r.passed).length;
  const saveNote = locked
    ? '이미 댓글을 단 영상이라 고칠 수 없어요 · 영상당 1개만 달아요'
    : editDraft.isPending || dirty
      ? '저장하고 다시 검사하는 중…'
      : editDraft.error
        ? editDraft.error.message
        : '고치면 바로 저장하고 다시 검사해요';
  const disclosure = topic.adDisclosure?.trim();
  const adNote = video.isMine ? (
    '내 채널 영상이라 광고 표시 없이 달아요'
  ) : (
    <>
      다른 채널 영상이라 맨 앞에 <b className="rd-ink">{disclosure || '[광고]'}</b>가 있어야 게시돼요
    </>
  );

  return (
    <div className="rd-card rd-dc">
      {head(
        <span className={`rd-dc-count text-mono${bad ? ' is-bad' : ''}`}>
          {n} / {topic.maxLength}자
        </span>,
      )}
      <textarea id={fid} className="dk-input dk-textarea rd-dc-text" rows={4} value={text} onChange={onChange} readOnly={locked} aria-describedby={`${fid}-note`} />
      <div className="rd-dc-foot">
        <div className="rd-stack" style={{ minWidth: 0 }}>
          <span className="text-caption rd-muted">{adNote}</span>
          <span id={`${fid}-note`} className={`text-caption ${editDraft.error ? 'rd-danger' : 'rd-muted'}`} aria-live="polite">
            {saveNote}
          </span>
        </div>
        {regenButtons}
      </div>
      {regenError}

      <div className="rd-dc-checks">
        <div className="rd-dc-checks-head">
          <span className="text-label rd-ink">자동 검사</span>
          {failed === 0 ? <Badge tone="success">모두 통과</Badge> : <Badge tone="warning">{failed}개 확인 필요</Badge>}
        </div>
        <CheckList items={draft.checkResults.map((r) => ({ label: `${r.label} · ${r.detail}`, ok: r.passed }))} />
      </div>

      <div className="rd-dc-why">
        <button type="button" className="rd-dc-why-toggle" aria-expanded={whyOpen} onClick={() => setWhyOpen((o) => !o)}>
          <span className="text-body-strong">
            이 댓글을 이렇게 쓴 이유
            <span className="text-caption rd-muted rd-dc-why-note">
              {draft.edited ? '직접 고친 초안이에요 · 이유는 AI 초안 기준이에요' : `${draft.provider ?? 'AI'} · ${draft.model ?? ''}`}
            </span>
          </span>
          <Icon name="chevronDown" size={16} />
        </button>
        {whyOpen ? (
          <ol className="rd-ol">
            {draft.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ol>
        ) : null}
      </div>
    </div>
  );
}
