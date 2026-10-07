(() => {
  "use strict";

  const W = 1920;
  const H = 1080;
  const CRIT = 25;
  const SCENES = ["cover", "timeline", "domains", "ledger"];
  const HINTS = [
    "滚轮 / ↑ ↓ 切换章节 · T 切换配色",
    "拖动 / 滚轮连续推进 · ← → 逐事件 · 空格暂停 · 悬停暂停 · 滚到两端换章",
    "↑ ↓ 切换领域 · 点击叶节点展开注释 · PageUp / PageDown 换章",
    "悬停柱体查看详情 · 悬停图例按领域筛选 · ↑ ↓ 换章",
  ];

  const ERA_EN = {
    奠基: "FOUNDATION",
    专用智能: "NARROW AI",
    深度学习: "DEEP LEARNING",
    Transformer: "TRANSFORMER",
    生成爆发: "GENERATIVE",
    推理与代理: "REASONING",
    "2025 浪潮": "SURGE",
    "2026 临界": "THRESHOLD",
  };

  const ERA_WASH = {
    奠基: "#c4b49a",
    专用智能: "#e0b2a2",
    深度学习: "#b7c6e6",
    Transformer: "#ead56a",
    生成爆发: "#e7b4c4",
    推理与代理: "#a9d8cb",
    "2025 浪潮": "#efc15a",
    "2026 临界": "#ee8d7c",
  };

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
    events.forEach((e, i) => {
      const last = phases[phases.length - 1];
      if (!last || last.name !== e.era) phases.push({ name: e.era, start: i, end: i });
      else last.end = i;
    });
    phases.forEach((p, k) => {
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

  let queuedScene = null;

  function go(n) {
    n = clamp(n, 0, SCENES.length - 1);
    if (n === scene) return;
    if (busy) {
      queuedScene = n;
      return;
    }
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
      if (queuedScene != null && queuedScene !== scene) {
        const next = queuedScene;
        queuedScene = null;
        go(next);
      } else {
        queuedScene = null;
      }
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
    if (!THEMES.includes(t) || t === document.documentElement.dataset.theme) return;
    const apply = () => {
      document.documentElement.dataset.theme = t;
      try {
        localStorage.setItem("he-theme", t);
      } catch (_) {
        /* 隐私模式下不持久化 */
      }
      markTheme();
    };
    if (reduce || busy) {
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
      b.addEventListener("click", () => {
        if (b.dataset.dm != null) DM.arm(Number(b.dataset.dm));
        go(Number(b.dataset.go));
      });
    });

    const scrollable = (node, dy) => {
      let el = node instanceof Element ? node : null;
      while (el && el !== document.body) {
        const s = getComputedStyle(el);
        if ((s.overflowY === "auto" || s.overflowY === "scroll") && el.scrollHeight > el.clientHeight + 2) {
          if (dy > 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 1) return el;
          if (dy < 0 && el.scrollTop > 1) return el;
        }
        el = el.parentElement;
      }
      return null;
    };

    window.addEventListener(
      "wheel",
      (e) => {
        const sc = scrollable(e.target, e.deltaY);
        if (sc) {
          sc.scrollTop += e.deltaY;
          e.preventDefault();
          return;
        }
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
      if (e.target instanceof Element && e.target.closest("input, textarea")) return;
      if (scene === 2 && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        e.preventDefault();
        DM.move(e.key === "ArrowDown" ? 1 : -1);
        return;
      }
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

    let tx = null;
    let ty = null;
    let touchScrub = false;
    window.addEventListener(
      "touchstart",
      (e) => {
        const t = e.touches[0];
        tx = t.clientX;
        ty = t.clientY;
        const hit = e.target instanceof Element ? e.target.closest("#tl-hit, #axis, .tl-ctrl, #hud-nav, #theme, .dm-list, .dd-leaves, .lg-bars, .lg-legend, a, button") : null;
        touchScrub = !!hit;
      },
      { passive: true }
    );
    window.addEventListener("touchend", (e) => {
      if (ty == null) return;
      const t = e.changedTouches[0];
      const dy = ty - t.clientY;
      const dx = (tx ?? t.clientX) - t.clientX;
      ty = null;
      tx = null;
      if (touchScrub) return;
      if (Math.abs(dy) > 72 && Math.abs(dy) > Math.abs(dx) * 1.35) go(scene + (dy > 0 ? 1 : -1));
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

      $("#cover-domains").innerHTML = domains
        .map(
          (d) => `<button type="button" data-go="2" data-dm="${d.no - 1}" class="${d.avg <= CRIT ? "is-crit" : ""}" title="${esc(d.name)} ${d.avg}%">
            <span class="cd-name"><b>${pad(d.no)}</b>${esc(d.name)}</span>
            <span class="cd-val">${d.avg}<small>%</small></span>
            <i style="--v:${d.avg}"></i>
          </button>`
        )
        .join("");
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
     01 时间轴：拖动驱动的图形叙事
     唯一状态是浮点位置 pos（单位：事件序号）。时间轨平移、推演曲线、
     机器领地、每个事件的图形分镜（展开 / 漂移 / 收起）、文字擦除、
     年份里程表全部是 pos 的函数——拖到哪里，画面就停在哪一帧。
     ========================================================== */

  const TL = (() => {
    const S = 180;
    const HEAD_X = 960;
    const ART_X = 740;
    const ART_Y = 150;
    const AXIS_W = 1680;
    const COL_W = 600;

    let n = 0;
    const RX = [];
    let xs = [];
    let xMin = 0;
    let xMax = 0;
    let items = [];
    let leafCurve = [];

    let pos = -0.9;
    let vel = 0;
    let target = 0;
    let intent = !reduce;
    let suspend = false;
    let playing = intent;
    let dragging = false;
    let edgeAt = 0;
    let raf = 0;
    let lastT = 0;
    let slotK = -2;
    let nearK = -1;
    let rowsA = [];
    let rowsB = [];
    let evEls = [];
    let tickEls = [];
    let phaseEls = [];
    let washRGB = [];
    let clipW = -1;
    const cache = new Map();

    const el = {
      bg: $(".tl-bg"),
      year: $("#tl-year"),
      zone: $("#zone"),
      zoneH: $("#zone-h"),
      zoneM: $("#zone-m"),
      art: $("#art"),
      hit: $("#tl-hit"),
      slotA: $("#slot-a"),
      slotB: $("#slot-b"),
      scan: $("#slot-scan"),
      world: $("#rail-world"),
      ero: $("#erosion"),
      years: $("#rail-years"),
      railPh: $("#rail-phases"),
      events: $("#rail-events"),
      rhVal: $("#rh-val"),
      rhH: $("#rh-h"),
      rhDate: $("#rh-date"),
      phases: $("#axis-phases"),
      body: $("#axis-body"),
      ticks: $("#axis-ticks"),
      axYears: $("#axis-years"),
      progress: $("#axis-progress"),
      head: $("#playhead"),
      play: $("#ac-play"),
      timer: $("#ac-timer"),
      scene: $("#timeline"),
    };
    let xAtTime = (t) => t;

    const smooth = (x) => {
      const v = clamp(x, 0, 1);
      return v * v * (3 - 2 * v);
    };

    function set(elm, prop, val) {
      let c = cache.get(elm);
      if (!c) cache.set(elm, (c = {}));
      if (c[prop] === val) return;
      c[prop] = val;
      if (prop[0] === "-") elm.style.setProperty(prop, val);
      else elm.style[prop] = val;
    }

    const railX = (p) => {
      if (p <= 0) return RX[0] + p * S;
      if (p >= n - 1) return RX[n - 1] + (p - n + 1) * S;
      const k = Math.floor(p);
      return RX[k] + (RX[k + 1] - RX[k]) * (p - k);
    };

    /* ---------- 人类剩余推演（示意） ---------- */

    function human(p) {
      if (!leafCurve.length) return 100;
      let s = 0;
      for (const c of leafCurve) {
        if (c.j >= 0) s += c.rem + (100 - c.rem) * (1 - smooth((p - (c.j - 0.6)) / 0.6));
        else s += 100 - (100 - c.rem) * clamp((p - c.a) / (c.b - c.a), 0, 1);
      }
      return s / leafCurve.length;
    }

    const curveY = (h) => 10 + ((100 - h) * 90) / 70;

    /* ---------- 图形分镜 ---------- */

    const R = (x, y, cls, html, o) => ({ x, y, cls, html: html ?? "", ...o });

    function scenes() {
      const v = [];
      const add = (at, list, until) => v.push({ at, until, items: list });

      const tubes = [];
      for (let r = 0; r < 4; r++)
        for (let c = 0; c < 8; c++) {
          const k = r * 8 + c;
          tubes.push(R(900 + c * 64, 290 + r * 56, `v-dot${(k * 7) % 5 === 0 ? " is-lit" : ""}`, "", { w: 30, h: 30, style: `--k:${k}`, f: { s: 0, o: 0 }, t: { s: 0, o: 0 }, d: k * 0.006, od: c * 0.012, dr: 40 }));
        }
      add("ENIAC 公开亮相", [
        ...tubes,
        R(900, 486, "v-cap", "ENIAC<em>ELECTRONIC NUMERICAL INTEGRATOR AND COMPUTER</em>", { c: "l", tc: "l", d: 0.1 }),
        R(900, 528, "v-mono", "<b>17,468</b> VACUUM TUBES · <b>5,000</b> ADD / SEC", { c: "l", tc: "l", d: 0.16 }),
        R(1460, 290, "v-hatch", "", { w: 300, h: 168, c: "b", tc: "t", d: 0.05, dr: 90 }),
        R(1460, 470, "v-disp", "30 TONS", { style: "font-size:64px", f: { y: 30, o: 0 }, d: 0.12, dr: 90 }),
      ]);

      add("图灵《计算机器与智能》", [
        R(880, 230, "v-glyph", "“", { style: "font-size:260px", f: { y: -60, o: 0 }, t: { y: 40, o: 0 }, dr: 30 }),
        R(1640, 270, "v-vert v-cn", "机器能思考吗？", { style: "font-size:64px", c: "t", tc: "b", d: 0.08, dr: 120 }),
        R(900, 420, "v-out", "CAN MACHINES<br />THINK?", { style: "font-size:84px", c: "l", tc: "l", d: 0.04, dr: 70 }),
        R(904, 600, "v-mono", "A. M. TURING · <b>MIND</b> VOL. LIX · THE IMITATION GAME", { c: "l", tc: "l", d: 0.14 }),
      ]);

      const ten = Array.from({ length: 10 }, (_, k) =>
        R(1290 + (k % 5) * 56, 300 + Math.floor(k / 5) * 56, `v-sq${k === 4 ? " is-acc" : ""}`, "", { w: 40, h: 40, f: { y: -80, r: 90, o: 0 }, t: { y: 60, o: 0 }, d: k * 0.015, od: k * 0.01, dr: 60 })
      );
      add("达特茅斯人工智能夏季研讨班", [
        R(880, 236, "v-out", "AI", { style: "font-size:330px", f: { s: 1.5, o: 0 }, t: { s: 0.8, o: 0 }, dr: 50 }),
        ...ten,
        R(1290, 430, "v-cap", "1956 · 夏<em>THE TERM IS COINED</em>", { c: "l", tc: "l", d: 0.12 }),
        R(1290, 470, "v-mono", "<b>10</b> 位学者 · <b>2</b> 个月 · 让机器使用语言", { c: "l", tc: "l", d: 0.18 }),
      ]);

      add("感知机 Perceptron", [
        R(900, 280, "", `<svg viewBox="0 0 560 250"><path class="ln" pathLength="1" d="M0 20 L320 125 M0 90 L320 125 M0 160 L320 125 M0 230 L320 125"/><circle class="ln thick" pathLength="1" cx="360" cy="125" r="40"/><path class="ln acc" pathLength="1" d="M400 125 L560 125"/></svg>`, { w: 560, h: 250, draw: true, c: "l", tc: "r", dr: 50 }),
        ...[20, 90, 160, 230].map((y, k) => R(890, 270 + y, "v-dot is-ink", "", { w: 20, h: 20, f: { s: 0, o: 0 }, t: { s: 0, o: 0 }, d: k * 0.03, dr: 50 })),
        R(1500, 370, "v-disp", "Σ w·x &gt; 0", { style: "font-size:64px", f: { x: 60, o: 0 }, d: 0.14, dr: 110 }),
        R(904, 570, "v-mono", "MARK I · <b>400</b> PHOTOCELLS · 「一台会学习的机器」", { c: "l", tc: "l", d: 0.16 }),
      ]);

      add("ELIZA", [
        R(900, 280, "v-term", "", { w: 780, h: 240, c: "l", tc: "l", dr: 40 }),
        R(932, 330, "v-tline is-me", "&gt; 我最近总是很难过。", { c: "l", tc: "l", d: 0.1, dr: 40 }),
        R(932, 384, "v-tline", "ELIZA: 你为什么觉得自己很难过？", { c: "l", tc: "l", d: 0.17, dr: 40 }),
        R(932, 438, "v-tline is-me", "&gt; ……也许是因为机器。", { c: "l", tc: "l", d: 0.24, dr: 40 }),
        R(904, 548, "v-mono", "DOCTOR SCRIPT · 人第一次向机器倾诉", { c: "l", tc: "l", d: 0.2 }),
      ]);

      add("反向传播登上 Nature", [
        ...[0, 1, 2, 3, 4].map((k) => R(1560 - k * 150, 260, "v-disp", "←", { style: "font-size:120px", f: { x: 90, o: 0 }, t: { x: -90, o: 0 }, d: k * 0.04, od: k * 0.02, dr: 60 + k * 14 })),
        R(900, 410, "v-out", "∂L / ∂w", { style: "font-size:132px", c: "r", tc: "l", d: 0.1, dr: 50 }),
        R(904, 580, "v-mono", "RUMELHART · HINTON · WILLIAMS · <b>NATURE 323</b>", { c: "l", tc: "l", d: 0.18 }),
      ]);

      add("LeCun 卷积网络识别邮编", [
        ..."07733".split("").map((d, k) => R(900 + k * 118, 290, "v-digit", d, { w: 100, h: 124, f: { y: -50, r: -10, o: 0 }, t: { y: 50, r: 8, o: 0 }, d: k * 0.04, od: k * 0.02, dr: 50 + k * 8 })),
        R(900, 448, "v-cap", "LeNet<em>BELL LABS · ZIP CODE READER</em>", { c: "l", tc: "l", d: 0.12 }),
        R(904, 492, "v-mono", "信封上的手写数字，第一次交给了卷积", { c: "l", tc: "l", d: 0.18 }),
      ]);

      const board = [];
      for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++)
          board.push(R(900 + c * 36, 262 + r * 36, (r + c) % 2 ? "v-tile-d" : "v-tile-l", "", { w: 36, h: 36, f: { s: 0, o: 0 }, t: { s: 0, o: 0 }, d: (r + c) * 0.012, od: (14 - r - c) * 0.008, dr: 40 }));
      add("深蓝击败卡斯帕罗夫", [
        ...board,
        R(1250, 236, "v-glyph", "♚\uFE0E", { style: "transform-origin:30% 90%", f: { y: -80, o: 0 }, t: { o: 0 }, mid: { p: [0.02, 0.36], r: -84, y: 40 }, d: 0.1, od: 0.22, dr: 30 }),
        R(1500, 300, "v-disp", "3½", { style: "font-size:150px", f: { x: 80, o: 0 }, d: 0.12, dr: 80 }),
        R(1500, 440, "v-disp v-dim", "2½", { style: "font-size:96px", f: { x: 80, o: 0 }, d: 0.16, dr: 80 }),
        R(904, 580, "v-mono", "DEEP BLUE <b>3½</b> / KASPAROV <b>2½</b> · 机器第一次在人类的棋盘上胜出", { c: "l", tc: "l", d: 0.18 }),
      ]);

      add("LSTM 长短期记忆", [
        R(880, 300, "", `<svg viewBox="0 0 900 140"><path class="ln thick" pathLength="1" d="M0 40 L900 40"/><path class="ln" pathLength="1" d="M0 110 L180 110 L220 40 M300 110 L420 110 L460 40 M540 110 L660 110 L700 40"/><circle class="ln red" pathLength="1" cx="220" cy="40" r="22"/><circle class="ln red" pathLength="1" cx="460" cy="40" r="22"/><circle class="ln red" pathLength="1" cx="700" cy="40" r="22"/></svg>`, { w: 900, h: 140, draw: true, c: "l", tc: "r", dr: 70 }),
        ...["FORGET", "INPUT", "OUTPUT"].map((g, k) => R(1074 + k * 240, 264, "v-mono", `<b>${g}</b> GATE`, { f: { y: -20, o: 0 }, d: 0.1 + k * 0.04, dr: 70 })),
        R(880, 470, "v-out", "MEMORY", { style: "font-size:120px", c: "l", tc: "l", d: 0.08, dr: 40 }),
      ]);

      const net = [];
      for (let r = 0; r < 4; r++)
        for (let c = 0; c < 14; c++) {
          const k = r * 14 + c;
          const h = ((k * 37) % 11) / 11;
          net.push(R(900 + c * 48, 286 + r * 48, h > 0.62 ? "v-tile-d" : h > 0.3 ? "v-gen" : "v-tile-l", "", { w: 42, h: 42, style: `--gx1:${20 + h * 60}%;--ga:${h * 180}deg`, f: { s: 0.2, o: 0 }, t: { s: 0.2, o: 0 }, d: h * 0.2, od: (c / 14) * 0.16, dr: 50 }));
        }
      add("ImageNet 数据集发布", [
        ...net,
        R(900, 492, "v-disp", "14,197,122", { style: "font-size:84px", c: "l", tc: "l", d: 0.12 }),
        R(1340, 520, "v-mono", "LABELED IMAGES · <b>21,841</b> 类", { c: "l", tc: "l", d: 0.18 }),
      ]);

      const wave = (x, y, cnt, pitch, w, amp, seed) =>
        Array.from({ length: cnt }, (_, k) => {
          const h = Math.max(6, Math.round(amp * Math.abs(Math.sin(k * 0.55 + seed) * Math.sin(k * 0.13 + seed * 2))));
          return R(x + k * pitch, y - h / 2, "v-wave", "", { w, h, f: { s: 0, o: 0 }, t: { s: 0, o: 0 }, d: (k / cnt) * 0.2, od: (k / cnt) * 0.1, dr: 50 });
        });
      add("Siri 随 iPhone 4S 上线", [
        R(900, 276, "v-bubble", "嘿 Siri，明天会下雨吗？", { c: "l", tc: "l", dr: 40 }),
        ...wave(900, 430, 40, 22, 10, 120, 1.3),
        R(904, 540, "v-mono", "2011.10.04 · iPhone 4S · 语音助手进入口袋", { c: "l", tc: "l", d: 0.16 }),
      ]);

      add("AlexNet 横扫 ImageNet", [
        ...[220, 184, 150, 118, 88, 60].map((s, k) =>
          R(920 + k * 108, 300 + (220 - s) / 2, "", `<i class="v-plane${k === 5 ? " is-acc" : ""}" style="display:block;width:100%;height:100%;transform:skewY(-16deg)"></i>`, { w: s * 0.62, h: s, f: { x: -k * 108, o: 0 }, t: { x: k * 60, o: 0 }, d: 0.02, od: k * 0.02, dr: 30 + k * 16 })
        ),
        R(1480, 290, "v-disp", "15.3%", { style: "font-size:120px", f: { y: 40, o: 0 }, d: 0.14, dr: 90 }),
        R(1484, 410, "v-mono", "TOP-5 ERROR · 第二名 <b>26.2%</b>", { c: "l", tc: "l", d: 0.2, dr: 90 }),
        R(924, 580, "v-mono", "<b>2 ×</b> GTX 580 · 深度学习从这里开始", { c: "l", tc: "l", d: 0.18 }),
      ]);

      add("Word2Vec 词向量", [
        R(880, 296, "v-disp", "KING − MAN + WOMAN ≈ <span style='color:var(--red)'>QUEEN</span>", { style: "font-size:66px", c: "l", tc: "l", dr: 50 }),
        R(900, 392, "", `<svg viewBox="0 0 640 190"><path class="ln" pathLength="1" d="M20 170 L260 30"/><path class="ln" pathLength="1" d="M360 170 L600 30"/><path class="ln red" pathLength="1" d="M20 170 L360 170 M260 30 L600 30"/></svg>`, { w: 640, h: 190, draw: true, d: 0.08, dr: 70 }),
        ...[["MAN", 900, 572], ["KING", 1150, 386], ["WOMAN", 1240, 572], ["QUEEN", 1490, 386]].map(([w, x, y], k) => R(x, y, "v-mono", `<b>${w}</b>`, { f: { y: 10, o: 0 }, d: 0.12 + k * 0.02, dr: 70 })),
      ]);

      add("生成对抗网络 GAN", [
        R(920, 300, "v-ink v-disp", "G", { w: 150, h: 150, style: "display:grid;place-items:center;font-size:110px", f: { x: -120, o: 0 }, t: { x: -120, o: 0 }, dr: 40 }),
        R(1430, 300, "v-accbox v-disp", "D", { w: 150, h: 150, style: "display:grid;place-items:center;font-size:110px", f: { x: 120, o: 0 }, t: { x: 120, o: 0 }, dr: 40 }),
        R(1090, 290, "", `<svg viewBox="0 0 320 170"><path class="ln thick" pathLength="1" d="M0 60 C 100 0, 220 0, 320 60"/><path class="ln red" pathLength="1" d="M320 110 C 220 170, 100 170, 0 110"/></svg>`, { w: 320, h: 170, draw: true, d: 0.1, dr: 40 }),
        R(924, 476, "v-cap", "生成器<em>FORGER</em>", { c: "l", tc: "l", d: 0.14, dr: 40 }),
        R(1434, 476, "v-cap", "判别器<em>DETECTIVE</em>", { c: "l", tc: "l", d: 0.16, dr: 40 }),
        R(924, 560, "v-mono", "两个网络互相欺骗，直到真假难辨", { c: "l", tc: "l", d: 0.2 }),
      ]);

      add("ResNet 残差网络", [
        R(900, 260, "v-disp", "x + F(x)", { style: "font-size:140px", c: "l", tc: "l", dr: 60 }),
        R(900, 420, "", `<svg viewBox="0 0 860 120"><path class="ln" pathLength="1" d="M0 100 L860 100"/><path class="ln red" pathLength="1" d="M40 100 C 40 10, 240 10, 240 100 M240 100 C 240 10, 440 10, 440 100 M440 100 C 440 10, 640 10, 640 100 M640 100 C 640 10, 840 10, 840 100"/></svg>`, { w: 860, h: 120, draw: true, d: 0.06, dr: 80 }),
        ...[0, 1, 2, 3, 4].map((k) => R(924 + k * 200, 506, "v-sq", "", { w: 32, h: 28, f: { s: 0, o: 0 }, t: { s: 0, o: 0 }, d: 0.08 + k * 0.03, dr: 80 })),
        R(904, 580, "v-mono", "<b>152</b> LAYERS · TOP-5 <b>3.57%</b> · 低于人类基准 5.1%", { c: "l", tc: "l", d: 0.18 }),
      ]);

      const go = [];
      const STONES = [[2, 2, 0], [6, 2, 1], [2, 6, 1], [6, 6, 0], [4, 4, 0], [3, 5, 1], [5, 3, 1], [4, 2, 0], [2, 4, 1], [5, 6, 0], [6, 4, 1], [3, 3, 0]];
      STONES.forEach(([c, r, w], k) => go.push(R(900 + c * 36 - 15, 270 + r * 36 - 15, `v-stone${w ? " is-w" : ""}`, "", { w: 30, h: 30, f: { s: 2, o: 0 }, t: { s: 0, o: 0 }, d: 0.06 + k * 0.012, od: k * 0.01, dr: 40 })));
      go.push(R(900 + 7 * 36 - 15, 270 + 1 * 36 - 15, "v-stone is-37", "", { w: 30, h: 30, f: { s: 3, o: 0 }, t: { s: 0, o: 0 }, d: 0.24, dr: 40 }));
      add("AlphaGo 击败李世石", [
        R(900, 270, "", `<svg viewBox="0 0 288 288"><path class="ln" pathLength="1" d="${Array.from({ length: 9 }, (_, i) => `M0 ${i * 36} L288 ${i * 36} M${i * 36} 0 L${i * 36} 288`).join(" ")}"/></svg>`, { w: 288, h: 288, draw: true, dr: 40 }),
        ...go,
        R(1290, 296, "v-disp", "MOVE 37", { style: "font-size:110px", c: "l", tc: "l", d: 0.12, dr: 80 }),
        R(1290, 400, "v-disp", "4 : 1", { style: "font-size:160px", f: { y: 40, o: 0 }, d: 0.16, dr: 80 }),
        R(904, 590, "v-mono", "AlphaGo vs 李世石 · 首尔 · 「那一手不是人类会下的棋」", { c: "l", tc: "l", d: 0.2 }),
      ]);

      add("WaveNet 生成语音", [
        R(890, 250, "v-out", "SPEECH", { style: "font-size:150px", c: "l", tc: "l", dr: 40 }),
        ...wave(900, 480, 72, 12, 6, 110, 2.1),
        R(904, 570, "v-mono", "<b>16,000</b> SAMPLES / SEC · 逐点生成的人声", { c: "l", tc: "l", d: 0.16 }),
      ]);

      const toks = ["Attention", "is", "all", "you", "need"];
      const tx = [880, 1094, 1170, 1270, 1388];
      add("Transformer", [
        R(870, 236, "v-out", "ATTENTION", { style: "font-size:170px", f: { s: 1.2, o: 0 }, t: { x: -200, o: 0 }, dr: 60 }),
        R(900, 400, "", `<svg viewBox="0 0 600 80"><path class="ln red" pathLength="1" d="M90 80 C 120 0, 230 0, 250 80 M90 80 C 140 -30, 330 -30, 350 80 M90 80 C 150 -60, 450 -60, 470 80 M290 80 C 330 20, 540 20, 580 80"/></svg>`, { w: 600, h: 80, draw: true, d: 0.1, dr: 50 }),
        ...toks.map((w, k) => R(tx[k], 484, "v-token", w, { f: { y: 30, o: 0 }, t: { y: -30, o: 0 }, d: 0.06 + k * 0.03, od: k * 0.02, dr: 50 })),
        R(884, 580, "v-mono", "VASWANI ET AL. · 2017 · <b>8 × P100</b> · 3.5 天", { c: "l", tc: "l", d: 0.2 }),
      ]);

      const P = [["GPT-1", 117e6, "117M"], ["GPT-2", 1.5e9, "1.5B"], ["GPT-3 / OpenAI API", 175e9, "175B"]];
      add(
        "GPT-1",
        [
          R(880, 286, "v-cap", "参数量<em>PARAMETERS · LINEAR SCALE</em>", { c: "l", tc: "l" }),
          ...P.flatMap(([at, v, lab], k) => [
            R(880, 320 + k * 64, "v-mono", `<b>${at.split(" ")[0]}</b>`, { at, c: "l", tc: "l", d: 0.05 }),
            R(990, 318 + k * 64, `v-bar${k === 2 ? " is-acc" : ""}`, "", { at, w: Math.max(3, (v / 175e9) * 800), h: 24, c: "l", tc: "l", d: 0.1 }),
            R(1000 + Math.max(3, (v / 175e9) * 800) + 10, 318 + k * 64, "v-mono", lab, { at, f: { x: -20, o: 0 }, d: 0.16, style: k === 2 ? "display:none" : "" }),
            R(1280, 500, "v-disp", lab, { at, u: at, style: "font-size:120px", f: { y: 50, o: 0 }, t: { y: -50, o: 0 }, d: 0.12, od: -0.05, dr: 60 }),
          ]),
        ],
        "GPT-3 / OpenAI API"
      );

      add("GitHub Copilot 技术预览", [
        R(900, 290, "v-code", "def is_human(task):", { c: "l", tc: "l", dr: 40 }),
        R(900, 330, "v-code", "    <i># TODO: 交给机器来写</i>", { c: "l", tc: "l", d: 0.08, dr: 40 }),
        R(900, 370, "v-code", "    return <b>False</b>", { c: "l", tc: "l", d: 0.16, dr: 40 }),
        R(900, 440, "v-accbox v-mono", "<b>TAB ↹</b> 接受建议", { style: "padding:8px 14px", f: { y: 20, o: 0 }, d: 0.2, dr: 40 }),
        R(904, 560, "v-mono", "由 Codex 驱动 · 代码开始自动补全自己", { c: "l", tc: "l", d: 0.2 }),
      ]);

      const helix = (ph) => {
        let d = "";
        for (let i = 0; i <= 60; i++) d += `${i ? "L" : "M"}${(i * 14).toFixed(0)} ${(90 + 70 * Math.sin(i * 0.32 + ph)).toFixed(1)} `;
        return d;
      };
      const rungs = Array.from({ length: 20 }, (_, i) => {
        const x = i * 42;
        const a = 90 + 70 * Math.sin((x / 14) * 0.32);
        const b = 90 + 70 * Math.sin((x / 14) * 0.32 + Math.PI);
        return `M${x} ${a.toFixed(1)} L${x} ${b.toFixed(1)}`;
      }).join(" ");
      add("AlphaFold 2 论文发表", [
        R(900, 270, "", `<svg viewBox="0 0 840 180"><path class="ln" pathLength="1" d="${rungs}"/><path class="ln thick" pathLength="1" d="${helix(0)}"/><path class="ln red" pathLength="1" d="${helix(Math.PI)}"/></svg>`, { w: 840, h: 180, draw: true, c: "l", tc: "r", dr: 60 }),
        R(900, 476, "v-disp", "GDT 92.4", { style: "font-size:96px", c: "l", tc: "l", d: 0.12 }),
        R(1300, 500, "v-mono", "CASP14 · 蛋白质结构 · <b>50 年</b>难题", { c: "l", tc: "l", d: 0.18 }),
      ]);

      add("Midjourney 开放测试", [
        R(900, 262, "v-mono", "/imagine <b>a city after the last human job</b> --v 3", { c: "l", tc: "l" }),
        ...Array.from({ length: 10 }, (_, k) => {
          const c = k % 5;
          const r = Math.floor(k / 5);
          const h = ((k * 53) % 17) / 17;
          return R(900 + c * 150, 304 + r * 146, "v-gen", "", { w: 136, h: 136, style: `--gx1:${20 + h * 60}%;--gy1:${70 - h * 40}%;--gx2:${80 - h * 50}%;--ga:${h * 180}deg`, f: { s: 0, r: -30 + h * 60, o: 0 }, t: { s: 0.6, o: 0 }, d: 0.04 + h * 0.16, od: c * 0.02, dr: 40 + r * 30 });
        }),
      ]);

      add("ChatGPT", [
        R(1250, 276, "v-bubble", "帮我写一封辞职信。", { f: { x: 60, o: 0 }, t: { y: -40, o: 0 }, dr: 50 }),
        R(900, 340, "v-bubble is-ai", "当然。以下是一封得体的辞职信……", { f: { x: -60, o: 0 }, t: { y: -40, o: 0 }, d: 0.08, dr: 50 }),
        R(1190, 404, "v-bubble", "……顺便帮我找份新工作。", { f: { x: 60, o: 0 }, t: { y: -40, o: 0 }, d: 0.16, dr: 50 }),
        R(900, 468, "v-disp", "100M", { style: "font-size:120px", c: "l", tc: "l", d: 0.14, dr: 80 }),
        R(1180, 520, "v-mono", "USERS IN <b>2</b> MONTHS · 史上增长最快的应用", { c: "l", tc: "l", d: 0.2, dr: 80 }),
      ]);

      const EX = [["律师资格考试", 90], ["SAT 数学", 89], ["GRE 语文", 99], ["生物奥赛", 99]];
      add("GPT-4", [
        R(900, 292, "v-cap", "考试成绩 · 人类考生百分位<em>PERCENTILE</em>", { c: "l", tc: "l" }),
        ...EX.flatMap(([lab, v], k) => [
          R(900, 350 + k * 62, "v-mono", `<b>${lab}</b>`, { c: "l", tc: "l", d: 0.04 + k * 0.03 }),
          R(1080, 348 + k * 62, "v-hatch", "", { w: 600, h: 26, c: "l", tc: "l", d: 0.04 + k * 0.03 }),
          R(1080, 348 + k * 62, "v-bar is-acc", "", { w: v * 6, h: 26, c: "l", tc: "l", d: 0.1 + k * 0.03 }),
          R(1700, 342 + k * 62, "v-disp", String(v), { style: "font-size:40px", f: { x: 30, o: 0 }, d: 0.16 + k * 0.02 }),
        ]),
      ]);

      add("Sora 技术预告", [
        R(760, 300, "v-film", `<div style="display:flex;gap:14px;padding:30px 14px">${Array.from({ length: 9 }, (_, k) => `<i class="v-frame" style="display:block;flex:none;width:186px;height:136px;filter:hue-rotate(${k * 12}deg)"></i>`).join("")}</div>`, { w: 1800, h: 196, c: "l", tc: "l", dr: 420 }),
        R(900, 530, "v-cap", "一行文字 → 60 秒视频<em>TEXT TO VIDEO</em>", { c: "l", tc: "l", d: 0.14 }),
      ]);

      add("o1-preview", [
        R(900, 250, "v-cn", "先想，再答。", { style: "font-size:84px", c: "l", tc: "l", dr: 40 }),
        R(910, 410, "", `<svg viewBox="0 0 780 20"><path class="ln" pathLength="1" d="M0 10 L780 10"/></svg>`, { w: 780, h: 20, draw: true, d: 0.04, dr: 60 }),
        ...Array.from({ length: 12 }, (_, k) => R(900 + k * 70, 410, `v-dot${k === 11 ? " is-lit" : ""}`, "", { w: 20, h: 20, f: { s: 0, o: 0 }, t: { s: 0, o: 0 }, d: k * 0.016, od: k * 0.01, dr: 60 })),
        R(904, 460, "v-mono", "THINKING… <b>37s</b> · 推理链长度成为新的算力", { c: "l", tc: "l", d: 0.2 }),
      ]);

      add("DeepSeek-R1", [
        R(880, 270, "v-out", "OPEN<br />WEIGHTS", { style: "font-size:150px", c: "l", tc: "l", dr: 60 }),
        R(1500, 296, "v-ink v-disp", "MIT", { style: "padding:10px 22px;font-size:60px", f: { r: -30, s: 2, o: 0 }, mid: { p: [0, 0.01], r: -8 }, d: 0.2, dr: 90 }),
        R(904, 560, "v-mono", "推理模型权重公开 · 训练成本据称 <b>$5.6M</b>", { c: "l", tc: "l", d: 0.18 }),
      ]);

      const agents = [];
      for (let r = 0; r < 5; r++)
        for (let c = 0; c < 7; c++) {
          const k = r * 7 + c;
          agents.push(R(900 + c * 44, 290 + r * 44, "v-sq is-off", "", { w: 34, h: 34, f: { o: 0 }, t: { o: 0 }, dr: 40 }));
          agents.push(R(900 + c * 44, 290 + r * 44, `v-sq${k % 9 === 4 ? " is-acc" : ""}`, "", { w: 34, h: 34, f: { s: 0, o: 0 }, t: { s: 0, o: 0 }, d: 0.05 + (k / 35) * 0.2, od: (k / 35) * 0.1, dr: 40 }));
        }
      add("Claude Opus 4 / Sonnet 4", [
        ...agents,
        R(1260, 260, "v-disp", "7h", { style: "font-size:200px", f: { y: 40, o: 0 }, d: 0.12, dr: 80 }),
        R(1264, 470, "v-cap", "连续自主工作<em>AGENTIC CODING</em>", { c: "l", tc: "l", d: 0.18, dr: 80 }),
      ]);

      add("AlphaZero", [
        ...["围棋", "将棋", "国际象棋"].map((lab, k) =>
          R(900 + k * 250, 280, "v-ink v-disp", lab, {
            w: 220,
            h: 150,
            style: "display:grid;place-items:center;font-size:42px;font-family:var(--f-sans);font-weight:900",
            f: { y: -40 - k * 20, r: -8 + k * 8, o: 0 },
            t: { y: 30, o: 0 },
            d: k * 0.05,
            dr: 40 + k * 20,
          })
        ),
        R(900, 470, "v-out", "ONE NET", { style: "font-size:120px", c: "l", tc: "l", d: 0.12, dr: 50 }),
        R(904, 590, "v-mono", "从零自对弈 · 围棋 / 国际象棋 / 将棋", { c: "l", tc: "l", d: 0.18 }),
      ]);

      add("BERT", [
        R(900, 300, "v-token", "the", { f: { x: -30, o: 0 }, d: 0.02, dr: 30 }),
        R(1040, 300, "v-token", "[MASK]", { style: "background:var(--y)", f: { s: 1.4, o: 0 }, d: 0.08, dr: 20 }),
        R(1280, 300, "v-token", "sat", { f: { x: 30, o: 0 }, d: 0.14, dr: 30 }),
        R(900, 400, "", `<svg viewBox="0 0 520 80"><path class="ln red" pathLength="1" d="M40 70 C 80 0, 200 0, 250 40 M460 70 C 420 0, 300 0, 250 40"/></svg>`, { w: 520, h: 80, draw: true, d: 0.1, dr: 40 }),
        R(900, 510, "v-out", "BOTH WAYS", { style: "font-size:110px", c: "l", tc: "l", d: 0.12 }),
        R(904, 620, "v-mono", "双向掩码预训练 · 多项理解基准被刷新", { c: "l", tc: "l", d: 0.18 }),
      ]);

      add("Stable Diffusion 公开发布", [
        ...Array.from({ length: 12 }, (_, k) => {
          const c = k % 6;
          const r = Math.floor(k / 6);
          const h = ((k * 47) % 13) / 13;
          return R(900 + c * 92, 280 + r * 92, "v-gen", "", {
            w: 80,
            h: 80,
            style: `--gx1:${15 + h * 70}%;--gy1:${20 + h * 50}%;--ga:${h * 160}deg`,
            f: { s: 0.2, o: 0 },
            t: { s: 0.4, o: 0 },
            d: h * 0.18,
            dr: 30,
          });
        }),
        R(1480, 290, "v-disp", "OPEN", { style: "font-size:92px", f: { x: 40, o: 0 }, d: 0.1, dr: 70 }),
        R(1484, 390, "v-mono", "LATENT · 消费级硬件可跑", { c: "l", tc: "l", d: 0.16, dr: 70 }),
      ]);

      add("LLaMA", [
        R(880, 270, "v-out", "LLAMA", { style: "font-size:180px", c: "l", tc: "l", dr: 40 }),
        ...[0, 1, 2, 3].map((k) =>
          R(900 + k * 36, 470, "v-sq", "", { w: 28, h: 120 - k * 16, f: { y: 40, o: 0 }, t: { y: -20, o: 0 }, d: 0.08 + k * 0.04, dr: 20 })
        ),
        R(1100, 490, "v-cap", "研究权重<em>OPEN-WEIGHT RACE</em>", { c: "l", tc: "l", d: 0.14 }),
        R(904, 600, "v-mono", "开源基座竞赛从这里拉开", { c: "l", tc: "l", d: 0.2 }),
      ]);

      add("GPT-6 Astra", [
        R(870, 230, "v-out", "AGI?", { style: "font-size:340px", f: { s: 1.6, o: 0 }, t: { s: 0.9, o: 0 }, dr: 50 }),
        R(904, 580, "v-mono", "门槛被再次移动 · 没有人能说清它跨过了没有", { c: "l", tc: "l", d: 0.2 }),
      ]);

      add("Claude Opus 5.5", [
        R(900, 280, "v-cap", "运行成本<em>VS OPUS 5</em>", { c: "l", tc: "l" }),
        R(900, 360, "v-mono", "<b>OPUS 5</b>", { c: "l", tc: "l", d: 0.04 }),
        R(1100, 352, "v-bar", "", { w: 640, h: 28, c: "l", tc: "l", d: 0.08 }),
        R(900, 430, "v-mono", "<b>5.5</b>", { c: "l", tc: "l", d: 0.1 }),
        R(1100, 422, "v-bar is-acc", "", { w: 384, h: 28, c: "l", tc: "l", d: 0.16 }),
        R(1520, 410, "v-disp", "−40%", { style: "font-size:96px", f: { x: 40, o: 0 }, d: 0.18, dr: 40 }),
        R(904, 520, "v-mono", "长程智能体编码与知识工作 · 成本约为前代的六成", { c: "l", tc: "l", d: 0.22 }),
      ]);

      add("GPT-6.1 Sol", [
        R(900, 286, "v-cap", "标准 API 价格<em>VS GPT-6 ASTRA</em>", { c: "l", tc: "l" }),
        R(900, 370, "v-hatch", "", { w: 700, h: 36, c: "l", tc: "l" }),
        R(900, 370, "v-bar", "", { w: 700, h: 36, c: "l", tc: "l", d: 0.06 }),
        R(900, 418, "v-mono", "ASTRA", { c: "l", tc: "l", d: 0.04 }),
        R(900, 470, "v-bar is-acc", "", { w: 140, h: 36, c: "l", tc: "l", d: 0.14 }),
        R(900, 518, "v-mono", "SOL · 约 <b>1/5</b>", { c: "l", tc: "l", d: 0.16 }),
        R(1640, 360, "v-disp", "⅕", { style: "font-size:140px", f: { y: 30, o: 0 }, d: 0.12, dr: 40 }),
      ]);

      add("Gemini 4 Argon", [
        R(980, 270, "v-hatch", "", { w: 280, h: 280, d: 0.04, dr: 20 }),
        R(1020, 300, "v-ink", "", { w: 200, h: 220, style: "clip-path:polygon(50% 0,100% 28%,100% 70%,50% 100%,0 70%,0 28%)", d: 0.1, dr: 10 }),
        R(1360, 290, "v-cn", "防御向", { style: "font-size:72px", c: "l", tc: "l", d: 0.08 }),
        R(1360, 380, "v-disp", "LIMITED", { style: "font-size:84px", f: { x: 50, o: 0 }, d: 0.14, dr: 40 }),
        R(1364, 480, "v-mono", "长程软件工程 · 法务金融 · 有限放量", { c: "l", tc: "l", d: 0.2 }),
      ]);

      const last = M.events[M.events.length - 1];
      const rev = fmtDate(M.data.updated);
      add(last.title, [
        R(900, 268, "v-cn", "人类事务剩余", { style: "font-size:48px", c: "l", d: 0.02 }),
        R(890, 320, "v-disp v-acc", `${M.agg}%`, { style: "font-size:220px", f: { y: 50, o: 0 }, d: 0.08, dr: 24 }),
        R(1380, 360, "v-cap", `${esc(last.title)}<em>${fmtDate(last.date)}</em>`, { c: "l", tc: "l", d: 0.12 }),
        R(1380, 430, "v-mono", `截至 <b>${rev}</b> · 每天核对一次`, { c: "l", d: 0.18 }),
        R(1380, 468, "v-mono", "计数还在继续。", { c: "l", d: 0.24 }),
      ]);

      return v;
    }

    function headWord(title) {
      const m = title.match(/^[A-Za-z0-9][A-Za-z0-9 .·\-\/]*[A-Za-z0-9.]/);
      return m ? m[0].trim() : "";
    }

    function build() {
      const ev = M.events;
      const find = (t) => ev.findIndex((e) => e.title === t);
      const out = [];
      const covered = new Set();
      const push = (it, ai, ui, rail) => {
        const iai = it.at !== undefined ? (typeof it.at === "number" ? it.at : find(it.at)) : ai;
        const iui = it.u !== undefined ? find(it.u) : ui;
        const clip = it.c || it.tc;
        out.push({
          ...it,
          f: it.f || (it.c ? {} : { x: 60, o: 0 }),
          t: it.t || (it.tc ? {} : { x: -60, o: 0 }),
          clip,
          anchor: it.anchor ?? iai,
          inA: it.inA ?? iai - 0.75 + (it.d || 0),
          inW: it.inW ?? 0.55,
          outA: it.outA ?? iui + 0.15 + (it.od || 0),
          outW: it.outW ?? 0.4,
          dr: it.dr ?? 50,
          rail: rail !== false,
        });
      };

      scenes().forEach((sc) => {
        const ai = find(sc.at);
        if (ai < 0) return;
        const ui = sc.until ? find(sc.until) : ai;
        for (let i = ai; i <= ui; i++) covered.add(i);
        sc.items.forEach((it) => push(it, ai, ui));
      });

      ev.forEach((e, i) => {
        if (!covered.has(i)) {
          const w = headWord(e.title);
          const cjk = !w;
          const label = cjk ? e.title : w;
          const fs = cjk ? Math.min(84, 860 / label.length) : Math.min(170, 900 / (label.length * 0.47));
          push(R(904, 290, "v-mono", `No.<b>${pad(i + 1, 3)}</b> · ${fmtDate(e.date)} · ${esc(e.era)} · IMPACT <b>${(e.impact || "mid").toUpperCase()}</b>`, { c: "l", tc: "l", dr: 30 }), i, i);
          push(R(896, 320, cjk ? "v-cn" : "v-out", esc(label), { style: `font-size:${fs.toFixed(0)}px`, c: "l", tc: "l", d: 0.04, dr: 90 }), i, i);
          push(R(904, 336 + fs * (cjk ? 1.1 : 0.88), "v-rule", "", { w: 420, h: 6, c: "l", tc: "l", d: 0.12, dr: 60 }), i, i);
        }
        if (e.leaves.length) {
          const chips = e.leaves
            .slice(0, 4)
            .map((l) => `<span><b>${esc(l.name)}</b><em>${l.remaining}%</em></span>`)
            .join("");
          const more = e.leaves.length > 4 ? `<span class="is-more">+${e.leaves.length - 4}</span>` : "";
          push(R(800, 608, "v-chips", `<i>让渡 →</i>${chips}${more}`, { f: { x: -180, o: 0 }, t: { x: 280, o: 0 }, d: 0.2, od: -0.1, dr: 20 }), i, i);
        }
      });

      M.phases.forEach((p, k) => {
        const win = { inA: p.start - 0.9, inW: 0.6, outA: p.end + 0.2, outW: 0.6, anchor: (p.start + p.end) / 2 };
        push(R(792, 190, "v-plate", `<b>${pad(p.no)}</b><span>${esc(p.name)}</span><em>${p.y0} — ${p.y1}</em>`, { ...win, c: "l", tc: "l", dr: 0 }), p.start, p.end, false);
        push(R(1190, 186, "v-word", ERA_EN[p.name] || p.name, { ...win, f: { x: 160, o: 0 }, t: { x: -160, o: 0 }, dr: 36 }), p.start, p.end, false);
      });

      el.art.innerHTML = "";
      const frag = document.createDocumentFragment();
      out.forEach((it) => {
        const d = document.createElement("div");
        d.className = `v ${it.cls || ""}`.trim();
        d.style.cssText = `left:${it.x - ART_X}px;top:${it.y - ART_Y}px;${it.w ? `width:${it.w}px;` : ""}${it.h ? `height:${it.h}px;` : ""}${it.style || ""}`;
        d.innerHTML = it.html;
        it.el = d;
        frag.appendChild(d);
      });
      el.art.appendChild(frag);
      items = out;
    }

    /* 事件分镜锁在时间轨上：播放头前进时，画面与刻度左移同一像素。阶段铭牌仍原地淡入淡出。 */

    function renderArt(p) {
      const rx = railX(p);
      for (const it of items) {
        const e = it.el;
        if (!it.rail) {
          if (p <= it.inA || p >= it.outA + it.outW) {
            set(e, "visibility", "hidden");
            continue;
          }
          paintPiece(it, p, 0, 1);
          continue;
        }
        const age = p - it.anchor;
        const weight = Math.abs(age) >= 1.08 ? 0 : 1 - smooth(clamp(Math.abs(age) / 1.02, 0, 1));
        if (weight <= 0) {
          set(e, "visibility", "hidden");
          continue;
        }
        paintPiece(it, p, railX(it.anchor) - rx, weight);
      }
    }

    function paintPiece(it, p, railDx, weight) {
      const e = it.el;
      const riding = it.rail;
      const ein = smooth((p - it.inA) / it.inW);
      const eout = riding ? 0 : smooth((p - it.outA) / it.outW);
      const qi = 1 - ein;
      const f = it.f;
      const t = it.t;
      const m = it.mid;
      const em = m ? smooth((p - it.anchor - m.p[0]) / (m.p[1] - m.p[0])) : 0;
      let x = (f.x || 0) * qi + (t.x || 0) * eout + (m ? (m.x || 0) * em : 0) + railDx;
      if (!riding) x -= (p - it.anchor) * it.dr;
      const y = (f.y || 0) * qi + (t.y || 0) * eout + (m ? (m.y || 0) * em : 0);
      const r = (f.r || 0) * qi + (t.r || 0) * eout + (m ? (m.r || 0) * em : 0);
      const s = 1 + ((f.s ?? 1) - 1) * qi + ((t.s ?? 1) - 1) * eout + (m ? ((m.s ?? 1) - 1) * em : 0);
      let o = 1;
      if (f.o !== undefined) o *= f.o + (1 - f.o) * ein;
      if (t.o !== undefined) o *= 1 + (t.o - 1) * eout;
      if (riding) {
        const stageX = it.x + x;
        const maskL = smooth(clamp((stageX - 800) / 180, 0, 1));
        const maskR = 1 - smooth(clamp((stageX - 1760) / 180, 0, 1));
        o *= weight * maskL * maskR;
        if (o <= 0.012 || stageX < 620 || stageX > 2080) {
          set(e, "visibility", "hidden");
          return;
        }
      }
      set(e, "visibility", o > 0.004 ? "visible" : "hidden");
      set(e, "opacity", o.toFixed(3));
      set(e, "transform", `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) rotate(${r.toFixed(2)}deg) scale(${Math.max(0, s).toFixed(3)})`);
      if (it.clip) {
        const q = [0, 0, 0, 0];
        const side = { t: 0, r: 1, b: 2, l: 3 };
        if (it.c) q[(side[it.c] + 2) % 4] = qi;
        if (it.tc) q[side[it.tc]] = Math.max(q[side[it.tc]], eout);
        set(e, "clipPath", `inset(${q.map((v) => `calc(${v.toFixed(3)} * (100% + 8px) - 4px)`).join(" ")})`);
      }
      if (it.draw) set(e, "--dr", (ein * (1 - eout)).toFixed(3));
    }

    /* ---------- 布局 ---------- */

    function layout() {
      const ev = M.events;
      n = ev.length;

      let x = 0;
      ev.forEach((e, i) => {
        if (i > 0) {
          const years = Math.max(0, (e.t - ev[i - 1].t) / (365.25 * 864e5));
          x += 208 + 72 * Math.log2(1 + years);
          if (e.phase !== ev[i - 1].phase) x += 96;
        }
        RX[i] = x;
      });
      xAtTime = (t) => {
        if (t <= ev[0].t) return RX[0] - ((ev[0].t - t) / (365.25 * 864e5)) * 40;
        if (t >= ev[n - 1].t) return RX[n - 1] + ((t - ev[n - 1].t) / (365.25 * 864e5)) * 400;
        let k = 0;
        while (k < n - 2 && ev[k + 1].t <= t) k++;
        const a = ev[k].t;
        const b = ev[k + 1].t;
        return RX[k] + (RX[k + 1] - RX[k]) * (b > a ? (t - a) / (b - a) : 0);
      };
      xMin = RX[0] - 1400;
      xMax = RX[n - 1] + 1400;

      washRGB = ev.map((e) => {
        const hex = (ERA_WASH[e.era] || "#d9d4c8").replace("#", "");
        return {
          hex: `#${hex}`,
          r: parseInt(hex.slice(0, 2), 16),
          g: parseInt(hex.slice(2, 4), 16),
          b: parseInt(hex.slice(4, 6), 16),
        };
      });

      const cg = Math.max(0, ev.findIndex((e) => e.title === "ChatGPT"));
      leafCurve = M.leaves.map((l) => ({
        rem: l.remaining,
        j: l.hits.length ? Math.min(...l.hits.map((h) => ev.indexOf(h))) : -1,
        a: cg,
        b: n - 1,
      }));

      const y0 = Number(ev[0].date.slice(0, 4));
      const y1 = Number(ev[n - 1].date.slice(0, 4)) + 1;
      let yh = "";
      let lastLab = -Infinity;
      for (let y = y0 - 4; y <= y1; y++) {
        const yx = xAtTime(Date.UTC(y, 0, 1));
        const dec = y % 10 === 0;
        const lab = yx - lastLab >= 46 && (dec || yx - lastLab >= 90 || y >= 2010);
        if (lab) lastLab = yx;
        yh += `<span class="${dec ? "is-dec" : ""}" style="left:${yx.toFixed(1)}px">${lab ? `<b>${y}</b>` : ""}</span>`;
      }
      el.years.innerHTML = yh;

      el.railPh.innerHTML = M.phases
        .map((p, k) => {
          const a = k === 0 ? xMin : (RX[p.start - 1] + RX[p.start]) / 2 + 40;
          const b = k + 1 < M.phases.length ? (RX[p.end] + RX[p.end + 1]) / 2 + 40 : xMax;
          return `<span style="left:${a.toFixed(0)}px;width:${(b - a).toFixed(0)}px"><em>PHASE ${pad(p.no)}</em>${esc(p.name)}</span>`;
        })
        .join("");

      el.events.innerHTML = ev
        .map(
          (e, i) =>
            `<div class="rv-ev" data-i="${i}" data-impact="${e.impact || "mid"}" style="left:${RX[i]}px;--stem:${i % 2 ? 46 : 18}px"><span><time>${fmtDate(e.date)}</time><strong>${esc(e.title)}</strong></span></div>`
        )
        .join("");
      evEls = [...el.events.querySelectorAll(".rv-ev")];

      let line = "";
      let area = `M${xMin} 0`;
      for (let p = -1 - 1400 / S; p <= n - 1 + 1400 / S; p += 0.05) {
        const px = railX(p);
        const py = curveY(human(clamp(p, -1, n - 1)));
        line += `${line ? "L" : "M"}${px.toFixed(1)} ${py.toFixed(2)} `;
        area += ` L${px.toFixed(1)} ${py.toFixed(2)}`;
      }
      area += ` L${xMax} 0 Z`;
      el.ero.setAttribute("width", String(xMax - xMin));
      el.ero.setAttribute("height", "100");
      el.ero.setAttribute("viewBox", `${xMin} 0 ${xMax - xMin} 100`);
      el.ero.style.left = `${xMin}px`;
      el.ero.innerHTML = `<defs>
          <pattern id="ero-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="8" class="ero-hatch-line" /></pattern>
          <clipPath id="ero-clip"><rect id="ero-rect" x="${xMin}" y="-10" width="0" height="120" /></clipPath>
        </defs>
        <path class="ero-line is-future" d="${line}" />
        <g clip-path="url(#ero-clip)"><path class="ero-area" d="${area}" /><path class="ero-line" d="${line}" /></g>`;
      el.eroRect = el.ero.querySelector("#ero-rect");

      build();
      layoutAxis();

      let html = "";
      for (let k = 0; k < 4; k++) {
        let col = "";
        for (let v = 0; v <= 10; v++) col += `<span>${v % 10}</span>`;
        html += `<span class="dg"><span class="dg-col">${col}</span></span>`;
      }
      el.year.innerHTML = html;
    }

    function layoutAxis() {
      const ev = M.events;
      const span = (RX[n - 1] - RX[0]) || 1;
      const frac = (x) => clamp((x - RX[0]) / span, 0, 1);
      xs = RX.map(frac);
      const xAt = (t) => frac(xAtTime(t));
      const y0 = Number(ev[0].date.slice(0, 4));
      const y1 = Number(ev[n - 1].date.slice(0, 4));
      const want = [];
      for (let y = Math.ceil(y0 / 10) * 10; y <= y1; y += 10) want.push(y);
      for (let y = 2012; y <= y1; y++) want.push(y);
      let lastX = -1;
      el.axYears.innerHTML = [...new Set(want)]
        .sort((a, b) => a - b)
        .map((y) => {
          const x = xAt(Date.UTC(y, 0, 1));
          if (lastX >= 0 && (x - lastX) * AXIS_W < 48) return "";
          lastX = x;
          return `<span style="left:${(x * 100).toFixed(3)}%">${y}</span>`;
        })
        .join("");

      const Hh = { high: 18, mid: 12, low: 7 };
      el.ticks.innerHTML = ev
        .map((e, i) => `<span class="tk" data-impact="${e.impact || "mid"}" style="left:${(xs[i] * 100).toFixed(3)}%;--h:${Hh[e.impact] || 12}px"></span>`)
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
      tickEls = [...el.ticks.children];
      phaseEls = [...el.phases.querySelectorAll(".ph")];
    }

    function invXs(f) {
      if (f <= xs[0]) return 0;
      if (f >= xs[n - 1]) return n - 1;
      let k = 0;
      while (k < n - 2 && xs[k + 1] < f) k++;
      return k + (f - xs[k]) / (xs[k + 1] - xs[k] || 1);
    }

    /* ---------- 文字槽位 ---------- */

    function titleSize(s) {
      let u = 0;
      for (const ch of s) u += ch === " " ? 0.24 : isCJK(ch) ? 0.92 : /[A-Z0-9]/.test(ch) ? 0.5 : 0.42;
      const one = (COL_W - 4) / u;
      if (one >= 58) return Math.min(one, 96);
      return clamp(((COL_W - 4) * 1.85) / u, 34, 56);
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
      const MAX = 3;
      const rep = rows.length
        ? rows
            .slice(0, MAX)
            .map(
              (l) =>
                `<div class="sl-row"><span>${esc(l.name)}<small>${esc(l.domain.name)}</small></span>${bar(l.remaining)}<b class="${l.remaining <= CRIT ? "is-crit" : ""}">${l.remaining}</b></div>`
            )
            .join("") + (rows.length > MAX ? `<p class="sl-more">+ ${rows.length - MAX} 项</p>` : "")
        : `<p class="sl-empty">未直接记入领域让渡，是其后 ${n - 1 - i} 个节点的前置。</p>`;

      slot.innerHTML = `
        <div class="sl-meta" data-r="0">
          <span class="sl-era">${esc(e.era)}</span>
          <span class="sl-phase">PHASE ${pad(p.no)}-${pad(i - p.start + 1)} · No.${pad(i + 1, 3)}</span>
          <span class="sl-date">${fmtDate(e.date)}</span>
        </div>
        <h3 class="sl-title" data-r="1" style="--fs:${titleSize(e.title).toFixed(1)}px">${titleHTML(e.title)}</h3>
        <div class="sl-rule" data-r="2"></div>
        <p class="sl-blurb" data-r="3">${esc(e.blurb || "")}</p>
        <div class="sl-foot" data-r="4">
          ${(e.tags || []).slice(0, 3).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}
          <span class="sl-imp" data-level="${e.impact || "mid"}">${[1, 2, 3].map((v) => `<i class="${v <= lvl ? "is-on" : ""}"></i>`).join("")}<b>${(e.impact || "mid").toUpperCase()}</b></span>
        </div>
        <div class="sl-rep" data-r="5">
          <p class="sl-rep-h">让渡记录<span>TRANSFERRED</span><b>${pad(rows.length)}</b></p>
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

    function render(p) {
      const k = n > 1 ? clamp(Math.floor(p), -1, n - 2) : 0;
      const t = n > 1 ? clamp(p - k, 0, 1) : 0;
      const rx = railX(p);

      set(el.world, "transform", `translate3d(${(HEAD_X - rx).toFixed(2)}px,0,0)`);
      set(el.bg, "--gx", `${(-(rx * 0.3) % 120).toFixed(1)}px`);
      set(el.bg, "--bx", `${(-rx % 1000).toFixed(1)}px`);
      const cw = Math.round(rx - xMin);
      if (cw !== clipW && el.eroRect) {
        clipW = cw;
        el.eroRect.setAttribute("width", String(Math.max(0, cw)));
      }

      const h = human(p);
      const hr = Math.round(h);
      set(el.zone, "--m", ((100 - h) / 100).toFixed(4));
      if (el.zoneH.textContent !== String(hr)) {
        el.zoneH.textContent = String(hr);
        el.zoneM.textContent = String(100 - hr);
        el.rhH.textContent = String(hr);
      }
      set(el.rhVal, "transform", `translate3d(0,${clamp(curveY(h) - 46, 0, 60).toFixed(1)}px,0)`);

      evEls.forEach((nd, i) => set(nd, "--f", smooth(1 - Math.abs(p - i) * 1.4).toFixed(3)));

      const ka = clamp(k, 0, n - 1);
      const kb = clamp(k + 1, 0, n - 1);
      const ms = p < 0 ? M.events[0].t : M.events[ka].t + (M.events[kb].t - M.events[ka].t) * t;
      odometer(yearFloat(ms));
      const dd = new Date(ms);
      const ds = `${dd.getUTCFullYear()}.${pad(dd.getUTCMonth() + 1)}`;
      if (el.rhDate.textContent !== ds) el.rhDate.textContent = ds;

      if (slotK !== k) {
        slotK = k;
        rowsA = fill(el.slotA, k);
        rowsB = fill(el.slotB, k + 1);
      }
      rowsA.forEach((r, j) => set(r, "--e", (1 - smooth((t - 0.08 - j * 0.04) / 0.32)).toFixed(3)));
      rowsB.forEach((r, j) => set(r, "--e", smooth((t - 0.42 - j * 0.04) / 0.32).toFixed(3)));
      set(el.scan, "transform", `translate3d(${((0.02 + 0.96 * t) * COL_W).toFixed(1)}px,0,0)`);
      set(el.scan, "opacity", Math.sin(Math.PI * t).toFixed(3));

      renderArt(p);

      const fx = p < 0 ? 0 : xs[ka] + (xs[kb] - xs[ka]) * t;
      set(el.head, "transform", `translate3d(${(fx * AXIS_W).toFixed(2)}px,0,0)`);
      set(el.progress, "transform", `scaleX(${fx.toFixed(4)})`);

      paintTrack(p);

      const near = clamp(Math.round(Math.max(p, 0)), 0, n - 1);
      if (near !== nearK && n) {
        nearK = near;
        const e = M.events[near];
        el.body.setAttribute("aria-valuenow", String(near + 1));
        el.body.setAttribute("aria-valuetext", `${e.date} ${e.title}`);
      }
    }

    /* 刻度、阶段和时代色是 pos 的连续函数：整数上与原先的选中态一致，半路交叉淡化。 */

    function mixHex(i, j, u) {
      const a = washRGB[i];
      const b = washRGB[j];
      if (!a) return "#d9d4c8";
      if (!b || u <= 0 || a.hex === b.hex) return a.hex;
      if (u >= 1) return b.hex;
      const r = Math.round(a.r + (b.r - a.r) * u);
      const g = Math.round(a.g + (b.g - a.g) * u);
      const bl = Math.round(a.b + (b.b - a.b) * u);
      return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, "0")}`;
    }

    function phaseOn(ph, p) {
      const x = Math.max(p, 0);
      let raw = 1;
      if (x < ph.start) raw = 1 - (ph.start - x);
      else if (x > ph.end) raw = 1 - (x - ph.end);
      return smooth(clamp(raw, 0, 1));
    }

    function paintTrack(p) {
      const pp = Math.max(p, 0);
      tickEls.forEach((tk, i) => {
        const d = pp - i;
        const ad = Math.abs(d);
        const on = ad >= 1 ? 0 : smooth(1 - ad);
        const past = d <= 0 ? 0 : smooth(clamp(d / 0.85, 0, 1));
        set(tk, "--on", on.toFixed(3));
        set(tk, "--past", past.toFixed(3));
      });
      phaseEls.forEach((b, i) => set(b, "--on", phaseOn(M.phases[i], p).toFixed(3)));
      let wash = "#d9d4c8";
      if (n > 0) {
        if (p <= 0) wash = mixHex(0, 0, 0);
        else if (p >= n - 1) wash = mixHex(n - 1, n - 1, 0);
        else {
          const k = Math.floor(p);
          wash = mixHex(k, k + 1, smooth(p - k));
        }
      }
      set(el.bg, "--wash", wash);
    }

    /* ---------- 物理 / 循环 ---------- */

    /* 0 在事件上，1 在两事件正中。经过事件时略慢，中段略快，始终大于 0。 */
    function playEase(p) {
      const frac = p - Math.floor(p);
      const dist = Math.min(frac, 1 - frac);
      return 0.74 + 0.36 * smooth(dist / 0.5);
    }

    /* 早期约 0.40 事件/秒，平滑加到末段约 1.10，再乘靠近事件时的轻微减速。 */
    function cruiseAt(p) {
      const u = smooth(clamp(p / Math.max(1, n - 1), 0, 1));
      return 0.4 + 0.7 * u;
    }

    function frame(now) {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastT) / 1000));
      lastT = now;

      if (playing && n > 1 && target >= pos - 0.05) {
        if (pos < -0.002 && target <= 0.002) {
          target = 0;
        } else {
          if (target < pos) target = pos;
          if (target < n - 1) target = Math.min(n - 1, target + cruiseAt(pos) * playEase(clamp(pos, 0, n - 1)) * dt);
          if (target >= n - 1 - 1e-6 && pos >= n - 1 - 0.008) setPlaying(false);
        }
      }

      const w = dragging ? 26 : pos < 0 ? 3.2 : 5.4;
      const zeta = dragging ? 1 : 0.74;
      const acc = w * w * (target - pos) - 2 * zeta * w * vel;
      vel += acc * dt;
      pos += vel * dt;
      if (Math.abs(target - pos) < 1e-4 && Math.abs(vel) < 1e-3) {
        pos = target;
        vel = 0;
      }
      pos = clamp(pos, -1, n - 1);

      const showRun = intent || (n > 1 && pos >= n - 1 - 0.02 && target >= n - 1 - 1e-4);
      if (showRun && n > 1) set(el.timer, "transform", `scaleX(${clamp(Math.max(pos, 0) / (n - 1), 0, 1).toFixed(4)})`);
      else set(el.timer, "transform", "scaleX(0)");

      render(pos);
      raf = requestAnimationFrame(frame);
    }

    function paintPlay() {
      const showPause = intent;
      el.play.innerHTML = showPause ? '<span class="i-pause"></span>' : '<span class="i-play"></span>';
      el.play.classList.toggle("is-hold", intent && suspend);
      el.play.setAttribute("aria-label", intent ? (suspend ? "悬停已暂停，移开继续" : "暂停自动回放") : "开始自动回放");
    }

    function setPlaying(v) {
      intent = v;
      playing = intent && !suspend;
      paintPlay();
    }

    function setSuspend(v) {
      if (suspend === v) return;
      suspend = v;
      playing = intent && !suspend;
      paintPlay();
    }

    function toggle() {
      if (intent) {
        setPlaying(false);
        return;
      }
      if (Math.round(Math.max(pos, target)) >= n - 1) target = 0;
      setPlaying(true);
    }

    function step(d) {
      setPlaying(false);
      target = clamp(Math.round(target) + d, 0, n - 1);
    }

    function goTo(i) {
      setPlaying(false);
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
      target = clamp(target + d * 0.0032, 0, n - 1);
      return true;
    }

    function bind() {
      paintPlay();
      el.scene.addEventListener("pointerenter", () => setSuspend(true));
      el.scene.addEventListener("pointerleave", () => setSuspend(false));
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
        const sp = RX[k + 1] - RX[k] || S;
        const dp = -dx / sp;
        target = clamp(target + dp, -0.4, n - 1);
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
          const sy = (ev.clientY - r.top) / scale() + 180;
          if (sy >= 700) {
            const wx = (ev.clientX - r.left) / scale() - HEAD_X + railX(pos);
            let best = Math.round(pos);
            let bd = Infinity;
            RX.forEach((x, i) => {
              const dd = Math.abs(wx - x - 60);
              if (dd < bd) {
                bd = dd;
                best = i;
              }
            });
            goTo(best);
          }
          return;
        }
        if (performance.now() - lastMoveT > 120) v = 0;
        target = clamp(target + clamp(v * 0.22, -3, 3), 0, n - 1);
      };
      el.hit.addEventListener("pointerup", up);
      el.hit.addEventListener("pointercancel", up);

      let axisDrag = false;
      let axisMoved = false;
      let axisX = 0;
      const axisTo = (ev) => {
        const r = el.body.getBoundingClientRect();
        target = invXs(clamp((ev.clientX - r.left) / r.width, 0, 1));
      };
      el.body.addEventListener("pointerdown", (ev) => {
        axisDrag = true;
        axisMoved = false;
        axisX = ev.clientX;
        dragging = true;
        setPlaying(false);
        el.body.setPointerCapture(ev.pointerId);
        axisTo(ev);
      });
      el.body.addEventListener("pointermove", (ev) => {
        if (!axisDrag) return;
        if (Math.abs(ev.clientX - axisX) > 4) axisMoved = true;
        axisTo(ev);
      });
      const axisUp = () => {
        if (!axisDrag) return;
        axisDrag = false;
        dragging = false;
        if (!axisMoved) target = clamp(Math.round(target), 0, n - 1);
      };
      el.body.addEventListener("pointerup", axisUp);
      el.body.addEventListener("pointercancel", axisUp);
    }

    function enter() {
      lastT = performance.now();
      edgeAt = 0;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    }

    function leave() {
      cancelAnimationFrame(raf);
      setSuspend(false);
    }

    return { layout, bind, enter, leave, step, toggle, wheel, setPlaying };
  })();

  /* ==========================================================
     02 领域血条
     ========================================================== */

  const DM = (() => {
    let cur = -1;
    let hoverT = null;
    let pending = null;

    function render() {
      $("#dm-list").innerHTML = M.domains
        .map(
          (d, i) => `<li class="dm-row" role="treeitem" aria-expanded="false" data-i="${i}" style="--i:${i}" tabindex="0">
            <span class="dm-no">${pad(d.no)}</span>
            <span class="dm-name">${esc(d.name)}<em>${esc(d.id.toUpperCase())}</em><small class="dm-meta">${pad(d.children.length)} 叶</small><i class="dm-caret" aria-hidden="true"></i></span>
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

      $("#dd-leaves").addEventListener("click", (e) => {
        const leaf = e.target.closest(".dd-leaf");
        if (!leaf) return;
        const open = leaf.classList.toggle("is-open");
        leaf.querySelector(".dd-leaf-btn")?.setAttribute("aria-expanded", String(open));
      });
    }

    function select(i, force) {
      if (i === cur && !force) return;
      const prevAvg = cur >= 0 ? M.domains[cur].avg : 0;
      cur = i;
      const d = M.domains[i];
      document.querySelectorAll(".dm-row").forEach((r, k) => {
        const on = k === i;
        r.classList.toggle("is-on", on);
        r.setAttribute("aria-selected", String(on));
        r.setAttribute("aria-expanded", String(on));
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
            <button type="button" class="dd-leaf-btn" aria-expanded="false">
              <span class="dd-leaf-top">
                <span class="dd-leaf-name">${esc(c.name)}</span>
                <span class="dd-leaf-by">← ${esc(c.movedBy || "—")}</span>
                <span class="dd-leaf-val${c.remaining <= CRIT ? " is-crit" : ""}">${c.remaining}</span>
              </span>
              ${bar(c.remaining, k)}
            </button>
            <p class="dd-leaf-note">${esc(c.note || "")}</p>
          </li>`
        )
        .join("");
    }

    function arm(i) {
      pending = i;
    }

    function move(d) {
      if (!M.domains.length) return;
      const i = cur < 0 ? 0 : clamp(cur + d, 0, M.domains.length - 1);
      select(i, true);
      const row = document.querySelector(`.dm-row[data-i="${i}"]`);
      if (row) {
        row.focus({ preventScroll: true });
        row.scrollIntoView({ block: "nearest" });
      }
    }

    function enter() {
      const i = pending == null ? (cur < 0 ? 0 : cur) : pending;
      pending = null;
      select(clamp(i, 0, Math.max(0, M.domains.length - 1)), true);
    }

    return { render, enter, arm, move };
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
