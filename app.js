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

  const ERA_MOTIF = {
    "奠基": "foundation",
    "专用智能": "specialist",
    "深度学习": "deep",
    "Transformer": "transformer",
    "生成爆发": "generation",
    "推理与代理": "reason",
    "2025 浪潮": "wave",
    "2026 临界": "critical",
  };

  function motifFor(evt) {
    if (!evt) return "foundation";
    return ERA_MOTIF[evt.era] || "foundation";
  }

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
    const ghostNum = $("#field-ghost-num");
    const fieldTag = $("#field-tag");
    const fieldTicks = $("#field-ticks");

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const stamps = events.map((e) => dayStamp(e.date));
    const tMin = Math.min(...stamps);
    const tMax = Math.max(...stamps);
    const span = Math.max(1, tMax - tMin);

    const yearSpan = Math.max(
      1,
      Number(yearOf(events[events.length - 1].date)) - Number(yearOf(events[0].date))
    );
    const trackWidth = Math.max(2200, Math.round(yearSpan * 72 + 480));
    const padX = 140;

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

    const nodes = [];

    function xOf(stamp) {
      return padX + ((stamp - tMin) / span) * (trackWidth - padX * 2);
    }

    function buildFieldTicks() {
      if (!fieldTicks) return;
      fieldTicks.textContent = "";
      for (let i = 0; i < 48; i++) {
        const t = document.createElement("span");
        t.className = "field-tick";
        t.style.left = `${(i / 47) * 100}%`;
        t.style.height = i % 4 === 0 ? "22px" : "10px";
        t.style.marginTop = i % 4 === 0 ? "-11px" : "-5px";
        fieldTicks.append(t);
      }
    }

    function applyMotif(evt) {
      const motif = motifFor(evt);
      if (stage.dataset.motif !== motif) {
        stage.dataset.motif = motif;
      }
      if (ghostNum && evt) {
        ghostNum.textContent = yearOf(evt.date);
      }
      if (fieldTag && evt) {
        fieldTag.textContent = evt.era;
      }
    }

    function paintReadout(evt) {
      if (!evt) return;
      elYear.textContent = yearOf(evt.date);
      elMeta.textContent = `${formatISO(evt.date)} · ${evt.era}`;
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
      const x = xOf(stamps[selectedIndex]);
      const prog = track.querySelector(".axis-progress");
      if (prog) prog.style.width = `${x}px`;
      const cross = track.querySelector(".axis-crosshair");
      if (cross) cross.style.left = `${x}px`;
    }

    function scrollToX(targetLeft, instant) {
      const max = Math.max(0, track.scrollWidth - viewport.clientWidth);
      const left = Math.max(0, Math.min(max, targetLeft));
      if (instant || reduceMotion) {
        viewport.scrollLeft = left;
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
        if (u < 1) settleAnim = requestAnimationFrame(step);
        else {
          settleAnim = null;
          syncLock = false;
        }
      };
      settleAnim = requestAnimationFrame(step);
    }

    function scrollToIndex(index, instant) {
      const x = xOf(stamps[index]);
      const target = x - viewport.clientWidth * 0.38;
      scrollToX(target, instant);
    }

    function scrollToEra(era) {
      const idxs = events
        .map((e, i) => (e.era === era ? i : -1))
        .filter((i) => i >= 0);
      if (!idxs.length) return;
      const x0 = xOf(stamps[idxs[0]]);
      const x1 = xOf(stamps[idxs[idxs.length - 1]]);
      const mid = (x0 + x1) / 2;
      scrollToX(mid - viewport.clientWidth * 0.5, false);
      setSelected(idxs[0], { scroll: false });
    }

    function nearestIndexAtCenter() {
      const center = viewport.scrollLeft + viewport.clientWidth * 0.38;
      let best = 0;
      let bestDist = Infinity;
      for (let i = 0; i < stamps.length; i++) {
        const d = Math.abs(xOf(stamps[i]) - center);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      return best;
    }

    function syncFromScroll() {
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
      track.style.width = `${trackWidth}px`;
      nodes.length = 0;

      const spine = document.createElement("div");
      spine.className = "axis-spine";
      spine.setAttribute("aria-hidden", "true");
      track.append(spine);

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
      for (let y = Math.ceil(yStart / 10) * 10; y <= yEnd; y += 10) {
        const ghost = document.createElement("span");
        ghost.className = "axis-year-ghost";
        ghost.textContent = String(y);
        ghost.style.left = `${xOf(dayStamp(`${y}-01-01`))}px`;
        track.append(ghost);
      }

      uniqueEras(events).forEach((era) => {
        const idxs = events
          .map((e, i) => (e.era === era ? i : -1))
          .filter((i) => i >= 0);
        if (!idxs.length) return;
        const x0 = xOf(stamps[idxs[0]]);
        const x1 = xOf(stamps[idxs[idxs.length - 1]]);
        const band = document.createElement("div");
        band.className = "axis-era-band";
        band.dataset.era = era;
        band.style.left = `${x0 - 36}px`;
        band.style.width = `${Math.max(56, x1 - x0 + 72)}px`;
        const lab = document.createElement("span");
        lab.className = "axis-era-band-label";
        lab.textContent = era;
        band.append(lab);
        track.append(band);
      });

      for (let y = Math.ceil(yStart / 5) * 5; y <= yEnd; y += 5) {
        const tick = document.createElement("div");
        tick.className = "axis-tick";
        tick.style.left = `${xOf(dayStamp(`${y}-01-01`))}px`;
        tick.setAttribute("aria-hidden", "true");
        const lab = document.createElement("span");
        lab.className = "axis-tick-label";
        lab.textContent = String(y);
        lab.style.left = tick.style.left;
        track.append(tick, lab);
      }

      events.forEach((evt, i) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "axis-node";
        btn.style.left = `${xOf(stamps[i])}px`;
        btn.dataset.index = String(i);
        btn.setAttribute(
          "aria-label",
          `${yearOf(evt.date)} ${evt.title}，${evt.era}`
        );
        btn.setAttribute("aria-current", "false");

        const ring = document.createElement("span");
        ring.className = "axis-node-ring";
        ring.setAttribute("aria-hidden", "true");

        const mark = document.createElement("span");
        mark.className = "axis-node-mark";
        mark.setAttribute("aria-hidden", "true");

        const label = document.createElement("span");
        label.className = `axis-node-label ${i % 2 === 0 ? "is-above" : "is-below"}`;
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
          : "拖拽轴面 · 滚轮横移 · ← → 选点 · 悬停暂停漫游";
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
      viewport.scrollLeft += dominant;
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
      const max = Math.max(0, track.scrollWidth - viewport.clientWidth);
      if (max <= 0) return;
      const speed = max / 110;
      let next = viewport.scrollLeft + speed * dt;
      if (next >= max - 0.5) next = 0;
      viewport.scrollLeft = next;
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
        if (hint) hint.textContent = "拖拽轴面 · 滚轮横移 · ← → 选点 · 悬停暂停漫游";
      } else if (hint) {
        hint.textContent = "已关闭自动漫游 · 拖拽或滚轮横向浏览 · ← → 选点";
      }
    }

    buildFieldTicks();
    buildTrack();
    bind();
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
