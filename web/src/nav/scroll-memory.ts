import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType, type Location } from 'react-router';
import { videoFromPath } from './paths';

/**
 * 화면을 옮길 때의 스크롤 (RD-29).
 * 이 앱은 창(window) 전체가 스크롤된다. 그대로 두면 목록에서 내려 둔 위치가 작업 상세까지 따라온다.
 * - 작업 상세로 가면 맨 위에서 시작한다 (영상 목록·작업 목록·작업 패널·알림·앞뒤 넘기기 모두)
 * - 작업 상세의 [영상 목록]/[작업 목록]으로 돌아가거나 브라우저 뒤로 가기를 하면 그 목록에서 보던 곳으로 돌아간다
 * - 그 밖의 이동(메뉴, 정렬·거르기 바꾸기)은 지금처럼 스크롤을 건드리지 않는다
 */

/** 화면을 옮긴 뒤 할 일: 맨 위로 · 보던 곳으로 · 그대로 */
export type ScrollAction = 'top' | 'restore' | 'keep';

/** 돌아가는 링크가 넘기는 값: 보던 곳으로 돌아가 달라는 표시 */
export interface RestoreScrollState {
  /** 참이면 그 화면에서 마지막으로 보던 스크롤 위치로 돌아간다 */
  restoreScroll?: boolean;
}

/** 돌아가는 링크(state)에 붙이는 값 */
export const RESTORE_SCROLL: RestoreScrollState = { restoreScroll: true };

/**
 * 화면을 옮긴 뒤 스크롤을 어떻게 할지 정한다. 위에서부터 먼저 맞는 것.
 * @param input.pathname 옮겨 간 주소
 * @param input.navigationType 옮긴 방식 (POP: 뒤로·앞으로·처음 열기, PUSH: 링크, REPLACE: 주소만 바꾸기)
 * @param input.restoreRequested 돌아가는 링크로 왔는지 (state.restoreScroll)
 */
export function scrollActionFor(input: {
  pathname: string;
  navigationType: 'POP' | 'PUSH' | 'REPLACE';
  restoreRequested: boolean;
}): ScrollAction {
  // 브라우저 뒤로·앞으로: 그 화면에서 보던 곳
  if (input.navigationType === 'POP') return 'restore';
  // 작업 상세의 [영상 목록]·[작업 목록]: 누르기 전 보던 곳
  if (input.restoreRequested) return 'restore';
  // 작업 상세는 맨 위(영상 제목)부터
  if (videoFromPath(input.pathname) !== null) return 'top';
  return 'keep';
}

/**
 * 스크롤 위치를 기억하는 열쇠: 주소 + 주소 뒤 값 (정렬·거르기·쪽이 다르면 다른 목록)
 * @param location 화면 위치
 */
export function scrollKeyOf(location: Pick<Location, 'pathname' | 'search'>): string {
  return location.pathname + location.search;
}

/** 목록이 늦게 그려질 때(불러오는 중) 보던 곳까지 내려갈 수 있을 때까지 기다리는 최대 시간 */
const RESTORE_WAIT_MS = 1500;

/**
 * 보던 곳으로 스크롤한다. 목록이 아직 짧으면(불러오는 중) 길어질 때까지 몇 번 더 맞춘다.
 * 사람이 그사이 직접 스크롤하면 그만둔다.
 * @param y 돌아갈 세로 위치 (px)
 * @returns 그만두기 함수
 */
function restoreTo(y: number): () => void {
  let frame = 0;
  const started = performance.now();
  const stop = () => {
    cancelAnimationFrame(frame);
    for (const type of USER_SCROLL_EVENTS) window.removeEventListener(type, stop);
  };
  const tick = () => {
    window.scrollTo(0, y);
    if (Math.abs(window.scrollY - y) <= 1 || performance.now() - started > RESTORE_WAIT_MS) {
      stop();
      return;
    }
    frame = requestAnimationFrame(tick);
  };
  for (const type of USER_SCROLL_EVENTS) window.addEventListener(type, stop, { passive: true });
  tick();
  return stop;
}

/** 사람이 직접 스크롤하는 동작 (보던 곳 맞추기를 그만둔다) */
const USER_SCROLL_EVENTS = ['wheel', 'touchstart', 'keydown', 'mousedown'] as const;

/**
 * 화면을 옮길 때 스크롤을 맞춘다. 화면 틀(App)에서 한 번만 부른다.
 * 화면마다 마지막 스크롤 위치를 기억해 두었다가, 돌아가는 링크나 뒤로 가기로 오면 그곳으로 돌아간다.
 */
export function useScrollMemory(): void {
  const location = useLocation();
  const navigationType = useNavigationType();
  /** 화면(열쇠)마다 마지막 스크롤 위치 */
  const saved = useRef(new Map<string, number>());
  /** 지금 화면의 열쇠 (스크롤할 때마다 이 열쇠에 적는다) */
  const current = useRef(scrollKeyOf(location));

  // 브라우저가 알아서 되돌리지 않게 한다 (이 훅이 정한다)
  useEffect(() => {
    if (!('scrollRestoration' in window.history)) return;
    const before = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = before;
    };
  }, []);

  // 지금 화면의 스크롤 위치를 계속 적어 둔다
  useEffect(() => {
    const onScroll = () => saved.current.set(current.current, window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // 화면을 옮기면 (그리기 직후, 화면에 보이기 전에) 맞춘다
  useLayoutEffect(() => {
    const key = scrollKeyOf(location);
    current.current = key;
    const action = scrollActionFor({
      pathname: location.pathname,
      navigationType,
      restoreRequested: (location.state as RestoreScrollState | null)?.restoreScroll === true,
    });
    if (action === 'top') window.scrollTo(0, 0);
    if (action === 'restore') return restoreTo(saved.current.get(key) ?? 0);
    // 화면이 바뀔 때만 (location.key) 본다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);
}
