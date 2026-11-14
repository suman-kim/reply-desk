import * as React from 'react';

/**
 * 디자인 시스템 묶음(bundle.js)은 window.React를 읽어 컴포넌트를 만든다.
 * 묶음보다 먼저 실행되도록 inyeon.ts의 첫 import로 둔다.
 */
(window as unknown as { React: typeof React }).React = React;
