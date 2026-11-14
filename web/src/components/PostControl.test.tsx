import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { keys } from '../api/queries';
import type { DraftDetail, Topic, VideoItem } from '../api/types';
import { PostControl } from './PostControl';

const topic = { id: 1, name: '운명원 사주', profiles: [], adDisclosure: '[광고]' } as unknown as Topic;
const video = { id: 2, youtubeId: 'yt2', title: '연락 텀이 길어지는 이유', isMine: false, commented: false, commentCount: 1 } as VideoItem;

/**
 * 게시 시도 한 행
 * @param id 시도 ID
 * @param draftId 게시한 초안
 */
const attempt = (id: number, draftId: number): DraftDetail['attempts'][number] => ({
  id,
  draftId,
  status: 'success',
  failedStep: null,
  failureReason: null,
  startedAt: '2026-11-14T08:00:00Z',
  commentUrl: 'https://www.youtube.com/watch?v=yt2&lc=x',
  commentText: '예전에 단 댓글',
});

/**
 * 받아 둔 데이터와 함께 그린다 (서버에 다시 묻지 않게)
 * @param ui 그릴 것
 * @param seed 캐시에 넣을 값
 */
function renderWith(ui: React.ReactElement, seed: (c: QueryClient) => void) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  seed(client);
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PostControl (작업 상세 B칸 댓글 달기, RD-27)', () => {
  it('예전 초안을 게시했어도 새 초안이면 완료 화면이 아니라 [댓글 달기]를 보인다', () => {
    renderWith(<PostControl topic={topic} video={video} draftId={2} attempts={[attempt(10, 1)]} morePerVideo />, (c) =>
      c.setQueryData(keys.postCheck(1, 2, null), {
        allowed: true,
        block: null,
        profile: { id: 1, name: '유튜브1' },
        autoAssigned: true,
        today: { posted: 1, cap: 30, topicPosted: 1, topicCap: 10 },
      }),
    );
    expect(screen.getByRole('button', { name: '댓글 달기' })).toBeEnabled();
    expect(screen.queryByText(/게시 완료/)).toBeNull();
  });

  it("설정 '같은 영상에 댓글 더 달기'를 켜고 지금 초안을 게시했으면 완료 화면과 [새 초안 쓰고 한 번 더 달기]를 보인다", () => {
    renderWith(
      <PostControl topic={topic} video={{ ...video, commented: true }} draftId={2} attempts={[attempt(11, 2), attempt(10, 1)]} morePerVideo />,
      (c) =>
        c.setQueryData(keys.attempt(11), {
          id: 11,
          status: 'success',
          profileName: '유튜브1',
          steps: [],
          typing: null,
          failureReason: null,
          commentUrl: 'https://www.youtube.com/watch?v=yt2&lc=x',
          startedAt: '2026-11-14T08:00:00Z',
          finishedAt: '2026-11-14T08:01:00Z',
          hasPreview: false,
          hasCapture: false,
        }),
    );
    expect(screen.getByText('게시 완료 · 유튜브1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '새 초안 쓰고 한 번 더 달기' })).toBeEnabled();
    expect(screen.queryByText(/영상당 댓글 1개/)).toBeNull();
  });

  it('기본(설정 꺼짐)은 영상당 1개: 완료 화면에 더 달기 버튼 대신 설정 안내와 [설정 열기]를 보인다', () => {
    renderWith(
      <PostControl topic={topic} video={{ ...video, commented: true }} draftId={1} attempts={[attempt(10, 1)]} morePerVideo={false} />,
      (c) =>
        c.setQueryData(keys.attempt(10), {
          id: 10,
          status: 'success',
          profileName: '유튜브1',
          steps: [],
          typing: null,
          failureReason: null,
          commentUrl: 'https://www.youtube.com/watch?v=yt2&lc=x',
          startedAt: '2026-11-14T08:00:00Z',
          finishedAt: '2026-11-14T08:01:00Z',
          hasPreview: false,
          hasCapture: false,
        }),
    );
    expect(screen.getByText('게시 완료 · 유튜브1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '새 초안 쓰고 한 번 더 달기' })).toBeNull();
    expect(screen.getByText(/영상당 댓글 1개만 달아요/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '설정 열기' })).toHaveAttribute('href', '/settings');
  });
});
