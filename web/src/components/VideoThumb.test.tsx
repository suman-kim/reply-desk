import { fireEvent, render, screen } from '@testing-library/react';
import { VideoThumb } from './VideoThumb';

describe('VideoThumb (② 영상 선택 썸네일)', () => {
  it('썸네일과 길이를 보이고, 누르면 영상 보기 창을 연다', () => {
    const onPlay = vi.fn();
    render(<VideoThumb url="https://i.ytimg.com/vi/x/mqdefault.jpg" title="전생부터 이어진 만사형통" durationSec={125} onPlay={onPlay} />);
    expect(screen.getByRole('img', { name: '전생부터 이어진 만사형통 썸네일' })).toHaveAttribute('src', 'https://i.ytimg.com/vi/x/mqdefault.jpg');
    expect(screen.getByText('2:05')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '영상 보기: 전생부터 이어진 만사형통' }));
    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it('썸네일 주소가 없으면 빈 자리에 안내', () => {
    render(<VideoThumb url={null} title="제목" durationSec={60} onPlay={() => undefined} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('썸네일 없음')).toBeInTheDocument();
  });
});
