import type * as React from 'react';

/** Tone shared by Badge and status colours. */
export type Tone = 'neutral' | 'accent' | 'rose' | 'success' | 'danger' | 'warning';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary = electric blue fill (one per panel), dark = ink fill (a second strong action), secondary = soft grey fill, ghost = text only, dashed = "add new". Default secondary. */
  variant?: 'primary' | 'dark' | 'secondary' | 'ghost' | 'dashed';
  /** sm 32px, md 44px (default), lg 52px. */
  size?: 'sm' | 'md' | 'lg';
  /** Shows a spinner, disables the button, keeps its colour. */
  loading?: boolean;
  /** Stretch to the container width. */
  fullWidth?: boolean;
  /** Optional node before the label (an icon). */
  leading?: React.ReactNode;
}
export declare function Button(props: ButtonProps): React.ReactElement;

export interface BadgeProps {
  tone?: Tone;
  /** Small spinner before the label: work in progress. */
  loading?: boolean;
  /** Small dot before the label. */
  dot?: boolean;
  children?: React.ReactNode;
  className?: string;
}
export declare function Badge(props: BadgeProps): React.ReactElement;

export interface SpinnerProps {
  /** Pixel size, default 16. */
  size?: number;
  /** inverse = on accent or ink fills. */
  tone?: 'default' | 'inverse';
  className?: string;
}
export declare function Spinner(props: SpinnerProps): React.ReactElement;

export interface StatPillProps {
  label: React.ReactNode;
  value: number;
  /** With max: shows "value / max" and a bar; the bar turns warning-ink at the cap. */
  max?: number;
  className?: string;
}
export declare function StatPill(props: StatPillProps): React.ReactElement;

export interface PanelProps {
  /** Step number, shown as a small "STEP 01" label above the title. */
  step?: number | string;
  title?: React.ReactNode;
  /** One line under the title saying what this panel does. */
  hint?: React.ReactNode;
  /** Nodes at the right of the header. */
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}
export declare function Panel(props: PanelProps): React.ReactElement;

export interface TopicItemProps {
  name: React.ReactNode;
  /** One line of numbers: "오늘 1/5 · 초안 4". */
  meta?: React.ReactNode;
  /** active = green dot, paused = grey dot. Place items on a surface-sunken tray. */
  status?: 'active' | 'paused';
  selected?: boolean;
  /** Blue count at the right (drafts waiting). Hidden at 0. */
  count?: number;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  className?: string;
}
export declare function TopicItem(props: TopicItemProps): React.ReactElement;

export interface FieldProps {
  label?: React.ReactNode;
  id?: string;
  value?: string;
  /** Without onChange the value is the starting value (uncontrolled). */
  onChange?: React.ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>;
  placeholder?: string;
  type?: string;
  multiline?: boolean;
  rows?: number;
  readOnly?: boolean;
  /** Right of the label, mono: "91 / 120자". */
  counter?: React.ReactNode;
  counterInvalid?: boolean;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  /** A node beside the input (an "추가" button). */
  action?: React.ReactNode;
  className?: string;
}
export declare function Field(props: FieldProps): React.ReactElement;

export interface SegmentedOption { value: string; label?: React.ReactNode }
export interface SegmentedProps {
  options: Array<SegmentedOption | string>;
  value?: string;
  onChange?: (value: string) => void;
  /** Accessible name of the group. */
  label?: string;
  /** Stretch to the container width. */
  block?: boolean;
  className?: string;
}
export declare function Segmented(props: SegmentedProps): React.ReactElement;

export interface VideoBadge { tone?: Tone; label: React.ReactNode; loading?: boolean }
export interface VideoCardProps {
  rank?: number | string;
  title: React.ReactNode;
  channel?: string;
  date?: string;
  /** Shown as given: "조회수 12,400회". */
  views?: React.ReactNode;
  duration?: string;
  /** Image URL; without it the thumb shows a play mark on `tint`. */
  thumbnail?: string;
  tint?: string;
  selected?: boolean;
  badges?: VideoBadge[];
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  className?: string;
}
export declare function VideoCard(props: VideoCardProps): React.ReactElement;

export interface ReasonBoxProps {
  /** accent = why this video, rose = the worry in the video, neutral = why this comment. */
  tone?: 'accent' | 'rose' | 'neutral';
  label?: React.ReactNode;
  /** Numbered reasons. */
  items?: React.ReactNode[];
  /** Free content (the one-line worry). */
  children?: React.ReactNode;
  /** Small line at the end. */
  note?: React.ReactNode;
  className?: string;
}
export declare function ReasonBox(props: ReasonBoxProps): React.ReactElement;

export interface CheckItem { label: React.ReactNode; ok: boolean }
export interface CheckListProps { items: CheckItem[]; className?: string }
export declare function CheckList(props: CheckListProps): React.ReactElement;

export interface StepItem { label: React.ReactNode; state?: 'pending' | 'active' | 'done' | 'failed'; meta?: React.ReactNode }
export interface StepListProps { steps: StepItem[]; className?: string }
export declare function StepList(props: StepListProps): React.ReactElement;

export interface BrowserFrameProps {
  /** "유튜브1 프로필". */
  profile?: React.ReactNode;
  url?: string;
  minHeight?: number;
  children?: React.ReactNode;
  className?: string;
}
export declare function BrowserFrame(props: BrowserFrameProps): React.ReactElement;

export interface LogRow {
  id: string;
  time: string;
  /** Shown as its own column when any row has one. */
  topic?: string;
  video: React.ReactNode;
  profile: string;
  comment: React.ReactNode;
  ok: boolean;
  reason?: React.ReactNode;
  /** Screenshot URL for a failed row. */
  capture?: string;
}
export interface LogTableProps {
  rows: LogRow[];
  /** Shows "캡처 보기" on failed rows. */
  onCapture?: (row: LogRow) => void;
  /** The row whose capture is open. */
  openCaptureId?: string | null;
  label?: string;
  emptyText?: React.ReactNode;
  className?: string;
}
export declare function LogTable(props: LogTableProps): React.ReactElement;

declare global {
  interface Window {
    Inyeon: {
      Button: typeof Button; Badge: typeof Badge; Spinner: typeof Spinner; StatPill: typeof StatPill;
      Panel: typeof Panel; TopicItem: typeof TopicItem; Field: typeof Field; Segmented: typeof Segmented;
      VideoCard: typeof VideoCard; ReasonBox: typeof ReasonBox; CheckList: typeof CheckList;
      StepList: typeof StepList; BrowserFrame: typeof BrowserFrame; LogTable: typeof LogTable;
    };
  }
}
