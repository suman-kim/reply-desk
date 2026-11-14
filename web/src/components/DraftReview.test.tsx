import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { DraftDetail, Topic } from '../api/types';
import { DraftReview } from './DraftReview';

const topic = { id: 1, minLength: 40, maxLength: 120 } as Topic;
const video = { id: 2, commented: false } as DraftDetail['video'];

/** 데이터 캐시와 함께 그린다 */
function renderWith(detail: DraftDetail) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <DraftReview topic={topic} detail={detail} />
    </QueryClientProvider>,
  );
}

describe('DraftReview (디자인 시스템으로 실제 그리기)', () => {
  it('작성 실패면 원인과 [다시 생성]을 보인다', () => {
    renderWith({
      video, analysis: null, topicMatch: null, status: null, attempts: [],
      draft: { id: 3, state: 'error', errorMessage: 'GEMINI_API_KEY가 없어요 · 넣어 주세요' } as DraftDetail['draft'],
    });
    expect(screen.getByRole('alert')).toHaveTextContent('GEMINI_API_KEY가 없어요');
    expect(screen.getByRole('button', { name: '다시 생성' })).toBeEnabled();
  });

  it('준비된 초안은 이유·장면·글자 수·검사를 보인다', () => {
    renderWith({
      video, status: null, attempts: [],
      topicMatch: { percent: 82, reason: '연락 텀 이야기라 연애 사주와 가까움', matched: true, threshold: 50 },
      analysis: { id: 1, topicMatch: 82, topicMatchReason: '연락 텀 이야기라 연애 사주와 가까움', pickReasons: ['조회수가 오르는 중'], scenes: [{ time: '04:12', quote: '확신이 없어서예요', source: 'video' }], provider: 'gemini', model: 'm' },
      draft: {
        id: 3, state: 'ready', text: '04:12 확신 얘기 공감돼요', aiText: '', reasons: ['장면을 짚음'], edited: true,
        checkResults: [{ code: 'length', label: '길이', passed: false, detail: '13자예요' }], checkPassed: false,
      } as unknown as DraftDetail['draft'],
    });
    // 고민 한 줄 대신 주제와 매칭을 맨 위에
    expect(screen.getByText('주제와 매칭됨')).toBeInTheDocument();
    expect(screen.getByText('82%')).toBeInTheDocument();
    expect(screen.queryByText(/고민/)).not.toBeInTheDocument();
    expect(screen.getByText('04:12')).toBeInTheDocument();
    expect(screen.getByText('16 / 120자')).toBeInTheDocument();
    expect(screen.getByText('길이 · 13자예요')).toBeInTheDocument();
    expect(screen.getByText(/직접 고친 초안이에요/)).toBeInTheDocument();
  });
});
