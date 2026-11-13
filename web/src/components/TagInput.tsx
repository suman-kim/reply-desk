import { useState, type KeyboardEvent } from 'react';
import { Badge, Button, Field } from '../ds';

/**
 * 하나씩 넣는 목록 입력 (예: 검색 키워드).
 * 한 개를 적고 Enter나 [추가]를 누르면 아래에 배지로 쌓이고, 배지의 ×로 뺀다.
 * 쉼표로 여러 개를 한 번에 넣지는 않는다(한 칸에 한 개).
 * @param props.label 칸 이름
 * @param props.values 지금 목록
 * @param props.onChange 목록이 바뀔 때 (새 목록)
 * @param props.placeholder 입력 칸 예시
 * @param props.hint 칸 아래 도움말
 * @param props.error 서버가 준 오류 (있으면 도움말 대신 보인다)
 * @param props.max 넣을 수 있는 개수
 * @param props.maxLength 한 개의 최대 글자 수
 * @param props.emptyText 아직 하나도 없을 때 보일 말
 * @param props.hideLabel 칸 이름을 화면에서 숨길지 (옆에 이름이 이미 있을 때. 읽기 프로그램에는 남는다)
 */
export function TagInput({
  label,
  values,
  onChange,
  placeholder,
  hint,
  error,
  max,
  maxLength,
  emptyText,
  hideLabel,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  max: number;
  maxLength: number;
  emptyText: string;
  hideLabel?: boolean;
}) {
  /** 입력 중인 한 개 */
  const [draft, setDraft] = useState('');
  /** 넣지 못한 이유 (중복·쉼표·개수·길이) */
  const [problem, setProblem] = useState<string | null>(null);
  const full = values.length >= max;

  const add = () => {
    const word = draft.trim();
    if (!word) return;
    if (/[,，]/.test(word)) return setProblem('쉼표 없이 한 개씩 넣어 주세요');
    if (word.length > maxLength) return setProblem(`한 개는 ${maxLength}자까지예요`);
    if (values.includes(word)) return setProblem(`'${word}'은(는) 이미 있어요`);
    if (full) return setProblem(`${max}개까지 넣을 수 있어요`);
    onChange([...values, word]);
    setDraft('');
    setProblem(null);
  };

  // 한글 입력 중(조합 중) Enter는 글자를 확정하는 것이라 넣지 않는다 (마지막 글자가 두 번 들어가는 것을 막는다)
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
    if (!(e.target instanceof HTMLInputElement)) return;
    e.preventDefault();
    add();
  };

  return (
    <div className="rd-stack-8" onKeyDown={onKeyDown}>
      <Field
        label={hideLabel ? <span className="dk-sr">{label}</span> : label}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setProblem(null);
        }}
        placeholder={full ? `${max}개를 모두 넣었어요` : placeholder}
        counter={`${values.length}/${max}`}
        counterInvalid={full}
        hint={hint}
        error={problem ?? error}
        action={
          <Button variant="secondary" size="sm" disabled={!draft.trim()} onClick={add}>
            추가
          </Button>
        }
      />
      <div className="rd-tags" aria-label={`${label} 목록`}>
        {values.length === 0 ? <span className="text-caption rd-muted">{emptyText}</span> : null}
        {values.map((v) => (
          <Badge key={v} tone="accent">
            {v}
            <button type="button" className="rd-tag-x" aria-label={`${v} 빼기`} onClick={() => onChange(values.filter((x) => x !== v))}>
              ×
            </button>
          </Badge>
        ))}
      </div>
    </div>
  );
}
