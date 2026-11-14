import { describe, expect, it } from 'vitest';
import { scrollActionFor, scrollKeyOf } from './scroll-memory';

describe('scrollActionFor (RD-29)', () => {
  it('목록에서 작업 상세로 가면 맨 위에서 시작한다', () => {
    expect(scrollActionFor({ pathname: '/t/3/videos/12', navigationType: 'PUSH', restoreRequested: false })).toBe('top');
    // 작업 상세 안 앞뒤 넘기기 · 예전 주소 넘기기(REPLACE)도 맨 위
    expect(scrollActionFor({ pathname: '/t/3/videos/13', navigationType: 'REPLACE', restoreRequested: false })).toBe('top');
  });

  it('작업 상세의 [영상 목록]·[작업 목록]으로 돌아가면 보던 곳으로 간다', () => {
    expect(scrollActionFor({ pathname: '/t/3/dashboard', navigationType: 'PUSH', restoreRequested: true })).toBe('restore');
    expect(scrollActionFor({ pathname: '/t/3/drafts', navigationType: 'PUSH', restoreRequested: true })).toBe('restore');
  });

  it('브라우저 뒤로 가기도 보던 곳으로 간다', () => {
    expect(scrollActionFor({ pathname: '/t/3/dashboard', navigationType: 'POP', restoreRequested: false })).toBe('restore');
  });

  it('그 밖의 이동(메뉴·정렬 바꾸기)은 건드리지 않는다', () => {
    expect(scrollActionFor({ pathname: '/t/3/dashboard', navigationType: 'PUSH', restoreRequested: false })).toBe('keep');
    expect(scrollActionFor({ pathname: '/t/3/logs', navigationType: 'REPLACE', restoreRequested: false })).toBe('keep');
  });
});

describe('scrollKeyOf', () => {
  it('정렬·거르기·쪽이 다르면 다른 목록으로 기억한다', () => {
    expect(scrollKeyOf({ pathname: '/t/3/dashboard', search: '?sort=new&page=2' })).toBe('/t/3/dashboard?sort=new&page=2');
    expect(scrollKeyOf({ pathname: '/t/3/dashboard', search: '' })).not.toBe(scrollKeyOf({ pathname: '/t/3/dashboard', search: '?page=2' }));
  });
});
