import { createContext, useContext } from 'react';
import type { LiveEvent } from '../live/apply-event';

/** 작업 하나 (주제·영상) */
export interface TaskRef {
  /** 주제 ID */
  topicId: number;
  /** 영상 ID */
  videoId: number;
}

/** 브라우저 알림 상태 */
export interface BrowserNotify {
  /** 이 브라우저가 알림을 지원하는지 */
  supported: boolean;
  /** 켜져 있는지 (허락 + 켜기) */
  on: boolean;
  /** 브라우저 설정에서 막혔는지 */
  denied: boolean;
  /** 켜기 (처음이면 허락을 묻는다) */
  enable: () => void;
  /** 끄기 */
  disable: () => void;
}

/** 전역 작업 패널·알림이 함께 쓰는 값 */
export interface TaskShellValue {
  /** 작업 패널이 열려 있는지 */
  panelOpen: boolean;
  /** 패널 열기·닫기 */
  togglePanel: () => void;
  /** 작업 상세 열기 (어느 화면에서나) */
  openTask: (task: TaskRef) => void;
  /** 실시간 이벤트 받기 (알림으로 바꾼다) */
  onLiveEvent: (e: LiveEvent) => void;
  /** 브라우저 알림 */
  browserNotify: BrowserNotify;
}

export const TaskShellContext = createContext<TaskShellValue | null>(null);

/** 전역 작업 패널·알림 값 (TaskShellProvider 안에서만) */
export function useTaskShell(): TaskShellValue {
  const v = useContext(TaskShellContext);
  if (!v) throw new Error('TaskShellProvider 안에서만 쓸 수 있어요');
  return v;
}

