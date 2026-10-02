(() => {
  "use strict";

  const W = 1920;
  const H = 1080;
  const CRIT = 25;
  const SCENES = ["cover", "timeline", "domains", "ledger"];
  const HINTS = [
    "滚轮 / ↑ ↓ 切换章节",
    "拖拽地图 / 滚轮 连续推进 · ← → 逐个节点 · 空格 暂停 · 滚到两端继续滚动切换章节",
    "悬停或点击左侧领域 · 滚轮 / ↑ ↓ 切换章节",
    "悬停柱体查看详情 · 悬停图例按领域筛选",
  ];

  const $ = (sel, root = document) => root.querySelector(sel);
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const stage = $("#stage");

  /* ---------- 16:9 等比缩放 ---------- */

  function fit() {
    const s = Math.min(window.innerWidth / W, window.innerHeight / H);
    stage.style.setProperty("--s", String(s));
  }
  window.addEventListener("resize", fit);
  fit();

  /* ---------- 工具 ---------- */

  const pad = (n, w = 2) => String(n).padStart(w, "0");
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const fmtDate = (iso) => iso.replace(/-/g, ".");
  const toTime = (iso) => Date.parse(iso + "T00:00:00Z");
  const isCJK = (ch) => /[\u3000-\u9fff\uff00-\uffef]/.test(ch);

  function esc(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function restart(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  function countTo(el, from, to, dur, fmt = (v) => String(v)) {
    if (el._raf) cancelAnimationFrame(el._raf);
    if (reduce || dur <= 0) {
      el.textContent = fmt(to);
      return;
    }
    const t0 = performance.now();
    const tick = (now) => {
      const p = clamp((now - t0) / dur, 0, 1);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(Math.round(from + (to - from) * e));
      if (p < 1) el._raf = requestAnimationFrame(tick);
    };
    el._raf = requestAnimationFrame(tick);
  }

  function bar(v, i = 0) {
    const crit = v <= CRIT ? " is-crit" : "";
    return `<div class="bar${crit}" role="img" aria-label="人类剩余 ${v}%"><i style="--v:${Math.max(v, 0.5)};--i:${i}"></i></div>`;
  }

  /* ---------- 数据 ---------- */

  async function load() {
    if (location.protocol !== "file:") {
      try {
        const r = await fetch("data.json", { cache: "no-cache" });
        if (r.ok) return await r.json();
      } catch (_) {
        /* 回退到 data.js */
      }
    }
    if (window.__HUMANITY_DATA__) return window.__HUMANITY_DATA__;
    throw new Error("未能读取 data.json / data.js");
  }

  function model(data) {
    const events = data.events
      .map((e, o) => ({ ...e, _o: o, t: toTime(e.date) }))
      .sort((a, b) => a.t - b.t || a._o - b._o);

    const domains = data.domains.map((d, i) => {
      const kids = d.children || [];
      const avg = kids.length ? Math.round(kids.reduce((a, c) => a + Number(c.remaining || 0), 0) / kids.length) : 0;
      return { ...d, no: i + 1, avg, children: kids };
    });

    const leaves = domains.flatMap((d) => d.children.map((c) => ({ ...c, remaining: Number(c.remaining || 0), domain: d, hits: [] })));
    const agg = leaves.length ? Math.round(leaves.reduce((a, c) => a + c.remaining, 0) / leaves.length) : 0;

    const phases = [];
    const seen = new Set();
    events.forEach((e, i) => {
      if (!seen.has(e.era)) {
        seen.add(e.era);
        phases.push({ name: e.era, start: i });
      }
    });
    phases.forEach((p, k) => {
      p.end = k + 1 < phases.length ? phases[k + 1].start - 1 : events.length - 1;
      p.no = k + 1;
      p.y0 = events[p.start].date.slice(0, 4);
      p.y1 = events[p.end].date.slice(0, 4);
    });
    events.forEach((e, i) => {
      e.phase = phases.findIndex((p) => i >= p.start && i <= p.end);
      e.leaves = [];
    });

    const splitT = (s) => s.split(/\s+\/\s+/).map((x) => x.trim()).filter(Boolean);
    const resolve = (token) => {
      for (const t of [token, token.replace(/\/.*$/, "")]) {
        const exact = events.findIndex((e) => e.title === t || splitT(e.title).includes(t));
        if (exact >= 0) return exact;
        const pre = events.findIndex(
          (e) => e.title.startsWith(t) && /^(-|\s+[\u4e00-\u9fff《])/.test(e.title.slice(t.length))
        );
        if (pre >= 0) return pre;
      }
      return -1;
    };
    leaves.forEach((leaf) => {
      const idx = new Set(splitT(leaf.movedBy || "").map(resolve).filter((i) => i >= 0));
      idx.forEach((i) => {
        events[i].leaves.push(leaf);
        leaf.hits.push(events[i]);
      });
    });
    events.forEach((e) => e.leaves.sort((a, b) => a.remaining - b.remaining));

    return { data, events, domains, leaves, agg, phases };
  }

  /* ==========================================================
     章节切换
     ========================================================== */

  let M = null;
  let scene = -1;
  let busy = false;
  let lastNav = 0;
  const hooks = { enter: [], leave: [] };

  function swap(n) {
    const prev = scene;
    if (prev >= 0) hooks.leave[prev] && hooks.leave[prev]();
    scene = n;
    document.querySelectorAll(".scene").forEach((el) => {
      el.classList.toggle("is-active", Number(el.dataset.scene) === n);
    });
    stage.dataset.tone = n === 1 || n === 3 ? "light" : "dark";
    document.querySelectorAll("#hud-nav button").forEach((b) => {
      b.classList.toggle("is-on", Number(b.dataset.go) === n);
    });
    $("#side-num").textContent = pad(n);
    $("#side-fill").style.transform = `translateY(${n * 100}%)`;
    $("#hb-hint").textContent = HINTS[n];
    if (history.replaceState) history.replaceState(null, "", "#" + SCENES[n]);
    hooks.enter[n] && hooks.enter[n](prev);
  }

  function go(n) {
    n = clamp(n, 0, SCENES.length - 1);
    if (n === scene || busy) return;
    lastNav = performance.now();
    if (reduce || scene < 0) {
      swap(n);
      return;
    }
    busy = true;
    const sh = $("#shutter");
    sh.classList.remove("is-run", "is-back");
    void sh.offsetWidth;
    if (n < scene) sh.classList.add("is-back");
    sh.classList.add("is-run");
    setTimeout(() => swap(n), 560);
    setTimeout(() => {
      busy = false;
      sh.classList.remove("is-run", "is-back");
    }, 1200);
  }

  /* ---------- 配色 ---------- */

  const THEMES = ["endfield", "cobalt", "tundra"];

  function markTheme() {
    const cur = document.documentElement.dataset.theme;
    document.querySelectorAll("#theme button").forEach((b) => {
      b.classList.toggle("is-on", b.dataset.t === cur);
      b.setAttribute("aria-pressed", String(b.dataset.t === cur));
    });
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
  }

  function setTheme(t) {
    if (!THEMES.includes(t) || t === document.documentElement.dataset.theme || busy) return;
    const apply = () => {
      document.documentElement.dataset.theme = t;
      try {
        localStorage.setItem("he-theme", t);
      } catch (_) {
        /* 隐私模式下不持久化 */
      }
      markTheme();
    };
    if (reduce) {
      apply();
      return;
    }
    busy = true;
    const sh = $("#shutter");
    sh.classList.remove("is-run", "is-back");
    void sh.offsetWidth;
    sh.classList.add("is-run");
    setTimeout(apply, 560);
    setTimeout(() => {
      busy = false;
      sh.classList.remove("is-run");
    }, 1200);
  }

  function bindTheme() {
    if (!THEMES.includes(document.documentElement.dataset.theme)) document.documentElement.dataset.theme = THEMES[0];
    markTheme();
    $("#theme").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-t]");
      if (b) setTheme(b.dataset.t);
    });
    window.addEventListener("keydown", (e) => {
      if ((e.key === "t" || e.key === "T") && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const i = THEMES.indexOf(document.documentElement.dataset.theme);
        setTheme(THEMES[(i + 1) % THEMES.length]);
      }
    });
  }

  function bindNav() {
    document.querySelectorAll("[data-go]").forEach((b) => {
      b.addEventListener("click", () => go(Number(b.dataset.go)));
    });

    window.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        if (busy) return;
        if (scene === 1 && TL.wheel(e)) return;
        if (Math.abs(e.deltaY) < 24) return;
        if (performance.now() - lastNav < 1100) return;
        go(scene + (e.deltaY > 0 ? 1 : -1));
      },
      { passive: false }
    );

    window.addEventListener("keydown", (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        go(scene + 1);
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        go(scene - 1);
      } else if (e.key === "Home") {
        go(0);
      } else if (e.key === "End") {
        go(SCENES.length - 1);
      } else if (scene === 1 && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
        e.preventDefault();
        TL.step(e.key === "ArrowRight" ? 1 : -1);
      } else if (scene === 1 && e.key === " ") {
        e.preventDefault();
        TL.toggle();
      }
    });

    let ty = null;
    window.addEventListener("touchstart", (e) => (ty = e.touches[0].clientY), { passive: true });
    window.addEventListener("touchend", (e) => {
      if (ty == null) return;
      const dy = ty - e.changedTouches[0].clientY;
      ty = null;
      if (Math.abs(dy) > 60) go(scene + (dy > 0 ? 1 : -1));
    });
  }

  /* ==========================================================
     00 总览
     ========================================================== */

  const COVER = (() => {
    const CELLS = 50;
    let timers = [];

    function render() {
      const { data, events, domains, leaves, agg } = M;
      document.title = data.title;
      $("#site-subtitle").textContent = data.subtitle || "";
      $("#score-disclaimer").textContent = data.scoreDisclaimer || `血条为编辑估算，非测量值。基准日 ${data.updated}。`;
      $("#hud-date").textContent = fmtDate(data.updated);
      $("#hud-date").dateTime = data.updated;
      $("#hud-rev").textContent = "REV." + data.updated.replace(/-/g, "");
      $("#cover-y1").textContent = data.updated.slice(0, 4);
      $("#stat-domains").textContent = pad(domains.length);
      $("#stat-leaves").textContent = pad(leaves.length);
      $("#stat-events").textContent = pad(events.length);
      $("#stat-crit").textContent = pad(leaves.filter((l) => l.remaining <= CRIT).length);
      const low = [...leaves].sort((a, b) => a.remaining - b.remaining)[0];
      if (low) $("#stat-lowest").innerHTML = `${esc(low.name)}<em>${low.remaining}%</em>`;
      $("#hp").setAttribute("aria-label", `人类事务剩余 ${agg}%`);

      const cells = $("#hp-cells");
      cells.innerHTML = "<i></i>".repeat(CELLS);

      const ticks = $("#dial-ticks");
      let svg = "";
      for (let k = 0; k < 120; k++) {
        const a = (k / 120) * Math.PI * 2;
        const major = k % 10 === 0;
        const r0 = major ? 292 : 302;
        const r1 = 318;
        const x0 = 400 + Math.cos(a) * r0;
        const y0 = 400 + Math.sin(a) * r0;
        const x1 = 400 + Math.cos(a) * r1;
        const y1 = 400 + Math.sin(a) * r1;
        svg += `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}"${major ? ' class="is-major"' : ""}/>`;
      }
      ticks.innerHTML = svg;

      const latest = events.slice(-14).reverse();
      const items = latest
        .map((e) => `<span><time>${fmtDate(e.date)}</time><b>${esc(e.title)}</b>${esc(e.era)}</span>`)
        .join("");
      $("#ticker-run").innerHTML = items + items;
    }

    function intro() {
      timers.forEach(clearTimeout);
      timers = [];
      const cells = [...$("#hp-cells").children];
      const keep = Math.round(M.agg / (100 / CELLS));
      const num = $("#agg-num");
      if (reduce) {
        cells.forEach((c, i) => c.classList.toggle("is-out", i >= keep));
        num.textContent = String(M.agg);
        return;
      }
      cells.forEach((c) => c.classList.remove("is-out", "is-hit"));
      num.textContent = "100";
      const start = 1100;
      const per = 34;
      const drain = CELLS - keep;
      for (let k = 0; k < drain; k++) {
        const c = cells[CELLS - 1 - k];
        timers.push(setTimeout(() => c.classList.add("is-hit"), start + k * per));
        timers.push(
          setTimeout(() => {
            c.classList.remove("is-hit");
            c.classList.add("is-out");
          }, start + k * per + 260)
        );
      }
      timers.push(setTimeout(() => countTo(num, 100, M.agg, drain * per + 260), start));
    }

    return { render, intro };
  })();

  /* ==========================================================
     01 时间轴：连续关卡地图
     唯一状态是浮点位置 pos（单位：事件序号）。地图相机、视差层、
     路径进度、节点焦点、年份里程表、信息条擦除全部是 pos 的函数。
     ========================================================== */

  const TL = (() => {
    const FOCUS_X = 640;
    const S = 300;
    const G = 560;
    const X0 = 820;
    const BASE_Y = 420;
    const PATTERN = [0, -120, 70, -50, 130, -10, -140, 50, 150, -80];
    const DWELL = 3400;
    const AXIS_W = 1680;
    const SLOTS_W = 1380;

    let n = 0;
    const X = [];
    const Y = [];
    const MID = [];
    let xs = [];
    let gateX = [];

    let pos = 0;
    let vel = 0;
    let target = 0;
    let lastDir = 0;
    let markerY = BASE_Y;
    let lastCam = 0;
    let playing = !reduce;
    let dragging = false;
    let lastInput = 0;
    let settledAt = 0;
    let edgeAt = 0;
    let raf = 0;
    let lastT = 0;
    let slotK = -1;
    let nearK = -1;
    let rowsA = [];
    let rowsB = [];
    let nodeEls = [];
    let farEls = [];
    let cache = new Map();

    const el = {
      year: $("#tl-year"),
      far: $("#ly-far"),
      mid: $("#ly-mid"),
      world: $("#ly-world"),
      fore: $("#ly-fore"),
      map: $("#map"),
      band: $("#map-band"),
      hit: $("#map-hit"),
      paths: $("#paths"),
      base: $("#path-base"),
      prog: $("#path-prog"),
      clip: $("#tl-cliprect"),
      gates: $("#gates"),
      nodes: $("#nodes"),
      scanY: $("#scan-y"),
      reticle: $("#reticle"),
      liveDate: $("#live-date"),
      liveIdx: $("#live-idx"),
      liveTotal: $("#live-total"),
      liveSeg: $("#live-seg"),
      livePhase: $("#live-phase"),
      slotA: $("#slot-a"),
      slotB: $("#slot-b"),
      scan: $("#slot-scan"),
      phases: $("#axis-phases"),
      body: $("#axis-body"),
      ticks: $("#axis-ticks"),
      years: $("#axis-years"),
      progress: $("#axis-progress"),
      head: $("#playhead"),
      play: $("#ac-play"),
      timer: $("#ac-timer"),
    };

    const smooth = (x) => {
      const v = clamp(x, 0, 1);
      return v * v * (3 - 2 * v);
    };

    function rng(seed) {
      let s = seed >>> 0;
      return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    function set(elm, prop, val) {
      let c = cache.get(elm);
      if (!c) cache.set(elm, (c = {}));
      if (c[prop] === val) return;
      c[prop] = val;
      if (prop[0] === "-") elm.style.setProperty(prop, val);
      else elm.style[prop] = val;
    }

    /* ---------- 布局 ---------- */

    function layout() {
      const ev = M.events;
      n = ev.length;

      let x = X0;
      ev.forEach((e, i) => {
        if (i > 0) {
          x += S;
          if (e.phase !== ev[i - 1].phase) x += G;
        }
        X[i] = x;
        Y[i] = BASE_Y + PATTERN[i % PATTERN.length];
      });
      const worldW = X[n - 1] + 1800;

      let d = `M ${X[0] - 900} ${Y[0]} L ${X[0]} ${Y[0]}`;
      for (let i = 0; i < n - 1; i++) {
        const m = X[i + 1] - 48;
        MID[i] = m;
        d += ` L ${m} ${Y[i]} L ${m} ${Y[i + 1]} L ${X[i + 1]} ${Y[i + 1]}`;
      }
      d += ` L ${X[n - 1] + 1400} ${Y[n - 1]}`;
      el.paths.setAttribute("width", String(worldW));
      el.paths.setAttribute("viewBox", `0 0 ${worldW} 1080`);
      el.base.setAttribute("d", d);
      el.prog.setAttribute("d", d);

      gateX = M.phases.map((p) => (p.start === 0 ? X[0] - 340 : X[p.start] - 346));
      el.gates.innerHTML = M.phases
        .map(
          (p, k) => `<div class="gate" style="left:${gateX[k]}px">
            <p class="gate-no"><small>PHASE</small>${pad(p.no)}</p>
            <p class="gate-name">${esc(p.name)}</p>
            <p class="gate-yr">${p.y0}<br />${p.y1}</p>
          </div>`
        )
        .join("");

      el.nodes.innerHTML = ev
        .map((e, i) => {
          const p = M.phases[e.phase];
          return `<span class="node-pin" style="left:${X[i]}px;top:${Y[i]}px"></span>
            <div class="node" data-i="${i}" data-impact="${e.impact || "mid"}" style="left:${X[i] + 14}px;top:${Y[i]}px">
              <span class="nd-code"><b>${pad(i - p.start + 1)}</b><em>${pad(p.no)}</em></span>
              <span class="nd-body"><time>${fmtDate(e.date)}</time><strong>${esc(e.title)}</strong></span>
            </div>`;
        })
        .join("");
      nodeEls = [...el.nodes.querySelectorAll(".node")];

      el.far.innerHTML = M.phases
        .map((p, k) => {
          const lx = 760 + (gateX[k] - FOCUS_X) * 0.35;
          return `<p class="far-name" data-k="${k}" style="left:${lx.toFixed(1)}px">${esc(p.name)}<em>PHASE ${pad(p.no)} · ${p.y0}—${p.y1}</em></p>`;
        })
        .join("");
      farEls = [...el.far.querySelectorAll(".far-name")];

      const r = rng(1946);
      const kinds = ["hatch", "ring", "cross", "code", "bars", "ring", "cross", "tri"];
      let mid = "";
      ev.forEach((e, i) => {
        for (let j = 0; j < 2; j++) {
          const kind = kinds[Math.floor(r() * kinds.length)];
          const lx = 120 + r() * 1700 + (X[i] - FOCUS_X) * 0.6;
          const ly = 190 + r() * 470;
          const sz = Math.round(70 + r() * 160);
          const txt = kind === "code" ? `${e.date.slice(0, 7).replace("-", ".")} / N-${pad(i + 1, 3)}` : "";
          mid += `<span class="dc dc-${kind}" style="left:${lx.toFixed(0)}px;top:${ly.toFixed(0)}px;--sz:${sz}px">${txt}</span>`;
        }
      });
      el.mid.innerHTML = mid;

      let fore = "";
      gateX.forEach((g) => {
        fore += `<span class="fg-pole" style="left:${(1500 + (g - FOCUS_X) * 1.5).toFixed(0)}px"></span>`;
      });
      ev.forEach((e, i) => {
        if (i % 3 !== 1) return;
        const lx = 300 + r() * 1500 + (X[i] - FOCUS_X) * 1.5;
        fore += `<span class="fg-line" data-l="T+${e.date.slice(0, 4)}" style="left:${lx.toFixed(0)}px"></span>`;
      });
      el.fore.innerHTML = fore;

      layoutAxis();

      let html = "";
      for (let k = 0; k < 4; k++) {
        let col = "";
        for (let v = 0; v <= 10; v++) col += `<span>${v % 10}</span>`;
        html += `<span class="dg"><span class="dg-col">${col}</span></span>`;
      }
      el.year.innerHTML = html;
      el.liveTotal.textContent = pad(n);
    }

    function layoutAxis() {
      const ev = M.events;
      const t0 = ev[0].t;
      const t1 = ev[n - 1].t;
      const tf = (t) => (t1 > t0 ? (t - t0) / (t1 - t0) : 0);
      const blend = (t, idx) => 0.16 * tf(t) + 0.84 * (n > 1 ? idx / (n - 1) : 0);
      xs = ev.map((e, i) => blend(e.t, i));

      const xAt = (t) => {
        if (t <= t0) return 0;
        if (t >= t1) return 1;
        let k = 0;
        while (k < n - 2 && ev[k + 1].t <= t) k++;
        const a = ev[k].t;
        const b = ev[k + 1].t;
        return blend(t, k + (b > a ? (t - a) / (b - a) : 0));
      };
      const y0 = Number(ev[0].date.slice(0, 4));
      const y1 = Number(ev[n - 1].date.slice(0, 4));
      const want = [];
      for (let y = Math.ceil(y0 / 10) * 10; y <= y1; y += 10) want.push(y);
      for (let y = 2015; y <= y1; y++) want.push(y);
      let lastX = -1;
      el.years.innerHTML = [...new Set(want)]
        .sort((a, b) => a - b)
        .map((y) => {
          const x = xAt(Date.UTC(y, 0, 1));
          if (lastX >= 0 && (x - lastX) * AXIS_W < 44) return "";
          lastX = x;
          return `<span style="left:${(x * 100).toFixed(3)}%">${y}</span>`;
        })
        .join("");

      const Hh = { high: 18, mid: 12, low: 7 };
      el.ticks.innerHTML = ev
        .map((e, i) => `<span class="tk" style="left:${(xs[i] * 100).toFixed(3)}%;--h:${Hh[e.impact] || 12}px"></span>`)
        .join("");

      el.phases.innerHTML = M.phases
        .map((p, k) => {
          const a = k === 0 ? 0 : (xs[p.start - 1] + xs[p.start]) / 2;
          const b = k + 1 < M.phases.length ? (xs[p.end] + xs[p.end + 1]) / 2 : 1;
          const wide = (b - a) * AXIS_W > 96;
          return `<button type="button" class="ph" data-k="${k}" style="left:${(a * 100).toFixed(3)}%;width:${((b - a) * 100).toFixed(3)}%" title="${esc(p.name)} ${p.y0}—${p.y1}"><em>${pad(p.no)}</em>${wide ? esc(p.name) : ""}</button>`;
        })
        .join("");
      el.body.setAttribute("aria-valuemax", String(n));
    }

    function invXs(f) {
      if (f <= xs[0]) return 0;
      if (f >= xs[n - 1]) return n - 1;
      let k = 0;
      while (k < n - 2 && xs[k + 1] < f) k++;
      return k + (f - xs[k]) / (xs[k + 1] - xs[k] || 1);
    }

    /* ---------- 信息条槽位 ---------- */

    function titleSize(s) {
      let u = 0;
      for (const ch of s) u += ch === " " ? 0.24 : isCJK(ch) ? 0.92 : /[A-Z0-9]/.test(ch) ? 0.5 : 0.42;
      const one = 596 / u;
      if (one >= 62) return Math.min(one, 92);
      return clamp((596 * 1.85) / u, 34, 60);
    }

    function titleHTML(s) {
      return [...s].map((c) => (isCJK(c) ? `<span class="cjk">${esc(c)}</span>` : esc(c))).join("");
    }

    function fill(slot, i) {
      if (i < 0 || i >= n) {
        slot.innerHTML = "";
        return [];
      }
      const e = M.events[i];
      const p = M.phases[e.phase];
      const lvl = { low: 1, mid: 2, high: 3 }[e.impact] || 2;
      const rows = e.leaves;
      const MAX = 4;
      const rep = rows.length
        ? rows
            .slice(0, MAX)
            .map(
              (l) => `<div class="sl-row"><span>${esc(l.name)}</span>${bar(l.remaining)}<b class="${l.remaining <= CRIT ? "is-crit" : ""}">${l.remaining}</b></div>`
            )
            .join("") + (rows.length > MAX ? `<p class="sl-more">+ ${rows.length - MAX} 项 · ${esc([...new Set(rows.map((l) => l.domain.name))].join(" / "))}</p>` : "")
        : `<p class="sl-empty"><b>FOUNDATION</b>未直接记入领域让渡，<br />是其后 ${n - 1 - i} 个节点的前置。</p>`;

      slot.innerHTML = `
        <div class="sl-meta" data-r="0">
          <span class="sl-era">${esc(e.era)}</span>
          <span class="sl-phase">PHASE ${pad(p.no)}-${pad(i - p.start + 1)}</span>
          <span class="sl-date">${fmtDate(e.date)} · No.${pad(i + 1, 3)}</span>
        </div>
        <h3 class="sl-title" data-r="1" style="--fs:${titleSize(e.title).toFixed(1)}px">${titleHTML(e.title)}</h3>
        <p class="sl-blurb" data-r="2">${esc(e.blurb || "")}</p>
        <div class="sl-foot" data-r="3">
          ${(e.tags || []).slice(0, 3).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}
          <span class="sl-imp" data-level="${e.impact || "mid"}">${[1, 2, 3].map((v) => `<i class="${v <= lvl ? "is-on" : ""}"></i>`).join("")}<b>${(e.impact || "mid").toUpperCase()}</b></span>
        </div>
        <div class="sl-rep" data-r="4">
          <p class="sl-rep-h">让渡记录<span>IMPACT</span><b>${pad(rows.length)}</b></p>
          ${rep}
        </div>`;
      return [...slot.querySelectorAll("[data-r]")];
    }

    /* ---------- 每帧渲染 ---------- */

    function yearFloat(ms) {
      const d = new Date(ms);
      const y = d.getUTCFullYear();
      const a = Date.UTC(y, 0, 1);
      const b = Date.UTC(y + 1, 0, 1);
      return y + (ms - a) / (b - a);
    }

    function odometer(yf) {
      const cols = el.year.querySelectorAll(".dg-col");
      const digits = [yf % 10];
      let carry = Math.max(0, digits[0] - 9);
      for (let k = 1; k < 4; k++) {
        const base = Math.floor(yf / Math.pow(10, k)) % 10;
        digits[k] = base + carry;
        if (base !== 9) carry = 0;
      }
      for (let k = 0; k < 4; k++) {
        const col = cols[3 - k];
        if (col) set(col, "transform", `translateY(${(-digits[k]).toFixed(4)}em)`);
      }
    }

    function render(p, dt) {
      const k = n > 1 ? clamp(Math.floor(p), 0, n - 2) : 0;
      const t = n > 1 ? clamp(p - k, 0, 1) : 0;
      const sx = X[k] + ((X[k + 1] ?? X[k]) - X[k]) * t;
      const cam = sx - FOCUS_X;
      lastCam = cam;

      const yT = sx < (MID[k] ?? Infinity) ? Y[k] : Y[k + 1] ?? Y[k];
      markerY += (yT - markerY) * (1 - Math.exp(-dt / 0.12));
      const camY = (markerY - BASE_Y) * 0.3;

      set(el.world, "transform", `translate3d(${(-cam).toFixed(2)}px,${(-camY).toFixed(2)}px,0)`);
      set(el.far, "transform", `translate3d(${(-cam * 0.35).toFixed(2)}px,${(-camY * 0.1).toFixed(2)}px,0)`);
      set(el.mid, "transform", `translate3d(${(-cam * 0.6).toFixed(2)}px,${(-camY * 0.2).toFixed(2)}px,0)`);
      set(el.fore, "transform", `translate3d(${(-cam * 1.5).toFixed(2)}px,${(-camY * 0.5).toFixed(2)}px,0)`);
      set(el.map, "--gx", `${(-cam * 0.6).toFixed(1)}px`);
      set(el.band, "--bx", `${(-cam).toFixed(1)}px`);
      el.clip.setAttribute("width", sx.toFixed(1));
      set(el.reticle, "transform", `translate3d(0,${(markerY - camY - 88).toFixed(2)}px,0)`);

      nodeEls.forEach((nd, i) => {
        const f = smooth(1 - Math.abs(p - i) * 1.5);
        const a = clamp(p - i + 1, 0, 1);
        set(nd, "--f", f.toFixed(3));
        set(nd, "--a", a.toFixed(3));
      });

      farEls.forEach((fe, j) => {
        const dist = Math.abs(sx - gateX[j]);
        set(fe, "--r", smooth(1.15 - dist / 650).toFixed(3));
      });

      const ms = M.events[k].t + ((M.events[k + 1] ?? M.events[k]).t - M.events[k].t) * t;
      const yf = yearFloat(ms);
      odometer(yf);
      const dd = new Date(ms);
      el.liveDate.textContent = `${dd.getUTCFullYear()}.${pad(dd.getUTCMonth() + 1)}.${pad(dd.getUTCDate())}`;
      el.scanY.textContent = String(Math.floor(yf));
      set(el.liveSeg, "transform", `scaleX(${t.toFixed(3)})`);

      if (slotK !== k) {
        slotK = k;
        rowsA = fill(el.slotA, k);
        rowsB = fill(el.slotB, n > 1 ? k + 1 : -1);
      }
      rowsA.forEach((r, j) => set(r, "--e", (1 - smooth((t - 0.08 - j * 0.05) / 0.32)).toFixed(3)));
      rowsB.forEach((r, j) => set(r, "--e", smooth((t - 0.42 - j * 0.05) / 0.32).toFixed(3)));
      set(el.scan, "transform", `translate3d(${((0.04 + 0.92 * t) * SLOTS_W).toFixed(1)}px,0,0)`);
      set(el.scan, "opacity", Math.sin(Math.PI * t).toFixed(3));

      const fx = xs[k] + ((xs[k + 1] ?? xs[k]) - xs[k]) * t;
      set(el.head, "transform", `translate3d(${(fx * AXIS_W).toFixed(2)}px,0,0)`);
      set(el.progress, "transform", `scaleX(${fx.toFixed(4)})`);

      const near = Math.round(p);
      if (near !== nearK) {
        nearK = near;
        const e = M.events[near];
        el.liveIdx.textContent = pad(near + 1);
        el.livePhase.textContent = `PHASE ${pad(M.phases[e.phase].no)} · ${e.era}`;
        el.ticks.querySelectorAll(".tk").forEach((tk, i) => {
          tk.classList.toggle("is-past", i < near);
          tk.classList.toggle("is-on", i === near);
        });
        el.phases.querySelectorAll(".ph").forEach((b, i) => b.classList.toggle("is-on", i === e.phase));
        el.body.setAttribute("aria-valuenow", String(near + 1));
        el.body.setAttribute("aria-valuetext", `${e.date} ${e.title}`);
      }
    }

    /* ---------- 物理 / 循环 ---------- */

    function snap() {
      const f = target - Math.floor(target);
      if (f < 1e-6) return;
      if (lastDir > 0) target = f > 0.12 ? Math.ceil(target) : Math.floor(target);
      else if (lastDir < 0) target = f < 0.88 ? Math.floor(target) : Math.ceil(target);
      else target = Math.round(target);
      target = clamp(target, 0, n - 1);
    }

    function frame(now) {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastT) / 1000));
      lastT = now;

      if (!dragging && now - lastInput > 260) snap();

      const w = dragging ? 26 : 5.2;
      const acc = w * w * (target - pos) - 2 * w * vel;
      vel += acc * dt;
      pos += vel * dt;
      if (Math.abs(target - pos) < 1e-4 && Math.abs(vel) < 1e-3) {
        pos = target;
        vel = 0;
      }
      pos = clamp(pos, 0, n - 1);

      const settled = !dragging && pos === target && Number.isInteger(target);
      if (settled && !settledAt) settledAt = now;
      if (!settled) settledAt = 0;
      if (playing && settled) {
        const pr = (now - settledAt) / DWELL;
        set(el.timer, "transform", `scaleX(${clamp(pr, 0, 1).toFixed(3)})`);
        if (pr >= 1) {
          if (target < n - 1) {
            target += 1;
            lastDir = 1;
          } else {
            setPlaying(false);
          }
        }
      } else if (!playing) {
        set(el.timer, "transform", "scaleX(0)");
      }

      render(pos, dt);
      raf = requestAnimationFrame(frame);
    }

    function setPlaying(v) {
      playing = v;
      el.play.innerHTML = v ? '<span class="i-pause"></span>' : '<span class="i-play"></span>';
      el.play.setAttribute("aria-label", v ? "暂停自动回放" : "开始自动回放");
    }

    function toggle() {
      if (playing) {
        setPlaying(false);
        return;
      }
      if (Math.round(target) >= n - 1) {
        target = 0;
        lastDir = -1;
      }
      setPlaying(true);
      settledAt = 0;
    }

    function step(d) {
      setPlaying(false);
      lastDir = d;
      target = clamp(Math.round(target) + d, 0, n - 1);
    }

    function goTo(i) {
      setPlaying(false);
      lastDir = 0;
      target = clamp(i, 0, n - 1);
    }

    function wheel(e) {
      const raw = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      const d = raw * (e.deltaMode === 1 ? 33 : 1);
      if (Math.abs(d) < 1) return true;
      const pushing = (d > 0 && target >= n - 1) || (d < 0 && target <= 0);
      if (pushing) {
        const now = performance.now();
        if (!edgeAt) edgeAt = now;
        return now - edgeAt < 420;
      }
      edgeAt = 0;
      setPlaying(false);
      lastDir = Math.sign(d);
      lastInput = performance.now();
      target = clamp(target + d * 0.0032, 0, n - 1);
      return true;
    }

    function bind() {
      $("#ac-prev").addEventListener("click", () => step(-1));
      $("#ac-next").addEventListener("click", () => step(1));
      el.play.addEventListener("click", toggle);

      el.phases.addEventListener("click", (ev) => {
        const b = ev.target.closest(".ph");
        if (b) goTo(M.phases[Number(b.dataset.k)].start);
      });

      const scale = () => Number(stage.style.getPropertyValue("--s")) || 1;

      let lastX = 0;
      let downX = 0;
      let lastMoveT = 0;
      let v = 0;
      el.hit.addEventListener("pointerdown", (ev) => {
        dragging = true;
        setPlaying(false);
        el.hit.setPointerCapture(ev.pointerId);
        el.hit.classList.add("is-drag");
        lastX = downX = ev.clientX;
        lastMoveT = performance.now();
        v = 0;
        target = pos;
        vel = 0;
      });
      el.hit.addEventListener("pointermove", (ev) => {
        if (!dragging) return;
        const now = performance.now();
        const dx = (ev.clientX - lastX) / scale();
        lastX = ev.clientX;
        const k = clamp(Math.floor(target), 0, n - 2);
        const sp = (X[k + 1] ?? X[k] + S) - X[k];
        const dp = -dx / sp;
        target = clamp(target + dp, 0, n - 1);
        const dtm = Math.max(1, now - lastMoveT);
        v = v * 0.6 + (dp / dtm) * 1000 * 0.4;
        lastMoveT = now;
      });
      const up = (ev) => {
        if (!dragging) return;
        dragging = false;
        el.hit.classList.remove("is-drag");
        if (Math.abs(ev.clientX - downX) < 6) {
          const r = el.hit.getBoundingClientRect();
          const wx = (ev.clientX - r.left) / scale() + lastCam;
          let best = Math.round(pos);
          let bd = Infinity;
          X.forEach((x, i) => {
            const dd = wx - (x + 14);
            if (dd >= -20 && dd < 260 && Math.abs(dd - 100) < bd) {
              bd = Math.abs(dd - 100);
              best = i;
            }
          });
          goTo(best);
          return;
        }
        if (performance.now() - lastMoveT > 120) v = 0;
        lastDir = Math.sign(v);
        target = clamp(target + clamp(v * 0.22, -3, 3), 0, n - 1);
        lastInput = 0;
      };
      el.hit.addEventListener("pointerup", up);
      el.hit.addEventListener("pointercancel", up);

      let axisDrag = false;
      const axisTo = (ev) => {
        const r = el.body.getBoundingClientRect();
        target = invXs(clamp((ev.clientX - r.left) / r.width, 0, 1));
      };
      el.body.addEventListener("pointerdown", (ev) => {
        axisDrag = true;
        dragging = true;
        setPlaying(false);
        el.body.setPointerCapture(ev.pointerId);
        axisTo(ev);
      });
      el.body.addEventListener("pointermove", (ev) => axisDrag && axisTo(ev));
      const axisUp = () => {
        if (!axisDrag) return;
        axisDrag = false;
        dragging = false;
        lastDir = 0;
        lastInput = 0;
      };
      el.body.addEventListener("pointerup", axisUp);
      el.body.addEventListener("pointercancel", axisUp);
    }

    function enter() {
      lastT = performance.now();
      settledAt = 0;
      edgeAt = 0;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    }

    function leave() {
      cancelAnimationFrame(raf);
    }

    return { layout, bind, enter, leave, step, toggle, wheel, setPlaying };
  })();

  /* ==========================================================
     02 领域血条
     ========================================================== */

  const DM = (() => {
    let cur = -1;
    let hoverT = null;

    function render() {
      $("#dm-list").innerHTML = M.domains
        .map(
          (d, i) => `<li class="dm-row" role="option" data-i="${i}" style="--i:${i}" tabindex="0">
            <span class="dm-no">${pad(d.no)}</span>
            <span class="dm-name">${esc(d.name)}<em>${esc(d.id.toUpperCase())}</em></span>
            <span class="dm-val${d.avg <= CRIT ? " is-crit" : ""}">${d.avg}<small>%</small></span>
            ${bar(d.avg)}
          </li>`
        )
        .join("");

      const list = $("#dm-list");
      list.addEventListener("click", (e) => {
        const r = e.target.closest(".dm-row");
        if (r) select(Number(r.dataset.i));
      });
      list.addEventListener("mouseover", (e) => {
        const r = e.target.closest(".dm-row");
        if (!r) return;
        clearTimeout(hoverT);
        hoverT = setTimeout(() => select(Number(r.dataset.i)), 90);
      });
      list.addEventListener("keydown", (e) => {
        const r = e.target.closest(".dm-row");
        if (r && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          e.stopPropagation();
          select(Number(r.dataset.i));
        }
      });
    }

    function select(i, force) {
      if (i === cur && !force) return;
      const prevAvg = cur >= 0 ? M.domains[cur].avg : 0;
      cur = i;
      const d = M.domains[i];
      document.querySelectorAll(".dm-row").forEach((r, k) => {
        r.classList.toggle("is-on", k === i);
        r.setAttribute("aria-selected", String(k === i));
      });
      $("#dd-code").textContent = `DOMAIN ${pad(d.no)} / ${d.id.toUpperCase()}`;
      $("#dd-name").textContent = d.name;
      $("#dd-note").textContent = d.note || "";
      const num = $("#dd-num");
      num.parentElement.classList.toggle("is-crit", d.avg <= CRIT);
      countTo(num, prevAvg, d.avg, 600);

      const kids = d.children.map((c) => ({ ...c, remaining: Number(c.remaining || 0) }));
      const sorted = [...kids].sort((a, b) => a.remaining - b.remaining);
      const crit = kids.filter((c) => c.remaining <= CRIT).length;
      const lo = sorted[0];
      const hi = sorted[sorted.length - 1];
      $("#dd-sum").innerHTML = `
        <div>观察项<b>${pad(kids.length)}</b></div>
        <div>临界<b style="color:var(--red)">${pad(crit)}</b></div>
        <div>最低<b>${lo ? lo.remaining : "—"}</b><span>${lo ? esc(lo.name) : ""}</span></div>
        <div>最高<b>${hi ? hi.remaining : "—"}</b><span>${hi ? esc(hi.name) : ""}</span></div>`;

      $("#dd-leaves").innerHTML = kids
        .map(
          (c, k) => `<li class="dd-leaf" style="--i:${k}">
            <div class="dd-leaf-top">
              <span class="dd-leaf-name">${esc(c.name)}</span>
              <span class="dd-leaf-by">← ${esc(c.movedBy || "—")}</span>
              <span class="dd-leaf-val${c.remaining <= CRIT ? " is-crit" : ""}">${c.remaining}</span>
            </div>
            ${bar(c.remaining, k)}
            <p class="dd-leaf-note" title="${esc(c.note || "")}">${esc(c.note || "")}</p>
          </li>`
        )
        .join("");
    }

    function enter() {
      select(cur < 0 ? 0 : cur, true);
    }

    return { render, enter };
  })();

  /* ==========================================================
     03 出局名单
     ========================================================== */

  const LG = (() => {
    function render() {
      const sorted = [...M.leaves].sort((a, b) => a.remaining - b.remaining || a.domain.no - b.domain.no);
      const first = sorted[0];
      if (first) {
        $("#lg-first").textContent = first.name;
        $("#lg-first-v").textContent = first.remaining;
        $("#lg-first-d").textContent = `${first.domain.name} · ${first.movedBy || ""}`;
      }
      const crit = sorted.filter((l) => l.remaining <= CRIT).length;
      $("#lg-hint").textContent = `全部 ${sorted.length} 项观察 · 按人类剩余升序 · 红色 = 临界 ≤${CRIT}%（${crit} 项）`;
      $("#lg-chart").style.setProperty("--m", String(M.agg));
      $("#lg-mean").innerHTML = `<b>均值 ${M.agg}%</b>`;

      $("#lg-legend").innerHTML = M.domains
        .map((d) => `<span data-d="${d.no}"><b>${pad(d.no)}</b>${esc(d.name)}</span>`)
        .join("");

      $("#lg-bars").innerHTML = sorted
        .map(
          (l, i) => `<div class="lg-bar${l.remaining <= CRIT ? " is-crit" : ""}" data-i="${i}" data-d="${l.domain.no}" style="--v:${l.remaining};--i:${i}">
            <span class="lb-v">${l.remaining}</span>
            <span class="lb-fill"></span>
            <span class="lb-code">${pad(l.domain.no)}</span>
            <span class="lb-name">${esc(l.name)}</span>
          </div>`
        )
        .join("");

      const chart = $("#lg-chart");
      const tip = $("#lg-tip");
      const bars = $("#lg-bars");
      bars.addEventListener("mousemove", (e) => {
        const b = e.target.closest(".lg-bar");
        if (!b) {
          tip.classList.remove("is-on");
          return;
        }
        const l = sorted[Number(b.dataset.i)];
        tip.innerHTML = `<div class="lt-top"><span class="lt-name">${esc(l.name)}</span><span class="lt-v${l.remaining <= CRIT ? " is-crit" : ""}">${l.remaining}%</span></div>
          <p class="lt-d">${pad(l.domain.no)} · ${esc(l.domain.name)}</p>
          <p class="lt-note">${esc(l.note || "")}</p>
          <p class="lt-by">← ${esc(l.movedBy || "—")}</p>`;
        const cs = chart.getBoundingClientRect();
        const bs = b.getBoundingClientRect();
        const k = cs.width / 1680;
        const bx = (bs.left - cs.left + bs.width / 2) / k;
        const left = clamp(bx - 180, 0, 1680 - 360);
        tip.style.left = left + "px";
        const top = 590 - 196 - (l.remaining * 380) / 100 - 200;
        tip.style.top = Math.max(-150, top) + "px";
        tip.classList.add("is-on");
      });
      bars.addEventListener("mouseleave", () => tip.classList.remove("is-on"));

      const legend = $("#lg-legend");
      legend.addEventListener("mouseover", (e) => {
        const s = e.target.closest("span[data-d]");
        if (!s) return;
        bars.classList.add("is-dim");
        bars.querySelectorAll(".lg-bar").forEach((b) => b.classList.toggle("is-hl", b.dataset.d === s.dataset.d));
      });
      legend.addEventListener("mouseleave", () => {
        bars.classList.remove("is-dim");
        bars.querySelectorAll(".lg-bar").forEach((b) => b.classList.remove("is-hl"));
      });
    }

    return { render };
  })();

  /* ==========================================================
     启动
     ========================================================== */

  load()
    .then((data) => {
      M = model(data);
      COVER.render();
      TL.layout();
      TL.bind();
      DM.render();
      LG.render();

      hooks.enter[0] = () => COVER.intro();
      hooks.enter[1] = () => TL.enter();
      hooks.leave[1] = () => TL.leave();
      hooks.enter[2] = () => DM.enter();

      bindNav();
      bindTheme();
      const start = Math.max(0, SCENES.indexOf(location.hash.slice(1)));
      swap(start);
    })
    .catch((err) => {
      console.error(err);
      $("#site-subtitle").textContent = "数据加载失败：" + err.message;
      swap(0);
    });
})();
