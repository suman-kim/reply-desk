import { useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { useSearchParams } from 'react-router';
import { keys, useActions, useAiModels, useAiProviders, useSettings } from '../api/queries';
import type { AiModelList, AiProviderId, AiProviderInfo, SettingView } from '../api/types';
import { FormRow, SaveBar } from '../components/FormBits';
import { Icon } from '../components/Icon';
import { CUSTOM_MODEL, ModelSelect } from '../components/ModelSelect';
import { PromptSettings, type PromptValue } from '../components/PromptSettings';
import { ErrorBand, LoadingBox } from '../components/StateBox';
import { Badge, Button, Field, Segmented, Tabs } from '../ds';

/** 역할별 AI 선택 값 */
interface AiChoice {
  provider: AiProviderId;
  model: string;
}

/** 설정 탭 */
type SettingsTab = 'post' | 'ai' | 'ollama' | 'prompt';

/** 탭 이름과 그 탭의 설정 키 */
const TABS: { value: SettingsTab; label: string; keys: string[] }[] = [
  { value: 'post', label: '게시', keys: ['posting.dailyCapTotal', 'posting.headless', 'youtube.searchCacheMinutes'] },
  { value: 'ai', label: 'AI', keys: ['ai.analysis', 'analysis.topicMatchThreshold', 'ai.drafting'] },
  { value: 'ollama', label: 'Ollama', keys: ['ai.ollamaBaseUrl', 'ai.ollamaNumCtx'] },
  { value: 'prompt', label: '프롬프트', keys: ['prompt.analysis', 'prompt.drafting'] },
];

/** 숫자 칸 (입력 중에는 글자로 들고, 저장할 때 숫자로 바꾼다) */
const NUMBER_KEYS = new Set(['posting.dailyCapTotal', 'youtube.searchCacheMinutes', 'analysis.topicMatchThreshold', 'ai.ollamaNumCtx']);

/** 두 값이 같은지 (설정 값은 JSON) */
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * 입력 값 → 저장 값 (숫자 칸은 숫자로)
 * @param key 설정 키
 * @param v 입력 값
 */
function toValue(key: string, v: unknown): unknown {
  return NUMBER_KEYS.has(key) && typeof v === 'string' ? Number(v) : v;
}

/**
 * 저장 값 → 입력 값 (숫자 칸은 글자로)
 * @param key 설정 키
 * @param v 저장 값
 */
function toInput(key: string, v: unknown): unknown {
  return NUMBER_KEYS.has(key) ? String(v ?? '') : v;
}

/**
 * 설정 (/settings, RD-26): 모든 주제에 함께 걸리는 규칙과 AI. 탭(게시 · AI · Ollama · 프롬프트)으로 나누고,
 * 여러 칸을 고친 뒤 아래 저장 막대에서 한 번에 저장한다. 바뀐 칸이 있는 탭에는 점이 붙는다.
 * 키는 서버 환경 파일(.env.development)에 두고 여기서는 고르기만 한다.
 */
export function SettingsPage() {
  const settings = useSettings();
  const providers = useAiProviders();
  const { saveSettings } = useActions();
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((t) => t.value === params.get('tab'))?.value ?? 'post';
  /** 고쳤지만 저장하지 않은 값 (키 → 입력 값) */
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  /** 저장할 때 난 키별 오류 */
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savedNote, setSavedNote] = useState<string | null>(null);

  const list = settings.data ?? [];
  const saved = (key: string) => list.find((s) => s.key === key);
  const valueOf = (key: string) => (key in draft ? draft[key] : toInput(key, saved(key)?.value));
  /**
   * 칸 하나 바꾸기 (저장된 값과 같아지면 바뀐 값에서 뺀다)
   * @param key 설정 키
   * @param v 입력 값
   */
  const setValue = (key: string, v: unknown) => {
    setDraft((d) => {
      const next = { ...d };
      if (same(toValue(key, v), saved(key)?.value)) delete next[key];
      else next[key] = v;
      return next;
    });
    setErrors((e) => {
      if (!(key in e)) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });
  };
  const dirtyKeys = Object.keys(draft);
  const current = TABS.find((t) => t.value === tab)!;
  // 이 탭에서 기본값과 다른 칸 (기본값으로 되돌릴 것이 있는지)
  const offDefault = current.keys.filter((k) => {
    const s = saved(k);
    return s && !same(toValue(k, valueOf(k)), s.defaultValue);
  });

  /** 바뀐 값을 모두 저장 (숫자 칸이 비었거나 숫자가 아니면 보내지 않고 알린다) */
  const save = () => {
    const bad: Record<string, string> = {};
    const entries = dirtyKeys.flatMap((key) => {
      const value = toValue(key, draft[key]);
      if (NUMBER_KEYS.has(key) && (String(draft[key]).trim() === '' || !Number.isFinite(value))) {
        bad[key] = '숫자를 넣어 주세요';
        return [];
      }
      return [{ key, value, toDefault: same(value, saved(key)?.defaultValue) }];
    });
    if (Object.keys(bad).length > 0) {
      setErrors(bad);
      jumpTo(Object.keys(bad));
      return;
    }
    saveSettings.mutate(entries, {
      onSuccess: ({ errors: failed }) => {
        setErrors(failed);
        // 저장된 것은 바뀐 값에서 빼고, 실패한 것만 남긴다
        setDraft((d) => Object.fromEntries(Object.entries(d).filter(([k]) => k in failed)));
        if (Object.keys(failed).length > 0) jumpTo(Object.keys(failed));
        else setSavedNote(`저장했어요 · ${new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} · 다음 작업부터 적용돼요`);
      },
    });
  };
  /**
   * 오류가 난 칸이 있는 첫 탭으로
   * @param errKeys 오류 난 키
   */
  const jumpTo = (errKeys: string[]) => {
    const t = TABS.find((x) => x.keys.some((k) => errKeys.includes(k)));
    if (t && t.value !== tab) pickTab(t.value);
  };
  const pickTab = (v: string) => {
    const p = new URLSearchParams(params);
    if (v === 'post') p.delete('tab');
    else p.set('tab', v);
    setParams(p, { replace: true });
  };
  /** 이 탭의 칸을 기본값으로 (저장은 [저장]을 눌러야) */
  const toDefaults = () => {
    for (const k of current.keys) {
      const s = saved(k);
      if (s) setValue(k, toInput(k, s.defaultValue));
    }
  };

  const errorCount = Object.keys(errors).length;
  const row = (key: string) => ({ setting: saved(key), value: valueOf(key), changed: key in draft, error: errors[key], onChange: (v: unknown) => setValue(key, v) });

  return (
    <div className="rd-page rd-settings">
      <header className="rd-header">
        <div className="rd-header-title">
          <h1 className="text-display">설정</h1>
          <p className="text-body-sm">모든 주제에 함께 걸리는 게시 규칙과 AI를 정해요. 저장하면 다음 작업부터 적용돼요.</p>
        </div>
      </header>
      {settings.isPending ? <LoadingBox>설정을 불러오는 중…</LoadingBox> : null}
      {settings.error ? <ErrorBand error={settings.error} onRetry={() => void settings.refetch()} /> : null}
      {settings.data ? (
        <>
          <Tabs
            label="설정 나누기"
            value={tab}
            onChange={pickTab}
            items={TABS.map((t) => ({ value: t.value, label: t.label, marked: t.keys.some((k) => k in draft || k in errors) }))}
          />
          <section role="tabpanel" aria-label={current.label} className="rd-fsection">
            {tab === 'post' ? (
              <>
                <NumberRow {...row('posting.dailyCapTotal')} short="한국 시간 하루 기준" width={140} />
                <HeadlessRow {...row('posting.headless')} />
                <NumberRow {...row('youtube.searchCacheMinutes')} short="유튜브 검색 할당량을 아껴요" suffix="분" width={140} />
              </>
            ) : null}
            {tab === 'ai' ? (
              <>
                <FormRow label="쓸 수 있는 AI" help="키와 연결 상태를 확인했어요" wide>
                  {providers.error ? <ErrorBand error={providers.error} /> : null}
                  <div className="rd-provider-list">
                    {providers.data?.map((p) => (
                      <ProviderCard key={p.id} info={p} />
                    ))}
                  </div>
                </FormRow>
                <AiRow {...row('ai.analysis')} providers={providers.data ?? []} short="주제와 매칭(%) · 근거 장면 · 고른 이유를 뽑아요" />
                <ThresholdRow {...row('analysis.topicMatchThreshold')} />
                <AiRow {...row('ai.drafting')} providers={providers.data ?? []} short="초안과 “이렇게 쓴 이유”를 써요" />
              </>
            ) : null}
            {tab === 'ollama' ? (
              <>
                <OllamaUrlRow {...row('ai.ollamaBaseUrl')} ready={providers.data?.find((p) => p.id === 'ollama')?.ready ?? null} />
                <NumberRow {...row('ai.ollamaNumCtx')} short="한 번에 읽는 글 길이" width={160} />
              </>
            ) : null}
            {tab === 'prompt' ? (
              <div className="rd-fprompt">
                <PromptSettings
                  settings={list}
                  values={{ 'prompt.analysis': valueOf('prompt.analysis') as PromptValue, 'prompt.drafting': valueOf('prompt.drafting') as PromptValue }}
                  changed={{ 'prompt.analysis': 'prompt.analysis' in draft, 'prompt.drafting': 'prompt.drafting' in draft }}
                  errors={errors}
                  onChange={setValue}
                />
              </div>
            ) : null}
          </section>
          <SaveBar
            dirty={dirtyKeys.length}
            saving={saveSettings.isPending}
            note={savedNote ?? undefined}
            error={errorCount > 0 ? `저장하지 못한 칸이 ${errorCount}개 있어요 · 빨간 안내를 보고 고쳐 주세요` : null}
            onSave={save}
            onRevert={() => {
              setDraft({});
              setErrors({});
            }}
            extra={
              offDefault.length > 0 ? (
                <Button variant="ghost" onClick={toDefaults}>
                  이 탭 기본값으로
                </Button>
              ) : null
            }
          />
        </>
      ) : null}
    </div>
  );
}

/** 설정 한 줄이 받는 값 (서버에 없는 설정이면 setting이 없고 줄을 그리지 않는다) */
interface RowProps {
  setting: SettingView | undefined;
  value: unknown;
  changed: boolean;
  error?: string;
  onChange: (v: unknown) => void;
}

/**
 * 숫자 칸 한 줄
 * @param props 설정 한 줄 값
 * @param props.short 이름 아래 짧은 설명
 * @param props.suffix 칸 오른쪽 단위
 * @param props.width 칸 너비
 */
function NumberRow({ setting, value, changed, error, onChange, short, suffix, width }: RowProps & { short?: string; suffix?: string; width: number }) {
  const id = useId();
  if (!setting) return null;
  return (
    <FormRow label={setting.label} htmlFor={id} help={short} changed={changed}>
      <span className="rd-row">
        <input
          id={id}
          className="dk-input text-mono"
          style={{ maxWidth: width }}
          inputMode="numeric"
          value={String(value)}
          aria-invalid={error ? 'true' : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
        {suffix ? <span className="text-body-sm rd-muted">{suffix}</span> : null}
      </span>
      {error ? <span className="dk-field-error">{error}</span> : null}
      <span className="text-caption rd-muted">{setting.help}</span>
    </FormRow>
  );
}

/**
 * 게시할 때 크롬 창 보이기·숨기기
 * @param props 설정 한 줄 값
 */
function HeadlessRow({ setting, value, changed, error, onChange }: RowProps) {
  if (!setting) return null;
  return (
    <FormRow label="게시할 때 크롬 창" changed={changed}>
      <div>
        <Segmented
          label="게시할 때 크롬 창"
          value={value ? 'hide' : 'show'}
          onChange={(v) => onChange(v === 'hide')}
          options={[
            { value: 'show', label: '보이기 (시연용)' },
            { value: 'hide', label: '숨기기' },
          ]}
        />
      </div>
      {error ? <span className="dk-field-error">{error}</span> : null}
      <span className="text-caption rd-muted">{setting.help}</span>
    </FormRow>
  );
}

/**
 * 주제 매칭 기준 (%): 칸 + 기준 막대(왼쪽 노랑 '매칭 낮음' · 오른쪽 초록 '매칭됨')
 * @param props 설정 한 줄 값
 */
function ThresholdRow({ setting, value, changed, error, onChange }: RowProps) {
  const id = useId();
  if (!setting) return null;
  const n = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <FormRow label="주제 매칭 기준" htmlFor={id} help="이 값으로 매칭됨 · 매칭 낮음을 나눠요" changed={changed}>
      <div className="rd-thr">
        <span className="rd-thr-input">
          <input
            id={id}
            className="dk-input text-mono"
            inputMode="numeric"
            value={String(value)}
            aria-invalid={error ? 'true' : undefined}
            onChange={(e) => onChange(e.target.value)}
          />
          <span aria-hidden="true">%</span>
        </span>
        <span className="rd-thr-scale" aria-hidden="true">
          <span className="rd-thr-bar" style={{ ['--thr' as string]: `${n}%` }}>
            <i />
          </span>
          <span className="rd-thr-labels text-caption rd-muted">
            <span>매칭 낮음</span>
            <span>매칭됨</span>
          </span>
        </span>
      </div>
      {error ? <span className="dk-field-error">{error}</span> : null}
      <span className="text-caption rd-muted">{setting.help}</span>
    </FormRow>
  );
}

/**
 * Ollama 주소 + 연결 상태 + SSH 터널 안내(복사)
 * @param props 설정 한 줄 값
 * @param props.ready Ollama에 붙는지 (모르면 null)
 */
function OllamaUrlRow({ setting, value, changed, error, onChange, ready }: RowProps & { ready: boolean | null }) {
  const id = useId();
  const [copied, setCopied] = useState(false);
  if (!setting) return null;
  const command = `ssh -f -N -L ${portOf(String(value))}:127.0.0.1:11434 ai-pc`;
  const copy = () => {
    void navigator.clipboard?.writeText(command).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <FormRow label="Ollama 주소" htmlFor={id} help="로컬 AI" changed={changed}>
      <span className="rd-row">
        <input
          id={id}
          className="dk-input text-mono"
          style={{ flex: '1 1 260px', minWidth: 0 }}
          value={String(value ?? '')}
          aria-invalid={error ? 'true' : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
        {ready === null ? null : <Badge tone={ready ? 'success' : 'warning'} dot>{ready ? '연결됨' : '연결 안 됨'}</Badge>}
      </span>
      {error ? <span className="dk-field-error">{error}</span> : null}
      <span className="text-caption rd-muted">{setting.help}</span>
      <div className="rd-tunnel">
        <span className="text-label rd-ink">집 AI PC를 쓰려면 먼저 SSH 터널을 열어요</span>
        <div className="rd-code">
          <code>{command}</code>
          <button type="button" className="rd-code-copy" onClick={copy} aria-label="명령 복사">
            {copied ? '복사됨' : <Icon name="copy" size={14} />}
          </button>
        </div>
        <span className="text-caption rd-muted">연결 상태는 저장하고 나서 다시 확인해요</span>
      </div>
    </FormRow>
  );
}

/**
 * AI 제공자 상태 카드
 * @param props.info 제공자 안내
 */
function ProviderCard({ info }: { info: AiProviderInfo }) {
  // 카드를 그리면서 모델 목록도 미리 받아 둔다 (제공자를 바꿀 때 첫 모델을 바로 고르려고)
  const models = useAiModels(info.id);
  const live = models.data?.source === 'live';
  return (
    <div className="rd-provider">
      <div className="rd-provider-head">
        <span className="text-heading">{info.label.replace(/ \(.*\)$/, '')}</span>
        <Badge dot tone={info.ready ? 'success' : 'warning'}>
          {info.ready ? '쓸 수 있음' : info.id === 'ollama' ? '연결 안 됨' : '키 필요'}
        </Badge>
      </div>
      <span className="text-caption rd-muted">{info.note}</span>
      <div className="rd-row-tight">
        {info.canWatchVideo ? <Badge tone="accent">영상 직접 보기</Badge> : null}
        {live ? <Badge>모델 {models.data!.models.length}개</Badge> : null}
      </div>
    </div>
  );
}

/**
 * 주소의 포트 (터널 안내용). 없거나 잘못되면 Ollama 기본 11434
 * @param url Ollama 주소
 */
function portOf(url: string): string {
  try {
    return new URL(url).port || '11434';
  } catch {
    return '11434';
  }
}

/** 모델 고르기에서 "직접 입력"을 뜻하는 값 */
const CUSTOM = CUSTOM_MODEL;

/**
 * 모델 고르기: 제공자 API에서 받은 목록(추천이 앞) + 직접 입력.
 * 키가 없거나 목록을 못 받으면 추천 목록과 그 이유를 보인다.
 * @param props.provider 제공자
 * @param props.ready 제공자를 지금 쓸 수 있는지 (아니면 원인은 아래 경고 띠가 보이므로 여기서는 짧게)
 * @param props.value 지금 고른 모델 ID
 * @param props.onChange 모델을 바꿀 때
 * @param props.error 저장 오류
 */
function ModelPicker({
  provider,
  ready,
  value,
  onChange,
  error,
}: {
  provider: AiProviderId;
  ready: boolean;
  value: string;
  onChange: (model: string) => void;
  error?: string;
}) {
  const id = useId();
  const models = useAiModels(provider);
  const { refreshAiModels } = useActions();
  const list = models.data?.models ?? [];
  // 직접 입력: 사람이 골랐거나, 저장된 모델이 목록에 없을 때
  const [typing, setTyping] = useState(false);
  const custom = typing || (!!models.data && !!value && !list.some((m) => m.id === value));

  return (
    <div className="rd-stack-8">
      <div className="dk-field">
        <div className="dk-field-top">
          <label className="dk-field-label" htmlFor={id}>
            모델
          </label>
          <button type="button" className="rd-link-button text-caption" disabled={refreshAiModels.isPending} onClick={() => refreshAiModels.mutate(provider)}>
            {refreshAiModels.isPending ? '받는 중…' : '목록 새로 받기'}
          </button>
        </div>
        <ModelSelect
          id={id}
          models={list}
          value={value}
          custom={custom}
          disabled={models.isPending}
          placeholder={models.isPending ? '모델 목록을 불러오는 중…' : '모델을 골라 주세요'}
          invalid={!!error}
          pricingSource={models.data?.pricingSource ?? null}
          onPick={(v) => {
            if (v === CUSTOM) {
              setTyping(true);
              return;
            }
            setTyping(false);
            onChange(v);
          }}
        />
        {models.data?.source === 'recommended' && !ready ? (
          <span className="dk-field-hint">
            추천 목록이에요 · {provider === 'ollama' ? '연결되면 받아 둔 모델이 모두 보여요' : '키를 넣으면 쓸 수 있는 모델이 모두 보여요'}
          </span>
        ) : models.data?.note ? (
          <span className="dk-field-hint">{models.data.note}</span>
        ) : null}
        {models.error ? <span className="dk-field-error">모델 목록을 불러오지 못했어요 · [목록 새로 받기]를 눌러 주세요</span> : null}
        {!custom && error ? <span className="dk-field-error">{error}</span> : null}
      </div>
      {custom ? (
        <Field
          label="모델 이름 직접 입력"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={list[0] ? `예: ${list[0].id}` : '모델 ID'}
          hint="목록에 없는 모델(새로 나온 모델 등)을 쓸 때 적어요"
          error={error}
        />
      ) : null}
    </div>
  );
}

/**
 * 역할별 AI 고르기 한 줄: 제공자 + 모델
 * @param props 설정 한 줄 값 (값은 { provider, model })
 * @param props.providers 제공자 안내
 * @param props.short 이름 아래 짧은 설명
 */
function AiRow({ setting, value, changed, error, onChange, providers, short }: RowProps & { providers: AiProviderInfo[]; short: string }) {
  const qc = useQueryClient();
  if (!setting) return null;
  const choice = value as AiChoice;
  const info = providers.find((p) => p.id === choice.provider);
  const isAnalysis = setting.key === 'ai.analysis';

  return (
    <FormRow label={setting.label} help={short} changed={changed}>
      <Segmented
        label={setting.label}
        value={choice.provider}
        onChange={(v) => {
          const provider = v as AiProviderId;
          // 받아 둔 목록의 첫 모델(추천이 앞)을 고른다. 아직 없으면 추천 예시
          const listed = qc.getQueryData<AiModelList>(keys.aiModels(provider))?.models[0]?.id;
          const example = providers.find((p) => p.id === provider)?.modelExamples[0];
          onChange({ provider, model: listed ?? example ?? '' });
        }}
        options={providers.map((p) => ({ value: p.id, label: p.label.replace(/ \(.*\)$/, '') }))}
      />
      <ModelPicker
        key={choice.provider}
        provider={choice.provider}
        ready={info?.ready ?? false}
        value={choice.model}
        onChange={(model) => onChange({ ...choice, model })}
        error={error}
      />
      {info && !info.ready ? (
        <div className="rd-band rd-band-warning">
          <span className="text-body-sm">{info.note}</span>
        </div>
      ) : null}
      <span className="text-caption rd-muted">
        {isAnalysis && info && !info.canWatchVideo ? '이 AI는 영상을 직접 보지 못해 영상 설명과 인기 댓글로 분석해요' : setting.help}
      </span>
    </FormRow>
  );
}
