import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router';
import { keys } from '../api/queries';
import type { DraftListRow, PostLogRow, Topic } from '../api/types';
import { DraftsPage } from './DraftsPage';
import { LogsPage } from './LogsPage';

const topic = { id: 1, name: '운명원' } as Topic;
const now = new Date().toISOString();

/** 게시 기록 */
const log = (id: number, over: Partial<PostLogRow>): PostLogRow => ({
  id,
  startedAt: now,
  finishedAt: now,
  video: { id: 100 + id, youtubeId: `y${id}`, url: `https://www.youtube.com/watch?v=y${id}`, title: `영상 ${id}`, channelTitle: '꿀영' },
  topic: { id: 1, name: '운명원' },
  profileName: '개인계정',
  commentText: `댓글 ${id}`,
  status: 'success',
  failedStep: null,
  failureReason: null,
  hasScreenshot: false,
  commentUrl: null,
  ...over,
});

/** 지금 주소 (이동 확인용) */
function Where() {
  const { pathname, search } = useLocation();
  return <output aria-label="지금 주소">{pathname + search}</output>;
}

/**
 * 주제 화면 하나를 서버 없이 그린다 (받은 데이터를 미리 넣어 둔다)
 * @param path 처음 주소
 * @param seed 캐시에 넣을 값
 */
function renderAt(path: string, seed: (qc: QueryClient) => void) {
  const qc = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  seed(qc);
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/t/:topicId" element={<Outlet context={topic} />}>
            <Route path="logs" element={<LogsPage />} />
            <Route path="drafts" element={<DraftsPage />} />
            <Route path="videos/:videoId" element={<p>작업 상세</p>} />
          </Route>
        </Routes>
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('댓글 게시 목록 (목록 | 자세히)', () => {
  // jsdom에는 <dialog> 열기가 없다
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
      this.open = true;
    };
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
      this.open = false;
    };
  });

  const rows = [
    log(1, { commentText: '재물복 얘기 공감돼요' }),
    log(2, { status: 'failed', failureReason: '로그인이 풀렸어요', failedStep: 'find_comment_box' }),
    log(3, { status: 'running' }),
  ];
  const seed = (qc: QueryClient) => qc.setQueryData(keys.logs(1), rows);

  it('끝난 기록만 보이고, 오늘 성공·실패 수와 맨 위 기록의 자세히를 보인다', () => {
    renderAt('/t/1/logs', seed);
    const list = screen.getByRole('list', { name: '게시 기록' });
    expect(within(list).getAllByRole('button')).toHaveLength(2);
    expect(screen.getByText('오늘 성공').nextSibling).toHaveTextContent('1');
    expect(screen.getByText('오늘 실패').nextSibling).toHaveTextContent('1');
    expect(screen.getByRole('heading', { name: '영상 1' })).toBeInTheDocument();
  });

  it('결과와 찾는 말로 거른다', () => {
    renderAt('/t/1/logs?result=failed', seed);
    const list = screen.getByRole('list', { name: '게시 기록' });
    expect(within(list).getAllByRole('button')).toHaveLength(1);
    expect(within(list).getByText('로그인이 풀렸어요')).toBeInTheDocument();
  });

  it('찾는 말이 댓글에 있는 기록만', () => {
    renderAt('/t/1/logs', seed);
    fireEvent.change(screen.getByLabelText('영상 제목이나 댓글로 찾기'), { target: { value: '재물 복' } });
    const list = screen.getByRole('list', { name: '게시 기록' });
    expect(within(list).getAllByRole('button')).toHaveLength(1);
    expect(within(list).getByText('재물복 얘기 공감돼요')).toBeInTheDocument();
  });

  it('기록을 고르면 주소에 담고, 오른쪽 칸이 안 보이는 좁은 화면이면 창으로 연다', () => {
    renderAt('/t/1/logs', seed);
    fireEvent.click(within(screen.getByRole('list', { name: '게시 기록' })).getByText('영상 2'));
    expect(screen.getByRole('status', { name: '지금 주소' })).toHaveTextContent('/t/1/logs?log=2');
    expect(screen.getByRole('dialog', { name: '댓글 게시 상세: 영상 2' })).toBeInTheDocument();
  });
});

describe('작업 목록 (상태 탭 · 표)', () => {
  const row = {
    id: 9,
    topic: { id: 1, name: '운명원' },
    video: { id: 120, youtubeId: 'y', url: '', title: '재물복을 부르는 이름 한자', channelTitle: '운을수놓다', isMine: false, viewCount: 54209, publishedAt: now, durationSec: 9 },
    text: '[광고] 이름이랑 생일에 담긴 운세',
    provider: 'ollama',
    model: 'gemma4:12b',
    commentUrl: null,
    topicMatch: { percent: 85, matched: true, threshold: 50 },
    edited: false,
    status: 'pending',
    statusLabel: '게시 대기',
    errorMessage: null,
    updatedAt: now,
  } as DraftListRow;
  const counts = { pending: 1, failed: 0, check_failed: 0, posted: 0, writing: 0, error: 0 };
  const seed = (qc: QueryClient) => qc.setQueryData(keys.drafts({ status: undefined, topicId: 1, q: undefined }), { rows: [row], counts });

  it('상태 탭에 개수, 행은 작업 상세 링크', () => {
    renderAt('/t/1/drafts', seed);
    expect(screen.getByRole('tab', { name: /게시 대기/ })).toHaveTextContent('1');
    expect(screen.queryByRole('tab', { name: /작성 중/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /재물복을 부르는 이름 한자/ })).toHaveAttribute('href', '/t/1/videos/120');
  });

  it('예전 주소(?video=)는 작업 상세로', () => {
    renderAt('/t/1/drafts?video=120', seed);
    expect(screen.getByRole('status', { name: '지금 주소' })).toHaveTextContent('/t/1/videos/120');
  });
});
