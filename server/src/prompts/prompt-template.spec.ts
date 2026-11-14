import { z } from 'zod';
import {
  promptText,
  renderTemplate,
  responseFields,
  unknownSlots,
} from './prompt-template.js';

describe('프롬프트 틀', () => {
  it('자리를 채우고, 자리가 모두 빈 줄은 뺀다 (여러 줄 값도 그대로)', () => {
    const t =
      '[제목] {{영상 제목}}\n[금지] {{금지 표현}}\n[장면]\n{{근거 장면}}\n끝';
    expect(
      renderTemplate(t, {
        '영상 제목': '썸 연락',
        '금지 표현': '',
        '근거 장면': '- a\n- b',
      }),
    ).toBe('[제목] 썸 연락\n[장면]\n- a\n- b\n끝');
  });

  it('AI용 한 겹 괄호 {조회수}는 건드리지 않는다', () => {
    expect(renderTemplate('{조회수} · {{채널}}', { 채널: 'ch' })).toBe(
      '{조회수} · ch',
    );
  });

  it('모르는 자리를 찾아 저장을 막는다', () => {
    const vars = [{ name: '영상 제목', help: '' }];
    expect(unknownSlots('{{영상 제목}} {{영상제목}}', vars)).toEqual([
      '영상제목',
    ]);
    const r = promptText('자료 틀', vars).safeParse(
      '{{영상제목}} 을 보고 써 줘',
    );
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toContain('{{영상제목}}');
  });

  it('답의 모양에서 칸 이름과 설명을 뽑는다 (배열 속 칸 포함)', () => {
    const schema = z.object({
      worry: z.string().describe('고민'),
      scenes: z
        .array(z.object({ quote: z.string().describe('인용') }))
        .describe('장면'),
    });
    expect(responseFields(schema)).toEqual([
      { name: 'worry', description: '고민' },
      { name: 'scenes', description: '장면' },
      { name: 'scenes.quote', description: '인용' },
    ]);
  });
});

describe('예시 보기 조각', () => {
  it('채운 값은 자리 이름과 함께, 틀의 글은 이어 붙여 돌려준다 (빈 자리 줄은 뺀다)', async () => {
    const { renderTemplateParts } = await import('./prompt-template.js');
    expect(
      renderTemplateParts('[제목] {{영상 제목}}\n[금지] {{금지 표현}}\n끝', {
        '영상 제목': '썸',
        '금지 표현': '',
      }),
    ).toEqual([
      { text: '[제목] ', slot: null },
      { text: '썸', slot: '영상 제목' },
      { text: '\n끝', slot: null },
    ]);
  });

  it('작성 예시: 주제가 없으면 예시 주제, 다시 쓸 때 글도 채운다', async () => {
    const { previewPrompt } = await import('./prompt-preview.js');
    const { DEFAULT_DRAFT_PROMPT } = await import('../drafts/draft-prompt.js');
    const p = previewPrompt(
      'prompt.drafting',
      DEFAULT_DRAFT_PROMPT,
      null,
      false,
    );
    expect(p.basis.topicName).toContain('예시');
    expect(
      p.user.some((x) => x.slot === '근거 장면' && x.text.includes('04:12')),
    ).toBe(true);
    expect(
      p.retry?.some((x) => x.slot === '고칠 점' && x.text.includes('길이')),
    ).toBe(true);
  });
});
