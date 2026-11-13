import { Link } from 'react-router';
import type { PostLogRow } from '../api/types';
import { Badge } from '../ds';
import { formatDateTime, formatElapsed } from '../lib/format';
import { paths } from '../nav/paths';
import { POST_RESULT, POST_STEP_LABELS } from './badges';
import { Icon } from './Icon';

/**
 * 댓글 게시 상세 (RD-26): 넓으면 댓글 게시 목록 오른쪽 칸, 좁으면 창 안에 보인다.
 * 게시 결과 캡처(성공: 게시된 댓글 화면, 실패: 실패한 순간)를 크게 보이고, 그 아래 게시 시각·걸린 시간·프로필·영상·댓글 주소·단 댓글.
 * 실패면 원인과 다시 게시할 곳(그 영상의 작업 상세)을 맨 위에 둔다.
 * @param props.row 댓글 게시 목록 한 행
 * @param props.head 머리(결과 · 제목 · 시각 · [유튜브에서 보기])를 그릴지. 창은 창 머리가 대신한다
 */
export function PostLogDetail({ row, head = false }: { row: PostLogRow; head?: boolean }) {
  const captureUrl = `/api/posting/attempts/${row.id}/capture`;
  const result = POST_RESULT[row.status];
  const failed = row.status === 'failed';

  return (
    <article className="rd-logd" aria-label="게시 자세히">
      {head ? (
        <header className="rd-logd-head">
          <div className="rd-stack-8" style={{ minWidth: 0, flex: '1 1 320px' }}>
            <span className="rd-row-tight">
              <Badge tone={result.tone} loading={row.status === 'running'}>
                {result.label}
              </Badge>
            </span>
            <h2 className="text-title rd-logd-title">{row.video?.title ?? '지운 영상'}</h2>
            <span className="text-caption rd-muted">
              <span className="text-mono">{formatDateTime(row.startedAt)}</span> · {row.profileName ?? '지운 프로필'} ·{' '}
              <span className="text-mono">{formatElapsed(row.startedAt, row.finishedAt)}</span> 걸림
            </span>
          </div>
          {row.video ? (
            <a href={row.video.url} target="_blank" rel="noreferrer" className="dk-btn dk-btn-secondary dk-btn-sm">
              유튜브에서 보기
              <Icon name="external" size={14} />
            </a>
          ) : null}
        </header>
      ) : null}

      {failed ? (
        <div className="rd-band rd-band-danger" role="alert">
          <span className="text-body-sm">{row.failureReason ?? '원인을 남기지 못했어요'}</span>
          {row.video && row.topic ? (
            <Link to={paths.video(row.topic.id, row.video.id)} className="text-body-sm">
              작업 상세에서 다시 게시
            </Link>
          ) : null}
        </div>
      ) : null}

      {row.hasScreenshot ? (
        <figure className="rd-capture">
          <a href={captureUrl} target="_blank" rel="noreferrer" title="원본 크기로 새 탭에서 보기" className="rd-capture-link">
            <img
              src={captureUrl}
              alt={row.status === 'success' ? '게시된 댓글 화면 캡처' : '실패한 순간 화면 캡처'}
              className="rd-capture-img"
              loading="lazy"
            />
          </a>
          <figcaption className="text-caption rd-muted">
            {row.status === 'success' ? '게시 직후 내 댓글이 보이는 화면' : '게시가 멈춘 순간의 화면'} · 누르면 원본 크기로 열려요
          </figcaption>
        </figure>
      ) : (
        <div className="rd-capture-empty">
          <span className="rd-capture-empty-icon" aria-hidden="true">
            <Icon name="camera" size={20} />
          </span>
          <span className="text-body-strong rd-ink">이 게시에는 화면 캡처가 없어요</span>
          <span className="text-caption rd-muted">캡처는 게시가 끝날 때 저장돼요. 이 기능 전에 단 댓글은 캡처가 없어요.</span>
        </div>
      )}

      <dl className="rd-logd-dl">
        <dt>게시 시각</dt>
        <dd className="text-mono">{formatDateTime(row.startedAt)}</dd>
        <dt>걸린 시간</dt>
        <dd className="text-mono">{formatElapsed(row.startedAt, row.finishedAt)}</dd>
        <dt>프로필</dt>
        <dd>{row.profileName ?? '지운 프로필'}</dd>
        <dt>주제</dt>
        <dd>{row.topic?.name ?? '지운 주제'}</dd>
        {row.failedStep ? (
          <>
            <dt>멈춘 단계</dt>
            <dd>{POST_STEP_LABELS[row.failedStep]}</dd>
          </>
        ) : null}
        <dt>영상</dt>
        <dd>
          {row.video ? (
            <span className="rd-stack">
              <span>
                {row.video.title} <span className="rd-muted">· {row.video.channelTitle}</span>
              </span>
              <a href={row.video.url} target="_blank" rel="noreferrer" className="text-mono rd-break">
                {row.video.url}
              </a>
            </span>
          ) : (
            '지운 영상'
          )}
        </dd>
        <dt>댓글 주소</dt>
        <dd>
          {row.commentUrl ? (
            <span className="rd-stack">
              <a href={row.commentUrl} target="_blank" rel="noreferrer">
                댓글 보기
              </a>
              <span className="text-mono rd-muted rd-break">{row.commentUrl}</span>
            </span>
          ) : (
            <span className="rd-muted">없음 (게시되지 않았거나 주소를 읽지 못했어요)</span>
          )}
        </dd>
        <dt>단 댓글</dt>
        <dd>
          <p className="rd-comment-text">{row.commentText}</p>
        </dd>
      </dl>
    </article>
  );
}
