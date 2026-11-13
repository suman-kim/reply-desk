import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Link, Route, Routes } from 'react-router';
import { EmptyBox } from './components/StateBox';
import { useLiveEvents } from './live/useLiveEvents';
import { AccountsPage } from './pages/AccountsPage';
import { DashboardPage } from './pages/DashboardPage';
import { DraftsPage } from './pages/DraftsPage';
import { SettingsPage } from './pages/SettingsPage';
import { TopicFormPage } from './pages/TopicFormPage';

/**
 * 데이터 캐시. 실시간 이벤트가 최신으로 맞춰 주므로 창을 다시 볼 때마다 읽지 않는다.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
  },
});

/** 화면 이동과 실시간 연결 */
function Routed() {
  const live = useLiveEvents(null);
  return (
    <Routes>
      <Route path="/" element={<DashboardPage live={live} />} />
      <Route path="/drafts" element={<DraftsPage />} />
      <Route path="/accounts" element={<AccountsPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/topics/new" element={<TopicFormPage />} />
      <Route path="/topics/:id/edit" element={<TopicFormPage />} />
      <Route
        path="*"
        element={
          <div className="rd-page">
            <EmptyBox>
              없는 화면이에요 · <Link to="/">대시보드로 가기</Link>
            </EmptyBox>
          </div>
        }
      />
    </Routes>
  );
}

/** 앱 */
export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routed />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
