import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { keys } from '../api/queries';
import type { DraftListRow, DraftListStatus, Topic } from '../api/types';
import { TaskPanel, TaskShellProvider } from './TaskShell';
import { useTaskShell } from './task-shell-context';

/** 실시간 이벤트를 흉내 내 넣는 버튼 */
function FakeEvent() {
  const shell = useTaskShell();
  return (
    <button type="button" onClick={() => shell.onLiveEvent({ type: 'profile.updated', profileId: 6, name: '개인계정', loginStatus: 'needs_login' })}>
      이벤트
    </button>
  );
}

describe('TaskShell (전역 알림)', () => {
  it('알릴 이벤트가 오면 오른쪽 아래에 띄우고, [닫기]로 지운다', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <TaskShellProvider>
            <FakeEvent />
          </TaskShellProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: '이벤트' }));
    expect(screen.getByText('로그인이 풀렸어요')).toBeInTheDocument();
    expect(screen.getByText('개인계정 · 계정 관리에서 다시 로그인해 주세요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '보기' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '알림 닫기' }));
    expect(screen.queryByText('로그인이 풀렸어요')).not.toBeInTheDocument();
  });
});

/**
 * 작업 패널 행 하나 (필요한 값만)
 * @param id 초안 ID
 * @param status 상태
 * @param title 영상 제목
 */
function row(id: number, status: DraftListStatus, title: string): DraftListRow {
  return {
    id,
    topic: { id: 1, name: '운명원 사주' },
    video: { id, youtubeId: `yt${id}`, url: '', title, channelTitle: 'c', isMine: false, viewCount: 0, publishedAt: '2026-11-14T00:00:00Z', durationSec: 60 },
    text: '',
    status,
    statusLabel: status,
    topicMatch: null,
    updatedAt: '2026-11-14T00:00:00Z',
  } as unknown as DraftListRow;
}

describe('TaskPanel (오른쪽 작업 패널, RD-31)', () => {
  it('거르기는 전체 · 게시 대기 · 작성 중 · 확인 필요 · 게시 완료 순서이고, 게시 완료를 고르면 게시한 것만 보인다', () => {
    const client = new QueryClient();
    client.setQueryData(keys.drafts({ topicId: 1 }), {
      rows: [row(1, 'pending', '대기 영상'), row(2, 'posted', '게시한 영상'), row(3, 'error', '실패 영상'), row(4, 'writing', '쓰는 영상')],
      counts: { pending: 1, failed: 0, check_failed: 0, posted: 1, writing: 1, error: 1 },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <TaskShellProvider>
            <TaskPanel topic={{ id: 1, name: '운명원 사주' } as Topic} />
          </TaskShellProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const group = screen.getByRole('group', { name: '작업 거르기' });
    const labels = Array.from(group.querySelectorAll('button')).map((b) => b.textContent);
    expect(labels).toEqual(['전체 4', '게시 대기 1', '작성 중 1', '확인 필요 1', '게시 완료 1']);

    fireEvent.click(screen.getByRole('button', { name: '게시 완료 1' }));
    expect(screen.getByText('게시한 영상')).toBeInTheDocument();
    expect(screen.queryByText('대기 영상')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '전체 4' }));
    expect(screen.getByText('실패 영상')).toBeInTheDocument();
    expect(screen.getByText('쓰는 영상')).toBeInTheDocument();
  });
});
