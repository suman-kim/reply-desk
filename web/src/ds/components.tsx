import {
  useId,
  type ButtonHTMLAttributes,
  type ChangeEventHandler,
  type CSSProperties,
  type MouseEventHandler,
  type ReactElement,
  type ReactNode,
} from 'react';

/*
 * Desk 부품. 예전 Inyeon과 같은 이름·props를 지켜 화면 코드를 그대로 둔 채 모양만 바꾼다.
 * 새로 더한 부품: Tabs · Chips · Keyword · MatchBar.
 */

/** 상태 뜻 → 색 하나 (neutral 중립 · accent 포인트 · success 성공 · warning 주의 · danger 실패 · info 진행). rose는 accent로 그린다 */
export type Tone = 'neutral' | 'accent' | 'rose' | 'success' | 'danger' | 'warning' | 'info';

function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

const toneClass = (t: Tone | undefined): string => (t === 'rose' ? 'accent' : (t ?? 'neutral'));

/** 작은 선 아이콘 (체크 · 엑스 · 주의 · 재생) */
export function Glyph({ name, size = 14 }: { name: 'check' | 'x' | 'alert' | 'play'; size?: number }): ReactElement {
  if (name === 'play') {
    return (
      <svg className="dk-icon" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
        <path d="M9 7v10l8-5z" />
      </svg>
    );
  }
  return (
    <svg
      className="dk-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {name === 'check' ? <path d="M5 12.5l4.5 4.5L19 7.5" /> : null}
      {name === 'x' ? <path d="M7 7l10 10M17 7 7 17" /> : null}
      {name === 'alert' ? (
        <>
          <path d="M12 4 3 19.5h18z" />
          <path d="M12 10v4M12 16.8h.01" />
        </>
      ) : null}
    </svg>
  );
}

export interface SpinnerProps {
  /** 크기 (px, 기본 16) */
  size?: number;
  /** inverse = 잉크·포인트 바탕 위 */
  tone?: 'default' | 'inverse';
  className?: string;
}
/** 도는 원: 진행 중 */
export function Spinner({ size = 16, tone, className }: SpinnerProps): ReactElement {
  return (
    <span
      className={cx('dk-spinner', tone === 'inverse' && 'dk-spinner-inverse', className)}
      style={{ width: size, height: size, borderWidth: size <= 12 ? 1.5 : 2 }}
      aria-hidden="true"
    />
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary = 바이올렛([댓글 달기]처럼 화면의 단 하나), dark = 잉크(주 동작), secondary = 흰 바탕 테두리(기본), ghost = 글자, dashed = 새로 더하기 */
  variant?: 'primary' | 'dark' | 'secondary' | 'ghost' | 'dashed';
  /** sm 32px · md 40px(기본) · lg 48px */
  size?: 'sm' | 'md' | 'lg';
  /** 도는 원을 보이고 누르지 못하게 한다 */
  loading?: boolean;
  /** 가로 꽉 채우기 */
  fullWidth?: boolean;
  /** 이름 앞 아이콘 */
  leading?: ReactNode;
}
/** 버튼 */
export function Button({ variant = 'secondary', size = 'md', loading, fullWidth, leading, className, children, type, disabled, ...rest }: ButtonProps): ReactElement {
  const onDark = variant === 'primary' || variant === 'dark';
  return (
    <button
      type={type ?? 'button'}
      {...rest}
      className={cx('dk-btn', `dk-btn-${variant}`, `dk-btn-${size}`, fullWidth && 'dk-btn-block', className)}
      disabled={!!(disabled || loading)}
      aria-busy={loading ? 'true' : undefined}
    >
      {loading ? <Spinner size={size === 'sm' ? 14 : 16} tone={onDark ? 'inverse' : undefined} /> : (leading ?? null)}
      <span>{children}</span>
    </button>
  );
}

export interface BadgeProps {
  tone?: Tone;
  /** 앞에 도는 원 (진행 중) */
  loading?: boolean;
  /** 앞에 점 */
  dot?: boolean;
  /** 뜻 모양(성공 체크 · 주의 세모 · 실패 엑스)을 붙일지. 기본 true */
  icon?: boolean;
  children?: ReactNode;
  className?: string;
}
/** 배지: 색만으로 나누지 않게 성공·주의·실패에는 모양을 함께 붙인다 */
export function Badge({ tone, loading, dot, icon = true, children, className }: BadgeProps): ReactElement {
  const t = toneClass(tone);
  let lead: ReactNode = null;
  if (loading) lead = <Spinner size={11} />;
  else if (dot) lead = <span className="dk-badge-dot" aria-hidden="true" />;
  else if (icon && t === 'success') lead = <Glyph name="check" size={12} />;
  else if (icon && t === 'warning') lead = <Glyph name="alert" size={12} />;
  else if (icon && t === 'danger') lead = <Glyph name="x" size={12} />;
  return (
    <span className={cx('dk-badge', `dk-badge-${t}`, className)}>
      {lead}
      {children}
    </span>
  );
}

export interface StatPillProps {
  label: ReactNode;
  value: number;
  /** 있으면 "값 / 최대"와 막대. 다 차면 주의 색 */
  max?: number;
  className?: string;
}
/** 숫자 계기 (오늘 전체 게시 3 / 30) */
export function StatPill({ label, value, max, className }: StatPillProps): ReactElement {
  const m = Number(max) || 0;
  const v = Number(value) || 0;
  const pct = m ? Math.min(100, Math.round((v / m) * 100)) : 0;
  return (
    <span className={cx('dk-stat', m > 0 && v >= m && 'is-full', className)}>
      <span className="dk-stat-label">{label}</span>
      <strong className="dk-stat-value">{m ? `${v} / ${m}` : String(v)}</strong>
      {m ? (
        <span
          className="dk-stat-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={m}
          aria-valuenow={v}
          aria-label={typeof label === 'string' ? label : undefined}
        >
          <span style={{ width: `${pct}%` }} />
        </span>
      ) : null}
    </span>
  );
}

export interface PanelProps {
  /** 단계 번호 (작은 이름표) */
  step?: number | string;
  title?: ReactNode;
  /** 제목 아래 한 줄 */
  hint?: ReactNode;
  /** 머리 오른쪽 */
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}
/** 카드 */
export function Panel({ step, title, hint, actions, children, className, style }: PanelProps): ReactElement {
  const hasHead = !!title || step != null || !!actions;
  return (
    <section className={cx('dk-panel', className)} style={style}>
      {hasHead ? (
        <header className="dk-panel-head">
          <span className="dk-panel-titles">
            {step != null ? <span className="dk-panel-step">{`단계 ${step}`}</span> : null}
            {title ? <h2 className="dk-panel-title">{title}</h2> : null}
            {hint ? <span className="dk-panel-hint">{hint}</span> : null}
          </span>
          {actions ? <span className="dk-panel-actions">{actions}</span> : null}
        </header>
      ) : null}
      <div className="dk-panel-body">{children}</div>
    </section>
  );
}

export interface FieldProps {
  label?: ReactNode;
  id?: string;
  value?: string;
  /** 없으면 value가 처음 값 (제어하지 않음) */
  onChange?: ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>;
  placeholder?: string;
  type?: string;
  multiline?: boolean;
  rows?: number;
  readOnly?: boolean;
  /** 이름 오른쪽 고정폭 글자 (86 / 120자) */
  counter?: ReactNode;
  counterInvalid?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  /** 입력 칸 옆 (추가 버튼) */
  action?: ReactNode;
  className?: string;
}
/** 입력 칸: 이름 · 글자 수 · 안내 · 오류 */
export function Field(p: FieldProps): ReactElement {
  const auto = useId();
  const fid = p.id ?? auto;
  const common = {
    id: fid,
    placeholder: p.placeholder,
    readOnly: p.readOnly,
    'aria-invalid': p.error ? ('true' as const) : undefined,
    ...(p.onChange ? { value: p.value ?? '', onChange: p.onChange } : { defaultValue: p.value }),
  };
  const ctrl = p.multiline ? (
    <textarea {...common} className="dk-input dk-textarea" rows={p.rows ?? 4} />
  ) : (
    <input {...common} className="dk-input" type={p.type ?? 'text'} />
  );
  return (
    <div className={cx('dk-field', p.className)}>
      {p.label || p.counter ? (
        <div className="dk-field-top">
          {p.label ? (
            <label className="dk-field-label" htmlFor={fid}>
              {p.label}
            </label>
          ) : (
            <span />
          )}
          {p.counter ? <span className={cx('dk-field-counter', p.counterInvalid && 'is-bad')}>{p.counter}</span> : null}
        </div>
      ) : null}
      {p.action ? (
        <div className="dk-field-row">
          {ctrl}
          {p.action}
        </div>
      ) : (
        ctrl
      )}
      {p.error ? <span className="dk-field-error">{p.error}</span> : p.hint ? <span className="dk-field-hint">{p.hint}</span> : null}
    </div>
  );
}

export interface SegmentedOption {
  value: string;
  label?: ReactNode;
}
export interface SegmentedProps {
  options: Array<SegmentedOption | string>;
  value?: string;
  onChange?: (value: string) => void;
  /** 묶음 이름 (읽기 프로그램) */
  label?: string;
  /** 가로 꽉 채우기 */
  block?: boolean;
  className?: string;
}
/** 세그먼트: 여럿 중 하나 고르기 */
export function Segmented({ options, value, onChange, label, block, className }: SegmentedProps): ReactElement {
  return (
    <div className={cx('dk-seg', block && 'dk-seg-block', className)} role="group" aria-label={label}>
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value;
        const l = typeof o === 'string' ? o : (o.label ?? o.value);
        const on = v === value;
        return (
          <button key={v} type="button" className={cx('dk-seg-item', on && 'is-on')} aria-pressed={on ? 'true' : 'false'} onClick={() => onChange?.(v)}>
            {l}
          </button>
        );
      })}
    </div>
  );
}

export interface TabItem {
  value: string;
  label: ReactNode;
  /** 이름 옆 숫자 */
  count?: number;
  /** 바뀐 내용이 있다는 점 */
  marked?: boolean;
}
export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  /** 묶음 이름 (읽기 프로그램) */
  label: string;
  /** 탭 내용 영역 id (aria-controls) */
  panelId?: string;
  className?: string;
}
/** 밑줄 탭: 긴 화면을 나눈다 */
export function Tabs({ items, value, onChange, label, panelId, className }: TabsProps): ReactElement {
  return (
    <div className={cx('dk-tabs', className)} role="tablist" aria-label={label}>
      {items.map((t) => {
        const on = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={on}
            aria-controls={panelId}
            className={cx('dk-tab', on && 'is-on')}
            onClick={() => onChange(t.value)}
          >
            {t.label}
            {t.count != null ? <span className="dk-tab-count">{t.count}</span> : null}
            {t.marked ? <span className="dk-tab-mark" aria-label="바뀐 내용 있음" /> : null}
          </button>
        );
      })}
    </div>
  );
}

export interface ChipItem {
  value: string;
  label: ReactNode;
  count?: number;
}
/** 거르기 칩 묶음 (하나 고르기) */
export function Chips({ items, value, onChange, label, className }: { items: ChipItem[]; value: string; onChange: (value: string) => void; label: string; className?: string }): ReactElement {
  return (
    <div className={cx('dk-chips', className)} role="group" aria-label={label}>
      {items.map((c) => {
        const on = c.value === value;
        return (
          <button key={c.value} type="button" className={cx('dk-chip', on && 'is-on')} aria-pressed={on} onClick={() => onChange(c.value)}>
            {c.label}
            {c.count != null ? <span className="dk-chip-count">{c.count.toLocaleString('ko-KR')}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/** 검색어 표시 (주제의 검색어) */
export function Keyword({ children }: { children: ReactNode }): ReactElement {
  return <span className="dk-kw">{children}</span>;
}

/**
 * 매칭 막대: 기준 눈금, 기준 이상 초록 · 미만 노랑
 * @param props.percent 0~100
 * @param props.threshold 기준 (설정 '주제 매칭 기준')
 */
export function MatchBar({ percent, threshold = 50, className }: { percent: number; threshold?: number; className?: string }): ReactElement {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  const low = p < threshold;
  return (
    <span className={cx('dk-match', low && 'is-low', className)} title={`기준 ${threshold}%`}>
      <span className="dk-match-bar" aria-hidden="true">
        <span style={{ width: `${p}%` }} />
        <i style={{ left: `${threshold}%` }} />
      </span>
      <span className="dk-match-value">{p}%</span>
      <span className="dk-sr">{low ? '매칭 낮음' : '매칭됨'}</span>
    </span>
  );
}

export interface VideoBadge {
  tone?: Tone;
  label: ReactNode;
  loading?: boolean;
  /** 앞에 점 (게시 대기) */
  dot?: boolean;
}
export interface VideoCardProps {
  rank?: number | string;
  title: ReactNode;
  channel?: string;
  date?: string;
  views?: ReactNode;
  duration?: string;
  thumbnail?: string;
  tint?: string;
  selected?: boolean;
  badges?: VideoBadge[];
  onClick?: MouseEventHandler<HTMLButtonElement>;
  className?: string;
}
/** 영상 카드 */
export function VideoCard(p: VideoCardProps): ReactElement {
  const thumbStyle: CSSProperties | undefined = p.thumbnail ? { backgroundImage: `url(${p.thumbnail})` } : p.tint ? { background: p.tint } : undefined;
  return (
    <button type="button" className={cx('dk-video', p.selected && 'is-selected', p.className)} aria-pressed={p.selected ? 'true' : 'false'} onClick={p.onClick}>
      {p.rank != null ? <span className="dk-video-rank">{String(p.rank)}</span> : null}
      <span className="dk-video-thumb" style={thumbStyle}>
        {p.thumbnail ? null : <Glyph name="play" size={18} />}
        {p.duration ? <span className="dk-video-dur">{p.duration}</span> : null}
      </span>
      <span className="dk-video-body">
        <span className="dk-video-title">{p.title}</span>
        {p.channel || p.date ? <span className="dk-video-meta">{[p.channel, p.date].filter(Boolean).join(' · ')}</span> : null}
        {p.views ? <span className="dk-video-views">{p.views}</span> : null}
        {p.badges?.length ? (
          <span className="dk-video-badges">
            {p.badges.map((b, i) => (
              <Badge key={i} tone={b.tone} loading={b.loading} dot={b.dot}>
                {b.label}
              </Badge>
            ))}
          </span>
        ) : null}
      </span>
    </button>
  );
}

export interface ReasonBoxProps {
  /** accent = 고른 이유(흰 카드), rose = accent와 같다, neutral = 쓴 이유(회색 면) */
  tone?: 'accent' | 'rose' | 'neutral';
  label?: ReactNode;
  /** 번호 목록 */
  items?: ReactNode[];
  children?: ReactNode;
  /** 끝의 작은 한 줄 */
  note?: ReactNode;
  className?: string;
}
/** 이유 상자 */
export function ReasonBox({ tone = 'neutral', label, items = [], children, note, className }: ReasonBoxProps): ReactElement {
  return (
    <div className={cx('dk-reason', tone !== 'neutral' && 'dk-reason-accent', className)}>
      {label ? <span className="dk-reason-label">{label}</span> : null}
      {items.length ? (
        <ol className="dk-reason-list">
          {items.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ol>
      ) : null}
      {children ? <div className="dk-reason-body">{children}</div> : null}
      {note ? <span className="dk-reason-note">{note}</span> : null}
    </div>
  );
}

export interface CheckItem {
  label: ReactNode;
  ok: boolean;
}
/** 자동 검사 목록 */
export function CheckList({ items, className }: { items: CheckItem[]; className?: string }): ReactElement {
  return (
    <ul className={cx('dk-checks', className)}>
      {items.map((c, i) => (
        <li key={i} className={c.ok ? 'is-ok' : 'is-bad'}>
          <span className="dk-check-icon">
            <Glyph name={c.ok ? 'check' : 'alert'} size={12} />
          </span>
          <span>{c.label}</span>
          <span className="dk-sr">{c.ok ? ' 통과' : ' 미통과'}</span>
        </li>
      ))}
    </ul>
  );
}

export interface StepItem {
  label: ReactNode;
  state?: 'pending' | 'active' | 'done' | 'failed';
  meta?: ReactNode;
}
/** 진행 단계 (게시 5단계) */
export function StepList({ steps, className }: { steps: StepItem[]; className?: string }): ReactElement {
  return (
    <ol className={cx('dk-steps', className)}>
      {steps.map((s, i) => {
        const st = s.state ?? 'pending';
        return (
          <li key={i} className={`dk-step is-${st}`}>
            <span className="dk-step-icon">
              {st === 'done' ? <Glyph name="check" size={12} /> : null}
              {st === 'failed' ? <Glyph name="x" size={12} /> : null}
              {st === 'active' ? <Spinner size={13} /> : null}
            </span>
            <span className="dk-step-label">{s.label}</span>
            {s.meta ? <span className="dk-step-meta">{s.meta}</span> : <span />}
          </li>
        );
      })}
    </ol>
  );
}

export interface BrowserFrameProps {
  /** "개인계정 프로필" */
  profile?: ReactNode;
  url?: string;
  minHeight?: number;
  children?: ReactNode;
  className?: string;
}
/** 크롬 창 미리보기 틀 */
export function BrowserFrame({ profile, url, minHeight, children, className }: BrowserFrameProps): ReactElement {
  return (
    <div className={cx('dk-browser', className)}>
      <div className="dk-browser-bar">
        <span className="dk-browser-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="dk-browser-url">{url || 'about:blank'}</span>
        {profile ? <span className="dk-browser-profile">{profile}</span> : null}
      </div>
      <div className="dk-browser-body" style={minHeight ? { minHeight } : undefined}>
        {children}
      </div>
    </div>
  );
}
