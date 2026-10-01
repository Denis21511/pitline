/* ПитЛайн — анимированный фон: дорожная разметка пит-лейна и световые следы машин.
   Днём — спокойные голубые и тёмно-синие следы, ночью — фары, стоп-сигналы и мерцающие огоньки.
   Цвета плавно перетекают при смене темы, есть параллакс при прокрутке. */
(function (A) {
  'use strict';
  const canvas = document.createElement('canvas');
  canvas.className = 'bg-fx';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');
  const rm = window.matchMedia('(prefers-reduced-motion: reduce)');

  const PAL = {
    light: { lane: [14, 42, 71, 0.08], a: [45, 156, 219, 0.34], b: [14, 42, 71, 0.2], star: [14, 42, 71, 0] },
    dark: { lane: [170, 198, 230, 0.075], a: [90, 185, 240, 0.62], b: [255, 112, 104, 0.5], star: [215, 230, 250, 0.6] },
  };
  const ANG = -0.2;
  let W = 0, H = 0, dpr = 1, diag = 0, gap = 128, lanes = [], stars = [];
  let mix = document.documentElement.dataset.theme === 'dark' ? 1 : 0;
  let target = mix, raf = 0, last = performance.now(), clock = 0;

  const lerp = (a, b, t) => a + (b - a) * t;
  const mixCol = (k) => PAL.light[k].map((v, i) => lerp(v, PAL.dark[k][i], mix));
  const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${Math.max(0, a).toFixed(3)})`;

  function build() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    diag = Math.hypot(W, H);
    gap = W < 700 ? 92 : 124;
    const n = Math.ceil(diag / gap) + 3;
    lanes = [];
    for (let i = 0; i < n; i++) {
      const dir = i % 2 ? -1 : 1;
      const cars = [];
      const count = i % 3 === 0 ? 2 : 1;
      for (let k = 0; k < count; k++) {
        cars.push({ x: (Math.random() - 0.5) * diag * 1.6, v: 45 + Math.random() * 85, len: 70 + Math.random() * 170, kind: dir > 0 ? 'a' : 'b' });
      }
      lanes.push({ y: (i - n / 2) * gap, dir, speed: 14 + ((i * 7) % 19) });
      lanes[i].cars = cars;
    }
    stars = Array.from({ length: Math.round((W * H) / 14000) }, () => ({
      x: Math.random() * W, y: Math.random() * H * 1.3, r: Math.random() * 1.1 + 0.4, p: Math.random() * 6.283, w: 0.5 + Math.random() * 1.5,
    }));
  }

  function draw(dt) {
    const k = document.body.dataset.shell === 'admin' ? 0.6 : 1;
    const sy = window.scrollY || 0;
    const t = clock;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Ночные огоньки
    if (mix > 0.01) {
      const sc = mixCol('star');
      const span = H * 1.3;
      stars.forEach((s) => {
        const a = mix * sc[3] * k * (0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * s.w + s.p)));
        const y = ((s.y - sy * 0.05) % span + span) % span;
        ctx.fillStyle = rgba(sc, a);
        ctx.beginPath(); ctx.arc(s.x, y, s.r, 0, 6.283); ctx.fill();
      });
    }

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(ANG);
    const L = diag / 2 + 260;
    const off = ((sy * 0.15) % gap + gap) % gap;

    // Разметка полос
    const lc = mixCol('lane');
    ctx.strokeStyle = rgba(lc, lc[3] * k);
    ctx.lineWidth = 1.5;
    ctx.setLineDash([22, 30]);
    lanes.forEach((l) => {
      const y = l.y - off;
      ctx.lineDashOffset = -t * l.speed * l.dir;
      ctx.beginPath(); ctx.moveTo(-L, y); ctx.lineTo(L, y); ctx.stroke();
    });
    ctx.setLineDash([]);

    // Световые следы машин
    ctx.lineCap = 'round';
    lanes.forEach((l) => {
      const y = l.y - off + gap / 2;
      l.cars.forEach((c) => {
        c.x += c.v * dt * l.dir;
        if (l.dir > 0 && c.x - c.len > L) c.x = -L - Math.random() * 500;
        if (l.dir < 0 && c.x + c.len < -L) c.x = L + Math.random() * 500;
        const col = mixCol(c.kind);
        const tail = c.x - c.len * l.dir;
        const g = ctx.createLinearGradient(tail, y, c.x, y);
        g.addColorStop(0, rgba(col, 0));
        g.addColorStop(1, rgba(col, col[3] * k));
        ctx.strokeStyle = g;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(tail, y); ctx.lineTo(c.x, y); ctx.stroke();
        ctx.fillStyle = rgba(col, Math.min(1, col[3] * 1.5) * k);
        ctx.beginPath(); ctx.arc(c.x, y, 2.2, 0, 6.283); ctx.fill();
      });
    });
    ctx.restore();
  }

  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    clock += dt;
    mix += (target - mix) * Math.min(1, dt * 3);
    draw(dt);
    if (!rm.matches && !document.hidden) raf = requestAnimationFrame(frame);
    else if (Math.abs(target - mix) > 0.002) raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };

  build();
  draw(0);
  requestAnimationFrame(() => canvas.classList.add('on'));
  kick();

  window.addEventListener('resize', () => { build(); draw(0); kick(); });
  window.addEventListener('scroll', () => { if (rm.matches) draw(0); }, { passive: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
  if (A.theme) A.theme.on((t) => { target = t === 'dark' ? 1 : 0; kick(); });
})(window.App);
