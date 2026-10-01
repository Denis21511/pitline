/* ПитЛайн — экран мастера: текущая работа на посту и очередь на сегодня */
(function (A) {
  'use strict';
  const u = A.u, s = A.store, ui = A.ui;
  const { esc, icon, money } = u;
  const act = A.act, V = A.views;

  let mid = null;
  try { mid = localStorage.getItem('pitline_master'); } catch (e) { /* ignore */ }

  V.master = {
    shell: 'master',
    render(p) {
      const masters = s.S().masters;
      if (p.m) mid = p.m;
      if (!masters.find((m) => m.id === mid)) mid = (masters.find((m) => m.post === 2) || masters[0]).id;
      const m = s.getMaster(mid);
      const ms = A.masterState(m);
      const job = ms.cur || null;
      const queue = ms.mine.slice().sort(s.cmpBooking);
      const done = queue.filter((b) => b.status === 'done').length;
      const jobCard = (b, isCur) => {
        const car = s.getCar(b.carId), sv = s.getService(b.serviceId), c = s.getClient(b.clientId);
        const n = s.nextStatus(b);
        return `<section class="card job ${isCur ? 'is-cur' : ''}">
          <div class="job-top"><span class="${isCur ? 'live-badge' : 'muted sm'}">${isCur ? '<i></i>Текущая работа' : 'Следующий автомобиль'}</span><span class="muted sm tnum">№ ${b.id} · ${b.time}–${u.fromMin(u.toMin(b.time) + b.duration)}</span></div>
          <h2 class="job-car">${esc(s.carName(car))} <span class="tag lg">${esc(car.size)}</span></h2>
          ${car.plate ? `<span class="plate">${esc(car.plate)}</span>` : ''}
          <div class="job-grid">
            <div><span class="lbl">Услуга</span><b>${esc(sv.name)}</b></div>
            <div><span class="lbl">Колёс</span><b>${b.wheels}${car.runflat ? ' · Run-flat' : ''}</b></div>
            <div><span class="lbl">Доп. работы</span><b>${b.extras.length ? b.extras.map((x) => s.EXTRAS.find((e) => e.id === x).name).join(', ') : '—'}</b></div>
            <div><span class="lbl">Клиент</span><b>${esc(s.firstName(c.name))}</b></div>
          </div>
          ${isCur ? ui.tracker(b) : ''}
          ${n ? `<button class="btn btn-primary btn-lg btn-block" data-act="m-next" data-id="${b.id}">${isCur ? `${icon('arrowR')}Следующий этап: ${esc(s.statusShort(n))}` : `${icon('car')}Принять автомобиль`}</button>` : ''}
          ${isCur && n && n !== 'done' ? `<button class="btn btn-ghost btn-block" data-act="m-finish" data-id="${b.id}">${icon('check')}Сразу завершить работу</button>` : ''}
        </section>`;
      };
      const content = `
        <div class="m-pick">${masters.filter((x) => x.onShift).map((x) => `<button class="chip ${x.id === mid ? 'on' : ''}" data-act="m-pick" data-id="${x.id}">${esc(s.firstName(x.name))}${x.post ? ` · П${x.post}` : ''}</button>`).join('')}</div>
        <div class="m-hero">
          <span class="avatar lg">${esc(u.initials(m.name))}</span>
          <div class="grow"><h1>${esc(m.name)}</h1><div class="m-sub">${m.post ? `Пост №${m.post}` : 'Пост не назначен'} · <span class="mstate ${ms.key}"><i></i>${ms.label}</span></div></div>
        </div>
        <div class="stats3"><div><b class="tnum">${queue.length}</b><span>на сегодня</span></div><div><b class="tnum">${done}</b><span>выполнено</span></div><div><b class="tnum">${queue.filter((b) => b.status === 'created').length}</b><span>в очереди</span></div></div>
        ${job ? jobCard(job, true) : ms.next ? jobCard(ms.next, false) : ui.emptyState('check', 'Работ на сегодня больше нет', 'Новые записи появятся здесь автоматически')}
        <div class="sec-h"><h2>Очередь на сегодня</h2></div>
        <div class="queue">${queue.map((b) => {
          const car = s.getCar(b.carId);
          return `<div class="q-item ${b.status === 'done' ? 'is-done' : ''} ${s.isInWork(b) ? 'is-live' : ''}"><span class="q-t tnum">${b.time}</span><div class="grow"><b>${esc(s.carName(car))} <span class="tag">${esc(car.size)}</span></b><span class="sm muted">${esc(s.getService(b.serviceId).short)}${b.extras.includes('balance') ? ' + балансировка' : ''}</span></div>${ui.pill(b.status)}</div>`;
        }).join('') || '<p class="muted">Записей нет</p>'}</div>`;
      return `<div class="c-shell m-shell">
        <header class="c-header"><div class="c-header-in">
          <div class="c-header-l"><a href="#/master" class="c-logo">${u.logo('Мастер')}</a></div>
          <div class="c-header-r">${A.theme.button()}<a class="btn btn-ghost btn-sm" href="#/admin">${icon('grid')}<span class="hide-s">Кабинет</span></a></div>
        </div></header>
        <main class="c-main">${content}</main>
      </div>`;
    },
  };
  act['m-pick'] = (el) => { mid = el.dataset.id; try { localStorage.setItem('pitline_master', mid); } catch (e) { /* ignore */ } A.render(); };
  act['m-next'] = (el) => {
    const b = s.getBooking(el.dataset.id);
    const n = s.nextStatus(b);
    if (!n) return;
    s.setStatus(b.id, n);
    u.toast(`${s.statusLabel(n)} — клиент получил уведомление`, { icon: 'check' });
  };
  act['m-finish'] = (el) => { s.setStatus(el.dataset.id, 'done'); u.toast('Работа завершена — клиент получил уведомление', { icon: 'check' }); };
})(window.App);
