/*
  Wafi Sharif, portfolio
  - Field: the dot-matrix walker in the middle of the home page, plus the
    ripple simulation your cursor drives. Click the walker to push it.
  - Viz: the small animations in the project viewer.
  - Router: hash-based tabs (#/projects, #/about, ...).
  - Terminal on the contact tab.
  Content lives in data.js.
*/
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const TAU = Math.PI * 2;

  /* ==========================================================
     Walker kinematics, shared by the hero and the gait viz.
     Angles are measured from straight down. Positive = forward.
     ========================================================== */
  function walkerPose(phase, S, opts = {}) {
    const lean = 0.07 + (opts.lean || 0);
    const kneeScale = opts.kneeScale == null ? 1 : opts.kneeScale; // < 1 = stiff knee on near leg
    const L = {
      thigh: 0.245 * S,
      shin: 0.245 * S,
      foot: 0.07 * S,
      torso: 0.29 * S,
      neck: 0.035 * S,
      head: 0.066 * S,
      upper: 0.165 * S,
      fore: 0.155 * S,
    };

    const leg = (p, ks) => {
      const hip = 0.42 * Math.sin(p);
      const knee = (0.07 + 0.95 * Math.pow(Math.max(0, Math.cos(p - 0.15)), 3) + 0.18 * Math.pow(Math.max(0, Math.sin(p + 2.3)), 4)) * ks;
      return { hip, knee };
    };

    const legs = [leg(phase, kneeScale), leg(phase + Math.PI, 1)];

    // Hip height comes from whichever foot is lowest, so the stance foot stays planted.
    let drop = 0;
    for (const l of legs) {
      const shinA = l.hip - l.knee;
      const d = L.thigh * Math.cos(l.hip) + L.shin * Math.cos(shinA);
      if (d > drop) drop = d;
    }

    const hip = { x: 0, y: -drop - 0.008 * S };
    const legPts = legs.map((l) => {
      const shinA = l.hip - l.knee;
      const knee = { x: hip.x + L.thigh * Math.sin(l.hip), y: hip.y + L.thigh * Math.cos(l.hip) };
      const ankle = { x: knee.x + L.shin * Math.sin(shinA), y: knee.y + L.shin * Math.cos(shinA) };
      const toe = { x: ankle.x + L.foot * Math.cos(shinA), y: ankle.y - L.foot * Math.sin(shinA) * 0.6 };
      return { knee, ankle, toe, hipA: l.hip, kneeA: l.knee };
    });

    const up = { x: Math.sin(lean), y: -Math.cos(lean) };
    const shoulder = { x: hip.x + L.torso * up.x, y: hip.y + L.torso * up.y };
    const neckTop = { x: shoulder.x + L.neck * up.x, y: shoulder.y + L.neck * up.y };
    const headC = { x: neckTop.x + L.head * up.x * 0.9, y: neckTop.y + L.head * up.y * 0.9 };

    const flail = (opts.lean || 0) * 2.6;
    const arms = [
      { a: -0.38 * Math.sin(phase) - flail, e: 0.38 + 0.22 * Math.max(0, -Math.sin(phase)) + Math.abs(flail) * 0.4 },
      { a: 0.38 * Math.sin(phase) - flail * 0.7, e: 0.38 + 0.22 * Math.max(0, Math.sin(phase)) + Math.abs(flail) * 0.4 },
    ].map((arm) => {
      const elbow = { x: shoulder.x + L.upper * Math.sin(arm.a), y: shoulder.y + L.upper * Math.cos(arm.a) };
      const fa = arm.a + arm.e;
      const wrist = { x: elbow.x + L.fore * Math.sin(fa), y: elbow.y + L.fore * Math.cos(fa) };
      return { elbow, wrist };
    });

    return { L, hip, shoulder, neckTop, headC, legs: legPts, arms, lean };
  }

  // Draws a pose as grayscale strokes. Near limbs are bright, far limbs dim.
  function strokePose(c, P, ox, oy, S, palette) {
    const seg = (a, b, w, col) => {
      c.strokeStyle = col;
      c.lineWidth = w;
      c.beginPath();
      c.moveTo(ox + a.x, oy + a.y);
      c.lineTo(ox + b.x, oy + b.y);
      c.stroke();
    };
    c.lineCap = "round";
    c.lineJoin = "round";
    const far = palette.far,
      near = palette.near,
      body = palette.body;

    // far arm and far leg
    seg(P.shoulder, P.arms[1].elbow, 0.043 * S, far);
    seg(P.arms[1].elbow, P.arms[1].wrist, 0.035 * S, far);
    seg(P.hip, P.legs[1].knee, 0.060 * S, far);
    seg(P.legs[1].knee, P.legs[1].ankle, 0.048 * S, far);
    seg(P.legs[1].ankle, P.legs[1].toe, 0.031 * S, far);

    // torso and head
    seg(P.hip, P.shoulder, 0.081 * S, body);
    seg(P.shoulder, P.neckTop, 0.039 * S, body);
    c.fillStyle = palette.head;
    c.beginPath();
    c.arc(ox + P.headC.x, oy + P.headC.y, P.L.head, 0, TAU);
    c.fill();

    // near leg and near arm
    seg(P.hip, P.legs[0].knee, 0.062 * S, near);
    seg(P.legs[0].knee, P.legs[0].ankle, 0.050 * S, near);
    seg(P.legs[0].ankle, P.legs[0].toe, 0.033 * S, near);
    seg(P.shoulder, P.arms[0].elbow, 0.045 * S, near);
    seg(P.arms[0].elbow, P.arms[0].wrist, 0.037 * S, near);
  }

  /* ==========================================================
     Field: ripple simulation + dot-matrix walker
     ========================================================== */
  const Field = (() => {
    const canvas = $("#field");
    const ctx = canvas.getContext("2d");
    const off = document.createElement("canvas");
    const octx = off.getContext("2d", { willReadFrequently: true });

    let W = 0, H = 0, dpr = 1, cell = 8, cols = 0, rows = 0;
    let cur = new Float32Array(0), prev = new Float32Array(0);
    let mode = "dots";
    let onHome = true;
    let running = true;
    let raf = 0;
    let last = performance.now();
    let introT = 0;
    let lastDrop = 0;
    let hudTimer = 0;

    const pointer = { x: -999, y: -999, gx: -1, gy: -1, has: false };
    const walker = {
      phase: 0,
      omega: 5.0, // rad/s, about 95 steps per minute
      lean: 0,
      leanV: 0,
      scroll: 0,
      size: 0,
      cx: 0,
      ground: 0,
      pose: null,
      bbox: { x0: 0, y0: 0, x1: 0, y1: 0 },
    };

    // Batches so we only switch fill style a handful of times per frame.
    const LEVELS = 7;
    const figB = Array.from({ length: LEVELS }, () => []);
    const wavB = Array.from({ length: LEVELS }, () => []);
    const baseB = [];
    const figCol = [], wavCol = [];
    for (let i = 0; i < LEVELS; i++) {
      const t = (i + 1) / LEVELS;
      figCol.push(`rgba(${Math.round(150 + 90 * t)},${Math.round(200 + 45 * t)},255,${(0.35 + 0.65 * t).toFixed(3)})`);
      wavCol.push(`rgba(${Math.round(70 + 60 * t)},${Math.round(130 + 70 * t)},255,${(0.25 + 0.6 * t).toFixed(3)})`);
    }
    const RAMP = " .:-=+*#%@";

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const narrow = W < 760;
      cell = mode === "type" ? (narrow ? 9 : 11) : narrow ? 5 : 6;
      cols = Math.ceil(W / cell) + 2;
      rows = Math.ceil(H / cell) + 2;
      cur = new Float32Array(cols * rows);
      prev = new Float32Array(cols * rows);
      off.width = cols;
      off.height = rows;
      layout();
    }

    function layout() {
      const narrow = W < 760;
      if (narrow) {
        walker.ground = rows * 0.6;
        walker.size = Math.min(rows * 0.34, cols * 0.8);
      } else {
        walker.ground = rows * 0.66;
        walker.size = Math.min(rows * 0.5, cols * 0.6);
      }
      walker.cx = cols * 0.5;
    }

    function disturb(gx, gy, amp, radius) {
      const r = Math.ceil(radius);
      const x0 = Math.round(gx), y0 = Math.round(gy);
      for (let y = y0 - r; y <= y0 + r; y++) {
        if (y < 1 || y >= rows - 1) continue;
        for (let x = x0 - r; x <= x0 + r; x++) {
          if (x < 1 || x >= cols - 1) continue;
          const d = Math.hypot(x - gx, y - gy);
          if (d > radius) continue;
          const f = 0.5 + 0.5 * Math.cos((d / radius) * Math.PI);
          cur[y * cols + x] += amp * f;
        }
      }
    }

    function stepWaves() {
      const c = cols;
      const damp = 0.972;
      for (let y = 1; y < rows - 1; y++) {
        let i = y * c + 1;
        for (let x = 1; x < c - 1; x++, i++) {
          prev[i] = ((cur[i - 1] + cur[i + 1] + cur[i - c] + cur[i + c]) * 0.5 - prev[i]) * damp;
        }
      }
      const t = cur;
      cur = prev;
      prev = t;
    }

    function updateWalker(dt) {
      // Damped spring pulls the trunk back upright after a push.
      const k = 26, c = 4.2;
      walker.leanV += (-k * walker.lean - c * walker.leanV) * dt;
      walker.lean = clamp(walker.lean + walker.leanV * dt, -0.5, 0.5);
      const hurry = 1 + Math.min(1.2, Math.abs(walker.lean) * 2.2);
      const omega = walker.omega * (reduceMotion ? 0.5 : 1) * hurry;
      walker.phase = (walker.phase + omega * dt) % (TAU * 1000);
      const stride = (0.41 * walker.size) / Math.PI;
      walker.scroll += stride * omega * dt;
      walker.pose = walkerPose(walker.phase, walker.size, { lean: walker.lean });
    }

    function drawWalkerOffscreen() {
      octx.setTransform(1, 0, 0, 1, 0, 0);
      octx.fillStyle = "#000";
      octx.fillRect(0, 0, cols, rows);
      if (!onHome) return;

      const P = walker.pose;
      const S = walker.size;
      const ox = walker.cx, oy = walker.ground;
      const fade = clamp(introT / 1.4, 0, 1);
      const g = (v) => {
        const n = Math.round(v * fade);
        return `rgb(${n},${n},${n})`;
      };

      // Treadmill: dashes that move backward under the feet.
      const half = S * 0.62;
      const gap = 3;
      const shift = walker.scroll % gap;
      for (let x = -half - shift; x < half; x += gap) {
        const edge = 1 - Math.abs(x) / half;
        if (edge <= 0) continue;
        octx.fillStyle = g(150 * edge);
        octx.fillRect(ox + x, oy + 0.5, 1.4, 1);
      }

      strokePose(octx, P, ox, oy, S, {
        far: g(105),
        near: g(255),
        body: g(225),
        head: g(240),
      });

      // screen-space bbox for hit testing
      const pts = [P.headC, P.hip, P.shoulder, P.legs[0].toe, P.legs[1].toe, P.legs[0].ankle, P.legs[1].ankle, P.arms[0].wrist, P.arms[1].wrist];
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const p of pts) {
        x0 = Math.min(x0, p.x);
        y0 = Math.min(y0, p.y);
        x1 = Math.max(x1, p.x);
        y1 = Math.max(y1, p.y);
      }
      const pad = S * 0.12;
      walker.bbox = {
        x0: (ox + x0 - pad - 1) * cell,
        y0: (oy + y0 - P.L.head - pad - 1) * cell,
        x1: (ox + x1 + pad - 1) * cell,
        y1: (oy + y1 + pad - 1) * cell,
      };
    }

    function render() {
      const img = octx.getImageData(0, 0, cols, rows).data;
      ctx.clearRect(0, 0, W, H);

      for (let i = 0; i < LEVELS; i++) {
        figB[i].length = 0;
        wavB[i].length = 0;
      }
      baseB.length = 0;

      const c = cols;
      const half = cell * 0.5;
      const maxD = cell * 0.45;
      const typeMode = mode === "type";

      for (let y = 1; y < rows - 1; y++) {
        for (let x = 1; x < c - 1; x++) {
          const i = y * c + x;
          const f = img[i * 4] / 255;
          const h = cur[i];
          const r = Math.min(1, Math.abs(h) * 0.28);
          const px = x * cell + half - cell;
          const py = y * cell + half - cell;

          if (f < 0.03 && r < 0.03) {
            if ((x + y) % 2 === 0 || !typeMode) baseB.push(px, py);
            continue;
          }

          const dx = clamp((cur[i + 1] - cur[i - 1]) * cell * 0.3, -maxD, maxD);
          const dy = clamp((cur[i + c] - cur[i - c]) * cell * 0.3, -maxD, maxD);
          const fromFig = f >= r * 0.9;
          const v = fromFig ? Math.min(1, f + r * 0.35) : r;
          const lvl = Math.min(LEVELS - 1, Math.floor(v * LEVELS));
          (fromFig ? figB : wavB)[lvl].push(px + dx, py + dy, v);
        }
      }

      // base grid
      ctx.fillStyle = typeMode ? "rgba(120,150,210,0.10)" : "rgba(120,150,210,0.16)";
      const bs = typeMode ? 1.2 : 1;
      for (let j = 0; j < baseB.length; j += 2) ctx.fillRect(baseB[j] - bs / 2, baseB[j + 1] - bs / 2, bs, bs);

      if (typeMode) {
        ctx.font = `500 ${Math.round(cell * 1.08)}px "Geist Mono", ui-monospace, monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const drawSet = (B, cols_) => {
          for (let l = 0; l < LEVELS; l++) {
            const a = B[l];
            if (!a.length) continue;
            ctx.fillStyle = cols_[l];
            for (let j = 0; j < a.length; j += 3) {
              const ch = RAMP[Math.min(RAMP.length - 1, 1 + Math.floor(a[j + 2] * (RAMP.length - 1)))];
              ctx.fillText(ch, a[j], a[j + 1]);
            }
          }
        };
        drawSet(wavB, wavCol);
        drawSet(figB, figCol);
      } else {
        const drawSet = (B, cols_) => {
          for (let l = 0; l < LEVELS; l++) {
            const a = B[l];
            if (!a.length) continue;
            ctx.fillStyle = cols_[l];
            ctx.beginPath();
            for (let j = 0; j < a.length; j += 3) {
              const rad = half * (0.2 + 0.78 * a[j + 2]);
              ctx.moveTo(a[j] + rad, a[j + 1]);
              ctx.arc(a[j], a[j + 1], rad, 0, TAU);
            }
            ctx.fill();
          }
        };
        drawSet(wavB, wavCol);
        drawSet(figB, figCol);
      }

      if (onHome) drawMarkers();
      drawCursor();
    }

    // Motion-capture style markers on the near side, plus the knee angle.
    function drawMarkers() {
      const P = walker.pose;
      if (!P) return;
      const fade = clamp((introT - 0.8) / 1.0, 0, 1);
      if (fade <= 0) return;
      const ox = walker.cx, oy = walker.ground;
      const toScr = (p) => ({ x: (ox + p.x - 1) * cell, y: (oy + p.y - 1) * cell });
      const hip = toScr(P.hip), knee = toScr(P.legs[0].knee), ankle = toScr(P.legs[0].ankle);
      const sh = toScr(P.shoulder), el = toScr(P.arms[0].elbow), wr = toScr(P.arms[0].wrist);

      ctx.save();
      ctx.globalAlpha = fade;
      ctx.strokeStyle = "rgba(255,190,122,0.7)";
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(sh.x, sh.y);
      ctx.lineTo(el.x, el.y);
      ctx.lineTo(wr.x, wr.y);
      ctx.moveTo(sh.x, sh.y);
      ctx.lineTo(hip.x, hip.y);
      ctx.lineTo(knee.x, knee.y);
      ctx.lineTo(ankle.x, ankle.y);
      ctx.stroke();
      ctx.setLineDash([]);

      for (const p of [sh, el, wr, hip, knee, ankle]) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 7, 0, TAU);
        ctx.fillStyle = "rgba(255,190,122,0.18)";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.2, 0, TAU);
        ctx.fillStyle = "#ffc58a";
        ctx.fill();
      }

      // knee angle arc
      const a1 = Math.atan2(hip.y - knee.y, hip.x - knee.x);
      const a2 = Math.atan2(ankle.y - knee.y, ankle.x - knee.x);
      ctx.beginPath();
      ctx.strokeStyle = "rgba(255,190,122,0.8)";
      ctx.lineWidth = 1.2;
      let start = a1, end = a2;
      let diff = end - start;
      while (diff > Math.PI) diff -= TAU;
      while (diff < -Math.PI) diff += TAU;
      ctx.arc(knee.x, knee.y, 20, start, start + diff, diff < 0);
      ctx.stroke();

      const flex = (P.legs[0].kneeA * 180) / Math.PI;
      ctx.font = `500 11px "Geist Mono", ui-monospace, monospace`;
      ctx.fillStyle = "#ffd3a3";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(`knee ${flex.toFixed(0)}°`, knee.x + 26, knee.y);
      ctx.restore();
    }

    function drawCursor() {
      if (!pointer.has) return;
      const g = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, 60);
      g.addColorStop(0, "rgba(255,190,122,0.16)");
      g.addColorStop(1, "rgba(255,190,122,0)");
      ctx.fillStyle = g;
      ctx.fillRect(pointer.x - 60, pointer.y - 60, 120, 120);
    }

    function updateHud() {
      const P = walker.pose;
      if (!P) return;
      const deg = (r) => ((r * 180) / Math.PI).toFixed(1) + "°";
      $("#hud-hip").textContent = deg(P.legs[0].hipA);
      $("#hud-knee").textContent = deg(P.legs[0].kneeA);
      $("#hud-trunk").textContent = deg(P.lean);
      const hurry = 1 + Math.min(1.2, Math.abs(walker.lean) * 2.2);
      const spm = ((walker.omega * (reduceMotion ? 0.5 : 1) * hurry) / TAU) * 120;
      $("#hud-cad").textContent = `${Math.round(spm)} spm`;
      const st = $("#hud-status");
      const recovering = Math.abs(walker.lean) > 0.03 || Math.abs(walker.leanV) > 0.15;
      st.textContent = recovering ? "recovering" : "steady";
      st.classList.toggle("alert", recovering);
    }

    function frame(now) {
      raf = 0;
      if (!running) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      introT += dt;

      // Occasional raindrop so the field never looks dead.
      if (!reduceMotion && now - lastDrop > 2200) {
        lastDrop = now;
        disturb(2 + Math.random() * (cols - 4), 2 + Math.random() * (rows - 4), 3, 2.5);
      }

      stepWaves();
      updateWalker(dt);
      drawWalkerOffscreen();
      render();

      hudTimer += dt;
      if (onHome && hudTimer > 0.1) {
        hudTimer = 0;
        updateHud();
      }
      raf = requestAnimationFrame(frame);
    }

    function start() {
      if (raf) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }

    function stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }

    function toGrid(x, y) {
      return { gx: x / cell + 0.5, gy: y / cell + 0.5 };
    }

    function inWalker(x, y) {
      const b = walker.bbox;
      return onHome && x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
    }

    function onMove(e) {
      const x = e.clientX, y = e.clientY;
      const { gx, gy } = toGrid(x, y);
      if (pointer.has && pointer.gx >= 0) {
        const d = Math.hypot(gx - pointer.gx, gy - pointer.gy);
        const steps = Math.min(40, Math.ceil(d));
        const amp = Math.min(4.5, 0.8 + d * 0.35);
        for (let s = 1; s <= steps; s++) {
          const t = s / steps;
          disturb(pointer.gx + (gx - pointer.gx) * t, pointer.gy + (gy - pointer.gy) * t, amp / Math.max(1, steps * 0.35), 2.2);
        }
      }
      pointer.x = x;
      pointer.y = y;
      pointer.gx = gx;
      pointer.gy = gy;
      pointer.has = e.pointerType !== "touch" || e.buttons > 0;
      document.body.classList.toggle("over-walker", inWalker(x, y));
      canvas.style.cursor = "";
      document.documentElement.style.cursor = inWalker(x, y) ? "pointer" : "";
    }

    function onDown(e) {
      if (e.target.closest("a, button, input, label, .term, .proj-view, .hud, .tabs")) return;
      const { gx, gy } = toGrid(e.clientX, e.clientY);
      if (inWalker(e.clientX, e.clientY)) {
        // Push away from where you clicked.
        const hipX = (walker.cx + walker.pose.hip.x - 1) * cell;
        const dir = e.clientX < hipX ? 1 : -1;
        walker.leanV += dir * 2.6;
        disturb(gx, gy, 14, 4);
        document.dispatchEvent(new CustomEvent("walker:push"));
      } else {
        disturb(gx, gy, 12, 3.6);
      }
    }

    function splash(x, y, amp = 10) {
      const { gx, gy } = toGrid(x, y);
      disturb(gx, gy, amp, 4.5);
    }

    function setMode(m) {
      if (m === mode) return;
      mode = m;
      resize();
    }

    function setHome(v) {
      onHome = v;
    }

    function init() {
      resize();
      window.addEventListener("resize", resize);
      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("pointerdown", onDown);
      window.addEventListener("pointerleave", () => (pointer.has = false));
      document.addEventListener("mouseleave", () => (pointer.has = false));
      document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
      updateWalker(0);
      start();
      // Opening moment: one splash from the center as the walker fades in.
      setTimeout(() => splash(W / 2, H * 0.45, 22), 250);
    }

    return { init, setMode, setHome, splash, get mode() { return mode; } };
  })();

  /* ==========================================================
     Project viewer animations
     ========================================================== */
  const Viz = (() => {
    const canvas = $("#proj-canvas");
    const ctx = canvas.getContext("2d");
    let W = 0, H = 0, raf = 0, active = false, key = "pose", t0 = performance.now(), lastT = 0;
    const MONO = `500 11px "Geist Mono", ui-monospace, monospace`;
    const C = { ice: "#bfe0ff", blue: "#5b9dff", dim: "rgba(141,156,185,0.7)", warm: "#ffbe7a", line: "rgba(140,170,230,0.18)" };

    const label = (txt, x, y, col = C.dim, align = "left") => {
      ctx.font = MONO;
      ctx.fillStyle = col;
      ctx.textAlign = align;
      ctx.textBaseline = "middle";
      ctx.fillText(txt, x, y);
    };
    const ring = (x, y, r = 4, col = C.warm) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fillStyle = "#060c1b";
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = col;
      ctx.stroke();
    };
    const line = (a, b, col, w) => {
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    };

    // Double pendulum state (for Studio Physics)
    const dp = { a1: 2.2, a2: 2.6, w1: 0, w2: 0, trail: [] };

    const scenes = {
      pose(t) {
        // Arm raise with a live shoulder angle, like Kinetra's arm-raise mode.
        const s = Math.min(H / 290, W / 520);
        const cx = W * 0.36, gy = H * 0.9;
        const raise = (Math.sin(t * 1.4) * 0.5 + 0.5) * 2.5; // 0..2.5 rad
        const hip = { x: cx, y: gy - 120 * s };
        const sh = { x: cx, y: hip.y - 78 * s };
        const head = { x: cx, y: sh.y - 26 * s };
        const el = { x: sh.x + Math.sin(raise) * 54 * s, y: sh.y + Math.cos(raise) * 54 * s };
        const wr = { x: el.x + Math.sin(raise + 0.12) * 50 * s, y: el.y + Math.cos(raise + 0.12) * 50 * s };
        const kn = { x: cx + 4 * s, y: gy - 60 * s }, an = { x: cx, y: gy };
        ctx.strokeStyle = C.line;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(W * 0.1, gy + 2);
        ctx.lineTo(W * 0.9, gy + 2);
        ctx.stroke();
        line(hip, kn, "rgba(191,224,255,0.9)", 9 * s);
        line(kn, an, "rgba(191,224,255,0.9)", 8 * s);
        line(hip, sh, "rgba(191,224,255,0.9)", 12 * s);
        ctx.fillStyle = "rgba(191,224,255,0.9)";
        ctx.beginPath();
        ctx.arc(head.x, head.y, 14 * s, 0, TAU);
        ctx.fill();
        line(sh, el, C.ice, 7 * s);
        line(el, wr, C.ice, 6 * s);
        // angle arc
        ctx.strokeStyle = C.warm;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(sh.x, sh.y, 30 * s, Math.PI / 2 - raise, Math.PI / 2, false);
        ctx.stroke();
        [sh, el, wr, hip, kn, an].forEach((p) => ring(p.x, p.y, 4.5));
        const deg = (raise * 180) / Math.PI;
        const bx = W * 0.62;
        label("mode", bx, H * 0.3);
        label("arm raise", bx + 80, H * 0.3, C.ice);
        label("shoulder", bx, H * 0.42);
        label(`${deg.toFixed(1)}°`, bx + 80, H * 0.42, C.warm);
        label("reps", bx, H * 0.54);
        label(String(Math.floor((t * 1.4 + Math.PI / 2) / TAU)), bx + 80, H * 0.54, C.ice);
        label("side", bx, H * 0.66);
        label("right", bx + 80, H * 0.66, C.ice);
      },

      gait(t) {
        // Two simulated walkers: typical gait and a stiff-knee gait.
        const S = Math.min(H * 0.62, W * 0.26);
        const gy = H * 0.8;
        const groups = [
          { x: W * 0.3, ks: 1, name: "typical" },
          { x: W * 0.7, ks: 0.18, name: "stiff knee" },
        ];
        for (const g of groups) {
          const P = walkerPose(t * 4.2, S, { kneeScale: g.ks });
          ctx.save();
          strokePose(ctx, P, g.x, gy, S, {
            far: "rgba(91,157,255,0.45)",
            near: C.ice,
            body: "rgba(191,224,255,0.85)",
            head: "rgba(191,224,255,0.85)",
          });
          ctx.restore();
          const k = { x: g.x + P.legs[0].knee.x, y: gy + P.legs[0].knee.y };
          ring(k.x, k.y, 4);
          label(`knee ${((P.legs[0].kneeA * 180) / Math.PI).toFixed(0)}°`, k.x + 12, k.y, C.warm);
          label(g.name, g.x, gy + 18, C.dim, "center");
          // treadmill dashes
          ctx.fillStyle = "rgba(140,170,230,0.35)";
          const sh = ((t * 4.2 * 0.41 * S) / Math.PI) % 10;
          for (let x = -S * 0.5 - sh; x < S * 0.5; x += 10) ctx.fillRect(g.x + x, gy + 3, 5, 1.5);
        }
      },

      polar(t) {
        // Malus's law: I = I0 cos^2(theta)
        const th = (t * 0.7) % TAU;
        const midY = H * 0.5;
        const p1 = W * 0.2, p2 = W * 0.42;
        const I = Math.cos(th) ** 2;
        // beam
        ctx.strokeStyle = "rgba(191,224,255,0.85)";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(W * 0.04, midY);
        ctx.lineTo(p2, midY);
        ctx.stroke();
        ctx.strokeStyle = `rgba(255,190,122,${0.15 + 0.85 * I})`;
        ctx.lineWidth = 1 + 7 * I;
        ctx.beginPath();
        ctx.moveTo(p2, midY);
        ctx.lineTo(W * 0.56, midY);
        ctx.stroke();
        const disk = (x, ang, name) => {
          ctx.strokeStyle = C.blue;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.ellipse(x, midY, H * 0.07, H * 0.3, 0, 0, TAU);
          ctx.stroke();
          ctx.strokeStyle = C.ice;
          ctx.beginPath();
          ctx.moveTo(x + Math.sin(ang) * H * 0.07, midY - Math.cos(ang) * H * 0.3);
          ctx.lineTo(x - Math.sin(ang) * H * 0.07, midY + Math.cos(ang) * H * 0.3);
          ctx.stroke();
          label(name, x, midY + H * 0.38, C.dim, "center");
        };
        disk(p1, 0, "polarizer");
        disk(p2, th, "analyzer");
        // plot
        const gx = W * 0.62, gw = W * 0.33, gtop = H * 0.2, gh = H * 0.55;
        ctx.strokeStyle = C.line;
        ctx.lineWidth = 1;
        ctx.strokeRect(gx, gtop, gw, gh);
        ctx.strokeStyle = C.blue;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i <= 100; i++) {
          const a = (i / 100) * TAU;
          const x = gx + (i / 100) * gw, y = gtop + gh - Math.cos(a) ** 2 * gh;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
        ring(gx + (th / TAU) * gw, gtop + gh - I * gh, 4);
        label("I / I₀ = cos²θ", gx, gtop - 12, C.ice);
        label(`θ ${((th * 180) / Math.PI).toFixed(0)}°`, gx, gtop + gh + 14);
        label(`I ${I.toFixed(2)}`, gx + gw, gtop + gh + 14, C.warm, "right");
      },

      battery(t) {
        // Lithium ions moving between graphite layers and the cathode.
        const left = W * 0.12, right = W * 0.88, top = H * 0.18, bot = H * 0.82;
        const charging = Math.sin(t * 0.6) > 0;
        const prog = (Math.sin(t * 0.6 - Math.PI / 2) * 0.5 + 0.5);
        // graphite layers
        for (let i = 0; i < 7; i++) {
          const y = top + ((bot - top) * (i + 0.5)) / 7;
          ctx.strokeStyle = "rgba(140,170,230,0.45)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(left, y);
          ctx.lineTo(left + W * 0.22, y);
          ctx.stroke();
        }
        // binder strands
        ctx.strokeStyle = "rgba(255,190,122,0.35)";
        ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          const x0 = left + 8 + i * W * 0.045;
          for (let y = top; y <= bot; y += 6) {
            const x = x0 + Math.sin(y * 0.08 + i) * 5;
            y === top ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        // cathode block
        ctx.strokeStyle = C.blue;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(right - W * 0.18, top, W * 0.18, bot - top);
        // separator
        ctx.setLineDash([4, 5]);
        ctx.strokeStyle = C.line;
        ctx.beginPath();
        ctx.moveTo(W * 0.5, top);
        ctx.lineTo(W * 0.5, bot);
        ctx.stroke();
        ctx.setLineDash([]);
        // ions
        for (let i = 0; i < 18; i++) {
          const seed = i * 12.9898;
          const y = top + ((Math.sin(seed) * 0.5 + 0.5) * 0.9 + 0.05) * (bot - top);
          const lag = (Math.cos(seed * 1.7) * 0.5 + 0.5) * 0.35;
          const p = clamp((prog - lag) / 0.65, 0, 1);
          const ease = p * p * (3 - 2 * p);
          const xa = left + W * 0.04 + (i % 4) * W * 0.05;
          const xb = right - W * 0.15 + (i % 3) * W * 0.05;
          const x = xb + (xa - xb) * ease;
          ctx.beginPath();
          ctx.arc(x, y + Math.sin(t * 3 + i) * 1.5, 3.2, 0, TAU);
          ctx.fillStyle = C.ice;
          ctx.fill();
        }
        label("graphite anode", left, bot + 14);
        label("cathode", right, bot + 14, C.dim, "right");
        label(charging ? "charging" : "discharging", W * 0.5, top - 12, C.warm, "center");
      },

      rbm(t) {
        // Three time steps of an RBM with recurrent links between hidden layers.
        const slices = 3;
        const nh = 5, nv = 7;
        const yh = H * 0.3, yv = H * 0.7;
        const span = W / slices;
        const pos = [];
        for (let s = 0; s < slices; s++) {
          const cx = span * (s + 0.5);
          const w = span * 0.7;
          const hs = [], vs = [];
          for (let i = 0; i < nh; i++) hs.push({ x: cx - w / 2 + (w * (i + 0.5)) / nh, y: yh });
          for (let i = 0; i < nv; i++) vs.push({ x: cx - w / 2 + (w * (i + 0.5)) / nv, y: yv });
          pos.push({ hs, vs, cx });
        }
        ctx.lineWidth = 1;
        for (const p of pos) {
          for (const h of p.hs)
            for (const v of p.vs) {
              ctx.strokeStyle = "rgba(91,157,255,0.12)";
              ctx.beginPath();
              ctx.moveTo(h.x, h.y);
              ctx.lineTo(v.x, v.y);
              ctx.stroke();
            }
        }
        // recurrent arcs
        ctx.strokeStyle = "rgba(255,190,122,0.55)";
        ctx.lineWidth = 1.3;
        for (let s = 0; s < slices - 1; s++) {
          const a = pos[s].hs[nh - 1], b = pos[s + 1].hs[0];
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.quadraticCurveTo((a.x + b.x) / 2, a.y - H * 0.16, b.x, b.y);
          ctx.stroke();
        }
        const node = (p, on) => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 6, 0, TAU);
          ctx.fillStyle = on ? C.ice : "#060c1b";
          ctx.fill();
          ctx.strokeStyle = on ? C.ice : "rgba(140,170,230,0.5)";
          ctx.lineWidth = 1.3;
          ctx.stroke();
        };
        const tick = Math.floor(t * 2.5);
        pos.forEach((p, s) => {
          p.hs.forEach((h, i) => node(h, Math.sin((tick + s * 3) * 1.37 + i * 2.1) > 0.15));
          p.vs.forEach((v, i) => node(v, Math.sin((tick + s * 2) * 0.91 + i * 1.3) > 0.2));
          label(s === 2 ? "t" : s === 1 ? "t-1" : "t-2", p.cx, yv + 24, C.dim, "center");
        });
        label("hidden", 10, yh - 20);
        label("visible", 10, yv - 20);
      },

      storm(t) {
        // Thermospheric density: observed vs model, with a storm spike.
        const gx = W * 0.07, gw = W * 0.86, gtop = H * 0.16, gh = H * 0.62;
        ctx.strokeStyle = C.line;
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
          const y = gtop + (gh * i) / 4;
          ctx.beginPath();
          ctx.moveTo(gx, y);
          ctx.lineTo(gx + gw, y);
          ctx.stroke();
        }
        const f = (x) => {
          const base = 0.3 + 0.06 * Math.sin(x * 0.9) + 0.03 * Math.sin(x * 3.1);
          const ph = ((x % 12) + 12) % 12;
          const storm = ph > 7 ? 0.5 * Math.exp(-((ph - 7.6) ** 2) * 1.6) * (1 - Math.exp(-(ph - 7) * 6)) : 0;
          return base + storm;
        };
        const N = 160;
        const shift = t * 1.1;
        const draw = (fn, col, w, dash) => {
          ctx.strokeStyle = col;
          ctx.lineWidth = w;
          ctx.setLineDash(dash || []);
          ctx.beginPath();
          for (let i = 0; i <= N; i++) {
            const x = shift + (i / N) * 12;
            const px = gx + (i / N) * gw, py = gtop + gh - fn(x) * gh;
            i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
          }
          ctx.stroke();
          ctx.setLineDash([]);
        };
        draw((x) => f(x - 0.08) * 0.97 + 0.01, C.blue, 1.5, [5, 4]);
        draw(f, C.ice, 1.8);
        const nowY = gtop + gh - f(shift + 12) * gh;
        ring(gx + gw, nowY, 4);
        label("observed", gx, gtop - 14, C.ice);
        label("model", gx + 84, gtop - 14, C.blue);
        label("density", gx + gw, gtop - 14, C.dim, "right");
        const ph = (((shift + 12) % 12) + 12) % 12;
        label(ph > 7 && ph < 9.5 ? "storm in progress" : "quiet", gx + gw, gtop + gh + 16, ph > 7 && ph < 9.5 ? C.warm : C.dim, "right");
      },

      pendulum(t, dt) {
        // A real double pendulum, integrated in small steps.
        const g = 9.81, l1 = 1, l2 = 1, m1 = 1, m2 = 1;
        const steps = 8;
        const h = Math.min(dt, 0.033) / steps;
        for (let k = 0; k < steps; k++) {
          const { a1, a2, w1, w2 } = dp;
          const d = a1 - a2;
          const den = 2 * m1 + m2 - m2 * Math.cos(2 * d);
          const al1 = (-g * (2 * m1 + m2) * Math.sin(a1) - m2 * g * Math.sin(a1 - 2 * a2) - 2 * Math.sin(d) * m2 * (w2 * w2 * l2 + w1 * w1 * l1 * Math.cos(d))) / (l1 * den);
          const al2 = (2 * Math.sin(d) * (w1 * w1 * l1 * (m1 + m2) + g * (m1 + m2) * Math.cos(a1) + w2 * w2 * l2 * m2 * Math.cos(d))) / (l2 * den);
          dp.w1 += al1 * h;
          dp.w2 += al2 * h;
          dp.a1 += dp.w1 * h;
          dp.a2 += dp.w2 * h;
        }
        const L = H * 0.22;
        const o = { x: W * 0.5, y: H * 0.42 };
        const p1 = { x: o.x + Math.sin(dp.a1) * L, y: o.y + Math.cos(dp.a1) * L };
        const p2 = { x: p1.x + Math.sin(dp.a2) * L, y: p1.y + Math.cos(dp.a2) * L };
        dp.trail.push(p2);
        if (dp.trail.length > 160) dp.trail.shift();
        for (let i = 1; i < dp.trail.length; i++) {
          ctx.strokeStyle = `rgba(91,157,255,${(i / dp.trail.length) * 0.8})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(dp.trail[i - 1].x, dp.trail[i - 1].y);
          ctx.lineTo(dp.trail[i].x, dp.trail[i].y);
          ctx.stroke();
        }
        line(o, p1, C.ice, 2);
        line(p1, p2, C.ice, 2);
        ring(o.x, o.y, 3, C.dim);
        ctx.fillStyle = C.ice;
        ctx.beginPath();
        ctx.arc(p1.x, p1.y, 7, 0, TAU);
        ctx.fill();
        ctx.fillStyle = C.warm;
        ctx.beginPath();
        ctx.arc(p2.x, p2.y, 7, 0, TAU);
        ctx.fill();
        label("double pendulum", 14, 18, C.dim);
      },

      mri(t) {
        // Stylized knee slice with a scan line and a flagged region.
        const cx = W * 0.42, cy = H * 0.5, s = Math.min(W, H * 2) / 420;
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(cx, cy, 120 * s, H * 0.42, 0, 0, TAU);
        ctx.fillStyle = "rgba(140,170,230,0.06)";
        ctx.fill();
        ctx.clip();
        // femur and tibia
        const bone = (x, y, w, h, r) => {
          ctx.beginPath();
          ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
          ctx.fillStyle = "rgba(191,224,255,0.55)";
          ctx.fill();
        };
        bone(cx - 34 * s, cy - H * 0.6, 68 * s, H * 0.6 - 30 * s, 10 * s);
        ctx.fillStyle = "rgba(191,224,255,0.55)";
        ctx.beginPath();
        ctx.arc(cx - 24 * s, cy - 30 * s, 26 * s, 0, TAU);
        ctx.arc(cx + 24 * s, cy - 30 * s, 26 * s, 0, TAU);
        ctx.fill();
        bone(cx - 52 * s, cy + 8 * s, 104 * s, H * 0.5, 18 * s);
        // cartilage line
        ctx.strokeStyle = "rgba(91,157,255,0.8)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - 54 * s, cy);
        ctx.quadraticCurveTo(cx, cy - 6 * s, cx + 54 * s, cy);
        ctx.stroke();
        // noise texture
        for (let i = 0; i < 260; i++) {
          const a = Math.sin(i * 91.7) * 0.5 + 0.5, b = Math.sin(i * 47.3) * 0.5 + 0.5;
          ctx.fillStyle = `rgba(191,224,255,${0.05 + 0.08 * (Math.sin(i + t * 3) * 0.5 + 0.5)})`;
          ctx.fillRect(cx - 120 * s + a * 240 * s, b * H, 2, 2);
        }
        // scan line
        const sy = ((t * 0.35) % 1) * H;
        const grad = ctx.createLinearGradient(0, sy - 30, 0, sy);
        grad.addColorStop(0, "rgba(91,157,255,0)");
        grad.addColorStop(1, "rgba(91,157,255,0.35)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, sy - 30, W, 30);
        ctx.restore();
        // flagged region
        const on = Math.sin(t * 2) > -0.4;
        if (on) {
          ctx.strokeStyle = C.warm;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 3]);
          ctx.strokeRect(cx + 8 * s, cy - 18 * s, 46 * s, 26 * s);
          ctx.setLineDash([]);
          label("flagged region", cx + 60 * s, cy - 2 * s, C.warm);
        }
        label(`slice ${String(Math.floor(t * 4) % 32 + 1).padStart(2, "0")} / 32`, W - 14, 18, C.dim, "right");
      },
    };

    function size() {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width;
      H = r.height;
      canvas.width = Math.max(1, Math.round(W * dpr));
      canvas.height = Math.max(1, Math.round(H * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function frame(now) {
      raf = 0;
      if (!active) return;
      const t = (now - t0) / 1000;
      const dt = Math.min(0.05, t - lastT);
      lastT = t;
      if (W < 2) size();
      ctx.clearRect(0, 0, W, H);
      (scenes[key] || scenes.pose)(reduceMotion ? t * 0.4 : t, dt);
      raf = requestAnimationFrame(frame);
    }

    function show(k) {
      key = k;
      if (k === "pendulum") {
        dp.a1 = 2.2;
        dp.a2 = 2.6;
        dp.w1 = dp.w2 = 0;
        dp.trail.length = 0;
      }
    }

    function setActive(v) {
      active = v;
      if (v) {
        requestAnimationFrame(() => {
          size();
          if (!raf) raf = requestAnimationFrame(frame);
        });
      } else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    }

    window.addEventListener("resize", () => active && size());
    document.addEventListener("visibilitychange", () => setActive(!document.hidden && document.body.dataset.route === "projects"));

    return { show, setActive };
  })();

  /* ==========================================================
     Content rendering
     ========================================================== */
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    for (const k of kids) if (k != null) n.append(k);
    return n;
  };

  const extLink = (label, url, cls = "btn") =>
    el("a", { class: cls, href: url, target: "_blank", rel: "noopener" }, label);

  const VIZ_TAGS = {
    pose: "joint angle tracking",
    gait: "simulated gait, typical vs stiff knee",
    polar: "Malus's law",
    battery: "ion transport",
    rbm: "temporal RBM, three time steps",
    storm: "density forecast",
    pendulum: "live simulation",
    mri: "knee MRI",
  };

  let currentProject = null;
  let currentFilter = "All";

  function renderFilters() {
    const kinds = ["All", ...new Set(PROJECTS.map((p) => p.kind))];
    const wrap = $("#filters");
    wrap.innerHTML = "";
    for (const k of kinds) {
      const n = k === "All" ? PROJECTS.length : PROJECTS.filter((p) => p.kind === k).length;
      wrap.append(
        el(
          "button",
          {
            type: "button",
            "aria-pressed": String(k === currentFilter),
            onclick: () => {
              currentFilter = k;
              renderFilters();
              renderProjectList();
            },
          },
          k,
          el("span", { class: "count", text: String(n) })
        )
      );
    }
  }

  function renderProjectList() {
    const list = $("#proj-list");
    list.innerHTML = "";
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", "Projects");
    const items = PROJECTS.filter((p) => currentFilter === "All" || p.kind === currentFilter);
    for (const p of items) {
      const btn = el(
        "button",
        {
          type: "button",
          class: "proj-item",
          role: "option",
          "aria-selected": String(currentProject === p.id),
          "data-id": p.id,
          onclick: () => {
            selectProject(p.id, true);
          },
        },
        el("span", { class: "t", text: p.title }),
        el("span", { class: "k", text: p.kind }),
        el("span", { class: "s", text: p.summary })
      );
      list.append(el("li", {}, btn));
    }
    if (!items.some((p) => p.id === currentProject) && items.length) selectProject(items[0].id, false);
  }

  function selectProject(id, fromClick) {
    const p = PROJECTS.find((x) => x.id === id) || PROJECTS[0];
    const changed = currentProject !== p.id;
    currentProject = p.id;

    $$(".proj-item").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.id === p.id)));

    const meta = $("#proj-meta");
    meta.innerHTML = "";
    meta.append(el("span", { class: "tag", text: p.kind }));
    if (p.status) meta.append(el("span", { class: "tag" + (/live|testflight/i.test(p.status) ? " live" : ""), text: p.status }));

    $("#proj-title").textContent = p.title;
    const text = $("#proj-text");
    text.innerHTML = "";
    p.body.forEach((para) => text.append(el("p", { text: para })));

    const stack = $("#proj-stack");
    stack.innerHTML = "";
    p.stack.forEach((s) => stack.append(el("li", { text: s })));

    const links = $("#proj-links");
    links.innerHTML = "";
    p.links.filter((l) => l.url).forEach((l, i) => links.append(extLink(l.label, l.url, i === 0 ? "btn btn-solid" : "btn")));

    $("#proj-tag").textContent = VIZ_TAGS[p.visual] || "";
    Viz.show(p.visual);

    if (changed) {
      const view = $("#proj-view");
      view.classList.remove("swap");
      void view.offsetWidth;
      view.classList.add("swap");
    }

    if (fromClick) {
      history.replaceState(null, "", `#/projects/${p.id}`);
      if (window.innerWidth <= 980) {
        $("#proj-view").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      }
    }
  }

  function renderResearch() {
    const tl = $("#timeline");
    tl.innerHTML = "";
    for (const e of EXPERIENCE) {
      const head = el("div", { class: "tl-head" }, el("span", { class: "tl-where", text: e.where }));
      if (e.when) head.append(el("span", { class: "tl-when", text: e.when }));
      const li = el("li", {}, head, el("p", { class: "tl-what", text: e.what }));
      if (e.project) {
        li.append(el("button", { type: "button", class: "textlink", onclick: () => (location.hash = `#/projects/${e.project}`) }, "Open project"));
      }
      tl.append(li);
    }

    const pl = $("#papers");
    pl.innerHTML = "";
    for (const p of PAPERS) {
      const li = el("li", {}, el("p", { class: "paper-title", text: p.title }), el("p", { class: "paper-note", text: p.note }));
      if (p.url) li.append(el("a", { class: "textlink", href: p.url, target: "_blank", rel: "noopener" }, p.urlLabel || "Link"));
      pl.append(li);
    }
  }

  function renderAbout() {
    const at = $("#about-text");
    at.innerHTML = "";
    ABOUT.paragraphs.forEach((p) => at.append(el("p", { text: p })));
    const nl = $("#now-list");
    nl.innerHTML = "";
    ABOUT.now.forEach((n) => nl.append(el("li", { text: n })));
    const tools = $("#tools");
    tools.innerHTML = "";
    ABOUT.tools.forEach((g) => {
      const dd = el("dd");
      g.items.forEach((i) => dd.append(el("span", { text: i })));
      tools.append(el("div", {}, el("dt", { text: g.group }), dd));
    });
  }

  function renderContact() {
    $("#email-text").textContent = SITE.email;
    const btn = $("#email-btn");
    btn.addEventListener("click", async () => {
      const note = $("#email-note");
      try {
        await navigator.clipboard.writeText(SITE.email);
        btn.classList.add("copied");
        note.textContent = "Copied to clipboard";
      } catch {
        location.href = `mailto:${SITE.email}`;
        note.textContent = "Opening your email app";
      }
      clearTimeout(btn._t);
      btn._t = setTimeout(() => {
        btn.classList.remove("copied");
        note.textContent = "Click to copy";
      }, 2200);
    });

    const ll = $("#link-list");
    ll.innerHTML = "";
    ll.append(el("li", {}, el("a", { href: `mailto:${SITE.email}` }, "Send an email", el("span", { text: "mailto" }))));
    SITE.links
      .filter((l) => l.url)
      .forEach((l) => {
        const host = l.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
        ll.append(el("li", {}, el("a", { href: l.url, target: "_blank", rel: "noopener" }, l.label, el("span", { text: host }))));
      });
  }

  /* ==========================================================
     Terminal
     ========================================================== */
  const Term = (() => {
    const out = $("#term-out");
    const input = $("#term-in");
    const hist = [];
    let hi = 0;

    const print = (txt, cls) => {
      const d = el("div", cls ? { class: cls } : {});
      if (txt instanceof Node) d.append(txt);
      else d.textContent = txt;
      out.append(d);
      out.scrollTop = out.scrollHeight;
    };

    const linkLine = (label, url) => {
      const span = el("span");
      span.append(label + " ");
      span.append(el("a", { href: url, target: "_blank", rel: "noopener" }, url.replace(/^https?:\/\//, "")));
      return span;
    };

    const cmds = {
      help() {
        print(
          [
            "commands",
            "  about        a short intro",
            "  projects     list projects",
            "  open <name>  open a project, like: open kinetra",
            "  research     go to the research tab",
            "  email        copy my email",
            "  github       my GitHub",
            "  links        everywhere else",
            "  walk         back to the walker",
            "  dots, type   switch the hero render style",
            "  clear        clear the screen",
          ].join("\n")
        );
      },
      about() {
        print(ABOUT.paragraphs[0] + " " + SITE.intro);
      },
      whoami() {
        cmds.about();
      },
      ls() {
        cmds.projects();
      },
      projects() {
        print(PROJECTS.map((p) => `  ${p.id.padEnd(14)} ${p.title}`).join("\n"));
        print("type open <name> to see one", "ok");
      },
      open(arg) {
        const q = (arg || "").toLowerCase();
        const p = PROJECTS.find((x) => x.id === q) || PROJECTS.find((x) => x.title.toLowerCase().includes(q) && q);
        if (!p) return print(`no project called "${arg || ""}". try: projects`, "err");
        print(`opening ${p.title}`, "ok");
        setTimeout(() => (location.hash = `#/projects/${p.id}`), 350);
      },
      research() {
        location.hash = "#/research";
      },
      email() {
        navigator.clipboard?.writeText(SITE.email).then(
          () => print(`copied ${SITE.email}`, "ok"),
          () => print(SITE.email)
        ) ?? print(SITE.email);
      },
      github() {
        print(linkLine("github", SITE.github));
      },
      links() {
        SITE.links.filter((l) => l.url).forEach((l) => print(linkLine(l.label.toLowerCase(), l.url)));
      },
      walk() {
        location.hash = "#/";
      },
      dots() {
        setMode("dots");
        print("render style: dots", "ok");
      },
      type() {
        setMode("type");
        print("render style: type", "ok");
      },
      date() {
        print(new Date().toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "full", timeStyle: "short" }) + " in New York");
      },
      clear() {
        out.innerHTML = "";
      },
      sudo() {
        print("nice try", "err");
      },
    };

    function run(raw) {
      const line = raw.trim();
      if (!line) return;
      print(line, "cmd");
      hist.push(line);
      hi = hist.length;
      const [name, ...rest] = line.split(/\s+/);
      const fn = cmds[name.toLowerCase()];
      if (fn) fn(rest.join(" "));
      else print(`command not found: ${name}. type help`, "err");
    }

    function init() {
      print("Hi, I'm Wafi. Type help to see what this can do.");
      print("Try: projects, open kinetra, links, email", "ok");
      $("#term-form").addEventListener("submit", (e) => {
        e.preventDefault();
        run(input.value);
        input.value = "";
      });
      input.addEventListener("keydown", (e) => {
        if (e.key === "ArrowUp" && hist.length) {
          hi = Math.max(0, hi - 1);
          input.value = hist[hi];
          e.preventDefault();
        } else if (e.key === "ArrowDown" && hist.length) {
          hi = Math.min(hist.length, hi + 1);
          input.value = hist[hi] || "";
          e.preventDefault();
        } else if (e.key === "Tab") {
          const v = input.value.trim().toLowerCase();
          const m = Object.keys(cmds).filter((k) => k.startsWith(v));
          if (v && m.length === 1) {
            input.value = m[0] + " ";
            e.preventDefault();
          }
        }
      });
      $("#term").addEventListener("click", (e) => {
        if (!e.target.closest("a")) input.focus({ preventScroll: true });
      });
    }

    return { init };
  })();

  /* ==========================================================
     Hero mode switch
     ========================================================== */
  function setMode(m) {
    Field.setMode(m);
    $$(".seg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === m)));
  }

  /* ==========================================================
     Router
     ========================================================== */
  const ROUTES = ["home", "projects", "research", "about", "contact"];
  const TITLES = {
    home: "Wafi Sharif",
    projects: "Projects | Wafi Sharif",
    research: "Research | Wafi Sharif",
    about: "About | Wafi Sharif",
    contact: "Contact | Wafi Sharif",
  };
  let currentRoute = null;

  function parseHash() {
    const h = location.hash.replace(/^#\/?/, "");
    const [r, sub] = h.split("/");
    return { route: ROUTES.includes(r) ? r : "home", sub: sub || null };
  }

  function movePill(animate = true) {
    const pill = $(".tabs-pill");
    const active = $(`.tabs a[aria-current="page"]`);
    if (!active) return;
    if (!animate) pill.style.transition = "none";
    pill.style.width = active.offsetWidth + "px";
    pill.style.transform = `translateX(${active.offsetLeft}px)`;
    if (!animate) {
      void pill.offsetWidth;
      pill.style.transition = "";
    }
  }

  function route(initial = false) {
    const { route: r, sub } = parseHash();
    const changed = r !== currentRoute;

    if (changed) {
      $$(".panel").forEach((p) => {
        const on = p.dataset.panel === r;
        p.hidden = !on;
        p.classList.remove("entering");
        if (on && !initial) {
          void p.offsetWidth;
          p.classList.add("entering");
        }
      });
      $$(".tabs a").forEach((a) => {
        if (a.dataset.link === r) a.setAttribute("aria-current", "page");
        else a.removeAttribute("aria-current");
      });
      document.body.dataset.route = r;
      document.title = TITLES[r];
      movePill(!initial);
      window.scrollTo(0, 0);
      Field.setHome(r === "home");
      Viz.setActive(r === "projects");
      currentRoute = r;
    }

    if (r === "projects") {
      if (sub && PROJECTS.some((p) => p.id === sub)) {
        const p = PROJECTS.find((x) => x.id === sub);
        if (currentFilter !== "All" && p.kind !== currentFilter) {
          currentFilter = "All";
          renderFilters();
          renderProjectList();
        }
        selectProject(sub, false);
        if (!changed && window.innerWidth <= 980) $("#proj-view").scrollIntoView({ block: "start" });
      } else if (!currentProject) {
        selectProject(PROJECTS[0].id, false);
      }
    }
  }

  /* ==========================================================
     Small things: clock, hint, keys
     ========================================================== */
  function startClock() {
    const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });
    const tick = () => ($("#clock").textContent = `New York ${fmt.format(new Date())}`);
    tick();
    setInterval(tick, 15000);
  }

  function setupHint() {
    const hint = $("#hero-hint");
    if (window.matchMedia("(hover: none)").matches) {
      hint.textContent = "Drag to make ripples. Tap the walker to give it a push.";
    }
    let moved = 0;
    const done = () => hint.classList.add("gone");
    const onMove = (e) => {
      moved += Math.abs(e.movementX || 0) + Math.abs(e.movementY || 0);
      if (moved > 600) {
        setTimeout(done, 2500);
        window.removeEventListener("pointermove", onMove);
      }
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("walker:push", () => setTimeout(done, 1500), { once: true });
  }

  function setupKeys() {
    document.addEventListener("keydown", (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target.closest("input, textarea, [contenteditable]")) return;
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= ROUTES.length) {
        const r = ROUTES[n - 1];
        location.hash = r === "home" ? "#/" : `#/${r}`;
      }
    });
  }

  /* ==========================================================
     Boot
     ========================================================== */
  function boot() {
    $("#hero-intro").textContent = SITE.intro;
    $("#year").textContent = new Date().getFullYear();

    renderFilters();
    renderProjectList();
    renderResearch();
    renderAbout();
    renderContact();
    Term.init();

    $$(".seg button").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));

    Field.init();
    route(true);
    window.addEventListener("hashchange", () => route(false));
    window.addEventListener("resize", () => movePill(false));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => movePill(false));

    window.addEventListener(
      "scroll",
      () => document.body.classList.toggle("scrolled", window.scrollY > 8),
      { passive: true }
    );

    startClock();
    setupHint();
    setupKeys();
  }

  boot();
})();
