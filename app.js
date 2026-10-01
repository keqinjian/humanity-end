(() => {
  "use strict";

  const DATA_URL = new URL("data.json", document.baseURI || window.location.href).href;

  const $ = (sel, root = document) => root.querySelector(sel);

  function avgLeaves(domain) {
    const leaves = domain.children || [];
    if (!leaves.length) return 0;
    const sum = leaves.reduce((a, c) => a + Number(c.remaining || 0), 0);
    return Math.round(sum / leaves.length);
  }

  function allLeaves(domains) {
    return domains.flatMap((d) => d.children || []);
  }

  function pctClass(n) {
    if (n <= 25) return "critical";
    return "";
  }

  function formatArchiveDate(iso) {
    if (!iso) return "";
    const parts = iso.split("-");
    if (parts.length < 2) return iso;
    return `${parts[1]}.${parts[2] || ""}`;
  }

  function formatISO(iso) {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return `${y}.${m}.${d}`;
  }

  function yearOf(iso) {
    return iso.slice(0, 4);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderHero(data, aggregate) {
    $("#site-title").textContent = data.title;
    document.title = data.title;
    $("#site-subtitle").textContent = data.subtitle || "";
    const t = $("#updated-date");
    t.dateTime = data.updated;
    t.textContent = formatArchiveDate(data.updated);
    $("#aggregate-num").textContent = String(aggregate);
    const ring = document.getElementById("aggregate-ring-val");
    if (ring) {
      const circ = 2 * Math.PI * 44;
      const pct = Math.max(0, Math.min(100, Number(aggregate) || 0));
      ring.style.strokeDasharray = String(circ);
      ring.style.strokeDashoffset = String(circ * (1 - pct / 100));
    }
    $("#score-disclaimer").textContent =
      data.scoreDisclaimer ||
      `血条为编辑估算（估算），非测量值。基准日 ${data.updated}。`;
  }

  function makeBar(remaining) {
    const wrap = document.createElement("div");
    wrap.className = "bar-wrap";

    const bar = document.createElement("div");
    bar.className = "bar";
    bar.setAttribute("role", "img");
    bar.setAttribute(
      "aria-label",
      `人类剩余 ${remaining}%，AI 占据 ${100 - remaining}%`
    );

    const fill = document.createElement("div");
    fill.className = "bar-fill";
    const clamped = Math.max(0, Math.min(100, remaining));
    fill.style.width = `${clamped}%`;

    const lost = document.createElement("div");
    lost.className = "bar-lost";
    lost.style.width = `${100 - clamped}%`;

    bar.append(fill, lost);
    wrap.append(bar);
    return wrap;
  }

  function makePct(remaining) {
    const el = document.createElement("span");
    el.className = `pct ${pctClass(remaining)}`.trim();
    el.textContent = `${remaining}%`;
    return el;
  }

  function renderDomains(domains) {
    const root = $("#domain-tree");
    root.textContent = "";

    domains.forEach((domain, i) => {
      const remaining = avgLeaves(domain);
      const idx = String(i + 1).padStart(2, "0");
      const row = document.createElement("div");
      row.className = "domain-row";
      row.setAttribute("role", "treeitem");
      row.setAttribute("aria-expanded", "false");

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "domain-btn";
      if (Number(domain.remaining) < 25) btn.classList.add("is-critical");
      btn.setAttribute("aria-expanded", "false");
      btn.setAttribute("aria-controls", `domain-kids-${domain.id}`);
      btn.id = `domain-btn-${domain.id}`;

      const idxEl = document.createElement("span");
      idxEl.className = "domain-idx";
      idxEl.textContent = idx;
      idxEl.setAttribute("aria-hidden", "true");

      const name = document.createElement("span");
      name.className = "domain-name";
      name.innerHTML = `<span class="chev" aria-hidden="true"></span><span class="domain-name-text">${escapeHtml(
        domain.name
      )}</span>`;

      btn.append(idxEl, name, makeBar(remaining), makePct(remaining));

      const kids = document.createElement("div");
      kids.className = "domain-children";
      kids.id = `domain-kids-${domain.id}`;
      kids.setAttribute("role", "group");
      kids.hidden = true;

      const inner = document.createElement("div");
      inner.className = "domain-children-inner";

      if (domain.note) {
        const parentNote = document.createElement("p");
        parentNote.className = "parent-note";
        parentNote.textContent = domain.note;
        inner.append(parentNote);
      }

      (domain.children || []).forEach((child) => {
        const cr = document.createElement("div");
        cr.className = "child-row";
        cr.setAttribute("role", "treeitem");

        const spacer = document.createElement("span");
        spacer.className = "domain-idx child-idx";
        spacer.setAttribute("aria-hidden", "true");
        spacer.textContent = "·";

        const cn = document.createElement("div");
        cn.className = "child-name";
        cn.textContent = child.name;

        const meta = document.createElement("p");
        meta.className = "child-meta";
        meta.innerHTML = `${escapeHtml(child.note || "")}${
          child.movedBy
            ? ` <strong>推动模型：</strong><span class="moved-by">${escapeHtml(
                child.movedBy
              )}</span>`
            : ""
        } <strong>· 估算</strong>`;

        cr.append(spacer, cn, makeBar(child.remaining), makePct(child.remaining), meta);
        inner.append(cr);
      });

      kids.append(inner);

      const toggle = () => {
        const open = btn.getAttribute("aria-expanded") === "true";
        const next = !open;
        btn.setAttribute("aria-expanded", String(next));
        row.setAttribute("aria-expanded", String(next));
        if (next) {
          kids.hidden = false;
          requestAnimationFrame(() => kids.classList.add("open"));
        } else {
          kids.classList.remove("open");
          const done = () => {
            if (btn.getAttribute("aria-expanded") === "false") {
              kids.hidden = true;
            }
            kids.removeEventListener("transitionend", done);
          };
          kids.addEventListener("transitionend", done);
          setTimeout(done, 400);
        }
      };

      btn.addEventListener("click", toggle);
      row.append(btn, kids);
      root.append(row);
    });
  }

  function uniqueEras(events) {
    const seen = new Set();
    const order = [];
    events.forEach((e) => {
      if (!seen.has(e.era)) {
        seen.add(e.era);
        order.push(e.era);
      }
    });
    return order;
  }

  /* ——— Horizontal axis timeline ——— */

  /* Three interlocking rails — mind merges 语言/推理; image & control stay. */
  const TRACKS = [
    { id: "mind", name: "语言与推理", top: "34%" },
    { id: "image", name: "图像与创作", top: "52%" },
    { id: "control", name: "棋与控制", top: "70%" },
  ];

  function trackOf(evt) {
    const tags = new Set(evt.tags || []);
    const t = evt.title || "";
    if (
      /DALL|Midjourney|Stable Diffusion|Sora|AlexNet|GAN/.test(t) ||
      tags.has("图像") ||
      tags.has("视频") ||
      tags.has("视觉") ||
      tags.has("CNN") ||
      tags.has("语音")
    ) {
      return "image";
    }
    if (
      tags.has("博弈") ||
      tags.has("强化学习") ||
      tags.has("硬件") ||
      tags.has("计算机") ||
      tags.has("计算机使用") ||
      tags.has("智能体") ||
      /深蓝|AlphaGo|ENIAC/.test(t)
    ) {
      return "control";
    }
    /* 语言、代码、推理、旗舰、科学 → 同一条「语言与推理」 */
    return "mind";
  }

  function trackMeta(id) {
    return TRACKS.find((t) => t.id === id) || TRACKS[0];
  }

  window.__HUMANITY_TRACKS__ = { TRACKS, trackOf, trackMeta };


  function dayStamp(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return Date.UTC(y, (m || 1) - 1, d || 1) / 86400000;
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function createAxisController(events) {
    const viewport = $("#axis-viewport");
    const track = $("#timeline-list");
    const stage = $("#axis-stage");
    const hint = $("#axis-hint");
    const readout = $("#axis-detail");
    const elYear = $("#readout-year");
    const elMeta = $("#readout-meta");
    const elTitle = $("#readout-title");
    const elBlurb = $("#readout-blurb");
    const elTags = $("#readout-tags");
    const elPlayheadYear = $("#playhead-year");
    const storyStrip = { el: null };

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const stamps = events.map((e) => dayStamp(e.date));
    const tMin = Math.min(...stamps);
    const tMax = Math.max(...stamps);

    /**
     * Density scale: KDE over event days → smooth stretch so packed years
     * claim more horizontal pixels. Positions are cumulative gaps; arbitrary
     * stamps (year ticks) interpolate in time between neighboring events.
     * Same scrollLeft still maps 1:1 to the same picture.
     */
    function yearFromStamp(stamp) {
      return new Date(stamp * 86400000).getUTCFullYear();
    }

    /**
     * Density scale with early-decade floor: 1946–1990 stays readable
     * (wide min gaps), while 2020s still expand under KDE pressure.
     */
    function buildDensityScale(stampList) {
      const n = stampList.length;
      const h = 160;
      let dens = stampList.map((t) => {
        let s = 0;
        for (let j = 0; j < n; j++) {
          const u = (t - stampList[j]) / h;
          s += Math.exp(-0.5 * u * u);
        }
        return s;
      });
      for (let pass = 0; pass < 2; pass++) {
        dens = dens.map((d, i) => {
          const a = dens[Math.max(0, i - 1)];
          const b = dens[Math.min(n - 1, i + 1)];
          return 0.2 * a + 0.6 * d + 0.2 * b;
        });
      }
      const dMin = Math.min(...dens);
      const dMax = Math.max(...dens);
      const norm = dens.map((d) => (d - dMin) / Math.max(1e-9, dMax - dMin));

      const xs = [0];
      for (let i = 0; i < n - 1; i++) {
        const days = Math.max(0.5, stampList[i + 1] - stampList[i]);
        const nd = (norm[i] + norm[i + 1]) / 2;
        const y = yearFromStamp(stampList[i]);
        /* Early decades: high floor + stronger year stretch. Late: denser KDE. */
        let floor = 300;
        let yearPow = 0.48;
        let yearMul = 70;
        if (y < 1970) {
          floor = 520;
          yearPow = 0.64;
          yearMul = 130;
        } else if (y < 2000) {
          floor = 500;
          yearPow = 0.62;
          yearMul = 120;
        } else if (y < 2012) {
          floor = 440;
          yearPow = 0.58;
          yearMul = 100;
        } else if (y < 2018) {
          floor = 360;
          yearPow = 0.5;
          yearMul = 80;
        }
        const gap = Math.max(
          floor,
          yearMul * Math.pow(days / 365, yearPow) + 140 + nd * 340
        );
        xs.push(xs[i] + gap);
      }
      return { xs, contentSpan: xs[n - 1], norm };
    }

    const density = buildDensityScale(stamps);
    let contentSpan = density.contentSpan;

    let selectedIndex = events.length - 1;
    let filterEra = null;
    let autoPan = !reduceMotion;
    let paused = false;
    let drag = null;
    let animFrame = 0;
    let lastTs = 0;
    let settleAnim = null;
    let fadeTimer = null;
    let syncLock = false;
    let edgePad = 0;

    const nodes = [];

    function measureEdgePad() {
      edgePad = Math.max(1, viewport.clientWidth * 0.5);
    }

    /** Event-indexed position (handles same-day milestones). */
    function xAt(i) {
      return edgePad + density.xs[i];
    }

    /** Continuous stamp → x for year ticks / scrub math between events. */
    function xOf(stamp) {
      const n = stamps.length;
      if (stamp <= stamps[0]) return xAt(0);
      if (stamp >= stamps[n - 1]) return xAt(n - 1);
      let i = 0;
      while (i < n - 1 && stamps[i + 1] < stamp) i += 1;
      const t0 = stamps[i];
      const t1 = stamps[i + 1];
      const u = t1 === t0 ? 0 : (stamp - t0) / (t1 - t0);
      return xAt(i) + u * (xAt(i + 1) - xAt(i));
    }

    function scrollMax() {
      /* With left/right edgePad = vw/2, max scroll places last event at center. */
      return Math.max(0, track.scrollWidth - viewport.clientWidth);
    }

    function layoutTrack() {
      measureEdgePad();
      track.style.width = `${edgePad + contentSpan + edgePad}px`;
      nodes.forEach((btn, i) => {
        btn.style.left = `${xAt(i)}px`;
        btn.style.top = trackMeta(trackOf(events[i])).top;
      });
      track.querySelectorAll(".axis-vrule").forEach((rule) => {
        const i = Number(rule.dataset.index);
        if (Number.isFinite(i)) rule.style.left = `${xAt(i)}px`;
      });
      track.querySelectorAll(".axis-era-band").forEach((band) => {
        const era = band.dataset.era;
        const idxs = events
          .map((e, i) => (e.era === era ? i : -1))
          .filter((i) => i >= 0);
        if (!idxs.length) return;
        const x0 = xAt(idxs[0]);
        const x1 = xAt(idxs[idxs.length - 1]);
        const bandW = Math.max(56, x1 - x0 + 72);
        band.style.left = `${x0 - 36}px`;
        band.style.width = `${bandW}px`;
      });
      track.querySelectorAll(".axis-tick, .axis-tick-label").forEach((el) => {
        const y = el.dataset.year;
        if (!y) return;
        el.style.left = `${xOf(dayStamp(`${y}-01-01`))}px`;
      });
      if (window.__HUMANITY_STORY__ && storyStrip.el) {
        window.__HUMANITY_STORY__.layoutStrip(storyStrip.el, (i) => xAt(i));
      }
      updateProgress();
    }

    function applyMotif(evt) {
      stage.dataset.era = evt ? evt.era : "";
      stage.dataset.year = evt ? yearOf(evt.date) : "";
      const tid = evt ? trackOf(evt) : "";
      stage.dataset.track = tid;
      const meta = tid ? trackMeta(tid) : null;
      stage.dataset.trackName = meta ? meta.name : "";
    }

    function layoutRecipe(evt) {
      const h = (evt.title || "").length + yearOf(evt.date).charCodeAt(0);
      const recipes = ["layout-a", "layout-b", "layout-c"];
      if (evt.impact === "high") {
        if (/Sora/.test(evt.title)) return "layout-a";
        if (/AlphaGo|深蓝|AlphaZero/.test(evt.title)) return "layout-b";
        if (/ChatGPT|Transformer|GPT-6|Gemini 4/.test(evt.title)) return "layout-c";
        return recipes[h % 3];
      }
      return "layout-b";
    }

    function paintReadout(evt) {
      if (!evt) return;
      const y = yearOf(evt.date);
      const recipe = layoutRecipe(evt);
      readout.classList.remove("layout-a", "layout-b", "layout-c", "layout-type-left", "layout-card-year");
      readout.classList.add(recipe);
      /* Single hero year: watermark playhead for A/C; card year for B only */
      if (recipe === "layout-b") {
        readout.classList.add("layout-card-year");
        stage.classList.add("has-card-year");
        elYear.textContent = y;
        if (elPlayheadYear) elPlayheadYear.textContent = y;
      } else {
        stage.classList.remove("has-card-year");
        elYear.textContent = "";
        if (elPlayheadYear) elPlayheadYear.textContent = y;
      }
      const impact = evt.impact === "high" || evt.impact === "low" ? evt.impact : "mid";
      const impactLabel = { high: "高影响", mid: "中影响", low: "低影响" }[impact];
      elMeta.textContent = `${formatISO(evt.date)} · ${evt.era} · ${trackMeta(trackOf(evt)).name} · ${impactLabel}`;
      const eraNowEl = document.getElementById("era-now");
      if (eraNowEl) eraNowEl.textContent = evt.era || "";
      elTitle.textContent = evt.title;
      elBlurb.textContent = evt.blurb || "";
      elTags.textContent = "";
      (evt.tags || []).forEach((t) => {
        const span = document.createElement("span");
        span.className = "tag";
        span.textContent = t;
        elTags.append(span);
      });
      /* Active track legend */
      document.querySelectorAll(".track-legend li").forEach((li, i) => {
        const tid = trackOf(evt);
        const map = ["mind", "image", "control"];
        li.classList.toggle("is-active", map[i] === tid);
      });
      document.querySelectorAll(".axis-rail").forEach((rail) => {
        rail.dataset.active = rail.dataset.track === trackOf(evt) ? "true" : "false";
      });
    }

    let readoutReady = false;
    let syncPaintTimer = null;

    function renderDetail(evt, { soft = false } = {}) {
      if (!evt) return;
      applyMotif(evt);
      if (reduceMotion || !readoutReady || soft) {
        paintReadout(evt);
        readout.classList.remove("is-fading");
        readoutReady = true;
        return;
      }
      readout.classList.add("is-fading");
      if (fadeTimer) clearTimeout(fadeTimer);
      fadeTimer = setTimeout(() => {
        paintReadout(evt);
        readout.classList.remove("is-fading");
      }, 160);
    }

    function setSelected(index, { scroll = true, instant = false, fromSync = false } = {}) {
      if (index < 0 || index >= events.length) return;
      if (index === selectedIndex && fromSync) {
        applyMotif(events[index]);
        updateProgress();
        return;
      }
      selectedIndex = index;
      const selTrack = trackOf(events[selectedIndex]);
      nodes.forEach((btn, i) => {
        const on = i === selectedIndex;
        btn.classList.toggle("is-selected", on);
        btn.setAttribute("aria-current", on ? "true" : "false");
        const dim = filterEra && events[i].era !== filterEra;
        btn.classList.toggle("is-dim", !!dim);
        const same = trackOf(events[i]) === selTrack;
        const near = Math.abs(i - selectedIndex) <= 2 && same;
        btn.classList.toggle("is-near-focus", near && !on);
        btn.classList.toggle("track-active-dim", same && !on && !near);
      });
      if (fromSync) {
        applyMotif(events[selectedIndex]);
        updateProgress();
        if (syncPaintTimer) clearTimeout(syncPaintTimer);
        syncPaintTimer = setTimeout(() => {
          renderDetail(events[selectedIndex], { soft: false });
        }, 90);
      } else {
        renderDetail(events[selectedIndex]);
        updateProgress();
      }
      if (scroll && !fromSync) scrollToIndex(selectedIndex, instant);
    }

    function updateProgress() {
      const x = xAt(selectedIndex);
      const prog = track.querySelector(".axis-progress");
      if (prog) prog.style.width = `${x}px`;
      const cross = track.querySelector(".axis-crosshair");
      if (cross) cross.style.left = `${x}px`;
    }

    function scrollToX(targetLeft, instant) {
      const max = scrollMax();
      const left = Math.max(0, Math.min(max, targetLeft));
      if (instant || reduceMotion) {
        viewport.scrollLeft = left;
        focusStories();
        return;
      }
      if (settleAnim) cancelAnimationFrame(settleAnim);
      const from = viewport.scrollLeft;
      const dist = left - from;
      if (Math.abs(dist) < 1) return;
      syncLock = true;
      const dur = Math.min(1100, 420 + Math.abs(dist) * 0.35);
      const t0 = performance.now();
      const step = (now) => {
        const u = Math.min(1, (now - t0) / dur);
        viewport.scrollLeft = from + dist * easeOutCubic(u);
        focusStories();
        if (u < 1) settleAnim = requestAnimationFrame(step);
        else {
          settleAnim = null;
          syncLock = false;
          focusStories();
          syncFromScroll();
        }
      };
      settleAnim = requestAnimationFrame(step);
    }

    function scrollToIndex(index, instant) {
      const x = xAt(index);
      const target = x - viewport.clientWidth * 0.5;
      scrollToX(target, instant);
    }

    function scrollToEra(era) {
      const idxs = events
        .map((e, i) => (e.era === era ? i : -1))
        .filter((i) => i >= 0);
      if (!idxs.length) return;
      const x0 = xAt(idxs[0]);
      const x1 = xAt(idxs[idxs.length - 1]);
      const mid = (x0 + x1) / 2;
      scrollToX(mid - viewport.clientWidth * 0.5, false); /* era span mid → center */
      setSelected(idxs[0], { scroll: false });
    }

    function nearestIndexAtCenter() {
      const center = viewport.scrollLeft + viewport.clientWidth * 0.5;
      let best = 0;
      let bestDist = Infinity;
      for (let i = 0; i < stamps.length; i++) {
        const d = Math.abs(xAt(i) - center);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      return best;
    }


    /**
     * Living map: landmarks pinned in world-x (content space).
     * screenX = worldX - scrollLeft * factor (factor < 1 = farther / slower).
     * Soft grid alone is not enough — these are readable map debris.
     */
    const LANDMARKS = [
      {
        id: "lm-schematic",
        frac: 0.12,
        factor: 0.28,
        layer: 0,
        top: "14%",
        kind: "schematic",
        title: "奠基示意",
        sub: "1956",
      },
      {
        id: "lm-compass",
        frac: 0.18,
        factor: 0.38,
        layer: 0,
        top: "66%",
        kind: "compass",
        title: "坐标环",
        sub: "N1",
      },
      {
        /* Mid pair LEFT: exits while scrolling forward */
        id: "lm-bands",
        frac: 0.24,
        factor: 0.50,
        layer: 1,
        top: "52%",
        kind: "bands",
        title: "光带剖面",
        sub: "切片",
      },
      {
        /* Mid pair RIGHT: enters on a nearer layer */
        id: "lm-dossier",
        frac: 0.46,
        factor: 0.88,
        layer: 2,
        top: "16%",
        kind: "dossier",
        title: "档案碎块",
        sub: "残卷",
      },
      {
        id: "lm-strips",
        frac: 1.02,
        factor: 1.0,
        layer: 2,
        top: "10%",
        kind: "strips",
        title: "终点光幕",
        sub: "2026",
      },
    ];

    let landmarksMounted = false;

    /* Continuous mid-band ground between landmarks (world-x pinned). */
    /* midFrac≈0.5*factor so chunks land mid-journey with landmarks */
    const GROUND_CHUNKS = [
      { id: "fg-a", frac0: 0.30, frac1: 0.40, factor: 0.72, kind: "ribbons" },
      { id: "fg-b", frac0: 0.36, frac1: 0.46, factor: 0.80, kind: "hatch" },
      { id: "fg-c", frac0: 0.40, frac1: 0.52, factor: 0.85, kind: "slices" },
      { id: "fg-d", frac0: 0.55, frac1: 0.68, factor: 0.90, kind: "ribbons" },
      { id: "fg-e", frac0: 0.78, frac1: 0.92, factor: 0.96, kind: "slices" },
    ];
    let groundMounted = false;

    function buildGroundChunk(spec) {
      const el = document.createElement("div");
      el.className = `field-ground kind-${spec.kind}`;
      el.id = spec.id;
      el.dataset.factor = String(spec.factor);
      el.dataset.frac0 = String(spec.frac0);
      el.dataset.frac1 = String(spec.frac1);
      if (spec.kind === "ribbons") {
        el.innerHTML = `<span class="fg-rib r0"></span><span class="fg-rib r1"></span><span class="fg-rib r2"></span><span class="fg-rib r3"></span><span class="fg-rib r4"></span>`;
      } else if (spec.kind === "slices") {
        el.innerHTML = `<span class="fg-slice s0"></span><i class="fg-gap"></i><span class="fg-slice s1"></span><i class="fg-gap"></i><span class="fg-slice s2"></span><i class="fg-gap"></i><span class="fg-slice s3"></span><i class="fg-gap"></i><span class="fg-slice s4"></span><i class="fg-gap"></i><span class="fg-slice s5"></span>`;
      } else {
        el.innerHTML = `<svg class="fg-hatch" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true">
          <line x1="0" y1="14" x2="400" y2="14" stroke="currentColor" stroke-width="1.3" opacity="0.55"/>
          <line x1="0" y1="36" x2="400" y2="36" stroke="currentColor" stroke-width="1.1" opacity="0.4"/>
          <line x1="0" y1="60" x2="400" y2="60" stroke="currentColor" stroke-width="1.5" opacity="0.7"/>
          <line x1="0" y1="84" x2="400" y2="84" stroke="currentColor" stroke-width="1.1" opacity="0.4"/>
          <line x1="0" y1="106" x2="400" y2="106" stroke="currentColor" stroke-width="1.3" opacity="0.55"/>
          <line x1="40" y1="0" x2="70" y2="120" stroke="currentColor" stroke-width="1.1" opacity="0.45"/>
          <line x1="110" y1="0" x2="140" y2="120" stroke="currentColor" stroke-width="1.1" opacity="0.35"/>
          <line x1="190" y1="0" x2="220" y2="120" stroke="currentColor" stroke-width="1.3" opacity="0.6"/>
          <line x1="270" y1="0" x2="300" y2="120" stroke="currentColor" stroke-width="1.1" opacity="0.35"/>
          <line x1="340" y1="0" x2="370" y2="120" stroke="currentColor" stroke-width="1.1" opacity="0.45"/>
        </svg>`;
      }
      return el;
    }

    function mountFieldGround() {
      const host = document.getElementById("field-ground-root");
      if (!host || groundMounted) return;
      host.textContent = "";
      GROUND_CHUNKS.forEach((spec) => host.appendChild(buildGroundChunk(spec)));
      groundMounted = true;
    }



    function landmarkWorldX(frac) {
      return edgePad + contentSpan * frac;
    }

    function buildLandmarkEl(spec) {
      const el = document.createElement("div");
      el.className = `field-landmark kind-${spec.kind}`;
      el.id = spec.id;
      el.dataset.factor = String(spec.factor);
      el.dataset.frac = String(spec.frac);
      el.style.top = spec.top;
      if (spec.kind === "schematic") {
        el.innerHTML = `
          <svg viewBox="0 0 160 120" class="lm-svg" aria-hidden="true">
            <circle cx="70" cy="60" r="42" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.55"/>
            <circle cx="70" cy="60" r="26" fill="none" stroke="currentColor" stroke-width="0.8" stroke-dasharray="4 3" opacity="0.4"/>
            <path d="M70 18 L70 102 M28 60 L112 60" stroke="currentColor" stroke-width="0.7" opacity="0.35"/>
            <path d="M70 60 L108 32" stroke="currentColor" stroke-width="1.4"/>
            <text x="118" y="28" fill="currentColor" font-size="11" font-family="Instrument Serif, serif">A</text>
            <text x="8" y="112" fill="currentColor" font-size="9" opacity="0.7" letter-spacing="0.12em">BLUEPRINT</text>
          </svg>
          <p class="lm-title">${spec.title}</p>
          <p class="lm-sub">${spec.sub}</p>`;
      } else if (spec.kind === "bands") {
        el.innerHTML = `
          <div class="lm-band-stack">
            <span class="lm-band b0"></span>
            <span class="lm-band b1"></span>
            <span class="lm-band b2"></span>
            <span class="lm-band b3"></span>
          </div>
          <p class="lm-title">${spec.title}</p>
          <p class="lm-sub">${spec.sub}</p>`;
      } else if (spec.kind === "dossier") {
        el.innerHTML = `
          <div class="lm-dossier-card">
            <span class="lm-brack">[</span>
            <div class="lm-dossier-body">
              <span class="lm-key">档案</span>
              <span class="lm-bars"><i></i><i></i><i></i></span>
              <span class="lm-pct">36</span>
            </div>
            <span class="lm-brack">]</span>
          </div>
          <p class="lm-title">${spec.title}</p>
          <p class="lm-sub">${spec.sub}</p>`;
      } else if (spec.kind === "compass") {
        el.innerHTML = `
          <svg viewBox="0 0 100 100" class="lm-svg lm-compass" aria-hidden="true">
            <polygon points="50,8 56,44 92,50 56,56 50,92 44,56 8,50 44,44" fill="none" stroke="currentColor" stroke-width="1"/>
            <circle cx="50" cy="50" r="6" fill="currentColor" opacity="0.5"/>
            <text x="50" y="18" text-anchor="middle" fill="currentColor" font-size="8">N1</text>
            <text x="86" y="53" fill="currentColor" font-size="8">E</text>
          </svg>
          <p class="lm-title">${spec.title}</p>
          <p class="lm-sub">${spec.sub}</p>`;
      } else {
        el.innerHTML = `
          <div class="lm-strip-curtain">
            <span></span><span></span><span></span><span></span><span></span>
          </div>
          <p class="lm-title">${spec.title}</p>
          <p class="lm-sub">${spec.sub}</p>`;
      }
      return el;
    }

    function mountFieldLandmarks() {
      const host = document.getElementById("field-landmarks-root");
      if (!host || landmarksMounted) return;
      host.textContent = "";
      LANDMARKS.forEach((spec) => {
        const el = buildLandmarkEl(spec);
        el.dataset.layer = String(spec.layer);
        host.appendChild(el);
      });
      landmarksMounted = true;
    }

    function updateFieldParallax() {
      const field = document.getElementById("field-parallax");
      if (!field) return;
      mountFieldLandmarks();
      mountFieldGround();
      const max = scrollMax();
      const p = max > 0 ? viewport.scrollLeft / max : 0;
      const sl = viewport.scrollLeft;
      stage.style.setProperty("--field-p", p.toFixed(4));
      /* Whole-field wash follows the playhead era, not a single node's plate. */
      const ERA_HUE = {
        "奠基": 208,
        "专用智能": 164,
        "深度学习": 262,
        "Transformer": 196,
        "生成爆发": 28,
        "推理与代理": 46,
        "2025 浪潮": 14,
        "2026 临界": 348,
      };
      const nearEvt = events[nearestIndexAtCenter()] || null;
      const hue = ERA_HUE[nearEvt && nearEvt.era] ?? 210;
      stage.style.setProperty("--era-hue", String(hue));
      field.dataset.era = nearEvt && nearEvt.era ? nearEvt.era : "";
      field.dataset.eraBand = String(Math.min(7, Math.floor(p * 8)));
      stage.dataset.fieldP = (p * 100).toFixed(0);
      /* Soft atmosphere still drifts; landmarks use discrete world-x below */
      const l0 = field.querySelector(".field-l0");
      const l1 = field.querySelector(".field-l1");
      const l2 = field.querySelector(".field-l2");
      const driftY = Math.sin(p * Math.PI * 2) * 14;
      if (l0) {
        l0.style.transform = `translate3d(${(-sl * 0.08).toFixed(1)}px, ${driftY.toFixed(1)}px, 0)`;
        l0.style.filter = `hue-rotate(${(hue - 210).toFixed(0)}deg) saturate(${(1.05 + p * 0.55).toFixed(2)})`;
      }
      if (l1) l1.style.transform = `translate3d(${(-sl * 0.16).toFixed(1)}px, ${(driftY * -0.6).toFixed(1)}px, 0)`;
      if (l2) l2.style.transform = `translate3d(${(-sl * 0.24 + p * 80).toFixed(1)}px, 0, 0) scale(${(1.02 + p * 0.06).toFixed(3)})`;

      /* World-x pin in viewport space: screenX = worldX - scrollLeft * factor */
      const vw = viewport.clientWidth || 1;
      const atEnd = max > 0 && sl >= max - 1.5;
      stage.classList.toggle("is-at-end", atEnd);
      LANDMARKS.forEach((spec) => {
        const node = document.getElementById(spec.id);
        if (!node) return;
        let worldX = landmarkWorldX(spec.frac);
        let screenX = worldX - sl * spec.factor;
        /* Terminus: pin light curtain flush to right edge */
        if (spec.id === "lm-strips" && atEnd) {
          const w = node.offsetWidth || vw * 0.3;
          screenX = vw - w - 2;
        }
        node.style.transform = `translate3d(${screenX.toFixed(1)}px, 0, 0)`;
        const visible = screenX > -280 && screenX < vw + 80;
        node.classList.toggle("is-in-view", visible);
        const mid = screenX + (node.offsetWidth || 120) * 0.5;
        node.classList.toggle("is-near", Math.abs(mid - vw * 0.5) < vw * 0.34);
        node.classList.toggle("is-exiting-left", visible && screenX < vw * 0.18);
        node.classList.toggle("is-entering-right", visible && screenX + (node.offsetWidth || 0) > vw * 0.78);
        /* Soften schematic/compass when under left readout */
        if (spec.id === "lm-schematic" || spec.id === "lm-compass") {
          const underReadout = screenX < vw * 0.38;
          node.classList.toggle("is-soft", underReadout || !visible);
        }
      });

      GROUND_CHUNKS.forEach((spec) => {
        const node = document.getElementById(spec.id);
        if (!node) return;
        /* Display width capped to viewport so hatch lines / slice columns stay countable */
        const midFrac = (spec.frac0 + spec.frac1) * 0.5;
        const midWorld = landmarkWorldX(midFrac);
        let widthFrac = 0.62;
        if (spec.kind === "slices") widthFrac = 0.72;
        else if (spec.kind === "hatch") widthFrac = 0.68;
        else if (spec.kind === "ribbons") widthFrac = 0.7;
        const width = Math.max(280, vw * widthFrac);
        const screen0 = midWorld - sl * spec.factor - width * 0.5;
        node.style.transform = `translate3d(${screen0.toFixed(1)}px, 0, 0)`;
        node.style.width = `${width.toFixed(1)}px`;
        const visible = screen0 + width > -40 && screen0 < vw + 40;
        node.classList.toggle("is-in-view", visible);
      });
    }

    function focusStories() {
      const centerX = viewport.scrollLeft + viewport.clientWidth * 0.5;
      const near = nearestIndexAtCenter();
      if (elPlayheadYear && events[near]) {
        elPlayheadYear.textContent = yearOf(events[near].date);
      }
      if (window.__HUMANITY_STORY__ && storyStrip.el) {
        window.__HUMANITY_STORY__.focusStrip(
          storyStrip.el,
          (i) => xAt(i),
          centerX,
          reduceMotion
        );
      }
      updateFieldParallax();
    }

    function syncFromScroll() {
      focusStories();
      updateFieldParallax();
      if (syncLock || drag) return;
      const idx = nearestIndexAtCenter();
      if (idx !== selectedIndex) {
        setSelected(idx, { scroll: false, fromSync: true });
      } else {
        applyMotif(events[idx]);
        updateProgress();
      }
    }

    function buildTrack() {
      landmarksMounted = false;
      groundMounted = false;
      track.textContent = "";
      measureEdgePad();
      track.style.width = `${edgePad + contentSpan + edgePad}px`;
      nodes.length = 0;

      const strip = document.createElement("div");
      strip.id = "story-strip";
      strip.className = "story-strip";
      track.append(strip);
      storyStrip.el = strip;
      if (window.__HUMANITY_STORY__) {
        window.__HUMANITY_STORY__.mountStrip(strip, events, (i) => xAt(i), trackOf);
      }

      /* Three interlocking rails + shared vertical rules at each event. */
      TRACKS.forEach((tr) => {
        const rail = document.createElement("div");
        rail.className = "axis-rail";
        rail.dataset.track = tr.id;
        rail.style.top = tr.top;
        rail.setAttribute("aria-hidden", "true");
        track.append(rail);
      });
      events.forEach((evt, i) => {
        const rule = document.createElement("div");
        rule.className = "axis-vrule";
        rule.style.left = `${xAt(i)}px`;
        rule.dataset.index = String(i);
        rule.setAttribute("aria-hidden", "true");
        track.append(rule);
      });

      const progress = document.createElement("div");
      progress.className = "axis-progress";
      progress.setAttribute("aria-hidden", "true");
      track.append(progress);

      const crosshair = document.createElement("div");
      crosshair.className = "axis-crosshair";
      crosshair.setAttribute("aria-hidden", "true");
      track.append(crosshair);

      const yStart = Number(yearOf(events[0].date));
      const yEnd = Number(yearOf(events[events.length - 1].date));
      uniqueEras(events).forEach((era) => {
        const idxs = events
          .map((e, i) => (e.era === era ? i : -1))
          .filter((i) => i >= 0);
        if (!idxs.length) return;
        const x0 = xAt(idxs[0]);
        const x1 = xAt(idxs[idxs.length - 1]);
        const bandW = Math.max(56, x1 - x0 + 72);
        const band = document.createElement("div");
        band.className = "axis-era-band";
        band.dataset.era = era;
        band.style.left = `${x0 - 36}px`;
        band.style.width = `${bandW}px`;
        // Hide in-band names when the band is too narrow to hold them without colliding.
        // Era chips above (and the active readout) still carry the full label.
        const minForLabel = Math.max(200, era.length * 20 + 32);
        if (bandW >= minForLabel) {
          const lab = document.createElement("span");
          lab.className = "axis-era-band-label";
          lab.textContent = era;
          band.append(lab);
        } else {
          band.classList.add("is-compact");
          const mark = document.createElement("span");
          mark.className = "axis-era-band-mark";
          mark.setAttribute("aria-hidden", "true");
          mark.title = era;
          band.append(mark);
        }
        track.append(band);
      });

            const yearSet = new Set();
      for (let y = yStart; y <= yEnd; y++) {
        const isDecade = y % 10 === 0;
        const isFive = y % 5 === 0;
        const late = y >= 2015;
        if (!(isDecade || isFive || late)) continue;
        if (yearSet.has(y)) continue;
        yearSet.add(y);
        const tick = document.createElement("div");
        tick.className = "axis-tick" + (isDecade ? " is-decade" : late && !isFive ? " is-year" : "");
        tick.style.left = `${xOf(dayStamp(`${y}-01-01`))}px`;
        tick.setAttribute("aria-hidden", "true");
        const lab = document.createElement("span");
        lab.className = "axis-tick-label" + (isDecade ? " is-decade" : "");
        lab.dataset.year = String(y);
        lab.textContent = String(y);
        lab.style.left = tick.style.left;
        track.append(tick, lab);
      }

      events.forEach((evt, i) => {
        const tid = trackOf(evt);
        const meta = trackMeta(tid);
        const btn = document.createElement("button");
        btn.type = "button";
        const impact = evt.impact === "high" || evt.impact === "low" ? evt.impact : "mid";
        btn.className = `axis-node track-${tid} impact-${impact}`;
        btn.style.left = `${xAt(i)}px`;
        btn.style.top = meta.top;
        btn.dataset.index = String(i);
        btn.dataset.track = tid;
        btn.dataset.impact = impact;
        btn.setAttribute(
          "aria-label",
          `${yearOf(evt.date)} ${evt.title}，${meta.name}，${evt.era}`
        );
        btn.setAttribute("aria-current", "false");

        const ring = document.createElement("span");
        ring.className = "axis-node-ring";
        ring.setAttribute("aria-hidden", "true");

        const mark = document.createElement("span");
        mark.className = "axis-node-mark";
        mark.setAttribute("aria-hidden", "true");

        const label = document.createElement("span");
        label.className = "axis-node-label is-above";
        label.innerHTML = `<span class="axis-node-year">${escapeHtml(
          yearOf(evt.date)
        )}</span><span class="axis-node-title">${escapeHtml(evt.title)}</span>`;

        btn.append(ring, mark, label);

        btn.addEventListener("click", () => {
          pauseAuto(2200);
          setSelected(i);
        });
        btn.addEventListener("focus", () => {
          pauseAuto(2400);
          setSelected(i, { scroll: true });
        });

        track.append(btn);
        nodes.push(btn);
      });
    }

    function applyFilter(era) {
      filterEra = era;
      track.querySelectorAll(".axis-era-band").forEach((band) => {
        band.classList.toggle("is-active", !!era && band.dataset.era === era);
      });
      nodes.forEach((btn, i) => {
        const dim = era && events[i].era !== era;
        btn.classList.toggle("is-dim", !!dim);
      });
      if (era) {
        pauseAuto(3500);
        scrollToEra(era);
      } else {
        nodes.forEach((btn) => btn.classList.remove("is-dim"));
        setSelected(selectedIndex, { scroll: true });
      }
      if (hint) {
        hint.textContent = era
          ? `已定位「${era}」区间 · 拖拽 / ← → 继续浏览`
          : "三轨时间轴 · 拖拽/滚轮横移 · ← → 选点 · 悬停暂停";
      }
    }

    function pauseAuto(ms) {
      paused = true;
      stage.classList.add("is-paused");
      if (pauseAuto._t) clearTimeout(pauseAuto._t);
      if (ms) {
        pauseAuto._t = setTimeout(() => {
          if (!drag && document.activeElement !== viewport) {
            paused = false;
            stage.classList.remove("is-paused");
          }
        }, ms);
      }
    }

    function resumeAutoSoon() {
      if (pauseAuto._t) clearTimeout(pauseAuto._t);
      pauseAuto._t = setTimeout(() => {
        if (!drag) {
          paused = false;
          stage.classList.remove("is-paused");
        }
      }, 1600);
    }

    function onPointerDown(e) {
      if (e.button !== 0) return;
      if (e.target.closest(".axis-node")) return;
      drag = {
        x: e.clientX,
        scroll: viewport.scrollLeft,
      };
      viewport.classList.add("is-dragging");
      pauseAuto(0);
      try {
        viewport.setPointerCapture(e.pointerId);
      } catch (_) {
        /* ignore */
      }
    }

    function onPointerMove(e) {
      if (!drag) return;
      viewport.scrollLeft = drag.scroll - (e.clientX - drag.x);
      focusStories();
      updateFieldParallax();
      syncFromScroll();
    }

    function onPointerUp() {
      if (!drag) return;
      drag = null;
      viewport.classList.remove("is-dragging");
      resumeAutoSoon();
      syncFromScroll();
    }

    function onWheel(e) {
      const absX = Math.abs(e.deltaX);
      const absY = Math.abs(e.deltaY);
      /* Vertical intent → let chapter-scroller move (timeline page can scroll up/down). */
      if (!e.shiftKey && absY >= absX && absY > 0.5) {
        const sc = document.getElementById("chapter-scroller");
        if (sc) {
          e.preventDefault();
          sc.scrollTop += e.deltaY;
        }
        return;
      }
      const dominant = e.shiftKey ? e.deltaY : (absX > absY ? e.deltaX : e.deltaY);
      if (Math.abs(dominant) < 0.5) return;
      e.preventDefault();
      pauseAuto(1800);
      viewport.scrollLeft = Math.max(0, Math.min(scrollMax(), viewport.scrollLeft + dominant));
      focusStories();
      syncFromScroll();
      updateFieldParallax();
    }

    function onKey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (!viewport.contains(e.target) && e.target !== viewport) {
        if (!stage.contains(document.activeElement) && document.activeElement !== viewport)
          return;
      }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        pauseAuto(2400);
        setSelected(Math.min(events.length - 1, selectedIndex + 1));
        nodes[selectedIndex]?.focus({ preventScroll: true });
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        pauseAuto(2400);
        setSelected(Math.max(0, selectedIndex - 1));
        nodes[selectedIndex]?.focus({ preventScroll: true });
      } else if (e.key === "Home") {
        e.preventDefault();
        setSelected(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setSelected(events.length - 1);
      }
    }

    function tick(ts) {
      animFrame = requestAnimationFrame(tick);
      if (!autoPan || paused || reduceMotion || drag) {
        lastTs = ts;
        return;
      }
      const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0;
      lastTs = ts;
      const max = scrollMax();
      if (max <= 0) return;
      const speed = max / 220;
      let next = viewport.scrollLeft + speed * dt;
      if (next >= max - 0.5) {
        viewport.scrollLeft = max;
        autoPan = false; /* stop at right end — no hard loop jump */
        stage.classList.add("is-at-end");
        focusStories();
        syncFromScroll();
        return;
      }
      viewport.scrollLeft = next;
      focusStories();
      syncFromScroll();
      updateFieldParallax();
    }

    function bind() {
      viewport.addEventListener("pointerdown", onPointerDown);
      viewport.addEventListener("pointermove", onPointerMove);
      viewport.addEventListener("pointerup", onPointerUp);
      viewport.addEventListener("pointercancel", onPointerUp);
      viewport.addEventListener("wheel", onWheel, { passive: false });
      viewport.addEventListener("scroll", () => {
        if (!drag && !syncLock) syncFromScroll();
      }, { passive: true });
      viewport.addEventListener("mouseenter", () => pauseAuto(0));
      viewport.addEventListener("mouseleave", () => {
        if (!drag) resumeAutoSoon();
      });
      viewport.addEventListener("focusin", () => pauseAuto(0));
      viewport.addEventListener("focusout", () => resumeAutoSoon());
      document.addEventListener("keydown", onKey);
      if (!reduceMotion) {
        animFrame = requestAnimationFrame(tick);
        if (hint) hint.textContent = "三轨时间轴 · 拖拽/滚轮横移 · ← → 选点 · 悬停暂停";
      } else if (hint) {
        hint.textContent = "已关闭自动漫游 · 拖拽或滚轮横向浏览 · ← → 选点";
      }
    }

    buildTrack();
    focusStories();
    bind();
    window.addEventListener("resize", () => {
      const idx = selectedIndex;
      layoutTrack();
      setSelected(idx, { scroll: true, instant: true });
    });
    setSelected(events.length - 1, { scroll: true, instant: true });
    updateFieldParallax();
    if (!reduceMotion) {
      requestAnimationFrame(() => {
        scrollToIndex(Math.max(0, events.length - 10), false);
      });
    }

    return {
      applyFilter,
      destroy() {
        cancelAnimationFrame(animFrame);
        if (settleAnim) cancelAnimationFrame(settleAnim);
        if (fadeTimer) clearTimeout(fadeTimer);
      },
    };
  }

  function renderFilters(eras, onChange) {
    const box = $("#era-filters");
    box.textContent = "";
    let active = "全部";

    const all = ["全部", ...eras];
    all.forEach((era) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "era-chip";
      chip.textContent = era;
      chip.dataset.era = era;
      chip.title = era;
      chip.setAttribute("aria-pressed", era === active ? "true" : "false");
      chip.addEventListener("click", () => {
        active = era;
        [...box.children].forEach((c) =>
          c.setAttribute("aria-pressed", c.dataset.era === active ? "true" : "false")
        );
        onChange(active === "全部" ? null : active);
      });
      box.append(chip);
    });
  }

  function loadScriptData() {
    return new Promise((resolve, reject) => {
      if (window.__HUMANITY_DATA__) {
        resolve(window.__HUMANITY_DATA__);
        return;
      }
      const s = document.createElement("script");
      s.src = new URL("data.js", document.baseURI || window.location.href).href;
      s.onload = () => {
        if (window.__HUMANITY_DATA__) resolve(window.__HUMANITY_DATA__);
        else reject(new Error("data.js 未导出 __HUMANITY_DATA__"));
      };
      s.onerror = () => reject(new Error("无法加载 data.js"));
      document.head.appendChild(s);
    });
  }

  async function loadData() {
    try {
      const res = await fetch(DATA_URL, { cache: "no-store" });
      if (res.ok) return res.json();
    } catch (_) {
      /* file:// or offline — fall through */
    }
    return loadScriptData();
  }


  /** Continuous vertical blend + true ring→rail morph. */
  function bindChapterBlend() {
    const scroller = $("#chapter-scroller");
    const dossier = $("#chapter-dossier");
    const timeline = $("#chapter-timeline");
    const morph = document.getElementById("morph-layer");
    const arc = document.getElementById("morph-arc");
    const rail = document.getElementById("morph-rail");
    const ticks = document.getElementById("morph-ticks");
    const gy0 = document.getElementById("morph-y0");
    const gy1 = document.getElementById("morph-y1");
    const gpct = document.getElementById("morph-pct");
    const eraNow = document.getElementById("era-now");
    if (!scroller || !dossier || !timeline) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function polar(cx, cy, r, deg) {
      const a = ((deg - 90) * Math.PI) / 180;
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    }

    /** Arc path from startDeg to endDeg (CSS-like, 0=top). */
    function arcPath(cx, cy, r, a0, a1) {
      const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
      const [x0, y0] = polar(cx, cy, r, a0);
      const [x1, y1] = polar(cx, cy, r, a1);
      const sweep = a1 >= a0 ? 1 : 0;
      return `M ${x0} ${y0} A ${r} ${r} 0 ${large} ${sweep} ${x1} ${y1}`;
    }

    function lerp(a, b, t) { return a + (b - a) * t; }

    function updateMorph(e) {
      if (!morph || !arc || !rail) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      morph.setAttribute("viewBox", `0 0 ${w} ${h}`);
      morph.classList.toggle("is-active", e > 0.04 && e < 0.92);

      /* Source: gauge ring area (left-ish on page1). Target: middle rail across stage. */
      const sx = w * 0.18;
      const sy = h * 0.58;
      const sr = Math.min(72, w * 0.055);
      const tx0 = w * 0.08;
      const tx1 = w * 0.92;
      const ty = h * 0.52;

      /* e: 0 ring intact → 0.5 half-open + rail stub → 1 full rail, ring gone */
      const open = Math.min(1, e / 0.55);
      const flatten = Math.max(0, (e - 0.25) / 0.55);
      const railT = Math.max(0, (e - 0.2) / 0.65);

      /* Incomplete arc: start at -90+gap, sweep shrinks then endpoints drift to horizontal */
      const gap = lerp(20, 140, open); /* missing segment grows */
      const a0 = -180 + gap * 0.5;
      const a1 = 180 - gap * 0.5;
      const cx = lerp(sx, (tx0 + tx1) / 2, flatten * 0.35);
      const cy = lerp(sy, ty, flatten);
      const rr = lerp(sr, lerp(sr, 8, flatten), open);
      /* When flattening hard, morph arc into nearly-horizontal curve then hand off to rail */
      if (flatten < 0.85) {
        arc.setAttribute("d", arcPath(cx, cy, Math.max(8, rr), a0, a1));
        arc.setAttribute("opacity", String(1 - flatten * 0.85));
        arc.setAttribute("stroke-width", String(lerp(2.6, 1.4, flatten)));
      } else {
        arc.setAttribute("d", `M ${lerp(cx - rr, tx0, (flatten - 0.85) / 0.15)} ${ty} L ${lerp(cx + rr, tx1 * 0.4, (flatten - 0.85) / 0.15)} ${ty}`);
        arc.setAttribute("opacity", String(Math.max(0, 1 - (flatten - 0.85) / 0.15)));
      }

      const railLen = (tx1 - tx0) * railT;
      rail.setAttribute("x1", String(tx0));
      rail.setAttribute("y1", String(ty));
      rail.setAttribute("x2", String(tx0 + railLen));
      rail.setAttribute("y2", String(ty));
      rail.setAttribute("opacity", String(Math.min(1, railT * 1.2) * (e < 0.9 ? 1 : 1 - (e - 0.9) / 0.1)));

      /* Year glyphs scatter → tick positions */
      if (gy0 && gy1) {
        const scatter = Math.max(0, (e - 0.15) / 0.5);
        gy0.setAttribute("x", String(lerp(sx - 90, tx0 + 40, scatter)));
        gy0.setAttribute("y", String(lerp(sy - 10, ty - 18, scatter)));
        gy0.setAttribute("opacity", String(Math.max(0, 0.55 - scatter * 0.35) * (e < 0.75 ? 1 : Math.max(0, 1 - (e - 0.75) / 0.2))));
        gy0.setAttribute("font-size", String(lerp(42, 14, scatter)));
        gy1.setAttribute("x", String(lerp(sx + 110, tx1 - 40, scatter)));
        gy1.setAttribute("y", String(lerp(sy - 10, ty - 18, scatter)));
        gy1.setAttribute("opacity", String(Math.max(0, 0.5 - scatter * 0.3) * (e < 0.75 ? 1 : Math.max(0, 1 - (e - 0.75) / 0.2))));
        gy1.setAttribute("font-size", String(lerp(42, 14, scatter)));
      }
      if (gpct) {
        gpct.setAttribute("x", String(cx));
        gpct.setAttribute("y", String(cy + 8));
        gpct.setAttribute("opacity", String(Math.max(0, 0.4 * (1 - open * 1.2))));
      }

      if (ticks) {
        ticks.textContent = "";
        const nTicks = Math.floor(lerp(0, 9, Math.max(0, (e - 0.35) / 0.45)));
        for (let i = 0; i < nTicks; i++) {
          const u = (i + 1) / (nTicks + 1);
          const x = tx0 + (tx0 + railLen - tx0) * u;
          if (x > tx0 + railLen) break;
          const ln = document.createElementNS("http://www.w3.org/2000/svg", "line");
          ln.setAttribute("x1", String(x));
          ln.setAttribute("x2", String(x));
          ln.setAttribute("y1", String(ty - 7));
          ln.setAttribute("y2", String(ty + 7));
          ln.setAttribute("stroke", "rgba(245,225,26,0.55)");
          ln.setAttribute("stroke-width", "1.2");
          ticks.appendChild(ln);
        }
      }
    }

    function update() {
      const seam = document.getElementById("page-seam");
      const sh = scroller.clientHeight;
      const origin = scroller.getBoundingClientRect().top;
      let e = 0;
      if (seam && sh > 0) {
        const top = seam.getBoundingClientRect().top - origin;
        const span = Math.max(180, sh * 0.62);
        let t = (sh * 0.82 - top) / span;
        t = Math.max(0, Math.min(1, t));
        e = t * t * (3 - 2 * t);
      }
      scroller.style.setProperty("--blend", e.toFixed(4));
      let zone = "early";
      if (e >= 0.2 && e < 0.78) zone = "mid";
      else if (e >= 0.78) zone = "late";
      scroller.dataset.blendZone = zone;

      if (!reduce) updateMorph(e);
      else if (morph) morph.classList.remove("is-active");

      /* Pages stay readable across the seam; morph is decorative only. */
      dossier.style.transform = "";
      dossier.style.opacity = "";
      dossier.style.filter = "";
      dossier.style.pointerEvents = "";
      timeline.style.opacity = "";
      timeline.style.pointerEvents = "";
    }

    scroller.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    /* If a gesture stops between the two pages, finish on the nearer one. */
    scroller.addEventListener("scrollend", () => {
      const pages = [...scroller.querySelectorAll(":scope > .chapter")];
      if (pages.length < 2) return;
      const y = scroller.scrollTop;
      let target = pages[0].offsetTop;
      let best = Infinity;
      pages.forEach((page) => {
        const d = Math.abs(page.offsetTop - y);
        if (d < best) {
          best = d;
          target = page.offsetTop;
        }
      });
      if (best > 6) scroller.scrollTo({ top: target, behavior: reduce ? "auto" : "smooth" });
    });
    update();
    return { update };
  }


  function bindThemeSwitcher() {
    const root = document.body;
    const saved = localStorage.getItem("humanity-theme");
    const themes = ["dark", "paper", "signal"];
    let cur = themes.includes(saved) ? saved : "dark";
    function apply(t) {
      cur = t;
      root.setAttribute("data-theme", t);
      localStorage.setItem("humanity-theme", t);
      document.querySelectorAll(".theme-btn").forEach((b) => {
        b.setAttribute("aria-pressed", b.dataset.theme === t ? "true" : "false");
      });
    }
    apply(cur);
    document.querySelectorAll(".theme-btn").forEach((b) => {
      b.addEventListener("click", () => apply(b.dataset.theme));
    });
  }

  async function main() {
    const data = await loadData();

    const leaves = allLeaves(data.domains || []);
    const aggregate = leaves.length
      ? Math.round(
          leaves.reduce((a, c) => a + Number(c.remaining || 0), 0) / leaves.length
        )
      : 0;

    renderHero(data, aggregate);
    renderDomains(data.domains || []);

    const events = data.events || [];
    const eras = uniqueEras(events);
    const axis = createAxisController(events);
    renderFilters(eras, (era) => axis.applyFilter(era));
    bindChapterBlend();
    bindThemeSwitcher();

    const cue = document.querySelector(".chapter-cue");
    if (cue) {
      cue.addEventListener("click", (ev) => {
        const target = document.querySelector(cue.getAttribute("href"));
        if (!target) return;
        ev.preventDefault();
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      });
    }
  }

  main().catch((err) => {
    console.error(err);
    const t = $("#site-subtitle");
    if (t) {
      t.textContent =
        "数据文件加载失败。请用本地服务器打开，或确认 data.json 与本页同目录。";
      t.style.color = "#c45c26";
    }
  });
})();
