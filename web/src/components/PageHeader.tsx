import type { ReactNode } from 'react';

/**
 * 화면 머리: 화면 이름, 한 줄 설명, 오른쪽 요약 (다른 화면으로는 위쪽 메뉴 탭으로 간다)
 * @param props.title 화면 이름
 * @param props.description 이 화면에서 하는 일 한 줄
 * @param props.right 오른쪽 (StatPill, 버튼)
 */
export function PageHeader({ title, description, right }: { title: string; description: string; right?: ReactNode }) {
  return (
    <header className="rd-header">
      <div className="rd-header-title">
        <h1 className="text-display">{title}</h1>
        <p className="text-body-sm">{description}</p>
      </div>
      {right ? <div className="rd-header-actions">{right}</div> : null}
    </header>
  );
}
