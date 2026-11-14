import { render, screen } from '@testing-library/react';
import { TopicMatchBox } from './TopicMatchBox';

describe('TopicMatchBox (② 맨 위 주제와 매칭)', () => {
  it('기준 이상: 주제와 매칭됨, 퍼센트, 이유', () => {
    render(<TopicMatchBox match={{ percent: 82, reason: '재회 이야기라 연애 사주와 가까움', matched: true, threshold: 50 }} />);
    expect(screen.getByText('주제와 매칭됨')).toBeInTheDocument();
    expect(screen.getByText('82%')).toBeInTheDocument();
    expect(screen.getByText('재회 이야기라 연애 사주와 가까움')).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: '주제와 매칭' })).toHaveAttribute('aria-valuenow', '82');
  });

  it('기준 미만: 매칭 낮음과 기준을 함께 보이고, 막지는 않는다고 알린다', () => {
    render(<TopicMatchBox match={{ percent: 32, reason: '앱 시연 영상이라 연애 사주와 상관없음', matched: false, threshold: 50 }} />);
    expect(screen.getByText('주제와 매칭 낮음')).toBeInTheDocument();
    expect(screen.getByText('32%')).toBeInTheDocument();
    expect(screen.getByText(/기준 50%보다 낮아요/)).toBeInTheDocument();
  });

  it('판단 전(이 기능 전에 한 분석): [분석부터 다시]로 매길 수 있다고 알린다', () => {
    render(<TopicMatchBox match={null} />);
    expect(screen.getByText('주제와 매칭 확인 전')).toBeInTheDocument();
    expect(screen.getByText(/분석부터 다시/)).toBeInTheDocument();
  });
});
