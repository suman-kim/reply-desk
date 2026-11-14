import { render, screen } from '@testing-library/react';
import type { DraftDetail } from '../api/types';
import { ViewerWorry } from './ViewerWorry';

/**
 * 시험용 작업 (필요한 값만)
 * @param draft 초안 값
 * @param commented 게시한 영상인지
 */
const detail = (draft: Partial<NonNullable<DraftDetail['draft']>> | null, commented = false) =>
  ({
    video: { id: 2, commented },
    draft: draft ? { id: 3, state: 'ready', worry: '', ...draft } : null,
  }) as unknown as DraftDetail;

describe('ViewerWorry (시청자 고민 한 줄, RD-32)', () => {
  it('다 쓴 초안이면 AI가 꾸민 고민 한 줄을 보인다', () => {
    render(<ViewerWorry detail={detail({ worry: '썸만 3개월째인데 이 사람이 내 인연인지 모르겠어요' })} />);
    expect(screen.getByRole('region', { name: '시청자 고민 한 줄' })).toBeInTheDocument();
    expect(screen.getByText('“썸만 3개월째인데 이 사람이 내 인연인지 모르겠어요”')).toBeInTheDocument();
    expect(screen.getByText('AI가 시청자 입장에서 꾸민 고민')).toBeInTheDocument();
    // 글 모양이 없던 초안은 그 줄을 보이지 않는다
    expect(screen.queryByText('글 모양')).toBeNull();
  });

  it('코드가 고른 글 모양을 한 줄로 보인다 (RD-33)', () => {
    render(
      <ViewerWorry
        detail={detail({ worry: '썸만 3개월째예요', style: { summary: '20대 후반 직장인 · 반말 혼잣말 · 질문으로 시작 · 들은 말로 끝에 · 짧게' } })}
      />,
    );
    expect(screen.getByText('글 모양')).toBeInTheDocument();
    expect(screen.getByText(/20대 후반 직장인 · 반말 혼잣말/)).toBeInTheDocument();
  });

  it('기능 전에 쓴 초안(빈 글)이면 [다시 생성]으로 생긴다고 알린다', () => {
    render(<ViewerWorry detail={detail({ worry: '' })} />);
    expect(screen.getByText(/\[다시 생성\]을 누르면 고민부터 꾸며서/)).toBeInTheDocument();
  });

  it('쓰는 중·초안 없음·게시한 영상의 빈 고민이면 보이지 않는다', () => {
    const { container: writing } = render(<ViewerWorry detail={detail({ state: 'writing' })} />);
    expect(writing).toBeEmptyDOMElement();
    const { container: none } = render(<ViewerWorry detail={detail(null)} />);
    expect(none).toBeEmptyDOMElement();
    const { container: posted } = render(<ViewerWorry detail={detail({ worry: '' }, true)} />);
    expect(posted).toBeEmptyDOMElement();
  });
});
