import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router';
import { SideNav } from './components/SideNav';
import { EmptyBox } from './components/StateBox';
import { TaskPanel, TaskShellProvider } from './components/TaskShell';
import { useTaskShell } from './components/task-shell-context';
import { TopBar } from './components/TopBar';
import { useLiveEvents } from './live/useLiveEvents';
import { COMMON_MENU, TOPIC_MENU } from './menu';
import { legacyPath, paths } from './nav/paths';
import { useScrollMemory } from './nav/scroll-memory';
import { useSelectedTopic } from './nav/selected-topic';
import { SelectedTopicProvider } from './nav/SelectedTopicProvider';
import { HomePage } from './pages/HomePage';
import { TaskDetailPage } from './pages/TaskDetailPage';
import { TopicFormPage } from './pages/TopicFormPage';
import { TopicLayout } from './pages/TopicLayout';

/**
 * 데이터 캐시. 실시간 이벤트가 최신으로 맞춰 주므로 창을 다시 볼 때마다 읽지 않는다.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
  },
});

/** 예전 주소(/drafts?topic=…, /logs?topic=…, /topics/:id/edit)를 새 주소로 넘긴다 */
function LegacyRedirect() {
  const { pathname, search } = useLocation();
  return <Navigate to={legacyPath(pathname, search) ?? paths.home} replace />;
}

/**
 * 좁은 화면에서 사이드 메뉴를 덮개로 여닫는다. 다른 화면으로 옮기면 닫는다.
 */
function useNavDrawer() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(pathname);
  // 화면을 옮기면 닫는다 (그리는 중에 맞추는 파생 상태)
  if (open && openedAt !== pathname) setOpen(false);
  const show = useCallback(() => {
    setOpenedAt(pathname);
    setOpen(true);
  }, [pathname]);
  const close = useCallback(() => setOpen(false), []);
  return { open, show, close };
}

/** 화면 틀: 왼쪽 사이드 메뉴 · 위쪽 막대 · 본문 · 오른쪽 작업 패널. 화면 주소는 menu.tsx 목록에서 만든다 */
function Routed() {
  const shell = useTaskShell();
  const { topic } = useSelectedTopic();
  const nav = useNavDrawer();
  // 작업 상세는 맨 위에서, 목록으로 돌아오면 보던 곳에서 (RD-29)
  useScrollMemory();
  // 모든 주제의 이벤트를 받아 데이터를 맞추고, 끝난 초안·게시는 알림으로 띄운다 (알림은 모든 주제)
  const live = useLiveEvents(null, shell.onLiveEvent);
  // 작업 패널은 고른 주제만 보여 준다. 주제를 고르기 전에는 열지 않는다
  const panel = shell.panelOpen && !!topic;

  // 덮개 메뉴가 열려 있으면 뒤 화면이 스크롤되지 않게 한다
  useEffect(() => {
    if (!nav.open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [nav.open]);

  return (
    <div className="rd-app">
      <SideNav open={nav.open} onClose={nav.close} />
      <div className="rd-app-body">
        <TopBar live={live} navOpen={nav.open} onOpenNav={nav.show} />
        <div className={`rd-shell${panel ? ' has-panel' : ''}`}>
          <main className="rd-main">
            <Routes>
              <Route path={paths.home} element={<HomePage />} />
              <Route path={paths.newTopic} element={<TopicFormPage />} />
              <Route path="/t/:topicId" element={<TopicLayout />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                {TOPIC_MENU.map((m) => (
                  <Route key={m.section} path={m.section} element={m.page} />
                ))}
                {/* 작업 상세 (영상 하나): 영상 목록·작업 목록·작업 패널·알림이 여기로 온다 */}
                <Route path="videos/:videoId" element={<TaskDetailPage />} />
              </Route>
              {COMMON_MENU.map((m) => (
                <Route key={m.path} path={m.path} element={m.page} />
              ))}
              {/* 예전 주소 (RD-25 전) */}
              <Route path="/drafts" element={<LegacyRedirect />} />
              <Route path="/logs" element={<LegacyRedirect />} />
              <Route path="/topics/:id/edit" element={<LegacyRedirect />} />
              <Route
                path="*"
                element={
                  <div className="rd-page">
                    <EmptyBox>
                      없는 화면이에요 · 왼쪽 메뉴에서 고르거나 <Link to={paths.home}>주제 고르기로 가기</Link>
                    </EmptyBox>
                  </div>
                }
              />
            </Routes>
          </main>
          {/* 어느 화면으로 옮겨도 열린 채로 남는다 */}
          {panel && topic ? <TaskPanel topic={topic} /> : null}
        </div>
      </div>
    </div>
  );
}

/** 앱 */
export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <SelectedTopicProvider>
          <TaskShellProvider>
            <Routed />
          </TaskShellProvider>
        </SelectedTopicProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
