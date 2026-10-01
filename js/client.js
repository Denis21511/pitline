/* ПитЛайн — клиентское приложение: главная, запись в 5 шагов, записи, автомобили, история, профиль, калькулятор */
(function (A) {
  'use strict';
  const u = A.u, s = A.store;
  const { esc, icon, money } = u;
  const ui = (A.ui = A.ui || {});
  const act = (A.act = A.act || {});
  const V = (A.views = A.views || {});

  /* ================= Общие элементы интерфейса ================= */
  const hhmm = (ts) => { const d = new Date(ts); return `${u.pad(d.getHours())}:${u.pad(d.getMinutes())}`; };
  ui.hhmm = hhmm;
  ui.pill = (st) => `<span class="st st-${st}">${esc(s.statusShort(st))}</span>`;
  ui.segbar = (b) => {
    const idx = s.ST_IDX[b.status];
    return `<div class="segbar" aria-hidden="true">${s.STATUSES.map((x, i) => `<i class="${i <= idx ? 'on' : ''} ${i === idx && b.status !== 'done' ? 'cur' : ''}"></i>`).join('')}</div>`;
  };
  ui.tracker = (b, just) => {
    const idx = s.ST_IDX[b.status];
    return `<ol class="track ${just ? 'just' : ''}">${s.STATUSES.map((x, i) => {
      const fin = i < idx || (i === idx && b.status === 'done');
      const cls = fin ? 'done' : i === idx ? 'cur' : '';
      const log = (b.log || []).find((l) => l.s === x.key);
      return `<li class="${cls} ${i === idx ? 'is-now' : ''}"><span class="tk-dot">${fin ? icon('check') : '<i></i>'}</span><span class="tk-label">${esc(x.label)}</span><span class="tk-time tnum">${log && i <= idx ? hhmm(log.at) : ''}</span></li>`;
    }).join('')}</ol>`;
  };
  ui.carTag = (car) => car ? `<span class="tag">${esc(car.size)}</span>${car.runflat ? '<span class="tag">Run-flat</span>' : ''}` : '';
  ui.ics = (b) => {
    const car = s.getCar(b.carId), svc = s.getService(b.serviceId), st = s.settings();
    const start = u.parseKey(b.date); start.setMinutes(u.toMin(b.time));
    const end = new Date(start.getTime() + b.duration * 60000);
    const f = (d) => `${d.getFullYear()}${u.pad(d.getMonth() + 1)}${u.pad(d.getDate())}T${u.pad(d.getHours())}${u.pad(d.getMinutes())}00`;
    const now = new Date();
    const stamp = `${now.getUTCFullYear()}${u.pad(now.getUTCMonth() + 1)}${u.pad(now.getUTCDate())}T${u.pad(now.getUTCHours())}${u.pad(now.getUTCMinutes())}00Z`;
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PitLine//Booking//RU', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
      `UID:pitline-${b.id}@pitline.local`, `DTSTAMP:${stamp}`, `DTSTART:${f(start)}`, `DTEND:${f(end)}`,
      `SUMMARY:Шиномонтаж ${st.name}: ${svc.short}`, `LOCATION:${st.city}\\, ${st.address.replace(/,/g, '\\,')}`,
      `DESCRIPTION:Запись №${b.id}. ${s.carName(car)} ${car.size}. Телефон сервиса: ${st.phone}`,
      'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', 'DESCRIPTION:Шиномонтаж через 2 часа', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    u.download(`pitline-${b.id}.ics`, ics, 'text/calendar');
    u.toast('Файл события скачан — откройте его, чтобы добавить запись в календарь', { icon: 'calPlus' });
  };
  /** Выбрать разреженные слоты для витрины (не чаще раза в час) */
  ui.spreadSlots = (slots, max = 8, gap = 60) => {
    const out = []; let last = -999;
    slots.forEach((t) => { const m = u.toMin(t); if (m - last >= gap && out.length < max) { out.push(t); last = m; } });
    return out;
  };

  const myBookings = () => s.S().bookings.filter((b) => b.clientId === s.S().currentClientId);
  const myActive = () => myBookings().filter(s.isActive).sort(s.cmpBooking);
  const unreadClient = () => s.notificationsFor('client').filter((n) => !n.read).length;
  const seenStatus = {};

  /* ================= Оболочка ================= */
  const TABS = [
    ['home', 'Главная', 'home', '#/'],
    ['records', 'Записи', 'calendar', '#/records'],
    ['cars', 'Авто', 'car', '#/cars'],
    ['history', 'История', 'history', '#/history'],
    ['profile', 'Профиль', 'user', '#/profile'],
  ];
  function shell(content, opts = {}) {
    const unread = unreadClient();
    const inWork = myBookings().some(s.isInWork);
    const left = opts.back
      ? `<button class="icon-btn" data-act="c-back" aria-label="Назад">${icon('chevL')}</button><div class="c-title">${esc(opts.title || '')}</div>`
      : `<a href="#/" class="c-logo">${u.logo()}</a>`;
    return `<div class="c-shell ${opts.flow ? 'is-flow' : ''}">
      <header class="c-header"><div class="c-header-in">
        <div class="c-header-l">${left}</div>
        <div class="c-header-r">
          <a class="btn btn-ghost btn-sm hide-m" href="#/admin">${icon('grid')}Кабинет сервиса</a>
          ${A.theme.button()}
          <button class="icon-btn" data-act="c-notifs" aria-label="Уведомления">${icon('bell')}${unread ? `<span class="dot-badge">${unread}</span>` : ''}</button>
        </div>
      </div></header>
      <main class="c-main ${opts.mainCls || ''}">${content}</main>
      ${opts.flow ? '' : `<nav class="tabbar"><div class="tabbar-in">${TABS.map(([k, l, ic, href]) => `<a href="${href}" class="tab ${opts.tab === k ? 'on' : ''}">${icon(ic)}<span>${l}</span>${k === 'records' && inWork ? '<i class="tab-dot"></i>' : ''}</a>`).join('')}</div></nav>`}
    </div>`;
  }
  act['c-back'] = () => { if (V.book && wz && location.hash.startsWith('#/book')) return wzBack(); if (history.length > 1) history.back(); else location.hash = '#/'; };

  act['c-notifs'] = () => {
    const m = u.modal({
      title: 'Уведомления',
      live: true,
      body: () => {
        const list = s.notificationsFor('client');
        if (!list.length) return emptyState('bell', 'Пока нет уведомлений', 'Здесь появятся статусы заказа и напоминания');
        return `<div class="nlist">${list.slice(0, 40).map((n) => `<div class="nitem ${n.read ? '' : 'unread'}">
          <span class="nitem-ic k-${n.kind || 'info'}">${icon(nIcon(n.kind))}</span>
          <div><b>${esc(n.title || '')}</b><p>${esc(n.text)}</p><span class="nitem-t">${u.timeAgo(n.at)}</span></div></div>`).join('')}</div>`;
      },
      onClose: () => s.markRead('client'),
    });
    return m;
  };
  function nIcon(k) { return ({ status: 'wrench', ready: 'check', remind: 'clock', created: 'calendar', cancel: 'x', moved: 'swap', paid: 'card', season: 'snow', new: 'calPlus', free: 'clock' })[k] || 'bell'; }
  ui.nIcon = nIcon;

  function emptyState(ic, title, text, btn) {
    return `<div class="empty"><span class="empty-ic">${icon(ic)}</span><b>${esc(title)}</b><p>${esc(text || '')}</p>${btn || ''}</div>`;
  }
  ui.emptyState = emptyState;

  /* ================= Главная ================= */
  V.home = {
    shell: 'client',
    render() {
      const st = s.settings();
      const me = s.me();
      const T = u.todayKey();
      let date = T;
      let slots = s.freeSlots(T, 60);
      if (!slots.length) { const nf = s.nearestFree(60); if (nf) { date = nf.date; slots = nf.slots; } }
      const shown = ui.spreadSlots(slots, 8, 90);
      const active = myActive();
      const live = active.find(s.isInWork);
      const next = active.find((b) => b.status === 'created');
      const hour = new Date().getHours();
      const greet = hour < 6 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';

      const liveCard = live ? (() => {
        const car = s.getCar(live.carId), m = s.getMaster(live.masterId);
        return `<a href="#/records" class="card live-card">
          <div class="live-top"><span class="live-badge"><i></i>Сейчас в работе</span><span class="muted tnum">№ ${live.id}</span></div>
          <div class="live-status">${esc(s.statusLabel(live.status))}</div>
          ${ui.segbar(live)}
          <div class="live-meta"><span>${esc(s.carName(car))} · ${esc(s.getService(live.serviceId).short)}</span><span>Пост ${live.post}${m ? ' · ' + esc(s.firstName(m.name)) : ''}</span></div>
        </a>`;
      })() : '';
      const nextCard = next ? (() => {
        const car = s.getCar(next.carId);
        return `<a href="#/records" class="card next-card">
          <span class="next-ic">${icon('calendar')}</span>
          <div class="grow"><div class="muted sm">Ближайшая запись</div><b>${esc(u.fmtDay(next.date))}, ${next.time}</b><div class="sm">${esc(s.carName(car))} · ${esc(s.getService(next.serviceId).short)}</div></div>
          ${icon('chevR', 'muted')}
        </a>`;
      })() : '';

      return shell(`
        <section class="hero">
          <div class="hero-greet">${greet}, ${esc(s.firstName(me.name))}</div>
          <h1>Запишитесь на шиномонтаж за 2 минуты</h1>
          <p>Выберите услугу, автомобиль и удобное время.</p>
          <a href="#/book" class="btn btn-primary btn-lg btn-block">Записаться ${icon('arrowR')}</a>
          <div class="hero-facts"><span>${icon('clock')}Ежедневно ${st.open}–${st.close}</span><span>${icon('lift')}${st.posts} поста</span><span>${icon('check')}Без очередей</span></div>
        </section>

        ${liveCard}${nextCard}

        <section class="card">
          <div class="card-h"><div><h2>Ближайшие свободные окна</h2><div class="muted sm">${esc(u.fmtDay(date))}</div></div><a href="#/book" class="link-sm">Все ${icon('chevR')}</a></div>
          ${shown.length ? `<div class="slots">${shown.map((t) => `<a class="slot" href="#/book?date=${date}&time=${t}">${t}</a>`).join('')}</div>` : '<p class="muted">Свободного времени в ближайшие дни нет</p>'}
        </section>

        <a href="#/calc" class="card promo">
          <span class="promo-ic">${icon('calc')}</span>
          <div class="grow"><b>Умный калькулятор</b><div class="muted sm">Стоимость и свободное время за 10 секунд</div></div>
          ${icon('chevR', 'muted')}
        </a>

        <div class="sec-h"><h2>Услуги и цены</h2></div>
        <div class="price-list">
          ${s.S().services.map((sv) => `<a class="price-row" href="#/book?service=${sv.id}">
            <span class="price-ic">${icon(sv.icon)}</span>
            <div class="grow"><b>${esc(sv.name)}</b><span>${esc(sv.desc)}</span></div>
            <span class="price-v tnum">${esc(s.priceFrom(sv).replace(' / колесо', '')).replace('от ', 'от&nbsp;')}</span>
          </a>`).join('')}
        </div>

        <div class="sec-h"><h2>Как нас найти</h2></div>
        <div class="card contact">
          <div class="contact-row">${icon('pin')}<div><b>${esc(st.address)}</b><span>${esc(st.city)}</span></div></div>
          <div class="contact-row">${icon('clock')}<div><b>Ежедневно ${st.open}–${st.close}</b><span>Запись онлайн 24/7</span></div></div>
          <a class="contact-row" href="tel:${u.digits(st.phone)}">${icon('phone')}<div><b>${esc(st.phone)}</b><span>Позвонить администратору</span></div></a>
        </div>
        <p class="foot-note">Вы владелец сервиса? <a href="#/admin">Открыть кабинет</a> · <a href="#/master">Экран мастера</a></p>
      `, { tab: 'home' });
    },
  };

  /* ================= Запись: 5 шагов ================= */
  let wz = null;
  let wzShownStep = 0;
  const ANIM_CAP = {
    swap: ['Сезонная замена', 'Снимаем колёса и ставим сезонный комплект'],
    spin: ['Балансировка', 'Колесо раскручивается на стенде, грузики убирают биение'],
    puncture: ['Ремонт', 'Находим повреждение и восстанавливаем шину'],
    rim: ['Правка диска', 'Диск снимаем с шины и выправляем отдельно'],
    idle: ['3D-превью', 'Выберите услугу — покажем, что будем делать'],
  };
  const STEP_TITLES = ['Выберите услугу', 'Ваш автомобиль', 'Выберите дату', 'Выберите время', 'Ваши данные'];

  function initWizard(p) {
    const me = s.me();
    const cars = s.carsOf(me.id);
    let carId = p.car || null;
    if (!carId && p.size) { const m = cars.find((c) => c.size === p.size); carId = m ? m.id : 'new'; }
    if (!carId) carId = cars[0] ? cars[0].id : 'new';
    wz = {
      step: 1, hist: [], serviceId: p.service || null, carId,
      nc: { brand: '', model: '', size: p.size || 'R16', runflat: p.runflat === '1', kit: 'Летний' },
      date: p.date || null, time: p.time || null, wheels: Number(p.wheels) || (['puncture', 'tire', 'rim'].includes(p.service) ? 1 : 4),
      extras: p.extras ? p.extras.split(',').filter(Boolean) : [], name: me.name, phone: me.phone,
      editId: p.edit || null, month: null, errors: {},
    };
    if (wz.editId) {
      const b = s.getBooking(wz.editId);
      if (b) Object.assign(wz, { serviceId: b.serviceId, carId: b.carId, date: b.date, time: b.time, wheels: b.wheels || 4, extras: b.extras || [] });
      wz.step = 3; wz.hist = [1, 2];
    } else if (wz.serviceId && wz.date && wz.time) { wz.step = 2; wz.hist = [1]; }
    else if (wz.serviceId && p.car) { wz.step = 3; wz.hist = [1, 2]; }
    else if (wz.serviceId) { wz.step = 2; wz.hist = [1]; }
    if (p.step) wz.step = Number(p.step);
    const base = wz.date ? u.parseKey(wz.date) : new Date();
    wz.month = new Date(base.getFullYear(), base.getMonth(), 1);
  }
  const wzCar = () => (wz.carId === 'new' ? Object.assign({ id: 'new' }, wz.nc) : s.getCar(wz.carId));
  const wzEst = () => {
    const car = wzCar();
    if (!wz.serviceId) return null;
    return s.estimate({ serviceId: wz.serviceId, size: car ? car.size : 'R16', wheels: wz.wheels, runflat: car && car.runflat, extras: wz.extras });
  };
  const wzCarId = () => (wz.carId && wz.carId !== 'new' ? wz.carId : null);
  const wzDur = () => { const e = wzEst(); return e ? e.duration : 60; };
  const slotOk = () => wz.date && wz.time && s.freeSlots(wz.date, wzDur(), wz.editId, wzCarId()).includes(wz.time);

  function wzValidate(step) {
    wz.errors = {};
    if (step === 1 && !wz.serviceId) { u.toast('Выберите услугу', { type: 'error' }); return false; }
    if (step === 2 && wz.carId === 'new') {
      if (!wz.nc.brand.trim()) wz.errors.brand = 'Укажите марку';
      if (!wz.nc.model.trim()) wz.errors.model = 'Укажите модель';
    }
    if (step === 3 && !wz.date) { u.toast('Выберите дату', { type: 'error' }); return false; }
    if (step === 4 && !wz.time) { u.toast('Выберите время', { type: 'error' }); return false; }
    if (step === 5) {
      if (wz.name.trim().length < 2) wz.errors.name = 'Как к вам обращаться?';
      if (!u.phoneValid(wz.phone)) wz.errors.phone = 'Введите номер полностью';
    }
    return !Object.keys(wz.errors).length;
  }
  function wzGo(step) { wz.hist.push(wz.step); wz.step = step; A.render(); window.scrollTo(0, 0); }
  function wzNext() {
    if (!wzValidate(wz.step)) { A.render(); return; }
    let n = wz.step + 1;
    if (wz.step === 2 && slotOk()) n = 5;
    if (wz.step === 3 && wz.time && !slotOk()) wz.time = null;
    wzGo(n);
  }
  function wzBack() {
    if (wz.hist.length) { wz.step = wz.hist.pop(); A.render(); window.scrollTo(0, 0); }
    else location.hash = '#/';
  }
  act['wz-next'] = wzNext;
  act['wz-svc'] = (el) => {
    wz.serviceId = el.dataset.id;
    if (['balance', 'complex'].includes(wz.serviceId)) wz.extras = wz.extras.filter((x) => x !== 'balance');
    if (['puncture', 'tire', 'rim'].includes(wz.serviceId) && !wz.editId) wz.wheels = 1;
    else if (!['puncture', 'tire', 'rim'].includes(wz.serviceId) && wz.wheels < 4 && !wz.editId) wz.wheels = 4;
    A.render();
  };
  act['wz-car'] = (el) => { wz.carId = el.dataset.id; A.render(); };
  act['wz-size'] = (el) => { wz.nc.size = el.dataset.v; A.render(); };
  act['wz-rf'] = (el) => { wz.nc.runflat = el.checked; A.render(); };
  act['wz-wheels'] = (el) => { wz.wheels = Number(el.dataset.v); A.render(); };
  act['wz-extra'] = (el) => { const id = el.dataset.id; wz.extras = el.checked ? [...new Set([...wz.extras, id])] : wz.extras.filter((x) => x !== id); A.render(); };
  act['wz-month'] = (el) => { wz.month = new Date(wz.month.getFullYear(), wz.month.getMonth() + Number(el.dataset.d), 1); A.render(); };
  act['wz-date'] = (el) => { wz.date = el.dataset.date; wz.time = null; wzGo(4); };
  act['wz-time'] = (el) => { wz.time = el.dataset.t; wzGo(5); };
  act['wz-jump'] = (el) => wzGo(Number(el.dataset.step));
  act['wz-input'] = (el) => {
    const k = el.dataset.k;
    if (k.startsWith('nc.')) wz.nc[k.slice(3)] = el.value; else wz[k] = el.value;
    if (wz.errors[k.replace('nc.', '')]) { delete wz.errors[k.replace('nc.', '')]; el.classList.remove('err'); const h = el.parentElement.querySelector('.err-text'); if (h) h.remove(); }
  };
  act['wz-confirm'] = () => {
    if (!wzValidate(5)) { A.render(); return; }
    try {
      const me = s.me();
      if (wz.name.trim() !== me.name || wz.phone !== me.phone) s.updateClient(me.id, { name: wz.name.trim(), phone: u.formatPhone(wz.phone) });
      let carId = wz.carId;
      if (carId === 'new') { carId = s.addCar(Object.assign({ clientId: me.id }, wz.nc)).id; wz.carId = carId; }
      if (!slotOk()) { u.toast('Это время только что заняли — выберите другое', { type: 'error' }); wz.time = null; wzGo(4); return; }
      const data = { serviceId: wz.serviceId, carId, date: wz.date, time: wz.time, wheels: wz.wheels, extras: wz.extras };
      if (wz.editId) {
        s.updateBooking(wz.editId, data, { by: 'client' });
        const id = wz.editId; wz = null;
        location.hash = `#/done/${id}?edited=1`;
      } else {
        const b = s.createBooking(Object.assign({ clientId: me.id, source: 'client' }, data));
        wz = null;
        location.hash = `#/done/${b.id}`;
      }
    } catch (e) { u.toast(e.message, { type: 'error' }); }
  };

  function stepService() {
    const sv = s.getService(wz.serviceId);
    const anim = sv ? sv.anim : 'idle';
    const cap = sv && sv.id === 'storage' ? ['Хранение шин', 'Моем, упаковываем и храним комплект до следующего сезона'] : ANIM_CAP[anim];
    return `
      <div class="wheel-card" id="wheel-slot" data-anim="${anim}">
        <span class="wheel-tag">3D</span>
        <span class="wheel-kit ${anim === 'swap' ? 'on' : ''}" id="wheel-kit">${A.wheel.isWinter() ? icon('snow') + 'Зимний комплект' : icon('sun') + 'Летний комплект'}</span>
        <div class="wheel-cap"><b>${esc(sv ? sv.name : cap[0])}</b><span>${esc(cap[1])}</span></div>
      </div>
      <div class="svc-grid">
        ${s.S().services.map((x) => `<button class="svc ${wz.serviceId === x.id ? 'on' : ''}" data-act="wz-svc" data-id="${x.id}" aria-pressed="${wz.serviceId === x.id}">
          <span class="svc-ic">${icon(x.icon)}</span>
          <span class="svc-name">${esc(x.name)}</span>
          <span class="svc-price tnum">${esc(s.priceFrom(x))}</span>
          <span class="svc-check">${icon('check')}</span>
        </button>`).join('')}
      </div>`;
  }

  function stepCar() {
    const cars = s.carsOf(s.me().id);
    const isNew = wz.carId === 'new';
    const sv = s.getService(wz.serviceId);
    const perWheel = sv && ['puncture', 'tire', 'rim'].includes(sv.id);
    return `
      ${cars.length ? `<div class="car-pick">${cars.map((c) => `<button class="car-opt ${wz.carId === c.id ? 'on' : ''}" data-act="wz-car" data-id="${c.id}">
          <span class="car-opt-ic">${icon('car')}</span>
          <span class="grow"><b>${esc(s.carName(c))}</b><span class="sm muted">${esc(c.size)} · ${esc(c.kit)} комплект${c.runflat ? ' · Run-flat' : ''}</span></span>
          <span class="radio"></span>
        </button>`).join('')}
        <button class="car-opt ${isNew ? 'on' : ''}" data-act="wz-car" data-id="new"><span class="car-opt-ic">${icon('plus')}</span><span class="grow"><b>Другой автомобиль</b><span class="sm muted">Добавим в «Мои автомобили»</span></span><span class="radio"></span></button>
      </div>` : ''}
      ${isNew ? `<div class="card form-card">
        <div class="grid2">
          <div class="field"><label for="f-brand">Марка</label><input id="f-brand" class="input ${wz.errors.brand ? 'err' : ''}" list="brands" placeholder="Toyota" value="${esc(wz.nc.brand)}" data-input="wz-input" data-k="nc.brand" autocomplete="off">${wz.errors.brand ? `<span class="err-text">${wz.errors.brand}</span>` : ''}</div>
          <div class="field"><label for="f-model">Модель</label><input id="f-model" class="input ${wz.errors.model ? 'err' : ''}" placeholder="Camry" value="${esc(wz.nc.model)}" data-input="wz-input" data-k="nc.model" autocomplete="off">${wz.errors.model ? `<span class="err-text">${wz.errors.model}</span>` : ''}</div>
        </div>
        <datalist id="brands">${s.BRANDS.map((b) => `<option value="${b}">`).join('')}</datalist>
        <div class="field"><label>Размер колёс</label><div class="chips">${s.SIZES.map((z) => `<button class="chip ${wz.nc.size === z ? 'on' : ''}" data-act="wz-size" data-v="${z}">${z}</button>`).join('')}</div></div>
        <label class="switch-row"><span><b>Run-flat шины</b><span class="sm muted">Усиленная боковина, нужен особый монтаж</span></span><input type="checkbox" class="switch" data-change="wz-rf" ${wz.nc.runflat ? 'checked' : ''}></label>
      </div>` : ''}
      <div class="card form-card">
        <div class="field"><label>${perWheel ? 'Сколько колёс' : 'Количество колёс'}</label><div class="seg">${[1, 2, 3, 4].map((n) => `<button class="${wz.wheels === n ? 'on' : ''}" data-act="wz-wheels" data-v="${n}">${n}</button>`).join('')}</div></div>
        ${sv && !['balance', 'complex', 'storage'].includes(sv.id) ? `<label class="switch-row"><span><b>Добавить балансировку</b><span class="sm muted">Рекомендуем после шиномонтажа</span></span><input type="checkbox" class="switch" data-change="wz-extra" data-id="balance" ${wz.extras.includes('balance') ? 'checked' : ''}></label>` : ''}
      </div>`;
  }

  function stepDate() {
    const dur = wzDur();
    const m = wz.month;
    const T = u.todayKey();
    const maxKey = u.addDays(T, 60);
    const first = new Date(m.getFullYear(), m.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    const canPrev = m > new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    let cells = '';
    for (let i = 0; i < offset; i++) cells += '<span></span>';
    for (let d = 1; d <= days; d++) {
      const k = u.dateKey(new Date(m.getFullYear(), m.getMonth(), d));
      const past = k < T, far = k > maxKey;
      let cls = '', dot = '', free = 0;
      if (!past && !far) {
        free = s.freeSlots(k, dur, wz.editId, wzCarId()).length;
        dot = free === 0 ? 'full' : free < 6 ? 'mid' : '';
      }
      const dis = past || far || free === 0;
      if (k === T) cls += ' today';
      if (k === wz.date) cls += ' on';
      cells += `<button class="cal-day${cls}" ${dis ? 'disabled' : ''} data-act="wz-date" data-date="${k}" aria-label="${d} ${u.MONTHS_GEN[m.getMonth()]}${dis ? ', нет мест' : ''}">${d}${!past && !far ? `<i class="ld ${dot}"></i>` : ''}</button>`;
    }
    const quick = [0, 1, 2].map((i) => u.addDays(T, i)).map((k) => ({ k, n: s.freeSlots(k, dur, wz.editId, wzCarId()).length }));
    return `
      <div class="quick-days">${quick.map((q) => `<button class="qday ${wz.date === q.k ? 'on' : ''}" data-act="wz-date" data-date="${q.k}" ${q.n ? '' : 'disabled'}><b>${esc(u.relDay(q.k))}</b><span>${q.n ? `${q.n} ${u.plural(q.n, ['окно', 'окна', 'окон'])}` : 'нет мест'}</span></button>`).join('')}</div>
      <div class="cal">
        <div class="cal-head">
          <button class="icon-btn" data-act="wz-month" data-d="-1" ${canPrev ? '' : 'disabled'} aria-label="Предыдущий месяц">${icon('chevL')}</button>
          <b>${u.MONTHS[m.getMonth()]} ${m.getFullYear()}</b>
          <button class="icon-btn" data-act="wz-month" data-d="1" aria-label="Следующий месяц">${icon('chevR')}</button>
        </div>
        <div class="cal-grid">${['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => `<span class="cal-dow">${d}</span>`).join('')}${cells}</div>
        <div class="cal-legend"><span><i class="ld"></i>Много мест</span><span><i class="ld mid"></i>Мало мест</span><span><i class="ld full"></i>Занято</span></div>
      </div>`;
  }

  function stepTime() {
    const dur = wzDur();
    const slots = s.freeSlots(wz.date, dur, wz.editId, wzCarId());
    const groups = [['Утро', (m) => m < 720], ['День', (m) => m >= 720 && m < 1020], ['Вечер', (m) => m >= 1020]];
    const head = `<div class="date-line"><span>${icon('calendar')}${esc(u.fmtDay(wz.date))}</span><button class="link-sm" data-act="wz-jump" data-step="3">Изменить дату</button></div>`;
    if (!slots.length) {
      const nf = s.nearestFree(dur);
      return head + emptyState('clock', 'На эту дату мест нет', nf ? `Ближайшее свободное время — ${u.fmtDay(nf.date)}` : '', nf ? `<button class="btn btn-outline" data-act="wz-date" data-date="${nf.date}">Показать ${esc(u.fmtDate(nf.date))}</button>` : '');
    }
    return head + `<p class="muted sm" style="margin:0 0 12px">Показано только свободное время. Длительность работ ≈ ${dur} мин.</p>` +
      groups.map(([name, f]) => {
        const g = slots.filter((t) => f(u.toMin(t)));
        if (!g.length) return '';
        return `<div class="tgroup"><div class="tgroup-h">${name}</div><div class="slots">${g.map((t) => `<button class="slot ${wz.time === t ? 'on' : ''}" data-act="wz-time" data-t="${t}">${t}</button>`).join('')}</div></div>`;
      }).join('');
  }

  function summaryCard() {
    const car = wzCar(), sv = s.getService(wz.serviceId), est = wzEst(), st = s.settings();
    return `<div class="card summary">
      <div class="sum-row"><span>${icon(sv.icon)}</span><div class="grow"><b>${esc(sv.name)}</b><span class="sm muted">${wz.wheels} ${u.plural(wz.wheels, ['колесо', 'колеса', 'колёс'])}${wz.extras.includes('balance') ? ' + балансировка' : ''}</span></div><button class="link-sm" data-act="wz-jump" data-step="1">Изменить</button></div>
      <div class="sum-row"><span>${icon('car')}</span><div class="grow"><b>${esc(s.carName(car))}</b><span class="sm muted">${esc(car.size)}${car.runflat ? ' · Run-flat' : ''}</span></div><button class="link-sm" data-act="wz-jump" data-step="2">Изменить</button></div>
      <div class="sum-row"><span>${icon('clock')}</span><div class="grow"><b>${esc(u.fmtDay(wz.date))}, ${wz.time}</b><span class="sm muted">≈ ${est.duration} мин</span></div><button class="link-sm" data-act="wz-jump" data-step="3">Изменить</button></div>
      <div class="sum-row"><span>${icon('pin')}</span><div class="grow"><b>${esc(st.address)}</b><span class="sm muted">${esc(st.city)}</span></div></div>
      <div class="sum-total"><span>Ориентировочно</span><b class="tnum">${money(est.total)}</b></div>
    </div>`;
  }

  function stepData() {
    return `
      <div class="card form-card">
        <div class="field"><label for="f-name">Имя</label><input id="f-name" class="input ${wz.errors.name ? 'err' : ''}" value="${esc(wz.name)}" data-input="wz-input" data-k="name" autocomplete="given-name" placeholder="Как к вам обращаться">${wz.errors.name ? `<span class="err-text">${wz.errors.name}</span>` : ''}</div>
        <div class="field" style="margin-bottom:0"><label for="f-phone">Телефон</label><input id="f-phone" class="input tnum ${wz.errors.phone ? 'err' : ''}" type="tel" inputmode="tel" data-phone value="${esc(wz.phone)}" data-input="wz-input" data-k="phone" autocomplete="tel" placeholder="+7 (___) ___-__-__">${wz.errors.phone ? `<span class="err-text">${wz.errors.phone}</span>` : '<span class="hint">Пришлём подтверждение и статус заказа</span>'}</div>
      </div>
      ${summaryCard()}`;
  }

  V.book = {
    shell: 'client',
    enter(p) { initWizard(p); wzShownStep = 0; },
    render(p) {
      if (!wz) initWizard(p);
      const est = wzEst();
      const body = [stepService, stepCar, stepDate, stepTime, stepData][wz.step - 1]();
      const last = wz.step === 5;
      const canNext = wz.step === 1 ? !!wz.serviceId : wz.step === 3 ? !!wz.date : wz.step === 4 ? !!wz.time : true;
      const showFoot = wz.step !== 3 && wz.step !== 4 || (wz.step === 3 && wz.date) || (wz.step === 4 && wz.time);
      return shell(`
        <div class="wz-progress" aria-hidden="true">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= wz.step ? 'on' : ''}"></i>`).join('')}</div>
        <div class="wz-step">Шаг ${wz.step} из 5</div>
        <h1 class="wz-title">${wz.editId ? (wz.step === 5 ? 'Проверьте изменения' : STEP_TITLES[wz.step - 1]) : STEP_TITLES[wz.step - 1]}</h1>
        <div class="wz-body ${wz.step !== wzShownStep ? 'anim' : ''}">${body}</div>
        ${showFoot ? `<div class="wz-foot"><div class="wz-foot-in">
          <div class="wz-price">${est ? `<span>Ориентировочно</span><b class="tnum">${money(est.total)}</b>` : '<span>Стоимость</span><b>—</b>'}</div>
          ${last ? `<button class="btn btn-primary btn-lg" data-act="wz-confirm">${wz.editId ? 'Сохранить изменения' : 'Подтвердить запись'}</button>`
          : `<button class="btn btn-primary btn-lg" data-act="wz-next" ${canNext ? '' : 'disabled'}>Далее ${icon('arrowR')}</button>`}
        </div></div>` : ''}
      `, { back: true, title: wz.editId ? `Изменение записи №${wz.editId}` : 'Запись', flow: true, mainCls: 'has-foot' });
    },
    mount(root) {
      wzShownStep = wz ? wz.step : 0;
      if (wz && wz.step === 1) {
        const slot = root.querySelector('#wheel-slot');
        const sv = s.getService(wz.serviceId);
        A.wheel.attach(slot, sv ? sv.anim : 'idle');
        A.wheel.onSwap((winter) => {
          const el = document.getElementById('wheel-kit');
          if (el) el.innerHTML = winter ? icon('snow') + 'Зимний комплект' : icon('sun') + 'Летний комплект';
        });
      }
    },
  };

  /* ================= Запись подтверждена ================= */
  V.done = {
    shell: 'client',
    render(p) {
      const b = s.getBooking(p.id);
      if (!b) return shell(emptyState('alert', 'Запись не найдена', '', '<a class="btn btn-primary" href="#/">На главную</a>'), { tab: 'records' });
      const car = s.getCar(b.carId), sv = s.getService(b.serviceId), st = s.settings(), m = s.getMaster(b.masterId);
      const d = u.parseKey(b.date);
      const cancelled = b.status === 'cancelled';
      return shell(`
        <div class="done ${cancelled ? 'is-cancelled' : ''}">
          <div class="done-ic">${icon(cancelled ? 'x' : 'check')}</div>
          <h1>${cancelled ? 'Запись отменена' : p.edited ? 'Запись изменена' : 'Запись подтверждена'}</h1>
          <div class="done-no tnum">№ ${b.id}</div>
          <div class="ticket">
            <div class="ticket-car"><b>${esc(s.carName(car))}</b><span class="tag">${esc(car.size)}</span></div>
            <div class="ticket-svc">${esc(sv.short)}${b.extras.includes('balance') ? ' + балансировка' : ''}</div>
            <div class="ticket-when">
              <div><span class="lbl">Дата</span><b>${esc(u.fmtDate(b.date))}</b><span class="sm muted">${u.DOW[d.getDay()]}</span></div>
              <div><span class="lbl">Время</span><b class="tnum">${b.time}</b><span class="sm muted">≈ ${b.duration} мин</span></div>
            </div>
            <div class="ticket-row">${icon('lift')}<span>Пост ${b.post}${m ? ` · мастер ${esc(s.firstName(m.name))}` : ''}</span></div>
            <div class="ticket-row">${icon('ruble')}<span>Ориентировочно <b class="tnum">${money(b.price)}</b>, оплата на месте</span></div>
            <div class="ticket-row">${icon('pin')}<span>${esc(st.address)}, ${esc(st.city)}</span></div>
          </div>
          ${cancelled ? `<a class="btn btn-primary btn-lg btn-block" href="#/book?service=${b.serviceId}&car=${b.carId}">Записаться снова</a>` : `
          <button class="btn btn-primary btn-lg btn-block" data-act="c-ics" data-id="${b.id}">${icon('calPlus')}Добавить в календарь</button>
          ${b.status === 'created' ? `<div class="row2">
            <a class="btn btn-outline btn-lg" href="#/book?edit=${b.id}">${icon('edit')}Изменить запись</a>
            <button class="btn btn-outline-danger btn-lg" data-act="c-cancel" data-id="${b.id}">${icon('x')}Отменить запись</button>
          </div>` : ''}`}
          <a class="link-sm center" href="#/records">Перейти к моим записям ${icon('chevR')}</a>
        </div>
      `, { tab: 'records' });
    },
  };
  act['c-ics'] = (el) => ui.ics(s.getBooking(el.dataset.id));
  act['c-cancel'] = async (el) => {
    const b = s.getBooking(el.dataset.id);
    const ok = await u.confirmDialog({ title: 'Отменить запись?', text: `№ ${b.id}: ${u.fmtDay(b.date)} в ${b.time}. Время освободится для других клиентов.`, ok: 'Отменить запись', cancel: 'Оставить', danger: true });
    if (!ok) return;
    s.cancelBooking(b.id, 'client');
    u.toast('Запись отменена', { icon: 'check' });
  };

  /* ================= Записи ================= */
  V.records = {
    shell: 'client',
    render() {
      const mine = myBookings();
      const active = mine.filter(s.isActive).sort(s.cmpBooking);
      const T = u.todayKey();
      const recentDone = mine.filter((b) => b.status === 'done' && b.date >= u.addDays(T, -1)).sort(s.cmpBooking).reverse();
      const cancelled = mine.filter((b) => b.status === 'cancelled' && b.date >= T);
      const card = (b) => {
        const car = s.getCar(b.carId), sv = s.getService(b.serviceId), m = s.getMaster(b.masterId);
        const just = seenStatus[b.id] && seenStatus[b.id] !== b.status;
        const live = s.isInWork(b);
        return `<article class="card rec ${live ? 'is-live' : ''} ${b.status === 'done' ? 'is-done' : ''}">
          <div class="rec-top">
            <div><div class="rec-when tnum">${esc(u.fmtDay(b.date))} · ${b.time}</div><div class="muted sm tnum">№ ${b.id} · Пост ${b.post}${m ? ' · ' + esc(s.firstName(m.name)) : ''}</div></div>
            ${live ? '<span class="live-badge"><i></i>В работе</span>' : ui.pill(b.status)}
          </div>
          <div class="rec-info">
            <div><span class="lbl">Автомобиль</span><b>${esc(s.carName(car))}</b> <span class="tag">${esc(car.size)}</span></div>
            <div><span class="lbl">Услуга</span><b>${esc(sv.short)}</b>${b.extras.includes('balance') ? ' <span class="sm muted">+ балансировка</span>' : ''}</div>
          </div>
          <div class="rec-status ${just ? 'flash' : ''}"><span class="lbl">Статус</span><b>${esc(s.statusLabel(b.status))}</b></div>
          ${ui.tracker(b, just)}
          ${b.status === 'done' ? `<div class="pay-line ${b.paid ? 'paid' : ''}">${icon(b.paid ? 'check' : 'card')}<span>${b.paid ? `Оплачено ${money(b.price)} · ${esc(b.payMethod)}` : `К оплате ${money(b.price)} — картой, по СБП или наличными`}</span></div>${seasonPrompt(b)}` : ''}
          ${b.status === 'created' ? `<div class="rec-actions">
            <button class="btn btn-outline btn-sm" data-act="c-ics" data-id="${b.id}">${icon('calPlus')}В календарь</button>
            <a class="btn btn-outline btn-sm" href="#/book?edit=${b.id}">${icon('edit')}Изменить</a>
            <button class="btn btn-ghost-danger btn-sm" data-act="c-cancel" data-id="${b.id}">Отменить</button>
          </div>` : ''}
        </article>`;
      };
      const html = `
        <div class="page-h"><h1>Мои записи</h1><a href="#/book" class="btn btn-primary btn-sm">${icon('plus')}Записаться</a></div>
        ${!active.length && !recentDone.length ? emptyState('calendar', 'Нет предстоящих записей', 'Запишитесь — это займёт пару минут', '<a href="#/book" class="btn btn-primary">Записаться</a>') : ''}
        ${active.map(card).join('')}
        ${recentDone.length ? `<div class="sec-h"><h2>Недавно завершены</h2></div>${recentDone.map(card).join('')}` : ''}
        ${cancelled.length ? `<div class="sec-h"><h2>Отменённые</h2></div>${cancelled.map((b) => `<div class="card row-mini"><span class="muted">${icon('x')}</span><div class="grow"><b>${esc(u.fmtDay(b.date))}, ${b.time}</b><div class="sm muted">${esc(s.bookingTitle(b))}</div></div>${ui.pill('cancelled')}</div>`).join('')}` : ''}
        <a class="link-sm center" href="#/history">История посещений ${icon('chevR')}</a>`;
      return shell(html, { tab: 'records' });
    },
    after() { myBookings().forEach((b) => { seenStatus[b.id] = b.status; }); },
  };

  function seasonPrompt(b) {
    const me = s.me();
    const r = (me.reminders || []).find((x) => String(x.bookingId) === String(b.id));
    if (r) return `<div class="season set">${icon('check')}<div><b>Напомним ${esc(u.fmtDate(r.date, { year: true }))}</b><span>Перед началом следующего сезона пришлём уведомление</span></div></div>`;
    return `<div class="season"><div class="season-txt">${icon('snow')}<div><b>Понадобится снова через сезон?</b><span>Напомним заранее, чтобы вы записались без очередей</span></div></div><button class="btn btn-accent btn-sm" data-act="c-remind" data-id="${b.id}">Напомнить мне</button></div>`;
  }
  act['c-remind'] = (el) => {
    const d = s.setReminder(el.dataset.id);
    if (d) u.toast(`Напомним ${u.fmtDate(d, { year: true })}`, { title: 'Напоминание включено', icon: 'check' });
  };

  /* ================= Автомобили ================= */
  V.cars = {
    shell: 'client',
    render() {
      const cars = s.carsOf(s.me().id);
      return shell(`
        <div class="page-h"><h1>Мои автомобили</h1><button class="btn btn-outline btn-sm" data-act="c-car-edit">${icon('plus')}Добавить</button></div>
        ${cars.length ? cars.map((c) => {
          const visits = s.S().bookings.filter((b) => b.carId === c.id && b.status === 'done').length;
          return `<article class="card carcard">
            <div class="carcard-top">
              <span class="carcard-ic">${icon('car')}</span>
              <div class="grow"><h3>${esc(s.carName(c))}</h3>${c.plate ? `<span class="plate">${esc(c.plate)}</span>` : ''}</div>
              <button class="icon-btn" data-act="c-car-edit" data-id="${c.id}" aria-label="Изменить">${icon('edit')}</button>
            </div>
            <div class="carcard-specs">
              <div><span class="lbl">Размер</span><b>${esc(c.size)}</b></div>
              <div><span class="lbl">Комплект</span><b>${esc(c.kit)}</b></div>
              <div><span class="lbl">Пробег</span><b class="tnum">${c.mileage ? u.num(c.mileage) + ' км' : '—'}</b></div>
            </div>
            <div class="carcard-foot"><span class="sm muted">${c.runflat ? 'Run-flat · ' : ''}${visits} ${u.plural(visits, ['визит', 'визита', 'визитов'])}</span><a class="btn btn-primary btn-sm" href="#/book?car=${c.id}">Записать автомобиль</a></div>
          </article>`;
        }).join('') : emptyState('car', 'Добавьте автомобиль', 'Сохраним размер колёс, чтобы записываться в одно касание', '<button class="btn btn-primary" data-act="c-car-edit">Добавить автомобиль</button>')}
      `, { tab: 'cars' });
    },
  };
  act['c-car-edit'] = (el) => carForm(el.dataset.id ? s.getCar(el.dataset.id) : null, s.me().id);

  function carForm(car, clientId, onSaved) {
    const f = car ? Object.assign({}, car) : { brand: '', model: '', size: 'R16', kit: 'Летний', mileage: '', runflat: false, plate: '' };
    const m = u.modal({
      title: car ? 'Автомобиль' : 'Новый автомобиль',
      body: () => `
        <div class="grid2">
          <div class="field"><label>Марка</label><input class="input" list="brands-m" name="brand" value="${esc(f.brand)}" placeholder="Toyota" autofocus autocomplete="off"></div>
          <div class="field"><label>Модель</label><input class="input" name="model" value="${esc(f.model)}" placeholder="Camry" autocomplete="off"></div>
        </div>
        <datalist id="brands-m">${s.BRANDS.map((b) => `<option value="${b}">`).join('')}</datalist>
        <div class="grid2">
          <div class="field"><label>Госномер</label><input class="input" name="plate" value="${esc(f.plate)}" placeholder="А 123 ВС 777"></div>
          <div class="field"><label>Пробег, км</label><input class="input tnum" name="mileage" inputmode="numeric" value="${esc(f.mileage)}" placeholder="64 200"></div>
        </div>
        <div class="field"><label>Размер колёс</label><div class="chips" data-group="size">${s.SIZES.map((z) => `<button type="button" class="chip ${f.size === z ? 'on' : ''}" data-v="${z}">${z}</button>`).join('')}</div></div>
        <div class="field"><label>Комплект на автомобиле</label><div class="seg" data-group="kit">${s.KITS.map((k) => `<button type="button" class="${f.kit === k ? 'on' : ''}" data-v="${k}">${k}</button>`).join('')}</div></div>
        <label class="switch-row"><span><b>Run-flat шины</b></span><input type="checkbox" class="switch" name="runflat" ${f.runflat ? 'checked' : ''}></label>`,
      footer: () => `${car ? `<button class="btn btn-ghost-danger mr-auto" data-del>${icon('trash')}Удалить</button>` : ''}<button class="btn btn-outline" data-close>Отмена</button><button class="btn btn-primary" data-save>Сохранить</button>`,
      mount(el) {
        el.querySelectorAll('[data-group]').forEach((g) => g.addEventListener('click', (e) => {
          const b = e.target.closest('[data-v]'); if (!b) return;
          f[g.dataset.group] = b.dataset.v;
          g.querySelectorAll('[data-v]').forEach((x) => x.classList.toggle('on', x === b));
        }));
        el.querySelector('[data-save]').onclick = () => {
          const v = (n) => el.querySelector(`[name=${n}]`);
          const data = { brand: v('brand').value.trim(), model: v('model').value.trim(), plate: v('plate').value.trim().toUpperCase(), mileage: Number(u.digits(v('mileage').value)) || 0, runflat: v('runflat').checked, size: f.size, kit: f.kit };
          if (!data.brand || !data.model) { u.toast('Укажите марку и модель', { type: 'error' }); (data.brand ? v('model') : v('brand')).classList.add('err'); return; }
          let saved;
          if (car) saved = s.updateCar(car.id, data); else saved = s.addCar(Object.assign({ clientId }, data));
          m.close();
          u.toast(car ? 'Автомобиль сохранён' : 'Автомобиль добавлен', { icon: 'check' });
          onSaved && onSaved(saved);
        };
        const del = el.querySelector('[data-del]');
        if (del) del.onclick = async () => {
          const used = s.S().bookings.some((b) => b.carId === car.id && s.isActive(b));
          if (used) { u.toast('У автомобиля есть активная запись', { type: 'error' }); return; }
          m.close();
          if (await u.confirmDialog({ title: 'Удалить автомобиль?', text: `${s.carName(car)} будет удалён из списка. История посещений сохранится у сервиса.`, ok: 'Удалить', danger: true })) s.deleteCar(car.id);
        };
      },
    });
  }
  ui.carForm = carForm;

  /* ================= История ================= */
  V.history = {
    shell: 'client',
    render() {
      const done = myBookings().filter((b) => b.status === 'done').sort(s.cmpBooking).reverse();
      const st = s.clientStats(s.me().id);
      const latest = done[0];
      return shell(`
        <div class="page-h"><h1>История</h1></div>
        <div class="stats3">
          <div><b class="tnum">${st.orders}</b><span>${u.plural(st.orders, ['визит', 'визита', 'визитов'])}</span></div>
          <div><b class="tnum">${money(st.total)}</b><span>всего</span></div>
          <div><b class="tnum">${money(st.avg)}</b><span>средний чек</span></div>
        </div>
        ${latest ? `<div class="card season-card">${seasonPrompt(latest) || `<div class="season"><div class="season-txt">${icon('calendar')}<div><b>Последний визит — ${esc(u.fmtDate(latest.date))}</b><span>${esc(s.bookingTitle(latest))}</span></div></div></div>`}</div>` : ''}
        ${done.length ? `<div class="hist">${done.map((b) => {
          const car = s.getCar(b.carId), sv = s.getService(b.serviceId);
          return `<article class="hist-item">
            <div class="hist-date"><b class="tnum">${u.parseKey(b.date).getDate()}</b><span>${u.MONTHS_SHORT[u.parseKey(b.date).getMonth()]}</span><span class="yr">${u.parseKey(b.date).getFullYear()}</span></div>
            <div class="grow">
              <b>${esc(sv.short)}${b.extras.includes('balance') ? ' + балансировка' : ''}</b>
              <div class="sm muted">${esc(s.carName(car))} · ${esc(car ? car.size : '')} · № ${b.id}</div>
              <div class="hist-foot"><b class="tnum">${money(b.price)}</b><a class="btn btn-outline btn-sm" href="#/book?service=${b.serviceId}&car=${b.carId}${b.extras.length ? '&extras=' + b.extras.join(',') : ''}">${icon('refresh')}Записаться снова</a></div>
            </div>
          </article>`;
        }).join('')}</div>` : emptyState('history', 'Посещений пока нет', 'После первого визита здесь появится история и стоимость работ')}
      `, { tab: 'history' });
    },
  };

  /* ================= Профиль ================= */
  V.profile = {
    shell: 'client',
    render() {
      const me = s.me(), st = s.settings(), stats = s.clientStats(me.id);
      const rem = (me.reminders || []).filter((r) => !r.fired);
      const prefs = me.prefs || { status: true, season: true };
      return shell(`
        <div class="profile-h">
          <span class="avatar lg">${esc(u.initials(me.name))}</span>
          <div class="grow"><h1>${esc(me.name)}</h1><div class="muted tnum">${esc(me.phone)}</div></div>
          <button class="icon-btn" data-act="c-profile-edit" aria-label="Редактировать">${icon('edit')}</button>
        </div>
        <div class="stats3">
          <div><b class="tnum">${stats.orders}</b><span>визитов</span></div>
          <div><b class="tnum">${s.carsOf(me.id).length}</b><span>автомобиля</span></div>
          <div><b class="tnum">${money(stats.total)}</b><span>потрачено</span></div>
        </div>

        <div class="sec-h"><h2>Оформление</h2></div>
        <div class="card theme-card">${A.theme.segment()}<p class="sm muted" style="margin:10px 0 0">«Авто» — как в настройках телефона</p></div>

        <div class="sec-h"><h2>Уведомления</h2></div>
        <div class="card list-card">
          <label class="switch-row"><span><b>Статус заказа</b><span class="sm muted">«Автомобиль принят», «Готово» и т.д.</span></span><input type="checkbox" class="switch" data-change="c-pref" data-k="status" ${prefs.status ? 'checked' : ''}></label>
          <label class="switch-row"><span><b>Напоминания о записи</b><span class="sm muted">За день до визита</span></span><input type="checkbox" class="switch" checked disabled></label>
          <label class="switch-row"><span><b>Сезонные напоминания</b><span class="sm muted">Перед сменой сезона</span></span><input type="checkbox" class="switch" data-change="c-pref" data-k="season" ${prefs.season ? 'checked' : ''}></label>
        </div>

        ${rem.length ? `<div class="sec-h"><h2>Мои напоминания</h2></div><div class="card list-card">${rem.map((r) => `<div class="li">${icon('bell', 'muted')}<div class="grow"><b>${esc(s.getService(r.serviceId).short)}</b><span class="sm muted">${esc(s.carName(s.getCar(r.carId)))} · ${esc(u.fmtDate(r.date, { year: true }))}</span></div><button class="icon-btn" data-act="c-rem-del" data-id="${r.id}" aria-label="Удалить">${icon('x')}</button></div>`).join('')}</div>` : ''}

        <div class="sec-h"><h2>Сервис</h2></div>
        <div class="card list-card">
          <a class="li" href="#/calc">${icon('calc', 'muted')}<div class="grow"><b>Калькулятор стоимости</b></div>${icon('chevR', 'muted')}</a>
          <a class="li" href="tel:${u.digits(st.phone)}">${icon('phone', 'muted')}<div class="grow"><b>${esc(st.phone)}</b><span class="sm muted">Администратор</span></div>${icon('chevR', 'muted')}</a>
          <div class="li">${icon('pin', 'muted')}<div class="grow"><b>${esc(st.address)}</b><span class="sm muted">${esc(st.city)} · ежедневно ${st.open}–${st.close}</span></div></div>
        </div>

        <div class="sec-h"><h2>Демо</h2></div>
        <div class="card list-card">
          <a class="li" href="#/admin">${icon('grid', 'muted')}<div class="grow"><b>Кабинет сервиса</b><span class="sm muted">Панель администратора</span></div>${icon('chevR', 'muted')}</a>
          <a class="li" href="#/master">${icon('worker', 'muted')}<div class="grow"><b>Экран мастера</b><span class="sm muted">Текущая работа на посту</span></div>${icon('chevR', 'muted')}</a>
          <button class="li" data-act="reset-demo">${icon('refresh', 'muted')}<div class="grow"><b>Сбросить демо-данные</b></div></button>
        </div>
      `, { tab: 'profile' });
    },
  };
  act['c-pref'] = (el) => { const me = s.me(); me.prefs = Object.assign({ status: true, season: true }, me.prefs, { [el.dataset.k]: el.checked }); s.save(); };
  act['c-rem-del'] = (el) => { s.removeReminder(el.dataset.id); u.toast('Напоминание удалено'); };
  act['c-profile-edit'] = () => {
    const me = s.me();
    const m = u.modal({
      title: 'Профиль',
      body: `<div class="field"><label>Имя</label><input class="input" name="name" value="${esc(me.name)}" autofocus></div>
             <div class="field"><label>Телефон</label><input class="input tnum" name="phone" data-phone type="tel" value="${esc(me.phone)}"></div>`,
      footer: '<button class="btn btn-outline" data-close>Отмена</button><button class="btn btn-primary" data-save>Сохранить</button>',
      mount(el) {
        el.querySelector('[data-save]').onclick = () => {
          const name = el.querySelector('[name=name]').value.trim(), phone = el.querySelector('[name=phone]').value;
          if (name.length < 2 || !u.phoneValid(phone)) { u.toast('Проверьте имя и телефон', { type: 'error' }); return; }
          s.updateClient(me.id, { name, phone: u.formatPhone(phone) });
          m.close();
          u.toast('Профиль сохранён', { icon: 'check' });
        };
      },
    });
  };
  act['reset-demo'] = async () => {
    if (await u.confirmDialog({ title: 'Сбросить демо-данные?', text: 'Все записи, клиенты и настройки вернутся к начальному состоянию.', ok: 'Сбросить', danger: true })) {
      s.reset();
      u.toast('Демо-данные восстановлены', { icon: 'refresh' });
    }
  };

  /* ================= Умный калькулятор ================= */
  let calc = null;
  function initCalc() {
    const car = s.carsOf(s.me().id)[0];
    calc = { serviceId: 'season', wheels: 4, size: car ? car.size : 'R16', runflat: car ? car.runflat : false, extras: ['balance'], date: null, time: null };
  }
  V.calc = {
    shell: 'client',
    render() {
      if (!calc) initCalc();
      const sv = s.getService(calc.serviceId);
      const est = s.estimate(calc);
      const T = u.todayKey();
      const days = [];
      for (let i = 0; i < 14 && days.length < 2; i++) {
        const d = u.addDays(T, i);
        const sl = s.freeSlots(d, est.duration);
        if (sl.length) days.push({ d, sl: ui.spreadSlots(sl, 8, 60) });
      }
      const showBalance = !['balance', 'complex', 'storage'].includes(calc.serviceId);
      const href = `#/book?service=${calc.serviceId}&size=${calc.size}&wheels=${calc.wheels}${calc.runflat ? '&runflat=1' : ''}${calc.extras.length ? '&extras=' + calc.extras.join(',') : ''}${calc.date ? `&date=${calc.date}&time=${calc.time}` : ''}`;
      return shell(`
        <p class="muted" style="margin:0 0 14px">Подберите параметры — цена пересчитается сразу.</p>
        <div class="card form-card">
          <div class="field"><label>Тип услуги</label>
            <select class="input select" data-change="calc-svc">${s.S().services.map((x) => `<option value="${x.id}" ${x.id === calc.serviceId ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
          </div>
          <div class="field"><label>Количество колёс</label><div class="seg seg-fill">${[1, 2, 3, 4].map((n) => `<button class="${calc.wheels === n ? 'on' : ''}" data-act="calc-set" data-k="wheels" data-v="${n}">${n}</button>`).join('')}</div></div>
          <div class="field"><label>Размер диска</label><div class="chips">${s.SIZES.map((z) => `<button class="chip ${calc.size === z ? 'on' : ''}" data-act="calc-set" data-k="size" data-v="${z}">${z}</button>`).join('')}</div></div>
          <div class="field"><label>Шины</label><div class="seg seg-fill"><button class="${!calc.runflat ? 'on' : ''}" data-act="calc-set" data-k="runflat" data-v="0">Обычные</button><button class="${calc.runflat ? 'on' : ''}" data-act="calc-set" data-k="runflat" data-v="1">Run-flat</button></div>${calc.runflat && !sv.runflat ? '<span class="hint">Для этой услуги тип шины не влияет на цену</span>' : ''}</div>
          <div class="field" style="margin-bottom:0"><label>Дополнительные работы</label>
            <div class="checks">${s.EXTRAS.filter((e) => e.id !== 'balance' || showBalance).map((e) => `<label class="check"><input type="checkbox" data-change="calc-extra" data-id="${e.id}" ${calc.extras.includes(e.id) ? 'checked' : ''}><span class="check-box">${icon('check')}</span><span class="grow">${esc(e.name)}</span><span class="sm muted tnum">${e.price ? `${e.price} ₽ / колесо` : ''}</span></label>`).join('')}</div>
          </div>
        </div>

        <div class="card calc-result">
          <div class="calc-lines">${est.lines.map((l) => `<div><span>${esc(l.name)}</span><b class="tnum">${money(l.amount)}</b></div>`).join('')}</div>
          <div class="calc-total"><span>Ориентировочно:</span><b class="tnum" id="calc-total">${money(est.total)}</b></div>
          <div class="sm muted">${icon('clock')} Займёт около ${est.rawDuration} мин · точная цена — после осмотра</div>
        </div>

        <div class="sec-h"><h2>Свободное время</h2><span class="muted sm">на ${est.duration} мин</span></div>
        ${days.length ? days.map((x) => `<div class="tgroup"><div class="tgroup-h">${esc(u.fmtDay(x.d))}</div><div class="slots">${x.sl.map((t) => `<button class="slot ${calc.date === x.d && calc.time === t ? 'on' : ''}" data-act="calc-slot" data-d="${x.d}" data-t="${t}">${t}</button>`).join('')}</div></div>`).join('') : '<p class="muted">Нет свободного времени в ближайшие две недели</p>'}
        <div class="wz-foot"><div class="wz-foot-in">
          <div class="wz-price"><span>${calc.date ? esc(u.fmtDay(calc.date)) + ', ' + calc.time : 'Итого'}</span><b class="tnum">${money(est.total)}</b></div>
          <a class="btn btn-primary btn-lg ${calc.date ? '' : 'is-soft'}" href="${href}">${calc.date ? 'Записаться на это время' : 'Записаться'}</a>
        </div></div>
      `, { back: true, title: 'Калькулятор стоимости', flow: true, mainCls: 'has-foot' });
    },
  };
  act['calc-svc'] = (el) => {
    calc.serviceId = el.value;
    if (['puncture', 'tire', 'rim'].includes(calc.serviceId)) calc.wheels = 1; else calc.wheels = 4;
    if (['balance', 'complex', 'storage'].includes(calc.serviceId)) calc.extras = calc.extras.filter((x) => x !== 'balance');
    calc.date = calc.time = null;
    A.render();
  };
  act['calc-set'] = (el) => {
    const k = el.dataset.k;
    calc[k] = k === 'wheels' ? Number(el.dataset.v) : k === 'runflat' ? el.dataset.v === '1' : el.dataset.v;
    if (k === 'wheels') calc.date = calc.time = null;
    A.render();
  };
  act['calc-extra'] = (el) => { const id = el.dataset.id; calc.extras = el.checked ? [...new Set([...calc.extras, id])] : calc.extras.filter((x) => x !== id); A.render(); };
  act['calc-slot'] = (el) => {
    if (calc.date === el.dataset.d && calc.time === el.dataset.t) { calc.date = calc.time = null; } else { calc.date = el.dataset.d; calc.time = el.dataset.t; }
    A.render();
  };
})(window.App);
