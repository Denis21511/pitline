/* ПитЛайн — кабинет сервиса: обзор, записи, клиенты, автомобили, мастера, услуги, склад, календарь, оплаты, настройки */
(function (A) {
  'use strict';
  const u = A.u, s = A.store, ui = A.ui;
  const { esc, icon, money } = u;
  const act = A.act, V = A.views;

  const NAV = [
    ['overview', 'Обзор', 'grid', '#/admin'],
    ['bookings', 'Записи', 'list', '#/admin/bookings'],
    ['clients', 'Клиенты', 'users', '#/admin/clients'],
    ['cars', 'Автомобили', 'car', '#/admin/cars'],
    ['masters', 'Мастера', 'worker', '#/admin/masters'],
    ['services', 'Услуги', 'tag', '#/admin/services'],
    ['stock', 'Склад', 'box', '#/admin/stock'],
    ['calendar', 'Календарь', 'calendar', '#/admin/calendar'],
    ['payments', 'Оплаты', 'card', '#/admin/payments'],
    ['settings', 'Настройки', 'sliders', '#/admin/settings'],
  ];

  const unreadAdmin = () => s.notificationsFor('admin').filter((n) => !n.read).length;
  const clientOf = (b) => s.getClient(b.clientId) || { name: '—', phone: '' };

  function shell(key, title, content, opts = {}) {
    const st = s.settings();
    const T = u.todayKey();
    const todayCnt = s.dayBookings(T).length;
    const unread = unreadAdmin();
    const lowStock = s.S().stock.filter((x) => x.qty < x.min).length;
    return `<div class="a-shell" id="a-shell">
      <aside class="a-side">
        <div class="a-brand"><a href="#/admin">${u.logo()}</a><span class="a-brand-sub">Кабинет сервиса</span></div>
        <nav class="a-nav">${NAV.map(([k, l, ic, href]) => `<a href="${href}" class="${key === k ? 'on' : ''}">${icon(ic)}<span>${l}</span>${k === 'bookings' && todayCnt ? `<span class="cnt">${todayCnt}</span>` : ''}${k === 'stock' && lowStock ? `<span class="cnt warn">${lowStock}</span>` : ''}</a>`).join('')}</nav>
        <div class="a-side-foot">
          <a href="#/" class="a-ext">${icon('phone')}<span>Клиентское приложение</span></a>
          <a href="#/master" class="a-ext">${icon('worker')}<span>Экран мастера</span></a>
          <div class="a-user"><span class="avatar sm">АД</span><div><b>Администратор</b><span>${esc(st.address)}</span></div></div>
        </div>
      </aside>
      <div class="a-scrim" data-act="a-nav-close"></div>
      <div class="a-main">
        <header class="a-top">
          <button class="icon-btn show-lt" data-act="a-nav-open" aria-label="Меню">${icon('menu')}</button>
          <div class="grow a-top-t"><h1>${esc(title)}</h1><div class="a-top-sub">${esc(u.fmtDay(T))}, ${u.DOW[new Date().getDay()]}</div></div>
          ${opts.actions || ''}
          ${A.theme.button()}
          <button class="icon-btn" data-act="a-notifs" aria-label="Уведомления">${icon('bell')}${unread ? `<span class="dot-badge">${unread}</span>` : ''}</button>
          <button class="btn btn-primary btn-sm" data-act="a-new">${icon('plus')}<span class="hide-s">Новая запись</span></button>
        </header>
        <div class="a-content">${content}</div>
      </div>
    </div>`;
  }
  act['a-nav-open'] = () => document.getElementById('a-shell').classList.add('nav-open');
  act['a-nav-close'] = () => document.getElementById('a-shell').classList.remove('nav-open');
  act['a-notifs'] = () => {
    u.modal({
      title: 'Уведомления',
      live: true,
      body: () => {
        const list = s.notificationsFor('admin');
        if (!list.length) return ui.emptyState('bell', 'Нет уведомлений', '');
        return `<div class="nlist">${list.slice(0, 50).map((n) => `<div class="nitem ${n.read ? '' : 'unread'} ${n.bookingId ? 'click' : ''}" ${n.bookingId ? `data-act="a-open" data-id="${n.bookingId}"` : ''}>
          <span class="nitem-ic k-${n.kind || 'info'}">${icon(ui.nIcon(n.kind))}</span>
          <div><b>${esc(n.title || '')}</b><p>${esc(n.text)}</p><span class="nitem-t">${u.timeAgo(n.at)}</span></div></div>`).join('')}</div>`;
      },
      onClose: () => s.markRead('admin'),
    });
  };

  const kpi = (label, value, sub, ic, tone = '') => `<div class="kpi ${tone}"><div class="kpi-l"><span class="kpi-ic">${icon(ic)}</span>${esc(label)}</div><div class="kpi-v tnum">${value}</div><div class="kpi-s">${sub}</div></div>`;
  const nextBtn = (b, sm = true) => {
    const n = s.nextStatus(b);
    if (!n || b.status === 'cancelled') return '';
    return `<button class="btn btn-outline ${sm ? 'btn-sm' : ''}" data-act="a-next" data-id="${b.id}" title="Перевести на следующий этап">${icon('arrowR')}${esc(s.statusShort(n))}</button>`;
  };
  act['a-next'] = (el, e) => {
    e.stopPropagation();
    const b = s.getBooking(el.dataset.id);
    const n = s.nextStatus(b);
    if (!n) return;
    s.setStatus(b.id, n);
    u.toast(`№ ${b.id}: ${s.statusLabel(n)}. Клиент получил уведомление`, { icon: 'check' });
  };

  /* ================= Обзор ================= */
  function postsTimeline(date) {
    const st = s.settings();
    const open = u.toMin(st.open), close = u.toMin(st.close), span = close - open;
    const pct = (m) => ((m - open) / span) * 100;
    const nm = u.nowMin();
    const isToday = date === u.todayKey();
    const hours = [];
    for (let h = Math.ceil(open / 60); h <= Math.floor(close / 60); h++) hours.push(h);
    const rows = s.postNumbers().map((p) => {
      const m = s.masterForPost(p);
      const list = s.dayBookings(date).filter((b) => b.post === p);
      const used = list.reduce((a, b) => a + b.duration, 0);
      const load = Math.round((used / span) * 100);
      const bars = list.map((b) => {
        const cls = b.status === 'done' ? 's-done' : s.isInWork(b) ? 's-live' : 's-created';
        const car = s.getCar(b.carId);
        const tip = `${b.time}–${u.fromMin(u.toMin(b.time) + b.duration)} · ${s.carName(car)} ${car.size} · ${s.getService(b.serviceId).short} · ${s.firstName(clientOf(b).name)} · ${s.statusLabel(b.status)}`;
        return `<button class="tl-bar ${cls}" style="left:${pct(u.toMin(b.time))}%;width:${(b.duration / span) * 100}%" data-act="a-open" data-id="${b.id}" data-tip="${esc(tip)}" aria-label="${esc(tip)}"><span>${esc(car.model)}</span></button>`;
      }).join('');
      return `<div class="tl-row">
        <div class="tl-label"><b>Пост ${p}</b><span>${m ? esc(s.firstName(m.name)) : 'нет мастера'}</span></div>
        <div class="tl-track">${hours.map((h) => `<i class="tl-grid" style="left:${pct(h * 60)}%"></i>`).join('')}${bars}${isToday && nm > open && nm < close ? `<i class="tl-now" style="left:${pct(nm)}%"></i>` : ''}</div>
        <div class="tl-load tnum"><b>${load}%</b><span>загрузка</span></div>
      </div>`;
    }).join('');
    return `<div class="tl">
      <div class="tl-row tl-scale-row"><div></div><div class="tl-scale">${hours.map((h) => `<span style="left:${pct(h * 60)}%">${u.pad(h)}</span>`).join('')}</div><div></div></div>
      ${rows}
      <div class="legend"><span><i class="lg-sw s-created"></i>Запланировано</span><span><i class="lg-sw s-live"></i>В работе</span><span><i class="lg-sw s-done"></i>Готово</span><span><i class="lg-sw s-free"></i>Свободно</span>${isToday ? '<span><i class="lg-sw s-now"></i>Сейчас</span>' : ''}</div>
    </div>`;
  }

  function weekChart() {
    const T = u.todayKey();
    const days = Array.from({ length: 7 }, (_, i) => u.addDays(T, i));
    return `<div class="wk">${days.map((d) => {
      const l = Math.round(s.dayLoad(d) * 100);
      const n = s.dayBookings(d).length;
      const dt = u.parseKey(d);
      return `<div class="wk-col" data-tip="${esc(u.fmtDay(d))}: ${n} ${u.plural(n, ['запись', 'записи', 'записей'])}, загрузка ${l}%">
        <div class="wk-bar-wrap"><div class="wk-bar" style="height:${Math.max(3, l)}%"></div></div>
        <div class="wk-v tnum">${l}%</div>
        <div class="wk-d ${d === T ? 'today' : ''}">${u.DOW_SHORT[dt.getDay()]} ${dt.getDate()}</div>
      </div>`;
    }).join('')}</div>`;
  }

  V.adminOverview = {
    shell: 'admin',
    render() {
      const T = u.todayKey();
      const today = s.dayBookings(T);
      const inWork = today.filter(s.isInWork);
      const done = today.filter((b) => b.status === 'done');
      const revenue = done.reduce((a, b) => a + b.price, 0);
      const paid = done.filter((b) => b.paid).reduce((a, b) => a + b.price, 0);
      const free = s.freePostSlotsLeft(T);
      const nm = u.nowMin();
      const upcoming = s.S().bookings.filter((b) => b.status === 'created' && (b.date > T || (b.date === T && u.toMin(b.time) >= nm - 30))).sort(s.cmpBooking).slice(0, 6);
      const notifs = s.notificationsFor('admin').slice(0, 6);
      const content = `
        <div class="kpis">
          ${kpi('Записей сегодня', today.length, `выполнено ${done.length}, впереди ${today.filter((b) => b.status === 'created').length}`, 'calendar')}
          ${kpi('Автомобилей в работе', inWork.length, `на ${s.workingPosts().length} постах`, 'wrench', inWork.length ? 'is-live' : '')}
          ${kpi('Свободных мест', free, 'окон по 30 мин до закрытия', 'clock')}
          ${kpi('Выручка сегодня', money(revenue), `оплачено ${money(paid)}`, 'ruble')}
        </div>

        <section class="panel">
          <div class="panel-h"><div><h2>Загрузка постов сегодня</h2><span class="muted sm">Нажмите на запись, чтобы открыть её</span></div><a class="btn btn-outline btn-sm" href="#/admin/calendar">${icon('calendar')}Календарь</a></div>
          ${postsTimeline(T)}
        </section>

        <div class="a-grid2">
          <section class="panel">
            <div class="panel-h"><h2>Сейчас в работе</h2><span class="muted sm">${inWork.length}</span></div>
            ${inWork.length ? `<div class="work-list">${inWork.sort((a, b) => a.post - b.post).map((b) => {
              const car = s.getCar(b.carId), m = s.getMaster(b.masterId);
              return `<div class="work-item click" data-act="a-open" data-id="${b.id}">
                <span class="post-badge">П${b.post}</span>
                <div class="grow"><b>${esc(s.carName(car))} <span class="tag">${esc(car.size)}</span></b><div class="sm muted">${esc(s.getService(b.serviceId).short)} · ${m ? esc(s.firstName(m.name)) : '—'} · с ${b.time}</div>${ui.segbar(b)}</div>
                <div class="work-r">${ui.pill(b.status)}${nextBtn(b)}</div>
              </div>`;
            }).join('')}</div>` : ui.emptyState('wrench', 'Сейчас посты свободны', '')}
          </section>
          <section class="panel">
            <div class="panel-h"><h2>Загрузка на неделю</h2><span class="muted sm">доля занятого времени</span></div>
            ${weekChart()}
          </section>
        </div>

        <div class="a-grid2">
          <section class="panel">
            <div class="panel-h"><h2>Ближайшие записи</h2><a class="link-sm" href="#/admin/bookings">Все записи ${icon('chevR')}</a></div>
            <div class="mini-list">${upcoming.map((b) => {
              const car = s.getCar(b.carId);
              return `<div class="mini click" data-act="a-open" data-id="${b.id}"><div class="mini-t tnum"><b>${b.time}</b><span>${esc(u.relDay(b.date) || u.fmtDateShort(b.date))}</span></div><div class="grow"><b>${esc(s.carName(car))} <span class="tag">${esc(car.size)}</span></b><div class="sm muted">${esc(s.getService(b.serviceId).short)} · ${esc(s.firstName(clientOf(b).name))}</div></div><span class="post-badge">П${b.post}</span></div>`;
            }).join('') || '<p class="muted">Нет записей</p>'}</div>
          </section>
          <section class="panel">
            <div class="panel-h"><h2>Уведомления</h2><button class="link-sm" data-act="a-notifs">Все ${icon('chevR')}</button></div>
            <div class="nlist compact">${notifs.map((n) => `<div class="nitem ${n.read ? '' : 'unread'} ${n.bookingId ? 'click' : ''}" ${n.bookingId ? `data-act="a-open" data-id="${n.bookingId}"` : ''}><span class="nitem-ic k-${n.kind || 'info'}">${icon(ui.nIcon(n.kind))}</span><div><b>${esc(n.title || '')}</b><p>${esc(n.text)}</p><span class="nitem-t">${u.timeAgo(n.at)}</span></div></div>`).join('') || '<p class="muted">Пусто</p>'}</div>
          </section>
        </div>`;
      return shell('overview', 'Обзор', content);
    },
  };

  /* ================= Записи ================= */
  const bf = { filter: 'today', q: '' };
  const FILTERS = [['today', 'Сегодня'], ['tomorrow', 'Завтра'], ['all', 'Все'], ['work', 'В работе'], ['done', 'Готово'], ['cancelled', 'Отменённые']];
  function filterBookings(f) {
    const T = u.todayKey(), TM = u.addDays(T, 1);
    const all = s.S().bookings;
    switch (f) {
      case 'today': return all.filter((b) => b.date === T && b.status !== 'cancelled').sort(s.cmpBooking);
      case 'tomorrow': return all.filter((b) => b.date === TM && b.status !== 'cancelled').sort(s.cmpBooking);
      case 'work': return all.filter(s.isInWork).sort(s.cmpBooking);
      case 'done': return all.filter((b) => b.status === 'done').sort(s.cmpBooking).reverse();
      case 'cancelled': return all.filter((b) => b.status === 'cancelled').sort(s.cmpBooking).reverse();
      default: return all.filter((b) => b.status !== 'cancelled').sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
    }
  }
  function bookingRows() {
    let list = filterBookings(bf.filter);
    const q = bf.q.trim().toLowerCase();
    if (q) list = list.filter((b) => { const c = clientOf(b), car = s.getCar(b.carId); return `${b.id} ${c.name} ${c.phone} ${u.digits(c.phone)} ${s.carName(car)} ${car.plate} ${s.getService(b.serviceId).name}`.toLowerCase().includes(q); });
    const total = list.length;
    list = list.slice(0, 120);
    if (!list.length) return `<tr><td colspan="9">${ui.emptyState('list', 'Записей не найдено', bf.q ? 'Попробуйте изменить запрос' : '')}</td></tr>`;
    const showDate = !['today', 'tomorrow'].includes(bf.filter);
    return list.map((b) => {
      const c = clientOf(b), car = s.getCar(b.carId), m = s.getMaster(b.masterId);
      return `<tr class="click" data-act="a-open" data-id="${b.id}">
        <td class="tnum"><b>${b.time}</b>${showDate ? `<div class="sm muted">${esc(u.fmtDateShort(b.date))}</div>` : ''}</td>
        <td><b>${esc(c.name)}</b><div class="sm muted tnum">${esc(c.phone)}</div></td>
        <td>${esc(s.carName(car))} <span class="tag">${esc(car.size)}</span></td>
        <td>${esc(s.getService(b.serviceId).short)}${b.extras.includes('balance') ? '<div class="sm muted">+ балансировка</div>' : ''}</td>
        <td class="tnum">${b.post}</td>
        <td>${m ? esc(s.firstName(m.name)) : '—'}</td>
        <td>${ui.pill(b.status)}</td>
        <td class="tnum r"><b>${money(b.price)}</b>${b.status === 'done' ? `<div class="sm ${b.paid ? 'ok' : 'warn'}">${b.paid ? 'оплачено' : 'не оплачено'}</div>` : ''}</td>
        <td class="r">${s.isActive(b) ? nextBtn(b) : ''}</td>
      </tr>`;
    }).join('') + (total > 120 ? `<tr><td colspan="9" class="muted center sm">Показаны 120 из ${total}. Уточните поиск.</td></tr>` : '');
  }
  V.adminBookings = {
    shell: 'admin',
    render() {
      const counts = Object.fromEntries(FILTERS.map(([k]) => [k, filterBookings(k).length]));
      return shell('bookings', 'Записи', `
        <div class="toolbar">
          <div class="filters">${FILTERS.map(([k, l]) => `<button class="fchip ${bf.filter === k ? 'on' : ''}" data-act="a-bf" data-k="${k}">${l}<span>${counts[k]}</span></button>`).join('')}</div>
          <label class="search">${icon('search')}<input class="input" placeholder="Клиент, телефон, авто, №" value="${esc(bf.q)}" data-input="a-bq"></label>
        </div>
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Время</th><th>Клиент</th><th>Автомобиль</th><th>Услуга</th><th>Пост</th><th>Мастер</th><th>Статус</th><th class="r">Стоимость</th><th></th></tr></thead>
          <tbody id="bk-body">${bookingRows()}</tbody>
        </table></div>`);
    },
  };
  act['a-bf'] = (el) => { bf.filter = el.dataset.k; A.render(); };
  act['a-bq'] = (el) => { bf.q = el.value; const tb = document.getElementById('bk-body'); if (tb) tb.innerHTML = bookingRows(); };

  /* ---------- Карточка записи ---------- */
  act['a-open'] = (el, e) => { if (e && e.target.closest('[data-act="a-next"]') && e.target.closest('[data-act="a-next"]') !== el) return; openBooking(el.dataset.id); };
  function openBooking(id) {
    const b0 = s.getBooking(id);
    if (!b0) return;
    const draft = { date: b0.date, time: b0.time, post: b0.post, masterId: b0.masterId };
    const m = u.modal({
      wide: true,
      live: true,
      title: () => `Запись №${id}`,
      body: () => {
        const b = s.getBooking(id);
        const c = clientOf(b), car = s.getCar(b.carId), sv = s.getService(b.serviceId);
        const created = (b.log || [])[0];
        const slots = s.freeSlots(draft.date, b.duration, b.id);
        if (!slots.includes(draft.time)) slots.unshift(draft.time);
        slots.sort();
        const start = u.toMin(draft.time);
        const editable = s.isActive(b);
        const changed = draft.date !== b.date || draft.time !== b.time || Number(draft.post) !== b.post || draft.masterId !== b.masterId;
        return `
          <div class="bk-head">${ui.pill(b.status)}<span class="muted sm">${b.source === 'admin' ? 'Создана администратором' : 'Онлайн-запись клиента'}${created ? ' · ' + u.timeAgo(created.at) : ''}</span></div>
          <div class="bk-grid">
            <div class="bk-cell"><span class="lbl">Клиент</span><b>${esc(c.name)}</b><a class="sm tnum" href="tel:${u.digits(c.phone)}">${esc(c.phone)}</a><button class="link-sm" data-act="a-client" data-id="${c.id}">Карточка клиента</button></div>
            <div class="bk-cell"><span class="lbl">Автомобиль</span><b>${esc(s.carName(car))}</b><span class="sm">${esc(car.size)}${car.runflat ? ' · Run-flat' : ''} · ${esc(car.kit)}</span>${car.plate ? `<span class="plate sm">${esc(car.plate)}</span>` : ''}</div>
            <div class="bk-cell"><span class="lbl">Услуга</span><b>${esc(sv.name)}</b><span class="sm">${b.wheels} ${u.plural(b.wheels, ['колесо', 'колеса', 'колёс'])}${b.extras.length ? ' · ' + b.extras.map((x) => s.EXTRAS.find((e) => e.id === x).name.toLowerCase()).join(', ') : ''}</span><span class="sm muted">≈ ${b.duration} мин</span></div>
            <div class="bk-cell"><span class="lbl">Стоимость</span><b class="tnum">${money(b.price)}</b><span class="sm ${b.paid ? 'ok' : 'muted'}">${b.paid ? `Оплачено · ${esc(b.payMethod)}` : 'Не оплачено'}</span></div>
          </div>

          <h4 class="bk-sec">Время и пост</h4>
          <div class="bk-form">
            <div class="field"><label>Дата</label><input type="date" class="input" data-d="date" value="${draft.date}" min="${u.todayKey()}" ${editable ? '' : 'disabled'}></div>
            <div class="field"><label>Время</label><select class="input select" data-d="time" ${editable ? '' : 'disabled'}>${slots.map((t) => `<option ${t === draft.time ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
            <div class="field"><label>Пост</label><select class="input select" data-d="post" ${editable ? '' : 'disabled'}>${s.postNumbers().map((p) => { const f = s.postFree(draft.date, p, start, b.duration, b.id); return `<option value="${p}" ${Number(draft.post) === p ? 'selected' : ''} ${f ? '' : 'disabled'}>Пост ${p}${f ? '' : ' — занят'}</option>`; }).join('')}</select></div>
            <div class="field"><label>Мастер</label><select class="input select" data-d="masterId" ${editable ? '' : 'disabled'}>${s.S().masters.map((mm) => `<option value="${mm.id}" ${draft.masterId === mm.id ? 'selected' : ''}>${esc(mm.name)}${mm.onShift ? '' : ' (выходной)'}</option>`).join('')}</select></div>
          </div>
          ${changed ? `<div class="bk-save"><span class="sm">Есть несохранённые изменения</span><button class="btn btn-primary btn-sm" data-save>Сохранить</button></div>` : ''}

          ${b.status !== 'cancelled' ? `<h4 class="bk-sec">Статус заказа</h4>
          <div class="st-steps">${s.STATUSES.map((x, i) => `<button class="st-step ${i < s.ST_IDX[b.status] ? 'done' : ''} ${x.key === b.status ? 'on' : ''}" data-status="${x.key}"><span>${i + 1}</span>${esc(x.short)}</button>`).join('')}</div>
          <p class="sm muted" style="margin:8px 0 0">${icon('info')} Клиент автоматически получает уведомление при смене статуса.</p>` : `<div class="note warn">${icon('x')} Запись отменена ${b.cancelledBy === 'client' ? 'клиентом' : 'сервисом'}</div>`}

          ${b.status === 'done' && !b.paid ? `<h4 class="bk-sec">Оплата</h4><div class="pay-btns">${s.PAY_METHODS.map((pm) => `<button class="btn btn-outline" data-pay="${pm}">${icon(pm === 'Наличные' ? 'ruble' : 'card')}${pm}</button>`).join('')}</div>` : ''}`;
      },
      footer: () => {
        const b = s.getBooking(id);
        const n = s.nextStatus(b);
        return `${s.isActive(b) ? `<button class="btn btn-ghost-danger mr-auto" data-cancel>Отменить запись</button>` : '<span class="mr-auto"></span>'}
          <button class="btn btn-outline" data-close>Закрыть</button>
          ${n && b.status !== 'cancelled' ? `<button class="btn btn-primary" data-nextst>${icon('arrowR')}${esc(s.statusLabel(n))}</button>` : ''}`;
      },
      mount(el) {
        el.querySelectorAll('[data-d]').forEach((inp) => inp.addEventListener('change', () => {
          draft[inp.dataset.d] = inp.dataset.d === 'post' ? Number(inp.value) : inp.value;
          if (inp.dataset.d === 'post') { const mm = s.masterForPost(draft.post); if (mm) draft.masterId = mm.id; }
          if (inp.dataset.d === 'date') {
            const b = s.getBooking(id);
            const sl = s.freeSlots(draft.date, b.duration, b.id);
            if (!sl.includes(draft.time)) draft.time = sl[0] || draft.time;
          }
          inp.blur();
          m.render();
        }));
        const sv = el.querySelector('[data-save]');
        if (sv) sv.onclick = () => {
          try {
            s.updateBooking(id, { date: draft.date, time: draft.time, post: Number(draft.post), masterId: draft.masterId }, { by: 'admin', strictPost: true, keepPrice: true });
            u.toast('Запись обновлена', { icon: 'check' });
          } catch (err) { u.toast(err.message, { type: 'error' }); }
        };
        el.querySelectorAll('[data-status]').forEach((bt) => bt.onclick = () => { s.setStatus(id, bt.dataset.status); });
        el.querySelectorAll('[data-pay]').forEach((bt) => bt.onclick = () => { s.markPaid(id, bt.dataset.pay); u.toast(`Оплата принята: ${bt.dataset.pay}`, { icon: 'check' }); });
        const nx = el.querySelector('[data-nextst]');
        if (nx) nx.onclick = () => { const b = s.getBooking(id); s.setStatus(id, s.nextStatus(b)); };
        const cn = el.querySelector('[data-cancel]');
        if (cn) cn.onclick = async () => {
          if (await u.confirmDialog({ title: `Отменить запись №${id}?`, text: 'Клиент получит уведомление, время освободится.', ok: 'Отменить запись', danger: true })) { s.cancelBooking(id, 'admin'); u.toast('Запись отменена'); }
        };
      },
    });
    return m;
  }
  A.openBooking = openBooking;

  /* ---------- Новая запись (администратор) ---------- */
  act['a-new'] = () => newBooking({});
  function newBooking(pre) {
    const T = u.todayKey();
    const f = {
      mode: pre.clientId ? 'exist' : 'exist', clientId: pre.clientId || s.S().clients[1].id, name: '', phone: '',
      carId: null, nc: { brand: '', model: '', size: 'R16' }, serviceId: 'season', balance: false,
      date: pre.date || T, time: pre.time || null, post: pre.post || 0,
    };
    const carsOfSel = () => (f.mode === 'exist' ? s.carsOf(f.clientId) : []);
    const fixCar = () => { const cs = carsOfSel(); if (!cs.find((c) => c.id === f.carId)) f.carId = cs[0] ? cs[0].id : 'new'; };
    fixCar();
    const wheels = () => (['puncture', 'tire', 'rim'].includes(f.serviceId) ? 1 : 4);
    const curCar = () => (f.carId && f.carId !== 'new' ? s.getCar(f.carId) : Object.assign({ runflat: false }, f.nc));
    const est = () => s.estimate({ serviceId: f.serviceId, size: curCar().size, wheels: wheels(), runflat: curCar().runflat, extras: f.balance ? ['balance'] : [] });
    const m = u.modal({
      wide: true,
      title: 'Новая запись',
      body: () => {
        const e = est();
        let slots = s.freeSlots(f.date, e.duration);
        if (f.post) slots = slots.filter((t) => s.postFree(f.date, f.post, u.toMin(t), e.duration) && s.workingPosts().includes(f.post));
        if (f.time && !slots.includes(f.time)) f.time = null;
        if (!f.time && slots.length) f.time = slots[0];
        const clients = s.S().clients.slice().sort((a, b) => a.name.localeCompare(b.name, 'ru'));
        return `
          <div class="field"><label>Клиент</label><div class="seg"><button data-f="mode" data-v="exist" class="${f.mode === 'exist' ? 'on' : ''}">Из базы</button><button data-f="mode" data-v="new" class="${f.mode === 'new' ? 'on' : ''}">Новый клиент</button></div></div>
          ${f.mode === 'exist' ? `<div class="field"><select class="input select" data-i="clientId">${clients.map((c) => `<option value="${c.id}" ${c.id === f.clientId ? 'selected' : ''}>${esc(c.name)} · ${esc(c.phone)}</option>`).join('')}</select></div>`
            : `<div class="grid2"><div class="field"><label>Имя</label><input class="input" data-i="name" value="${esc(f.name)}" placeholder="Имя клиента"></div><div class="field"><label>Телефон</label><input class="input tnum" data-phone data-i="phone" value="${esc(f.phone)}" placeholder="+7 (___) ___-__-__"></div></div>`}
          <div class="field"><label>Автомобиль</label>
            ${carsOfSel().length ? `<select class="input select" data-i="carId">${carsOfSel().map((c) => `<option value="${c.id}" ${c.id === f.carId ? 'selected' : ''}>${esc(s.carName(c))} · ${c.size}</option>`).join('')}<option value="new" ${f.carId === 'new' ? 'selected' : ''}>+ Другой автомобиль</option></select>` : ''}
          </div>
          ${f.carId === 'new' ? `<div class="grid3"><div class="field"><label>Марка</label><input class="input" list="brands-a" data-i="nc.brand" value="${esc(f.nc.brand)}"></div><div class="field"><label>Модель</label><input class="input" data-i="nc.model" value="${esc(f.nc.model)}"></div><div class="field"><label>Размер</label><select class="input select" data-i="nc.size">${s.SIZES.map((z) => `<option ${z === f.nc.size ? 'selected' : ''}>${z}</option>`).join('')}</select></div></div><datalist id="brands-a">${s.BRANDS.map((b) => `<option value="${b}">`).join('')}</datalist>` : ''}
          <div class="grid2">
            <div class="field"><label>Услуга</label><select class="input select" data-i="serviceId">${s.S().services.map((x) => `<option value="${x.id}" ${x.id === f.serviceId ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>
            <div class="field"><label>&nbsp;</label><label class="check"><input type="checkbox" data-i="balance" ${f.balance ? 'checked' : ''} ${['balance', 'complex', 'storage'].includes(f.serviceId) ? 'disabled' : ''}><span class="check-box">${icon('check')}</span><span>Добавить балансировку</span></label></div>
          </div>
          <div class="grid3">
            <div class="field"><label>Дата</label><input type="date" class="input" data-i="date" value="${f.date}" min="${T}"></div>
            <div class="field"><label>Пост</label><select class="input select" data-i="post"><option value="0">Авто</option>${s.workingPosts().map((p) => `<option value="${p}" ${Number(f.post) === p ? 'selected' : ''}>Пост ${p}</option>`).join('')}</select></div>
            <div class="field"><label>Время</label>${slots.length ? `<select class="input select" data-i="time">${slots.map((t) => `<option ${t === f.time ? 'selected' : ''}>${t}</option>`).join('')}</select>` : '<div class="input disabled-box">Нет свободного времени</div>'}</div>
          </div>
          <div class="sum-total"><span>Стоимость · ≈ ${e.duration} мин</span><b class="tnum">${money(e.total)}</b></div>`;
      },
      footer: '<button class="btn btn-outline" data-close>Отмена</button><button class="btn btn-primary" data-create>Создать запись</button>',
      mount(el) {
        el.querySelectorAll('[data-f]').forEach((b) => b.onclick = () => { f[b.dataset.f] = b.dataset.v; fixCar(); m.render(); });
        el.querySelectorAll('[data-i]').forEach((inp) => {
          const k = inp.dataset.i;
          const handler = () => {
            const v = inp.type === 'checkbox' ? inp.checked : inp.value;
            if (k.startsWith('nc.')) f.nc[k.slice(3)] = v; else f[k] = k === 'post' ? Number(v) : v;
            if (k === 'clientId') fixCar();
            if (inp.tagName === 'SELECT' || inp.type === 'checkbox' || inp.type === 'date') m.render();
          };
          inp.addEventListener(inp.tagName === 'INPUT' && inp.type !== 'checkbox' && inp.type !== 'date' ? 'input' : 'change', handler);
        });
        el.querySelector('[data-create]').onclick = () => {
          try {
            let clientId = f.clientId;
            if (f.mode === 'new') {
              if (f.name.trim().length < 2 || !u.phoneValid(f.phone)) { u.toast('Укажите имя и телефон клиента', { type: 'error' }); return; }
              clientId = s.addClient(f.name, f.phone).id;
            }
            let carId = f.carId;
            if (!carId || carId === 'new') {
              if (!f.nc.brand.trim() || !f.nc.model.trim()) { u.toast('Укажите марку и модель', { type: 'error' }); return; }
              carId = s.addCar(Object.assign({ clientId }, f.nc)).id;
            }
            if (!f.time) { u.toast('Нет свободного времени на эту дату', { type: 'error' }); return; }
            const b = s.createBooking({ clientId, carId, serviceId: f.serviceId, date: f.date, time: f.time, wheels: wheels(), extras: f.balance ? ['balance'] : [], post: Number(f.post) || undefined, source: 'admin' });
            m.close();
            u.toast(`Запись №${b.id} создана: ${u.fmtDay(b.date)}, ${b.time}, пост ${b.post}`, { icon: 'check' });
          } catch (err) { u.toast(err.message, { type: 'error' }); }
        };
      },
    });
  }
  A.newBooking = newBooking;

  /* ================= Клиенты ================= */
  let cq = '';
  function clientRows() {
    const q = cq.trim().toLowerCase();
    let list = s.S().clients.map((c) => ({ c, st: s.clientStats(c.id), cars: s.carsOf(c.id) }));
    if (q) list = list.filter(({ c, cars }) => `${c.name} ${c.phone} ${u.digits(c.phone)} ${cars.map((x) => s.carName(x) + ' ' + x.plate).join(' ')}`.toLowerCase().includes(q));
    list.sort((a, b) => b.st.total - a.st.total);
    if (!list.length) return `<tr><td colspan="6">${ui.emptyState('users', 'Клиенты не найдены', '')}</td></tr>`;
    return list.map(({ c, st, cars }) => `<tr class="click" data-act="a-client" data-id="${c.id}">
      <td><div class="who"><span class="avatar sm">${esc(u.initials(c.name))}</span><b>${esc(c.name)}</b></div></td>
      <td class="tnum">${esc(c.phone)}</td>
      <td>${cars.map((x) => `<span class="tag">${esc(s.carName(x))}</span>`).join(' ') || '—'}</td>
      <td class="tnum r">${st.orders}</td>
      <td class="tnum r"><b>${money(st.total)}</b></td>
      <td class="tnum">${st.last ? esc(u.fmtDate(st.last)) : '—'}</td>
    </tr>`).join('');
  }
  V.adminClients = {
    shell: 'admin',
    render() {
      const n = s.S().clients.length;
      return shell('clients', 'Клиенты', `
        <div class="toolbar"><div class="muted">${n} ${u.plural(n, ['клиент', 'клиента', 'клиентов'])} · история сохраняется автоматически</div>
          <label class="search">${icon('search')}<input class="input" placeholder="Имя, телефон, авто" value="${esc(cq)}" data-input="a-cq"></label></div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Клиент</th><th>Телефон</th><th>Автомобили</th><th class="r">Заказов</th><th class="r">Общая сумма</th><th>Последний визит</th></tr></thead><tbody id="cl-body">${clientRows()}</tbody></table></div>`);
    },
  };
  act['a-cq'] = (el) => { cq = el.value; const tb = document.getElementById('cl-body'); if (tb) tb.innerHTML = clientRows(); };
  act['a-client'] = (el, e) => { if (e) e.stopPropagation(); openClient(el.dataset.id); };
  function openClient(id) {
    const m = u.modal({
      wide: true, live: true,
      title: () => 'Карточка клиента',
      body: () => {
        const c = s.getClient(id), st = s.clientStats(id), cars = s.carsOf(id);
        const hist = s.S().bookings.filter((b) => b.clientId === id).sort(s.cmpBooking).reverse();
        return `
          <div class="cl-head"><span class="avatar lg">${esc(u.initials(c.name))}</span><div class="grow"><h3>${esc(c.name)}</h3><a class="tnum" href="tel:${u.digits(c.phone)}">${esc(c.phone)}</a></div></div>
          <div class="stats3 boxed"><div><b class="tnum">${st.orders}</b><span>заказов</span></div><div><b class="tnum">${money(st.total)}</b><span>общая сумма</span></div><div><b class="tnum">${money(st.avg)}</b><span>средний чек</span></div></div>
          <h4 class="bk-sec">Автомобили</h4>
          <div class="cl-cars">${cars.map((x) => `<div class="cl-car">${icon('car')}<div><b>${esc(s.carName(x))}</b><span class="sm muted">${esc(x.size)} · ${esc(x.kit)}${x.runflat ? ' · Run-flat' : ''}${x.mileage ? ' · ' + u.num(x.mileage) + ' км' : ''}</span>${x.plate ? `<span class="plate sm">${esc(x.plate)}</span>` : ''}</div></div>`).join('') || '<p class="muted">Нет автомобилей</p>'}</div>
          <h4 class="bk-sec">История посещений</h4>
          <div class="tbl-wrap"><table class="tbl tbl-sm"><thead><tr><th>Дата</th><th>Автомобиль</th><th>Услуга</th><th>Статус</th><th class="r">Сумма</th></tr></thead><tbody>
            ${hist.map((b) => `<tr class="click" data-act="a-open" data-id="${b.id}"><td class="tnum">${esc(u.fmtDate(b.date))} <span class="muted">${b.time}</span></td><td>${esc(s.carName(s.getCar(b.carId)))}</td><td>${esc(s.getService(b.serviceId).short)}</td><td>${ui.pill(b.status)}</td><td class="tnum r">${money(b.price)}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Нет посещений</td></tr>'}
          </tbody></table></div>`;
      },
      footer: () => `<a class="btn btn-outline mr-auto" href="tel:${u.digits(s.getClient(id).phone)}">${icon('phone')}Позвонить</a><button class="btn btn-primary" data-newb>${icon('plus')}Новая запись</button>`,
      mount(el) { el.querySelector('[data-newb]').onclick = () => { m.close(); newBooking({ clientId: id }); }; },
    });
  }

  /* ================= Автомобили ================= */
  let carq = '';
  function carRows() {
    const q = carq.trim().toLowerCase();
    let list = s.S().cars.slice();
    if (q) list = list.filter((c) => `${s.carName(c)} ${c.plate} ${c.size} ${(s.getClient(c.clientId) || {}).name}`.toLowerCase().includes(q));
    list.sort((a, b) => s.carName(a).localeCompare(s.carName(b)));
    return list.map((c) => {
      const cl = s.getClient(c.clientId) || { name: '—' };
      const visits = s.S().bookings.filter((b) => b.carId === c.id && b.status === 'done').sort(s.cmpBooking);
      const last = visits[visits.length - 1];
      return `<tr class="click" data-act="a-client" data-id="${cl.id}">
        <td><b>${esc(s.carName(c))}</b></td><td>${c.plate ? `<span class="plate">${esc(c.plate)}</span>` : '—'}</td>
        <td><span class="tag">${esc(c.size)}</span></td><td>${esc(c.kit)}</td><td>${c.runflat ? 'Да' : '—'}</td>
        <td class="tnum r">${c.mileage ? u.num(c.mileage) + ' км' : '—'}</td><td>${esc(cl.name)}</td>
        <td class="tnum r">${visits.length}</td><td class="tnum">${last ? esc(u.fmtDate(last.date)) : '—'}</td></tr>`;
    }).join('') || `<tr><td colspan="9">${ui.emptyState('car', 'Ничего не найдено', '')}</td></tr>`;
  }
  V.adminCars = {
    shell: 'admin',
    render() {
      const all = s.S().cars;
      const bySize = {};
      all.forEach((c) => { bySize[c.size] = (bySize[c.size] || 0) + 1; });
      return shell('cars', 'Автомобили', `
        <div class="toolbar"><div class="size-sum">${s.SIZES.filter((z) => bySize[z]).map((z) => `<span class="tag">${z} · ${bySize[z]}</span>`).join(' ')}</div>
          <label class="search">${icon('search')}<input class="input" placeholder="Марка, номер, владелец" value="${esc(carq)}" data-input="a-carq"></label></div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Автомобиль</th><th>Госномер</th><th>Размер</th><th>Комплект</th><th>Run-flat</th><th class="r">Пробег</th><th>Владелец</th><th class="r">Визитов</th><th>Последний визит</th></tr></thead><tbody id="car-body">${carRows()}</tbody></table></div>`);
    },
  };
  act['a-carq'] = (el) => { carq = el.value; const tb = document.getElementById('car-body'); if (tb) tb.innerHTML = carRows(); };

  /* ================= Мастера ================= */
  function masterState(m) {
    const T = u.todayKey();
    const mine = s.dayBookings(T).filter((b) => b.masterId === m.id);
    const cur = mine.find(s.isInWork);
    const next = mine.filter((b) => b.status === 'created').sort(s.cmpBooking)[0];
    if (!m.onShift) return { key: 'off', label: 'Выходной', cur: null, next: null, mine };
    if (cur) return { key: 'busy', label: 'Сейчас работает', cur, next, mine };
    return { key: 'free', label: 'Свободен', cur: null, next, mine };
  }
  A.masterState = masterState;
  function setMasterPost(mid, post) {
    const st = s.S();
    const m = st.masters.find((x) => x.id === mid);
    const other = st.masters.find((x) => x.id !== mid && x.post === post && post);
    const oldPost = m.post;
    if (other) other.post = oldPost || null;
    m.post = post || null;
    const T = u.todayKey();
    st.bookings.forEach((b) => {
      if (b.date < T || !s.isActive(b) || s.isInWork(b)) return;
      const owner = st.masters.find((x) => x.onShift && x.post === b.post);
      if (owner) b.masterId = owner.id;
    });
    s.save();
  }
  V.adminMasters = {
    shell: 'admin',
    render() {
      const list = s.S().masters;
      return shell('masters', 'Мастера', `
        <div class="toolbar"><div class="muted">На смене ${list.filter((m) => m.onShift).length} из ${list.length}</div><button class="btn btn-outline btn-sm" data-act="a-master-add">${icon('plus')}Добавить мастера</button></div>
        <div class="masters">${list.map((m) => {
          const ms = masterState(m);
          const done = ms.mine.filter((b) => b.status === 'done').length;
          const car = ms.cur ? s.getCar(ms.cur.carId) : null;
          return `<article class="mcard ${ms.key}">
            <div class="mcard-top"><span class="avatar">${esc(u.initials(m.name))}</span><div class="grow"><h3>${esc(s.firstName(m.name))}</h3><span class="sm muted">${esc(m.name)}</span></div><span class="mstate ${ms.key}"><i></i>${ms.label}</span></div>
            <div class="mcard-stats">
              <div><span class="lbl">Пост</span><b>${m.post ? '№ ' + m.post : '—'}</b></div>
              <div><span class="lbl">Заказов сегодня</span><b class="tnum">${ms.mine.length}</b></div>
              <div><span class="lbl">Выполнено</span><b class="tnum">${done}</b></div>
            </div>
            <div class="mcard-now">${ms.cur ? `${icon('wrench')}<div class="grow"><b>${esc(s.carName(car))} <span class="tag">${esc(car.size)}</span></b><span class="sm muted">${esc(s.getService(ms.cur.serviceId).short)} · ${esc(s.statusLabel(ms.cur.status))}</span></div>${nextBtn(ms.cur)}`
              : ms.next ? `${icon('clock')}<div class="grow"><b>Следующая запись в ${ms.next.time}</b><span class="sm muted">${esc(s.bookingTitle(ms.next))}</span></div>` : `${icon('check')}<div class="grow"><span class="muted">Записей больше нет</span></div>`}</div>
            <div class="mcard-ctl">
              <label class="sm">Пост <select class="input select input-sm" data-change="a-mpost" data-id="${m.id}"><option value="0">—</option>${s.postNumbers().map((p) => `<option value="${p}" ${m.post === p ? 'selected' : ''}>№ ${p}</option>`).join('')}</select></label>
              <label class="switch-inline sm">На смене <input type="checkbox" class="switch" data-change="a-mshift" data-id="${m.id}" ${m.onShift ? 'checked' : ''}></label>
            </div>
          </article>`;
        }).join('')}</div>`);
    },
  };
  act['a-mpost'] = (el) => { setMasterPost(el.dataset.id, Number(el.value)); u.toast('Пост назначен, будущие записи переназначены', { icon: 'check' }); };
  act['a-mshift'] = (el) => { const m = s.getMaster(el.dataset.id); m.onShift = el.checked; s.save(); };
  act['a-master-add'] = () => {
    const m = u.modal({
      title: 'Новый мастер',
      body: '<div class="field"><label>Имя и фамилия</label><input class="input" name="name" autofocus placeholder="Николай Сидоров"></div><div class="field"><label>Телефон</label><input class="input tnum" data-phone name="phone"></div>',
      footer: '<button class="btn btn-outline" data-close>Отмена</button><button class="btn btn-primary" data-save>Добавить</button>',
      mount(el) {
        el.querySelector('[data-save]').onclick = () => {
          const name = el.querySelector('[name=name]').value.trim();
          if (name.length < 2) { u.toast('Введите имя', { type: 'error' }); return; }
          s.S().masters.push({ id: u.uid('m'), name, phone: el.querySelector('[name=phone]').value, post: null, onShift: false, since: new Date().getFullYear() });
          s.save(); m.close(); u.toast('Мастер добавлен');
        };
      },
    });
  };

  /* ================= Услуги и цены ================= */
  V.adminServices = {
    shell: 'admin',
    render() {
      const season = s.getService('season');
      return shell('services', 'Услуги и цены', `
        <div class="note">${icon('info')} Изменения сохраняются автоматически и сразу видны клиентам в приложении и калькуляторе.</div>
        <div class="svc-admin">${s.S().services.map((x) => `
          <div class="svc-row">
            <span class="svc-ic">${icon(x.icon)}</span>
            <div class="svc-fields">
              <input class="input input-title" value="${esc(x.name)}" data-change="a-svc" data-id="${x.id}" data-k="name" aria-label="Название">
              <input class="input input-sm" value="${esc(x.desc)}" data-change="a-svc" data-id="${x.id}" data-k="desc" aria-label="Описание">
            </div>
            <label class="price-in"><span>от</span><input class="input tnum" type="number" min="0" step="50" value="${x.price}" data-change="a-svc" data-id="${x.id}" data-k="price" aria-label="Цена"><span>₽${x.unit === 'wheel' ? '/колесо' : x.unit === 'season' ? '/сезон' : ''}</span></label>
            <label class="price-in dur"><input class="input tnum" type="number" min="10" step="5" value="${x.duration}" data-change="a-svc" data-id="${x.id}" data-k="duration" aria-label="Длительность"><span>мин</span></label>
          </div>`).join('')}</div>
        <section class="panel">
          <div class="panel-h"><div><h2>Коэффициенты по размеру диска</h2><span class="muted sm">Пример: «${esc(season.name)}», 4 колеса</span></div></div>
          <div class="coef">${s.SIZES.map((z) => `<div><span class="tag">${z}</span><b class="tnum">×${s.SIZE_FACTOR[z].toFixed(2).replace('.', ',')}</b><span class="sm muted tnum">${money(s.estimate({ serviceId: 'season', size: z }).total)}</span></div>`).join('')}</div>
        </section>`);
    },
  };
  act['a-svc'] = (el) => {
    const x = s.getService(el.dataset.id);
    const k = el.dataset.k;
    const v = ['price', 'duration'].includes(k) ? Math.max(0, Number(el.value) || 0) : el.value.trim();
    if (!v && v !== 0) return;
    x[k] = v;
    s.save();
    u.toast(k === 'price' ? `${x.name}: от ${money(v)}` : 'Сохранено', { title: k === 'price' ? 'Цена обновлена' : undefined, icon: 'check' });
  };

  /* ================= Склад ================= */
  V.adminStock = {
    shell: 'admin',
    render() {
      const st = s.S();
      const low = st.stock.filter((x) => x.qty < x.min);
      const sp = Math.round((st.storage.used / st.storage.cap) * 100);
      return shell('stock', 'Склад', `
        <div class="a-grid2 stock-top">
          <section class="panel">
            <div class="panel-h"><h2>Хранение шин</h2><span class="muted sm tnum">${st.storage.used} из ${st.storage.cap} мест</span></div>
            <div class="meter"><i style="width:${sp}%"></i></div>
            <div class="stock-row-ctl"><span class="muted sm">Свободно ${st.storage.cap - st.storage.used} мест · заполнено ${sp}%</span>
              <div class="qty-ctl"><button class="icon-btn sm" data-act="a-store" data-d="-1" aria-label="Освободить место">${icon('minus')}</button><button class="icon-btn sm" data-act="a-store" data-d="1" aria-label="Занять место">${icon('plus')}</button></div></div>
          </section>
          <section class="panel">
            <div class="panel-h"><h2>Требует пополнения</h2><span class="muted sm">${low.length}</span></div>
            ${low.length ? low.map((x) => `<div class="li">${icon('alert', 'warn')}<div class="grow"><b>${esc(x.name)}</b><span class="sm muted tnum">осталось ${u.num(x.qty)} ${x.unit}, минимум ${u.num(x.min)}</span></div></div>`).join('') : `<p class="muted">${icon('check')} Всё в наличии</p>`}
          </section>
        </div>
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Позиция</th><th>Остаток</th><th class="hide-s">Минимум</th><th style="width:30%">Уровень</th><th class="r">Изменить</th></tr></thead>
          <tbody>${st.stock.map((x) => {
            const lv = Math.min(100, Math.round((x.qty / (x.min * 3)) * 100));
            const isLow = x.qty < x.min;
            return `<tr><td><b>${esc(x.name)}</b> ${isLow ? '<span class="st st-cancelled">Мало</span>' : ''}</td>
              <td class="tnum"><b>${u.num(x.qty)}</b> ${x.unit}</td><td class="tnum muted hide-s">${u.num(x.min)} ${x.unit}</td>
              <td><div class="meter sm ${isLow ? 'low' : ''}"><i style="width:${lv}%"></i></div></td>
              <td class="r"><div class="qty-ctl"><button class="icon-btn sm" data-act="a-stock" data-id="${x.id}" data-d="-${x.step}" aria-label="Списать">${icon('minus')}</button><span class="sm muted tnum">${x.step}</span><button class="icon-btn sm" data-act="a-stock" data-id="${x.id}" data-d="${x.step}" aria-label="Пополнить">${icon('plus')}</button></div></td></tr>`;
          }).join('')}</tbody></table></div>`);
    },
  };
  act['a-stock'] = (el) => s.adjustStock(el.dataset.id, Number(el.dataset.d));
  act['a-store'] = (el) => { const st = s.S().storage; st.used = Math.max(0, Math.min(st.cap, st.used + Number(el.dataset.d))); s.save(); };

  /* ================= Календарь ================= */
  let calDate = null;
  V.adminCalendar = {
    shell: 'admin',
    render() {
      if (!calDate) calDate = u.todayKey();
      const st = s.settings();
      const open = u.toMin(st.open), close = u.toMin(st.close), step = st.step;
      const RH = 46;
      const rows = (close - open) / step;
      const T = u.todayKey();
      const nm = u.nowMin();
      const times = [];
      for (let t = open; t < close; t += step) times.push(t);
      const cols = s.postNumbers().map((p) => {
        const m = s.masterForPost(p);
        const list = s.dayBookings(calDate).filter((b) => b.post === p);
        const used = list.reduce((a, b) => a + b.duration, 0);
        const freeMin = (close - open) - used;
        const cells = times.map((t) => {
          const past = calDate < T || (calDate === T && t + step <= nm);
          const busy = !s.postFree(calDate, p, t, step);
          return `<div class="cg-cell ${t % 60 === 0 ? 'hr' : ''} ${past ? 'past' : ''}" ${!busy && !past && m ? `data-act="a-cal-slot" data-post="${p}" data-time="${u.fromMin(t)}"` : ''}>${!busy && !past && m ? `<span>${icon('plus')}${u.fromMin(t)}</span>` : ''}</div>`;
        }).join('');
        const cards = list.map((b) => {
          const car = s.getCar(b.carId);
          const top = ((u.toMin(b.time) - open) / step) * RH;
          const h = (b.duration / step) * RH;
          const cls = b.status === 'done' ? 's-done' : s.isInWork(b) ? 's-live' : 's-created';
          return `<button class="cg-card ${cls} ${h < 60 ? 'tight' : h < 110 ? 'mid' : ''}" style="top:${top + 2}px;height:${h - 4}px" data-act="a-open" data-id="${b.id}">
            <span class="cg-t tnum">${b.time}</span>
            <b>${esc(s.carName(car))} <span class="tag">${esc(car.size)}</span></b>
            <span class="cg-s">${esc(s.getService(b.serviceId).short)}</span>
            <span class="cg-c">Клиент: ${esc(s.firstName(clientOf(b).name))}</span>
            ${ui.pill(b.status)}
          </button>`;
        }).join('');
        return { head: `<div class="cg-head ${m ? '' : 'off'}"><b>Пост ${p}</b><span>${m ? esc(s.firstName(m.name)) : 'нет мастера'} · свободно ${Math.floor(freeMin / 60)} ч${freeMin % 60 ? ' ' + (freeMin % 60) + ' мин' : ''}</span></div>`, body: `<div class="cg-col ${m ? '' : 'off'}" style="height:${rows * RH}px">${cells}${cards}</div>` };
      });
      const nowTop = calDate === T && nm > open && nm < close ? ((nm - open) / step) * RH : -1;
      const d = u.parseKey(calDate);
      return shell('calendar', 'Календарь', `
        <div class="toolbar">
          <div class="cal-nav">
            <button class="icon-btn" data-act="a-cal-d" data-d="-1" aria-label="Предыдущий день">${icon('chevL')}</button>
            <button class="btn btn-outline btn-sm" data-act="a-cal-d" data-d="0">Сегодня</button>
            <button class="icon-btn" data-act="a-cal-d" data-d="1" aria-label="Следующий день">${icon('chevR')}</button>
            <b class="cal-date">${esc(u.fmtDate(calDate))}, ${u.DOW[d.getDay()]}</b>
            <input type="date" class="input input-sm" value="${calDate}" data-change="a-cal-pick" aria-label="Выбрать дату">
          </div>
          <div class="legend"><span><i class="lg-sw s-created"></i>Запланировано</span><span><i class="lg-sw s-live"></i>В работе</span><span><i class="lg-sw s-done"></i>Готово</span><span><i class="lg-sw s-free"></i>Свободно — нажмите, чтобы записать</span></div>
        </div>
        <div class="cg" style="--rh:${RH}px">
          <div class="cg-in" style="grid-template-columns:60px repeat(${cols.length},minmax(170px,1fr))">
            <div class="cg-head cg-corner"></div>${cols.map((c) => c.head).join('')}
            <div class="cg-times" style="height:${rows * RH}px">${times.map((t) => `<span style="top:${((t - open) / step) * RH}px" class="${t % 60 ? 'half' : ''}">${u.fromMin(t)}</span>`).join('')}</div>
            ${cols.map((c) => c.body).join('')}
            ${nowTop >= 0 ? `<div class="cg-now" style="top:calc(var(--head-h) + ${nowTop}px)"><span>${u.fromMin(nm)}</span></div>` : ''}
          </div>
        </div>`);
    },
    mount(root) {
      if (calDate === u.todayKey()) {
        const box = root.querySelector('.cg');
        const now = root.querySelector('.cg-now');
        if (box && now && !box.dataset.scrolled) { box.scrollTop = Math.max(0, now.offsetTop - 160); box.dataset.scrolled = '1'; }
      }
    },
  };
  act['a-cal-d'] = (el) => { const d = Number(el.dataset.d); calDate = d === 0 ? u.todayKey() : u.addDays(calDate, d); A.render(); };
  act['a-cal-pick'] = (el) => { if (el.value) { calDate = el.value; A.render(); } };
  act['a-cal-slot'] = (el) => newBooking({ date: calDate, time: el.dataset.time, post: Number(el.dataset.post) });

  /* ================= Оплаты ================= */
  let payF = 'all';
  V.adminPayments = {
    shell: 'admin',
    render() {
      const T = u.todayKey();
      const done = s.S().bookings.filter((b) => b.status === 'done');
      const sum = (arr) => arr.reduce((a, b) => a + b.price, 0);
      const since = (n) => done.filter((b) => b.date >= u.addDays(T, -n + 1) && b.date <= T);
      const pending = done.filter((b) => !b.paid);
      const last30 = since(30).filter((b) => b.paid);
      const byM = s.PAY_METHODS.map((pm) => ({ pm, v: sum(last30.filter((b) => b.payMethod === pm)) }));
      const maxM = Math.max(1, ...byM.map((x) => x.v));
      const tot30 = sum(last30) || 1;
      let list = since(30).sort(s.cmpBooking).reverse();
      if (payF === 'pending') list = pending.sort(s.cmpBooking).reverse();
      if (payF === 'paid') list = list.filter((b) => b.paid);
      return shell('payments', 'Оплаты', `
        <div class="kpis">
          ${kpi('Сегодня', money(sum(since(1))), `${since(1).length} ${u.plural(since(1).length, ['заказ', 'заказа', 'заказов'])}`, 'ruble')}
          ${kpi('За 7 дней', money(sum(since(7))), `${since(7).length} заказов`, 'calendar')}
          ${kpi('За 30 дней', money(sum(since(30))), `средний чек ${money(sum(since(30)) / Math.max(1, since(30).length))}`, 'gauge')}
          ${kpi('Ожидает оплаты', money(sum(pending)), `${pending.length} ${u.plural(pending.length, ['заказ', 'заказа', 'заказов'])}`, 'card', pending.length ? 'is-warn' : '')}
        </div>
        <section class="panel">
          <div class="panel-h"><h2>Способы оплаты</h2><span class="muted sm">за 30 дней</span></div>
          <div class="hbars">${byM.map((x) => `<div class="hbar" data-tip="${x.pm}: ${money(x.v)}"><span class="hbar-l">${x.pm}</span><div class="hbar-t"><i style="width:${(x.v / maxM) * 100}%"></i></div><b class="tnum">${Math.round((x.v / tot30) * 100)}%</b><span class="sm muted tnum hide-s">${money(x.v)}</span></div>`).join('')}</div>
        </section>
        <div class="toolbar"><div class="filters">${[['all', 'Все за 30 дней'], ['pending', 'Ожидают'], ['paid', 'Оплачены']].map(([k, l]) => `<button class="fchip ${payF === k ? 'on' : ''}" data-act="a-payf" data-k="${k}">${l}</button>`).join('')}</div></div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Дата</th><th>№</th><th>Клиент</th><th>Услуга</th><th class="r">Сумма</th><th>Способ</th><th>Статус</th></tr></thead><tbody>
          ${list.slice(0, 100).map((b) => `<tr class="click" data-act="a-open" data-id="${b.id}"><td class="tnum">${esc(u.fmtDateShort(b.date))} <span class="muted">${b.time}</span></td><td class="tnum">${b.id}</td><td>${esc(clientOf(b).name)}</td><td>${esc(s.getService(b.serviceId).short)}</td><td class="tnum r"><b>${money(b.price)}</b></td><td>${b.payMethod ? esc(b.payMethod) : '—'}</td><td>${b.paid ? '<span class="st st-done">Оплачено</span>' : `<button class="btn btn-accent btn-sm" data-act="a-pay" data-id="${b.id}">Принять оплату</button>`}</td></tr>`).join('') || `<tr><td colspan="7">${ui.emptyState('card', 'Нет оплат', '')}</td></tr>`}
        </tbody></table></div>`);
    },
  };
  act['a-payf'] = (el) => { payF = el.dataset.k; A.render(); };
  act['a-pay'] = (el, e) => {
    e.stopPropagation();
    const b = s.getBooking(el.dataset.id);
    const m = u.modal({
      title: `Оплата заказа №${b.id}`,
      body: `<div class="pay-sum"><span>К оплате</span><b class="tnum">${money(b.price)}</b><span class="sm muted">${esc(clientOf(b).name)} · ${esc(s.bookingTitle(b))}</span></div><div class="pay-btns">${s.PAY_METHODS.map((pm) => `<button class="btn btn-outline btn-lg" data-pm="${pm}">${icon(pm === 'Наличные' ? 'ruble' : 'card')}${pm}</button>`).join('')}</div>`,
      mount(el2) { el2.querySelectorAll('[data-pm]').forEach((x) => x.onclick = () => { s.markPaid(b.id, x.dataset.pm); m.close(); u.toast(`Оплата ${money(b.price)} принята`, { icon: 'check' }); }); },
    });
  };

  /* ================= Настройки ================= */
  V.adminSettings = {
    shell: 'admin',
    render() {
      const st = s.settings();
      const hours = []; for (let h = 6; h <= 23; h++) hours.push(`${u.pad(h)}:00`);
      return shell('settings', 'Настройки', `
        <div class="settings">
          <section class="panel">
            <div class="panel-h"><h2>Сервис</h2></div>
            <div class="grid2">
              <div class="field"><label>Название</label><input class="input" value="${esc(st.name)}" data-change="a-set" data-k="name"></div>
              <div class="field"><label>Телефон</label><input class="input tnum" data-phone value="${esc(st.phone)}" data-change="a-set" data-k="phone"></div>
              <div class="field"><label>Город</label><input class="input" value="${esc(st.city)}" data-change="a-set" data-k="city"></div>
              <div class="field"><label>Адрес</label><input class="input" value="${esc(st.address)}" data-change="a-set" data-k="address"></div>
            </div>
          </section>
          <section class="panel">
            <div class="panel-h"><h2>Режим работы и запись</h2></div>
            <div class="grid3">
              <div class="field"><label>Открытие</label><select class="input select" data-change="a-set" data-k="open">${hours.map((h) => `<option ${h === st.open ? 'selected' : ''}>${h}</option>`).join('')}</select></div>
              <div class="field"><label>Закрытие</label><select class="input select" data-change="a-set" data-k="close">${hours.map((h) => `<option ${h === st.close ? 'selected' : ''}>${h}</option>`).join('')}</select></div>
              <div class="field"><label>Постов</label><input class="input" value="${st.posts}" disabled></div>
            </div>
            <p class="sm muted" style="margin:0">Шаг онлайн-записи — ${st.step} минут. Клиенты видят только свободное время на постах, где работает мастер.</p>
          </section>
          <section class="panel">
            <div class="panel-h"><h2>Оформление</h2></div>
            <div style="max-width:420px">${A.theme.segment()}</div>
          </section>
          <section class="panel">
            <div class="panel-h"><h2>Уведомления</h2></div>
            <label class="switch-row"><span><b>Уведомлять клиента о статусе</b><span class="sm muted">«Автомобиль принят», «Работа завершена», «Автомобиль готов»</span></span><input type="checkbox" class="switch" data-change="a-set-b" data-k="notifyClient" ${st.notifyClient ? 'checked' : ''}></label>
            <label class="switch-row"><span><b>Напоминание за день до визита</b><span class="sm muted">«Ваша запись завтра в 12:00»</span></span><input type="checkbox" class="switch" checked disabled></label>
            <label class="switch-row"><span><b>Сезонные напоминания</b><span class="sm muted">Перед сменой сезона клиентам, которые попросили напомнить</span></span><input type="checkbox" class="switch" data-change="a-set-b" data-k="remindSeason" ${st.remindSeason ? 'checked' : ''}></label>
          </section>
          <section class="panel">
            <div class="panel-h"><h2>Демо-режим</h2></div>
            <label class="switch-row"><span><b>Живой статус для клиента</b><span class="sm muted">Активный заказ демо-клиента сам переходит на следующий этап каждые ~15 секунд</span></span><input type="checkbox" class="switch" data-change="a-set-b" data-k="demoSim" ${st.demoSim ? 'checked' : ''}></label>
            <div class="li"><div class="grow"><b>Сбросить демо-данные</b><span class="sm muted">Вернуть записи, клиентов и цены к начальному состоянию</span></div><button class="btn btn-outline btn-sm" data-act="reset-demo">${icon('refresh')}Сбросить</button></div>
          </section>
        </div>`);
    },
  };
  act['a-set'] = (el) => {
    const st = s.settings();
    const k = el.dataset.k;
    const v = el.value.trim();
    if (!v) return;
    if ((k === 'open' && v >= st.close) || (k === 'close' && v <= st.open)) { u.toast('Проверьте часы работы', { type: 'error' }); A.render(); return; }
    st[k] = k === 'phone' ? u.formatPhone(v) : v;
    s.save();
    u.toast('Настройки сохранены', { icon: 'check' });
  };
  act['a-set-b'] = (el) => { s.settings()[el.dataset.k] = el.checked; s.save(); };
})(window.App);
