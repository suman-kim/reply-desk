import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { TagInput } from './TagInput';

/** 목록 상태를 가진 채로 그린다 */
function Harness({ start = [] as string[] }) {
  const [values, setValues] = useState(start);
  return <TagInput label="검색 키워드" values={values} onChange={setValues} max={3} maxLength={10} emptyText="아직 키워드가 없어요" />;
}

/** 입력 칸 */
const input = () => screen.getByRole('textbox');

describe('TagInput (검색 키워드 배지)', () => {
  it('Enter로 하나씩 배지로 넣고, ×로 뺀다', () => {
    render(<Harness />);
    expect(screen.getByText('아직 키워드가 없어요')).toBeInTheDocument();
    fireEvent.change(input(), { target: { value: ' 연애 ' } });
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(screen.getByText('연애')).toBeInTheDocument();
    expect(input()).toHaveValue('');

    fireEvent.click(screen.getByRole('button', { name: '연애 빼기' }));
    expect(screen.queryByText('연애')).not.toBeInTheDocument();
  });

  it('[추가] 버튼으로도 넣는다', () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: '썸' } });
    fireEvent.click(screen.getByRole('button', { name: '추가' }));
    expect(screen.getByText('썸')).toBeInTheDocument();
  });

  it('한글 조합 중 Enter는 넣지 않는다', () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: '재회' } });
    fireEvent.keyDown(input(), { key: 'Enter', isComposing: true });
    expect(screen.queryByRole('button', { name: '재회 빼기' })).not.toBeInTheDocument();
  });

  it('쉼표·중복·개수 초과는 넣지 않고 이유를 보인다', () => {
    render(<Harness start={['연애', '썸', '재회']} />);
    fireEvent.change(input(), { target: { value: '이별, 고백' } });
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(screen.getByText('쉼표 없이 한 개씩 넣어 주세요')).toBeInTheDocument();

    fireEvent.change(input(), { target: { value: '연애' } });
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(screen.getByText("'연애'은(는) 이미 있어요")).toBeInTheDocument();

    fireEvent.change(input(), { target: { value: '이별' } });
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(screen.getByText('3개까지 넣을 수 있어요')).toBeInTheDocument();
    expect(screen.queryByText('이별')).not.toBeInTheDocument();
  });
});
