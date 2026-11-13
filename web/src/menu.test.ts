import { MENU, menuOf } from './menu';

describe('메뉴 목록', () => {
  it('주소마다 켜질 탭을 찾는다 (하위 화면은 그 메뉴)', () => {
    expect(menuOf('/')?.label).toBe('대시보드');
    expect(menuOf('/topics/new')?.label).toBe('대시보드');
    expect(menuOf('/topics/12/edit')?.label).toBe('대시보드');
    expect(menuOf('/drafts')?.label).toBe('작업 목록');
    expect(menuOf('/logs')?.label).toBe('댓글 게시 목록');
    expect(menuOf('/settings/')?.label).toBe('설정');
    expect(menuOf('/nothing')).toBeUndefined();
  });

  it('주소가 겹치지 않는다', () => {
    const paths = MENU.flatMap((m) => [m.path, ...(m.subPages ?? []).map((s) => s.path)]);
    expect(new Set(paths).size).toBe(paths.length);
  });
});
