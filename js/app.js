/* ПитЛайн — маршрутизация, делегирование событий, живые обновления и уведомления */
(function (A) {
  'use strict';
  const u = A.u, s = A.store, V = A.views, act = A.act;

  const ROUTES = [
    [/^$/, 'home'], [/^book$/, 'book'], [/^done\/(\d+)$/, 'done', ['id']],
    [/^records$/, 'records'], [/^cars$/, 'cars'], [/^history$/, 'history'], [/^profile$/, 'profile'], [/^calc$/, 'calc'],
    [/^admin$/, 'adminOverview'], [/^admin\/bookings$/, 'adminBookings'], [/^admin\/clients$/, 'adminClients'],
    [/^admin\/cars$/, 'adminCars'], [/^admin\/masters$/, 'adminMasters'], [/^admin\/services$/, 'adminServices'],
    [/^admin\/stock$/, 'adminStock'], [/^admin\/calendar$/, 'adminCalendar'], [/^admin\/payments$/, 'adminPayments'],
    [/^admin\/settings$/, 'adminSettings'], [/^master$/, 'master'],
  ];
  const TITLES = { client: 'ПитЛайн — запись на шиномонтаж', admin: 'Кабинет сервиса — ПитЛайн', master: 'Экран мастера — ПитЛайн' };

  let cur = { name: 'home', params: {}, key: null };
  let lastKey = null;
  let enterTimer = 0;

  function parse() {
    const h = location.hash.replace(/^#\/?/, '');
    const [path, qs] = h.split('?');
    const params = Object.fromEntries(new URLSearchParams(qs || ''));
    for (const [re, name, keys] of ROUTES) {
      const m = (path || '').replace(/\/$/, '').match(re);
      if (m) { (keys || []).forEach((k, i) => { params[k] = m[i + 1]; }); return { name, params }; }
    }
    return { name: 'home', params: {} };
  }

  const KEEP = '.cg, .tbl-wrap, .filters, .sheet-b';
  function render() {
    const view = V[cur.name];
    const root = document.getElementById('app');
    const same = lastKey === cur.key;
    const saved = same ? u.$$(KEEP, root).map((el) => [el.scrollTop, el.scrollLeft]) : null;
    root.innerHTML = view.render(cur.params);
    if (!same) {
      // анимация появления — только при переходе на экран, а не при живых обновлениях
      root.classList.add('is-enter');
      clearTimeout(enterTimer);
      enterTimer = setTimeout(() => root.classList.remove('is-enter'), 1100);
    }
    document.body.dataset.shell = view.shell;
    document.title = TITLES[view.shell] || TITLES.client;
    view.mount && view.mount(root, cur.params);
    if (saved) u.$$(KEEP, root).forEach((el, i) => { if (saved[i]) { el.scrollTop = saved[i][0]; el.scrollLeft = saved[i][1]; } });
    view.after && view.after();
    lastKey = cur.key;
    pending = false;
  }
  A.render = render;

  function onRoute() {
    const r = parse();
    const key = location.hash || '#/';
    if (key === cur.key) return;
    cur = { name: r.name, params: r.params, key };
    u.closeAllModals();
    hideTip();
    const v = V[r.name];
    v.enter && v.enter(r.params);
    render();
    window.scrollTo(0, 0);
  }

  /* ---------- Делегирование событий ---------- */
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const fn = act[el.dataset.act];
    if (!fn) return;
    if (el.tagName === 'A') e.preventDefault();
    fn(el, e);
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-change]');
    if (el && act[el.dataset.change]) act[el.dataset.change](el, e);
  });
  document.addEventListener('input', (e) => {
    const el = e.target.closest('[data-input]');
    if (el && act[el.dataset.input]) act[el.dataset.input](el, e);
  });

  /* ---------- Подсказки для графиков ---------- */
  let tip = null;
  function hideTip() { if (tip) tip.style.display = 'none'; }
  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest && e.target.closest('[data-tip]');
    if (!el) { hideTip(); return; }
    if (!tip) { tip = document.createElement('div'); tip.className = 'tip'; document.body.appendChild(tip); }
    tip.textContent = el.dataset.tip;
    tip.style.display = 'block';
    const r = el.getBoundingClientRect();
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let x = r.left + r.width / 2 - tw / 2;
    x = Math.max(8, Math.min(window.innerWidth - tw - 8, x));
    let y = r.top - th - 8;
    if (y < 8) y = r.bottom + 8;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  });
  window.addEventListener('scroll', hideTip, { passive: true });

  /* ---------- Живые обновления ---------- */
  const seen = new Set();
  let pending = false, scheduled = false;
  function inputFocused() {
    const ae = document.activeElement;
    return ae && /INPUT|TEXTAREA|SELECT/.test(ae.tagName) && ae.type !== 'checkbox' && document.getElementById('app').contains(ae);
  }
  function onStoreChange() {
    announce();
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      if (inputFocused()) pending = true; else render();
      u.openModals.forEach((m) => m.refresh());
    });
  }
  document.addEventListener('focusout', () => { setTimeout(() => { if (pending && !inputFocused()) render(); }, 120); });

  /** Всплывающее уведомление о новых событиях для текущей роли */
  function announce() {
    const shell = (V[cur.name] || {}).shell;
    const me = s.S().currentClientId;
    const fresh = s.S().notifications.filter((n) => !seen.has(n.id));
    fresh.forEach((n) => seen.add(n.id));
    fresh.slice(0, 3).reverse().forEach((n) => {
      if (shell === 'client' && n.aud === 'client' && n.clientId === me) u.toast(n.text, { title: n.title, icon: A.ui.nIcon(n.kind) });
      if (shell === 'admin' && n.aud === 'admin') u.toast(n.text, { title: n.title, icon: A.ui.nIcon(n.kind) });
    });
  }

  /* ---------- Старт ---------- */
  s.load();
  s.S().notifications.forEach((n) => seen.add(n.id));
  s.on(onStoreChange);
  window.addEventListener('hashchange', onRoute);
  onRoute();
  setTimeout(() => s.runAutomations(), 900);
  setInterval(() => s.simulateTick(), 3000);
  setInterval(() => { s.runAutomations(); if (!inputFocused() && !u.openModals.length) render(); }, 60000);
})(window.App);
