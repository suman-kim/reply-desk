import { legacyPath, paths, resumeTopic, sectionFromPath, topicFromPath } from './paths';

describe('화면 주소', () => {
  it('고른 주제 화면 주소를 만든다 (빈 값은 붙이지 않는다)', () => {
    expect(paths.topic(3)).toBe('/t/3/dashboard');
    expect(paths.topic(3, 'drafts', { video: 9 })).toBe('/t/3/drafts?video=9');
    expect(paths.topic(3, 'logs', { video: null, step: '' })).toBe('/t/3/logs');
  });

  it('주소에서 주제를 읽는다: 홈은 고르지 않음, 공통 화면은 상관없음', () => {
    expect(topicFromPath('/')).toBe('none');
    expect(topicFromPath('/t/12/drafts')).toBe(12);
    expect(topicFromPath('/t/12')).toBe(12);
    expect(topicFromPath('/accounts')).toBeUndefined();
    expect(topicFromPath('/topics/new')).toBeUndefined();
    expect(topicFromPath('/t/abc/drafts')).toBeUndefined();
  });

  it('주소에서 주제 안의 화면을 읽는다 (모르는 화면은 null)', () => {
    expect(sectionFromPath('/t/1/dashboard')).toBe('dashboard');
    expect(sectionFromPath('/t/1/settings/')).toBe('settings');
    expect(sectionFromPath('/t/1/nothing')).toBeNull();
    expect(sectionFromPath('/settings')).toBeNull();
  });

  it('예전 주소를 새 주소로 바꾼다', () => {
    expect(legacyPath('/', '?topic=3&video=9&step=2')).toBe('/t/3/dashboard?video=9&step=2');
    expect(legacyPath('/', '')).toBeNull();
    expect(legacyPath('/drafts', '?topic=4&video=2014')).toBe('/t/4/drafts?video=2014');
    expect(legacyPath('/drafts', '')).toBe('/');
    expect(legacyPath('/logs/', '?topic=4')).toBe('/t/4/logs');
    expect(legacyPath('/topics/7/edit', '')).toBe('/t/7/settings');
    expect(legacyPath('/accounts', '')).toBeNull();
  });

  it('앱을 처음 열었고 기억한 주제가 아직 있을 때만 그 주제로 이어 간다', () => {
    expect(resumeTopic({ firstEntry: true, lastTopicId: 2, topicIds: [1, 2] })).toBe(2);
    // 앱 안에서 홈으로 온 것 (앱 이름을 누름)
    expect(resumeTopic({ firstEntry: false, lastTopicId: 2, topicIds: [1, 2] })).toBeNull();
    // 지워진 주제
    expect(resumeTopic({ firstEntry: true, lastTopicId: 5, topicIds: [1, 2] })).toBeNull();
    expect(resumeTopic({ firstEntry: true, lastTopicId: null, topicIds: [1, 2] })).toBeNull();
  });
});
