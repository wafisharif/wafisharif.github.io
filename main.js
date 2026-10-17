/*
  Wafi Sharif, portfolio
  - Field: the dotted walker on the home page. Moving the cursor leaves a
    small ripple, and clicking the walker gives it a light push.
  - Router: hash-based tabs (#/projects, #/about, ...).
  All text lives in data.js.
*/
(() => {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const TAU = Math.PI * 2;

  /* ---------- walker pose (angles from straight down, + is forward) ---------- */
  function walkerPose(phase, S, leanExtra) {
    const lean = 0.06 + leanExtra;
    const L = {
      thigh: 0.245 * S, shin: 0.245 * S, foot: 0.07 * S, torso: 0.29 * S,
      neck: 0.035 * S, head: 0.066 * S, upper: 0.165 * S, fore: 0.155 * S,
    };

    const leg = (p) => ({
      hip: 0.4 * Math.sin(p),
      knee: 0.07 + 0.9 * Math.pow(Math.max(0, Math.cos(p - 0.15)), 3),
    });
    const legs = [leg(phase), leg(phase + Math.PI)];

    let drop = 0;
    for (const l of legs) {
      const d = L.thigh * Math.cos(l.hip) + L.shin * Math.cos(l.hip - l.knee);
      if (d > drop) drop = d;
    }

    const hip = { x: 0, y: -drop - 0.008 * S };
    const legPts = legs.map((l) => {
      const s = l.hip - l.knee;
      const knee = { x: L.thigh * Math.sin(l.hip), y: hip.y + L.thigh * Math.cos(l.hip) };
      const ankle = { x: knee.x + L.shin * Math.sin(s), y: knee.y + L.shin * Math.cos(s) };
      const toe = { x: ankle.x + L.foot * Math.cos(s), y: ankle.y - L.foot * Math.sin(s) * 0.6 };
      return { knee, ankle, toe };
    });

    const up = { x: Math.sin(lean), y: -Math.cos(lean) };
    const shoulder = { x: hip.x + L.torso * up.x, y: hip.y + L.torso * up.y };
    const neckTop = { x: shoulder.x + L.neck * up.x, y: shoulder.y + L.neck * up.y };
    const headC = { x: neckTop.x + L.head * up.x * 0.9, y: neckTop.y + L.head * up.y * 0.9 };

    const flail = leanExtra * 2.4;
    const arms = [
      { a: -0.35 * Math.sin(phase) - flail, e: 0.4 + Math.abs(flail) * 0.4 },
      { a: 0.35 * Math.sin(phase) - flail * 0.7, e: 0.4 + Math.abs(flail) * 0.4 },
    ].map(({ a, e }) => {
      const elbow = { x: shoulder.x + L.upper * Math.sin(a), y: shoulder.y + L.upper * Math.cos(a) };
      const wrist = { x: elbow.x + L.fore * Math.sin(a + e), y: elbow.y + L.fore * Math.cos(a + e) };
      return { elbow, wrist };
    });

    return { L, hip, shoulder, neckTop, headC, legs: legPts, arms };
  }

  /* ---------- the field ---------- */
  const Field = (() => {
    const canvas = $("#field");
    const ctx = canvas.getContext("2d");
    const off = document.createElement("canvas");
    const octx = off.getContext("2d", { willReadFrequently: true });

    let W = 0, H = 0, cell = 7, cols = 0, rows = 0;
    let cur = new Float32Array(0), prev = new Float32Array(0);
    let visible = true, raf = 0, last = performance.now(), age = 0;
    const ptr = { gx: -1, gy: -1 };
    const walker = { phase: 0, lean: 0, leanV: 0, size: 0, cx: 0, ground: 0, pose: null, box: null };

    const LEVELS = 5;
    const buckets = Array.from({ length: LEVELS }, () => []);
    const colors = Array.from({ length: LEVELS }, (_, i) => `rgba(190,214,255,${(0.25 + 0.75 * ((i + 1) / LEVELS)).toFixed(2)})`);

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const narrow = W < 640;
      cell = narrow ? 6 : 7;
      cols = Math.ceil(W / cell) + 2;
      rows = Math.ceil(H / cell) + 2;
      cur = new Float32Array(cols * rows);
      prev = new Float32Array(cols * rows);
      off.width = cols;
      off.height = rows;
      walker.cx = cols * 0.5;
      walker.ground = rows * (narrow ? 0.56 : 0.62);
      walker.size = narrow ? Math.min(rows * 0.3, cols * 0.7) : Math.min(rows * 0.4, cols * 0.5);
    }

    function disturb(gx, gy, amp, radius) {
      const r = Math.ceil(radius);
      for (let y = Math.round(gy) - r; y <= Math.round(gy) + r; y++) {
        if (y < 1 || y >= rows - 1) continue;
        for (let x = Math.round(gx) - r; x <= Math.round(gx) + r; x++) {
          if (x < 1 || x >= cols - 1) continue;
          const d = Math.hypot(x - gx, y - gy);
          if (d <= radius) cur[y * cols + x] += amp * (0.5 + 0.5 * Math.cos((d / radius) * Math.PI));
        }
      }
    }

    function stepWaves() {
      const c = cols;
      for (let y = 1; y < rows - 1; y++) {
        let i = y * c + 1;
        for (let x = 1; x < c - 1; x++, i++) {
          prev[i] = ((cur[i - 1] + cur[i + 1] + cur[i - c] + cur[i + c]) * 0.5 - prev[i]) * 0.93;
        }
      }
      const t = cur;
      cur = prev;
      prev = t;
    }

    function update(dt) {
      walker.leanV += (-26 * walker.lean - 4.5 * walker.leanV) * dt;
      walker.lean = clamp(walker.lean + walker.leanV * dt, -0.35, 0.35);
      const speed = (reduceMotion ? 2.5 : 4.6) * (1 + Math.min(0.8, Math.abs(walker.lean) * 2));
      walker.phase = (walker.phase + speed * dt) % (TAU * 1000);
      walker.pose = walkerPose(walker.phase, walker.size, walker.lean);
    }

    function drawWalker() {
      octx.fillStyle = "#000";
      octx.fillRect(0, 0, cols, rows);
      const P = walker.pose, S = walker.size, ox = walker.cx, oy = walker.ground;
      const fade = clamp(age / 1.2, 0, 1);
      const g = (v) => {
        const n = Math.round(v * fade);
        return `rgb(${n},${n},${n})`;
      };
      const seg = (a, b, w, col) => {
        octx.strokeStyle = col;
        octx.lineWidth = w * S;
        octx.beginPath();
        octx.moveTo(ox + a.x, oy + a.y);
        octx.lineTo(ox + b.x, oy + b.y);
        octx.stroke();
      };
      octx.lineCap = "round";
      octx.lineJoin = "round";

      const far = g(90), near = g(235), body = g(210);
      seg(P.shoulder, P.arms[1].elbow, 0.042, far);
      seg(P.arms[1].elbow, P.arms[1].wrist, 0.035, far);
      seg(P.hip, P.legs[1].knee, 0.06, far);
      seg(P.legs[1].knee, P.legs[1].ankle, 0.048, far);
      seg(P.legs[1].ankle, P.legs[1].toe, 0.032, far);
      seg(P.hip, P.shoulder, 0.08, body);
      seg(P.shoulder, P.neckTop, 0.04, body);
      octx.fillStyle = body;
      octx.beginPath();
      octx.arc(ox + P.headC.x, oy + P.headC.y, P.L.head, 0, TAU);
      octx.fill();
      seg(P.hip, P.legs[0].knee, 0.062, near);
      seg(P.legs[0].knee, P.legs[0].ankle, 0.05, near);
      seg(P.legs[0].ankle, P.legs[0].toe, 0.033, near);
      seg(P.shoulder, P.arms[0].elbow, 0.045, near);
      seg(P.arms[0].elbow, P.arms[0].wrist, 0.037, near);

      // hit box in screen pixels
      const pad = S * 0.12;
      walker.box = {
        x0: (ox - S * 0.3 - pad - 1) * cell,
        x1: (ox + S * 0.3 + pad - 1) * cell,
        y0: (oy - S - pad - 1) * cell,
        y1: (oy + pad - 1) * cell,
      };
    }

    function render() {
      const img = octx.getImageData(0, 0, cols, rows).data;
      ctx.clearRect(0, 0, W, H);
      for (const b of buckets) b.length = 0;

      ctx.fillStyle = "rgba(140,165,215,0.09)";
      const c = cols;
      for (let y = 1; y < rows - 1; y++) {
        for (let x = 1; x < c - 1; x++) {
          const i = y * c + x;
          const f = img[i * 4] / 255;
          const r = Math.min(0.5, Math.abs(cur[i]) * 0.6);
          const v = Math.max(f, r);
          const px = (x - 0.5) * cell, py = (y - 0.5) * cell;
          if (v < 0.04) {
            ctx.fillRect(px - 0.5, py - 0.5, 1, 1);
            continue;
          }
          buckets[Math.min(LEVELS - 1, Math.floor(v * LEVELS))].push(px, py, v);
        }
      }

      const half = cell * 0.5;
      buckets.forEach((a, l) => {
        if (!a.length) return;
        ctx.fillStyle = colors[l];
        ctx.beginPath();
        for (let j = 0; j < a.length; j += 3) {
          const rad = half * (0.15 + 0.6 * a[j + 2]);
          ctx.moveTo(a[j] + rad, a[j + 1]);
          ctx.arc(a[j], a[j + 1], rad, 0, TAU);
        }
        ctx.fill();
      });
    }

    function frame(now) {
      raf = 0;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      age += dt;
      stepWaves();
      update(dt);
      drawWalker();
      render();
      if (visible && !document.hidden) raf = requestAnimationFrame(frame);
    }

    function start() {
      if (raf || !visible || document.hidden) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }

    function setVisible(v) {
      visible = v;
      if (v) start();
    }

    function onMove(e) {
      if (!visible) return;
      const gx = e.clientX / cell + 0.5, gy = e.clientY / cell + 0.5;
      if (ptr.gx >= 0) {
        const d = Math.hypot(gx - ptr.gx, gy - ptr.gy);
        if (d > 0.5 && d < 60) {
          const steps = Math.ceil(d);
          const amp = Math.min(0.7, 0.15 + d * 0.04) / steps;
          for (let s = 1; s <= steps; s++) {
            const t = s / steps;
            disturb(ptr.gx + (gx - ptr.gx) * t, ptr.gy + (gy - ptr.gy) * t, amp * 2, 1.3);
          }
        }
      }
      ptr.gx = gx;
      ptr.gy = gy;
      const b = walker.box;
      const over = b && e.clientX > b.x0 && e.clientX < b.x1 && e.clientY > b.y0 && e.clientY < b.y1;
      document.documentElement.style.cursor = over ? "pointer" : "";
    }

    function onDown(e) {
      if (!visible || e.target.closest("a, button")) return;
      const b = walker.box;
      if (b && e.clientX > b.x0 && e.clientX < b.x1 && e.clientY > b.y0 && e.clientY < b.y1) {
        const hipX = (walker.cx - 1) * cell;
        walker.leanV += (e.clientX < hipX ? 1 : -1) * 1.8;
      }
    }

    function init() {
      resize();
      update(0);
      window.addEventListener("resize", resize);
      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("pointerdown", onDown);
      document.addEventListener("visibilitychange", start);
      start();
    }

    return { init, setVisible };
  })();

  /* ---------- content ---------- */
  const el = (tag, props = {}, ...kids) => {
    const n = document.createElement(tag);
    Object.assign(n, props);
    for (const k of kids) if (k != null) n.append(k);
    return n;
  };
  const ext = (label, url) => el("a", { href: url, target: "_blank", rel: "noopener", textContent: label });

  function renderProjects() {
    const list = $("#projects");
    for (const p of PROJECTS) {
      const summary = el(
        "summary", {},
        el("span", { className: "t", textContent: p.title }),
        el("span", { className: "k", textContent: p.status || p.kind }),
        el("span", { className: "s", textContent: p.summary })
      );
      const body = el("div", { className: "body" });
      p.body.forEach((t) => body.append(el("p", { textContent: t })));
      body.append(el("div", { className: "meta", textContent: p.stack.join(", ") }));
      const links = p.links.filter((l) => l.url);
      if (links.length) body.append(el("div", { className: "links-inline" }, ...links.map((l) => ext(l.label, l.url))));
      const details = el("details", { id: `p-${p.id}` }, summary, body);
      list.append(el("li", {}, details));
    }
  }

  function renderResearch() {
    const ex = $("#experience");
    for (const e of EXPERIENCE) {
      ex.append(
        el("li", {},
          el("div", { className: "row-head" }, el("b", { textContent: e.where }), e.when ? el("span", { textContent: e.when }) : null),
          el("p", { textContent: e.what })
        )
      );
    }
    const pl = $("#papers");
    for (const p of PAPERS) {
      const li = el("li", {}, el("div", { className: "row-head" }, el("b", { textContent: p.title })), el("p", { textContent: p.note }));
      if (p.url) li.append(el("p", {}, ext(p.urlLabel || "Link", p.url)));
      pl.append(li);
    }
  }

  function renderAbout() {
    ABOUT.paragraphs.forEach((t) => $("#about-text").append(el("p", { textContent: t })));
    ABOUT.now.forEach((t) => $("#now-list").append(el("li", { textContent: t })));
    ABOUT.tools.forEach((g) =>
      $("#tools").append(el("div", {}, el("dt", { textContent: g.group }), el("dd", { textContent: g.items.join(", ") })))
    );
  }

  function renderContact() {
    const email = $("#email");
    email.href = `mailto:${SITE.email}`;
    email.textContent = SITE.email;
    SITE.links
      .filter((l) => l.url)
      .forEach((l) => {
        const host = l.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
        $("#links").append(el("li", {}, ext(l.label, l.url), el("span", { textContent: host })));
      });
  }

  /* ---------- router ---------- */
  const ROUTES = ["home", "projects", "research", "about", "contact"];

  function route() {
    const [r0, sub] = location.hash.replace(/^#\/?/, "").split("/");
    const r = ROUTES.includes(r0) ? r0 : "home";
    $$(".panel").forEach((p) => (p.hidden = p.dataset.panel !== r));
    $$(".tabs a").forEach((a) => (a.dataset.link === r ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
    document.body.dataset.route = r;
    document.title = r === "home" ? "Wafi Sharif" : `${r[0].toUpperCase() + r.slice(1)} | Wafi Sharif`;
    Field.setVisible(r === "home");
    window.scrollTo(0, 0);

    if (r === "projects" && sub) {
      const d = document.getElementById(`p-${sub}`);
      if (d) {
        d.open = true;
        d.scrollIntoView({ block: "start" });
        window.scrollBy(0, -100);
      }
    }
  }

  $("#hero-intro").textContent = SITE.intro;
  renderProjects();
  renderResearch();
  renderAbout();
  renderContact();
  Field.init();
  route();
  window.addEventListener("hashchange", route);
})();
