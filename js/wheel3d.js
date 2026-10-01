/* ПитЛайн — компактная 3D-визуализация колеса (Three.js r128).
   Режимы: idle, spin (балансировка), puncture (прокол), rim (диск отдельно), swap (сезонная замена). */
(function (A) {
  'use strict';
  let inst = null;

  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  function build() {
    const T = window.THREE;
    const canvas = document.createElement('canvas');
    canvas.className = 'wheel-canvas';
    let renderer;
    try {
      renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch (e) { return null; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.setClearColor(0x000000, 0);

    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(30, 2, 0.1, 100);
    camera.position.set(0, 0.5, 8);
    camera.lookAt(0, -0.75, 0);

    scene.add(new T.HemisphereLight(0xffffff, 0x8f9bab, 0.7));
    const key = new T.DirectionalLight(0xffffff, 0.85); key.position.set(3, 4, 6); scene.add(key);
    const back = new T.DirectionalLight(0xdcecff, 0.45); back.position.set(-5, 2, -3); scene.add(back);

    /* ---- Материалы ---- */
    const mTire = new T.MeshStandardMaterial({ color: 0x15181d, roughness: 0.88, metalness: 0, side: T.DoubleSide });
    const mTread = new T.MeshStandardMaterial({ color: 0x0e1013, roughness: 0.95 });
    const mWinter = new T.MeshStandardMaterial({ color: 0x101216, roughness: 0.95 });
    const mRim = new T.MeshStandardMaterial({ color: 0xc8d0da, roughness: 0.35, metalness: 0.35, side: T.DoubleSide });
    const mRimDark = new T.MeshStandardMaterial({ color: 0x59636f, roughness: 0.55, metalness: 0.3, side: T.DoubleSide });
    const mCap = new T.MeshStandardMaterial({ color: 0x0e2a47, roughness: 0.4, metalness: 0.2 });
    const mAccent = new T.MeshBasicMaterial({ color: 0x2d9cdb, transparent: true, opacity: 0 });
    const mWeight = new T.MeshStandardMaterial({ color: 0x2d9cdb, roughness: 0.4, metalness: 0.2, transparent: true, opacity: 0 });
    const mLip = new T.MeshStandardMaterial({ color: 0xc8d0da, roughness: 0.3, metalness: 0.35, emissive: 0x2d9cdb, emissiveIntensity: 0 });

    /* ---- Иерархия: root (перемещение) → yaw (ракурс) → holders (разнесение) → spin (вращение) ---- */
    const root = new T.Group(); scene.add(root);
    const yaw = new T.Group(); root.add(yaw);
    const tireHolder = new T.Group(); const rimHolder = new T.Group();
    yaw.add(tireHolder); yaw.add(rimHolder);
    const tireSpin = new T.Group(); const rimSpin = new T.Group();
    tireHolder.add(tireSpin); rimHolder.add(rimSpin);

    /* Шина: профиль вращения */
    const R = 1.25, r = 0.86, W = 0.42;
    // посадочное кольцо → боковина → плечо → протектор → плечо → боковина
    const prof = [new T.Vector2(r, -W * 0.82)];
    const sh = 0.16;
    prof.push(new T.Vector2(R - sh * 1.4, -W));
    for (let i = 0; i <= 8; i++) { const a = -Math.PI / 2 + (i / 8) * (Math.PI / 2); prof.push(new T.Vector2(R - sh + Math.cos(a) * sh, -W + sh + Math.sin(a) * sh)); }
    for (let i = 0; i <= 8; i++) { const a = (i / 8) * (Math.PI / 2); prof.push(new T.Vector2(R - sh + Math.cos(a) * sh, W - sh + Math.sin(a) * sh)); }
    prof.push(new T.Vector2(R - sh * 1.4, W));
    prof.push(new T.Vector2(r, W * 0.82));
    prof.push(new T.Vector2(r - 0.01, 0));
    prof.push(new T.Vector2(r, -W * 0.82));
    const tireGeo = new T.LatheGeometry(prof, 96);
    tireGeo.rotateX(Math.PI / 2);
    const tire = new T.Mesh(tireGeo, mTire);
    tireSpin.add(tire);

    /* Протектор: летний (крупные блоки) и зимний (мелкие ламели + шипы) */
    const dummy = new T.Object3D();
    function treadSet(kind) {
      const g = new T.Group();
      if (kind === 'summer') {
        const n = 44;
        const blk = new T.BoxGeometry(0.16, 0.05, 0.2);
        const im = new T.InstancedMesh(blk, mTread, n * 3);
        let k = 0;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          [-0.25, 0, 0.25].forEach((z, j) => {
            const aa = a + (j === 1 ? Math.PI / n : 0);
            dummy.position.set(Math.cos(aa) * (R + 0.012), Math.sin(aa) * (R + 0.012), z);
            dummy.rotation.set(0, 0, aa + Math.PI / 2);
            dummy.scale.set(j === 1 ? 0.7 : 1, 1, j === 1 ? 0.8 : 1);
            dummy.updateMatrix();
            im.setMatrixAt(k++, dummy.matrix);
          });
        }
        g.add(im);
      } else {
        const n = 60;
        const blk = new T.BoxGeometry(0.1, 0.055, 0.12);
        const im = new T.InstancedMesh(blk, mWinter, n * 4);
        let k = 0;
        for (let i = 0; i < n; i++) {
          [-0.3, -0.1, 0.1, 0.3].forEach((z, j) => {
            const aa = (i / n) * Math.PI * 2 + (j % 2 ? Math.PI / n : 0);
            dummy.position.set(Math.cos(aa) * (R + 0.014), Math.sin(aa) * (R + 0.014), z);
            dummy.rotation.set(0, 0, aa + Math.PI / 2 + (j < 2 ? 0.35 : -0.35));
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            im.setMatrixAt(k++, dummy.matrix);
          });
        }
        g.add(im);
        const stud = new T.CylinderGeometry(0.018, 0.018, 0.04, 6);
        const ims = new T.InstancedMesh(stud, mRim, 36);
        for (let i = 0; i < 36; i++) {
          const aa = (i / 36) * Math.PI * 2;
          const z = (i % 3 - 1) * 0.2;
          dummy.position.set(Math.cos(aa) * (R + 0.05), Math.sin(aa) * (R + 0.05), z);
          dummy.rotation.set(0, 0, aa - Math.PI / 2);
          dummy.updateMatrix();
          ims.setMatrixAt(i, dummy.matrix);
        }
        g.add(ims);
      }
      return g;
    }
    const summer = treadSet('summer'); const winter = treadSet('winter');
    winter.visible = false;
    tireSpin.add(summer); tireSpin.add(winter);

    /* Диск */
    const rim = new T.Group();
    rimSpin.add(rim);
    const barrel = new T.Mesh(new T.CylinderGeometry(r - 0.02, r - 0.02, W * 1.6, 64, 1, true), mRimDark);
    barrel.rotation.x = Math.PI / 2; rim.add(barrel);
    const lipF = new T.Mesh(new T.TorusGeometry(r - 0.005, 0.035, 12, 72), mLip); lipF.position.z = W * 0.8; rim.add(lipF);
    const lipB = new T.Mesh(new T.TorusGeometry(r - 0.005, 0.03, 10, 72), mRimDark); lipB.position.z = -W * 0.8; rim.add(lipB);
    const face = new T.Mesh(new T.RingGeometry(r - 0.17, r - 0.02, 72), mRim); face.position.z = W * 0.72; rim.add(face);
    const inner = new T.Mesh(new T.CircleGeometry(r - 0.04, 48), new T.MeshStandardMaterial({ color: 0x2a3038, roughness: 0.8 })); inner.position.z = -0.05; rim.add(inner);
    const spokeGeo = new T.BoxGeometry(0.15, r - 0.26, 0.07);
    for (let i = 0; i < 5; i++) {
      const s = new T.Mesh(spokeGeo, mRim);
      const a = (i / 5) * Math.PI * 2;
      s.position.set(Math.sin(a) * (r - 0.13) / 2 + Math.sin(a) * 0.12, Math.cos(a) * (r - 0.13) / 2 + Math.cos(a) * 0.12, W * 0.62);
      s.rotation.z = -a;
      rim.add(s);
    }
    const hub = new T.Mesh(new T.CylinderGeometry(0.24, 0.27, 0.16, 40), mRim); hub.rotation.x = Math.PI / 2; hub.position.z = W * 0.62; rim.add(hub);
    const cap = new T.Mesh(new T.CylinderGeometry(0.11, 0.11, 0.05, 32), mCap); cap.rotation.x = Math.PI / 2; cap.position.z = W * 0.72; rim.add(cap);
    const nutGeo = new T.CylinderGeometry(0.03, 0.03, 0.05, 6);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + Math.PI / 5;
      const n = new T.Mesh(nutGeo, mRimDark);
      n.rotation.x = Math.PI / 2;
      n.position.set(Math.sin(a) * 0.17, Math.cos(a) * 0.17, W * 0.72);
      rim.add(n);
    }
    /* Балансировочные грузики */
    const weights = new T.Group();
    [0.4, 2.2].forEach((a, i) => {
      const wgt = new T.Mesh(new T.BoxGeometry(0.16, 0.05, 0.08), mWeight);
      wgt.position.set(Math.cos(a) * (r - 0.06), Math.sin(a) * (r - 0.06), i ? -0.1 : 0.12);
      wgt.rotation.z = a + Math.PI / 2;
      weights.add(wgt);
    });
    rim.add(weights);

    /* Зона прокола — на протекторе с правой стороны (угол 0) */
    const punct = new T.Group();
    const patch = new T.Mesh(new T.CircleGeometry(0.17, 32), mAccent);
    patch.rotation.y = Math.PI / 2; patch.position.set(R + 0.075, 0, 0.04);
    const ringGeo = new T.TorusGeometry(0.24, 0.014, 8, 48);
    const ringMat = new T.MeshBasicMaterial({ color: 0x2d9cdb, transparent: true, opacity: 0 });
    const ring = new T.Mesh(ringGeo, ringMat);
    ring.rotation.y = Math.PI / 2; ring.position.set(R + 0.08, 0, 0.04);
    const nail = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 0.14, 8), new T.MeshStandardMaterial({ color: 0x9aa4ae, metalness: 0.6, roughness: 0.3, transparent: true, opacity: 0 }));
    nail.rotation.z = Math.PI / 2; nail.position.set(R + 0.07, 0.02, 0.06);
    punct.add(patch, ring, nail);
    tireSpin.add(punct);

    /* Мягкая тень */
    const sc = document.createElement('canvas'); sc.width = sc.height = 128;
    const g2 = sc.getContext('2d');
    const grd = g2.createRadialGradient(64, 64, 4, 64, 64, 64);
    grd.addColorStop(0, 'rgba(14,42,71,0.30)'); grd.addColorStop(1, 'rgba(14,42,71,0)');
    g2.fillStyle = grd; g2.fillRect(0, 0, 128, 128);
    const shadow = new T.Mesh(new T.PlaneGeometry(3.4, 0.9), new T.MeshBasicMaterial({ map: new T.CanvasTexture(sc), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = -1.32;
    scene.add(shadow);

    /* ---- Состояние анимации ---- */
    const st = {
      mode: 'idle', modeAt: performance.now(),
      yaw: -0.5, tireX: 0, rimX: 0, tireZ: 0, angle: 0, speed: 0.4, wOpacity: 0, pOpacity: 0, lip: 0,
      winter: false, onSwap: null,
    };
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function setMode(mode) {
      if (mode === st.mode) return;
      st.mode = mode; st.modeAt = performance.now();
      root.position.x = 0;
    }

    let raf = 0, last = performance.now(), ro = null;
    function frame(t) {
      raf = 0;
      if (!canvas.isConnected) return; // экран закрыт — останавливаемся
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      const k = 1 - Math.pow(0.001, dt); // сглаживание
      const m = st.mode;
      const el = (t - st.modeAt) / 1000;
      const sp = reduce ? 0.35 : 1;

      let tYaw = -0.5, tTireX = 0, tRimX = 0, tTireZ = 0, tSpeed = 0.35, tW = 0, tP = 0, tLip = 0;
      if (m === 'idle') { tYaw = -0.55 + Math.sin(t / 2600) * 0.18; tSpeed = 0.35; }
      if (m === 'spin') { tYaw = -0.42; tSpeed = 9; tW = 1; }
      if (m === 'puncture') { tYaw = -1.05; tSpeed = 0; tP = 1; }
      if (m === 'rim') { tYaw = -0.62; tSpeed = 0.5; tTireX = 1.45; tRimX = -1.25; tTireZ = -0.6; tLip = 0.55 + Math.sin(t / 380) * 0.35; }
      if (m === 'swap') { tYaw = -0.18; tSpeed = 0; }

      st.yaw = lerp(st.yaw, tYaw, k * 0.9);
      st.tireX = lerp(st.tireX, tTireX, k * 0.7);
      st.tireZ = lerp(st.tireZ, tTireZ, k * 0.7);
      st.rimX = lerp(st.rimX, tRimX, k * 0.7);
      st.speed = lerp(st.speed, tSpeed * sp, k * (m === 'spin' ? 0.25 : 0.8));
      st.wOpacity = lerp(st.wOpacity, tW, k);
      st.pOpacity = lerp(st.pOpacity, tP, k);
      st.lip = lerp(st.lip, tLip, k);

      if (m === 'puncture') {
        // доворачиваем колесо так, чтобы зона прокола смотрела на зрителя
        const target = Math.round(st.angle / (Math.PI * 2)) * Math.PI * 2;
        st.angle = lerp(st.angle, target, k * 0.8);
      } else if (m === 'swap') {
        // цикл: выкатывание → смена комплекта → закатывание → пауза
        const cyc = 4.8, ph = (el % cyc), D = 6.6;
        let x = 0;
        if (ph < 1.1) x = -D * ease(ph / 1.1);
        else if (ph < 1.2) { x = D; if (!st.flipped) { st.winter = !st.winter; st.flipped = true; st.onSwap && st.onSwap(st.winter); } }
        else if (ph < 2.4) { x = D * (1 - ease((ph - 1.2) / 1.2)); }
        else x = 0;
        if (ph >= 2.4) st.flipped = false;
        const dx = x - root.position.x;
        root.position.x = x;
        st.angle -= dx / R;
      } else {
        st.angle += st.speed * dt;
      }
      if (m !== 'swap') root.position.x = lerp(root.position.x, 0, k);

      yaw.rotation.y = st.yaw;
      // разнесение шины и диска задаём в мировых координатах, независимо от ракурса
      const cy = Math.cos(st.yaw), sy = Math.sin(st.yaw);
      tireHolder.position.set(st.tireX * cy - st.tireZ * sy, 0, st.tireX * sy + st.tireZ * cy);
      rimHolder.position.set(st.rimX * cy, 0, st.rimX * sy);
      tireSpin.rotation.z = st.angle; rimSpin.rotation.z = st.angle;
      summer.visible = !st.winter; winter.visible = st.winter;
      mWeight.opacity = st.wOpacity; weights.visible = st.wOpacity > 0.02;
      const pulse = 0.5 + Math.sin(t / 260) * 0.5;
      mAccent.opacity = st.pOpacity * (0.45 + pulse * 0.4);
      ringMat.opacity = st.pOpacity * (1 - pulse) * 0.9;
      ring.scale.setScalar(0.7 + pulse * 0.6);
      nail.material.opacity = st.pOpacity; punct.visible = st.pOpacity > 0.02;
      mLip.emissiveIntensity = st.lip;
      shadow.position.x = root.position.x;
      shadow.scale.x = 1 + Math.abs(st.tireX) * 0.6;

      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    }
    function resize() {
      const p = canvas.parentElement;
      if (!p) return;
      const w = p.clientWidth, h = p.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.fov = w / h < 1.6 ? 36 : 30;
      camera.updateProjectionMatrix();
    }
    function attach(slot) {
      if (!slot) return;
      if (canvas.parentElement !== slot) slot.prepend(canvas);
      resize();
      if (ro) ro.disconnect();
      if (window.ResizeObserver) { ro = new ResizeObserver(resize); ro.observe(slot); }
      last = performance.now();
      if (!raf) raf = requestAnimationFrame(frame);
    }
    return { canvas, attach, setMode, onSwap(fn) { st.onSwap = fn; }, isWinter: () => st.winter };
  }

  A.wheel = {
    attach(slot, mode) {
      if (!window.THREE) { slot && slot.classList.add('no3d'); return null; }
      if (!inst) inst = build();
      if (!inst) { slot && slot.classList.add('no3d'); return null; }
      inst.attach(slot);
      if (mode) inst.setMode(mode);
      return inst;
    },
    setMode(mode) { if (inst) inst.setMode(mode); },
    onSwap(fn) { if (inst) inst.onSwap(fn); },
    isWinter() { return inst ? inst.isWinter() : false; },
  };
})(window.App);
