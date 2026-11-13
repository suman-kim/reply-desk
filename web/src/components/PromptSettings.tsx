import { useEffect, useRef, useState } from "react";
import { usePromptInfo, usePromptPreview } from "../api/queries";
import type { PromptInfo, SettingView } from "../api/types";
import { Segmented } from '../ds';
import { ErrorBand, LoadingBox } from "./StateBox";

/** 프롬프트 설정 값 (덩이 이름 → 글) */
export type PromptValue = Record<string, string>;

/** 프롬프트 설정 키 */
type PromptKey = "prompt.analysis" | "prompt.drafting";

/**
 * AI 프롬프트 설정 (설정 화면의 '프롬프트' 탭): 영상 분석·댓글 작성 AI에게 보내는 글 전체를 보고 고친다.
 * 역할을 위에서 고르고(전환), 덩이(지시·자료 틀·다시 쓸 때)마다 글을 고친다. {{자리}}는 눌러서 넣는다.
 * 저장은 설정 화면 아래 저장 막대가 한 번에 한다. 답의 모양(JSON 칸)은 코드가 검증에 쓰므로 읽기만 한다.
 * @param props.settings 전체 설정 (prompt.analysis, prompt.drafting 저장 값)
 * @param props.values 고치는 중인 값 (키 → 값)
 * @param props.changed 저장하지 않은 바뀐 값이 있는지 (키 → 참)
 * @param props.errors 저장할 때 난 오류 (키 → 한 줄)
 * @param props.onChange 값이 바뀔 때
 */
export function PromptSettings({
  settings,
  values,
  changed,
  errors,
  onChange,
}: {
  settings: SettingView[];
  values: Record<PromptKey, PromptValue>;
  changed: Record<PromptKey, boolean>;
  errors: Record<string, string>;
  onChange: (key: PromptKey, value: PromptValue) => void;
}) {
  const info = usePromptInfo();
  const [role, setRole] = useState<PromptKey>("prompt.analysis");
  const setting = settings.find((s) => s.key === role);
  const meta = info.data?.find((p) => p.key === role);

  return (
    <div className="rd-stack-16">
      <div className="rd-prompt-top">
        <Segmented
          label="어느 AI에게 보내는 글"
          value={role}
          onChange={(v) => setRole(v as PromptKey)}
          options={[
            { value: "prompt.analysis", label: <>영상 분석{changed["prompt.analysis"] ? <span className="rd-seg-dot" aria-label="바뀐 내용 있음" /> : null}</> },
            { value: "prompt.drafting", label: <>댓글 작성{changed["prompt.drafting"] ? <span className="rd-seg-dot" aria-label="바뀐 내용 있음" /> : null}</> },
          ]}
        />
        <span className="text-caption rd-muted">
          AI에게 함께 보내는 세 가지 — <strong className="rd-ink">지시</strong>(모든 영상에 같게) ·{" "}
          <strong className="rd-ink">자료 틀</strong>(빈칸 <code>{"{{영상 제목}}"}</code>에 코드가 값을 채움) ·{" "}
          <strong className="rd-ink">답의 칸</strong>(코드가 정해 바꿀 수 없음). <code>{"{조회수}"}</code>처럼 괄호가 하나인 것은
          답이 오면 코드가 숫자로 바꾸는 표시예요.
        </span>
      </div>
      {info.isPending ? <LoadingBox>프롬프트 안내를 불러오는 중…</LoadingBox> : null}
      {info.error ? <ErrorBand error={info.error} onRetry={() => void info.refetch()} /> : null}
      {setting && meta ? (
        <PromptEditor
          key={role}
          setting={setting}
          meta={meta}
          value={values[role]}
          error={errors[role]}
          onChange={(v) => onChange(role, v)}
        />
      ) : null}
    </div>
  );
}

/**
 * 역할 하나의 프롬프트 고치기 (왼쪽 고치기 | 오른쪽 예시 보기)
 * @param props.setting 설정 (저장 값·도움말)
 * @param props.meta 덩이·자리·답의 모양 안내
 * @param props.value 고치는 중인 값
 * @param props.error 저장 오류
 * @param props.onChange 값이 바뀔 때
 */
function PromptEditor({
  setting,
  meta,
  value,
  error,
  onChange,
}: {
  setting: SettingView;
  meta: PromptInfo;
  value: PromptValue;
  error?: string;
  onChange: (value: PromptValue) => void;
}) {
  const saved = setting.value as PromptValue;

  // 예시 보기는 입력을 잠시 멈추면 새로 만든다 (글자마다 서버에 묻지 않게)
  const [previewValue, setPreviewValue] = useState<PromptValue>(value);
  useEffect(() => {
    const t = setTimeout(() => setPreviewValue(value), 400);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <div className="rd-prompt-layout">
      <div className="rd-stack-16">
        <span className="text-caption rd-muted">{setting.help}</span>
        {meta.parts.map((part) => (
          <PromptPart
            key={part.field}
            label={part.label}
            help={part.help}
            vars={part.vars}
            text={value[part.field] ?? ""}
            changed={value[part.field] !== saved[part.field]}
            onChange={(text) => onChange({ ...value, [part.field]: text })}
          />
        ))}
        {error ? <span className="dk-field-error">{error}</span> : null}
      </div>
      <PromptPreviewPane
        settingKey={setting.key}
        value={previewValue}
        response={meta.response}
      />
    </div>
  );
}

/**
 * 오른쪽 예시 보기: AI가 실제로 받는 글. 빈칸에서 온 값은 색으로 보인다.
 * @param props.settingKey 프롬프트 키
 * @param props.value 고치는 중인 값 (잠시 멈춘 뒤의 값)
 * @param props.response 답의 칸 (우리말 이름·설명)
 */
function PromptPreviewPane({
  settingKey,
  value,
  response,
}: {
  settingKey: string;
  value: PromptValue;
  response: PromptInfo["response"];
}) {
  const preview = usePromptPreview(settingKey, value);
  const p = preview.data;
  return (
    <aside className="rd-prompt-preview" aria-label="예시 보기">
      <div className="rd-stack">
        <span className="text-heading">예시 보기 · AI가 실제로 받는 글</span>
        {p ? (
          <span className="text-caption rd-muted">
            주제 <strong>{p.basis.topicName}</strong>의 실제 값 + 예시 영상 「
            {p.basis.videoTitle}」 · 색칠한 곳이 빈칸에 채운 값
          </span>
        ) : null}
      </div>
      {preview.isPending ? <LoadingBox>예시를 만드는 중…</LoadingBox> : null}
      {preview.error ? <ErrorBand error={preview.error} /> : null}
      {p ? (
        <>
          <PreviewBlock title="① 지시 (그대로 보냄)">{p.system}</PreviewBlock>
          <PreviewBlock title="② 자료 (빈칸을 채운 모습)">
            {p.user.map((part, i) =>
              part.slot ? (
                <mark
                  key={i}
                  className="rd-filled"
                  title={`{{${part.slot}}}에서 채움`}
                >
                  {part.text}
                </mark>
              ) : (
                <span key={i}>{part.text}</span>
              ),
            )}
          </PreviewBlock>
          {p.retry ? (
            <PreviewBlock title="③ 자동 검사에 걸려 다시 쓸 때 ②뒤에 덧붙는 글">
              {p.retry.map((part, i) =>
                part.slot ? (
                  <mark
                    key={i}
                    className="rd-filled"
                    title={`{{${part.slot}}}에서 채움`}
                  >
                    {part.text}
                  </mark>
                ) : (
                  <span key={i}>{part.text}</span>
                ),
              )}
            </PreviewBlock>
          ) : null}
          <div className="rd-stack-8">
            <span className="text-label rd-ink2">
              {p.retry ? "④" : "③"} AI가 채워 올 답의 칸 (코드가 정함)
            </span>
            <dl className="rd-response-list">
              {response.map((f) => (
                <div key={f.name}>
                  <dt className="text-body-sm">
                    <strong>{f.label}</strong>{" "}
                    <span className="text-mono rd-muted">{f.name}</span>
                  </dt>
                  <dd className="text-caption">{f.description}</dd>
                </div>
              ))}
            </dl>
          </div>
        </>
      ) : null}
    </aside>
  );
}

/**
 * 예시 보기 한 덩이 (줄바꿈을 그대로)
 * @param props.title 덩이 이름
 * @param props.children 글
 */
function PreviewBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rd-stack-8">
      <span className="text-label rd-ink2">{title}</span>
      <pre className="rd-preview-text">{children}</pre>
    </div>
  );
}

/**
 * 프롬프트 덩이 하나: 글 상자 + 넣을 수 있는 {{자리}} (누르면 커서 자리에 넣는다)
 * @param props.label 덩이 이름
 * @param props.help 무엇을 쓰는 덩이인지
 * @param props.vars 쓸 수 있는 자리
 * @param props.text 지금 글
 * @param props.changed 저장된 글과 다른지
 * @param props.onChange 글이 바뀔 때
 */
function PromptPart({
  label,
  help,
  vars,
  text,
  changed,
  onChange,
}: {
  label: string;
  help: string;
  vars: PromptInfo["parts"][number]["vars"];
  text: string;
  changed: boolean;
  onChange: (text: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  /**
   * 커서 자리에 {{자리}}를 넣는다
   * @param name 자리 이름
   */
  const insert = (name: string) => {
    const el = ref.current;
    const slot = `{{${name}}}`;
    if (!el) return onChange(text + slot);
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    onChange(text.slice(0, start) + slot + text.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + slot.length, start + slot.length);
    });
  };

  return (
    <div className="dk-field">
      <div className="dk-field-top">
        <span className="dk-field-label">
          {label}
          {changed ? <span className="rd-changed"> · 고침</span> : null}
        </span>
        <span className="dk-field-counter">
          {text.length.toLocaleString("ko-KR")} / 8,000자
        </span>
      </div>
      <textarea
        ref={ref}
        className="dk-input dk-textarea rd-prompt"
        aria-label={label}
        value={text}
        rows={Math.min(22, Math.max(6, text.split("\n").length + 1))}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="dk-field-hint">{help}</span>
      {vars.length > 0 ? (
        <div className="rd-slots" aria-label={`${label}에 넣을 수 있는 자리`}>
          {vars.map((v) => (
            <button
              key={v.name}
              type="button"
              className="rd-slot"
              title={v.help}
              onClick={() => insert(v.name)}
            >
              {`{{${v.name}}}`}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
