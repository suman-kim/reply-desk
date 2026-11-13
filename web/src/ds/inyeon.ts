/**
 * Inyeon 디자인 시스템 연결.
 * 원본은 ../design/inyeon-design-system 이다. 복사하지 않고 그대로 불러온다(고칠 곳은 그쪽 한 곳).
 * 불러오는 순서: React 전역 → tokens.css → bundle.css → bundle.js (README '다른 화면에서 쓰기')
 */
import './react-global';
import '@inyeon/tokens.css';
import '@inyeon/components/bundle.css';
import '@inyeon/components/bundle.js';

export type {
  BadgeProps,
  ButtonProps,
  CheckItem,
  FieldProps,
  LogRow,
  SegmentedOption,
  StepItem,
  Tone,
  VideoBadge,
} from '@inyeon/components/index';

/** 디자인 시스템 컴포넌트 14종 (window.Inyeon) */
const ds = window.Inyeon;

export const {
  Button,
  Badge,
  Spinner,
  StatPill,
  Panel,
  TopicItem,
  Field,
  Segmented,
  VideoCard,
  ReasonBox,
  CheckList,
  StepList,
  BrowserFrame,
  LogTable,
} = ds;
