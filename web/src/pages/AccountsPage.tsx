import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useActions, useProfiles } from '../api/queries';
import type { LoginCheckView, OpenLoginView, Profile } from '../api/types';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { EmptyBox, ErrorBand, LoadingBox } from '../components/StateBox';
import { Badge, Button, CheckList, Glyph, Spinner, StatPill } from '../ds';
import { relativeTime } from '../lib/format';
import { paths } from '../nav/paths';
import { useSelectedTopic } from '../nav/selected-topic';

/** 로그인 상태 → 배지 */
const STATUS_BADGE = {
  ok: { tone: 'success', label: '로그인됨' },
  needs_login: { tone: 'warning', label: '로그인 필요' },
  unknown: { tone: 'neutral', label: '확인 전' },
} as const;

/**
 * 유튜브 화면 언어 한 줄
 * @param lang 화면 언어 (확인 전이면 null)
 */
const langText = (lang: string | null) => (lang ? (lang.startsWith('ko') ? '한국어' : `${lang} (한국어 권장)`) : '확인 전');

/**
 * 계정 관리 (/accounts, RD-26): 댓글을 게시할 크롬 프로필과 유튜브 계정을 연결한다. 등록한 계정의 채널이 곧 '내 채널'이다.
 * 왼쪽은 프로필 카드(핵심만, [자세히]로 채널 ID·폴더), 오른쪽은 '내 채널은 이렇게 정해져요'.
 * 새 프로필 연결 4단계는 머리의 [새 프로필 추가]로 여는 창(모달)에서 한다 (RD-30).
 */
export function AccountsPage() {
  const profiles = useProfiles();
  const connected = profiles.data?.filter((p) => p.loginStatus === 'ok').length;
  /** 새 프로필 추가 창을 열었는지 */
  const [adding, setAdding] = useState(false);
  const addButton = (
    <Button variant="primary" leading={<Icon name="plus" size={16} />} onClick={() => setAdding(true)}>
      새 프로필 추가
    </Button>
  );

  return (
    <div className="rd-page rd-accounts-page">
      <header className="rd-header">
        <div className="rd-header-title">
          <h1 className="text-display">계정 관리</h1>
          <p className="text-body-sm">댓글을 게시할 크롬 프로필과 유튜브 계정을 연결해요. 여기 등록한 계정의 채널이 곧 ‘내 채널’이에요.</p>
        </div>
        <div className="rd-row">
          {profiles.data && connected !== undefined ? <StatPill label="연결된 계정" value={connected} max={Math.max(1, profiles.data.length)} /> : null}
          {addButton}
        </div>
      </header>
      <div className="rd-agrid">
        <div className="rd-stack-16">
          <section aria-label="등록된 프로필" className="rd-stack-16">
            {profiles.isPending ? <LoadingBox>프로필을 불러오는 중…</LoadingBox> : null}
            {profiles.error ? <ErrorBand error={profiles.error} onRetry={() => void profiles.refetch()} /> : null}
            {profiles.data?.length === 0 ? (
              <EmptyBox>
                <span className="rd-stack-12" style={{ alignItems: 'center' }}>
                  <span>아직 프로필이 없어요 · 댓글을 게시할 계정을 먼저 연결해 주세요</span>
                  {addButton}
                </span>
              </EmptyBox>
            ) : null}
            {profiles.data?.map((p) => <ProfileCard key={p.id} profile={p} />)}
          </section>
        </div>
        <div className="rd-accounts-side">
          <section className="rd-note-box" aria-label="내 채널은 이렇게 정해져요">
            <h2 className="text-body-strong" style={{ margin: 0 }}>
              내 채널은 이렇게 정해져요
            </h2>
            <ol>
              <li>여기 등록한 계정의 유튜브 채널만 내 채널이 돼요.</li>
              <li>내 채널 영상과 다른 채널 영상 모두 게시할 수 있어요. 다른 채널 영상 댓글에는 맨 앞에 광고 표시(주제 설정)가 붙어요.</li>
              <li>로그인이 풀린 프로필은 다시 로그인할 때까지 자동 배정에서 빠져요.</li>
            </ol>
          </section>
        </div>
      </div>

      {/* 새 프로필 추가 (RD-30): 닫았다 열면 처음 단계부터. 만든 프로필은 이미 목록에 있어 카드에서 이어서 로그인할 수 있다 */}
      <Modal
        open={adding}
        label="새 프로필 추가"
        title="새 프로필 추가"
        subtitle="이름을 정하면 프로필 폴더를 만들고, 그 폴더로 크롬을 열어 직접 로그인해요."
        width="narrow"
        onClose={() => setAdding(false)}
      >
        <NewProfileWizard onDone={() => setAdding(false)} />
      </Modal>
    </div>
  );
}

/**
 * 프로필 카드: 이름·상태·채널·마지막 확인 / 오늘 게시·화면 언어·쓰는 주제 / [연결 확인] [크롬 열기] [자세히]
 * @param props.profile 프로필
 */
function ProfileCard({ profile: p }: { profile: Profile }) {
  const { openLogin, checkLogin, deleteProfile } = useActions();
  const [result, setResult] = useState<LoginCheckView | null>(null);
  // [크롬 열기] 결과 (다음 할 일 안내). [연결 확인] 결과가 오면 그쪽을 보인다
  const [opened, setOpened] = useState<OpenLoginView | null>(null);
  const [more, setMore] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const badge = STATUS_BADGE[p.loginStatus];
  const check = () =>
    checkLogin.mutate(p.id, {
      onSuccess: (r) => {
        setOpened(null);
        setResult(r);
      },
    });
  const open = () =>
    openLogin.mutate(p.id, {
      onSuccess: (r) => {
        setResult(null);
        setOpened(r);
      },
    });

  return (
    <article className="rd-card rd-acard" aria-label={p.name}>
      <div className="rd-acard-head">
        <span aria-hidden="true" className="rd-acard-avatar">
          {Array.from(p.name)[0] ?? '?'}
        </span>
        <div className="rd-stack" style={{ minWidth: 0, flex: 1 }}>
          <span className="rd-row-tight">
            <span className="text-heading">{p.name}</span>
            {checkLogin.isPending ? (
              <Badge tone="info" loading>
                확인 중
              </Badge>
            ) : (
              <Badge dot tone={badge.tone}>
                {badge.label}
              </Badge>
            )}
          </span>
          <span className="text-caption rd-muted rd-clamp-1">
            채널 <b className="rd-ink">{p.channelTitle ?? '확인 전'}</b> · 마지막 확인 {relativeTime(p.lastCheckedAt)}
          </span>
        </div>
      </div>

      {p.loginStatus !== 'ok' ? (
        <div className="rd-band rd-band-warning">
          <span className="text-body-sm">
            {p.loginStatus === 'needs_login' ? '로그인이 풀렸어요 · 다시 로그인할 때까지 자동 배정에서 빠져요' : '아직 연결을 확인하지 않았어요'}
            {'\n'}크롬 창에서 로그인한 뒤 [연결 확인]을 눌러 주세요 · 창은 열어 둬도 돼요
          </span>
          <Button variant="primary" size="sm" loading={openLogin.isPending} onClick={open}>
            크롬 열어 로그인
          </Button>
        </div>
      ) : null}
      {openLogin.error ? <ErrorBand error={openLogin.error} /> : null}
      {checkLogin.error ? <ErrorBand error={checkLogin.error} /> : null}
      {opened && !result ? (
        <div className="rd-band rd-band-accent">
          <span className="text-body-sm">{opened.message}</span>
        </div>
      ) : null}
      {result ? (
        <div className={`rd-band ${result.warning ? 'rd-band-warning' : 'rd-band-success'}`}>
          <span className="text-body-sm">{result.message}</span>
        </div>
      ) : null}

      <div className="rd-acard-stats">
        <div className="rd-mini-stat">
          <span>오늘 게시</span>
          <b className="tnum">{p.postedToday}개</b>
        </div>
        <div className="rd-mini-stat">
          <span>유튜브 화면 언어</span>
          <b>{langText(p.uiLanguage)}</b>
        </div>
        <div className="rd-mini-stat">
          <span>쓰는 주제</span>
          <b className="rd-clamp-1">{p.topics.length === 0 ? '없음' : p.topics.map((t) => t.name).join(' · ')}</b>
        </div>
      </div>

      <div className="rd-row">
        <Button variant="secondary" loading={checkLogin.isPending} onClick={check}>
          연결 확인
        </Button>
        <Button variant="ghost" loading={openLogin.isPending && p.loginStatus === 'ok'} onClick={open}>
          크롬 열기
        </Button>
        <Button variant="ghost" className="rd-acard-more" aria-expanded={more} onClick={() => setMore((m) => !m)}>
          자세히
          <span className={`rd-chev${more ? ' is-open' : ''}`}>
            <Icon name="chevronDown" size={16} />
          </span>
        </Button>
      </div>

      {more ? (
        <div className="rd-acard-detail">
          <dl>
            <dt>채널 ID</dt>
            <dd className="text-mono rd-clamp-1">{p.channelId ?? '확인 전'}</dd>
            {p.channelId ? <CopyButton text={p.channelId} label="채널 ID 복사" /> : <span />}
            <dt>프로필 폴더</dt>
            <dd className="text-mono rd-clamp-1" title={p.folderPath}>
              {p.folderPath}
            </dd>
            <CopyButton text={p.folderPath} label="프로필 폴더 복사" />
          </dl>
          <div className="rd-acard-delete">
            {confirmDelete ? (
              <>
                <span className="text-caption rd-muted">목록에서만 지워요. 크롬 폴더(로그인 정보)는 남아서 다시 등록하면 그대로 쓸 수 있어요.</span>
                <span className="rd-row-tight">
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                    취소
                  </Button>
                  <Button variant="dark" size="sm" loading={deleteProfile.isPending} onClick={() => deleteProfile.mutate(p.id)}>
                    정말 지우기
                  </Button>
                </span>
              </>
            ) : (
              <Button variant="ghost" size="sm" className="rd-danger-btn" leading={<Icon name="trash" size={14} />} onClick={() => setConfirmDelete(true)}>
                이 프로필 지우기
              </Button>
            )}
          </div>
          {deleteProfile.error ? <ErrorBand error={deleteProfile.error} /> : null}
        </div>
      ) : null}
    </article>
  );
}

/**
 * 복사 단추 (누르면 잠깐 '복사됨')
 * @param props.text 복사할 글
 * @param props.label 단추 이름 (읽기 프로그램용)
 */
function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={label}
      onClick={() =>
        void navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        })
      }
    >
      {done ? '복사됨' : '복사'}
    </Button>
  );
}

/** 새 프로필 연결 단계 이름 */
const WIZARD_STEPS = ['이름 정하기', '크롬에서 로그인', '채널 · 언어 확인', '연결 완료'];

/**
 * 새 프로필 추가 (창 안): 이름 정하기(폴더 만들기) → 크롬 열고 직접 로그인 → 채널·한국어 화면 확인 → 연결 완료
 * @param props.onDone 창 닫기 (연결을 마치고 [목록으로]를 누를 때)
 */
function NewProfileWizard({ onDone }: { onDone: () => void }) {
  const { createProfile, openLogin, checkLogin } = useActions();
  const { topic } = useSelectedTopic();
  const [name, setName] = useState('');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [opened, setOpened] = useState(false);
  // 원격 연결 없이 열려 있던 크롬을 닫고 다시 열었는지 (창이 사라졌다 다시 뜬 이유를 알린다)
  const [restarted, setRestarted] = useState(false);
  const [result, setResult] = useState<LoginCheckView | null>(null);
  // 0 이름 · 1 로그인 · 2 확인 중 · 3 완료 (화면 언어 경고는 완료 뒤에 띠로 보인다)
  const step = !profile ? 0 : result?.profile.loginStatus === 'ok' ? 3 : checkLogin.isPending ? 2 : 1;
  const slug = name.trim().replace(/유튜브/g, 'youtube').replace(/[^A-Za-z0-9_-]/g, '').toLowerCase();
  const nameRef = useRef<HTMLInputElement>(null);
  // 창이 열리면(처음·[하나 더 추가]) 바로 이름을 칠 수 있게. 창이 다 열린 다음 틀에 맞춘다
  useEffect(() => {
    if (step !== 0) return;
    const frame = requestAnimationFrame(() => nameRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [step]);

  const reset = () => {
    setName('');
    setProfile(null);
    setOpened(false);
    setRestarted(false);
    setResult(null);
    createProfile.reset();
    checkLogin.reset();
  };
  const openChrome = (id: number) =>
    openLogin.mutate(id, {
      onSuccess: (r) => {
        setOpened(true);
        setRestarted(r.restarted);
      },
    });

  return (
    <div className="rd-wizard">
      <ol className="rd-wz" aria-label="단계">
        {WIZARD_STEPS.map((label, i) => {
          const state = i < step || step === 3 ? 'done' : i === step ? 'now' : '';
          return (
            <li key={label} className={`rd-wz-s ${state}`} aria-current={i === step && step !== 3 ? 'step' : undefined}>
              <em>{state === 'done' ? <Glyph name="check" size={12} /> : i + 1}</em>
              <span className="rd-wz-label">{label}</span>
            </li>
          );
        })}
      </ol>

      <div className="rd-stack-12" key={step}>
        <span className="text-heading">{WIZARD_STEPS[step]}</span>
        {step === 0 ? (
          <form
            className="rd-stack-8"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) createProfile.mutate({ name: name.trim() }, { onSuccess: setProfile });
            }}
          >
            <label className="text-label rd-ink" htmlFor="rd-pname">
              프로필 이름
            </label>
            <input ref={nameRef} id="rd-pname" className="dk-input" value={name} placeholder="예: 유튜브4" onChange={(e) => setName(e.target.value)} />
            <span className="text-caption rd-muted">
              폴더 이름은 영문으로 만들어요{slug ? <> · <span className="text-mono">{slug}</span></> : ' (유튜브4 → youtube4)'}
            </span>
            {createProfile.error ? <span className="dk-field-error">{createProfile.error.message}</span> : null}
            <Button type="submit" variant="primary" size="lg" fullWidth disabled={name.trim().length === 0} loading={createProfile.isPending}>
              폴더 만들고 다음
            </Button>
          </form>
        ) : null}

        {profile && (step === 1 || step === 2) ? (
          <>
            <div className="rd-stack">
              <span className="text-caption rd-muted">만든 폴더</span>
              <span className="text-mono rd-mono-box">{profile.folderPath}</span>
            </div>
            {opened ? (
              <div className="rd-wz-wait" role="status">
                {step === 2 ? <Spinner size={16} /> : <Icon name="external" size={16} />}
                <span>{step === 2 ? '채널과 화면 언어를 확인하는 중…' : '열린 크롬 창에서 유튜브에 직접 로그인한 뒤 [로그인했어요]를 눌러 주세요'}</span>
              </div>
            ) : (
              <span className="text-body-sm rd-ink2">[크롬 열기]를 누르면 이 프로필 전용 크롬 창이 열려요. 비밀번호는 여기에 저장되지 않아요.</span>
            )}
            <div className="rd-row">
              {opened ? (
                <>
                  <Button variant="primary" size="lg" style={{ flex: 1 }} loading={checkLogin.isPending} onClick={() => checkLogin.mutate(profile.id, { onSuccess: setResult })}>
                    로그인했어요
                  </Button>
                  <Button variant="ghost" loading={openLogin.isPending} onClick={() => openChrome(profile.id)}>
                    크롬 다시 열기
                  </Button>
                </>
              ) : (
                <Button variant="primary" size="lg" fullWidth loading={openLogin.isPending} onClick={() => openChrome(profile.id)}>
                  크롬 열기
                </Button>
              )}
            </div>
            {restarted ? (
              <div className="rd-band rd-band-accent">
                <span className="text-body-sm">열려 있던 이 프로필의 크롬을 닫고 다시 열었어요 · 로그인은 그대로예요</span>
              </div>
            ) : null}
            {openLogin.error ? <ErrorBand error={openLogin.error} /> : null}
            {checkLogin.error ? <ErrorBand error={checkLogin.error} /> : null}
            {result?.warning ? (
              <div className="rd-band rd-band-warning">
                <span className="text-body-sm">{result.message}</span>
              </div>
            ) : null}
            <span className="text-caption rd-muted">비밀번호와 2단계 인증은 크롬 창에서만 입력해요. 로그인된 프로필 폴더만 써요.</span>
          </>
        ) : null}

        {step === 3 && result ? (
          <>
            <div className={`rd-band ${result.warning ? 'rd-band-warning' : 'rd-band-success'}`}>
              <span className="text-body-sm">{result.message}</span>
            </div>
            <CheckList
              items={[
                { label: '구글 로그인 유지됨', ok: true },
                { label: `유튜브 채널 찾음 · ${result.profile.channelTitle ?? result.profile.channelId}`, ok: true },
                { label: '유튜브 화면 언어 한국어 (댓글 창을 정확히 찾으려면 필요해요)', ok: (result.profile.uiLanguage ?? '').startsWith('ko') },
              ]}
            />
            <span className="text-caption rd-muted">다음 할 일: 주제 설정의 ‘쓸 프로필’에서 이 계정을 켜면 자동 배정에 들어가요.</span>
            <div className="rd-row">
              {topic ? (
                <Link to={paths.topic(topic.id, 'settings', { tab: 'post' })} className="dk-btn dk-btn-primary dk-btn-lg" style={{ flex: 1 }}>
                  {topic.name} 주제 설정으로
                </Link>
              ) : null}
              <Button variant={topic ? 'secondary' : 'primary'} onClick={onDone}>
                목록으로
              </Button>
              <Button variant="ghost" onClick={reset}>
                하나 더 추가
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
