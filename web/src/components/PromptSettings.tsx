import { useRef, useState } from 'react';
import { useActions, usePromptInfo } from '../api/queries';
import type { PromptInfo, SettingView } from '../api/types';
import { Button, Panel, Segmented } from '../ds/inyeon';
import { ErrorBand, LoadingBox } from './StateBox';

/** 프롬프트 설정 값 (덩이 이름 → 글) */
type PromptValue = Record<string, string>;

/**
 * AI 프롬프트 설정: 영상 분석·댓글 작성 AI에게 보내는 글 전체를 보고 고친다.
 * 역할을 위에서 고르고(전환), 덩이(지시·자료 틀·다시 쓸 때)마다 글을 고친다. {{자리}}는 눌러서 넣는다.
 * 답의 모양(JSON 칸)은 코드가 검증에 쓰므로 읽기만 한다.
 * @param props.settings 전체 설정 (prompt.analysis, prompt.drafting 값)
 */
export function PromptSettings({ settings }: { settings: SettingView[] }) {
  const info = usePromptInfo();
  const [role, setRole] = useState('prompt.analysis');
  const setting = settings.find((s) => s.key === role);
  const meta = info.data?.find((p) => p.key === role);

  return (
    <Panel title="AI 프롬프트" hint="영상 분석과 댓글 작성 AI에게 보내는 글 전체예요. 고치면 다음 분석·초안부터 적용돼요.">
      <Segmented
        label="프롬프트 고르기"
        value={role}
        onChange={setRole}
        options={[
          { value: 'prompt.analysis', label: '영상 분석' },
          { value: 'prompt.drafting', label: '댓글 작성' },
        ]}
      />
      {info.isPending ? <LoadingBox>프롬프트 안내를 불러오는 중…</LoadingBox> : null}
      {info.error ? <ErrorBand error={info.error} onRetry={() => void info.refetch()} /> : null}
      {setting && meta ? (
        // 저장된 값이 바뀌면(저장·기본값으로) 고치던 글을 새로 받는다
        <PromptEditor key={`${role}:${JSON.stringify(setting.value)}`} setting={setting} meta={meta} />
      ) : null}
    </Panel>
  );
}

/**
 * 역할 하나의 프롬프트 고치기
 * @param props.setting 설정 (값·기본값 여부)
 * @param props.meta 덩이·자리·답의 모양 안내
 */
function PromptEditor({ setting, meta }: { setting: SettingView; meta: PromptInfo }) {
  const { updateSetting, resetSetting } = useActions();
  const saved = setting.value as PromptValue;
  const [value, setValue] = useState<PromptValue>(saved);
  const dirty = meta.parts.some((p) => value[p.field] !== saved[p.field]);
  const error = updateSetting.error && updateSetting.variables?.key === setting.key ? updateSetting.error.message : null;

  return (
    <div className="rd-stack-16">
      <span className="text-caption rd-muted">{setting.help}</span>
      {meta.parts.map((part) => (
        <PromptPart
          key={part.field}
          label={part.label}
          help={part.help}
          vars={part.vars}
          text={value[part.field] ?? ''}
          changed={value[part.field] !== saved[part.field]}
          onChange={(text) => setValue((v) => ({ ...v, [part.field]: text }))}
        />
      ))}

      <details className="rd-response">
        <summary className="text-label rd-ink2">AI에게 함께 보내는 답의 모양 (코드가 정함 · 읽기만)</summary>
        <dl className="rd-response-list">
          {meta.response.map((f) => (
            <div key={f.name}>
              <dt className="text-mono">{f.name}</dt>
              <dd className="text-body-sm">{f.description}</dd>
            </div>
          ))}
        </dl>
      </details>

      {error ? <ErrorBand error={updateSetting.error!} /> : null}
      <div className="rd-row">
        <Button
          variant="secondary"
          size="sm"
          disabled={!dirty}
          loading={updateSetting.isPending}
          onClick={() => updateSetting.mutate({ key: setting.key, value })}
        >
          저장
        </Button>
        {dirty ? (
          <Button variant="ghost" size="sm" onClick={() => setValue(saved)}>
            고친 것 버리기
          </Button>
        ) : null}
        {!setting.isDefault ? (
          <Button variant="ghost" size="sm" loading={resetSetting.isPending} onClick={() => resetSetting.mutate(setting.key)}>
            기본값으로
          </Button>
        ) : (
          <span className="text-caption rd-muted">기본값이에요</span>
        )}
      </div>
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
  vars: PromptInfo['parts'][number]['vars'];
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
    <div className="iy-field">
      <div className="iy-field-top">
        <span className="iy-field-label">
          {label}
          {changed ? <span className="rd-changed"> · 고침</span> : null}
        </span>
        <span className="iy-field-counter">{text.length.toLocaleString('ko-KR')} / 8,000자</span>
      </div>
      <textarea
        ref={ref}
        className="iy-input iy-textarea rd-prompt"
        aria-label={label}
        value={text}
        rows={Math.min(22, Math.max(6, text.split('\n').length + 1))}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="iy-field-hint">{help}</span>
      {vars.length > 0 ? (
        <div className="rd-slots" aria-label={`${label}에 넣을 수 있는 자리`}>
          {vars.map((v) => (
            <button key={v.name} type="button" className="rd-slot" title={v.help} onClick={() => insert(v.name)}>
              {`{{${v.name}}}`}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
