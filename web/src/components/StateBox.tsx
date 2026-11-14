import type { ReactNode } from 'react';
import { Button, Spinner } from '../ds/inyeon';

/**
 * 불러오는 중 상자
 * @param props.children 안내 (예: 영상 목록을 불러오는 중…)
 */
export function LoadingBox({ children = '불러오는 중…' }: { children?: ReactNode }) {
  return (
    <div className="rd-box rd-box-row text-body-sm" role="status">
      <Spinner size={16} />
      <span>{children}</span>
    </div>
  );
}

/**
 * 빈 상태 상자. 다음에 할 일을 함께 쓴다.
 * @param props.children 안내
 */
export function EmptyBox({ children }: { children: ReactNode }) {
  return <div className="rd-box text-body-sm">{children}</div>;
}

/**
 * 오류 띠. 원인 한 줄과 [다시 시도]
 * @param props.error 오류 (message를 보인다)
 * @param props.onRetry 다시 시도
 */
export function ErrorBand({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : '불러오지 못했어요 · 잠시 뒤 다시 시도해 주세요';
  return (
    <div className="rd-band rd-band-danger" role="alert">
      <span className="text-body-sm">{message}</span>
      {onRetry ? (
        <Button size="sm" variant="secondary" onClick={onRetry}>
          다시 시도
        </Button>
      ) : null}
    </div>
  );
}
