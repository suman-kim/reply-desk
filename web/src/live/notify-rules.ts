import type { Tone } from '../ds';
import type { LiveEvent } from './apply-event';
import { paths } from '../nav/paths';

/** 화면 오른쪽 아래·브라우저에 띄울 알림 하나 */
export interface Notice {
  /** 알림 ID (화면에서 지울 때) */
  id: number;
  /** 색 (성공·주의·실패) */
  tone: Tone;
  /** 제목 (예: 초안 준비됨) */
  title: string;
  /** 한 줄 설명 (원인·영상 제목). 없으면 빈 글자 */
  body: string;
  /** [보기]로 열 작업 (주제·영상) */
  target?: { topicId: number; videoId: number };
  /** [보기]로 갈 화면 주소 (작업이 아닌 알림) */
  href?: string;
}

/**
 * 실시간 이벤트를 알림으로 바꾸는 규칙.
 * 초안은 '작성 중'을 본 뒤 준비됨·실패로 바뀔 때만 알린다(사람이 초안을 고칠 때도 같은 이벤트가 와서).
 * 알릴 것: 초안 작성 끝(준비됨·검사 미통과·실패), 댓글 게시 성공·실패, 로그인 풀림.
 */
export class NoticeRules {
  /** 작성 중인 것을 본 초안 ID */
  private readonly writing = new Set<number>();
  /** 다음 알림 ID */
  private nextId = 1;

  /**
   * 이벤트 하나를 알림으로 바꾼다 (알릴 것이 아니면 null)
   * @param e 실시간 이벤트
   */
  toNotice(e: LiveEvent): Notice | null {
    if (e.type === 'draft.updated') {
      if (e.state === 'writing') {
        this.writing.add(e.draftId);
        return null;
      }
      if (!this.writing.delete(e.draftId)) return null;
      const target = { topicId: e.topicId, videoId: e.videoId };
      if (e.state === 'error') return this.make('danger', '초안 작성 실패', e.errorMessage ?? '원인을 알 수 없어요', target);
      return e.checkPassed
        ? this.make('success', '초안 준비됨', '게시 대기로 넘어갔어요', target)
        : this.make('warning', '초안 검사 미통과', '작업 창에서 고치면 바로 다시 검사해요', target);
    }
    if (e.type === 'post.finished') {
      const target = { topicId: e.topicId, videoId: e.videoId };
      if (e.status === 'success') return this.make('success', '댓글 게시 완료', '댓글 게시 목록에서 게시된 화면을 볼 수 있어요', target);
      if (e.status === 'failed') return this.make('danger', '댓글 게시 실패', e.failureReason ?? '원인을 남기지 못했어요', target);
      return null;
    }
    if (e.type === 'profile.updated' && e.loginStatus === 'needs_login') {
      const notice = this.make('warning', '로그인이 풀렸어요', `${e.name} · 계정 관리에서 다시 로그인해 주세요`);
      return { ...notice, href: paths.accounts };
    }
    return null;
  }

  /**
   * 알림을 만든다
   * @param tone 색
   * @param title 제목
   * @param body 설명
   * @param target [보기]로 열 작업
   */
  private make(tone: Tone, title: string, body: string, target?: Notice['target']): Notice {
    return { id: this.nextId++, tone, title, body, ...(target ? { target } : {}) };
  }
}
