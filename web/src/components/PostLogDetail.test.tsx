import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { PostLogRow } from '../api/types';
import { PostLogDetail } from './PostLogDetail';

/** 댓글 게시 목록 한 행 (실제 게시 #5와 같은 모양) */
const base: PostLogRow = {
  id: 5,
  startedAt: '2026-11-13T08:48:35.940Z',
  finishedAt: '2026-11-13T08:48:52.197Z',
  video: { id: 2014, youtubeId: 'F-f0fODJLXA', url: 'https://www.youtube.com/watch?v=F-f0fODJLXA', title: 'Link 시연 영상', channelTitle: 'ggssaa' },
  topic: { id: 4, name: '운명원' },
  profileName: '개인계정',
  commentText: '01:10에 "매일 자정에 새로 골라 드려요" 나오는 거 보고 괜히 설레네요.',
  status: 'success',
  failedStep: null,
  failureReason: null,
  hasScreenshot: true,
  commentUrl: 'https://www.youtube.com/watch?v=F-f0fODJLXA&lc=Ugx',
};

/** 주소 이동(Link)과 함께 그린다 */
const renderRow = (row: PostLogRow) =>
  render(
    <MemoryRouter>
      <PostLogDetail row={row} />
    </MemoryRouter>,
  );

describe('PostLogDetail (댓글 게시 상세)', () => {
  it('성공: 게시된 화면 캡처, 댓글 전문, 유튜브·댓글 주소, 걸린 시간을 보인다', () => {
    renderRow(base);
    expect(screen.getByRole('img', { name: /게시된 댓글 화면/ })).toHaveAttribute('src', '/api/posting/attempts/5/capture');
    expect(screen.getByText(base.commentText)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'https://www.youtube.com/watch?v=F-f0fODJLXA' })).toHaveAttribute('href', base.video!.url);
    expect(screen.getByRole('link', { name: '댓글 보기' })).toHaveAttribute('href', base.commentUrl);
    expect(screen.getByText('16초')).toBeInTheDocument();
    expect(screen.getByText('개인계정')).toBeInTheDocument();
  });

  it('실패: 멈춘 단계와 원인, 다시 게시할 곳을 보인다', () => {
    renderRow({
      ...base,
      status: 'failed',
      failedStep: 'find_comment_box',
      failureReason: '로그인이 풀렸어요 · [계정 관리]에서 다시 로그인해 주세요',
      commentUrl: null,
    });
    expect(screen.getByRole('img', { name: /실패한 순간 화면/ })).toBeInTheDocument();
    expect(screen.getByText('댓글 창 찾는 중')).toBeInTheDocument();
    expect(screen.getByText(/로그인이 풀렸어요/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '작업 목록에서 다시 게시' })).toHaveAttribute('href', '/t/4/drafts?video=2014');
  });

  it('캡처가 없으면 없다고 알린다', () => {
    renderRow({ ...base, hasScreenshot: false });
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText(/캡처가 없어요/)).toBeInTheDocument();
  });
});
