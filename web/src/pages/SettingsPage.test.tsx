import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { keys } from '../api/queries';
import type { AiProviderInfo, SettingView } from '../api/types';
import { SettingsPage } from './SettingsPage';

/** 설정 하나 */
const setting = (key: string, label: string, value: unknown, defaultValue = value): SettingView => ({
  key,
  label,
  help: `${label} 도움말`,
  value,
  defaultValue,
  isDefault: JSON.stringify(value) === JSON.stringify(defaultValue),
});

const SETTINGS = [
  setting('posting.dailyCapTotal', '전체 하루 게시 상한', 30, 10),
  setting('posting.headless', '게시할 때 크롬 창', false, false),
  setting('youtube.searchCacheMinutes', '영상 검색을 다시 하는 간격 (분)', 60),
  setting('ai.analysis', '영상 분석 AI', { provider: 'ollama', model: 'gemma4:12b' }),
  setting('ai.drafting', '댓글 작성 AI', { provider: 'ollama', model: 'gemma4:12b' }),
  setting('analysis.topicMatchThreshold', '주제 매칭 기준 (%)', 50),
  setting('ai.ollamaBaseUrl', 'Ollama 주소', 'http://127.0.0.1:11434'),
  setting('ai.ollamaNumCtx', 'Ollama 문맥 길이', 16384),
];
const PROVIDERS = [{ id: 'ollama', label: 'Ollama', ready: true, note: '로컬', canWatchVideo: false, modelExamples: ['gemma4:12b'] }] as AiProviderInfo[];

/** 서버 없이 그린다 (받은 데이터를 미리 넣어 둔다). 저장 요청은 fetch 흉내로 받는다 */
function renderPage(path = '/settings') {
  const qc = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  qc.setQueryData(keys.settings, SETTINGS);
  qc.setQueryData(keys.providers, PROVIDERS);
  qc.setQueryData(keys.aiModels('ollama'), { provider: 'ollama', source: 'live', models: [{ id: 'gemma4:12b', label: 'gemma4:12b' }], note: null, pricingSource: null });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <SettingsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('설정 (탭 · 아래 저장 막대)', () => {
  const calls: { method: string; url: string; body: unknown }[] = [];
  beforeEach(() => {
    calls.length = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ method: init?.method ?? 'GET', url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
        return new Response(JSON.stringify(url.endsWith('/settings') ? SETTINGS : {}), { status: 200 });
      }),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('칸을 고치면 바뀐 내용 수와 탭 점이 보이고, 되돌리면 사라진다', () => {
    renderPage();
    expect(screen.getByText('저장된 상태예요')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('전체 하루 게시 상한'), { target: { value: '20' } });
    expect(screen.getByText(/바뀐 내용 1개/)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /게시/ }).querySelector('.dk-tab-mark')).not.toBeNull();
    // 저장된 값으로 다시 고치면 바뀐 것이 아니다
    fireEvent.change(screen.getByLabelText('전체 하루 게시 상한'), { target: { value: '30' } });
    expect(screen.getByText('저장된 상태예요')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('전체 하루 게시 상한'), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: '되돌리기' }));
    expect(screen.getByLabelText('전체 하루 게시 상한')).toHaveValue('30');
  });

  it('[저장]은 바뀐 칸만 숫자로 보내고, 기본값과 같으면 기본값으로 되돌린다', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('전체 하루 게시 상한'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('영상 검색을 다시 하는 간격 (분)'), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(calls.filter((c) => c.method !== 'GET')).toHaveLength(2));
    const writes = calls.filter((c) => c.method !== 'GET');
    expect(writes).toContainEqual({ method: 'DELETE', url: '/api/settings/posting.dailyCapTotal', body: undefined });
    expect(writes).toContainEqual({ method: 'PUT', url: '/api/settings/youtube.searchCacheMinutes', body: { value: 30 } });
  });

  it('숫자 칸이 비면 보내지 않고 알린다', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('전체 하루 게시 상한'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(screen.getByText('숫자를 넣어 주세요')).toBeInTheDocument();
    expect(calls.filter((c) => c.method !== 'GET')).toHaveLength(0);
  });

  it('Ollama 탭은 터널 명령에 주소의 포트를 넣는다', () => {
    renderPage('/settings?tab=ollama');
    fireEvent.change(screen.getByLabelText('Ollama 주소'), { target: { value: 'http://127.0.0.1:11435' } });
    expect(screen.getByText('ssh -f -N -L 11435:127.0.0.1:11434 ai-pc')).toBeInTheDocument();
  });
});
