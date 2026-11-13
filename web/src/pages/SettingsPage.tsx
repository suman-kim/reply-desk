import { useState } from 'react';
import { useActions, useAiProviders, useSettings } from '../api/queries';
import type { AiProviderId, AiProviderInfo, SettingView } from '../api/types';
import { PageHeader } from '../components/PageHeader';
import { ErrorBand, LoadingBox } from '../components/StateBox';
import { Badge, Button, Field, Panel, Segmented } from '../ds/inyeon';

/** 역할별 AI 선택 값 */
interface AiChoice {
  provider: AiProviderId;
  model: string;
}

/**
 * 저장된 값으로 만든 key. 값이 바뀌면 입력 칸을 새로 만들어 저장된 값을 보인다
 * @param s 설정
 */
const keyOf = (s: SettingView | undefined) => `${s?.key}:${JSON.stringify(s?.value)}`;

/**
 * 설정: 게시 · AI 고르기 · Ollama 연결. 키는 서버 환경 파일(.env.development)에 두고 여기서는 고르기만 한다.
 */
export function SettingsPage() {
  const settings = useSettings();
  const providers = useAiProviders();
  const get = (key: string) => settings.data?.find((s) => s.key === key);

  return (
    <div className="rd-page rd-page-narrow">
      <PageHeader title="설정" description="게시 규칙과 AI를 정해요. 바꾸면 바로 다음 작업부터 적용돼요." />
      {settings.isPending ? <LoadingBox>설정을 불러오는 중…</LoadingBox> : null}
      {settings.error ? <ErrorBand error={settings.error} onRetry={() => void settings.refetch()} /> : null}
      {settings.data ? (
        <div className="rd-form">
          <Panel title="게시" hint="모든 주제에 함께 걸리는 규칙이에요">
            <TextSetting key={keyOf(get('posting.dailyCapTotal'))} setting={get('posting.dailyCapTotal')!} type="number" />
            <HeadlessSetting setting={get('posting.headless')!} />
          </Panel>

          <Panel title="AI" hint="영상 분석과 댓글 작성에 쓸 AI를 따로 골라요">
            {providers.error ? <ErrorBand error={providers.error} /> : null}
            <div className="rd-provider-list">
              {providers.data?.map((p) => <ProviderCard key={p.id} info={p} />)}
            </div>
            <AiSetting key={keyOf(get('ai.analysis'))} setting={get('ai.analysis')!} providers={providers.data ?? []} />
            <div className="rd-divider" />
            <AiSetting key={keyOf(get('ai.drafting'))} setting={get('ai.drafting')!} providers={providers.data ?? []} />
          </Panel>

          <Panel title="Ollama (로컬 AI)" hint="집 AI PC를 쓰려면 먼저 SSH 터널을 열어요: ssh -f -N -L 11435:127.0.0.1:11434 ai-pc">
            <TextSetting key={keyOf(get('ai.ollamaBaseUrl'))} setting={get('ai.ollamaBaseUrl')!} />
            <TextSetting key={keyOf(get('ai.ollamaNumCtx'))} setting={get('ai.ollamaNumCtx')!} type="number" />
          </Panel>
        </div>
      ) : null}
    </div>
  );
}

/**
 * AI 제공자 상태 카드
 * @param props.info 제공자 안내
 */
function ProviderCard({ info }: { info: AiProviderInfo }) {
  return (
    <div className="rd-provider">
      <div className="rd-row">
        <span className="text-body-strong">{info.label}</span>
        <Badge dot tone={info.ready ? 'success' : 'warning'}>
          {info.ready ? '쓸 수 있음' : '키 필요'}
        </Badge>
      </div>
      <span className="text-caption rd-muted">{info.note}</span>
      {info.canWatchVideo ? <Badge tone="accent">영상 직접 보기</Badge> : null}
    </div>
  );
}

/**
 * 저장·기본값 버튼과 결과 한 줄
 * @param props.setting 설정
 * @param props.onSave 저장
 * @param props.saving 저장 중
 * @param props.dirty 바꾼 것이 있는지
 */
function SaveRow({ setting, onSave, dirty }: { setting: SettingView; onSave: () => void; dirty: boolean }) {
  const { updateSetting, resetSetting } = useActions();
  return (
    <div className="rd-row">
      <Button variant="secondary" size="sm" disabled={!dirty} loading={updateSetting.isPending} onClick={onSave}>
        저장
      </Button>
      {!setting.isDefault ? (
        <Button variant="ghost" size="sm" loading={resetSetting.isPending} onClick={() => resetSetting.mutate(setting.key)}>
          기본값으로
        </Button>
      ) : (
        <span className="text-caption rd-muted">기본값이에요</span>
      )}
    </div>
  );
}

/**
 * 글자·숫자 설정 하나
 * @param props.setting 설정
 * @param props.type 입력 종류
 */
function TextSetting({ setting, type = 'text' }: { setting: SettingView; type?: string }) {
  const { updateSetting } = useActions();
  // 저장된 값이 바뀌면 부모가 key를 바꿔 이 칸을 새로 만든다
  const [value, setValue] = useState(String(setting.value));
  const dirty = value !== String(setting.value);
  const save = () => updateSetting.mutate({ key: setting.key, value: type === 'number' ? Number(value) : value });
  const error = updateSetting.error && updateSetting.variables?.key === setting.key ? updateSetting.error.message : undefined;

  return (
    <div className="rd-stack-8">
      <Field label={setting.label} type={type} value={value} onChange={(e) => setValue(e.target.value)} hint={setting.help} error={error} />
      <SaveRow setting={setting} onSave={save} dirty={dirty} />
    </div>
  );
}

/**
 * 게시할 때 크롬 창 보이기·숨기기 (누르면 바로 저장)
 * @param props.setting 설정
 */
function HeadlessSetting({ setting }: { setting: SettingView }) {
  const { updateSetting } = useActions();
  return (
    <div className="rd-stack-8">
      <span className="text-label rd-label">게시할 때 크롬 창</span>
      <div>
        <Segmented
          label="게시할 때 크롬 창"
          value={setting.value ? 'hide' : 'show'}
          onChange={(v) => updateSetting.mutate({ key: setting.key, value: v === 'hide' })}
          options={[
            { value: 'show', label: '보이기 (시연용)' },
            { value: 'hide', label: '숨기기' },
          ]}
        />
      </div>
      <span className="text-caption rd-muted">{setting.help}</span>
    </div>
  );
}

/**
 * 역할별 AI 고르기: 제공자 + 모델 이름
 * @param props.setting 설정 (ai.analysis 또는 ai.drafting)
 * @param props.providers 제공자 안내
 */
function AiSetting({ setting, providers }: { setting: SettingView; providers: AiProviderInfo[] }) {
  const { updateSetting } = useActions();
  const current = setting.value as AiChoice;
  const [choice, setChoice] = useState<AiChoice>(current);
  const info = providers.find((p) => p.id === choice.provider);
  const dirty = choice.provider !== current.provider || choice.model !== current.model;
  const error = updateSetting.error && updateSetting.variables?.key === setting.key ? updateSetting.error.message : undefined;
  const isAnalysis = setting.key === 'ai.analysis';

  return (
    <div className="rd-stack-12">
      <div className="rd-stack">
        <span className="text-body-strong">{setting.label}</span>
        <span className="text-caption rd-muted">{setting.help}</span>
      </div>
      <Segmented
        label={setting.label}
        block
        value={choice.provider}
        onChange={(v) => {
          const next = providers.find((p) => p.id === v);
          setChoice({ provider: v as AiProviderId, model: next?.modelExamples[0] ?? '' });
        }}
        options={providers.map((p) => ({ value: p.id, label: p.label.replace(/ \(.*\)$/, '') }))}
      />
      <Field
        label="모델 이름"
        value={choice.model}
        onChange={(e) => setChoice((c) => ({ ...c, model: e.target.value }))}
        hint={info ? `예: ${info.modelExamples.join(', ')}` : undefined}
        error={error}
      />
      {info && !info.ready ? (
        <div className="rd-band rd-band-warning">
          <span className="text-body-sm">{info.note}</span>
        </div>
      ) : null}
      {isAnalysis && info && !info.canWatchVideo ? (
        <span className="text-caption rd-muted">이 AI는 영상을 직접 보지 못해 영상 설명과 인기 댓글로 분석해요</span>
      ) : null}
      <SaveRow setting={setting} onSave={() => updateSetting.mutate({ key: setting.key, value: choice })} dirty={dirty} />
    </div>
  );
}
