import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from '../ds/inyeon';

/** 창 너비: wide(영상 보기, 플레이어+댓글) · medium(작업·댓글 게시 상세, 한 단) */
export type ModalWidth = 'wide' | 'medium';

/**
 * 가운데 창. 브라우저 기본 <dialog>라 Esc·바깥(어두운 바탕) 누르기·[닫기]로 닫히고, 초점이 창 안에 머문다.
 * 영상 보기 창·작업 상세·댓글 게시 상세가 함께 쓴다.
 * @param props.open 열지 (false면 닫는다)
 * @param props.label 창 이름 (화면 읽기 프로그램용)
 * @param props.title 머리 제목
 * @param props.badges 제목 위 배지 줄 (상태·내 채널 등)
 * @param props.subtitle 제목 아래 한 줄 (채널·주제 등)
 * @param props.actions 머리 오른쪽, [닫기] 앞에 둘 버튼·링크
 * @param props.width 창 너비 (기본 medium)
 * @param props.onClose 닫힐 때 (Esc·바깥·[닫기] 모두)
 * @param props.children 내용 (열려 있을 때만 그린다)
 */
export function Modal({
  open,
  label,
  title,
  badges,
  subtitle,
  actions,
  width = 'medium',
  onClose,
  children,
}: {
  open: boolean;
  label: string;
  title: ReactNode;
  badges?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  width?: ModalWidth;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  // open이 바뀌면 창을 열고 닫는다
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`rd-modal rd-modal-${width}`}
      aria-label={label}
      onClose={onClose}
      // 창 바깥(어두운 바탕)을 누르면 닫는다
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
    >
      {open ? (
        <div className="rd-modal-body">
          <div className="rd-modal-head">
            <div className="rd-stack-8" style={{ minWidth: 0 }}>
              {badges ? <div className="rd-row-tight">{badges}</div> : null}
              <span className="text-heading rd-modal-title">{title}</span>
              {subtitle ? <span className="text-caption rd-muted">{subtitle}</span> : null}
            </div>
            <div className="rd-row-tight" style={{ flex: 'none' }}>
              {actions}
              <Button variant="secondary" size="sm" onClick={() => ref.current?.close()}>
                닫기
              </Button>
            </div>
          </div>
          <div className="rd-modal-main">{children}</div>
        </div>
      ) : null}
    </dialog>
  );
}
