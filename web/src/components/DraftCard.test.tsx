import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { DraftDetail, Topic } from '../api/types';
import { DraftCard } from './DraftCard';
import { EvidencePanel } from './EvidencePanel';

const topic = { id: 1, minLength: 40, maxLength: 120, adDisclosure: '[광고]' } as Topic;
const video = {
  id: 2, title: '연락 텀이 길어지는 이유', channelTitle: '연애상담소', commented: false, isMine: false,
  publishedAt: new Date().toISOString(), viewCount: 12000, durationSec: 615, thumbnailUrl: null, matchedKeywords: ['연애'],
} as unknown as DraftDetail['video'];

/** 데이터 캐시·주소와 함께 그린다 */
function renderWith(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

const ready: DraftDetail = {
  video, status: { code: 'check_failed', label: '검사 미통과' }, attempts: [],
  topicMatch: { percent: 82, reason: '연락 텀 이야기라 연애 사주와 가까움', matched: true, threshold: 50 },
  analysis: { id: 1, topicMatch: 82, topicMatchReason: '연락 텀 이야기라 연애 사주와 가까움', pickReasons: ['조회수가 오르는 중'], scenes: [{ time: '04:12', quote: '확신이 없어서예요', source: 'video' }], provider: 'gemini', model: 'gemini-x' },
  draft: {
    id: 3, state: 'ready', text: '04:12 확신 얘기 공감돼요', aiText: '', reasons: ['장면을 짚음'], edited: true,
    checkResults: [{ code: 'length', label: '길이', passed: false, detail: '13자예요' }], checkPassed: false,
  } as unknown as DraftDetail['draft'],
};

describe('DraftCard (작업 상세 B칸 초안)', () => {
  it('작성 실패면 원인과 [다시 생성]을 보인다', () => {
    renderWith(
      <DraftCard
        topic={topic}
        detail={{ ...ready, analysis: null, topicMatch: null, status: null, draft: { id: 3, state: 'error', errorMessage: 'GEMINI_API_KEY가 없어요 · 넣어 주세요' } as DraftDetail['draft'] }}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('GEMINI_API_KEY가 없어요');
    expect(screen.getByRole('button', { name: '다시 생성' })).toBeEnabled();
  });

  it('초안이 없으면 [초안 작성]', () => {
    renderWith(<DraftCard topic={topic} detail={{ ...ready, analysis: null, topicMatch: null, status: null, draft: null }} />);
    expect(screen.getByRole('button', { name: '초안 작성' })).toBeEnabled();
  });

  it('준비된 초안은 상태·글자 수·광고 표시·검사·쓴 이유를 보인다', () => {
    renderWith(<DraftCard topic={topic} detail={ready} />);
    expect(screen.getByLabelText('댓글 초안')).toHaveValue('04:12 확신 얘기 공감돼요');
    expect(screen.getByText('검사 미통과')).toBeInTheDocument();
    expect(screen.getByText('16 / 120자')).toHaveClass('is-bad');
    expect(screen.getByText('[광고]')).toBeInTheDocument();
    expect(screen.getByText('1개 확인 필요')).toBeInTheDocument();
    expect(screen.getByText('길이 · 13자예요')).toBeInTheDocument();
    expect(screen.getByText(/직접 고친 초안이에요/)).toBeInTheDocument();
    expect(screen.getByText('장면을 짚음')).toBeInTheDocument();
  });

  it('이미 댓글을 단 영상은 고칠 수 없다', () => {
    renderWith(<DraftCard topic={topic} detail={{ ...ready, video: { ...video, commented: true } }} />);
    expect(screen.getByLabelText('댓글 초안')).toHaveAttribute('readonly');
    expect(screen.getByRole('button', { name: '다시 생성' })).toBeDisabled();
  });
});

describe('EvidencePanel (작업 상세 A칸 판단 근거)', () => {
  it('주제와 매칭 · 맞은 검색어 · 고른 이유 · 근거 장면을 위에서부터', () => {
    renderWith(<EvidencePanel detail={ready} onWatch={() => {}} />);
    expect(screen.getByText('주제와 매칭됨')).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: '주제와 매칭' })).toHaveAttribute('aria-valuenow', '82');
    expect(screen.getByText('연애')).toBeInTheDocument();
    expect(screen.getByText('조회수가 오르는 중')).toBeInTheDocument();
    expect(screen.getByText('04:12')).toBeInTheDocument();
    expect(screen.getByText('gemini-x')).toBeInTheDocument();
  });

  it('분석 전이면 매칭 대신 분석 전을 알린다', () => {
    renderWith(<EvidencePanel detail={{ ...ready, analysis: null, topicMatch: null }} onWatch={() => {}} />);
    expect(screen.getByText('아직 분석 전이에요')).toBeInTheDocument();
    expect(screen.queryByRole('meter')).not.toBeInTheDocument();
    expect(screen.getByText('연애')).toBeInTheDocument();
  });
});
