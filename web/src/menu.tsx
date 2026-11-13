import type { ReactNode } from 'react';
import type { Topic } from './api/types';
import type { IconName } from './components/Icon';
import { NeedLoginCount, TopicPendingCount } from './components/MenuCounts';
import { paths, sectionFromPath, type TopicSection } from './nav/paths';
import { AccountsPage } from './pages/AccountsPage';
import { DashboardPage } from './pages/DashboardPage';
import { DraftsPage } from './pages/DraftsPage';
import { LogsPage } from './pages/LogsPage';
import { SettingsPage } from './pages/SettingsPage';
import { TopicFormPage } from './pages/TopicFormPage';

/**
 * 메뉴 목록 (레지스트리). 왼쪽 사이드 메뉴, 위쪽 막대의 '지금 위치', 화면 주소가 모두 여기서 만들어진다.
 * - 고른 주제 메뉴(TOPIC_MENU): 주제를 고른 뒤에만 보인다. 주소는 /t/:topicId/<section>
 * - 공통 메뉴(COMMON_MENU): 늘 보인다
 * 새 메뉴는 항목 하나를 더하면 된다. 예: 주제별 예약 화면
 *   TOPIC_MENU에 { section: 'schedules', label: '예약', icon: 'drafts', page: <SchedulesPage /> } (+ paths.ts의 TopicSection)
 */

/** 고른 주제 메뉴 한 칸 */
export interface TopicMenuItem {
  /** 주소 끝 (/t/:topicId/<section>) */
  section: TopicSection;
  /** 메뉴 이름 */
  label: string;
  /** 사이드 메뉴를 접었을 때 보이는 아이콘 */
  icon: IconName;
  /** 화면 */
  page: ReactNode;
  /** 메뉴 옆 숫자 (그 주제의 게시 대기 수 등). 0이면 숨긴다 */
  Count?: (props: { topic: Topic }) => ReactNode;
}

/** 공통 메뉴 한 칸 */
export interface CommonMenuItem {
  /** 주소 */
  path: string;
  /** 메뉴 이름 */
  label: string;
  /** 사이드 메뉴를 접었을 때 보이는 아이콘 */
  icon: IconName;
  /** 화면 */
  page: ReactNode;
  /** 메뉴 옆 숫자 (로그인이 필요한 계정 수 등). 0이면 숨긴다 */
  Count?: () => ReactNode;
}

/** 고른 주제 메뉴 (사이드 메뉴 순서) */
export const TOPIC_MENU: TopicMenuItem[] = [
  { section: 'dashboard', label: '대시보드', icon: 'dashboard', page: <DashboardPage /> },
  { section: 'drafts', label: '작업 목록', icon: 'drafts', page: <DraftsPage />, Count: TopicPendingCount },
  { section: 'logs', label: '댓글 게시 목록', icon: 'logs', page: <LogsPage /> },
  { section: 'settings', label: '주제 설정', icon: 'topicSettings', page: <TopicFormPage /> },
];

/** 공통 메뉴 (사이드 메뉴 순서) */
export const COMMON_MENU: CommonMenuItem[] = [
  { path: paths.accounts, label: '계정 관리', icon: 'accounts', page: <AccountsPage />, Count: NeedLoginCount },
  { path: paths.settings, label: '설정', icon: 'settings', page: <SettingsPage /> },
];

/** 지금 위치 (위쪽 막대) */
export interface Place {
  /** 화면 이름 */
  label: string;
  /** 고른 주제 안의 화면이면 그 화면 (주제 이름을 앞에 붙인다) */
  section: TopicSection | null;
}

/**
 * 주소가 어느 화면인지 (위쪽 막대 '지금 위치')
 * @param pathname 지금 주소
 */
export function placeOf(pathname: string): Place {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === paths.home) return { label: '주제 고르기', section: null };
  if (path === paths.newTopic) return { label: '새 주제 만들기', section: null };
  const section = sectionFromPath(path);
  const topicItem = section ? TOPIC_MENU.find((m) => m.section === section) : undefined;
  if (topicItem) return { label: topicItem.label, section: topicItem.section };
  const common = COMMON_MENU.find((m) => m.path === path);
  return { label: common?.label ?? '없는 화면', section: null };
}
