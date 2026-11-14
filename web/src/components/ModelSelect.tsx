import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { AiModelList } from '../api/types';
import { Badge } from '../ds/inyeon';

/** 고를 수 있는 모델 하나 */
type ModelItem = AiModelList['models'][number];

/** "직접 입력"을 뜻하는 값 */
export const CUSTOM_MODEL = '__custom__';

/**
 * 달러 가격 (0.75 → $0.75, 10 → $10)
 * @param n 100만 토큰당 가격
 */
function usd(n: number): string {
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 3 })}`;
}

/**
 * 가격 한 줄
 * @param m 모델
 */
function priceLine(m: ModelItem): string {
  if (!m.pricing) return '가격 정보 없음 · 공식 가격표를 확인해 주세요';
  if (m.pricing.inputPerM === 0 && m.pricing.outputPerM === 0) return '요금 없음';
  return `입력 ${usd(m.pricing.inputPerM)} · 출력 ${usd(m.pricing.outputPerM)} / 100만 토큰`;
}

/**
 * 모델 고르기 (꾸민 목록 상자). 모델마다 이름·ID, 무료·추천 배지, 한 줄 설명, 가격, 알아 둘 것을 보인다.
 * 키보드: 열기 ↓·Enter·Space, 옮기기 ↑↓·Home·End, 고르기 Enter, 닫기 Esc·Tab. 바깥을 누르면 닫힌다.
 * @param props.id 버튼 id (라벨 연결)
 * @param props.models 모델 목록
 * @param props.value 고른 모델 ID
 * @param props.custom 직접 입력 중인지
 * @param props.disabled 고를 수 없는지 (목록을 받는 중)
 * @param props.placeholder 고른 것이 없을 때 보일 말
 * @param props.invalid 저장 오류가 있는지
 * @param props.pricingSource 가격표 출처와 확인한 날
 * @param props.onPick 모델을 고를 때 (직접 입력이면 CUSTOM_MODEL)
 */
export function ModelSelect({
  id,
  models,
  value,
  custom,
  disabled,
  placeholder,
  invalid,
  pricingSource,
  onPick,
}: {
  id: string;
  models: ModelItem[];
  value: string;
  custom: boolean;
  disabled?: boolean;
  placeholder: string;
  invalid?: boolean;
  pricingSource: AiModelList['pricingSource'];
  onPick: (value: string) => void;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  /** 목록 항목 값 (마지막은 직접 입력) */
  const values = [...models.map((m) => m.id), CUSTOM_MODEL];
  const selected = models.find((m) => m.id === value);

  // 바깥을 누르면 닫는다
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // 고른 항목이 보이게 굴린다
  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  /** 연다 (지금 고른 것에 초점) */
  const openList = () => {
    const i = values.indexOf(custom ? CUSTOM_MODEL : value);
    setActive(i >= 0 ? i : 0);
    setOpen(true);
    requestAnimationFrame(() => list.current?.focus());
  };

  /**
   * 고르고 닫는다
   * @param v 고른 값
   */
  const pick = (v: string) => {
    onPick(v);
    setOpen(false);
    button.current?.focus();
  };

  const onListKey = (e: KeyboardEvent<HTMLUListElement>) => {
    const last = values.length - 1;
    if (e.key === 'ArrowDown') setActive((i) => Math.min(last, i + 1));
    else if (e.key === 'ArrowUp') setActive((i) => Math.max(0, i - 1));
    else if (e.key === 'Home') setActive(0);
    else if (e.key === 'End') setActive(last);
    else if (e.key === 'Enter' || e.key === ' ') pick(values[active]);
    else if (e.key === 'Escape') {
      setOpen(false);
      button.current?.focus();
    } else if (e.key === 'Tab') setOpen(false);
    else return;
    e.preventDefault();
  };

  return (
    <div className="rd-ms" ref={root}>
      <button
        ref={button}
        id={id}
        type="button"
        className="iy-input rd-select rd-ms-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(e) => {
          if (['ArrowDown', 'Enter', ' '].includes(e.key)) {
            e.preventDefault();
            openList();
          }
        }}
      >
        {custom ? (
          <span>직접 입력…</span>
        ) : selected ? (
          <span className="rd-ms-current">
            <span className="rd-ms-name">{selected.label}</span>
            {selected.pricing?.free ? <Badge tone="success">무료</Badge> : null}
            <span className="text-caption rd-muted rd-ms-price">{priceLine(selected)}</span>
          </span>
        ) : (
          <span className="rd-muted">{value || placeholder}</span>
        )}
      </button>

      {open ? (
        <div className="rd-ms-pop">
          <ul
            ref={list}
            id={listId}
            role="listbox"
            tabIndex={-1}
            aria-labelledby={id}
            aria-activedescendant={`${listId}-${active}`}
            className="rd-ms-list"
            onKeyDown={onListKey}
          >
            {models.map((m, i) => (
              <li
                key={m.id}
                id={`${listId}-${i}`}
                data-index={i}
                role="option"
                aria-selected={!custom && m.id === value}
                className={`rd-ms-option${i === active ? ' is-active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(m.id)}
              >
                <div className="rd-ms-row">
                  <span className="rd-ms-name">{m.label}</span>
                  {m.label !== m.id ? <span className="text-mono rd-ms-id">{m.id}</span> : null}
                  <span className="rd-ms-badges">
                    {m.pricing?.free ? <Badge tone="success">무료</Badge> : null}
                    {m.recommended ? <Badge tone="accent">추천</Badge> : null}
                  </span>
                </div>
                {m.pricing?.summary ? <span className="text-caption rd-ink2">{m.pricing.summary}</span> : null}
                <span className="text-caption rd-muted">{priceLine(m)}</span>
                {m.pricing?.note ? <span className="text-caption rd-ms-note">{m.pricing.note}</span> : null}
              </li>
            ))}
            <li
              id={`${listId}-${models.length}`}
              data-index={models.length}
              role="option"
              aria-selected={custom}
              className={`rd-ms-option${active === models.length ? ' is-active' : ''}`}
              onMouseEnter={() => setActive(models.length)}
              onClick={() => pick(CUSTOM_MODEL)}
            >
              <span className="rd-ms-name">직접 입력…</span>
              <span className="text-caption rd-muted">목록에 없는 모델(새로 나온 모델 등)을 적어요</span>
            </li>
          </ul>
          {pricingSource ? (
            <div className="rd-ms-foot text-caption rd-muted">
              가격은 공식 가격표 기준 ({pricingSource.checkedAt} 확인 · 표준 요금, 짧은 문맥) ·{' '}
              <a href={pricingSource.url} target="_blank" rel="noreferrer">
                가격표 보기
              </a>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
