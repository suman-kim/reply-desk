/* @ds-bundle: {"format":4,"namespace":"Inyeon","components":[{"name":"Button"},{"name":"Badge"},{"name":"Spinner"},{"name":"StatPill"},{"name":"Panel"},{"name":"TopicItem"},{"name":"Field"},{"name":"Segmented"},{"name":"VideoCard"},{"name":"ReasonBox"},{"name":"CheckList"},{"name":"StepList"},{"name":"BrowserFrame"},{"name":"LogTable"}]} */
(function () {
  var R = window.React;
  var h = R.createElement;
  var own = Object.prototype.hasOwnProperty;

  function cx() {
    var out = [];
    for (var i = 0; i < arguments.length; i++) { if (arguments[i]) out.push(arguments[i]); }
    return out.join(' ');
  }

  function omit(o, keys) {
    var r = {};
    if (!o) return r;
    for (var k in o) { if (own.call(o, k) && keys.indexOf(k) === -1) r[k] = o[k]; }
    return r;
  }

  function Icon(name, size) {
    var s = size || 16;
    var common = { width: s, height: s, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true', focusable: 'false' };
    if (name === 'check') return h('svg', common, h('polyline', { points: '20 6 9 17 4 12' }));
    if (name === 'x') return h('svg', common, h('line', { x1: 18, y1: 6, x2: 6, y2: 18 }), h('line', { x1: 6, y1: 6, x2: 18, y2: 18 }));
    if (name === 'play') return h('svg', Object.assign({}, common, { strokeWidth: 1.8 }), h('polygon', { points: '8 5 19 12 8 19 8 5' }));
    return null;
  }

  function Spinner(p) {
    p = p || {};
    var size = p.size || 16;
    return h('span', {
      className: cx('iy-spinner', p.tone === 'inverse' && 'iy-spinner-inverse', p.className),
      style: { width: size, height: size },
      'aria-hidden': 'true'
    });
  }

  function tone(t) { return t === 'warm' ? 'rose' : (t || 'neutral'); }

  function Button(p) {
    var variant = p.variant === 'accent' ? 'dark' : (p.variant || 'secondary');
    var size = p.size || 'md';
    var rest = omit(p, ['variant', 'size', 'loading', 'fullWidth', 'className', 'children', 'leading', 'type']);
    var onDark = variant === 'primary' || variant === 'dark';
    return h('button', Object.assign({ type: p.type || 'button' }, rest, {
      className: cx('iy-btn', 'iy-btn-' + variant, 'iy-btn-' + size, p.fullWidth && 'iy-btn-block', p.className),
      disabled: !!(p.disabled || p.loading),
      'aria-busy': p.loading ? 'true' : undefined
    }),
      p.loading ? h(Spinner, { size: 16, tone: onDark ? 'inverse' : undefined }) : (p.leading || null),
      h('span', null, p.children));
  }

  function Badge(p) {
    return h('span', { className: cx('iy-badge', 'iy-badge-' + tone(p.tone), p.className) },
      p.loading ? h(Spinner, { size: 10 }) : (p.dot ? h('span', { className: 'iy-badge-dot', 'aria-hidden': 'true' }) : null),
      p.children);
  }

  function StatPill(p) {
    var max = Number(p.max) || 0;
    var val = Number(p.value) || 0;
    var pct = max ? Math.min(100, Math.round((val / max) * 100)) : 0;
    return h('span', { className: cx('iy-stat', max && val >= max && 'is-full', p.className) },
      h('span', { className: 'iy-stat-label' }, p.label),
      h('strong', { className: 'iy-stat-value' }, max ? val + ' / ' + max : String(val)),
      max ? h('span', {
        className: 'iy-stat-bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': max, 'aria-valuenow': val, 'aria-label': p.label
      }, h('span', { style: { width: pct + '%' } })) : null);
  }

  function Panel(p) {
    var hasHead = p.title || p.step != null || p.actions;
    return h('section', { className: cx('iy-panel', p.className), style: p.style },
      hasHead ? h('header', { className: 'iy-panel-head' },
        h('span', { className: 'iy-panel-titles' },
          p.step != null ? h('span', { className: 'iy-panel-step' }, 'STEP ' + (/^\d$/.test(String(p.step)) ? '0' + p.step : String(p.step))) : null,
          p.title ? h('h2', { className: 'iy-panel-title' }, p.title) : null,
          p.hint ? h('span', { className: 'iy-panel-hint' }, p.hint) : null),
        p.actions ? h('span', { className: 'iy-panel-actions' }, p.actions) : null) : null,
      h('div', { className: 'iy-panel-body' }, p.children));
  }

  function TopicItem(p) {
    var st = p.status || 'active';
    return h('button', {
      type: 'button',
      className: cx('iy-topic', p.selected && 'is-selected', p.className),
      'aria-pressed': p.selected ? 'true' : 'false',
      onClick: p.onClick
    },
      h('span', { className: 'iy-topic-dot is-' + st, 'aria-hidden': 'true' }),
      h('span', { className: 'iy-topic-body' },
        h('span', { className: 'iy-topic-name' }, p.name),
        p.meta ? h('span', { className: 'iy-topic-meta' }, p.meta) : null),
      h('span', { className: 'iy-sr' }, st === 'paused' ? '일시정지' : '진행 중'),
      p.count != null && p.count !== 0 ? h('span', { className: 'iy-topic-count' }, String(p.count)) : null);
  }

  function Field(p) {
    var auto = R.useId();
    var fid = p.id || auto;
    var ctrlProps = {
      id: fid,
      className: cx('iy-input', p.multiline && 'iy-textarea'),
      placeholder: p.placeholder,
      readOnly: p.readOnly,
      'aria-invalid': p.error ? 'true' : undefined
    };
    if (!p.multiline) ctrlProps.type = p.type || 'text';
    if (p.multiline) ctrlProps.rows = p.rows || 4;
    if (p.onChange) { ctrlProps.value = p.value == null ? '' : p.value; ctrlProps.onChange = p.onChange; }
    else { ctrlProps.defaultValue = p.value; }
    var ctrl = h(p.multiline ? 'textarea' : 'input', ctrlProps);
    return h('div', { className: cx('iy-field', p.className) },
      (p.label || p.counter) ? h('div', { className: 'iy-field-top' },
        p.label ? h('label', { className: 'iy-field-label', htmlFor: fid }, p.label) : h('span'),
        p.counter ? h('span', { className: cx('iy-field-counter', p.counterInvalid && 'is-bad') }, p.counter) : null) : null,
      p.action ? h('div', { className: 'iy-field-row' }, ctrl, p.action) : ctrl,
      p.error ? h('span', { className: 'iy-field-error' }, p.error) : (p.hint ? h('span', { className: 'iy-field-hint' }, p.hint) : null));
  }

  function Segmented(p) {
    var opts = p.options || [];
    return h('div', { className: cx('iy-seg', p.block && 'iy-seg-block', p.className), role: 'group', 'aria-label': p.label },
      opts.map(function (o) {
        var v = typeof o === 'string' ? o : o.value;
        var l = typeof o === 'string' ? o : (o.label || o.value);
        var on = v === p.value;
        return h('button', {
          key: v, type: 'button',
          className: cx('iy-seg-item', on && 'is-on'),
          'aria-pressed': on ? 'true' : 'false',
          onClick: function () { if (p.onChange) p.onChange(v); }
        }, l);
      }));
  }

  function VideoCard(p) {
    var badges = p.badges || [];
    var thumbStyle = p.thumbnail ? { backgroundImage: 'url(' + p.thumbnail + ')' } : (p.tint ? { background: p.tint } : null);
    return h('button', {
      type: 'button',
      className: cx('iy-video', p.selected && 'is-selected', p.className),
      'aria-pressed': p.selected ? 'true' : 'false',
      onClick: p.onClick
    },
      p.rank != null ? h('span', { className: 'iy-video-rank' }, String(p.rank)) : null,
      h('span', { className: 'iy-video-thumb', style: thumbStyle },
        p.thumbnail ? null : h('span', { className: 'iy-video-play' }, Icon('play', 18)),
        p.duration ? h('span', { className: 'iy-video-dur' }, p.duration) : null),
      h('span', { className: 'iy-video-body' },
        h('span', { className: 'iy-video-title' }, p.title),
        (p.channel || p.date) ? h('span', { className: 'iy-video-meta' }, [p.channel, p.date].filter(Boolean).join(' · ')) : null,
        p.views ? h('span', { className: 'iy-video-views' }, p.views) : null,
        badges.length ? h('span', { className: 'iy-video-badges' }, badges.map(function (b, i) {
          return h(Badge, { key: i, tone: b.tone, loading: b.loading }, b.label);
        })) : null));
  }

  function ReasonBox(p) {
    var items = p.items || [];
    return h('div', { className: cx('iy-reason', 'iy-reason-' + tone(p.tone), p.className) },
      p.label ? h('span', { className: 'iy-reason-label' }, p.label) : null,
      items.length ? h('ol', { className: 'iy-reason-list' }, items.map(function (t, i) { return h('li', { key: i }, t); })) : null,
      p.children ? h('div', { className: 'iy-reason-body' }, p.children) : null,
      p.note ? h('span', { className: 'iy-reason-note' }, p.note) : null);
  }

  function CheckList(p) {
    return h('ul', { className: cx('iy-checks', p.className) }, (p.items || []).map(function (c, i) {
      return h('li', { key: i, className: c.ok ? 'is-ok' : 'is-bad' },
        h('span', { className: 'iy-check-icon' }, Icon(c.ok ? 'check' : 'x', 12)),
        h('span', null, c.label),
        h('span', { className: 'iy-sr' }, c.ok ? ' 통과' : ' 미통과'));
    }));
  }

  function StepList(p) {
    return h('ol', { className: cx('iy-steps', p.className) }, (p.steps || []).map(function (s, i) {
      var st = s.state || 'pending';
      var icon = st === 'done' ? Icon('check', 12)
        : st === 'failed' ? Icon('x', 12)
        : st === 'active' ? h(Spinner, { size: 14 })
        : null;
      return h('li', { key: i, className: 'iy-step is-' + st },
        h('span', { className: 'iy-step-icon' }, icon),
        h('span', { className: 'iy-step-label' }, s.label),
        s.meta ? h('span', { className: 'iy-step-meta' }, s.meta) : null);
    }));
  }

  function BrowserFrame(p) {
    return h('div', { className: cx('iy-browser', p.className) },
      h('div', { className: 'iy-browser-bar' },
        h('span', { className: 'iy-browser-dots', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')),
        p.profile ? h('span', { className: 'iy-browser-profile' }, p.profile) : null,
        h('span', { className: 'iy-browser-url' }, p.url || 'about:blank')),
      h('div', { className: 'iy-browser-body', style: p.minHeight ? { minHeight: p.minHeight } : null }, p.children));
  }

  function LogTable(p) {
    var rows = p.rows || [];
    var showTopic = rows.some(function (r) { return !!r.topic; });
    var rowClass = cx('iy-log-row', showTopic && 'has-topic');
    var head = ['시각'].concat(showTopic ? ['주제'] : []).concat(['영상', '프로필', '댓글', '결과']);
    return h('div', { className: cx('iy-log', p.className) },
      h('div', { className: 'iy-log-scroll' },
        h('div', { className: 'iy-log-inner', role: 'table', 'aria-label': p.label || '게시 기록' },
          h('div', { className: rowClass + ' iy-log-head', role: 'row' }, head.map(function (t) {
            return h('span', { key: t, role: 'columnheader' }, t);
          })),
          rows.length === 0 ? h('div', { className: 'iy-log-empty' }, p.emptyText || '아직 기록이 없어요') : null,
          rows.map(function (r, i) {
            var key = r.id || String(i);
            var open = p.openCaptureId != null && p.openCaptureId === r.id;
            return h('div', { key: key, className: 'iy-log-item' },
              h('div', { className: rowClass, role: 'row' },
                h('span', { className: 'iy-log-time', role: 'cell' }, r.time),
                showTopic ? h('span', { role: 'cell' }, r.topic || '') : null,
                h('span', { role: 'cell' }, r.video),
                h('span', { role: 'cell' }, r.profile),
                h('span', { className: 'iy-log-comment', role: 'cell' }, r.comment),
                h('span', { className: 'iy-log-result', role: 'cell' },
                  r.ok ? h(Badge, { tone: 'success' }, '성공') : h(Badge, { tone: 'danger' }, '실패'),
                  !r.ok && r.reason ? h('span', { className: 'iy-log-reason' }, r.reason) : null,
                  !r.ok && p.onCapture ? h(Button, { size: 'sm', variant: 'secondary', onClick: function () { p.onCapture(r); } }, open ? '캡처 닫기' : '캡처 보기') : null)),
              open ? h('div', { className: 'iy-log-capture' },
                h('span', null, '실패 화면 캡처 · ' + r.time + ' · ' + r.profile),
                r.capture ? h('img', { src: r.capture, alt: '실패 시점 화면 캡처' }) : h('div', { className: 'iy-log-shot' }, '캡처 이미지')) : null);
          }))));
  }

  var api = {
    Button: Button, Badge: Badge, Spinner: Spinner, StatPill: StatPill, Panel: Panel, TopicItem: TopicItem,
    Field: Field, Segmented: Segmented, VideoCard: VideoCard, ReasonBox: ReasonBox, CheckList: CheckList,
    StepList: StepList, BrowserFrame: BrowserFrame, LogTable: LogTable
  };
  var w = window;
  w.Inyeon = w.Inyeon || {};
  Object.assign(w.Inyeon, api);
})();
