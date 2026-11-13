import type { ReactNode } from 'react';
import { NeedLoginCount, PendingDraftsCount } from './components/MenuCounts';
import { AccountsPage } from './pages/AccountsPage';
import { DashboardPage } from './pages/DashboardPage';
import { DraftsPage } from './pages/DraftsPage';
import { LogsPage } from './pages/LogsPage';
import { SettingsPage } from './pages/SettingsPage';
import { TopicFormPage } from './pages/TopicFormPage';

/**
 * 메뉴 목록 (레지스트리). 위쪽 메뉴 탭과 화면 주소가 모두 여기서 만들어진다.
 * 새 메뉴는 항목 하나를 더하면 된다. 예: 초안 예약 생성 화면
 *   { path: '/schedules', label: '예약', page: <SchedulesPage />, Count: ScheduleCount }
 */
export interface MenuItem {
  /** 주소 */
  path: string;
  /** 탭 이름 */
  label: string;
  /** 화면 */
  page: ReactNode;
  /** 이 메뉴에 속하는 다른 화면 (탭은 이 메뉴가 켜진다) */
  subPages?: { path: string; page: ReactNode }[];
  /** 탭 옆 숫자 (게시 대기 수 등). 0이면 숨긴다 */
  Count?: () => ReactNode;
}

/** 메뉴 (탭 순서) */
export const MENU: MenuItem[] = [
  {
    path: '/',
    label: '대시보드',
    page: <DashboardPage />,
    subPages: [
      { path: '/topics/new', page: <TopicFormPage /> },
      { path: '/topics/:id/edit', page: <TopicFormPage /> },
    ],
  },
  { path: '/drafts', label: '초안 목록', page: <DraftsPage />, Count: PendingDraftsCount },
  { path: '/logs', label: '게시 기록', page: <LogsPage /> },
  { path: '/accounts', label: '계정 관리', page: <AccountsPage />, Count: NeedLoginCount },
  { path: '/settings', label: '설정', page: <SettingsPage /> },
];

/**
 * 주소가 어느 메뉴에 속하는지 (하위 화면이면 그 메뉴)
 * @param pathname 지금 주소
 */
export function menuOf(pathname: string): MenuItem | undefined {
  const toRegex = (p: string) => new RegExp(`^${p.replace(/:[^/]+/g, '[^/]+')}/?$`);
  return MENU.find((m) => toRegex(m.path).test(pathname) || m.subPages?.some((s) => toRegex(s.path).test(pathname)));
}
