import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useActions, useProfiles, useToday, useTopic } from '../api/queries';
import { ApiError } from '../api/http';
import type { Topic, TopicInput } from '../api/types';
import { PageHeader } from '../components/PageHeader';
import { TagInput } from '../components/TagInput';
import { ErrorBand, LoadingBox } from '../components/StateBox';
import { Button, Field, Panel, Segmented } from '../ds/inyeon';

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

/**
 * 새 주제 만들기 / 주제 설정. 홍보할 대상 하나가 주제 하나다.
 */
export function TopicFormPage() {
  const { id } = useParams();
  const topicId = id ? Number(id) : null;
  const existing = useTopic(topicId);

  if (topicId && existing.isPending) return <div className="rd-page"><LoadingBox>주제를 불러오는 중…</LoadingBox></div>;
  if (topicId && existing.error) return <div className="rd-page"><ErrorBand error={existing.error} onRetry={() => void existing.refetch()} /></div>;
  return <TopicForm key={topicId ?? 'new'} topicId={topicId} initial={existing.data ? fromTopic(existing.data) : EMPTY} />;
}

/**
 * 주제 입력 칸들
 * @param props.topicId 고칠 주제 (새 주제면 null)
 * @param props.initial 처음 값
 */
function TopicForm({ topicId, initial }: { topicId: number | null; initial: FormState }) {
  const navigate = useNavigate();
  const profiles = useProfiles();
  const today = useToday();
  const { createTopic, updateTopic, deleteTopic } = useActions();
  const [f, setF] = useState<FormState>(initial);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = topicId ? updateTopic : createTopic;
  const err = save.error instanceof ApiError ? save.error.fieldErrors : {};
  /** 입력 칸 하나를 바꾸는 함수 */
  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

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
    const done = (t: Topic) => navigate(`/?topic=${t.id}`);
    if (topicId) updateTopic.mutate({ id: topicId, input }, { onSuccess: done });
    else createTopic.mutate(input, { onSuccess: done });
  };

  // 전체 하루 상한은 설정(서버) 값. 불러오기 전에는 비교하지 않는다
  const totalCap = today.data?.cap;
  const capBad = totalCap !== undefined && Number(f.dailyCap) > totalCap;

  return (
    <div className="rd-page rd-page-narrow">
      <PageHeader
        title={topicId ? '주제 설정' : '새 주제 만들기'}
        description="홍보할 대상 하나가 주제 하나예요. 이 설정으로 영상을 찾고 댓글 초안을 써요."
        right={
          <>
            <Link to={topicId ? `/?topic=${topicId}` : '/'} className="iy-btn iy-btn-secondary iy-btn-md">
              취소
            </Link>
            <Button variant="primary" loading={save.isPending} onClick={onSave}>
              주제 저장
            </Button>
          </>
        }
      />
      {save.error ? <ErrorBand error={save.error} /> : null}

      <div className="rd-form">
        <Panel title="홍보 대상" hint="댓글에서 자연스럽게 떠올리게 할 대상이에요">
          <Field label="주제 이름" value={f.name} onChange={set('name')} placeholder="예: 운명원 연애 사주" error={err.name} />
          <Field
            label="한 줄 설명"
            value={f.brandTarget}
            onChange={set('brandTarget')}
            placeholder="예: 운명원 · 연애 사주 잘 보는 곳"
            hint="AI가 댓글을 쓸 때 참고해요"
            error={err.brandTarget}
          />
        </Panel>

        <Panel title="영상 찾기" hint="① 불러오기에서 이 조건으로 영상을 모아 정렬해요">
          <TagInput
            label="검색 키워드"
            values={f.keywords}
            onChange={(keywords) => setF((s) => ({ ...s, keywords }))}
            placeholder="예: 연애"
            hint="하나 적고 Enter나 [추가]를 눌러요 · 키워드 중 하나라도 들어간 영상을 찾아요"
            error={err.keywords}
            max={10}
            maxLength={40}
            emptyText="아직 키워드가 없어요 · 하나 이상 넣어 주세요"
          />
          <div className="rd-stack-8">
            <span className="text-label rd-label">올린 날짜</span>
            <Segmented
              label="올린 날짜"
              block
              value={f.videoWindowDays}
              onChange={(v) => setF((s) => ({ ...s, videoWindowDays: v }))}
              options={[
                { value: '1', label: '24시간 안' },
                { value: '3', label: '3일 안' },
                { value: '7', label: '7일 안' },
                { value: '30', label: '30일 안' },
                { value: '0', label: '상관없음' },
              ]}
            />
            <span className="text-caption rd-muted">
              {f.videoWindowDays === '0'
                ? '올린 날짜와 상관없이 찾아요'
                : `지금부터 ${f.videoWindowDays === '1' ? '24시간' : `${f.videoWindowDays}일`} 안에 올라온 영상만 찾아요 · 조회수는 그 영상의 전체 조회수예요`}
            </span>
          </div>
          <div className="rd-stack-8">
            <span className="text-label rd-label">정렬</span>
            <Segmented
              label="정렬"
              block
              value={f.videoSortBy}
              onChange={(v) => setF((s) => ({ ...s, videoSortBy: v as Topic['videoSortBy'] }))}
              options={[
                { value: 'view_count', label: '조회수 높은 순' },
                { value: 'date', label: '최신순' },
              ]}
            />
          </div>
          <div className="rd-stack-8">
            <span className="text-label rd-label">한 번에 불러올 영상 수</span>
            <Segmented
              label="한 번에 불러올 영상 수"
              block
              value={f.fetchLimit}
              onChange={(v) => setF((s) => ({ ...s, fetchLimit: v }))}
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
            <span className={`text-caption ${err.fetchLimit ? 'rd-block-reason' : 'rd-muted'}`}>
              {err.fetchLimit ??
                (f.fetchLimit === '0'
                  ? '검색 결과 끝까지(최대 500개) 가져와요 · 유튜브 할당량을 한 번에 최대 1,000 써요 (하루 10,000)'
                  : '불러오기는 영상만 가져와요 · 초안은 ② 영상 선택에서 [초안 작성]을 누를 때 써요')}
            </span>
          </div>
        </Panel>

        <Panel title="댓글" hint="AI가 이 말투와 조건으로 초안을 써요">
          <Field label="댓글 말투" multiline rows={2} value={f.tone} onChange={set('tone')} error={err.tone} />
          <div className="rd-two">
            <Field label="최소 글자 수" type="number" value={f.minLength} onChange={set('minLength')} error={err.minLength} />
            <Field label="최대 글자 수" type="number" value={f.maxLength} onChange={set('maxLength')} error={err.maxLength} />
          </div>
          <Field
            label="추가 금지 표현"
            value={f.bannedWords}
            onChange={set('bannedWords')}
            placeholder="예: 무료, 할인, 100% 맞춤"
            hint="쉼표로 나눠요 · 공통 금지: 링크 · 해시태그 · 이용 후기처럼 지어낸 표현"
            error={err.bannedWords}
          />
        </Panel>

        <Panel title="게시" hint="내 채널 영상과 다른 채널 영상 모두 게시할 수 있어요">
          <Field
            label="광고 표시 (다른 채널 영상)"
            value={f.adDisclosure}
            onChange={set('adDisclosure')}
            placeholder="예: [광고]"
            hint="다른 채널 영상에 다는 댓글 맨 앞에 붙여요 · 업체 홍보 댓글임을 밝히는 표시라 '광고'나 '협찬'이 들어가야 해요 · 내 채널 영상에는 붙이지 않아요"
            error={err.adDisclosure}
          />
          <div role="group" aria-label="쓸 프로필" className="rd-stack-8">
            <span className="text-label rd-label">쓸 프로필</span>
            {profiles.data?.length === 0 ? (
              <span className="text-body-sm rd-muted">
                아직 프로필이 없어요 · <Link to="/accounts">계정 관리</Link>에서 먼저 연결해 주세요
              </span>
            ) : null}
            <div className="rd-checks">
              {profiles.data?.map((p) => (
                <label key={p.id} className="rd-check text-body-sm">
                  <input
                    type="checkbox"
                    checked={f.profileIds.includes(p.id)}
                    onChange={(e) =>
                      setF((s) => ({
                        ...s,
                        profileIds: e.target.checked ? [...s.profileIds, p.id] : s.profileIds.filter((x) => x !== p.id),
                      }))
                    }
                  />
                  <span>
                    {p.name}
                    {p.loginStatus !== 'ok' ? ' (로그인 필요)' : ''}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <Field
            label="하루 상한"
            type="number"
            value={f.dailyCap}
            onChange={set('dailyCap')}
            counter={totalCap !== undefined ? `전체 ${totalCap}개 중` : undefined}
            counterInvalid={capBad}
            hint={totalCap !== undefined ? `전체 하루 ${totalCap}개 안에서 주제별로 나눠 써요` : '전체 하루 상한 안에서 주제별로 나눠 써요'}
            error={err.dailyCap ?? (capBad ? `전체 하루 상한(${totalCap})보다 클 수 없어요` : undefined)}
          />
          {topicId ? (
            <div className="rd-stack-8">
              <span className="text-label rd-label">상태</span>
              <Segmented
                label="상태"
                value={f.status}
                onChange={(v) => setF((s) => ({ ...s, status: v as Topic['status'] }))}
                options={[
                  { value: 'active', label: '진행 중' },
                  { value: 'paused', label: '일시정지' },
                ]}
              />
            </div>
          ) : null}
        </Panel>

        {topicId ? (
          <Panel title="주제 지우기" hint="영상 목록·분석·초안이 함께 지워져요. 댓글 게시 목록은 남아요.">
            {confirmDelete ? (
              <div className="rd-row">
                <Button
                  variant="dark"
                  loading={deleteTopic.isPending}
                  onClick={() => deleteTopic.mutate(topicId, { onSuccess: () => navigate('/') })}
                >
                  정말 지우기
                </Button>
                <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                  취소
                </Button>
              </div>
            ) : (
              <div>
                <Button variant="secondary" onClick={() => setConfirmDelete(true)}>
                  이 주제 지우기
                </Button>
              </div>
            )}
            {deleteTopic.error ? <ErrorBand error={deleteTopic.error} /> : null}
          </Panel>
        ) : null}

        <div className="rd-actions-right">
          <Button variant="primary" size="lg" loading={save.isPending} onClick={onSave}>
            주제 저장
          </Button>
        </div>
      </div>
    </div>
  );
}
