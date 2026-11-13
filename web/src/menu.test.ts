import { COMMON_MENU, placeOf, TOPIC_MENU } from './menu';
import { TOPIC_SECTIONS } from './nav/paths';
import { resolveTopicId } from './nav/selected-topic';

describe('메뉴 목록', () => {
  it('주소마다 지금 위치 이름을 찾는다', () => {
    expect(placeOf('/')).toEqual({ label: '주제 고르기', section: null });
    expect(placeOf('/topics/new').label).toBe('새 주제 만들기');
    expect(placeOf('/t/3/dashboard')).toEqual({ label: '대시보드', section: 'dashboard' });
    expect(placeOf('/t/3/drafts')).toEqual({ label: '작업 목록', section: 'drafts' });
    expect(placeOf('/t/3/logs').label).toBe('댓글 게시 목록');
    expect(placeOf('/t/3/settings').label).toBe('주제 설정');
    expect(placeOf('/settings/')).toEqual({ label: '설정', section: null });
    expect(placeOf('/accounts').label).toBe('계정 관리');
    expect(placeOf('/nothing').label).toBe('없는 화면');
    expect(placeOf('/t/3/videos/12')).toEqual({ label: '작업 상세', section: 'dashboard', parent: { label: '대시보드', section: 'dashboard' } });
  });

  it('주제 메뉴는 주제 안의 화면을 하나씩 모두 가진다', () => {
    expect(TOPIC_MENU.map((m) => m.section).sort()).toEqual([...TOPIC_SECTIONS].sort());
  });

  it('공통 메뉴 주소가 겹치지 않고 주제 화면(/t/…)과도 겹치지 않는다', () => {
    const paths = COMMON_MENU.map((m) => m.path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths.every((p) => !p.startsWith('/t/'))).toBe(true);
  });
});

describe('고른 주제 정하기', () => {
  it('주제 화면은 그 주제, 홈은 고르지 않음, 공통 화면은 마지막에 고른 주제', () => {
    expect(resolveTopicId(3, 1)).toBe(3);
    expect(resolveTopicId('none', 1)).toBeNull();
    expect(resolveTopicId(undefined, 1)).toBe(1);
    expect(resolveTopicId(undefined, null)).toBeNull();
  });
});
