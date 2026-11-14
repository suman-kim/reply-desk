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
