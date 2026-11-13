import { toApiError } from './http';

describe('서버 오류 해석', () => {
  it('검증 실패는 필드별로 나누고, 화면 문구에서는 필드 이름을 뗀다', () => {
    const e = toApiError(400, { message: ['name: 주제 이름을 적어 주세요', 'minLength: 최소 글자 수가 최대 글자 수보다 클 수 없어요'] });
    expect(e.fieldErrors).toEqual({ name: '주제 이름을 적어 주세요', minLength: '최소 글자 수가 최대 글자 수보다 클 수 없어요' });
    expect(e.message).toBe('주제 이름을 적어 주세요\n최소 글자 수가 최대 글자 수보다 클 수 없어요');
  });

  it('차단 사유 코드를 남긴다', () => {
    const e = toApiError(409, { code: 'already_commented', message: '이미 댓글을 단 영상이에요 · 영상당 1개만 달 수 있어요' });
    expect(e.code).toBe('already_commented');
    expect(e.status).toBe(409);
  });

  it('서버에 못 닿으면 할 일을 알려 준다', () => {
    expect(toApiError(0, null).message).toContain('npm run start:dev');
  });
});
