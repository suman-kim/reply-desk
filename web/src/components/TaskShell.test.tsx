import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { TaskShellProvider } from './TaskShell';
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
