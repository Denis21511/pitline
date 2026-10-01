/* ПитЛайн — дневная и ночная тема: круговая смена от кнопки, анимированная иконка солнце ↔ луна */
(function (A) {
  'use strict';
  const KEY = 'pitline_theme';
  const html = document.documentElement;
  const act = (A.act = A.act || {});
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const listeners = new Set();

  const getPref = () => { try { return localStorage.getItem(KEY) || 'system'; } catch (e) { return 'system'; } };
  const effective = (p = getPref()) => (p === 'system' ? (mq.matches ? 'dark' : 'light') : p);
  const current = () => html.dataset.theme || 'light';

  function apply(t) {
    html.dataset.theme = t;
    html.style.colorScheme = t;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'dark' ? '#101a28' : '#ffffff');
    listeners.forEach((fn) => fn(t));
  }

  /** Смена темы: новая тема «раскрывается» кругом из точки нажатия */
  function transition(next, origin) {
    if (next === current()) return;
    const o = origin || { x: window.innerWidth - 56, y: 30 };
    if (!document.startViewTransition || reduced()) {
      html.classList.add('theme-fade');
      apply(next);
      setTimeout(() => html.classList.remove('theme-fade'), 650);
      return;
    }
    const r = Math.hypot(Math.max(o.x, window.innerWidth - o.x), Math.max(o.y, window.innerHeight - o.y));
    const vt = document.startViewTransition(() => apply(next));
    vt.ready.then(() => {
      html.animate(
        { clipPath: [`circle(0px at ${o.x}px ${o.y}px)`, `circle(${r}px at ${o.x}px ${o.y}px)`] },
        { duration: 750, easing: 'cubic-bezier(.65, 0, .35, 1)', pseudoElement: '::view-transition-new(root)' },
      );
    }).catch(() => {});
  }

  function setPref(pref, origin) {
    try { localStorage.setItem(KEY, pref); } catch (e) { /* приватный режим */ }
    document.querySelectorAll('[data-act="theme-set"]').forEach((b) => b.classList.toggle('on', b.dataset.v === pref));
    transition(effective(pref), origin);
  }

  const originOf = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
  act['theme-toggle'] = (el) => setPref(current() === 'dark' ? 'light' : 'dark', originOf(el));
  act['theme-set'] = (el) => setPref(el.dataset.v, originOf(el));

  mq.addEventListener && mq.addEventListener('change', () => { if (getPref() === 'system') transition(effective(), null); });
  window.addEventListener('storage', (e) => { if (e.key === KEY) transition(effective(), null); });

  /** Кнопка: солнце с лучами, которое превращается в луну */
  const button = (cls = '') => `<button class="icon-btn theme-btn ${cls}" data-act="theme-toggle" aria-label="Сменить тему: день или ночь" title="День / ночь">
    <svg class="tt" viewBox="0 0 24 24" aria-hidden="true">
      <mask id="tt-mask"><rect x="-4" y="-4" width="32" height="32" fill="#fff"/><circle class="tt-moon" cx="26" cy="4" r="6" fill="#000"/></mask>
      <circle class="tt-sun" cx="12" cy="12" r="5" mask="url(#tt-mask)"/>
      <g class="tt-rays"><path d="M12 2v2.2M12 19.8V22M2 12h2.2M19.8 12H22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6"/></g>
    </svg>
  </button>`;

  /** Выбор оформления: светлая / тёмная / как в системе */
  const segment = () => {
    const p = getPref();
    const u = A.u;
    return `<div class="seg seg-fill theme-seg">
      <button class="${p === 'light' ? 'on' : ''}" data-act="theme-set" data-v="light">${u.icon('sun')}День</button>
      <button class="${p === 'dark' ? 'on' : ''}" data-act="theme-set" data-v="dark">${u.icon('moon')}Ночь</button>
      <button class="${p === 'system' ? 'on' : ''}" data-act="theme-set" data-v="system">${u.icon('monitor')}Авто</button>
    </div>`;
  };

  apply(effective());
  A.theme = { current, pref: getPref, button, segment, on: (fn) => listeners.add(fn) };
})(window.App);
