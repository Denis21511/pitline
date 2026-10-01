/* ПитЛайн — общие утилиты: даты, форматирование, иконки, тосты, модальные окна */
window.App = window.App || {};
(function (A) {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const money = (n) => Math.round(n || 0).toLocaleString('ru-RU') + ' ₽';
  const num = (n) => Math.round(n || 0).toLocaleString('ru-RU');

  const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const DOW_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const DOW = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

  const pad = (n) => String(n).padStart(2, '0');
  const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return dateKey(d); };
  const todayKey = () => dateKey(new Date());
  const diffDays = (a, b) => Math.round((parseKey(a) - parseKey(b)) / 86400000);
  const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const fromMin = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };

  function fmtDate(k, opts = {}) {
    const d = parseKey(k);
    let s = `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
    if (opts.year || d.getFullYear() !== new Date().getFullYear()) s += ` ${d.getFullYear()}`;
    return s;
  }
  function fmtDateShort(k) { const d = parseKey(k); return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`; }
  function relDay(k) {
    const dd = diffDays(k, todayKey());
    if (dd === 0) return 'Сегодня';
    if (dd === 1) return 'Завтра';
    if (dd === -1) return 'Вчера';
    if (dd === 2) return 'Послезавтра';
    return null;
  }
  function fmtDay(k) {
    const r = relDay(k);
    const d = parseKey(k);
    return r ? `${r}, ${fmtDate(k)}` : `${DOW_SHORT[d.getDay()]}, ${fmtDate(k)}`;
  }
  function timeAgo(ts) {
    const s = Math.round((Date.now() - ts) / 1000);
    if (s < 45) return 'только что';
    const m = Math.round(s / 60);
    if (m < 60) return `${m} мин назад`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} ${plural(h, ['час', 'часа', 'часов'])} назад`;
    const d = new Date(ts);
    return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function plural(n, forms) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return forms[2];
    if (b > 1 && b < 5) return forms[1];
    if (b === 1) return forms[0];
    return forms[2];
  }
  const initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const uid = (p = 'id') => p + Math.random().toString(36).slice(2, 9);
  const digits = (s) => String(s || '').replace(/\D/g, '');

  function formatPhone(v) {
    let d = digits(v);
    if (!d) return '';
    if (d[0] === '8') d = '7' + d.slice(1);
    if (d[0] !== '7') d = '7' + d;
    d = d.slice(0, 11);
    let out = '+7';
    if (d.length > 1) out += ' (' + d.slice(1, 4);
    if (d.length >= 4) out += ')';
    if (d.length > 4) out += ' ' + d.slice(4, 7);
    if (d.length > 7) out += '-' + d.slice(7, 9);
    if (d.length > 9) out += '-' + d.slice(9, 11);
    return out;
  }
  const phoneValid = (v) => digits(v).length === 11;

  /* ---------- Иконки (линейные, 24×24) ---------- */
  const ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9v12h5v-6h4v6h5V9"/>',
    calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
    calPlus: '<rect x="3" y="4.5" width="18" height="16.5" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4M12 12.5v5M9.5 15h5"/>',
    car: '<path d="M5 17H3.5a1 1 0 0 1-1-1v-3.3a2 2 0 0 1 .4-1.2L5 8.5l1.5-3a2 2 0 0 1 1.8-1.1h7.4a2 2 0 0 1 1.8 1.1l1.5 3 2.1 3a2 2 0 0 1 .4 1.2V16a1 1 0 0 1-1 1H19"/><path d="M9 17h6M5 8.5h14"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    history: '<path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5"/><path d="M12 7.5V12l3 2"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14a6.5 6.5 0 0 1 3.5 6"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    chevL: '<path d="m15 18-6-6 6-6"/>',
    chevR: '<path d="m9 18 6-6-6-6"/>',
    chevD: '<path d="m6 9 6 6 6-6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9l-3.8 3.8Z"/>',
    sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    box: '<path d="M21 8 12 3 3 8v8l9 5 9-5Z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
    card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
    grid: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
    tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    calc: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 10.5h.01M12 10.5h.01M16 10.5h.01M8 14.5h.01M12 14.5h.01M16 14.5h.01M8 18h.01M12 18h4"/>',
    arrowR: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/>',
    swap: '<path d="M7 16V4M3 8l4-4 4 4M17 8v12M21 16l-4 4-4-4"/>',
    lift: '<path d="M3 21h18M6 21V9M18 21V9M4 9h16M9 5h6"/>',
    balance: '<path d="M12 3v18M7 21h10M4 7h16"/><path d="m4 7-2.5 6a2.5 2.5 0 0 0 5 0Zm16 0-2.5 6a2.5 2.5 0 0 0 5 0Z"/>',
    puncture: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5M12 16h.01"/>',
    patch: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 12h6M12 9v6"/>',
    disc: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/><path d="M12 3v6.5M12 14.5V21M4.2 7.5l5.6 3.2M14.2 13.3l5.6 3.2M4.2 16.5l5.6-3.2M14.2 10.7l5.6-3.2"/>',
    layers: '<path d="m12 2 10 5-10 5L2 7Z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
    mount: '<path d="M12 2v6M9 5l3 3 3-3"/><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 15.5h8"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
    ext: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    ruble: '<path d="M7 21V3h6.5a4.5 4.5 0 0 1 0 9H5M5 16h9"/>',
    flag: '<path d="M4 22V4M4 4h13l-2 4 2 4H4"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>',
    snow: '<path d="M12 2v20M4.9 6l14.2 12M4.9 18 19.1 6M9 4l3 2 3-2M9 20l3-2 3 2"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a6.8 6.8 0 0 0 11 11Z"/>',
    monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    gauge: '<path d="M12 14 15.5 9.5"/><path d="M3.5 18a9.5 9.5 0 1 1 17 0"/>',
    dot: '<circle cx="12" cy="12" r="3"/>',
    worker: '<circle cx="12" cy="7" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/><path d="M8.5 6h7"/>',
  };
  const icon = (name, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.dot}</svg>`;

  const logo = (sub) => `<span class="logo" aria-label="ПитЛайн"><span class="logo-mark"><i></i><i></i></span><span class="logo-word">Пит<b>Лайн</b></span>${sub ? `<span class="logo-sub">${esc(sub)}</span>` : ''}</span>`;

  /* ---------- Тосты ---------- */
  function toast(text, opts = {}) {
    const box = $('#toasts');
    if (!box) return;
    const el = document.createElement('div');
    el.className = 'toast' + (opts.type ? ' toast-' + opts.type : '');
    el.innerHTML = `<span class="t-ic">${icon(opts.icon || (opts.type === 'error' ? 'alert' : 'bell'))}</span><div class="t-body">${opts.title ? `<b>${esc(opts.title)}</b>` : ''}<span>${esc(text)}</span></div>`;
    el.addEventListener('click', () => dismiss());
    box.appendChild(el);
    while (box.children.length > 3) box.firstChild.remove();
    const t = setTimeout(dismiss, opts.duration || 4200);
    function dismiss() { clearTimeout(t); el.classList.add('out'); setTimeout(() => el.remove(), 220); }
  }

  /* ---------- Модальные окна (на телефоне — нижний лист) ---------- */
  const openModals = [];
  function modal(cfg) {
    const root = $('#modals');
    const ov = document.createElement('div');
    ov.className = 'ov';
    ov.innerHTML = `<div class="sheet ${cfg.wide ? 'wide' : ''}" role="dialog" aria-modal="true"></div>`;
    const sheet = ov.firstChild;
    const m = {
      el: sheet,
      cfg,
      close() {
        const i = openModals.indexOf(m);
        if (i >= 0) openModals.splice(i, 1);
        ov.classList.add('out');
        setTimeout(() => ov.remove(), 180);
        document.body.classList.toggle('modal-open', openModals.length > 0);
        cfg.onClose && cfg.onClose();
      },
      render() {
        const title = typeof cfg.title === 'function' ? cfg.title() : cfg.title;
        const body = typeof cfg.body === 'function' ? cfg.body(m) : cfg.body;
        const footer = typeof cfg.footer === 'function' ? cfg.footer(m) : cfg.footer;
        sheet.innerHTML = `
          <div class="sheet-grip"></div>
          <div class="sheet-h"><h3>${title || ''}</h3><button class="icon-btn" data-close aria-label="Закрыть">${icon('x')}</button></div>
          <div class="sheet-b">${body || ''}</div>
          ${footer ? `<div class="sheet-f">${footer}</div>` : ''}`;
        cfg.mount && cfg.mount(sheet, m);
      },
      refresh() {
        const ae = document.activeElement;
        if (ae && sheet.contains(ae) && /INPUT|TEXTAREA|SELECT/.test(ae.tagName)) return;
        if (cfg.live) { const st = sheet.querySelector('.sheet-b'); const sc = st ? st.scrollTop : 0; m.render(); const nb = sheet.querySelector('.sheet-b'); if (nb) nb.scrollTop = sc; }
      },
    };
    ov.addEventListener('click', (e) => {
      if (e.target === ov || e.target.closest('[data-close]')) m.close();
    });
    root.appendChild(ov);
    openModals.push(m);
    document.body.classList.add('modal-open');
    m.render();
    const f = sheet.querySelector('[autofocus]');
    if (f && window.innerWidth > 720) f.focus();
    return m;
  }
  function closeAllModals() { openModals.slice().forEach((m) => m.close()); }
  function confirmDialog({ title, text, ok = 'Подтвердить', cancel = 'Отмена', danger = false }) {
    return new Promise((resolve) => {
      let done = false;
      const m = modal({
        title,
        body: `<p class="muted" style="margin:0">${esc(text)}</p>`,
        footer: `<button class="btn btn-outline" data-no>${esc(cancel)}</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-yes>${esc(ok)}</button>`,
        mount(el) {
          el.querySelector('[data-no]').onclick = () => { done = true; resolve(false); m.close(); };
          el.querySelector('[data-yes]').onclick = () => { done = true; resolve(true); m.close(); };
        },
        onClose() { if (!done) resolve(false); },
      });
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && openModals.length) openModals[openModals.length - 1].close();
  });

  /* ---------- Маска телефона ---------- */
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.matches && t.matches('input[data-phone]')) {
      const f = formatPhone(t.value);
      if (t.value !== f) t.value = f;
    }
  });
  document.addEventListener('focusin', (e) => {
    const t = e.target;
    if (t.matches && t.matches('input[data-phone]') && !t.value) t.value = '+7 (';
  });

  function download(filename, text, type = 'text/plain') {
    const blob = new Blob([text], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  A.u = {
    $, $$, esc, money, num, pad, dateKey, parseKey, addDays, todayKey, diffDays, toMin, fromMin, nowMin,
    fmtDate, fmtDateShort, fmtDay, relDay, timeAgo, plural, initials, uid, digits, formatPhone, phoneValid,
    icon, logo, toast, modal, closeAllModals, confirmDialog, openModals, download,
    MONTHS, MONTHS_GEN, MONTHS_SHORT, DOW, DOW_SHORT,
  };
})(window.App);
