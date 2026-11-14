import { useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import {
  keys,
  useActions,
  useAiModels,
  useAiProviders,
  useSettings,
} from "../api/queries";
import type {
  AiModelList,
  AiProviderId,
  AiProviderInfo,
  SettingView,
} from "../api/types";
import { CUSTOM_MODEL, ModelSelect } from "../components/ModelSelect";
import { PageHeader } from "../components/PageHeader";
import { PromptSettings } from "../components/PromptSettings";
import { ErrorBand, LoadingBox } from "../components/StateBox";
import { Badge, Button, Field, Panel, Segmented } from '../ds';

/** 역할별 AI 선택 값 */
interface AiChoice {
  provider: AiProviderId;
  model: string;
}

/**
 * 저장된 값으로 만든 key. 값이 바뀌면 입력 칸을 새로 만들어 저장된 값을 보인다
 * @param s 설정
 */
const keyOf = (s: SettingView | undefined) =>
  `${s?.key}:${JSON.stringify(s?.value)}`;

/**
 * 설정: 게시 · AI 고르기 · Ollama 연결. 키는 서버 환경 파일(.env.development)에 두고 여기서는 고르기만 한다.
 */
export function SettingsPage() {
  const settings = useSettings();
  const providers = useAiProviders();
  const get = (key: string) => settings.data?.find((s) => s.key === key);

  return (
    <div className="rd-page">
      <PageHeader
        title="설정"
        description="게시 규칙과 AI를 정해요. 바꾸면 바로 다음 작업부터 적용돼요."
      />
      {settings.isPending ? <LoadingBox>설정을 불러오는 중…</LoadingBox> : null}
      {settings.error ? (
        <ErrorBand
          error={settings.error}
          onRetry={() => void settings.refetch()}
        />
      ) : null}
      {settings.data ? (
        <>
          <div className="rd-form rd-narrow-col">
            <Panel title="게시" hint="모든 주제에 함께 걸리는 규칙이에요">
              <TextSetting
                key={keyOf(get("posting.dailyCapTotal"))}
                setting={get("posting.dailyCapTotal")!}
                type="number"
              />
              <HeadlessSetting setting={get("posting.headless")!} />
            </Panel>

            <Panel
              title="AI"
              hint="영상 분석과 댓글 작성에 쓸 AI를 따로 골라요"
            >
              {providers.error ? <ErrorBand error={providers.error} /> : null}
              <div className="rd-provider-list">
                {providers.data?.map((p) => (
                  <ProviderCard key={p.id} info={p} />
                ))}
              </div>
              <AiSetting
                key={keyOf(get("ai.analysis"))}
                setting={get("ai.analysis")!}
                providers={providers.data ?? []}
              />
              <TextSetting
                key={keyOf(get("analysis.topicMatchThreshold"))}
                setting={get("analysis.topicMatchThreshold")!}
                type="number"
              />
              <div className="rd-divider" />
              <AiSetting
                key={keyOf(get("ai.drafting"))}
                setting={get("ai.drafting")!}
                providers={providers.data ?? []}
              />
            </Panel>

            <Panel
              title="Ollama (로컬 AI)"
              hint={`집 AI PC를 쓰려면 먼저 SSH 터널을 열어요: ssh -f -N -L ${portOf(String(get("ai.ollamaBaseUrl")?.value ?? ""))}:127.0.0.1:11434 ai-pc`}
            >
              <TextSetting
                key={keyOf(get("ai.ollamaBaseUrl"))}
                setting={get("ai.ollamaBaseUrl")!}
              />
              <TextSetting
                key={keyOf(get("ai.ollamaNumCtx"))}
                setting={get("ai.ollamaNumCtx")!}
                type="number"
              />
            </Panel>
          </div>
          {/* 프롬프트는 왼쪽 고치기 | 오른쪽 예시 보기라 넓게 쓴다 */}
          <div className="rd-form">
            <PromptSettings settings={settings.data} />
          </div>
        </>
      ) : null}
    </div>
  );
}

/**
 * AI 제공자 상태 카드
 * @param props.info 제공자 안내
 */
function ProviderCard({ info }: { info: AiProviderInfo }) {
  // 카드를 그리면서 모델 목록도 미리 받아 둔다 (제공자를 바꿀 때 첫 모델을 바로 고르려고)
  const models = useAiModels(info.id);
  const live = models.data?.source === "live";
  return (
    <div className="rd-provider">
      <div className="rd-row">
        <span className="text-body-strong">{info.label}</span>
        <Badge dot tone={info.ready ? "success" : "warning"}>
          {info.ready
            ? "쓸 수 있음"
            : info.id === "ollama"
              ? "연결 안 됨"
              : "키 필요"}
        </Badge>
      </div>
      <span className="text-caption rd-muted">{info.note}</span>
      <div className="rd-row-tight">
        {info.canWatchVideo ? (
          <Badge tone="accent">영상 직접 보기</Badge>
        ) : null}
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
    return new URL(url).port || "11434";
  } catch {
    return "11434";
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
  const custom =
    typing || (!!models.data && !!value && !list.some((m) => m.id === value));

  return (
    <div className="rd-stack-8">
      <div className="dk-field">
        <div className="dk-field-top">
          <label className="dk-field-label" htmlFor={id}>
            모델
          </label>
          <button
            type="button"
            className="rd-link-button text-caption"
            disabled={refreshAiModels.isPending}
            onClick={() => refreshAiModels.mutate(provider)}
          >
            {refreshAiModels.isPending ? "받는 중…" : "목록 새로 받기"}
          </button>
        </div>
        <ModelSelect
          id={id}
          models={list}
          value={value}
          custom={custom}
          disabled={models.isPending}
          placeholder={
            models.isPending ? "모델 목록을 불러오는 중…" : "모델을 골라 주세요"
          }
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
        {models.data?.source === "recommended" && !ready ? (
          <span className="dk-field-hint">
            추천 목록이에요 ·{" "}
            {provider === "ollama"
              ? "연결되면 받아 둔 모델이 모두 보여요"
              : "키를 넣으면 쓸 수 있는 모델이 모두 보여요"}
          </span>
        ) : models.data?.note ? (
          <span className="dk-field-hint">{models.data.note}</span>
        ) : null}
        {models.error ? (
          <span className="dk-field-error">
            모델 목록을 불러오지 못했어요 · [목록 새로 받기]를 눌러 주세요
          </span>
        ) : null}
        {!custom && error ? (
          <span className="dk-field-error">{error}</span>
        ) : null}
      </div>
      {custom ? (
        <Field
          label="모델 이름 직접 입력"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={list[0] ? `예: ${list[0].id}` : "모델 ID"}
          hint="목록에 없는 모델(새로 나온 모델 등)을 쓸 때 적어요"
          error={error}
        />
      ) : null}
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
function SaveRow({
  setting,
  onSave,
  dirty,
}: {
  setting: SettingView;
  onSave: () => void;
  dirty: boolean;
}) {
  const { updateSetting, resetSetting } = useActions();
  return (
    <div className="rd-row">
      <Button
        variant="secondary"
        size="sm"
        disabled={!dirty}
        loading={updateSetting.isPending}
        onClick={onSave}
      >
        저장
      </Button>
      {!setting.isDefault ? (
        <Button
          variant="ghost"
          size="sm"
          loading={resetSetting.isPending}
          onClick={() => resetSetting.mutate(setting.key)}
        >
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
function TextSetting({
  setting,
  type = "text",
}: {
  setting: SettingView;
  type?: string;
}) {
  const { updateSetting } = useActions();
  // 저장된 값이 바뀌면 부모가 key를 바꿔 이 칸을 새로 만든다
  const [value, setValue] = useState(String(setting.value));
  const dirty = value !== String(setting.value);
  const save = () =>
    updateSetting.mutate({
      key: setting.key,
      value: type === "number" ? Number(value) : value,
    });
  const error =
    updateSetting.error && updateSetting.variables?.key === setting.key
      ? updateSetting.error.message
      : undefined;

  return (
    <div className="rd-stack-8">
      <Field
        label={setting.label}
        type={type}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        hint={setting.help}
        error={error}
      />
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
          value={setting.value ? "hide" : "show"}
          onChange={(v) =>
            updateSetting.mutate({ key: setting.key, value: v === "hide" })
          }
          options={[
            { value: "show", label: "보이기 (시연용)" },
            { value: "hide", label: "숨기기" },
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
function AiSetting({
  setting,
  providers,
}: {
  setting: SettingView;
  providers: AiProviderInfo[];
}) {
  const { updateSetting } = useActions();
  const qc = useQueryClient();
  const current = setting.value as AiChoice;
  const [choice, setChoice] = useState<AiChoice>(current);
  const info = providers.find((p) => p.id === choice.provider);
  const dirty =
    choice.provider !== current.provider || choice.model !== current.model;
  const error =
    updateSetting.error && updateSetting.variables?.key === setting.key
      ? updateSetting.error.message
      : undefined;
  const isAnalysis = setting.key === "ai.analysis";

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
          const provider = v as AiProviderId;
          // 받아 둔 목록의 첫 모델(추천이 앞)을 고른다. 아직 없으면 추천 예시
          const listed = qc.getQueryData<AiModelList>(keys.aiModels(provider))
            ?.models[0]?.id;
          const example = providers.find((p) => p.id === provider)
            ?.modelExamples[0];
          setChoice({ provider, model: listed ?? example ?? "" });
        }}
        options={providers.map((p) => ({
          value: p.id,
          label: p.label.replace(/ \(.*\)$/, ""),
        }))}
      />
      <ModelPicker
        key={choice.provider}
        provider={choice.provider}
        ready={info?.ready ?? false}
        value={choice.model}
        onChange={(model) => setChoice((c) => ({ ...c, model }))}
        error={error}
      />
      {info && !info.ready ? (
        <div className="rd-band rd-band-warning">
          <span className="text-body-sm">{info.note}</span>
        </div>
      ) : null}
      {isAnalysis && info && !info.canWatchVideo ? (
        <span className="text-caption rd-muted">
          이 AI는 영상을 직접 보지 못해 영상 설명과 인기 댓글로 분석해요
        </span>
      ) : null}
      <SaveRow
        setting={setting}
        onSave={() => updateSetting.mutate({ key: setting.key, value: choice })}
        dirty={dirty}
      />
    </div>
  );
}
