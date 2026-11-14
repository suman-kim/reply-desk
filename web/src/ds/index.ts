/**
 * Desk 디자인 시스템 (reply-desk 전용).
 * 토큰은 tokens.css, 부품 모양은 components.css, 부품은 components.tsx.
 * 예전 Inyeon(../design/inyeon-design-system)과 같은 부품 이름·props를 지켜 화면 코드가 그대로 새 모양을 받는다.
 */
import '@fontsource/geist-mono/400.css';
import '@fontsource/geist-mono/500.css';
import '@fontsource/geist-mono/600.css';
import './tokens.css';
import './components.css';

export {
  Badge,
  BrowserFrame,
  Button,
  CheckList,
  Chips,
  Field,
  Glyph,
  Keyword,
  MatchBar,
  Panel,
  ReasonBox,
  Segmented,
  Spinner,
  StatPill,
  StepList,
  Tabs,
  VideoCard,
} from './components';

export type {
  BadgeProps,
  ButtonProps,
  CheckItem,
  ChipItem,
  FieldProps,
  SegmentedOption,
  StepItem,
  TabItem,
  Tone,
  VideoBadge,
} from './components';
