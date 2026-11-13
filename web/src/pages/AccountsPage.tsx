import { useState } from 'react';
import { useActions, useProfiles } from '../api/queries';
import type { LoginCheckView, Profile } from '../api/types';
import { PageHeader } from '../components/PageHeader';
import { EmptyBox, ErrorBand, LoadingBox } from '../components/StateBox';
import { Badge, BrowserFrame, Button, CheckList, Field, Panel, ReasonBox, StatPill, StepList, type StepItem } from '../ds/inyeon';
import { relativeTime } from '../lib/format';

/** 로그인 상태 → 배지 */
const STATUS_BADGE = {
  ok: { tone: 'success', label: '연결됨' },
  needs_login: { tone: 'warning', label: '로그인 필요' },
  unknown: { tone: 'neutral', label: '확인 전' },
} as const;

/**
 * 계정 관리: 크롬 프로필과 유튜브 계정을 연결한다. 등록한 계정의 채널이 곧 '내 채널'이다.
 */
export function AccountsPage() {
  const profiles = useProfiles();
  const connected = profiles.data?.filter((p) => p.loginStatus === 'ok').length ?? 0;

  return (
    <div className="rd-page">
      <PageHeader
        title="계정 관리"
        description="댓글을 게시할 크롬 프로필과 유튜브 계정을 연결해요. 등록한 계정의 채널이 곧 '내 채널'이에요."
        right={<StatPill label="연결된 계정" value={connected} max={Math.max(1, profiles.data?.length ?? 0)} />}
      />
      <div className="rd-accounts">
        <section aria-label="등록된 프로필" className="rd-cards">
          {profiles.isPending ? <LoadingBox>프로필을 불러오는 중…</LoadingBox> : null}
          {profiles.error ? <ErrorBand error={profiles.error} onRetry={() => void profiles.refetch()} /> : null}
          {profiles.data?.length === 0 ? <EmptyBox>아직 프로필이 없어요 · 오른쪽 [새 프로필 추가]에서 만들어 주세요</EmptyBox> : null}
          {profiles.data?.map((p) => <ProfileCard key={p.id} profile={p} />)}
        </section>
        <div className="rd-side">
          <NewProfileWizard />
          <ReasonBox
            tone="accent"
            label="내 채널은 이렇게 정해져요"
            items={[
              '여기 등록한 계정의 유튜브 채널만 내 채널이 돼요',
              '실제 게시는 내 채널에 올린 영상에만 돼요. 다른 채널 영상은 초안까지예요',
              '로그인이 풀린 프로필은 다시 로그인할 때까지 자동 배정에서 빠져요',
            ]}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * 프로필 카드
 * @param props.profile 프로필
 */
function ProfileCard({ profile: p }: { profile: Profile }) {
  const { openLogin, checkLogin, deleteProfile } = useActions();
  const [result, setResult] = useState<LoginCheckView | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const badge = STATUS_BADGE[p.loginStatus];
  const check = () => checkLogin.mutate(p.id, { onSuccess: setResult });

  return (
    <article className="rd-card">
      <div className="rd-card-head">
        <div className="rd-row" style={{ flexWrap: 'nowrap', minWidth: 0 }}>
          <span aria-hidden="true" className="rd-avatar">
            {p.name.slice(0, 1)}
          </span>
          <div className="rd-stack" style={{ minWidth: 0 }}>
            <span className="text-heading">{p.name}</span>
            <span className="text-caption rd-muted">{p.channelTitle ?? '채널 확인 전'}</span>
          </div>
        </div>
        <Badge dot tone={badge.tone}>
          {badge.label}
        </Badge>
      </div>

      {p.loginStatus !== 'ok' ? (
        <div className="rd-band rd-band-warning">
          <span className="text-body-sm">
            {p.loginStatus === 'needs_login' ? '로그인이 풀렸어요 · 다시 로그인할 때까지 자동 배정에서 빠져요' : '아직 연결을 확인하지 않았어요'}
            {'\n'}크롬 창에서 로그인한 뒤 [연결 확인]을 눌러 주세요 · 창은 열어 둬도 돼요
          </span>
          <Button variant="primary" size="sm" loading={openLogin.isPending} onClick={() => openLogin.mutate(p.id)}>
            크롬 열어 로그인
          </Button>
        </div>
      ) : null}
      {openLogin.error ? <ErrorBand error={openLogin.error} /> : null}
      {checkLogin.error ? <ErrorBand error={checkLogin.error} /> : null}
      {result ? (
        <div className={`rd-band ${result.warning ? 'rd-band-warning' : 'rd-band-success'}`}>
          <span className="text-body-sm">{result.message}</span>
        </div>
      ) : null}

      <dl className="rd-dl">
        <div>
          <dt className="text-label">채널 ID</dt>
          <dd className="text-mono">{p.channelId ?? '확인 전'}</dd>
        </div>
        <div>
          <dt className="text-label">마지막 확인</dt>
          <dd className="text-body-sm">{relativeTime(p.lastCheckedAt)}</dd>
        </div>
        <div>
          <dt className="text-label">유튜브 화면 언어</dt>
          <dd className="text-body-sm">{p.uiLanguage ? (p.uiLanguage.startsWith('ko') ? '한국어' : `${p.uiLanguage} (한국어 권장)`) : '확인 전'}</dd>
        </div>
        <div>
          <dt className="text-label">오늘 게시</dt>
          <dd className="text-body-sm">{p.postedToday}개</dd>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <dt className="text-label">프로필 폴더</dt>
          <dd className="text-mono">{p.folderPath}</dd>
        </div>
      </dl>

      <div className="rd-card-foot">
        <div className="rd-row-tight">
          <span className="text-caption rd-muted">쓰는 주제</span>
          {p.topics.length === 0 ? <span className="text-caption rd-muted">없음</span> : p.topics.map((t) => <Badge key={t.id}>{t.name}</Badge>)}
        </div>
        <div className="rd-row-tight">
          <Button variant="secondary" size="sm" loading={checkLogin.isPending} onClick={check}>
            연결 확인
          </Button>
          <Button variant="ghost" size="sm" onClick={() => openLogin.mutate(p.id)}>
            크롬 열기
          </Button>
          {confirmDelete ? (
            <>
              <Button variant="dark" size="sm" loading={deleteProfile.isPending} onClick={() => deleteProfile.mutate(p.id)}>
                정말 지우기
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                취소
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
              지우기
            </Button>
          )}
        </div>
      </div>
      {confirmDelete ? (
        <span className="text-caption rd-muted">목록에서만 지워요. 크롬 폴더(로그인 정보)는 남아서 다시 등록하면 그대로 쓸 수 있어요.</span>
      ) : null}
      {deleteProfile.error ? <ErrorBand error={deleteProfile.error} /> : null}
    </article>
  );
}

/**
 * 새 프로필 추가: 폴더 만들기 → 크롬 열고 직접 로그인 → 채널·한국어 화면 확인 → 연결 완료
 */
function NewProfileWizard() {
  const { createProfile, openLogin, checkLogin } = useActions();
  const [name, setName] = useState('');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [opened, setOpened] = useState(false);
  const [result, setResult] = useState<LoginCheckView | null>(null);
  // 연결 완료는 로그인·채널 확인이 끝난 것 (화면 언어 경고는 완료 뒤에 띠로 보인다)
  const step = !profile ? 0 : result?.profile.loginStatus === 'ok' ? 3 : checkLogin.isPending ? 2 : 1;
  // 스피너(active)는 요청이 실제로 도는 동안에만 보인다. 사람이 입력·로그인하기를 기다릴 때는 멈춰 있다
  const busy = createProfile.isPending || openLogin.isPending || checkLogin.isPending;
  const state = (i: number): StepItem['state'] => (i < step || step === 3 ? 'done' : i === step && busy ? 'active' : 'pending');

  const reset = () => {
    setName('');
    setProfile(null);
    setOpened(false);
    setResult(null);
    createProfile.reset();
    checkLogin.reset();
  };

  return (
    <Panel title="새 프로필 추가" hint="이름을 정하면 프로필 폴더를 만들고, 그 폴더로 크롬을 열어 직접 로그인해요">
      <StepList
        steps={[
          { label: '프로필 폴더 만들기', state: state(0) },
          { label: '크롬 열고 직접 로그인', state: state(1) },
          { label: '유튜브 채널·한국어 화면 확인', state: state(2) },
          { label: '연결 완료', state: step === 3 ? 'done' : 'pending' },
        ]}
      />
      {step === 0 ? (
        <>
          <Field
            label="프로필 이름"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 유튜브4"
            hint="폴더 이름은 영문으로 만들어요 (유튜브4 → youtube4)"
            error={createProfile.error?.message}
          />
          <Button
            variant="primary"
            fullWidth
            disabled={name.trim().length === 0}
            loading={createProfile.isPending}
            onClick={() => createProfile.mutate({ name: name.trim() }, { onSuccess: setProfile })}
          >
            폴더 만들고 다음
          </Button>
        </>
      ) : null}
      {profile && step < 3 ? (
        <>
          <div className="rd-stack">
            <span className="text-label rd-ink2">만든 폴더</span>
            <span className="text-mono rd-mono-box">{profile.folderPath}</span>
          </div>
          <BrowserFrame profile={`${profile.name} 프로필`} url={opened ? 'accounts.google.com/signin' : 'about:blank'} minHeight={140}>
            <p className="text-body-sm rd-muted" style={{ margin: 'auto 0', textAlign: 'center' }}>
              {opened ? '열린 크롬 창에서 직접 로그인한 뒤 [로그인했어요]를 눌러 주세요 · 창은 열어 둬도 돼요' : '[크롬 열기]를 누르면 이 프로필 전용 크롬 창이 열려요'}
            </p>
          </BrowserFrame>
          <div className="rd-row">
            <Button
              variant={opened ? 'secondary' : 'primary'}
              loading={openLogin.isPending}
              onClick={() => openLogin.mutate(profile.id, { onSuccess: () => setOpened(true) })}
            >
              크롬 열기
            </Button>
            <Button
              variant={opened ? 'primary' : 'secondary'}
              disabled={!opened}
              loading={checkLogin.isPending}
              onClick={() => checkLogin.mutate(profile.id, { onSuccess: setResult })}
            >
              로그인했어요
            </Button>
          </div>
          {openLogin.error ? <ErrorBand error={openLogin.error} /> : null}
          {checkLogin.error ? <ErrorBand error={checkLogin.error} /> : null}
          {result?.warning ? (
            <div className="rd-band rd-band-warning">
              <span className="text-body-sm">{result.message}</span>
            </div>
          ) : null}
          <span className="text-caption rd-muted">
            비밀번호와 2단계 인증은 크롬 창에서만 입력해요. 대시보드는 로그인 정보를 저장하지 않고, 로그인된 프로필 폴더만 써요.
          </span>
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
              { label: '유튜브 화면 언어 한국어', ok: (result.profile.uiLanguage ?? '').startsWith('ko') },
            ]}
          />
          <Button variant="secondary" fullWidth onClick={reset}>
            다른 프로필 추가
          </Button>
        </>
      ) : null}
    </Panel>
  );
}
