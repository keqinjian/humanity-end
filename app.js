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
      tags.has("CNN")
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

    function paintReadout(evt) {
      if (!evt) return;
      elYear.textContent = yearOf(evt.date);
      elMeta.textContent = `${formatISO(evt.date)} · ${evt.era} · ${trackMeta(trackOf(evt)).name}`;
      elTitle.textContent = evt.title;
      elBlurb.textContent = evt.blurb || "";
      elTags.textContent = "";
      (evt.tags || []).forEach((t) => {
        const span = document.createElement("span");
        span.className = "tag";
        span.textContent = t;
        elTags.append(span);
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
      nodes.forEach((btn, i) => {
        const on = i === selectedIndex;
        btn.classList.toggle("is-selected", on);
        btn.setAttribute("aria-current", on ? "true" : "false");
        const dim = filterEra && events[i].era !== filterEra;
        btn.classList.toggle("is-dim", !!dim);
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

    function focusStories() {
      if (!window.__HUMANITY_STORY__ || !storyStrip.el) return;
      const centerX = viewport.scrollLeft + viewport.clientWidth * 0.5;
      window.__HUMANITY_STORY__.focusStrip(
        storyStrip.el,
        (i) => xAt(i),
        centerX,
        reduceMotion
      );
    }

    function syncFromScroll() {
      focusStories();
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

      for (let y = Math.ceil(yStart / 5) * 5; y <= yEnd; y += 5) {
        const tick = document.createElement("div");
        tick.className = "axis-tick";
        tick.dataset.year = String(y);
        tick.style.left = `${xOf(dayStamp(`${y}-01-01`))}px`;
        tick.setAttribute("aria-hidden", "true");
        const lab = document.createElement("span");
        lab.className = "axis-tick-label";
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
        btn.className = `axis-node track-${tid}`;
        btn.style.left = `${xAt(i)}px`;
        btn.style.top = meta.top;
        btn.dataset.index = String(i);
        btn.dataset.track = tid;
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
      const dominant =
        Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(dominant) < 0.5) return;
      e.preventDefault();
      pauseAuto(1800);
      viewport.scrollLeft = Math.max(0, Math.min(scrollMax(), viewport.scrollLeft + dominant));
      focusStories();
      syncFromScroll();
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
      const speed = max / 110;
      let next = viewport.scrollLeft + speed * dt;
      if (next >= max - 0.5) next = 0; /* loop: last-at-center → first-at-center */
      viewport.scrollLeft = next;
      focusStories();
      syncFromScroll();
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
      chip.setAttribute("aria-pressed", era === active ? "true" : "false");
      chip.addEventListener("click", () => {
        active = era;
        [...box.children].forEach((c) =>
          c.setAttribute("aria-pressed", c.textContent === active ? "true" : "false")
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
