import { parseIsoDuration, parseYoutubeVideoId } from './youtube-parsers.js';

describe('parseYoutubeVideoId', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s', 'dQw4w9WgXcQ'],
    ['https://m.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?si=abc', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['youtube.com/live/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['  dQw4w9WgXcQ  ', 'dQw4w9WgXcQ'],
  ])('%s → %s', (input, id) => {
    expect(parseYoutubeVideoId(input)).toBe(id);
  });

  it.each([
    'https://example.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com/channel/UC123',
    '안녕하세요',
    'https://youtu.be/short',
  ])('알아볼 수 없으면 null: %s', (input) => {
    expect(parseYoutubeVideoId(input)).toBeNull();
  });
});

describe('parseIsoDuration', () => {
  it.each([
    ['PT12M48S', 768],
    ['PT1H2M3S', 3723],
    ['PT45S', 45],
    ['P1DT1S', 86401],
    ['', 0],
  ])('%s → %i초', (iso, sec) => {
    expect(parseIsoDuration(iso)).toBe(sec);
  });
});
