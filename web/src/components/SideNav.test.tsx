import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { keys } from '../api/queries';
import type { Profile, TodayQuota, Topic } from '../api/types';
import { SelectedTopicProvider } from '../nav/SelectedTopicProvider';
import { HomePage } from '../pages/HomePage';
import { SideNav } from './SideNav';
import { TaskShellProvider } from './TaskShell';
import { TopBar } from './TopBar';

/**
 * 시험용 주제
 * @param id 주제 ID
 * @param name 이름
 * @param pendingDrafts 게시 대기 수
 */
const topic = (id: number, name: string, pendingDrafts: number): Topic => ({
  id,
  name,
  brandTarget: `${name} 상담`,
  brandWord: name,
  keywords: ['연애'],
  videoWindowDays: 1,
  videoSortBy: 'view_count',
  fetchLimit: 0,
  tone: '공감형',
  minLength: 40,
  maxLength: 120,
  bannedWords: [],
  adDisclosure: '[광고]',
  dailyCap: 10,
  status: 'active',
  profiles: [],
  postedToday: 3,
  pendingDrafts,
});

const TOPICS = [topic(1, '운명원', 7), topic(2, '나는솔로', 1)];
const PROFILES = [{ id: 6, name: '개인계정', loginStatus: 'needs_login' } as Profile];
const TODAY: TodayQuota = { posted: 3, cap: 30, byTopic: {} };

/** 지금 주소를 보인다 (이동 확인용) */
function Where() {
  const { pathname } = useLocation();
  return <output aria-label="지금 주소">{pathname}</output>;
}

/**
 * 사이드 메뉴 · 위쪽 막대 · 홈을 서버 없이 그린다 (받은 데이터를 미리 넣어 둔다)
 * @param path 처음 주소
 * @param lastTopic 마지막에 고른 주제 (브라우저 저장소)
 */
function renderAt(path: string, lastTopic: number | null = null) {
  if (lastTopic) localStorage.setItem('rd.lastTopic', String(lastTopic));
  else localStorage.removeItem('rd.lastTopic');
  const qc = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  qc.setQueryData(keys.topics, TOPICS);
  qc.setQueryData(keys.profiles, PROFILES);
  qc.setQueryData(keys.today, TODAY);
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <SelectedTopicProvider>
          <TaskShellProvider>
            <SideNav open={false} onClose={() => {}} />
            <TopBar live="open" navOpen={false} onOpenNav={() => {}} />
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="*" element={null} />
            </Routes>
            <Where />
          </TaskShellProvider>
        </SelectedTopicProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return within(screen.getByRole('navigation', { name: '메뉴' }));
}

describe('왼쪽 사이드 메뉴', () => {
  it('주제를 고르기 전: 주제 목록과 공통 메뉴만 보이고, 작업 목록·댓글 게시 목록·[작업]은 숨긴다', () => {
    const nav = renderAt('/');
    expect(nav.getByRole('link', { name: /운명원/ })).toHaveAttribute('href', '/t/1/dashboard');
    expect(nav.getByRole('link', { name: /새 주제/ })).toHaveAttribute('href', '/topics/new');
    expect(nav.queryByRole('link', { name: '작업 목록' })).not.toBeInTheDocument();
    expect(nav.queryByRole('link', { name: '댓글 게시 목록' })).not.toBeInTheDocument();
    expect(nav.getByText(/주제를 고르면 그 주제의 대시보드/)).toBeInTheDocument();
    expect(nav.getByRole('link', { name: /계정 관리/ })).toHaveAttribute('href', '/accounts');
    expect(nav.getByRole('link', { name: '설정' })).toHaveAttribute('href', '/settings');
    expect(screen.queryByRole('button', { name: /작업/ })).not.toBeInTheDocument();
    // 본문: 주제 카드로 고른다
    expect(screen.getByRole('heading', { name: '어느 주제부터 볼까요?' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '주제 카드' })).toBeInTheDocument();
    expect(screen.getByText('로그인이 필요한 계정이 있어요 · 개인계정')).toBeInTheDocument();
  });

  it('주제를 고른 뒤: 그 주제 메뉴가 열리고, 다른 주제를 누르면 보던 화면을 그대로 연다', () => {
    const nav = renderAt('/t/1/drafts');
    const menu = within(nav.getByRole('group', { name: '운명원' }));
    expect(menu.getByRole('link', { name: '대시보드' })).toHaveAttribute('href', '/t/1/dashboard');
    expect(menu.getByRole('link', { name: /작업 목록/ })).toHaveAttribute('aria-current', 'page');
    expect(menu.getByRole('link', { name: '댓글 게시 목록' })).toHaveAttribute('href', '/t/1/logs');
    expect(menu.getByRole('link', { name: '주제 설정' })).toHaveAttribute('href', '/t/1/settings');
    expect(nav.getByRole('link', { name: /나는솔로/ })).toHaveAttribute('href', '/t/2/drafts');
    expect(nav.getByRole('link', { name: /^운명원/ })).toHaveAttribute('aria-current', 'true');
    // 위쪽 막대: 지금 위치와 고른 주제의 [작업 7]
    const crumb = within(screen.getByRole('navigation', { name: '지금 위치' }));
    expect(crumb.getByRole('link', { name: '운명원' })).toHaveAttribute('href', '/t/1/dashboard');
    expect(crumb.getByText('작업 목록')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /작업/ })).toHaveTextContent('작업7');
  });

  it('공통 화면(계정 관리)으로 옮겨도 마지막에 고른 주제 메뉴는 남는다', () => {
    const nav = renderAt('/accounts', 2);
    expect(nav.getByRole('group', { name: '나는솔로' })).toBeInTheDocument();
    expect(nav.getByRole('link', { name: /계정 관리/ })).toHaveAttribute('aria-current', 'page');
  });

  it('앱을 처음 열면 마지막에 고른 주제의 대시보드로 이어 간다', () => {
    renderAt('/', 2);
    expect(screen.getByRole('status', { name: '지금 주소' })).toHaveTextContent('/t/2/dashboard');
  });

  it('기억한 주제가 지워졌으면 홈에 머문다', () => {
    renderAt('/', 9);
    expect(screen.getByRole('status', { name: '지금 주소' })).toHaveTextContent('/');
    expect(screen.getByRole('heading', { name: '어느 주제부터 볼까요?' })).toBeInTheDocument();
  });

  it('예전 주소(/?topic=)는 새 주소로 넘긴다', () => {
    renderAt('/?topic=1&video=9');
    expect(screen.getByRole('status', { name: '지금 주소' })).toHaveTextContent('/t/1/dashboard');
  });
});
