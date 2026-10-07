(() => {
  "use strict";

  const W = 1920;
  const H = 1080;
  const CRIT = 25;
  const SCENES = ["cover", "timeline", "domains", "ledger"];
  const HINTS = [
    "滚轮 / ↑ ↓ 切换章节 · T 切换配色",
    "拖动平移 · 滚轮 · ← → 逐事件 · 空格暂停 · 悬停暂停 · 滚到两端换章",
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
        const hit = e.target instanceof Element ? e.target.closest("#tl-hit, #tl-scrub, .tl-ctrl, #hud-nav, #theme, .dm-list, .dd-leaves, .lg-bars, .lg-legend, a, button") : null;
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
     01 时间轴：一条连续的关卡地图
     唯一状态是浮点 pos（事件序号）。镜头、轴线描边、支线展开、
     节点弹出、时代圆窗都是 pos 的函数——往回拖，展开会收回。
     ========================================================== */

  const TL = (() => {
    const AXIS_Y = 568;
    const FOCUS_X = 700;
    const CARD_W = 320;
    const CARD_H = 172;
    const DIAG = 118;
    const SCRUB_W = 1360;
    const LEAD = 460;

    let n = 0;
    let ev = [];
    let RX = [];
    let nodes = [];
    let segs = [];
    let tickEls = [];
    let leafCurve = [];
    let axisPath = null;
    let axisInk = null;
    let axisLen = 1;
    let axisX0 = 0;

    let pos = -0.28;
    let vel = 0;
    let target = 0;
    let intent = !reduce;
    let suspend = false;
    let playing = intent;
    let dragging = false;
    let raf = 0;
    let lastT = 0;
    let edgeAt = 0;
    let nearK = -1;
    let wasGo = false;
    let hudYear = "";
    let hudDate = "";
    let hudHuman = "";
    let hudX = "";

    const el = {
      scene: $("#timeline"),
      eras: $("#tl-eras"),
      rings: $("#tl-rings"),
      decades: $("#tl-decades"),
      mid: $("#tl-mid"),
      svg: $("#tl-svg"),
      nodes: $("#tl-nodes"),
      walker: $("#tl-walker"),
      fg: $("#tl-fg"),
      xread: $("#tl-x"),
      year: $("#tl-year"),
      date: $("#tl-date"),
      idx: $("#tl-idx"),
      era: $("#tl-era"),
      human: $("#tl-human"),
      count: $("#tl-count"),
      play: $("#ac-play"),
      timer: $("#ac-timer"),
      scrub: $("#tl-scrub"),
      fill: $("#tl-fill"),
      ticks: $("#tl-ticks"),
      syears: $("#tl-syears"),
      head: $("#tl-head"),
      hit: $("#tl-hit"),
    };

    const cache = new WeakMap();
    function set(elm, prop, val) {
      if (!elm) return;
      let c = cache.get(elm);
      if (!c) cache.set(elm, (c = new Map()));
      if (c.get(prop) === val) return;
      c.set(prop, val);
      elm.style[prop] = val;
    }

    const smooth = (x) => {
      const v = clamp(x, 0, 1);
      return v * v * (3 - 2 * v);
    };

    /* 回弹弹出：等价于末端超过 1 的 ease-out，倒放时沿同一条曲线收回 */
    function pop(t) {
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
    }

    const band = (u, a, b) => smooth((u - a) / (b - a));

    function xAt(p) {
      if (n <= 1) return RX[0] || 0;
      if (p <= 0) return RX[0] + p * (RX[1] - RX[0]);
      if (p >= n - 1) return RX[n - 1] + (p - (n - 1)) * (RX[n - 1] - RX[n - 2]);
      const k = Math.floor(p);
      return RX[k] + (RX[k + 1] - RX[k]) * (p - k);
    }

    function invX(x) {
      if (n <= 1) return 0;
      const g0 = RX[1] - RX[0] || 1;
      const g1 = RX[n - 1] - RX[n - 2] || 1;
      if (x <= RX[0]) return (x - RX[0]) / g0;
      if (x >= RX[n - 1]) return n - 1 + (x - RX[n - 1]) / g1;
      let lo = 0;
      let hi = n - 1;
      while (hi - lo > 1) {
        const m = (lo + hi) >> 1;
        if (RX[m] <= x) lo = m;
        else hi = m;
      }
      return lo + (x - RX[lo]) / (RX[hi] - RX[lo] || 1);
    }

    function gapAt(p) {
      if (n <= 1) return 300;
      if (p <= 0) return RX[1] - RX[0] || 300;
      if (p >= n - 1) return RX[n - 1] - RX[n - 2] || 300;
      const k = Math.floor(p);
      return RX[k + 1] - RX[k] || 300;
    }

    function timeAt(p) {
      if (n <= 1 || p <= 0) return ev[0].t;
      if (p >= n - 1) return ev[n - 1].t;
      const k = Math.floor(p);
      return ev[k].t + (ev[k + 1].t - ev[k].t) * (p - k);
    }

    function xAtTime(t) {
      if (n <= 1 || t <= ev[0].t) return RX[0] || 0;
      if (t >= ev[n - 1].t) return RX[n - 1];
      let k = 0;
      while (k < n - 2 && ev[k + 1].t <= t) k++;
      const a = ev[k].t;
      const b = ev[k + 1].t;
      return RX[k] + (RX[k + 1] - RX[k]) * (b > a ? (t - a) / (b - a) : 0);
    }

    function human(p) {
      if (!leafCurve.length) return 100;
      let s = 0;
      for (const c of leafCurve) {
        if (c.j >= 0) s += c.rem + (100 - c.rem) * (1 - smooth((p - (c.j - 0.6)) / 0.6));
        else s += 100 - (100 - c.rem) * clamp((p - c.a) / (c.b - c.a || 1), 0, 1);
      }
      return s / leafCurve.length;
    }

    /* 节点之间加速，靠近高影响力事件减速，不吸附成整页 */
    function cruise(cam) {
      if (n <= 1) return 0;
      const i = clamp(Math.round(Math.max(pos, 0)), 0, n - 1);
      let nearest = 1e9;
      for (let k = Math.max(0, i - 6); k <= Math.min(n - 1, i + 6); k++) {
        if (nodes[k].impact !== "high") continue;
        nearest = Math.min(nearest, Math.abs(cam - nodes[k].x));
      }
      let m;
      if (nearest < 170) {
        const t = nearest / 170;
        m = 0.3 + 0.7 * t * t;
      } else if (nearest > 560) m = 1.5;
      else {
        const t = (nearest - 170) / (560 - 170);
        m = 1 + 0.5 * t * t;
      }
      if (cam < nodes[0].x + 90) m = Math.min(m, 0.55);
      const endD = nodes[n - 1].x - cam;
      if (endD < 300) m = Math.min(m, 0.22 + 0.78 * clamp(endD / 300, 0, 1));
      return 176 * m;
    }

    function cardBox(x, side, L, ang) {
      let endX;
      let endY;
      if (ang === 90) {
        endX = x;
        endY = side === "up" ? AXIS_Y - L : AXIS_Y + L;
      } else {
        endX = x + DIAG;
        endY = side === "up" ? AXIS_Y - DIAG : AXIS_Y + DIAG;
      }
      return {
        endX,
        endY,
        cardX: endX - 22,
        cardY: side === "up" ? endY - CARD_H : endY,
        side,
        L,
        ang,
      };
    }

    function hits(a, b) {
      const pad = 14;
      return !(
        a.cardX + CARD_W + pad < b.cardX ||
        b.cardX + CARD_W + pad < a.cardX ||
        a.cardY + CARD_H + pad < b.cardY ||
        b.cardY + CARD_H + pad < a.cardY
      );
    }

    function boxFits(box, placed) {
      if (box.cardY < 104 || box.cardY + CARD_H > 948) return false;
      return !placed.some((c) => hits(box, c));
    }

    function layoutNodes() {
      const placed = [];
      nodes = [];
      let upNext = true;
      let ord = 0;
      ev.forEach((e, i) => {
        const impact = e.impact || "mid";
        const major = impact === "high";
        const nd = { i, x: RX[i], impact, major };
        if (!major) {
          nd.side = i % 2 ? "down" : "up";
          nodes.push(nd);
          return;
        }
        let side = upNext ? "up" : "down";
        upNext = !upNext;
        let L = side === "up" ? [136, 158, 184][ord % 3] : [100, 122][ord % 2];
        let ang = ord % 3 === 0 ? 45 : 90;
        ord += 1;
        let box = cardBox(RX[i], side, L, ang);
        if (!boxFits(box, placed)) {
          ang = 90;
          box = cardBox(RX[i], side, L, ang);
        }
        let tries = 0;
        while (!boxFits(box, placed) && tries < 10) {
          tries += 1;
          ang = 90;
          L += 28;
          if (side === "up" && AXIS_Y - L - CARD_H < 104) {
            side = "down";
            L = 96;
          }
          if (side === "down" && AXIS_Y + L + CARD_H > 948) {
            side = "up";
            L = 136;
          }
          box = cardBox(RX[i], side, L, ang);
        }
        Object.assign(nd, box);
        placed.push(box);
        nodes.push(nd);
      });
      nodes.forEach((nd) => {
        if (nd.major) return;
        const clash = nodes.some((o) => o.major && o.side === nd.side && Math.abs(o.x - nd.x) < 220);
        if (clash) nd.side = nd.side === "up" ? "down" : "up";
      });
    }

    function layoutSegs() {
      const phases = M.phases;
      const notable = (p) => p.end - p.start + 1 >= 3 || RX[p.end] - RX[p.start] >= 800;
      segs = [];
      let cur = null;
      phases.forEach((p, i) => {
        let ahead = false;
        if (!notable(p)) {
          for (let j = i + 1; j < Math.min(phases.length, i + 4); j++) {
            if (phases[j].name === p.name && notable(phases[j])) {
              ahead = true;
              break;
            }
            if (notable(phases[j])) break;
          }
        }
        const startNew = cur && p.name !== cur.name && (notable(p) || ahead);
        if (!cur) cur = { name: p.name, start: p.start, end: p.end };
        else if (startNew) {
          segs.push(cur);
          cur = { name: p.name, start: p.start, end: p.end };
        } else cur.end = p.end;
      });
      if (cur) segs.push(cur);
    }

    function buildDom() {
      el.eras.replaceChildren();
      el.rings.replaceChildren();
      el.nodes.replaceChildren();
      el.decades.replaceChildren();
      el.fg.replaceChildren();

      segs.forEach((seg, k) => {
        const tone = Math.min(k, 6);
        const en = ERA_EN[seg.name] || "";
        const y0 = ev[seg.start].date.slice(0, 4);
        const y1 = ev[seg.end].date.slice(0, 4);
        const div = document.createElement("div");
        div.className = "era-wipe";
        div.dataset.k = String(tone);
        div.innerHTML = `<div class="loom"><div class="loom-rings"></div><p class="loom-en">${esc(en || seg.name)}</p>${
          en ? `<p class="loom-cn">${esc(seg.name)}</p>` : ""
        }<p class="loom-yr">${y0} — ${y1}</p></div>`;
        if (k > 0) div.style.visibility = "hidden";
        el.eras.appendChild(div);
        seg.el = div;
        seg.loom = div.querySelector(".loom");
        seg.on = k === 0;
        seg.full = k === 0;
        if (k > 0) {
          const ring = document.createElement("i");
          ring.className = "wipe-ring";
          el.rings.appendChild(ring);
          seg.ring = ring;
        }
      });

      const impZh = { high: "高", mid: "中", low: "低" };
      const frag = document.createDocumentFragment();
      let paths = "";
      nodes.forEach((nd) => {
        const e = ev[nd.i];
        const node = document.createElement("div");
        node.className = `node ${nd.major ? "is-major" : "is-minor"} is-${nd.side}`;
        node.dataset.impact = nd.impact;
        node.style.left = `${nd.x}px`;
        node.style.top = `${AXIS_Y}px`;
        if (nd.major) {
          const relX = (nd.endX - nd.x).toFixed(1);
          const relY = (nd.endY - AXIS_Y).toFixed(1);
          const cX = (nd.cardX - nd.x).toFixed(1);
          const cY = (nd.cardY - AXIS_Y).toFixed(1);
          const tags = (e.tags || [])
            .slice(0, 3)
            .map((t) => `<span>${esc(t)}</span>`)
            .join("");
          const leaves = e.leaves || [];
          const leafHtml = leaves.length
            ? `<p class="card-leaves"><em>让渡</em>${leaves
                .slice(0, 2)
                .map((l) => `<span>${esc(l.name)}<b>${l.remaining}</b></span>`)
                .join("")}${leaves.length > 2 ? `<span class="more">+${leaves.length - 2}</span>` : ""}</p>`
            : "";
          node.innerHTML = `<i class="joint"></i><i class="diamond" style="left:${relX}px;top:${relY}px"></i><article class="card" style="left:${cX}px;top:${cY}px"><header><b>EV-${pad(nd.i + 1, 2)}</b><time>${fmtDate(e.date)}</time><em>${impZh[nd.impact] || "中"}</em></header><h3>${esc(e.title)}</h3><p class="card-blurb">${esc(e.blurb || "")}</p><footer>${tags}</footer>${leafHtml}</article>`;
          const d = `M ${nd.x.toFixed(1)} ${AXIS_Y} L ${nd.endX.toFixed(1)} ${nd.endY.toFixed(1)}`;
          paths += `<path class="branch-ink" data-i="${nd.i}" d="${d}" /><path class="branch" data-i="${nd.i}" d="${d}" />`;
        } else {
          node.innerHTML = `<i class="dot"></i><p class="lab"><time>${e.date.slice(0, 4)}</time><b>${esc(e.title)}</b></p>`;
        }
        node.style.visibility = "hidden";
        nd.el = node;
        nd.hidden = true;
        nd.settled = false;
        nd.zero = false;
        frag.appendChild(node);
      });
      el.nodes.appendChild(frag);

      axisX0 = RX[0] - 36;
      const axisX1 = RX[n - 1] + 480;
      axisLen = Math.max(1, axisX1 - axisX0);
      el.svg.setAttribute("width", String(axisX1 + 20));
      el.svg.setAttribute("height", "1080");
      el.svg.style.width = `${axisX1 + 20}px`;
      el.svg.style.height = "1080px";
      const axisD = `M ${axisX0} ${AXIS_Y} L ${axisX1} ${AXIS_Y}`;
      el.svg.innerHTML = `<path class="axis-ghost" d="${axisD}" /><path class="axis-ink" d="${axisD}" /><path class="axis-live" d="${axisD}" />${paths}`;
      axisPath = el.svg.querySelector(".axis-live");
      axisInk = el.svg.querySelector(".axis-ink");
      axisPath.style.strokeDasharray = `${axisLen} ${axisLen}`;
      axisInk.style.strokeDasharray = `${axisLen} ${axisLen}`;
      axisPath.style.strokeDashoffset = String(axisLen);
      axisInk.style.strokeDashoffset = String(axisLen);
      el.svg.querySelectorAll(".branch").forEach((p) => {
        const nd = nodes[Number(p.dataset.i)];
        nd.path = p;
        nd.pathLen = Math.hypot(nd.endX - nd.x, nd.endY - AXIS_Y) || 1;
        p.style.strokeDasharray = `${nd.pathLen} ${nd.pathLen}`;
        p.style.strokeDashoffset = String(nd.pathLen);
      });
      el.svg.querySelectorAll(".branch-ink").forEach((p) => {
        const nd = nodes[Number(p.dataset.i)];
        nd.ink = p;
        p.style.strokeDasharray = `${nd.pathLen} ${nd.pathLen}`;
        p.style.strokeDashoffset = String(nd.pathLen);
      });

      const y0 = Number(ev[0].date.slice(0, 4));
      const y1 = Number(ev[n - 1].date.slice(0, 4));
      let decades = "";
      for (let y = Math.floor(y0 / 10) * 10; y <= y1 + 10; y += 10) {
        const x = xAtTime(Date.UTC(y, 0, 1));
        decades += `<span style="left:${(x * 0.6).toFixed(1)}px">${y}</span>`;
      }
      el.decades.innerHTML = decades;

      const kinds = ["plus", "ring", "tri", "br"];
      let fg = "";
      for (let i = 0, x = 240; x < RX[n - 1] + 800; i += 1, x += 920) {
        const top = i % 2 === 0 ? 130 + ((i * 83) % 150) : 730 + ((i * 57) % 120);
        fg += `<i class="fg-bit fg-${kinds[i % 4]}" style="left:${(x * 1.42).toFixed(0)}px;top:${top}px"><b></b></i>`;
      }
      el.fg.innerHTML = fg;

      const span = RX[n - 1] - RX[0] || 1;
      el.ticks.innerHTML = ev
        .map((e, i) => `<i data-impact="${e.impact || "mid"}" style="left:${((RX[i] / span) * 100).toFixed(3)}%"></i>`)
        .join("");
      tickEls = [...el.ticks.children];
      let lastF = -1;
      let years = "";
      for (let y = Math.ceil(y0 / 10) * 10; y <= y1; y += 10) {
        const f = xAtTime(Date.UTC(y, 0, 1)) / span;
        if (f < 0 || f > 1) continue;
        if (lastF >= 0 && (f - lastF) * SCRUB_W < 52) continue;
        lastF = f;
        years += `<span style="left:${(f * 100).toFixed(2)}%">${y}</span>`;
      }
      el.syears.innerHTML = years;
      el.scrub.setAttribute("aria-valuemax", String(n));
      el.walker.style.top = `${AXIS_Y - 36}px`;
      el.scene.style.setProperty("--ax", `${AXIS_Y}px`);
      el.scene.style.setProperty("--fx", `${FOCUS_X}px`);
    }

    function prep(nd) {
      if (nd.ready) return;
      nd.joint = nd.el.querySelector(".joint");
      nd.dia = nd.el.querySelector(".diamond");
      nd.card = nd.el.querySelector(".card");
      nd.title = nd.el.querySelector("h3");
      nd.blurb = nd.el.querySelector(".card-blurb");
      nd.dot = nd.el.querySelector(".dot");
      nd.lab = nd.el.querySelector(".lab");
      nd.ready = true;
    }

    function paintMajor(nd, u) {
      prep(nd);
      if (u <= 0) {
        if (nd.zero) return;
        nd.zero = true;
        nd.settled = false;
        set(nd.path, "strokeDashoffset", nd.pathLen.toFixed(2));
        set(nd.ink, "strokeDashoffset", nd.pathLen.toFixed(2));
        set(nd.joint, "transform", "scale(0)");
        set(nd.dia, "transform", "rotate(45deg) scale(0)");
        set(nd.card, "opacity", "0");
        set(nd.card, "transform", "scale(0)");
        return;
      }
      nd.zero = false;
      if (u >= 1) {
        if (nd.settled) return;
        nd.settled = true;
        set(nd.path, "strokeDashoffset", "0");
        set(nd.ink, "strokeDashoffset", "0");
        set(nd.joint, "transform", "scale(1)");
        set(nd.dia, "transform", "rotate(45deg) scale(1)");
        set(nd.card, "opacity", "1");
        set(nd.card, "transform", "scale(1)");
        set(nd.title, "clipPath", "inset(0 0 0 0)");
        if (nd.blurb) set(nd.blurb, "clipPath", "inset(0 0 0 0)");
        return;
      }
      nd.settled = false;
      const cu = band(u, 0, 0.4);
      const ju = band(u, 0.06, 0.38);
      const du = band(u, 0.28, 0.66);
      const su = band(u, 0.4, 0.76);
      const tu = band(u, 0.55, 0.84);
      const bu = band(u, 0.68, 0.96);
      const js = reduce ? ju : pop(ju);
      const ds = reduce ? du : pop(du);
      const ss = reduce ? su : pop(su);
      const off = (nd.pathLen * (1 - cu)).toFixed(2);
      set(nd.path, "strokeDashoffset", off);
      set(nd.ink, "strokeDashoffset", off);
      set(nd.joint, "transform", `scale(${js.toFixed(3)})`);
      set(nd.dia, "transform", `rotate(45deg) scale(${Math.max(0, ds).toFixed(3)})`);
      set(nd.card, "transform", `scale(${Math.max(0, ss).toFixed(3)})`);
      set(nd.card, "opacity", clamp((su - 0.04) / 0.42, 0, 1).toFixed(3));
      set(nd.title, "clipPath", `inset(0 ${((1 - tu) * 100).toFixed(1)}% 0 0)`);
      if (nd.blurb) set(nd.blurb, "clipPath", `inset(0 ${((1 - bu) * 100).toFixed(1)}% 0 0)`);
    }

    function paintMinor(nd, u) {
      prep(nd);
      if (u <= 0) {
        if (nd.zero) return;
        nd.zero = true;
        nd.settled = false;
        set(nd.dot, "transform", "scale(0)");
        set(nd.lab, "opacity", "0");
        return;
      }
      nd.zero = false;
      if (u >= 1) {
        if (nd.settled) return;
        nd.settled = true;
        set(nd.dot, "transform", "scale(1)");
        set(nd.lab, "opacity", "1");
        set(nd.lab, "transform", "translate3d(0,0,0)");
        return;
      }
      nd.settled = false;
      const du = band(u, 0.04, 0.46);
      const lu = band(u, 0.32, 0.78);
      const ds = reduce ? du : pop(du);
      const dy = (1 - lu) * (nd.side === "up" ? 8 : -8);
      set(nd.dot, "transform", `scale(${Math.max(0, ds).toFixed(3)})`);
      set(nd.lab, "opacity", lu.toFixed(3));
      set(nd.lab, "transform", `translate3d(0,${dy.toFixed(1)}px,0)`);
    }

    function render(p) {
      const cam = xAt(p);
      set(el.mid, "transform", `translate3d(${(FOCUS_X - cam).toFixed(1)}px,0,0)`);
      set(el.decades, "transform", `translate3d(${(FOCUS_X - cam * 0.6).toFixed(1)}px,0,0)`);
      set(el.fg, "transform", `translate3d(${(FOCUS_X - cam * 1.42).toFixed(1)}px,0,0)`);
      set(el.walker, "transform", `translate3d(${cam.toFixed(1)}px,0,0)`);

      const drawn = clamp(cam + LEAD - axisX0, 0, axisLen);
      const axisOff = (axisLen - drawn).toFixed(1);
      set(axisPath, "strokeDashoffset", axisOff);
      set(axisInk, "strokeDashoffset", axisOff);

      const left = cam - FOCUS_X - 520;
      const right = cam + (1920 - FOCUS_X) + 520;
      for (let i = 0; i < n; i++) {
        const nd = nodes[i];
        const on = nd.x > left && nd.x < right;
        if (!on) {
          if (!nd.hidden) {
            nd.el.style.visibility = "hidden";
            nd.hidden = true;
          }
          continue;
        }
        if (nd.hidden) {
          nd.el.style.visibility = "visible";
          nd.hidden = false;
          nd.settled = false;
          nd.zero = false;
        }
        const u = nd.major
          ? clamp((cam - (nd.x - 340)) / 300, 0, 1)
          : clamp((cam - (nd.x - 220)) / 200, 0, 1);
        if (nd.major) paintMajor(nd, u);
        else paintMinor(nd, u);
      }

      const bp = `${(-cam * 0.6).toFixed(1)}px 0`;
      segs.forEach((seg, k) => {
        const cx = (RX[seg.start] + RX[seg.end]) / 2;
        const near = clamp(1 - Math.abs(cam - cx) / 2600, 0, 1);
        const sc = (0.88 + 0.12 * near).toFixed(3);
        const op = (0.07 + 0.28 * near).toFixed(3);
        const sx = FOCUS_X + (cx - cam) * 0.2;
        if (k === 0 || seg.on) {
          set(seg.el, "backgroundPosition", `${bp}, ${bp}`);
          set(seg.loom, "opacity", op);
          set(seg.loom, "transform", `translate3d(${(sx - 430).toFixed(1)}px,48px,0) scale(${sc})`);
        }
        if (k === 0) return;
        const travel = cam - (RX[seg.start] - 140);
        const t = clamp(travel / 700, 0, 1);
        if (t <= 0) {
          if (seg.on) {
            seg.el.style.visibility = "hidden";
            seg.on = false;
            seg.full = false;
            set(seg.ring, "opacity", "0");
          }
          return;
        }
        if (!seg.on) {
          seg.el.style.visibility = "visible";
          seg.on = true;
          set(seg.el, "backgroundPosition", `${bp}, ${bp}`);
        }
        if (t >= 1) {
          if (!seg.full) {
            seg.full = true;
            set(seg.el, "clipPath", "none");
            set(seg.ring, "opacity", "0");
          }
          return;
        }
        seg.full = false;
        const ox = FOCUS_X + (RX[seg.start] - cam);
        const oy = AXIS_Y - 88;
        const radius = 36 + t * 2500;
        set(seg.el, "clipPath", `circle(${radius.toFixed(0)}px at ${ox.toFixed(1)}px ${oy.toFixed(1)}px)`);
        set(seg.ring, "opacity", ((1 - t) * 0.9).toFixed(3));
        set(seg.ring, "transform", `translate3d(${ox.toFixed(1)}px,${AXIS_Y.toFixed(1)}px,0) scale(${(radius / 100).toFixed(3)})`);
      });

      const dt = new Date(timeAt(p));
      const ys = String(dt.getUTCFullYear());
      const ds = `${pad(dt.getUTCMonth() + 1)}.${pad(dt.getUTCDate())}`;
      if (ys !== hudYear) {
        hudYear = ys;
        el.year.textContent = ys;
      }
      if (ds !== hudDate) {
        hudDate = ds;
        el.date.textContent = ds;
      }
      const hr = String(Math.round(human(p)));
      if (hr !== hudHuman) {
        hudHuman = hr;
        el.human.textContent = hr;
      }
      const xs = String(Math.round(cam));
      if (xs !== hudX) {
        hudX = xs;
        el.xread.textContent = `X ${xs}  ·  Y 0.00`;
      }

      const span = RX[n - 1] - RX[0] || 1;
      const frac = clamp((cam - RX[0]) / span, 0, 1);
      set(el.fill, "transform", `scaleX(${frac.toFixed(4)})`);
      set(el.head, "transform", `translate3d(${(frac * SCRUB_W).toFixed(1)}px,0,0)`);
      set(el.timer, "transform", `scaleX(${frac.toFixed(4)})`);

      const near = clamp(Math.round(Math.max(p, 0)), 0, n - 1);
      if (near !== nearK) {
        nearK = near;
        const e = ev[near];
        el.era.textContent = e.era;
        el.idx.textContent = `EV-${pad(near + 1, 2)}`;
        el.count.textContent = `${pad(near + 1)}/${pad(n)}`;
        el.scrub.setAttribute("aria-valuenow", String(near + 1));
        el.scrub.setAttribute("aria-valuetext", `${e.date} ${e.title}`);
        tickEls.forEach((tk, i) => {
          tk.classList.toggle("is-past", i < near);
          tk.classList.toggle("is-on", i === near);
        });
      }

      const moving = playing || Math.abs(vel) > 0.045;
      if (moving !== wasGo) {
        wasGo = moving;
        el.scene.classList.toggle("is-go", moving);
      }
    }

    function layout() {
      ev = M.events;
      n = ev.length;
      if (!n) return;
      RX = new Array(n);
      RX[0] = 0;
      for (let i = 1; i < n; i++) {
        const years = Math.max(0, (ev[i].t - ev[i - 1].t) / (365.25 * 864e5));
        let g = 156 + 82 * Math.log2(1 + years);
        if (years < 0.45) g += 48;
        const hi = ev[i].impact === "high";
        const hip = ev[i - 1].impact === "high";
        if (hi || hip) g = Math.max(g, 300);
        if (hi && hip) g = Math.max(g, 380);
        if (ev[i].era !== ev[i - 1].era) g += 110;
        RX[i] = RX[i - 1] + g;
      }
      const cg = Math.max(0, ev.findIndex((e) => e.title === "ChatGPT"));
      leafCurve = M.leaves.map((l) => ({
        rem: l.remaining,
        j: l.hits.length ? Math.min(...l.hits.map((h) => ev.indexOf(h))) : -1,
        a: cg,
        b: Math.max(cg + 1, n - 1),
      }));
      layoutNodes();
      layoutSegs();
      buildDom();
      nearK = -1;
      render(pos);
    }

    function frame(now) {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastT) / 1000));
      lastT = now;
      if (playing && !dragging && n > 1) {
        const px = cruise(xAt(pos));
        target += (px / gapAt(pos)) * dt;
        if (target > pos + 0.55) target = pos + 0.55;
        if (target > n - 1) target = n - 1;
      }
      if (!dragging) {
        if (reduce) {
          pos = target;
          vel = 0;
        } else {
          const w = 5.2;
          const zeta = 0.88;
          const acc = w * w * (target - pos) - 2 * zeta * w * vel;
          vel += acc * dt;
          pos += vel * dt;
          if (Math.abs(target - pos) < 2e-4 && Math.abs(vel) < 2e-3) {
            pos = target;
            vel = 0;
          }
        }
      }
      pos = clamp(pos, -0.35, n - 1);
      if (playing && target >= n - 1 - 1e-4 && pos >= n - 1 - 0.004) setPlaying(false);
      render(pos);
      raf = requestAnimationFrame(frame);
    }

    function paintPlay() {
      el.play.innerHTML = intent ? '<span class="i-pause"></span>' : '<span class="i-play"></span>';
      el.play.classList.toggle("is-hold", intent && suspend);
      el.play.setAttribute("aria-label", intent ? (suspend ? "悬停已暂停，移开继续" : "暂停自动回放") : "开始自动回放");
    }

    function setPlaying(v) {
      intent = v;
      playing = intent && !suspend && !reduce;
      paintPlay();
    }

    function setSuspend(v) {
      if (suspend === v) return;
      suspend = v;
      playing = intent && !suspend && !reduce;
      paintPlay();
    }

    function toggle() {
      if (intent) {
        setPlaying(false);
        return;
      }
      if (n > 1 && target >= n - 1 - 0.02 && pos >= n - 1 - 0.05) {
        target = 0;
        pos = -0.2;
        vel = 0;
      }
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
      if (!n) return false;
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
      const px = clamp(d * 1.25, -480, 480);
      target = clamp(invX(xAt(target) + px), -0.15, n - 1);
      return true;
    }

    function bind() {
      paintPlay();
      el.scene.addEventListener("pointerenter", () => setSuspend(true));
      el.scene.addEventListener("pointerleave", () => setSuspend(false));
      $("#ac-prev").addEventListener("click", () => step(-1));
      $("#ac-next").addEventListener("click", () => step(1));
      el.play.addEventListener("click", toggle);

      const scale = () => Number(stage.style.getPropertyValue("--s")) || 1;
      let lastX = 0;
      let downX = 0;
      let downY = 0;
      let lastMoveT = 0;
      let camVel = 0;

      el.hit.addEventListener("pointerdown", (ev) => {
        dragging = true;
        setPlaying(false);
        el.hit.setPointerCapture(ev.pointerId);
        el.hit.classList.add("is-drag");
        lastX = downX = ev.clientX;
        downY = ev.clientY;
        lastMoveT = performance.now();
        camVel = 0;
        target = pos;
        vel = 0;
      });
      el.hit.addEventListener("pointermove", (ev) => {
        if (!dragging) return;
        const now = performance.now();
        const dx = (ev.clientX - lastX) / scale();
        lastX = ev.clientX;
        const dtm = Math.max(8, now - lastMoveT) / 1000;
        lastMoveT = now;
        pos = clamp(invX(xAt(pos) - dx), -0.25, n - 1);
        target = pos;
        vel = 0;
        const inst = -dx / dtm;
        camVel = camVel * 0.55 + inst * 0.45;
      });
      const up = (ev) => {
        if (!dragging) return;
        dragging = false;
        el.hit.classList.remove("is-drag");
        const moved = Math.hypot(ev.clientX - downX, ev.clientY - downY);
        if (moved < 6) {
          const s = scale();
          const r = stage.getBoundingClientRect();
          const sx = (ev.clientX - r.left) / s;
          const sy = (ev.clientY - r.top) / s;
          const cam = xAt(pos);
          const wx = cam + (sx - FOCUS_X);
          let best = -1;
          nodes.forEach((nd, i) => {
            if (Math.hypot(wx - nd.x, sy - AXIS_Y) < 28) best = i;
            if (nd.major) {
              if (Math.hypot(wx - nd.endX, sy - nd.endY) < 26) best = i;
              if (wx >= nd.cardX && wx <= nd.cardX + CARD_W && sy >= nd.cardY && sy <= nd.cardY + CARD_H) best = i;
            }
          });
          if (best >= 0) goTo(best);
          return;
        }
        if (performance.now() - lastMoveT > 80) camVel = 0;
        target = clamp(invX(xAt(pos) + clamp(camVel, -2400, 2400) * 0.32), -0.15, n - 1);
      };
      el.hit.addEventListener("pointerup", up);
      el.hit.addEventListener("pointercancel", up);

      let scrubDrag = false;
      const scrubTo = (ev) => {
        const r = el.scrub.getBoundingClientRect();
        const f = clamp((ev.clientX - r.left) / r.width, 0, 1);
        const x = (RX[0] || 0) + f * ((RX[n - 1] || 0) - (RX[0] || 0));
        target = invX(x);
        pos = target;
        vel = 0;
      };
      el.scrub.addEventListener("pointerdown", (ev) => {
        scrubDrag = true;
        dragging = true;
        setPlaying(false);
        el.scrub.setPointerCapture(ev.pointerId);
        scrubTo(ev);
      });
      el.scrub.addEventListener("pointermove", (ev) => {
        if (scrubDrag) scrubTo(ev);
      });
      const scrubUp = () => {
        if (!scrubDrag) return;
        scrubDrag = false;
        dragging = false;
      };
      el.scrub.addEventListener("pointerup", scrubUp);
      el.scrub.addEventListener("pointercancel", scrubUp);
      el.scrub.addEventListener("keydown", (ev) => {
        if (ev.key === "ArrowRight" || ev.key === "ArrowLeft") {
          ev.preventDefault();
          ev.stopPropagation();
          step(ev.key === "ArrowRight" ? 1 : -1);
        }
      });
    }

    function enter(prev) {
      if (!n) return;
      if (prev === 0 || prev == null || prev < 0) {
        vel = 0;
        nearK = -1;
        if (reduce) {
          pos = 0;
          target = 0;
          setPlaying(false);
        } else {
          pos = -0.28;
          target = 0;
          setPlaying(true);
        }
      }
      lastT = performance.now();
      edgeAt = 0;
      render(pos);
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
      hooks.enter[1] = (prev) => TL.enter(prev);
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
