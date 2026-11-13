import { useEffect, type ReactNode } from 'react';
import { Button } from '../ds';

/**
 * 설정 한 줄 (RD-26): 왼쪽에 이름·짧은 설명, 오른쪽에 입력. 본문 칸이 좁으면 위아래로 쌓인다.
 * @param props.label 이름
 * @param props.htmlFor 이름이 가리킬 입력 칸 id (입력 칸이 하나일 때)
 * @param props.help 이름 아래 짧은 설명
 * @param props.changed 저장하지 않은 바뀐 값이 있는지 (이름 옆 점)
 * @param props.wide 입력 칸을 넓게 쓸지 (카드 여러 개 등)
 * @param props.children 입력
 */
export function FormRow({
  label,
  htmlFor,
  help,
  changed,
  wide,
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  help?: ReactNode;
  changed?: boolean;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="rd-frow">
      <div className="rd-flab">
        <span className="rd-flab-top">
          {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : <span className="rd-flab-name">{label}</span>}
          {changed ? <span className="rd-flab-dot" title="저장하지 않은 바뀐 값" role="img" aria-label="바뀐 값" /> : null}
        </span>
        {help ? <span className="text-caption rd-muted">{help}</span> : null}
      </div>
      <div className={`rd-fctl${wide ? ' rd-fctl-wide' : ''}`}>{children}</div>
    </div>
  );
}

/**
 * 저장 막대 (화면 아래에 붙음, RD-26): 바뀐 내용 N개 · [기본값으로] · [되돌리기] · [저장].
 * 바뀐 것이 있으면 창을 닫거나 새로 고칠 때 브라우저가 한 번 묻는다.
 * @param props.dirty 바뀐 값 수
 * @param props.saving 저장하는 중
 * @param props.note 바뀐 것이 없을 때 한 줄 (저장했어요 · 시각 등)
 * @param props.error 저장 오류 한 줄
 * @param props.saveLabel 저장 단추 이름
 * @param props.onSave 저장
 * @param props.onRevert 되돌리기 (바뀐 값 버리기)
 * @param props.extra 왼쪽 단추 (기본값으로 등)
 */
export function SaveBar({
  dirty,
  saving,
  note,
  error,
  saveLabel = '저장',
  onSave,
  onRevert,
  extra,
}: {
  dirty: number;
  saving: boolean;
  note?: ReactNode;
  error?: string | null;
  saveLabel?: string;
  onSave: () => void;
  onRevert: () => void;
  extra?: ReactNode;
}) {
  // 바뀐 것을 두고 창을 닫으면 묻는다
  useEffect(() => {
    if (dirty === 0) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  return (
    <div className={`rd-savebar${dirty > 0 ? ' is-dirty' : ''}`} role="region" aria-label="저장">
      <span className="rd-savebar-note" aria-live="polite">
        {error ? (
          <span className="rd-danger text-body-sm">{error}</span>
        ) : dirty > 0 ? (
          <span className="text-body-strong">
            <span className="rd-savebar-dot" aria-hidden="true" />
            바뀐 내용 {dirty}개 · 저장하면 다음 작업부터 적용돼요
          </span>
        ) : (
          <span className="text-caption rd-muted">{note ?? '저장된 상태예요'}</span>
        )}
      </span>
      <span className="rd-savebar-actions">
        {extra}
        <Button variant="ghost" disabled={dirty === 0 || saving} onClick={onRevert}>
          되돌리기
        </Button>
        <Button variant="primary" disabled={dirty === 0} loading={saving} onClick={onSave}>
          {saveLabel}
        </Button>
      </span>
    </div>
  );
}
