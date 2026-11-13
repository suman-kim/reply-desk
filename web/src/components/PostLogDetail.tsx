import { Link } from 'react-router';
import type { PostLogRow } from '../api/types';
import { Badge } from '../ds/inyeon';
import { formatDateTime, formatElapsed } from '../lib/format';
import { POST_RESULT, POST_STEP_LABELS } from './badges';

/**
 * 댓글 게시 상세 (댓글 게시 목록에서 행을 누르면 창 안에 보인다).
 * 게시 결과 캡처(성공: 게시된 댓글 화면, 실패: 실패한 순간)를 크게 보이고, 댓글 전문·주소·걸린 시간·멈춘 단계를 함께 보인다.
 * 실패면 다시 게시할 곳(작업 목록의 그 영상)으로 가는 길을 둔다.
 * @param props.row 댓글 게시 목록 한 행
 */
export function PostLogDetail({ row }: { row: PostLogRow }) {
  const captureUrl = `/api/posting/attempts/${row.id}/capture`;
  const result = POST_RESULT[row.status];

  return (
    <div className="rd-stack-16">
      {row.hasScreenshot ? (
        <figure className="rd-capture">
          <a href={captureUrl} target="_blank" rel="noreferrer" title="원본 크기로 새 탭에서 보기">
            <img
              src={captureUrl}
              alt={row.status === 'success' ? '게시된 댓글 화면 캡처' : '실패한 순간 화면 캡처'}
              className="rd-capture-img"
            />
          </a>
          <figcaption className="text-caption rd-muted">
            {row.status === 'success' ? '게시 직후 내 댓글이 보이는 화면' : '게시가 멈춘 순간의 화면'} · 누르면 원본 크기로 열려요
          </figcaption>
        </figure>
      ) : (
        <p className="text-body-sm rd-muted rd-capture-empty">
          이 게시에는 화면 캡처가 없어요 · 캡처는 게시가 끝날 때 저장돼요(이 기능 전에 단 댓글은 없어요)
        </p>
      )}

      {row.status === 'failed' ? (
        <div className="rd-band rd-band-danger" role="alert">
          <span className="text-body-sm">{row.failureReason ?? '원인을 남기지 못했어요'}</span>
          {row.video && row.topic ? (
            <Link to={`/drafts?topic=${row.topic.id}&video=${row.video.id}`} className="text-body-sm">
              작업 목록에서 다시 게시
            </Link>
          ) : null}
        </div>
      ) : null}

      <dl className="rd-dl">
        <div>
          <dt className="text-label">결과</dt>
          <dd>
            <Badge tone={result.tone} loading={row.status === 'running'}>
              {result.label}
            </Badge>
          </dd>
        </div>
        <div>
          <dt className="text-label">게시 시각</dt>
          <dd className="text-body-sm">{formatDateTime(row.startedAt)}</dd>
        </div>
        <div>
          <dt className="text-label">걸린 시간</dt>
          <dd className="text-body-sm">{formatElapsed(row.startedAt, row.finishedAt)}</dd>
        </div>
        <div>
          <dt className="text-label">프로필</dt>
          <dd className="text-body-sm">{row.profileName ?? '지운 프로필'}</dd>
        </div>
        <div>
          <dt className="text-label">주제</dt>
          <dd className="text-body-sm">{row.topic?.name ?? '지운 주제'}</dd>
        </div>
        {row.failedStep ? (
          <div>
            <dt className="text-label">멈춘 단계</dt>
            <dd className="text-body-sm">{POST_STEP_LABELS[row.failedStep]}</dd>
          </div>
        ) : null}
        <div className="rd-dl-wide">
          <dt className="text-label">영상</dt>
          <dd className="text-body-sm">
            {row.video ? (
              <>
                {row.video.title} <span className="rd-muted">· {row.video.channelTitle}</span>
                <br />
                <a href={row.video.url} target="_blank" rel="noreferrer" className="text-mono">
                  {row.video.url}
                </a>
              </>
            ) : (
              '지운 영상'
            )}
          </dd>
        </div>
        <div className="rd-dl-wide">
          <dt className="text-label">댓글 주소</dt>
          <dd className="text-body-sm">
            {row.commentUrl ? (
              <>
                <a href={row.commentUrl} target="_blank" rel="noreferrer">
                  댓글 보기
                </a>{' '}
                <span className="text-mono rd-muted">{row.commentUrl}</span>
              </>
            ) : (
              <span className="rd-muted">없음 (게시되지 않았거나 주소를 읽지 못했어요)</span>
            )}
          </dd>
        </div>
      </dl>

      <div className="rd-stack-8">
        <span className="text-label rd-ink2">단 댓글</span>
        <p className="text-body-sm rd-mono-box rd-comment-text" style={{ margin: 0 }}>
          {row.commentText}
        </p>
      </div>
    </div>
  );
}
