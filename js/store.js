/* ПитЛайн — данные, бизнес-логика, расчёт стоимости и свободного времени.
   Хранилище — localStorage; вкладки синхронизируются через событие storage,
   поэтому изменение статуса в админ-панели сразу видно в клиентском приложении. */
(function (A) {
  'use strict';
  const u = A.u;
  const KEY = 'pitline_state_v1';
  const VERSION = 3;

  const STATUSES = [
    { key: 'created', label: 'Запись создана', short: 'Создана', icon: 'calendar' },
    { key: 'accepted', label: 'Автомобиль принят', short: 'Принят', icon: 'car' },
    { key: 'lift', label: 'Автомобиль на подъёмнике', short: 'На подъёмнике', icon: 'lift' },
    { key: 'work', label: 'Работа выполняется', short: 'В работе', icon: 'wrench' },
    { key: 'balance', label: 'Балансировка', short: 'Балансировка', icon: 'balance' },
    { key: 'done', label: 'Готово', short: 'Готово', icon: 'check' },
  ];
  const ST_IDX = Object.fromEntries(STATUSES.map((s, i) => [s.key, i]));
  const IN_WORK = ['accepted', 'lift', 'work', 'balance'];
  const statusLabel = (k) => (k === 'cancelled' ? 'Отменена' : STATUSES[ST_IDX[k]].label);
  const statusShort = (k) => (k === 'cancelled' ? 'Отменена' : STATUSES[ST_IDX[k]].short);
  const isInWork = (b) => IN_WORK.includes(b.status);
  const isActive = (b) => b.status !== 'done' && b.status !== 'cancelled';

  const CLIENT_MSG = {
    accepted: ['Ваш автомобиль принят', 'Мастер принял автомобиль на посту'],
    lift: ['Автомобиль на подъёмнике', 'Начинаем снимать колёса'],
    work: ['Работа выполняется', 'Мастер выполняет работы по заказу'],
    balance: ['Балансировка', 'Колёса на балансировочном стенде'],
    done: ['Работа завершена', 'Все работы по заказу выполнены'],
  };

  const SIZES = ['R13', 'R14', 'R15', 'R16', 'R17', 'R18', 'R19', 'R20', 'R21', 'R22'];
  const SIZE_FACTOR = { R13: 1, R14: 1, R15: 1, R16: 1.1, R17: 1.2, R18: 1.33, R19: 1.5, R20: 1.7, R21: 1.9, R22: 2.1 };
  const KITS = ['Летний', 'Зимний', 'Всесезонный'];
  const PAY_METHODS = ['Карта', 'СБП', 'Наличные'];
  const EXTRAS = [
    { id: 'balance', name: 'Балансировка', note: 'по цене услуги' },
    { id: 'wash', name: 'Мойка колёс', price: 100 },
    { id: 'valve', name: 'Новые вентили', price: 150 },
    { id: 'seal', name: 'Герметик бортов', price: 60 },
    { id: 'bags', name: 'Пакеты для хранения', price: 50 },
  ];
  const BRANDS = ['Toyota', 'Kia', 'Hyundai', 'Volkswagen', 'Skoda', 'Lada', 'Renault', 'Nissan', 'Mazda', 'BMW', 'Mercedes-Benz', 'Audi', 'Haval', 'Chery', 'Geely', 'Exeed', 'Omoda', 'Tank', 'Mitsubishi', 'Ford', 'Lexus', 'Volvo', 'Honda', 'Subaru', 'Chevrolet', 'Changan', 'Jetour', 'Porsche'];

  const DEFAULT_SERVICES = [
    { id: 'season', name: 'Сезонная замена колёс', short: 'Замена колёс', desc: 'Перебортовка шин на дисках и установка на автомобиль', price: 1600, unit: 'set', duration: 60, icon: 'swap', anim: 'swap', runflat: true },
    { id: 'mount', name: 'Снятие и установка', short: 'Снятие и установка', desc: 'Снятие и установка колёс в сборе, без перебортовки', price: 1000, unit: 'set', duration: 40, icon: 'mount', anim: 'swap', runflat: false },
    { id: 'balance', name: 'Балансировка', short: 'Балансировка', desc: 'Компьютерная балансировка на стенде, грузики включены', price: 800, unit: 'set', duration: 30, icon: 'balance', anim: 'spin', runflat: false },
    { id: 'puncture', name: 'Ремонт прокола', short: 'Ремонт прокола', desc: 'Поиск прокола и ремонт жгутом или грибком', price: 500, unit: 'wheel', duration: 30, icon: 'puncture', anim: 'puncture', runflat: true },
    { id: 'tire', name: 'Ремонт шины', short: 'Ремонт шины', desc: 'Боковые порезы и грыжи: вулканизация, ремонтные пластыри', price: 1200, unit: 'wheel', duration: 60, icon: 'patch', anim: 'puncture', runflat: true },
    { id: 'rim', name: 'Правка диска', short: 'Правка диска', desc: 'Устранение биения и вмятин стальных и литых дисков', price: 1500, unit: 'wheel', duration: 60, icon: 'disc', anim: 'rim', runflat: false },
    { id: 'storage', name: 'Хранение шин', short: 'Хранение шин', desc: 'Сезонное хранение комплекта в чистом сухом помещении', price: 2500, unit: 'season', duration: 20, icon: 'box', anim: 'idle', runflat: false },
    { id: 'complex', name: 'Комплекс', short: 'Комплекс', desc: 'Замена колёс, балансировка, мойка колёс и проверка давления', price: 2600, unit: 'set', duration: 75, icon: 'layers', anim: 'swap', runflat: true },
  ];

  let state = null;
  const listeners = new Set();

  /* ---------- Персистентность ---------- */
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        // в демо-режиме данные пересоздаются каждый новый день, чтобы расписание оставалось актуальным
        if (s && s.version === VERSION && (s.seedDay === u.todayKey() || !s.settings.demoSim)) { state = s; return; }
      }
    } catch (e) { /* повреждённые данные — пересоздаём */ }
    state = seed();
    persist();
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* приватный режим */ }
  }
  function save() { state.rev = (state.rev || 0) + 1; persist(); emit({ external: false }); }
  function emit(info) { listeners.forEach((fn) => fn(info || {})); }
  function on(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY || !e.newValue) return;
    try { state = JSON.parse(e.newValue); emit({ external: true }); } catch (err) { /* ignore */ }
  });
  function reset() { state = seed(); save(); }

  /* ---------- Справочники ---------- */
  const S = () => state;
  const settings = () => state.settings;
  const getService = (id) => state.services.find((s) => s.id === id);
  const getClient = (id) => state.clients.find((c) => c.id === id);
  const getCar = (id) => state.cars.find((c) => c.id === id);
  const getMaster = (id) => state.masters.find((m) => m.id === id);
  const getBooking = (id) => state.bookings.find((b) => String(b.id) === String(id));
  const me = () => getClient(state.currentClientId);
  const carsOf = (cid) => state.cars.filter((c) => c.clientId === cid);
  const carName = (car) => (car ? `${car.brand} ${car.model}` : '—');
  const firstName = (name) => String(name || '').split(' ')[0];
  const cmpBooking = (a, b) => (a.date + a.time).localeCompare(b.date + b.time);

  /* ---------- Расчёт стоимости ---------- */
  const round50 = (n) => Math.round(n / 50) * 50;
  function estimate({ serviceId, size = 'R16', wheels = 4, runflat = false, extras = [] }) {
    const s = getService(serviceId);
    if (!s) return { total: 0, lines: [], duration: 30 };
    const f = SIZE_FACTOR[size] || 1;
    const lines = [];
    let base;
    if (s.unit === 'wheel') base = s.price * wheels * f;
    else if (s.unit === 'season') base = s.price * f * (wheels / 4);
    else base = (s.price / 4) * wheels * f;
    const wl = `${wheels} ${u.plural(wheels, ['колесо', 'колеса', 'колёс'])}`;
    lines.push({ name: `${s.short} · ${wl} ${size}`, amount: round50(base) });
    if (runflat && s.runflat) lines.push({ name: 'Run-flat шины', amount: round50(base * 0.3) });
    let duration = s.unit === 'wheel' ? s.duration + (wheels - 1) * 15 : s.unit === 'season' ? s.duration : s.duration * Math.max(0.5, wheels / 4);
    extras.forEach((id) => {
      const ex = EXTRAS.find((e) => e.id === id);
      if (!ex) return;
      if (id === 'balance') {
        if (s.id === 'balance' || s.id === 'complex') return;
        const bal = getService('balance');
        lines.push({ name: 'Балансировка', amount: round50((bal.price / 4) * wheels * f) });
        duration += 5 * wheels;
      } else {
        lines.push({ name: ex.name, amount: round50(ex.price * wheels) });
      }
    });
    const total = lines.reduce((a, l) => a + l.amount, 0);
    const step = state.settings.step;
    return { total, lines, duration: Math.max(step, Math.ceil(duration / step) * step), rawDuration: Math.round(duration) };
  }
  const priceFrom = (s) => (s.unit === 'wheel' ? `от ${u.money(s.price)} / колесо` : s.unit === 'season' ? `от ${u.money(s.price)} / сезон` : `от ${u.money(s.price)}`);

  /* ---------- Посты и свободное время ---------- */
  const postNumbers = () => Array.from({ length: state.settings.posts }, (_, i) => i + 1);
  const masterForPost = (p) => state.masters.find((m) => m.onShift && m.post === p);
  const workingPosts = () => { const p = postNumbers().filter((n) => masterForPost(n)); return p.length ? p : postNumbers(); };
  const dayBookings = (date) => state.bookings.filter((b) => b.date === date && b.status !== 'cancelled');
  function postFree(date, post, start, dur, excludeId) {
    return !state.bookings.some((b) => b.date === date && b.status !== 'cancelled' && b.post === post && String(b.id) !== String(excludeId) &&
      start < u.toMin(b.time) + b.duration && u.toMin(b.time) < start + dur);
  }
  function findPost(date, start, dur, excludeId, prefer) {
    const posts = workingPosts();
    if (prefer && posts.includes(prefer) && postFree(date, prefer, start, dur, excludeId)) return prefer;
    // наименее загруженный свободный пост
    const free = posts.filter((p) => postFree(date, p, start, dur, excludeId));
    if (!free.length) return null;
    const load = (p) => dayBookings(date).filter((b) => b.post === p).reduce((a, b) => a + b.duration, 0);
    return free.sort((a, b) => load(a) - load(b))[0];
  }
  /** Автомобиль уже записан на пересекающееся время */
  function carBusy(carId, date, start, dur, excludeId) {
    return state.bookings.some((b) => b.carId === carId && b.date === date && isActive(b) && String(b.id) !== String(excludeId) &&
      start < u.toMin(b.time) + b.duration && u.toMin(b.time) < start + dur);
  }
  function freeSlots(date, dur, excludeId, carId) {
    const st = state.settings;
    const open = u.toMin(st.open), close = u.toMin(st.close);
    const isToday = date === u.todayKey();
    const nm = u.nowMin();
    if (u.diffDays(date, u.todayKey()) < 0) return [];
    const out = [];
    for (let t = open; t + dur <= close; t += st.step) {
      if (isToday && t < nm + 15) continue;
      if (carId && carBusy(carId, date, t, dur, excludeId)) continue;
      if (findPost(date, t, dur, excludeId)) out.push(u.fromMin(t));
    }
    return out;
  }
  function nearestFree(dur, days = 21) {
    const t = u.todayKey();
    for (let i = 0; i < days; i++) {
      const d = u.addDays(t, i);
      const sl = freeSlots(d, dur);
      if (sl.length) return { date: d, slots: sl };
    }
    return null;
  }
  function dayLoad(date) {
    const st = state.settings;
    const cap = (u.toMin(st.close) - u.toMin(st.open)) * workingPosts().length;
    const used = dayBookings(date).reduce((a, b) => a + b.duration, 0);
    return Math.min(1, used / cap);
  }
  /** Свободные 30-минутные окна на постах до конца дня */
  function freePostSlotsLeft(date) {
    const st = state.settings;
    const open = u.toMin(st.open), close = u.toMin(st.close);
    const nm = date === u.todayKey() ? u.nowMin() : 0;
    let n = 0;
    workingPosts().forEach((p) => {
      for (let t = open; t + st.step <= close; t += st.step) {
        if (t + st.step <= nm) continue;
        if (postFree(date, p, t, st.step)) n++;
      }
    });
    return n;
  }

  /* ---------- Уведомления ---------- */
  function notify(aud, text, extra = {}) {
    state.notifications.unshift({ id: u.uid('n'), aud, text, at: Date.now(), read: false, ...extra });
    if (state.notifications.length > 120) state.notifications.length = 120;
  }
  const notificationsFor = (aud) => state.notifications.filter((n) => n.aud === aud && (aud !== 'client' || n.clientId === state.currentClientId));
  function markRead(aud) {
    let ch = false;
    notificationsFor(aud).forEach((n) => { if (!n.read) { n.read = true; ch = true; } });
    if (ch) save();
  }

  /* ---------- Записи ---------- */
  function bookingTitle(b) { return `${carName(getCar(b.carId))} · ${getService(b.serviceId).short}`; }

  function createBooking(d) {
    const car = getCar(d.carId);
    const est = estimate({ serviceId: d.serviceId, size: car.size, wheels: d.wheels || 4, runflat: car.runflat, extras: d.extras || [] });
    const start = u.toMin(d.time);
    const post = d.post && postFree(d.date, d.post, start, est.duration) ? d.post : findPost(d.date, start, est.duration, null, d.post);
    if (!post) throw new Error('Это время уже занято. Выберите другое.');
    const master = masterForPost(post);
    const b = {
      id: state.seq++, clientId: d.clientId, carId: d.carId, serviceId: d.serviceId,
      date: d.date, time: d.time, duration: est.duration, post, masterId: master ? master.id : null,
      status: 'created', price: est.total, wheels: d.wheels || 4, extras: d.extras || [],
      paid: false, payMethod: null, createdAt: Date.now(), log: [{ s: 'created', at: Date.now() }], source: d.source || 'client',
    };
    state.bookings.push(b);
    const cl = getClient(d.clientId);
    notify('admin', `${carName(car)} · ${getService(d.serviceId).short}, ${u.fmtDay(d.date)} в ${d.time}, пост ${post}. Клиент: ${firstName(cl.name)}`, { title: `Новая запись №${b.id}`, bookingId: b.id, kind: 'new' });
    if (d.source === 'admin') notify('client', `${bookingTitle(b)} — ${u.fmtDay(d.date)} в ${d.time}`, { title: `Вы записаны, №${b.id}`, clientId: d.clientId, bookingId: b.id, kind: 'created' });
    save();
    return b;
  }

  function updateBooking(id, patch, opts = {}) {
    const b = getBooking(id);
    if (!b) return null;
    const before = { date: b.date, time: b.time, post: b.post };
    const next = Object.assign({}, b, patch);
    const car = getCar(next.carId);
    const est = estimate({ serviceId: next.serviceId, size: car.size, wheels: next.wheels || 4, runflat: car.runflat, extras: next.extras || [] });
    const start = u.toMin(next.time);
    let post = next.post;
    if (!postFree(next.date, post, start, est.duration, b.id)) {
      if (opts.strictPost) throw new Error(`Пост ${post} занят в это время`);
      post = findPost(next.date, start, est.duration, b.id);
    }
    if (!post) throw new Error('Это время уже занято. Выберите другое.');
    if (post !== b.post && !patch.masterId) { const m = masterForPost(post); next.masterId = m ? m.id : next.masterId; }
    if (!opts.keepPrice) next.price = est.total;
    Object.assign(b, next, { post, duration: est.duration });
    if (before.date !== b.date || before.time !== b.time) {
      notify('admin', `${bookingTitle(b)}: ${u.fmtDay(before.date)} ${before.time} → ${u.fmtDay(b.date)} ${b.time}`, { title: `Запись №${b.id} перенесена`, bookingId: b.id, kind: 'moved' });
      notify('admin', `${u.fmtDay(before.date)} в ${before.time}, пост ${before.post}`, { title: 'Освободилось время', kind: 'free' });
      if (opts.by === 'admin') notify('client', `Новое время: ${u.fmtDay(b.date)} в ${b.time}`, { title: `Запись №${b.id} перенесена`, clientId: b.clientId, bookingId: b.id, kind: 'moved' });
    }
    save();
    return b;
  }

  function setStatus(id, status) {
    const b = getBooking(id);
    if (!b || b.status === status) return;
    b.status = status;
    b.log = (b.log || []).filter((l) => ST_IDX[l.s] < ST_IDX[status]);
    b.log.push({ s: status, at: Date.now() });
    if (status === 'done') b.doneAt = Date.now();
    if (state.settings.notifyClient && CLIENT_MSG[status]) {
      const [title, text] = CLIENT_MSG[status];
      notify('client', `${bookingTitle(b)} · ${text}`, { title, clientId: b.clientId, bookingId: b.id, kind: 'status' });
      if (status === 'done') notify('client', `Можно забирать: ${carName(getCar(b.carId))}. К оплате ${u.money(b.price)}`, { title: 'Автомобиль готов', clientId: b.clientId, bookingId: b.id, kind: 'ready' });
    }
    save();
  }
  const nextStatus = (b) => (STATUSES[ST_IDX[b.status] + 1] || {}).key;

  function cancelBooking(id, by = 'client') {
    const b = getBooking(id);
    if (!b || b.status === 'cancelled') return;
    b.status = 'cancelled';
    b.cancelledBy = by;
    b.cancelledAt = Date.now();
    const cl = getClient(b.clientId);
    if (by === 'client') notify('admin', `${firstName(cl.name)}: ${bookingTitle(b)}, ${u.fmtDay(b.date)} в ${b.time}`, { title: `Клиент отменил запись №${b.id}`, bookingId: b.id, kind: 'cancel' });
    else notify('client', `${bookingTitle(b)}, ${u.fmtDay(b.date)} в ${b.time}`, { title: `Запись №${b.id} отменена`, clientId: b.clientId, bookingId: b.id, kind: 'cancel' });
    notify('admin', `${u.fmtDay(b.date)} в ${b.time}, пост ${b.post}`, { title: 'Освободилось время', kind: 'free' });
    save();
  }

  function markPaid(id, method) {
    const b = getBooking(id);
    if (!b) return;
    b.paid = true; b.payMethod = method; b.paidAt = Date.now();
    notify('client', `${bookingTitle(b)} · ${u.money(b.price)}, ${method.toLowerCase()}`, { title: 'Оплата получена', clientId: b.clientId, bookingId: b.id, kind: 'paid' });
    save();
  }

  /* ---------- Клиенты и авто ---------- */
  function addCar(c) {
    const car = { id: u.uid('car'), clientId: c.clientId || state.currentClientId, brand: c.brand.trim(), model: c.model.trim(), size: c.size || 'R16', kit: c.kit || 'Летний', mileage: Number(c.mileage) || 0, runflat: !!c.runflat, plate: (c.plate || '').toUpperCase() };
    state.cars.push(car);
    save();
    return car;
  }
  function updateCar(id, patch) { const c = getCar(id); if (c) { Object.assign(c, patch); save(); } return c; }
  function deleteCar(id) {
    state.cars = state.cars.filter((c) => c.id !== id);
    save();
  }
  function addClient(name, phone) {
    const ex = state.clients.find((c) => u.digits(c.phone) === u.digits(phone));
    if (ex) return ex;
    const c = { id: u.uid('c'), name: name.trim(), phone: u.formatPhone(phone), createdAt: Date.now(), reminders: [], prefs: { status: true, season: true } };
    state.clients.push(c);
    save();
    return c;
  }
  function updateClient(id, patch) { const c = getClient(id); if (c) { Object.assign(c, patch); save(); } return c; }
  function clientStats(cid) {
    const done = state.bookings.filter((b) => b.clientId === cid && b.status === 'done');
    const total = done.reduce((a, b) => a + b.price, 0);
    const last = done.slice().sort(cmpBooking).pop();
    return { orders: done.length, total, avg: done.length ? total / done.length : 0, last: last ? last.date : null };
  }

  /* ---------- Сезонные напоминания ---------- */
  function nextSeasonDate(fromKey) {
    const d = u.parseKey(fromKey || u.todayKey());
    const m = d.getMonth(), y = d.getFullYear();
    if (m >= 8) return `${y + 1}-03-25`;
    if (m <= 1) return `${y}-03-25`;
    return `${y}-10-10`;
  }
  function setReminder(bookingId) {
    const b = getBooking(bookingId);
    const cl = getClient(b.clientId);
    cl.reminders = cl.reminders || [];
    if (cl.reminders.some((r) => String(r.bookingId) === String(bookingId))) return;
    const date = nextSeasonDate(u.todayKey());
    cl.reminders.push({ id: u.uid('r'), bookingId: b.id, carId: b.carId, serviceId: ['season', 'complex', 'mount', 'storage'].includes(b.serviceId) ? b.serviceId : 'season', date, fired: false });
    save();
    return date;
  }
  function removeReminder(rid) { const cl = me(); cl.reminders = (cl.reminders || []).filter((r) => r.id !== rid); save(); }

  /** Автоматические напоминания: «Ваша запись завтра», сезонные напоминания */
  function runAutomations() {
    const t = u.todayKey(), tm = u.addDays(t, 1);
    let ch = false;
    state.bookings.forEach((b) => {
      if (b.status === 'created' && b.date === tm && !b.remTomorrow) {
        b.remTomorrow = true; ch = true;
        notify('client', `${bookingTitle(b)} · ${state.settings.address}`, { title: `Ваша запись завтра в ${b.time}`, clientId: b.clientId, bookingId: b.id, kind: 'remind' });
      }
    });
    state.clients.forEach((c) => (c.reminders || []).forEach((r) => {
      if (!r.fired && r.date <= t) {
        r.fired = true; ch = true;
        notify('client', `Пора готовиться к смене сезона — запишитесь заранее, пока есть свободное время.`, { title: 'Скоро сезон замены шин', clientId: c.id, kind: 'season' });
      }
    }));
    if (ch) save();
  }

  /** Демо-режим: активная запись текущего клиента сама проходит этапы, чтобы был виден живой статус */
  function simulateTick() {
    if (!state.settings.demoSim) return;
    if (Date.now() - (state.simAt || 0) < 14000) return;
    const b = state.bookings.filter((x) => x.clientId === state.currentClientId && isInWork(x)).sort(cmpBooking)[0];
    if (!b) return;
    state.simAt = Date.now();
    setStatus(b.id, nextStatus(b));
  }

  /* ---------- Склад ---------- */
  function adjustStock(id, delta) {
    const it = state.stock.find((s) => s.id === id);
    if (!it) return;
    it.qty = Math.max(0, Math.round((it.qty + delta) * 10) / 10);
    save();
  }

  /* ---------- Начальные данные ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seed() {
    const rnd = mulberry32(20261001);
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
    const T = u.todayKey();
    const NOW = Date.now();
    const nm = u.nowMin();

    state = {
      version: VERSION, seq: 1, simAt: 0, currentClientId: 'c1', rev: 0, seedDay: T,
      settings: {
        name: 'ПитЛайн', address: 'ул. Автозаводская, 14, стр. 2', city: 'Москва', phone: '+7 (495) 120-45-67',
        open: '09:00', close: '21:00', step: 30, posts: 4, notifyClient: true, remindSeason: true, demoSim: true,
      },
      services: JSON.parse(JSON.stringify(DEFAULT_SERVICES)),
      masters: [
        { id: 'm1', name: 'Сергей Ковалёв', phone: '+7 (916) 201-11-01', post: 1, onShift: true, since: 2019 },
        { id: 'm2', name: 'Иван Петров', phone: '+7 (916) 201-11-02', post: 2, onShift: true, since: 2017 },
        { id: 'm3', name: 'Дмитрий Орлов', phone: '+7 (916) 201-11-03', post: 3, onShift: true, since: 2021 },
        { id: 'm4', name: 'Артём Белов', phone: '+7 (916) 201-11-04', post: 4, onShift: true, since: 2022 },
        { id: 'm5', name: 'Михаил Зуев', phone: '+7 (916) 201-11-05', post: null, onShift: false, since: 2020 },
      ],
      clients: [], cars: [], bookings: [], notifications: [],
      stock: [
        { id: 's1', name: 'Грузики клеевые 5 г', qty: 1840, unit: 'шт', min: 500, step: 100 },
        { id: 's2', name: 'Грузики набивные', qty: 620, unit: 'шт', min: 300, step: 50 },
        { id: 's3', name: 'Жгуты ремонтные', qty: 34, unit: 'шт', min: 40, step: 10 },
        { id: 's4', name: 'Грибки ремонтные', qty: 18, unit: 'шт', min: 20, step: 10 },
        { id: 's5', name: 'Пластыри для боковых порезов', qty: 26, unit: 'шт', min: 15, step: 5 },
        { id: 's6', name: 'Вентили TR414', qty: 140, unit: 'шт', min: 80, step: 20 },
        { id: 's7', name: 'Герметик бортов', qty: 3.5, unit: 'л', min: 2, step: 1 },
        { id: 's8', name: 'Монтажная паста', qty: 4, unit: 'кг', min: 3, step: 1 },
        { id: 's9', name: 'Пакеты для шин', qty: 260, unit: 'шт', min: 100, step: 50 },
      ],
      storage: { cap: 60, used: 38 },
    };

    const CL = [
      ['c1', 'Алексей Смирнов', '+7 (912) 345-67-89', [['Toyota', 'Camry', 'R18', 'Летний', 64200, false, 'А 123 ВС 777'], ['Hyundai', 'Tucson', 'R17', 'Зимний', 38900, false, 'М 456 ОР 750']]],
      ['c2', 'Мария Иванова', '+7 (903) 112-34-56', [['Kia', 'Rio', 'R15', 'Летний', 51300, false, 'Е 781 КХ 799']]],
      ['c3', 'Олег Кузнецов', '+7 (916) 228-71-09', [['BMW', 'X5', 'R20', 'Летний', 87400, true, 'О 017 ОМ 197']]],
      ['c4', 'Наталья Соколова', '+7 (925) 640-18-22', [['Volkswagen', 'Polo', 'R15', 'Всесезонный', 72000, false, 'Т 312 УК 777']]],
      ['c5', 'Павел Морозов', '+7 (985) 301-44-90', [['Skoda', 'Octavia', 'R16', 'Летний', 95800, false, 'Н 905 АМ 750'], ['Lada', 'Largus', 'R15', 'Зимний', 143000, false, 'Р 228 СН 190']]],
      ['c6', 'Екатерина Волкова', '+7 (977) 515-02-63', [['Mazda', 'CX-5', 'R19', 'Летний', 41200, false, 'В 640 ЕТ 799']]],
      ['c7', 'Андрей Лебедев', '+7 (926) 770-35-14', [['Haval', 'Jolion', 'R18', 'Летний', 23500, false, 'К 117 МР 777']]],
      ['c8', 'Ирина Новикова', '+7 (915) 402-87-31', [['Renault', 'Duster', 'R16', 'Всесезонный', 118300, false, 'У 530 ХВ 750']]],
      ['c9', 'Денис Фёдоров', '+7 (999) 812-60-05', [['Mercedes-Benz', 'E-Class', 'R18', 'Летний', 66700, true, 'С 774 АС 977']]],
      ['c10', 'Юлия Павлова', '+7 (968) 233-91-48', [['Nissan', 'Qashqai', 'R17', 'Летний', 58900, false, 'А 902 НЕ 799']]],
      ['c11', 'Роман Семёнов', '+7 (903) 677-25-80', [['Kia', 'Sportage', 'R17', 'Летний', 34100, false, 'Х 404 ТТ 750']]],
      ['c12', 'Виктор Голубев', '+7 (916) 950-13-37', [['Toyota', 'RAV4', 'R18', 'Летний', 77600, false, 'М 818 КМ 777']]],
      ['c13', 'Ольга Виноградова', '+7 (929) 148-06-72', [['Geely', 'Coolray', 'R18', 'Летний', 19800, false, 'Е 245 РА 790']]],
      ['c14', 'Максим Богданов', '+7 (910) 384-57-19', [['Lada', 'Vesta', 'R15', 'Летний', 88200, false, 'О 563 ВУ 750']]],
    ];
    CL.forEach(([id, name, phone, cars]) => {
      state.clients.push({ id, name, phone, createdAt: NOW - 400 * 864e5, reminders: [], prefs: { status: true, season: true } });
      cars.forEach(([brand, model, size, kit, mileage, runflat, plate], i) => state.cars.push({ id: `car_${id}_${i}`, clientId: id, brand, model, size, kit, mileage, runflat, plate }));
    });

    const ts = (date, time) => u.parseKey(date).getTime() + u.toMin(time) * 60000;
    const SVC_W = ['season', 'season', 'season', 'season', 'balance', 'balance', 'puncture', 'puncture', 'complex', 'complex', 'mount', 'mount', 'tire', 'rim', 'storage'];

    function mk({ clientId, carIdx = 0, serviceId, date, time, status = 'done', post, createdAt, extras = [], wheels, anyPost = false }) {
      const car = state.cars.filter((c) => c.clientId === clientId)[carIdx] || state.cars.find((c) => c.clientId === clientId);
      const w = wheels || (['puncture', 'tire', 'rim'].includes(serviceId) ? 1 + Math.floor(rnd() * 1.4) : 4);
      const est = estimate({ serviceId, size: car.size, wheels: w, runflat: car.runflat, extras });
      const start = u.toMin(time);
      if (start + est.duration > u.toMin(state.settings.close)) return null;
      const posts = anyPost ? [1, 2, 3, 4] : workingPosts();
      let p = post && postFree(date, post, start, est.duration) ? post : null;
      if (!p) p = posts.find((x) => postFree(date, x, start, est.duration));
      if (!p) return null;
      const master = state.masters.find((m) => m.post === p);
      const startTs = ts(date, time);
      const b = {
        id: 0, clientId, carId: car.id, serviceId, date, time, duration: est.duration, post: p, masterId: master ? master.id : 'm5',
        status, price: est.total, wheels: w, extras, paid: false, payMethod: null,
        createdAt: createdAt || Math.min(NOW - 3600e3, startTs - (1 + rnd() * 5) * 864e5), log: [], source: rnd() < 0.8 ? 'client' : 'admin',
      };
      b.log.push({ s: 'created', at: b.createdAt });
      if (status !== 'cancelled') {
        const idx = ST_IDX[status];
        for (let i = 1; i <= idx; i++) b.log.push({ s: STATUSES[i].key, at: Math.min(NOW, startTs + ((i - 1) / 4) * est.duration * 60000) });
      }
      if (status === 'done') { b.doneAt = startTs + est.duration * 60000; b.paid = true; b.payMethod = pick(PAY_METHODS); b.paidAt = b.doneAt; }
      state.bookings.push(b);
      return b;
    }

    // История текущего клиента
    mk({ clientId: 'c1', carIdx: 0, serviceId: 'complex', date: u.addDays(T, -353), time: '12:00', anyPost: true });
    mk({ clientId: 'c1', carIdx: 0, serviceId: 'season', extras: ['balance'], date: u.addDays(T, -171), time: '10:30', anyPost: true });
    mk({ clientId: 'c1', carIdx: 1, serviceId: 'puncture', wheels: 1, date: u.addDays(T, -107), time: '18:00', anyPost: true });

    // Прошлые визиты остальных клиентов
    const others = CL.slice(1).map((c) => c[0]);
    others.forEach((cid) => {
      const n = 1 + Math.floor(rnd() * 4);
      for (let i = 0; i < n; i++) {
        const date = u.addDays(T, -2 - Math.floor(rnd() * 330));
        const time = u.fromMin(540 + Math.floor(rnd() * 20) * 30);
        const nCars = state.cars.filter((c) => c.clientId === cid).length;
        mk({ clientId: cid, carIdx: Math.floor(rnd() * nCars), serviceId: pick(SVC_W), date, time, anyPost: true, extras: rnd() < 0.3 ? ['balance'] : [] });
      }
    });
    // Насыщенная последняя неделя (для графиков и оплат)
    for (let d = -6; d <= -1; d++) {
      const date = u.addDays(T, d);
      for (let k = 0; k < 9; k++) {
        const cid = pick(others);
        mk({ clientId: cid, serviceId: pick(SVC_W), date, time: u.fromMin(540 + Math.floor(rnd() * 22) * 30), anyPost: true });
      }
    }

    // Текущая работа клиента — для живого статуса
    const open = u.toMin(state.settings.open), close = u.toMin(state.settings.close);
    let liveStart = Math.floor(nm / 30) * 30;
    liveStart = Math.max(open, Math.min(close - 60, liveStart));
    const live = mk({ clientId: 'c1', carIdx: 1, serviceId: 'puncture', wheels: 1, extras: ['balance'], date: T, time: u.fromMin(liveStart), status: 'lift', post: 2, createdAt: NOW - 3 * 3600e3 });
    if (live) { live.log = [{ s: 'created', at: NOW - 3 * 3600e3 }, { s: 'accepted', at: NOW - 9 * 60000 }, { s: 'lift', at: NOW - 4 * 60000 }]; }
    // Запись клиента на завтра
    const tomorrow = mk({ clientId: 'c1', carIdx: 0, serviceId: 'season', extras: ['balance'], date: u.addDays(T, 1), time: '12:00', status: 'created', post: 2, createdAt: NOW - 26 * 3600e3 });

    // В рабочее время на остальных постах тоже идёт работа — для наглядной загрузки
    if (nm > open + 30 && nm < close - 30) {
      [[1, 'season', 'work', 0], [3, 'complex', 'balance', 30], [4, 'balance', 'accepted', 0]].forEach(([p, sid, status, back]) => {
        const busyNow = state.bookings.some((b) => b.date === T && b.post === p && b.status !== 'cancelled' && u.toMin(b.time) <= nm && u.toMin(b.time) + b.duration > nm);
        if (busyNow) return;
        const st0 = Math.max(open, Math.floor(nm / 30) * 30 - back);
        const est = estimate({ serviceId: sid, size: 'R17', wheels: 4 });
        if (!postFree(T, p, st0, est.duration + 30)) return;
        mk({ clientId: pick(others), serviceId: sid, date: T, time: u.fromMin(st0), status, post: p, createdAt: NOW - 2 * 864e5 });
      });
    }

    // Сегодня и ближайшие дни
    const loads = [0.62, 0.5, 0.42, 0.35, 0.3, 0.38, 0.25, 0.22, 0.2, 0.18, 0.15];
    loads.forEach((L, di) => {
      const date = u.addDays(T, di);
      [1, 2, 3, 4].forEach((p) => {
        let t = open + (rnd() < 0.35 ? 30 : 0);
        while (t < close - 30) {
          if (rnd() < L) {
            const cid = pick(others);
            const sid = pick(SVC_W);
            let status = 'created';
            const b0 = mk({ clientId: cid, carIdx: Math.floor(rnd() * 2) % state.cars.filter((c) => c.clientId === cid).length, serviceId: sid, date, time: u.fromMin(t), status, post: p, extras: rnd() < 0.25 ? ['balance'] : [], createdAt: NOW - (rnd() * 6 + 0.1) * 864e5 });
            if (b0) {
              if (b0.post !== p) { /* занято — сдвигаемся */ }
              if (di === 0) {
                const s0 = u.toMin(b0.time), e0 = s0 + b0.duration;
                if (e0 <= nm) status = 'done';
                else if (s0 <= nm) { const fr = (nm - s0) / b0.duration; status = fr < 0.2 ? 'accepted' : fr < 0.4 ? 'lift' : fr < 0.75 ? 'work' : 'balance'; }
                if (status !== 'created') {
                  b0.status = status;
                  const st0 = ts(date, b0.time);
                  b0.log = [{ s: 'created', at: b0.createdAt }];
                  for (let i = 1; i <= ST_IDX[status]; i++) b0.log.push({ s: STATUSES[i].key, at: Math.min(NOW, st0 + ((i - 1) / 4) * b0.duration * 60000) });
                  if (status === 'done') { b0.doneAt = st0 + b0.duration * 60000; b0.paid = rnd() < 0.85; if (b0.paid) { b0.payMethod = pick(PAY_METHODS); b0.paidAt = b0.doneAt; } }
                }
              }
              t = u.toMin(b0.time) + b0.duration + (rnd() < 0.5 ? 0 : 30);
            } else t += 30;
          } else t += 30 * (1 + Math.floor(rnd() * 2));
        }
      });
    });

    // Несколько отмен
    const fut = state.bookings.filter((b) => b.date > u.addDays(T, 1) && b.clientId !== 'c1' && b.status === 'created');
    const c1 = fut[3], c2 = fut[11];
    if (c1) { c1.status = 'cancelled'; c1.cancelledBy = 'client'; c1.cancelledAt = NOW - 5 * 3600e3; }
    if (c2) { c2.status = 'cancelled'; c2.cancelledBy = 'admin'; c2.cancelledAt = NOW - 30 * 3600e3; }

    // Номера заказов по времени создания: последний — 2480
    const sorted = state.bookings.slice().sort((a, b) => a.createdAt - b.createdAt);
    const startNo = 2481 - sorted.length;
    sorted.forEach((b, i) => { b.id = startNo + i; });
    state.seq = 2481;

    // Уведомления
    const recent = state.bookings.filter((b) => b.status === 'created' && b.clientId !== 'c1').sort((a, b) => b.createdAt - a.createdAt).slice(0, 4);
    recent.reverse().forEach((b) => {
      const car = getCar(b.carId);
      state.notifications.unshift({ id: u.uid('n'), aud: 'admin', title: `Новая запись №${b.id}`, text: `${carName(car)} · ${getService(b.serviceId).short}, ${u.fmtDay(b.date)} в ${b.time}, пост ${b.post}`, at: b.createdAt, read: true, bookingId: b.id, kind: 'new' });
    });
    if (c1) {
      state.notifications.unshift({ id: u.uid('n'), aud: 'admin', title: `Клиент отменил запись №${c1.id}`, text: `${firstName(getClient(c1.clientId).name)}: ${carName(getCar(c1.carId))}, ${u.fmtDay(c1.date)} в ${c1.time}`, at: c1.cancelledAt, read: false, bookingId: c1.id, kind: 'cancel' });
      state.notifications.unshift({ id: u.uid('n'), aud: 'admin', title: 'Освободилось время', text: `${u.fmtDay(c1.date)} в ${c1.time}, пост ${c1.post}`, at: c1.cancelledAt + 1000, read: false, kind: 'free' });
    }
    if (tomorrow) state.notifications.unshift({ id: u.uid('n'), aud: 'client', clientId: 'c1', title: `Запись подтверждена, №${tomorrow.id}`, text: `${bookingTitle(tomorrow)} — ${u.fmtDate(tomorrow.date)} в ${tomorrow.time}`, at: tomorrow.createdAt, read: true, bookingId: tomorrow.id, kind: 'created' });
    if (live) {
      state.notifications.unshift({ id: u.uid('n'), aud: 'client', clientId: 'c1', title: 'Ваш автомобиль принят', text: `${bookingTitle(live)} · Мастер принял автомобиль на посту`, at: NOW - 9 * 60000, read: true, bookingId: live.id, kind: 'status' });
      state.notifications.unshift({ id: u.uid('n'), aud: 'client', clientId: 'c1', title: 'Автомобиль на подъёмнике', text: `${bookingTitle(live)} · Начинаем снимать колёса`, at: NOW - 4 * 60000, read: false, bookingId: live.id, kind: 'status' });
    }
    state.notifications.sort((a, b) => b.at - a.at);
    return state;
  }

  A.store = {
    load, save, on, reset, S, settings, me,
    STATUSES, ST_IDX, IN_WORK, SIZES, SIZE_FACTOR, KITS, EXTRAS, BRANDS, PAY_METHODS,
    statusLabel, statusShort, isInWork, isActive, nextStatus,
    getService, getClient, getCar, getMaster, getBooking, carsOf, carName, firstName, cmpBooking, bookingTitle,
    estimate, priceFrom, postNumbers, masterForPost, workingPosts, dayBookings, postFree, findPost, freeSlots, carBusy, nearestFree, dayLoad, freePostSlotsLeft,
    notify, notificationsFor, markRead,
    createBooking, updateBooking, setStatus, cancelBooking, markPaid,
    addCar, updateCar, deleteCar, addClient, updateClient, clientStats,
    nextSeasonDate, setReminder, removeReminder, runAutomations, simulateTick, adjustStock,
  };
})(window.App);
