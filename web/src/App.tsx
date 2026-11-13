import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Link, Route, Routes } from 'react-router';
import { AppNav } from './components/AppNav';
import { EmptyBox } from './components/StateBox';
import { useLiveEvents } from './live/useLiveEvents';
import { MENU } from './menu';

/**
 * 데이터 캐시. 실시간 이벤트가 최신으로 맞춰 주므로 창을 다시 볼 때마다 읽지 않는다.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
  },
});

/** 메뉴 · 화면 이동 · 실시간 연결. 화면 주소는 menu.tsx 목록에서 만든다 */
function Routed() {
  const live = useLiveEvents(null);
  return (
    <>
      <AppNav live={live} />
      <Routes>
        {MENU.flatMap((m) => [
          <Route key={m.path} path={m.path} element={m.page} />,
          ...(m.subPages ?? []).map((s) => <Route key={s.path} path={s.path} element={s.page} />),
        ])}
        <Route
          path="*"
          element={
            <div className="rd-page">
              <EmptyBox>
                없는 화면이에요 · 위쪽 메뉴에서 고르거나 <Link to="/">대시보드로 가기</Link>
              </EmptyBox>
            </div>
          }
        />
      </Routes>
    </>
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
