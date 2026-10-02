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
    TL.recolor();
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
     01 时间轴
     唯一状态是浮点位置 pos（单位：事件序号）。标尺、时代图形、
     「人」字侵蚀、旁白、里程表、信息条全部是 pos 的函数。
     ========================================================== */

  const STORY = {
    奠基: ["PUNCH CARD", "机器学会了计算。那时，思考仍是人类独有的事。"],
    专用智能: ["DEEP BLUE", "它先赢下了一盘棋。人们说：那只是搜索。"],
    深度学习: ["NEURAL NET", "它开始看见、开始听见，然后在棋盘上下出了直觉。"],
    Transformer: ["ATTENTION", "注意力就是一切。它读完了人类写下的几乎所有文字。"],
    生成爆发: ["GENERATION", "它开始回答。接着开始画、开始写、开始编程。"],
    推理与代理: ["CHAIN OF THOUGHT", "它学会了先想一想，再动手。"],
    "2025 浪潮": ["RELEASE WAVE", "每个月都有一个新名字，每个名字都拿走一点什么。"],
    "2026 临界": ["CRITICAL", "人类事务剩余 {agg}%。这份记录仍在继续。"],
  };

  const TL = (() => {
    const CX = 960;
    const S = 270;
    const G = 150;
    const DWELL = 3600;
    const SLOTS_W = 1680;
    const AXIS_W = 1680;
    const YEAR = 365.2425 * 864e5;
    const MR = { x: 120, y: 108, w: 780, h: 390 };
    const GR = { x: 1050, y: 66, s: 540, cs: 18 };

    let n = 0;
    const X = [];
    const W = [];
    let xs = [];
    let cells = [];
    let C = null;

    let pos = 0;
    let vel = 0;
    let target = 0;
    let lastDir = 0;
    let playing = !reduce;
    let dragging = false;
    let lastInput = 0;
    let settledAt = 0;
    let edgeAt = 0;
    let raf = 0;
    let lastT = 0;
    let lastP = -1;
    let dirty = true;
    let slotK = -1;
    let nearK = -1;
    let rowsA = [];
    let rowsB = [];
    let evEls = [];
    let rateS = 0;
    let storyKey = "";
    const cache = new Map();

    const el = {
      art: $("#art"),
      grid: $("#tl-grid"),
      hit: $("#tl-hit"),
      track: $("#ruler-track"),
      year: $("#tl-year"),
      rate: $("#rate"),
      humanBox: $("#human"),
      humanV: $("#human-v"),
      humanD: $("#human-d"),
      storyPh: $("#story-ph"),
      storyFig: $("#story-fig"),
      storyT: $("#story-t"),
      slotA: $("#slot-a"),
      slotB: $("#slot-b"),
      scan: $("#slot-scan"),
      overview: $("#overview"),
      phases: $("#axis-phases"),
      ovHead: $("#ov-head"),
      play: $("#ac-play"),
      timer: $("#ac-timer"),
    };
    const ctx = el.art.getContext("2d");

    const smooth = (x) => {
      const v = clamp(x, 0, 1);
      return v * v * (3 - 2 * v);
    };
    const lerp = (a, b, t) => a + (b - a) * t;

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

    /* ---------- 颜色（画布读取主题变量） ---------- */

    function hexRGB(hex) {
      const h = hex.replace("#", "").trim();
      const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
      return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
    }

    function recolor() {
      const cs = getComputedStyle(document.documentElement);
      const get = (k) => hexRGB(cs.getPropertyValue(k) || "#000");
      const ink = get("--pink");
      const mk = (rgb) => (a = 1) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
      C = { ink: mk(ink), acc: mk(get("--y")), red: mk(get("--red")), paper: mk(get("--paper")), card: mk(get("--card")) };
      dirty = true;
    }

    function resize() {
      const s = Number(stage.style.getPropertyValue("--s")) || 1;
      const q = clamp(s * (window.devicePixelRatio || 1), 1, 2);
      el.art.width = Math.round(1920 * q);
      el.art.height = Math.round(624 * q);
      ctx.setTransform(q, 0, 0, q, 0, 0);
      dirty = true;
    }

    /* ---------- 布局 ---------- */

    function xAtTime(t) {
      const ev = M.events;
      if (t <= ev[0].t) {
        const r = (X[1] - X[0]) / Math.max(1, ev[1].t - ev[0].t);
        return X[0] - (ev[0].t - t) * r;
      }
      if (t >= ev[n - 1].t) {
        const r = (X[n - 1] - X[n - 2]) / Math.max(864e5 * 20, ev[n - 1].t - ev[n - 2].t);
        return X[n - 1] + (t - ev[n - 1].t) * r;
      }
      let k = 0;
      while (k < n - 2 && ev[k + 1].t <= t) k++;
      const a = ev[k].t;
      const b = ev[k + 1].t;
      return lerp(X[k], X[k + 1], b > a ? (t - a) / (b - a) : 0);
    }

    function layout() {
      const ev = M.events;
      n = ev.length;
      const WT = { high: 3, mid: 2, low: 1 };
      ev.forEach((e, i) => {
        X[i] = i * S + e.phase * G;
        W[i] = i === 0 ? 0 : W[i - 1] + (WT[e.impact] || 2);
      });

      let html = "";
      const y0 = Number(ev[0].date.slice(0, 4));
      const y1 = Number(ev[n - 1].date.slice(0, 4));
      let lastLab = -Infinity;
      let lastM = -Infinity;
      for (let y = y0; y <= y1; y++) {
        const x = xAtTime(Date.UTC(y, 0, 1));
        const dec = y % 10 === 0;
        const lab = dec || x - lastLab > 56;
        if (lab) lastLab = x;
        html += `<span class="yt${dec ? " is-dec" : ""}" style="left:${x.toFixed(1)}px">${lab ? `<b>${y}</b>` : ""}</span>`;
        for (let m = 1; m < 12; m++) {
          const xm = xAtTime(Date.UTC(y, m, 1));
          if (xm - Math.max(lastM, x) > 14 && xm - x > 14) {
            const ml = xm - Math.max(lastM, x) > 64 && xm - lastLab > 64;
            html += `<span class="yt is-m" style="left:${xm.toFixed(1)}px">${ml ? `<b>${pad(m + 1)}</b>` : ""}</span>`;
            lastM = xm;
          }
        }
      }
      const H = { high: 30, mid: 20, low: 12 };
      html += ev
        .map(
          (e, i) => `<div class="ev" data-impact="${e.impact || "mid"}" style="left:${X[i]}px;--h:${H[e.impact] || 20}px">
            <div class="ev-l"><time>${fmtDate(e.date)}</time><strong>${esc(e.title)}</strong></div>
          </div>`
        )
        .join("");
      html += M.phases
        .filter((p) => p.start > 0)
        .map((p) => {
          const x = (X[p.start - 1] + X[p.start]) / 2 + 30;
          return `<div class="pf" style="left:${x}px"><span><em>${pad(p.no)}</em>${esc(p.name)}</span></div>`;
        })
        .join("");
      el.track.innerHTML = html;
      evEls = [...el.track.querySelectorAll(".ev")];

      const t0 = ev[0].t;
      const t1 = ev[n - 1].t;
      xs = ev.map((e, i) => 0.16 * ((e.t - t0) / (t1 - t0 || 1)) + 0.84 * (i / (n - 1 || 1)));
      el.phases.innerHTML = M.phases
        .map((p, k) => {
          const a = k === 0 ? 0 : (xs[p.start - 1] + xs[p.start]) / 2;
          const b = k + 1 < M.phases.length ? (xs[p.end] + xs[p.end + 1]) / 2 : 1;
          const wide = (b - a) * AXIS_W > 90;
          return `<span class="ph" data-k="${k}" style="left:${(a * 100).toFixed(3)}%;width:${((b - a) * 100).toFixed(3)}%" title="${esc(p.name)} ${p.y0}—${p.y1}"><em>${pad(p.no)}</em>${wide ? esc(p.name) : ""}</span>`;
        })
        .join("");

      let odo = "";
      for (let k = 0; k < 4; k++) {
        let col = "";
        for (let v = 0; v <= 10; v++) col += `<span>${v % 10}</span>`;
        odo += `<span class="dg"><span class="dg-col">${col}</span></span>`;
      }
      el.year.innerHTML = odo;

      recolor();
      resize();
      buildGlyph();
      if (document.fonts && document.fonts.load) {
        document.fonts.load('900 600px "Noto Sans SC"', "人").then(() => {
          buildGlyph();
          dirty = true;
        });
      }
    }

    /* ---------- 「人」字像素 ---------- */

    function buildGlyph() {
      const { s, cs } = GR;
      const off = document.createElement("canvas");
      off.width = s;
      off.height = s;
      const o = off.getContext("2d");
      o.fillStyle = "#000";
      o.textAlign = "center";
      o.textBaseline = "middle";
      o.font = `900 ${s * 0.98}px "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif`;
      o.fillText("人", s / 2, s * 0.53);
      const data = o.getImageData(0, 0, s, s).data;
      const N = s / cs;
      const r = rng(7);
      const list = [];
      for (let gy = 0; gy < N; gy++) {
        for (let gx = 0; gx < N; gx++) {
          let a = 0;
          for (let sy = 0; sy < 3; sy++) {
            for (let sx = 0; sx < 3; sx++) {
              const px = Math.floor(gx * cs + ((sx + 0.5) * cs) / 3);
              const py = Math.floor(gy * cs + ((sy + 0.5) * cs) / 3);
              a += data[(py * s + px) * 4 + 3];
            }
          }
          if (a / 9 / 255 < 0.42) continue;
          const dx = gx / N - 1;
          const dy = gy / N - 1;
          const d = Math.sqrt(dx * dx + dy * dy) / Math.SQRT2;
          list.push({ gx, gy, score: 0.62 * d + 0.38 * r() });
        }
      }
      list.sort((a, b) => a.score - b.score);
      list.forEach((c, i) => (c.th = i / list.length));
      cells = list;
    }

    function humanAt(p) {
      const k = clamp(Math.floor(p), 0, n - 2);
      const t = clamp(p - k, 0, 1);
      const cum = lerp(W[k], W[k + 1], t);
      const f = W[n - 1] ? cum / W[n - 1] : 0;
      return 100 - (100 - M.agg) * Math.pow(f, 1.25);
    }

    function drawGlyph(p, Hm) {
      const { x, y, s, cs } = GR;
      const E = (100 - Hm) / 100;
      const drift = -(p - n / 2) * 1.6;
      ctx.save();
      ctx.translate(x + drift, y);

      ctx.strokeStyle = C.ink(0.35);
      ctx.lineWidth = 2;
      const b = 18;
      [
        [0, 0, 1, 1],
        [s, 0, -1, 1],
        [0, s, 1, -1],
        [s, s, -1, -1],
      ].forEach(([bx, by, sx, sy]) => {
        ctx.beginPath();
        ctx.moveTo(bx, by + sy * b);
        ctx.lineTo(bx, by);
        ctx.lineTo(bx + sx * b, by);
        ctx.stroke();
      });

      let eaten = 0;
      cells.forEach((c) => {
        const lp = clamp((E - c.th) / 0.035, 0, 1);
        const cx = c.gx * cs + cs / 2;
        const cy = c.gy * cs + cs / 2;
        if (lp < 1) {
          const z = (cs - 4) * (1 - lp);
          ctx.fillStyle = C.ink(1);
          ctx.fillRect(cx - z / 2, cy - z / 2, z, z);
        }
        if (lp > 0) {
          if (lp < 1) {
            const z = (cs - 4) * lp;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate((1 - lp) * Math.PI * 0.25);
            ctx.fillStyle = C.red(1);
            ctx.fillRect(-z / 2, -z / 2, z, z);
            ctx.restore();
          } else {
            eaten++;
            const z = cs - 5;
            ctx.fillStyle = C.acc(1);
            ctx.fillRect(cx - z / 2, cy - z / 2, z, z);
            ctx.fillStyle = C.ink(0.85);
            ctx.fillRect(cx - 2, cy - 2, 4, 4);
          }
        }
      });

      ctx.fillStyle = C.ink(0.55);
      ctx.font = '500 12px "JetBrains Mono", monospace';
      ctx.textAlign = "left";
      ctx.fillText(`FIG.H — 人 · PX ${pad(cells.length, 3)} · EATEN ${pad(eaten, 3)}`, 26, 4);
      ctx.restore();
    }

    /* ---------- 时代图形 ---------- */

    function label(t, x, y, size = 12, a = 0.6, weight = 500, font = "JetBrains Mono") {
      ctx.font = `${weight} ${size}px "${font}", "Noto Sans SC", monospace`;
      ctx.fillStyle = C.ink(a);
      ctx.fillText(t, x, y);
    }

    const MOTIF = [
      // 01 穿孔卡
      (lp, u) => {
        const r = rng(1946);
        const cw = 740;
        const ch = 300;
        const y0 = 56;
        ctx.fillStyle = C.card(1);
        ctx.strokeStyle = C.ink(1);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(30, y0);
        ctx.lineTo(cw, y0);
        ctx.lineTo(cw, y0 + ch);
        ctx.lineTo(0, y0 + ch);
        ctx.lineTo(0, y0 + 30);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        const cols = 45;
        const rows = 12;
        const gx = (cw - 60) / cols;
        const gy = (ch - 64) / rows;
        const head = lp * 52;
        for (let c = 0; c < cols; c++) {
          const holes = [Math.floor(r() * rows), Math.floor(r() * rows), r() > 0.5 ? Math.floor(r() * rows) : -1];
          const pc = clamp(head - c, 0, 1);
          for (let rr = 0; rr < rows; rr++) {
            const hx = 34 + c * gx;
            const hy = y0 + 26 + rr * gy;
            if (holes.includes(rr) && pc > 0) {
              ctx.fillStyle = C.ink(1);
              ctx.fillRect(hx, hy, 7, 14 * pc);
            } else {
              ctx.fillStyle = C.ink(0.22 * u);
              ctx.fillRect(hx + 2, hy + 6, 2, 2);
            }
          }
          if (c % 5 === 0) label(String(c + 1), 34 + c * gx, y0 + ch - 12, 9, 0.4);
        }
        const txt = "PRINT 'CAN MACHINES THINK?'";
        const nch = clamp(Math.floor((head / cols) * txt.length), 0, txt.length);
        label(txt.slice(0, nch) + (nch < txt.length ? "▌" : ""), 0, 44, 20, 0.9, 700);
        label("80-COLUMN CARD · 1946—1989", cw - 220, y0 + ch + 22, 11, 0.5);
      },
      // 02 棋盘
      (lp, u) => {
        const bx = 10;
        const by = 50;
        const sz = 300;
        const q = sz / 8;
        for (let rr = 0; rr < 8; rr++) {
          for (let c = 0; c < 8; c++) {
            const k = smooth(u * 2.2 - ((rr + c) / 14) * 1.2);
            if (k <= 0) continue;
            const z = q * k;
            const x = bx + c * q + (q - z) / 2;
            const y = by + rr * q + (q - z) / 2;
            ctx.fillStyle = (rr + c) % 2 ? C.ink(1) : C.card(1);
            ctx.fillRect(x, y, z, z);
          }
        }
        ctx.strokeStyle = C.ink(1);
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, by, sz, sz);
        const fall = smooth((lp - 0.25) / 0.45);
        const kx = bx + 4.5 * q;
        const ky = by + 3.5 * q + 70;
        ctx.save();
        ctx.translate(kx - 6, ky);
        ctx.rotate(-fall * Math.PI * 0.47);
        ctx.translate(6, 0);
        ctx.fillStyle = C.acc(1);
        ctx.strokeStyle = C.ink(1);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-6, 0);
        ctx.lineTo(50, 0);
        ctx.lineTo(40, -16);
        ctx.lineTo(34, -96);
        ctx.lineTo(10, -96);
        ctx.lineTo(4, -16);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(22, -108, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = C.ink(1);
        ctx.fillRect(19, -146, 6, 26);
        ctx.fillRect(11, -137, 22, 6);
        ctx.restore();

        ctx.textAlign = "left";
        label("DEEP BLUE", 360, 110, 68, 1, 800, "Barlow Condensed");
        label("vs. GARRY KASPAROV · 1997.05.11", 362, 140, 14, 0.6);
        const sc = smooth((lp - 0.2) / 0.5);
        label(sc > 0.98 ? "3½ — 2½" : `${(sc * 3.5).toFixed(1)} — ${(sc * 2.5).toFixed(1)}`, 360, 250, 96, 1, 800, "Barlow Condensed");
        const nps = Math.round(2e8 * smooth(lp * 1.4));
        label(`${nps.toLocaleString("en-US")} POSITIONS / SEC`, 362, 290, 14, 0.75, 700);
        label("1997.11 · LSTM：网络开始记住更长的序列", 362, 340, 14, 0.5, 500, "Noto Sans SC");
      },
      // 03 神经网络 + 围棋
      (lp, u) => {
        const layers = [3, 6, 8, 6, 2];
        const lx = (i) => 16 + i * 80;
        const ly = (i, j) => 60 + ((j + 0.5) * 300) / layers[i];
        const net = clamp(lp * 1.7, 0, 1);
        const edges = [];
        for (let i = 0; i < layers.length - 1; i++)
          for (let a = 0; a < layers[i]; a++) for (let b = 0; b < layers[i + 1]; b++) edges.push([i, a, b]);
        const shown = net * edges.length;
        ctx.lineWidth = 1;
        edges.forEach(([i, a, b], k) => {
          const v = clamp(shown - k, 0, 1);
          if (v <= 0) return;
          ctx.strokeStyle = C.ink(0.28 * v);
          ctx.beginPath();
          ctx.moveTo(lx(i), ly(i, a));
          ctx.lineTo(lerp(lx(i), lx(i + 1), v), lerp(ly(i, a), ly(i + 1, b), v));
          ctx.stroke();
        });
        layers.forEach((m, i) => {
          for (let j = 0; j < m; j++) {
            const on = net * layers.length - i > 0.5;
            ctx.beginPath();
            ctx.arc(lx(i), ly(i, j), 8 * smooth(u * 2 - i * 0.2), 0, Math.PI * 2);
            ctx.fillStyle = on ? C.acc(1) : C.card(1);
            ctx.strokeStyle = C.ink(1);
            ctx.lineWidth = 2;
            ctx.fill();
            ctx.stroke();
          }
        });
        label("IMAGENET → ALEXNET → RESNET", 0, 384, 11, 0.55);

        const gx = 420;
        const gy = 50;
        const gs = 300;
        const st = gs / 8;
        ctx.fillStyle = C.card(1);
        ctx.fillRect(gx - 14, gy - 14, gs + 28, gs + 28);
        ctx.strokeStyle = C.ink(0.8);
        ctx.lineWidth = 1;
        for (let i = 0; i < 9; i++) {
          const v = smooth(u * 1.6 - i * 0.05);
          ctx.beginPath();
          ctx.moveTo(gx, gy + i * st);
          ctx.lineTo(gx + gs * v, gy + i * st);
          ctx.moveTo(gx + i * st, gy);
          ctx.lineTo(gx + i * st, gy + gs * v);
          ctx.stroke();
        }
        const r = rng(2016);
        const used = new Set();
        const moves = [];
        while (moves.length < 40) {
          const m = Math.floor(r() * 81);
          if (!used.has(m)) {
            used.add(m);
            moves.push(m);
          }
        }
        const mv = clamp((lp - 0.12) / 0.8, 0, 1) * moves.length;
        moves.forEach((m, k) => {
          const v = clamp(mv - k, 0, 1);
          if (v <= 0) return;
          const cx = gx + (m % 9) * st;
          const cy = gy + Math.floor(m / 9) * st;
          ctx.beginPath();
          ctx.arc(cx, cy, 15 * smooth(v * 1.4), 0, Math.PI * 2);
          ctx.fillStyle = k % 2 ? C.card(1) : C.ink(1);
          ctx.strokeStyle = C.ink(1);
          ctx.lineWidth = 2;
          ctx.fill();
          ctx.stroke();
          if (k === 36) {
            ctx.strokeStyle = C.acc(1);
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.arc(cx, cy, 22, 0, Math.PI * 2);
            ctx.stroke();
            ctx.strokeStyle = C.ink(1);
            ctx.lineWidth = 1.5;
            ctx.stroke();
            label("MOVE 37", cx + 26, cy - 18, 13, 1, 700);
          }
        });
        label("ALPHAGO · 2016.03 · 4 : 1", gx - 14, 384, 11, 0.55);
      },
      // 04 注意力矩阵
      (lp, u) => {
        const tok = ["机器", "读完", "了", "人类", "写下", "的", "每一个", "字"];
        const N = tok.length;
        const q = 34;
        const mx = 96;
        const my = 70;
        ctx.textAlign = "right";
        tok.forEach((t, i) => label(t, mx - 10, my + i * q + 22, 14, smooth(u * 2 - i * 0.1), 700, "Noto Sans SC"));
        ctx.textAlign = "left";
        tok.forEach((t, j) => {
          ctx.save();
          ctx.translate(mx + j * q + 22, my - 8);
          ctx.rotate(-Math.PI / 3);
          label(t, 0, 0, 13, smooth(u * 2 - j * 0.1), 500, "Noto Sans SC");
          ctx.restore();
        });
        const sweep = lp * (2 * N + 4);
        for (let i = 0; i < N; i++) {
          let best = 0;
          const w = [];
          for (let j = 0; j < N; j++) {
            const v = j > i ? 0 : clamp(Math.exp(-(i - j) * 0.8) * 0.55 + (j === 3 ? 0.5 : 0) + (j === 0 ? 0.18 : 0), 0, 1);
            w.push(v);
            if (v > w[best]) best = j;
          }
          for (let j = 0; j < N; j++) {
            const rv = clamp(sweep - (i + j), 0, 1);
            const x = mx + j * q;
            const y = my + i * q;
            ctx.strokeStyle = C.ink(0.18);
            ctx.lineWidth = 1;
            ctx.strokeRect(x + 0.5, y + 0.5, q - 1, q - 1);
            if (rv <= 0 || w[j] === 0) continue;
            const z = (q - 4) * rv;
            ctx.fillStyle = j === best && i > 2 ? C.acc(1) : C.ink(w[j]);
            ctx.fillRect(x + (q - z) / 2, y + (q - z) / 2, z, z);
          }
        }
        label("ATTENTION(Q, K, V) = softmax(QKᵀ/√d)·V", mx, my + N * q + 28, 12, 0.7, 700);

        const bx = 470;
        for (let b = 0; b < 6; b++) {
          const v = smooth(u * 2.4 - b * 0.22);
          const y = 300 - b * 46;
          ctx.fillStyle = b % 2 ? C.card(1) : C.ink(1);
          ctx.strokeStyle = C.ink(1);
          ctx.lineWidth = 2;
          ctx.fillRect(bx, y, 220 * v, 34);
          ctx.strokeRect(bx, y, 220 * v, 34);
          if (v > 0.9) {
            ctx.fillStyle = b % 2 ? C.ink(1) : C.card(1);
            ctx.font = '700 12px "JetBrains Mono", monospace';
            ctx.fillText(b % 2 ? "FEED FORWARD" : "MULTI-HEAD ATTENTION", bx + 12, y + 22);
          }
        }
        label("× N", bx + 236, 140, 40, 1, 800, "Barlow Condensed");
        const pr = Math.pow(10, lerp(Math.log10(1.17e8), Math.log10(1.75e11), clamp(lp * 1.15, 0, 1)));
        const fmt = pr >= 1e9 ? `${(pr / 1e9).toFixed(pr >= 1e10 ? 0 : 1)}B` : `${Math.round(pr / 1e6)}M`;
        label(fmt, bx, 372, 54, 1, 800, "Barlow Condensed");
        label("PARAMETERS · GPT-1 → GPT-3", bx + 4, 390, 11, 0.55);
      },
      // 05 生成洪流
      (lp, u) => {
        const r = rng(2022);
        const msgs = [];
        for (let i = 0; i < 18; i++) {
          const ai = i % 2 === 1;
          const lines = ai ? 2 + Math.floor(r() * 3) : 1;
          const ws = [];
          for (let l = 0; l < lines; l++) ws.push(ai ? 0.55 + r() * 0.45 : 0.35 + r() * 0.3);
          msgs.push({ ai, ws });
        }
        const shown = u * 2 + lp * (msgs.length - 2);
        let y = 0;
        const pos = [];
        msgs.forEach((m) => {
          const h = 16 + m.ws.length * 14;
          pos.push([y, h]);
          y += h + 10;
        });
        const head = shown >= 1 ? pos[Math.min(msgs.length - 1, Math.floor(shown))] : [0, 0];
        const scroll = Math.max(0, head[0] + head[1] - 330);
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 40, 360, 340);
        ctx.clip();
        msgs.forEach((m, i) => {
          const v = clamp(shown - i, 0, 1);
          if (v <= 0) return;
          const [yy, h] = pos[i];
          const bw = m.ai ? 330 : 200;
          const x = m.ai ? 0 : 360 - bw;
          const top = 44 + yy - scroll + (1 - v) * 20;
          ctx.globalAlpha = v;
          ctx.fillStyle = m.ai ? C.ink(1) : C.card(1);
          ctx.strokeStyle = C.ink(1);
          ctx.lineWidth = 2;
          ctx.fillRect(x, top, bw, h);
          ctx.strokeRect(x, top, bw, h);
          m.ws.forEach((w, l) => {
            ctx.fillStyle = m.ai ? C.paper(0.75) : C.ink(0.5);
            ctx.fillRect(x + 12, top + 12 + l * 14, (bw - 24) * w * (l === m.ws.length - 1 ? v : 1), 6);
          });
          ctx.globalAlpha = 1;
        });
        ctx.restore();

        const tx = 400;
        const ts = 70;
        for (let k = 0; k < 20; k++) {
          const v = smooth(u * 2 + lp * 22 - k * 1.05);
          if (v <= 0) continue;
          const cx = tx + (k % 5) * (ts + 6);
          const cy = 44 + Math.floor(k / 5) * (ts + 6);
          const z = ts * v;
          ctx.save();
          ctx.translate(cx + ts / 2, cy + ts / 2);
          ctx.beginPath();
          ctx.rect(-z / 2, -z / 2, z, z);
          ctx.clip();
          ctx.fillStyle = k % 3 === 0 ? C.acc(1) : C.card(1);
          ctx.fillRect(-ts / 2, -ts / 2, ts, ts);
          ctx.fillStyle = C.ink(1);
          const kind = k % 4;
          if (kind === 0) {
            ctx.beginPath();
            ctx.arc(0, 4, 20, 0, Math.PI * 2);
            ctx.fill();
          } else if (kind === 1) {
            for (let l = -ts / 2; l < ts / 2; l += 8) ctx.fillRect(l, -ts / 2, 3, ts);
          } else if (kind === 2) {
            ctx.beginPath();
            ctx.moveTo(-26, 24);
            ctx.lineTo(0, -24);
            ctx.lineTo(26, 24);
            ctx.closePath();
            ctx.fill();
          } else {
            for (let a = 0; a < 5; a++) for (let b = 0; b < 5; b++) if ((a + b + k) % 2) ctx.fillRect(-ts / 2 + a * 14, -ts / 2 + b * 14, 14, 14);
          }
          ctx.restore();
          ctx.strokeStyle = C.ink(1);
          ctx.lineWidth = 2;
          ctx.strokeRect(cx + (ts - z) / 2, cy + (ts - z) / 2, z, z);
        }
        const users = Math.round(1e8 * smooth((lp - 0.3) / 0.4));
        label(`${(users / 1e6).toFixed(0)}M USERS`, tx, 372, 44, 1, 800, "Barlow Condensed");
        label("CHATGPT · 2 个月破亿", tx + 4, 390, 11, 0.55, 500, "Noto Sans SC");
      },
      // 06 思考树
      (lp, u) => {
        const D = 4;
        const nodes = [];
        const r = rng(2024);
        const build = (d, y0, y1, path) => {
          const y = (y0 + y1) / 2;
          const node = { d, y, path, kids: [] };
          nodes.push(node);
          if (d < D) {
            const k = d < 2 ? 3 : 2;
            for (let i = 0; i < k; i++) node.kids.push(build(d + 1, y0 + ((y1 - y0) * i) / k, y0 + ((y1 - y0) * (i + 1)) / k, path + i));
          }
          node.prune = d > 1 && r() < 0.32;
          return node;
        };
        const root = build(0, 50, 380, "");
        const best = "1101";
        const nx = (d) => 10 + d * 172;
        const reveal = u * 1.2 + lp * (D + 1);
        const walk = (nd) => {
          nd.kids.forEach((kd) => {
            const v = clamp(reveal - kd.d, 0, 1);
            if (v <= 0) return;
            const on = best.startsWith(kd.path) && lp > 0.55;
            ctx.strokeStyle = on ? C.ink(1) : C.ink(0.3);
            ctx.lineWidth = on ? 4 : 1.5;
            ctx.beginPath();
            ctx.moveTo(nx(nd.d), nd.y);
            const mx = lerp(nx(nd.d), nx(kd.d), 0.5);
            ctx.lineTo(lerp(nx(nd.d), mx, clamp(v * 2, 0, 1)), nd.y);
            if (v > 0.5) {
              ctx.lineTo(mx, lerp(nd.y, kd.y, clamp(v * 2 - 1, 0, 1)));
              if (v >= 1) ctx.lineTo(nx(kd.d), kd.y);
            }
            ctx.stroke();
            walk(kd);
          });
        };
        walk(root);
        nodes.forEach((nd) => {
          const v = clamp(reveal - nd.d, 0, 1);
          if (v < 1) return;
          const on = best.startsWith(nd.path) && lp > 0.55;
          const z = on ? 12 : 8;
          ctx.fillStyle = on ? C.acc(1) : nd.prune && lp > 0.75 ? C.red(0.8) : C.card(1);
          ctx.strokeStyle = C.ink(1);
          ctx.lineWidth = 2;
          ctx.fillRect(nx(nd.d) - z / 2, nd.y - z / 2, z, z);
          ctx.strokeRect(nx(nd.d) - z / 2, nd.y - z / 2, z, z);
        });
        const steps = ["THINK", "PLAN", "ACT", "CHECK", "ANSWER"];
        const sv = clamp(lp * 1.3, 0, 1) * steps.length;
        label(steps.filter((_, i) => sv > i).join("  →  "), 0, 30, 15, 0.85, 700);
      },
      // 07 发布浪潮
      (lp, u, p, ph) => {
        for (let j = 0; j < 6; j++) {
          ctx.strokeStyle = C.ink(0.14 + j * 0.03);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          for (let x = 0; x <= 760; x += 8) {
            const y = 120 + j * 40 + Math.sin(x / 70 + p * 1.4 + j * 0.8) * (14 + j * 3) * u;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        const evs = M.events.slice(ph.start, ph.end + 1);
        const bw = Math.min(40, 700 / evs.length - 14);
        const Hh = { high: 250, mid: 180, low: 120 };
        evs.forEach((e, i) => {
          const v = smooth(u * 1.5 + lp * (evs.length + 1) - i);
          const h = (Hh[e.impact] || 190) * v;
          const x = 10 + i * (bw + 14);
          ctx.fillStyle = e.impact === "high" ? C.ink(1) : C.card(1);
          ctx.strokeStyle = C.ink(1);
          ctx.lineWidth = 2;
          ctx.fillRect(x, 360 - h, bw, h);
          ctx.strokeRect(x, 360 - h, bw, h);
          if (v > 0.6) {
            ctx.save();
            ctx.translate(x + bw / 2 + 5, 352);
            ctx.rotate(-Math.PI / 2);
            ctx.font = '700 14px "Barlow Condensed", "Noto Sans SC", sans-serif';
            ctx.fillStyle = e.impact === "high" ? C.paper(1) : C.ink(0.9);
            let s = e.title;
            while (s.length > 1 && ctx.measureText(s).width > h - 16) s = s.slice(0, -1);
            ctx.fillText(s, 0, 0);
            ctx.restore();
          }
          label(e.date.slice(5, 7), x + bw / 2 - 7, 378, 11, 0.6);
        });
        const cnt = Math.round(evs.length * clamp(lp * 1.1, 0, 1));
        label(`${ph.y0} · ${pad(cnt)} 次值得记下的发布`, 0, 30, 15, 0.85, 700, "Noto Sans SC");
      },
      // 08 临界
      (lp, u, p, ph, Hm) => {
        const off = (p * 46) % 32;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 44, 760, 34);
        ctx.clip();
        for (let x = -64; x < 800; x += 32) {
          ctx.fillStyle = C.acc(1);
          ctx.beginPath();
          ctx.moveTo(x + off, 78);
          ctx.lineTo(x + off + 16, 44);
          ctx.lineTo(x + off + 32, 44);
          ctx.lineTo(x + off + 16, 78);
          ctx.fill();
        }
        ctx.restore();
        ctx.strokeStyle = C.ink(1);
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 44, 760, 34);

        label("CRITICAL", 0, 190, 120, 1, 800, "Barlow Condensed");
        ctx.fillStyle = C.red(1);
        ctx.fillRect(470, 104, 290, 90);
        ctx.font = '800 64px "Barlow Condensed", sans-serif';
        ctx.fillStyle = C.paper(1);
        ctx.fillText("≤ 25%", 492, 172);

        const cellsN = 50;
        const keep = (Hm / 100) * cellsN;
        for (let i = 0; i < cellsN; i++) {
          const x = i * 15.2;
          const v = clamp(keep - i, 0, 1);
          ctx.strokeStyle = C.ink(0.35);
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, 230.5, 12, 54);
          if (v > 0) {
            ctx.fillStyle = i < cellsN / 4 ? C.red(1) : C.ink(1);
            ctx.fillRect(x, 230 + 54 * (1 - v), 13, 54 * v);
          }
        }
        ctx.fillStyle = C.red(1);
        ctx.fillRect(cellsN * 0.25 * 15.2 - 2, 220, 3, 76);
        const crit = M.leaves.filter((l) => l.remaining <= CRIT).length;
        const cv = Math.round(crit * smooth(lp * 1.2));
        label(`${pad(cv)} / ${M.leaves.length}`, 0, 356, 64, 1, 800, "Barlow Condensed");
        const tw = ctx.measureText(`${pad(cv)} / ${M.leaves.length}`).width;
        label("项观察已进入临界区（人类剩余 ≤ 25%）", tw + 16, 348, 16, 0.8, 700, "Noto Sans SC");
      },
    ];

    function drawMotifs(p, Hm) {
      const P = M.phases;
      const bAt = (k) => (k <= 0 ? 1 : k >= P.length ? 0 : smooth(p - P[k].start + 1));
      const edges = [];
      P.forEach((ph, k) => {
        const bIn = bAt(k);
        const bOut = bAt(k + 1);
        const x0 = (1 - bIn) * MR.w;
        const x1 = (1 - bOut) * MR.w;
        if (x1 - x0 < 1) return;
        if (bIn > 0 && bIn < 1) edges.push(x0);
        const u = Math.min(bIn, 1 - bOut * 0.6);
        const lp = clamp((p - ph.start + 0.5) / (ph.end - ph.start + 1), 0, 1);
        const drift = (1 - bIn) * 70 - bOut * 70;
        ctx.save();
        ctx.beginPath();
        ctx.rect(MR.x + x0, 0, x1 - x0, 624);
        ctx.clip();
        ctx.translate(MR.x + drift, MR.y);
        ctx.textAlign = "left";
        label(`FIG.${pad(ph.no)} — ${(STORY[ph.name] || [ph.name])[0]}`, 0, -6, 12, 0.7, 700);
        ctx.fillStyle = C.ink(0.5);
        ctx.fillRect(0, 2, MR.w * u, 1);
        (MOTIF[k % MOTIF.length])(lp, u, p, ph, Hm);
        ctx.restore();
      });
      edges.forEach((x) => {
        ctx.fillStyle = C.acc(1);
        ctx.fillRect(MR.x + x - 3, MR.y - 20, 6, MR.h + 24);
        ctx.strokeStyle = C.ink(1);
        ctx.lineWidth = 1.5;
        ctx.strokeRect(MR.x + x - 3, MR.y - 20, 6, MR.h + 24);
      });
    }

    function storyAt(p) {
      const P = M.phases;
      let best = null;
      P.forEach((ph) => {
        const a = ph.start === 0 ? 1 : (p - ph.start + 0.55) / 0.55;
        const b = (ph.end + 0.5 - p) / 0.45;
        const v = clamp(Math.min(a, b), 0, 1);
        if (v > 0 && (!best || v > best.v)) best = { ph, v };
      });
      return best;
    }

    /* ---------- 信息条槽位 ---------- */

    function titleSize(s) {
      let u = 0;
      for (const ch of s) u += ch === " " ? 0.24 : isCJK(ch) ? 0.92 : /[A-Z0-9]/.test(ch) ? 0.5 : 0.42;
      const one = 590 / u;
      if (one >= 46) return Math.min(one, 66);
      return clamp((590 * 1.85) / u, 28, 44);
    }

    function fill(slot, i) {
      if (i < 0 || i >= n) {
        slot.innerHTML = "";
        return [];
      }
      const e = M.events[i];
      const lvl = { low: 1, mid: 2, high: 3 }[e.impact] || 2;
      const rows = e.leaves;
      const chips = rows.length
        ? `<div class="sl-chips">${rows
            .slice(0, 6)
            .map((l) => `<span class="sl-chip${l.remaining <= CRIT ? " is-crit" : ""}">${esc(l.name)}<b>${l.remaining}</b></span>`)
            .join("")}${rows.length > 6 ? `<span class="sl-chip">+${rows.length - 6}</span>` : ""}</div>`
        : `<p class="sl-empty">未直接记入领域让渡，是其后 ${n - 1 - i} 个节点的前置。</p>`;
      slot.innerHTML = `
        <div class="sl-meta" data-r="0">
          <p class="sl-date">${fmtDate(e.date)}</p>
          <p class="sl-no"><span class="sl-era">${esc(e.era)}</span>No.${pad(i + 1, 3)} / ${pad(n, 3)}</p>
          <p class="sl-imp" data-level="${e.impact || "mid"}">${[1, 2, 3].map((v) => `<i class="${v <= lvl ? "is-on" : ""}"></i>`).join("")}<b>${(e.impact || "mid").toUpperCase()}</b></p>
        </div>
        <h3 class="sl-title" data-r="1" style="--fs:${titleSize(e.title).toFixed(1)}px">${[...e.title].map((c) => (isCJK(c) ? `<span class="cjk">${esc(c)}</span>` : esc(c))).join("")}</h3>
        <p class="sl-blurb" data-r="2">${esc(e.blurb || "")}</p>
        <div class="sl-rep" data-r="3">
          <p class="sl-rep-h">让渡记录<span>IMPACT</span><b>${pad(rows.length)}</b></p>
          ${chips}
        </div>`;
      return [...slot.querySelectorAll("[data-r]")];
    }

    /* ---------- 每帧渲染 ---------- */

    function yearFloat(ms) {
      const d = new Date(ms);
      const y = d.getUTCFullYear();
      const a = Date.UTC(y, 0, 1);
      return y + (ms - a) / (Date.UTC(y + 1, 0, 1) - a);
    }

    function odometer(yf) {
      const cols = el.year.querySelectorAll(".dg-col");
      const digits = [(Math.floor(yf) % 10) + smooth(((yf % 1) - 0.86) / 0.14)];
      let carry = Math.max(0, digits[0] - 9);
      for (let k = 1; k < 4; k++) {
        const base = Math.floor(yf / Math.pow(10, k)) % 10;
        digits[k] = base + carry;
        if (base !== 9) carry = 0;
      }
      for (let k = 0; k < 4; k++) {
        if (cols[3 - k]) set(cols[3 - k], "transform", `translateY(${(-digits[k]).toFixed(4)}em)`);
      }
    }

    function render(p, dt) {
      const k = clamp(Math.floor(p), 0, n - 2);
      const t = clamp(p - k, 0, 1);
      const sx = lerp(X[k], X[k + 1], t);
      const cam = sx - CX;

      set(el.track, "transform", `translate3d(${(-cam).toFixed(2)}px,0,0)`);
      set(el.grid, "--gx", `${(-cam * 0.3).toFixed(1)}px`);

      evEls.forEach((ev, i) => set(ev, "--f", smooth(1 - Math.abs(p - i) * 1.2).toFixed(3)));

      const e0 = M.events[k];
      const e1 = M.events[k + 1];
      const ms = lerp(e0.t, e1.t, t);
      odometer(yearFloat(ms));

      const span = Math.max(1, e1.t - e0.t) / YEAR;
      const rate = Math.min(99999, (X[k + 1] - X[k]) / span);
      rateS = rateS ? Math.exp(lerp(Math.log(rateS), Math.log(rate), 1 - Math.exp(-dt / 0.25))) : rate;
      el.rate.textContent = rateS >= 99999 ? "∞" : Math.round(rateS).toLocaleString("en-US");

      const Hm = humanAt(p);
      const hi = Math.floor(Hm);
      el.humanV.textContent = String(hi);
      el.humanD.textContent = "." + String(Math.floor((Hm - hi) * 10));
      el.humanBox.classList.toggle("is-crit", Hm <= CRIT);

      const st = storyAt(p);
      const key = st ? `${st.ph.no}:${Math.round(st.v * 200)}` : "";
      if (key !== storyKey) {
        storyKey = key;
        if (st) {
          const meta = STORY[st.ph.name] || [st.ph.name, ""];
          const text = meta[1].replace("{agg}", String(M.agg));
          el.storyPh.textContent = `PHASE ${pad(st.ph.no)} · ${st.ph.name}`;
          el.storyFig.textContent = `FIG.${pad(st.ph.no)} / ${meta[0]} · ${st.ph.y0}—${st.ph.y1}`;
          el.storyT.textContent = [...text].slice(0, Math.round(text.length * st.v)).join("");
        } else {
          el.storyT.textContent = "";
        }
      }

      if (p !== lastP || dirty) {
        lastP = p;
        dirty = false;
        ctx.clearRect(0, 0, 1920, 624);
        drawMotifs(p, Hm);
        drawGlyph(p, Hm);
      }

      if (slotK !== k) {
        slotK = k;
        rowsA = fill(el.slotA, k);
        rowsB = fill(el.slotB, k + 1);
      }
      rowsA.forEach((r, j) => set(r, "--e", (1 - smooth((t - 0.08 - j * 0.06) / 0.32)).toFixed(3)));
      rowsB.forEach((r, j) => set(r, "--e", smooth((t - 0.42 - j * 0.06) / 0.32).toFixed(3)));
      set(el.scan, "transform", `translate3d(${((0.02 + 0.96 * t) * SLOTS_W).toFixed(1)}px,0,0)`);
      set(el.scan, "opacity", Math.sin(Math.PI * t).toFixed(3));

      const fx = lerp(xs[k], xs[k + 1], t);
      set(el.ovHead, "transform", `translate3d(${(fx * AXIS_W).toFixed(2)}px,0,0)`);

      const near = Math.round(p);
      if (near !== nearK) {
        nearK = near;
        const ph = M.events[near].phase;
        el.phases.querySelectorAll(".ph").forEach((b, i) => b.classList.toggle("is-on", i === ph));
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

      const w = dragging ? 24 : 4.6;
      vel += (w * w * (target - pos) - 2 * w * vel) * dt;
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
      window.addEventListener("resize", resize);

      const scale = () => Number(stage.style.getPropertyValue("--s")) || 1;
      let lastX = 0;
      let lastMoveT = 0;
      let v = 0;
      el.hit.addEventListener("pointerdown", (ev) => {
        dragging = true;
        setPlaying(false);
        try {
          el.hit.setPointerCapture(ev.pointerId);
        } catch (_) {
          /* 合成事件没有可捕获的指针 */
        }
        el.hit.classList.add("is-drag");
        lastX = ev.clientX;
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
        const dp = -dx / (X[k + 1] - X[k]);
        target = clamp(target + dp, 0, n - 1);
        v = v * 0.6 + (dp / Math.max(1, now - lastMoveT)) * 1000 * 0.4;
        lastMoveT = now;
      });
      const up = () => {
        if (!dragging) return;
        dragging = false;
        el.hit.classList.remove("is-drag");
        if (performance.now() - lastMoveT > 120) v = 0;
        lastDir = Math.sign(v);
        target = clamp(target + clamp(v * 0.22, -3, 3), 0, n - 1);
        lastInput = 0;
      };
      el.hit.addEventListener("pointerup", up);
      el.hit.addEventListener("pointercancel", up);

      let ovDrag = false;
      const ovTo = (ev) => {
        const r = el.overview.getBoundingClientRect();
        const f = clamp((ev.clientX - r.left) / r.width, 0, 1);
        let k = 0;
        while (k < n - 2 && xs[k + 1] < f) k++;
        target = clamp(k + (f - xs[k]) / (xs[k + 1] - xs[k] || 1), 0, n - 1);
      };
      el.overview.addEventListener("pointerdown", (ev) => {
        ovDrag = true;
        dragging = true;
        setPlaying(false);
        el.overview.setPointerCapture(ev.pointerId);
        ovTo(ev);
      });
      el.overview.addEventListener("pointermove", (ev) => ovDrag && ovTo(ev));
      const ovUp = () => {
        if (!ovDrag) return;
        ovDrag = false;
        dragging = false;
        lastDir = 0;
        lastInput = 0;
      };
      el.overview.addEventListener("pointerup", ovUp);
      el.overview.addEventListener("pointercancel", ovUp);
    }

    function enter() {
      lastT = performance.now();
      settledAt = 0;
      edgeAt = 0;
      dirty = true;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    }

    function leave() {
      cancelAnimationFrame(raf);
    }

    return { layout, bind, enter, leave, step, toggle, wheel, setPlaying, recolor };
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
