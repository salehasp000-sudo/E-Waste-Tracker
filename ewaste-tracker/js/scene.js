/* ==========================================================================
   E-Waste Tracker — 3D scenes (Three.js r128)
   Any <canvas data-scene="name"> on the page is mounted automatically.
   Scenes: globe (home), cube (register), scan (track), chain (lifecycle),
           swap (transfer), bars (dashboard), shield (admin).
   Each scene pauses when off-screen or when the tab is hidden, honours
   prefers-reduced-motion, and falls back to a static ring if WebGL is missing.
   ========================================================================== */
(function () {
  'use strict';

  const COL = { deep: 0x14574a, trace: 0x2fb992, gold: 0xe0b45a, goldDeep: 0x8a6a22, mist: 0xcfe9df };
  const CAMERA_Z = { globe: 11, cube: 7, scan: 6.5, chain: 9, swap: 8, bars: 9, shield: 8 };
  const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const instances = {};

  const std = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({ color: color, metalness: 0.45, roughness: 0.4 }, extra || {}));
  const lines = (color, opacity) => new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: opacity });

  function device(kind) {
    const grp = new THREE.Group();
    let geo;
    if (kind === 'chip') geo = new THREE.BoxGeometry(0.46, 0.46, 0.09);
    else if (kind === 'phone') geo = new THREE.BoxGeometry(0.3, 0.56, 0.05);
    else if (kind === 'battery') geo = new THREE.CylinderGeometry(0.13, 0.13, 0.46, 20);
    else geo = new THREE.BoxGeometry(0.62, 0.4, 0.05);
    grp.add(new THREE.Mesh(geo, std(0x1c3f39, { metalness: 0.5, roughness: 0.35 })));
    grp.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: COL.gold })));
    return grp;
  }

  function dust(count, rMin, rMax, size) {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = rMin + Math.random() * (rMax - rMin);
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      pos[i * 3 + 2] = r * Math.cos(ph);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return new THREE.Points(geo, new THREE.PointsMaterial({ color: COL.mist, size: size, transparent: true, opacity: 0.55, sizeAttenuation: true }));
  }

  /* ---------- Scene builders: (root) => { update(t, dt), setValues? } ---------- */
  const BUILD = {
    // Home: recycling core with devices in orbit
    globe(root) {
      const g = new THREE.Group(); root.add(g);
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 1), std(COL.deep, { flatShading: true, emissive: 0x06251f }));
      const shell = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(1.8, 2)), lines(COL.trace, 0.45));
      const nodes = new THREE.Points(new THREE.IcosahedronGeometry(1.8, 1), new THREE.PointsMaterial({ color: COL.gold, size: 0.1 }));
      g.add(core, shell, nodes);

      const specs = [
        { r: 2.7, tilt: [0.45, 0, 0.25], speed: 0.42, kinds: ['chip', 'battery'] },
        { r: 3.35, tilt: [-0.75, 0, 0.45], speed: -0.3, kinds: ['phone', 'laptop'] },
        { r: 4.0, tilt: [1.15, 0, -0.35], speed: 0.2, kinds: ['chip', 'phone', 'battery'] }
      ];
      const orbits = specs.map((s) => {
        const holder = new THREE.Group();
        holder.rotation.set(s.tilt[0], s.tilt[1], s.tilt[2]);
        g.add(holder);
        const pts = [];
        for (let i = 0; i <= 128; i++) { const a = (i / 128) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * s.r, 0, Math.sin(a) * s.r)); }
        holder.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lines(COL.mist, 0.16)));
        const items = s.kinds.map((k, i) => { const d = device(k); holder.add(d); return { d: d, phase: (i / s.kinds.length) * Math.PI * 2 }; });
        return { s: s, items: items, angle: 0 };
      });
      const stars = dust(window.innerWidth < 700 ? 240 : 520, 5, 9, 0.035);
      root.add(stars);

      return {
        update(t, dt) {
          core.rotation.y += dt * 0.25;
          core.scale.setScalar(1 + Math.sin(t * 1.4) * 0.025);
          shell.rotation.y -= dt * 0.08; nodes.rotation.y = shell.rotation.y;
          stars.rotation.y += dt * 0.01;
          orbits.forEach((o) => {
            o.angle += o.s.speed * dt;
            o.items.forEach((it) => {
              const a = o.angle + it.phase;
              it.d.position.set(Math.cos(a) * o.s.r, 0, Math.sin(a) * o.s.r);
              it.d.rotation.x += dt * 0.8; it.d.rotation.y += dt * 0.6;
            });
          });
        }
      };
    },

    // Register: a lattice of data blocks that breathes
    cube(root) {
      const g = new THREE.Group(); root.add(g);
      const geo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
      const edges = new THREE.EdgesGeometry(geo);
      const cells = [];
      for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
        const gold = (x + y + z + 3) % 2 === 0;
        const m = new THREE.Mesh(geo, std(gold ? COL.goldDeep : COL.deep, { transparent: true, opacity: 0.92 }));
        m.add(new THREE.LineSegments(edges, lines(gold ? COL.gold : COL.trace, 0.8)));
        g.add(m);
        cells.push({ m: m, x: x, y: y, z: z });
      }
      return {
        update(t, dt) {
          g.rotation.y += dt * 0.4;
          g.rotation.x = 0.5 + Math.sin(t * 0.4) * 0.15;
          const k = 1.22 + 0.16 * Math.sin(t * 1.2);
          cells.forEach((c) => {
            c.m.position.set(c.x * 0.5 * k, c.y * 0.5 * k, c.z * 0.5 * k);
            c.m.scale.setScalar(0.85 + 0.15 * Math.sin(t * 2 + c.x + c.y * 2 + c.z * 3));
          });
        }
      };
    },

    // Track: a torus knot under a scanning beam
    scan(root) {
      const knot = new THREE.Group(); root.add(knot);
      knot.add(new THREE.Mesh(new THREE.TorusKnotGeometry(1, 0.28, 140, 18), std(COL.deep, { flatShading: false })));
      knot.add(new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.TorusKnotGeometry(1.03, 0.31, 60, 10)), lines(COL.trace, 0.4)));
      const beam = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.04), new THREE.MeshBasicMaterial({ color: COL.gold, transparent: true, opacity: 0.95, side: THREE.DoubleSide }));
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.6), new THREE.MeshBasicMaterial({ color: COL.gold, transparent: true, opacity: 0.12, side: THREE.DoubleSide }));
      root.add(beam, glow);
      return {
        update(t, dt) {
          knot.rotation.y += dt * 0.35; knot.rotation.x = Math.sin(t * 0.3) * 0.3;
          const y = Math.sin(t * 1.4) * 1.5;
          beam.position.y = y; glow.position.y = y;
        }
      };
    },

    // Lifecycle: seven stages lighting up in order
    chain(root) {
      const g = new THREE.Group(); root.add(g);
      const N = 7, pos = [], nodes = [], mats = [], rings = [];
      for (let i = 0; i < N; i++) pos.push(new THREE.Vector3((i - 3) * 0.95, Math.sin(i * 0.95) * 0.55, Math.cos(i * 0.95) * 0.7));
      pos.forEach((p) => {
        const m = std(COL.deep, { emissive: 0x000000 });
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 16), m);
        s.position.copy(p); g.add(s); nodes.push(s); mats.push(m);
        const r = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.015, 8, 40), new THREE.MeshBasicMaterial({ color: COL.gold, transparent: true, opacity: 0.55 }));
        r.position.copy(p); g.add(r); rings.push(r);
      });
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pos), lines(COL.trace, 0.75)));
      let last = -1;
      return {
        update(t) {
          const active = Math.floor(t * 0.9) % N;
          if (active !== last) {
            last = active;
            mats.forEach((m, i) => { m.color.setHex(i < active ? COL.trace : i === active ? COL.gold : COL.deep); m.emissive.setHex(i === active ? 0x3a2a06 : 0x000000); });
          }
          nodes.forEach((n, i) => { const target = i === active ? 1.5 : 1; n.scale.setScalar(n.scale.x + (target - n.scale.x) * 0.12); });
          rings.forEach((r, i) => { r.rotation.y = t * (0.8 + i * 0.1); r.rotation.x = t * 0.4; });
          g.rotation.y = Math.sin(t * 0.3) * 0.5;
        }
      };
    },

    // Transfer: a data block handed from one owner to the next
    swap(root) {
      const g = new THREE.Group(); root.add(g);
      const mk = (x, color) => {
        const grp = new THREE.Group(); grp.position.x = x;
        grp.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 1), std(color, { flatShading: true })));
        grp.add(new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(1.08, 1)), lines(COL.mist, 0.35)));
        g.add(grp); return grp;
      };
      const A = mk(-2, COL.deep), B = mk(2, COL.goldDeep);
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-2, 0, 0), new THREE.Vector3(2, 0, 0)]), lines(COL.trace, 0.35)));
      const packet = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), std(COL.gold, { emissive: 0x4a3608 }));
      g.add(packet);
      return {
        update(t, dt) {
          A.rotation.y += dt * 0.5; B.rotation.y -= dt * 0.5; A.rotation.x += dt * 0.15; B.rotation.x += dt * 0.15;
          const p = (Math.sin(t * 1.1) + 1) / 2, e = p * p * (3 - 2 * p);
          packet.position.set(-2 + 4 * e, Math.sin(Math.PI * e) * 0.9, 0);
          packet.rotation.x = t * 2; packet.rotation.y = t * 1.4;
          g.rotation.y = Math.sin(t * 0.4) * 0.35;
        }
      };
    },

    // Dashboard: a bar field that reacts to real totals via setValues([...4])
    bars(root) {
      const g = new THREE.Group(); root.add(g); g.rotation.x = 0.55;
      const geo = new THREE.BoxGeometry(0.5, 1, 0.5);
      const palette = [COL.trace, COL.gold, 0x1c8a6c, 0x7fb5a5];
      const bars = [];
      for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) {
        const m = new THREE.Mesh(geo, std(palette[r]));
        m.position.set((c - 2) * 0.75, 0, (r - 1.5) * 0.8);
        g.add(m); bars.push({ m: m, r: r, c: c, h: 0.2 });
      }
      let values = [1, 0.62, 0.4, 0.22];
      return {
        setValues(v) { const max = Math.max.apply(null, v.concat([1])); values = v.map((x) => Math.max(0.08, x / max)); },
        update(t, dt) {
          g.rotation.y += dt * 0.22;
          bars.forEach((b) => {
            const target = values[b.r] * 2.4 * (0.7 + 0.3 * Math.abs(Math.sin(b.c * 1.3 + b.r))) + Math.sin(t * 1.6 + b.c * 0.8 + b.r) * 0.08;
            b.h += (target - b.h) * 0.06;
            b.m.scale.y = Math.max(0.05, b.h);
            b.m.position.y = b.h / 2 - 0.9;
          });
        }
      };
    },

    // Admin: a keyed core inside rotating rings
    shield(root) {
      const g = new THREE.Group(); root.add(g);
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 0), std(COL.goldDeep, { flatShading: true, emissive: 0x2a1f06 }));
      const oct = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.OctahedronGeometry(1.45, 1)), lines(COL.trace, 0.5));
      g.add(core, oct);
      const rings = [1.9, 2.3, 2.7].map((r, i) => {
        const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.018, 8, 96), new THREE.MeshBasicMaterial({ color: i === 1 ? COL.gold : COL.trace, transparent: true, opacity: 0.6 }));
        g.add(m); return m;
      });
      return {
        update(t, dt) {
          core.rotation.y += dt * 0.6; core.rotation.x += dt * 0.3;
          oct.rotation.y -= dt * 0.2; oct.rotation.z += dt * 0.1;
          rings[0].rotation.x = t * 0.5; rings[1].rotation.y = t * 0.4; rings[1].rotation.x = 1.1; rings[2].rotation.z = t * 0.3; rings[2].rotation.x = 0.6;
        }
      };
    }
  };

  /* ---------- Stage: renderer, camera, resize, pointer, loop ---------- */
  function mount(canvas, variant) {
    if (!canvas) return null;
    const stage = canvas.parentElement;
    if (typeof THREE === 'undefined' || !BUILD[variant]) { stage.classList.add('no-webgl'); return null; }

    let renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: 'low-power' }); }
    catch (e) { stage.classList.add('no-webgl'); return null; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    const baseZ = CAMERA_Z[variant] || 8;
    camera.position.set(0, 0, baseZ);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const key = new THREE.DirectionalLight(0xffffff, 0.9); key.position.set(4, 5, 6); scene.add(key);
    const rim = new THREE.PointLight(COL.trace, 1.3, 30); rim.position.set(-5, -2, 4); scene.add(rim);

    const root = new THREE.Group(); scene.add(root);
    const api = BUILD[variant](root);

    function resize() {
      const r = stage.getBoundingClientRect();
      const w = Math.max(1, Math.floor(r.width)), h = Math.max(1, Math.floor(r.height));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.position.z = baseZ * (camera.aspect >= 1 ? 1 : 1 + (1 - camera.aspect) * 0.9);
      camera.updateProjectionMatrix();
      if (reduce) renderer.render(scene, camera);
    }
    if (window.ResizeObserver) new ResizeObserver(resize).observe(stage); else window.addEventListener('resize', resize);
    resize();

    let tx = 0, ty = 0, px = 0, py = 0, t = 0, last = performance.now(), raf = 0, inView = true;

    if (reduce) { api.update(2.5, 0); renderer.render(scene, camera); return Object.assign({ renderer: renderer }, api); }

    window.addEventListener('pointermove', (e) => { tx = (e.clientX / window.innerWidth - 0.5) * 2; ty = (e.clientY / window.innerHeight - 0.5) * 2; }, { passive: true });

    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      px += (tx - px) * 0.05; py += (ty - py) * 0.05;
      root.rotation.y = px * 0.35; root.rotation.x = py * 0.2;
      api.update(t, dt);
      renderer.render(scene, camera);
    }
    function play() { if (!raf && inView && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } }
    function pause() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

    if (window.IntersectionObserver) {
      new IntersectionObserver((entries) => { inView = entries[0].isIntersecting; inView ? play() : pause(); }, { threshold: 0.01 }).observe(stage);
    }
    document.addEventListener('visibilitychange', () => (document.hidden ? pause() : play()));
    play();

    return Object.assign({ renderer: renderer }, api);
  }

  function mountAll() {
    document.querySelectorAll('canvas[data-scene]').forEach((c) => {
      const inst = mount(c, c.dataset.scene);
      if (inst && c.id) instances[c.id] = inst;
    });
  }

  window.EWScene = { mount: mount, instances: instances };
  mountAll();
})();
