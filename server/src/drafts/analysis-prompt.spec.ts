import {
  buildAnalysisPrompt,
  fillPlaceholders,
  formatTime,
  relativeTime,
  verifyKeywords,
  verifyScenes,
  type AnalysisSources,
} from './analysis-prompt.js';

const src: AnalysisSources = {
  description:
    '썸 단계에서 답장이 늦어지는 이유를 정리했어요. 확신이 없어서 그래요.',
  comments: [
    '읽씹 3일째인데 이거 보고 위로받고 갑니다',
    '저도 딱 그 상태예요ㅠ',
  ],
  durationSec: 768,
  watchedVideo: false,
};

describe('verifyScenes (인용 대조는 코드)', () => {
  it('원문에 있는 인용만 남긴다', () => {
    const { kept, dropped } = verifyScenes(
      [
        {
          time: null,
          quote: '읽씹 3일째인데 이거 보고 위로받고 갑니다',
          source: 'comment',
        },
        { time: null, quote: '지어낸 댓글이에요', source: 'comment' },
        { time: '04:12', quote: '확신이 없어서 그래요', source: 'video' },
        { time: '04:12', quote: '영상에 없는 말', source: 'video' },
      ],
      src,
    );
    expect(kept.map((k) => k.quote)).toEqual([
      '읽씹 3일째인데 이거 보고 위로받고 갑니다',
      '확신이 없어서 그래요',
    ]);
    expect(dropped).toBe(2);
  });

  it('띄어쓰기·문장부호·따옴표·말줄임이 달라도 같은 말로 본다', () => {
    const { kept } = verifyScenes(
      [
        {
          time: null,
          quote: '“읽씹 3일째인데, 이거 보고…”',
          source: 'comment',
        },
      ],
      src,
    );
    expect(kept).toHaveLength(1);
  });

  it('영상을 직접 본 AI의 영상 인용은 그대로 두고, 시점은 형식과 길이를 본다', () => {
    const watched = { ...src, watchedVideo: true };
    const { kept } = verifyScenes(
      [
        {
          time: '4:12',
          quote: '답장이 늦어지는 건 관심이 식어서가 아니라',
          source: 'video',
        },
        { time: '99:00', quote: '영상 길이를 넘는 시점', source: 'video' },
        { time: '네시', quote: '형식이 틀린 시점', source: 'video' },
      ],
      watched,
    );
    expect(kept.map((k) => k.time)).toEqual(['04:12', null, null]);
  });

  it('댓글 인용에는 시점을 붙이지 않는다', () => {
    const { kept } = verifyScenes(
      [{ time: '01:00', quote: '저도 딱 그 상태예요', source: 'comment' }],
      src,
    );
    expect(kept[0].time).toBeNull();
  });
});

describe('verifyKeywords', () => {
  it('인용에 실제로 있는 단어만 남긴다', () => {
    const scenes = [
      {
        time: null,
        quote: '읽씹 3일째인데 위로받고 갑니다',
        source: 'comment' as const,
      },
    ];
    expect(verifyKeywords(['읽씹', '확신', ' 위로 ', '읽씹'], scenes)).toEqual([
      '읽씹',
      '위로',
    ]);
  });
});

describe('fillPlaceholders (숫자는 코드)', () => {
  it('자리 표시를 코드 값으로 채운다', () => {
    const now = new Date('2026-11-13T12:00:00Z');
    const reasons = fillPlaceholders(
      [
        '{올린때} 올라와 조회수가 빠르게 오르는 중 ({조회수})',
        '{채널}의 사연형 댓글',
      ],
      {
        viewCount: 2340,
        publishedAt: new Date('2026-11-13T09:00:00Z'),
        channelTitle: '연애심리연구소 하루',
      },
      now,
    );
    expect(reasons).toEqual([
      '3시간 전 올라와 조회수가 빠르게 오르는 중 (2,340회)',
      '연애심리연구소 하루의 사연형 댓글',
    ]);
  });

  it('올린 때를 사람 말로 쓴다', () => {
    const now = new Date('2026-11-13T12:00:00Z');
    expect(relativeTime(new Date('2026-11-13T11:59:30Z'), now)).toBe('1분 전');
    expect(relativeTime(new Date('2026-11-12T10:00:00Z'), now)).toBe('어제');
    expect(relativeTime(new Date('2026-11-10T12:00:00Z'), now)).toBe('3일 전');
  });

  it('영상 길이를 m:ss로', () => {
    expect(formatTime(768)).toBe('12:48');
    expect(formatTime(3723)).toBe('1:02:03');
  });
});

describe('buildAnalysisPrompt', () => {
  const topic = {
    brandTarget: '운명원 · 연애 사주 잘 보는 곳',
    keywords: ['연애', '썸'],
  };
  const video = {
    title: '썸 탈 때 연락 텀',
    channelTitle: '하루',
    durationSec: 768,
  };
  const ctx = {
    description: '설명',
    comments: [{ text: '댓글\n둘째 줄', likeCount: 3 }],
  };

  it('영상을 볼 수 없는 AI에게는 설명·댓글만 근거로 쓰라고 한다', () => {
    const p = buildAnalysisPrompt(topic, video, ctx, false);
    expect(p).toContain('영상은 볼 수 없어');
    expect(p).toContain('1. 댓글 둘째 줄');
    expect(p).toContain('[영상 길이] 12:48');
  });

  it('영상을 보는 AI에게는 시점과 함께 인용하라고 한다', () => {
    expect(buildAnalysisPrompt(topic, video, ctx, true)).toContain(
      '시점(mm:ss)과 함께 인용',
    );
  });
});
