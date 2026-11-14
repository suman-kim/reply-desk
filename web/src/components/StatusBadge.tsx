import type { DraftListStatus } from '../api/types';
import { Badge } from '../ds';
import { STATUS_TONE } from './badges';

/**
 * 작업 상태 배지. 색 규칙(의미 → 색)을 한곳에서 지킨다:
 * 게시 대기는 할 일이라 중립(검은 점), 작성 중은 진행(도는 원), 게시 완료 성공, 검사 미통과 주의, 실패·작성 실패는 실패.
 * @param props.status 상태 코드
 * @param props.label 서버가 준 상태 이름
 */
export function StatusBadge({ status, label }: { status: DraftListStatus; label: string }) {
  return (
    <Badge tone={STATUS_TONE[status]} dot={status === 'pending'} loading={status === 'writing'}>
      {label}
    </Badge>
  );
}
