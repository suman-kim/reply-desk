import { useId, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useActions, useProfiles, useToday, useTopic } from '../api/queries';
import { ApiError } from '../api/http';
import type { Topic, TopicInput } from '../api/types';
import { FormRow, SaveBar } from '../components/FormBits';
import { Icon } from '../components/Icon';
import { TagInput } from '../components/TagInput';
import { ErrorBand, LoadingBox } from '../components/StateBox';
import { Badge, Button, Segmented, Tabs } from '../ds';
import { paths } from '../nav/paths';
import { useSelectedTopic } from '../nav/selected-topic';

/** 입력 칸 값 (입력 중에는 글자로 들고, 저장할 때 숫자·목록으로 바꾼다) */
interface FormState {
  name: string;
  brandTarget: string;
  /** 검색 키워드 (배지로 하나씩 넣는다) */
  keywords: string[];
  videoWindowDays: string;
  videoSortBy: Topic['videoSortBy'];
  fetchLimit: string;
  tone: string;
  minLength: string;
  maxLength: string;
  bannedWords: string;
  adDisclosure: string;
  dailyCap: string;
  status: Topic['status'];
  profileIds: number[];
}

/** 새 주제 기본값 (계획서 예시) */
const EMPTY: FormState = {
  name: '',
  brandTarget: '',
  keywords: [],
  videoWindowDays: '7',
  videoSortBy: 'view_count',
  fetchLimit: '5',
  tone: '20~30대 시청자, 공감형 구어체',
  minLength: '40',
  maxLength: '120',
  bannedWords: '',
  adDisclosure: '[광고]',
  dailyCap: '5',
  status: 'active',
  profileIds: [],
};

/** 탭과 그 탭의 칸 */
type FormTab = 'promo' | 'search' | 'comment' | 'post';
const TABS: { value: FormTab; label: string; fields: (keyof FormState)[] }[] = [
  { value: 'promo', label: '홍보 대상', fields: ['name', 'brandTarget'] },
  { value: 'search', label: '영상 찾기', fields: ['keywords', 'videoWindowDays', 'videoSortBy', 'fetchLimit'] },
  { value: 'comment', label: '댓글', fields: ['tone', 'minLength', 'maxLength', 'bannedWords'] },
  { value: 'post', label: '게시', fields: ['adDisclosure', 'profileIds', 'dailyCap', 'status'] },
];

/** 쉼표로 나눈 목록 */
const splitList = (s: string) =>
  s
    .split(/[,，]/)
    .map((w) => w.trim())
    .filter(Boolean);

/**
 * 저장된 주제를 입력 칸 값으로
 * @param t 주제
 */
function fromTopic(t: Topic): FormState {
  return {
    name: t.name,
    brandTarget: t.brandTarget,
    keywords: t.keywords,
    videoWindowDays: String(t.videoWindowDays),
    videoSortBy: t.videoSortBy,
    fetchLimit: String(t.fetchLimit),
    tone: t.tone,
    minLength: String(t.minLength),
    maxLength: String(t.maxLength),
    bannedWords: t.bannedWords.join(', '),
    adDisclosure: t.adDisclosure,
    dailyCap: String(t.dailyCap),
    status: t.status,
    profileIds: t.profiles.map((p) => p.id),
  };
}

/** 칸 값이 같은지 (목록은 순서 무시) */
function sameField(a: FormState[keyof FormState], b: FormState[keyof FormState]): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
  return a === b;
}

/**
 * 새 주제 만들기 (/topics/new) · 주제 설정 (/t/:topicId/settings, RD-26). 홍보할 대상 하나가 주제 하나다.
 * 주제 설정은 탭(홍보 대상 · 영상 찾기 · 댓글 · 게시)으로 나누고, 고친 뒤 아래 저장 막대로 저장한다.
 * 새 주제는 한 화면에 모두 두고 [주제 만들기]를 누르면 그 주제의 대시보드로 간다.
 */
export function TopicFormPage() {
  // 주제 설정(/t/:topicId/settings)이면 그 주제, 새 주제(/topics/new)면 없음
  const { topicId: id } = useParams();
  const topicId = id ? Number(id) : null;
  const existing = useTopic(topicId);

  if (topicId && existing.isPending) return <div className="rd-page"><LoadingBox>주제를 불러오는 중…</LoadingBox></div>;
  if (topicId && existing.error) return <div className="rd-page"><ErrorBand error={existing.error} onRetry={() => void existing.refetch()} /></div>;
  return <TopicForm key={topicId ?? 'new'} topicId={topicId} saved={existing.data ? fromTopic(existing.data) : EMPTY} />;
}

/**
 * 주제 입력 칸들
 * @param props.topicId 고칠 주제 (새 주제면 null)
 * @param props.saved 저장된 값 (새 주제면 기본값). 저장하면 새 값으로 바뀐다
 */
function TopicForm({ topicId, saved }: { topicId: number | null; saved: FormState }) {
  const navigate = useNavigate();
  const profiles = useProfiles();
  const today = useToday();
  const { createTopic, updateTopic, deleteTopic } = useActions();
  const [f, setF] = useState<FormState>(saved);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [params, setParams] = useSearchParams();
  const { topic: selected } = useSelectedTopic();
  const isNew = topicId === null;
  const tab = TABS.find((t) => t.value === params.get('tab'))?.value ?? 'promo';

  const save = isNew ? createTopic : updateTopic;
  const err = save.error instanceof ApiError ? save.error.fieldErrors : {};
  const dirtyFields = (Object.keys(f) as (keyof FormState)[]).filter((k) => !sameField(f[k], saved[k]));
  /** 칸 하나 바꾸기 */
  const put = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));
  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => put(k, e.target.value as never);

  const pickTab = (v: string) => {
    const p = new URLSearchParams(params);
    if (v === 'promo') p.delete('tab');
    else p.set('tab', v);
    setParams(p, { replace: true });
  };

  const onSave = () => {
    const input: TopicInput = {
      name: f.name,
      brandTarget: f.brandTarget,
      keywords: f.keywords,
      videoWindowDays: Number(f.videoWindowDays),
      videoSortBy: f.videoSortBy,
      fetchLimit: Number(f.fetchLimit),
      tone: f.tone,
      minLength: Number(f.minLength),
      maxLength: Number(f.maxLength),
      bannedWords: splitList(f.bannedWords),
      adDisclosure: f.adDisclosure.trim(),
      dailyCap: Number(f.dailyCap),
      status: f.status,
      profileIds: f.profileIds,
    };
    const onError = (e: Error) => {
      // 오류 난 칸이 있는 첫 탭으로
      const fields = e instanceof ApiError ? Object.keys(e.fieldErrors) : [];
      const t = TABS.find((x) => x.fields.some((k) => fields.includes(k)));
      if (!isNew && t && t.value !== tab) pickTab(t.value);
    };
    if (isNew) {
      // 새 주제는 만든 뒤 그 주제의 대시보드로 (다음 할 일: 영상 불러오기)
      createTopic.mutate(input, { onSuccess: (t) => void navigate(paths.topic(t.id, 'dashboard')), onError });
    } else {
      updateTopic.mutate(
        { id: topicId, input },
        {
          onSuccess: (t) => {
            setF(fromTopic(t));
            setSavedNote(`저장했어요 · ${new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} · 다음 불러오기·초안부터 적용돼요`);
          },
          onError,
        },
      );
    }
  };

  // 전체 하루 상한은 설정(서버) 값. 불러오기 전에는 비교하지 않는다
  const totalCap = today.data?.cap;
  const capBad = totalCap !== undefined && Number(f.dailyCap) > totalCap;
  const changed = (k: keyof FormState) => dirtyFields.includes(k);

  const sections: Record<FormTab, ReactNode> = {
    promo: <PromoFields f={f} set={set} err={err} changed={changed} />,
    search: <SearchFields f={f} put={put} err={err} changed={changed} />,
    comment: <CommentFields f={f} set={set} err={err} changed={changed} />,
    post: (
      <PostFields
        f={f}
        set={set}
        put={put}
        err={err}
        changed={changed}
        isNew={isNew}
        profiles={profiles.data ?? []}
        totalCap={totalCap}
        capBad={capBad}
      />
    ),
  };

  return (
    <div className="rd-page rd-topicform">
      <header className="rd-header">
        <div className="rd-header-title">
          <h1 className="text-display">{isNew ? '새 주제 만들기' : '주제 설정'}</h1>
          <p className="text-body-sm">홍보할 대상 하나가 주제 하나예요. 이 설정으로 영상을 찾고 댓글 초안을 써요.</p>
        </div>
        {isNew ? (
          <Link to={selected ? paths.topic(selected.id) : paths.home} className="dk-btn dk-btn-ghost dk-btn-md">
            취소
          </Link>
        ) : null}
      </header>

      {isNew ? (
        // 새 주제: 한 화면에 차례로
        TABS.map((t) => (
          <section key={t.value} aria-label={t.label} className="rd-fsection">
            <h2 className="text-heading rd-section-title">{t.label}</h2>
            {sections[t.value]}
          </section>
        ))
      ) : (
        <>
          <Tabs
            label="주제 설정 나누기"
            value={tab}
            onChange={pickTab}
            items={TABS.map((t) => ({ value: t.value, label: t.label, marked: t.fields.some((k) => changed(k) || k in err) }))}
          />
          <section role="tabpanel" aria-label={TABS.find((t) => t.value === tab)!.label} className="rd-fsection">
            {sections[tab]}
            {tab === 'post' ? (
              <div className="rd-danger-zone">
                <div className="rd-stack" style={{ minWidth: 0 }}>
                  <span className="text-body-strong">이 주제 지우기</span>
                  <span className="text-caption rd-muted">영상 목록 · 분석 · 초안이 함께 지워져요. 댓글 게시 목록은 남아요.</span>
                  {deleteTopic.error ? <ErrorBand error={deleteTopic.error} /> : null}
                </div>
                {confirmDelete ? (
                  <span className="rd-row">
                    <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                      취소
                    </Button>
                    <Button variant="dark" loading={deleteTopic.isPending} onClick={() => deleteTopic.mutate(topicId, { onSuccess: () => void navigate(paths.home) })}>
                      정말 지우기
                    </Button>
                  </span>
                ) : (
                  <Button variant="secondary" className="rd-danger-btn" leading={<Icon name="trash" size={16} />} onClick={() => setConfirmDelete(true)}>
                    주제 지우기
                  </Button>
                )}
              </div>
            ) : null}
          </section>
        </>
      )}

      <SaveBar
        dirty={dirtyFields.length}
        saving={save.isPending}
        note={savedNote ?? undefined}
        error={save.error ? save.error.message : null}
        saveLabel={isNew ? '주제 만들기' : '저장'}
        onSave={onSave}
        onRevert={() => {
          setF(saved);
          save.reset();
        }}
      />
    </div>
  );
}

/** 칸 묶음이 함께 받는 값 */
interface FieldsProps {
  f: FormState;
  err: Record<string, string>;
  changed: (k: keyof FormState) => boolean;
}

/**
 * 글 입력 칸 (이름 · 설명 · 오류)
 * @param props.id 칸 id
 * @param props.value 값
 * @param props.onChange 바뀔 때
 * @param props.error 오류
 * @param props.placeholder 예시
 * @param props.multiline 여러 줄
 * @param props.width 최대 너비
 * @param props.mono 고정폭 글꼴(숫자)
 */
function TextInput({
  id,
  value,
  onChange,
  error,
  placeholder,
  multiline,
  width,
  mono,
}: {
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  error?: string;
  placeholder?: string;
  multiline?: boolean;
  width?: number;
  mono?: boolean;
}) {
  const common = {
    id,
    value,
    onChange,
    placeholder,
    'aria-invalid': error ? ('true' as const) : undefined,
    style: width ? { maxWidth: width } : undefined,
  };
  return (
    <>
      {multiline ? (
        <textarea {...common} className="dk-input dk-textarea" rows={3} />
      ) : (
        <input {...common} className={`dk-input${mono ? ' text-mono' : ''}`} inputMode={mono ? 'numeric' : undefined} />
      )}
      {error ? <span className="dk-field-error">{error}</span> : null}
    </>
  );
}

/**
 * 홍보 대상: 주제 이름 · 한 줄 설명
 * @param props 칸 묶음 값
 * @param props.set 글 칸 바꾸기
 */
function PromoFields({ f, set, err, changed }: FieldsProps & { set: (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void }) {
  const id = useId();
  return (
    <>
      <FormRow label="주제 이름" htmlFor={`${id}-name`} help="왼쪽 메뉴와 화면 위에 쓰여요" changed={changed('name')}>
        <TextInput id={`${id}-name`} value={f.name} onChange={set('name')} placeholder="예: 운명원 연애 사주" error={err.name} />
      </FormRow>
      <FormRow label="한 줄 설명" htmlFor={`${id}-brand`} help="AI가 댓글을 쓸 때 참고해요" changed={changed('brandTarget')}>
        <TextInput id={`${id}-brand`} value={f.brandTarget} onChange={set('brandTarget')} placeholder="예: 운명원 · 연애 사주 잘 보는 곳" error={err.brandTarget} />
      </FormRow>
    </>
  );
}

/**
 * 영상 찾기: 검색 키워드 · 올린 날짜 · 목록 순위 기준 · 한 번에 불러올 수
 * @param props 칸 묶음 값
 * @param props.put 칸 바꾸기
 */
function SearchFields({ f, put, err, changed }: FieldsProps & { put: <K extends keyof FormState>(k: K, v: FormState[K]) => void }) {
  return (
    <>
      <FormRow label="검색 키워드" help="하나라도 들어간 영상을 찾아요" changed={changed('keywords')}>
        <TagInput
          label="검색 키워드"
          values={f.keywords}
          onChange={(keywords) => put('keywords', keywords)}
          placeholder="예: 연애"
          hint="하나 적고 Enter나 [추가]를 눌러요"
          error={err.keywords}
          max={10}
          maxLength={40}
          emptyText="아직 키워드가 없어요 · 하나 이상 넣어 주세요"
          hideLabel
        />
      </FormRow>
      <FormRow label="올린 날짜" changed={changed('videoWindowDays')}>
        <div>
          <Segmented
            label="올린 날짜"
            value={f.videoWindowDays}
            onChange={(v) => put('videoWindowDays', v)}
            options={[
              { value: '1', label: '24시간 안' },
              { value: '3', label: '3일 안' },
              { value: '7', label: '7일 안' },
              { value: '30', label: '30일 안' },
              { value: '0', label: '상관없음' },
            ]}
          />
        </div>
        <span className="text-caption rd-muted">
          {f.videoWindowDays === '0'
            ? '올린 날짜와 상관없이 찾아요'
            : `지금부터 ${f.videoWindowDays === '1' ? '24시간' : `${f.videoWindowDays}일`} 안에 올라온 영상만 찾아요 · 조회수는 그 영상의 전체 조회수예요`}
        </span>
      </FormRow>
      <FormRow label="목록 순위 기준" help="불러온 영상에 순위를 매기는 기준이에요" changed={changed('videoSortBy')}>
        <div>
          <Segmented
            label="목록 순위 기준"
            value={f.videoSortBy}
            onChange={(v) => put('videoSortBy', v as Topic['videoSortBy'])}
            options={[
              { value: 'view_count', label: '조회수 높은 순' },
              { value: 'date', label: '최신순' },
            ]}
          />
        </div>
        <span className="text-caption rd-muted">
          유튜브 검색은 관련도 순으로 받고, 이 기준으로 위에서부터 한 번에 불러올 수만큼 남겨요 · 영상 목록에서는 관련도 · 조회수 · 최신으로 바로 다시 정렬할 수 있어요
        </span>
      </FormRow>
      <FormRow label="한 번에 불러올 영상 수" changed={changed('fetchLimit')}>
        <div>
          <Segmented
            label="한 번에 불러올 영상 수"
            value={f.fetchLimit}
            onChange={(v) => put('fetchLimit', v)}
            options={[
              // 예전에 정한 다른 수(예: 7)도 고른 채로 보이게 넣는다
              ...(['5', '10', '20', '50', '0'].includes(f.fetchLimit) ? [] : [{ value: f.fetchLimit, label: `${f.fetchLimit}개` }]),
              { value: '5', label: '5개' },
              { value: '10', label: '10개' },
              { value: '20', label: '20개' },
              { value: '50', label: '50개' },
              { value: '0', label: '무제한' },
            ]}
          />
        </div>
        {err.fetchLimit ? <span className="dk-field-error">{err.fetchLimit}</span> : null}
        <span className="text-caption rd-muted">
          {f.fetchLimit === '0'
            ? '검색 결과 끝까지(최대 500개) 가져와요 · 유튜브 할당량을 한 번에 최대 1,000 써요 (하루 10,000)'
            : '불러오기는 영상만 가져와요 · 초안은 작업 상세에서 [초안 작성]을 누를 때 써요'}
        </span>
      </FormRow>
    </>
  );
}

/**
 * 댓글: 말투 · 글자 수 · 추가 금지 표현
 * @param props 칸 묶음 값
 * @param props.set 글 칸 바꾸기
 */
function CommentFields({ f, set, err, changed }: FieldsProps & { set: (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void }) {
  const id = useId();
  return (
    <>
      <FormRow label="댓글 말투" htmlFor={`${id}-tone`} help="AI가 이 말투와 조건으로 초안을 써요" changed={changed('tone')}>
        <TextInput id={`${id}-tone`} value={f.tone} onChange={set('tone')} multiline error={err.tone} />
      </FormRow>
      <FormRow label="글자 수" help="광고 표시는 세지 않아요" changed={changed('minLength') || changed('maxLength')}>
        <div className="rd-range">
          <span className="rd-stack" style={{ gap: 6 }}>
            <label className="text-caption rd-muted" htmlFor={`${id}-min`}>
              최소
            </label>
            <TextInput id={`${id}-min`} value={f.minLength} onChange={set('minLength')} mono error={err.minLength} />
          </span>
          <span className="rd-range-dash" aria-hidden="true">
            –
          </span>
          <span className="rd-stack" style={{ gap: 6 }}>
            <label className="text-caption rd-muted" htmlFor={`${id}-max`}>
              최대
            </label>
            <TextInput id={`${id}-max`} value={f.maxLength} onChange={set('maxLength')} mono error={err.maxLength} />
          </span>
        </div>
      </FormRow>
      <FormRow label="추가 금지 표현" htmlFor={`${id}-ban`} help="쉼표로 나눠요" changed={changed('bannedWords')}>
        <TextInput id={`${id}-ban`} value={f.bannedWords} onChange={set('bannedWords')} placeholder="예: 무료, 할인, 100% 맞춤" error={err.bannedWords} />
        <span className="text-caption rd-muted">모든 주제 공통으로 링크 · 해시태그 · 이용 후기처럼 지어낸 표현은 쓰지 않아요</span>
      </FormRow>
    </>
  );
}

/**
 * 게시: 광고 표시 · 쓸 프로필 · 하루 상한 · 상태(주제 설정만)
 * @param props 칸 묶음 값
 */
function PostFields({
  f,
  set,
  put,
  err,
  changed,
  isNew,
  profiles,
  totalCap,
  capBad,
}: FieldsProps & {
  set: (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  put: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  isNew: boolean;
  profiles: { id: number; name: string; loginStatus: string; channelTitle: string | null }[];
  totalCap: number | undefined;
  capBad: boolean;
}) {
  const id = useId();
  return (
    <>
      <FormRow label="광고 표시" htmlFor={`${id}-ad`} help="다른 채널 영상에만 붙어요" changed={changed('adDisclosure')}>
        <TextInput id={`${id}-ad`} value={f.adDisclosure} onChange={set('adDisclosure')} placeholder="예: [광고]" width={240} error={err.adDisclosure} />
        <span className="text-caption rd-muted">
          댓글 맨 앞에 붙여 업체 홍보 댓글임을 밝혀요 · ‘광고’나 ‘협찬’이 들어가야 해요 · 내 채널 영상에는 붙이지 않아요
        </span>
      </FormRow>
      <FormRow label="쓸 프로필" help="자동이면 차례대로 돌려 써요" changed={changed('profileIds')}>
        {profiles.length === 0 ? (
          <span className="text-body-sm rd-muted">
            아직 프로필이 없어요 · <Link to={paths.accounts}>계정 관리</Link>에서 먼저 연결해 주세요
          </span>
        ) : (
          <div role="group" aria-label="쓸 프로필" className="rd-pick-list">
            {profiles.map((p) => (
              <label key={p.id} className="rd-pick">
                <input
                  type="checkbox"
                  checked={f.profileIds.includes(p.id)}
                  onChange={(e) => put('profileIds', e.target.checked ? [...f.profileIds, p.id] : f.profileIds.filter((x) => x !== p.id))}
                />
                <span className="rd-pick-name">
                  {p.name}
                  {p.channelTitle ? <span className="text-caption rd-muted"> · {p.channelTitle}</span> : null}
                </span>
                <Badge tone={p.loginStatus === 'ok' ? 'success' : 'warning'} dot>
                  {p.loginStatus === 'ok' ? '연결됨' : '로그인 필요'}
                </Badge>
              </label>
            ))}
          </div>
        )}
        {err.profileIds ? <span className="dk-field-error">{err.profileIds}</span> : null}
      </FormRow>
      <FormRow
        label="하루 상한"
        htmlFor={`${id}-cap`}
        help={totalCap !== undefined ? `전체 하루 ${totalCap}개 안에서 나눠 써요` : '전체 하루 상한 안에서 나눠 써요'}
        changed={changed('dailyCap')}
      >
        <span className="rd-row">
          <TextInput id={`${id}-cap`} value={f.dailyCap} onChange={set('dailyCap')} mono width={120} />
          <span className="text-body-sm rd-muted">개</span>
        </span>
        {err.dailyCap || capBad ? <span className="dk-field-error">{err.dailyCap ?? `전체 하루 상한(${totalCap})보다 클 수 없어요`}</span> : null}
      </FormRow>
      {!isNew ? (
        <FormRow label="상태" help="일시정지하면 새 영상을 찾지 않고 게시도 멈춰요" changed={changed('status')}>
          <div>
            <Segmented
              label="주제 상태"
              value={f.status}
              onChange={(v) => put('status', v as Topic['status'])}
              options={[
                { value: 'active', label: '진행 중' },
                { value: 'paused', label: '일시정지' },
              ]}
            />
          </div>
        </FormRow>
      ) : null}
    </>
  );
}
