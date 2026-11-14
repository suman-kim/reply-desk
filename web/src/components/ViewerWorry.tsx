import type { DraftDetail } from '../api/types';

/**
 * 시청자 고민 한 줄 (RD-32): AI가 시청자 입장에서 꾸민 고민. 이 고민을 가진 사람이 쓴 것처럼 댓글 초안을 쓴다.
 * 작업 상세 B칸에서 댓글 초안 바로 위에 둔다 (과제: 영상을 고르면 고민 한 줄과 초안이 함께 보인다).
 * 다 쓴 초안에만 보이고, 이 기능 전에 쓴 초안(빈 글)이면 [다시 생성]으로 생긴다고 알린다.
 * @param props.detail 영상·초안
 */
export function ViewerWorry({ detail }: { detail: DraftDetail }) {
  const { draft, video } = detail;
  if (!draft || draft.state !== 'ready') return null;
  const worry = draft.worry?.trim();
  if (!worry) {
    // 게시한 영상은 다시 쓰지 않으니 안내할 것이 없다
    if (video.commented) return null;
    return (
      <div className="rd-worry is-none">
        <span className="text-label rd-ink">시청자 고민 한 줄</span>
        <span className="text-caption rd-muted">이 초안은 고민 한 줄을 만들기 전에 썼어요 · 아래 [다시 생성]을 누르면 고민부터 꾸며서 다시 써요</span>
      </div>
    );
  }
  return (
    <section className="rd-worry" aria-label="시청자 고민 한 줄">
      <div className="rd-worry-head">
        <span className="text-label rd-ink">시청자 고민 한 줄</span>
        <span className="text-caption rd-muted">AI가 시청자 입장에서 꾸민 고민</span>
      </div>
      <p className="rd-worry-text text-body-strong">“{worry}”</p>
      <span className="text-caption rd-muted">이 고민을 가진 사람이 쓴 것처럼 아래 댓글을 썼어요</span>
    </section>
  );
}
