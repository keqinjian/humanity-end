(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasIO = "IntersectionObserver" in window;

  /* ───────── tiny DOM helper ───────── */
  function el(tag, props = {}, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k === "style") n.style.cssText = v;
      else if (k === "dataset") Object.assign(n.dataset, v);
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? "" : v);
    }
    kids.flat().forEach((c) => {
      if (c == null || c === false) return;
      n.append(c.nodeType ? c : document.createTextNode(c));
    });
    return n;
  }

  /* ───────── data ───────── */
  function loadScriptData() {
    return new Promise((resolve, reject) => {
      if (window.__HUMANITY_DATA__) return resolve(window.__HUMANITY_DATA__);
      const s = document.createElement("script");
      s.src = new URL("data.js", document.baseURI).href;
      s.onload = () =>
        window.__HUMANITY_DATA__ ? resolve(window.__HUMANITY_DATA__) : reject(new Error("data.js 未导出数据"));
      s.onerror = () => reject(new Error("无法加载 data.js"));
      document.head.appendChild(s);
    });
  }

  async function loadData() {
    try {
      const res = await fetch(new URL("data.json", document.baseURI).href, { cache: "no-store" });
      if (res.ok) return await res.json();
    } catch (_) {
      /* file:// 等场景回退到 data.js */
    }
    return loadScriptData();
  }

  const level = (n) => (n <= 25 ? "crit" : n <= 50 ? "warn" : "ok");
  const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0);
  const pad2 = (n) => String(n).padStart(2, "0");
  const fmtDate = (iso) => iso.replaceAll("-", ".");

  /** 把 movedBy 里的模型名拆开，并与时间线事件按名字对上。 */
  function modelCandidates(movedBy) {
    return String(movedBy || "")
      .split(/\s*[\/、+]\s*/)
      .map((s) => s.trim().replace(/ 系$/, ""))
      .filter(Boolean);
  }
  function titleMatches(title, cand) {
    if (!cand) return false;
    const t = title.toLowerCase();
    const c = cand.toLowerCase();
    if (!t.startsWith(c)) return false;
    const next = t.charAt(c.length);
    return next === "" || next === " " || next === "-" || next === "/";
  }

  function prepare(raw) {
    const domains = (raw.domains || []).map((d, idx) => {
      const children = (d.children || []).map((c) => ({
        ...c,
        remaining: Number(c.remaining) || 0,
        domainId: d.id,
        domainName: d.name,
      }));
      return { ...d, idx, children, remaining: avg(children.map((c) => c.remaining)) };
    });
    const leaves = domains.flatMap((d) => d.children);
    const events = (raw.events || [])
      .map((e, i) => ({ ...e, _o: i }))
      .sort((a, b) => a.date.localeCompare(b.date) || a._o - b._o)
      .map((e, i) => ({ ...e, id: `evt-${i}`, year: e.date.slice(0, 4), impact: e.impact || "mid", moves: [] }));

    leaves.forEach((leaf) => {
      leaf.events = [];
      modelCandidates(leaf.movedBy).forEach((cand) => {
        events.forEach((e) => {
          if (titleMatches(e.title, cand) && !leaf.events.includes(e)) {
            leaf.events.push(e);
            e.moves.push(leaf);
          }
        });
      });
    });

    return { raw, domains, leaves, events, aggregate: avg(leaves.map((l) => l.remaining)) };
  }

  /* ───────── shared bits ───────── */
  const barEl = (v, delay = 0, cls = "") =>
    el(
      "span",
      { class: `bar lv-${level(v)} ${cls}`.trim(), style: `--v:${v};--d:${delay}`, role: "img", "aria-label": `人类剩余 ${v}%` },
      el("i", { class: "bar-fill" })
    );

  /* ───────── hero ───────── */
  function renderHero(S) {
    const { raw, domains, leaves, events, aggregate } = S;
    $("#site-title").textContent = raw.title || "记录人类完蛋全过程";
    document.title = raw.title || document.title;
    $("#site-subtitle").textContent = raw.subtitle || "";
    const t = $("#updated");
    t.textContent = fmtDate(raw.updated || "");
    t.dateTime = raw.updated || "";
    $("#disclaimer").textContent = raw.scoreDisclaimer || `血条为编辑估算，非测量值。基准日 ${raw.updated}。`;

    $("#stat-domains").textContent = pad2(domains.length);
    $("#stat-leaves").textContent = pad2(leaves.length);
    $("#stat-crit").textContent = pad2(leaves.filter((l) => l.remaining <= 25).length);
    const lowest = leaves.reduce((m, l) => (!m || l.remaining < m.remaining ? l : m), null);
    if (lowest) $("#stat-lowest").textContent = `${lowest.name} ${lowest.remaining}%`;

    const gauge = $(".hero-gauge");
    gauge.classList.add(`lv-${level(aggregate)}`);
    const hp = $("#hp");
    hp.classList.add(`lv-${level(aggregate)}`);
    hp.setAttribute("aria-label", `人类事务总剩余 ${aggregate}%`);

    /* 50 格血条：每格 2% */
    const cells = $("#hp-cells");
    for (let i = 0; i < 50; i++) {
      const f = Math.max(0, Math.min(1, (aggregate - i * 2) / 2));
      cells.append(el("i", { style: `--f:${f};--i:${i}` }));
    }
    const mark = $("#hp-mark");
    $("#hp-mark-text").textContent = `现在 ${aggregate}%`;
    requestAnimationFrame(() => mark.style.setProperty("--p", aggregate));

    countUp($("#agg-num"), aggregate);

    /* 年度里程碑柱状图：直观展示"加速" */
    const years = events.map((e) => Number(e.year));
    const y0 = Math.min(...years);
    const y1 = Math.max(...years);
    const counts = new Map();
    years.forEach((y) => counts.set(y, (counts.get(y) || 0) + 1));
    const max = Math.max(...counts.values());
    const bars = $("#pulse-bars");
    for (let y = y0, i = 0; y <= y1; y++, i++) {
      const c = counts.get(y) || 0;
      bars.append(
        el("i", {
          class: `${y >= 2022 ? "is-hot" : ""} ${c ? "" : "is-zero"}`.trim(),
          style: `--h:${c ? Math.max(14, (c / max) * 100) : 0};--i:${i}`,
          title: `${y}：${c} 个节点`,
        })
      );
    }
    const axis = $("#pulse-axis");
    const span = y1 - y0;
    [y0, 1970, 1990, 2010, 2022, y1].forEach((y) => {
      if (y < y0 || y > y1) return;
      const s = el("span", { text: String(y) });
      s.style.left = `${((y - y0) / span) * 100}%`;
      axis.append(s);
    });
    const recent = events.filter((e) => Number(e.year) >= 2022).length;
    const note = $("#pulse-note");
    note.append(
      `${events.length} 个节点里，`,
      el("b", { text: `${recent} 个（${Math.round((recent / events.length) * 100)}%）` }),
      " 发生在 2022 年之后"
    );
  }

  function countUp(node, to) {
    if (reduce) {
      node.textContent = String(to);
      return;
    }
    const t0 = performance.now();
    const dur = 1400;
    const step = (now) => {
      const u = Math.min(1, (now - t0) / dur);
      node.textContent = String(Math.round(to * (1 - Math.pow(1 - u, 3))));
      if (u < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ───────── domains ───────── */
  const state = { view: "domains", domainId: null, rank: "all", q: "", era: null, onlyHigh: false };

  function renderDomainList(S) {
    const list = $("#dom-list");
    list.textContent = "";
    S.domains.forEach((d, i) => {
      const crit = d.children.filter((c) => c.remaining <= 25).length;
      const b = el(
        "button",
        {
          type: "button",
          class: `dom lv-${level(d.remaining)}`,
          role: "listitem",
          dataset: { id: d.id },
          "aria-current": String(d.id === state.domainId),
          onclick: () => selectDomain(S, d.id),
        },
        el("span", { class: "dom-idx", text: pad2(i + 1) }),
        el("span", { class: "dom-name" }, d.name, el("small", { text: `${d.children.length} 项 · 临界 ${crit}` })),
        el("span", { class: "dom-pct" }, String(d.remaining), el("small", { text: "%" })),
        barEl(d.remaining, i * 60)
      );
      list.append(b);
    });
  }

  function renderDetail(S, flashLeafId) {
    const d = S.domains.find((x) => x.id === state.domainId);
    const box = $("#dom-detail");
    if (!d) return;
    box.textContent = "";
    box.style.animation = "none";
    void box.offsetWidth;
    box.style.animation = "";

    const lv = level(d.remaining);
    box.append(
      el(
        "header",
        { class: `dd-head lv-${lv}` },
        el("p", { class: "dd-eyebrow", text: `领域 ${pad2(d.idx + 1)} / ${pad2(S.domains.length)}` }),
        el("h3", { class: "dd-title", text: d.name }),
        el("p", { class: "dd-score" }, String(d.remaining), el("small", { text: "%" })),
        el("p", { class: "dd-note", text: d.note || "" }),
        barEl(d.remaining, 0, "bar-lg")
      )
    );

    const ul = el("ul", { class: "leaves" });
    [...d.children]
      .sort((a, b) => a.remaining - b.remaining)
      .forEach((c, i) => {
        const li = el(
          "li",
          { class: `leaf lv-${level(c.remaining)}`, id: `leaf-${c.id}` },
          el(
            "div",
            { class: "leaf-top" },
            el("span", { class: "leaf-name", text: c.name }),
            barEl(c.remaining, i * 40),
            el("span", { class: "leaf-pct", text: `${c.remaining}%` })
          ),
          c.note ? el("p", { class: "leaf-note", text: c.note }) : null,
          c.movedBy ? el("div", { class: "by" }, "推动：", modelChips(S, c)) : null
        );
        if (c.id === flashLeafId) {
          li.classList.add("is-flash");
          setTimeout(() => li.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" }), 80);
        }
        ul.append(li);
      });
    box.append(ul);
    if (!flashLeafId) box.scrollTop = 0;
  }

  /** movedBy 的每个模型名：能对上时间线事件的变成可点按钮。 */
  function modelChips(S, leaf) {
    const cands = modelCandidates(leaf.movedBy);
    const raw = leaf.movedBy;
    if (!leaf.events.length) return [el("span", { class: "chip-model", text: raw })];
    const used = new Set();
    const out = [];
    cands.forEach((cand) => {
      const evt = leaf.events.find((e) => titleMatches(e.title, cand));
      if (evt && !used.has(evt.id)) {
        used.add(evt.id);
        out.push(
          el("button", { type: "button", class: "chip-model", text: cand, onclick: () => jumpToEvent(S, evt.id) })
        );
      } else if (!evt) {
        out.push(el("span", { class: "chip-model", text: cand }));
      }
    });
    return out;
  }

  function selectDomain(S, id, flashLeafId) {
    state.domainId = id;
    $$("#dom-list .dom").forEach((b) => b.setAttribute("aria-current", String(b.dataset.id === id)));
    renderDetail(S, flashLeafId);
  }

  function setView(S, view) {
    state.view = view;
    $("#view-domains").hidden = view !== "domains";
    $("#view-rank").hidden = view !== "rank";
    $$("#domains > .sec-head .seg-btn").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === view)));
    if (view === "rank") renderRank(S);
  }

  function renderRank(S) {
    const q = state.q.trim().toLowerCase();
    let rows = [...S.leaves].sort((a, b) => a.remaining - b.remaining);
    if (state.rank === "crit") rows = rows.filter((r) => r.remaining <= 25);
    if (q) rows = rows.filter((r) => `${r.name} ${r.domainName} ${r.movedBy || ""} ${r.note || ""}`.toLowerCase().includes(q));
    $("#rank-count").textContent = `${rows.length} / ${S.leaves.length} 项 · 按剩余由少到多`;
    const ol = $("#rank-list");
    ol.textContent = "";
    if (!rows.length) {
      ol.append(el("li", { class: "rk-empty", text: "没有匹配的细项。" }));
      return;
    }
    rows.forEach((r, i) => {
      ol.append(
        el(
          "li",
          {},
          el(
            "button",
            {
              type: "button",
              class: `rk lv-${level(r.remaining)}`,
              title: "查看所在领域",
              onclick: () => {
                setView(S, "domains");
                selectDomain(S, r.domainId, r.id);
              },
            },
            el("span", { class: "rk-n", text: pad2(i + 1) }),
            el("span", { class: "rk-name" }, r.name, el("small", { text: r.domainName })),
            barEl(r.remaining, Math.min(i, 20) * 20),
            el("span", { class: "rk-pct", text: `${r.remaining}%` })
          )
        )
      );
    });
  }

  function bindDomainControls(S) {
    $$("#domains > .sec-head .seg-btn").forEach((b) => b.addEventListener("click", () => setView(S, b.dataset.view)));
    $$(".rank-tools [data-rank]").forEach((b) =>
      b.addEventListener("click", () => {
        state.rank = b.dataset.rank;
        $$(".rank-tools [data-rank]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        renderRank(S);
      })
    );
    $("#rank-q").addEventListener("input", (e) => {
      state.q = e.target.value;
      renderRank(S);
    });
  }

  /* ───────── timeline ───────── */
  const IMPACT = { high: "高影响", mid: "中影响", low: "低影响" };

  function visibleEvents(S) {
    return S.events.filter((e) => (!state.era || e.era === state.era) && (!state.onlyHigh || e.impact === "high"));
  }

  function renderTimeline(S) {
    const list = $("#tl-list");
    list.textContent = "";
    const evts = visibleEvents(S);
    $("#tl-count").textContent = `显示 ${evts.length} / ${S.events.length} 个节点`;
    if (!evts.length) {
      list.append(el("p", { class: "empty", text: "这个筛选下没有节点。" }));
      return;
    }
    const byYear = new Map();
    evts.forEach((e) => {
      if (!byYear.has(e.year)) byYear.set(e.year, []);
      byYear.get(e.year).push(e);
    });
    byYear.forEach((arr, year) => {
      const g = el("section", { class: "yg", dataset: { year, era: arr[0].era } });
      g.append(el("h3", { class: "yg-year", text: year }));
      const box = el("div", { class: "yg-events" });
      arr.forEach((e) => box.append(eventEl(S, e)));
      g.append(box);
      list.append(g);
    });
    observeTimeline();
  }

  function eventEl(S, e) {
    const card = el(
      "div",
      { class: "evt-card" },
      el(
        "div",
        { class: "evt-meta" },
        el("time", { datetime: e.date, text: e.date.slice(5).replace("-", ".") }),
        el("span", { class: "evt-era", text: e.era }),
        e.impact === "high" ? el("span", { class: "evt-imp", text: IMPACT.high }) : null
      ),
      el("h3", { text: e.title }),
      e.blurb ? el("p", { text: e.blurb }) : null,
      e.tags && e.tags.length ? el("div", { class: "tags" }, e.tags.map((t) => el("span", { class: "tag", text: t }))) : null
    );

    if (e.moves.length) {
      const panelId = `mv-${e.id}`;
      const panel = el("div", { class: "moves-list", id: panelId, hidden: true });
      [...e.moves]
        .sort((a, b) => a.remaining - b.remaining)
        .forEach((leaf) =>
          panel.append(
            el(
              "button",
              {
                type: "button",
                class: `mv lv-${level(leaf.remaining)}`,
                onclick: () => jumpToLeaf(S, leaf),
              },
              el("span", { class: "mv-name" }, leaf.name, el("small", { text: leaf.domainName })),
              barEl(leaf.remaining),
              el("span", { class: "mv-pct", text: `${leaf.remaining}%` })
            )
          )
        );
      const toggle = el("button", {
        type: "button",
        class: "moves-toggle",
        "aria-expanded": "false",
        "aria-controls": panelId,
        text: `它推动了 ${e.moves.length} 个细项的血条`,
        onclick: () => {
          const open = toggle.getAttribute("aria-expanded") === "true";
          toggle.setAttribute("aria-expanded", String(!open));
          panel.hidden = open;
        },
      });
      card.append(el("div", { class: "moves" }, toggle, panel));
    }

    return el("article", { class: `evt imp-${e.impact}`, id: e.id }, el("span", { class: "evt-dot" }), card);
  }

  let tlObserver = null;
  let revealObserver = null;
  function observeTimeline() {
    if (tlObserver) tlObserver.disconnect();
    if (revealObserver) revealObserver.disconnect();
    const groups = $$("#tl-list .yg");
    const evts = $$("#tl-list .evt");

    if (!hasIO) {
      updateActive(groups[0]);
      return;
    }
    if (!reduce) {
      document.documentElement.classList.add("js-reveal");
      revealObserver = new IntersectionObserver(
        (entries) =>
          entries.forEach((en) => {
            if (en.isIntersecting) {
              en.target.classList.add("is-in");
              revealObserver.unobserve(en.target);
            }
          }),
        { rootMargin: "0px 0px -6% 0px" }
      );
      evts.forEach((n) => revealObserver.observe(n));
    }

    /* 左侧大年份跟随当前阅读位置 */
    tlObserver = new IntersectionObserver(
      (entries) =>
        entries.forEach((en) => {
          if (en.isIntersecting) updateActive(en.target);
        }),
      { rootMargin: "-35% 0px -55% 0px" }
    );
    groups.forEach((g) => tlObserver.observe(g));
    updateActive(groups[0]);
  }

  function updateActive(g) {
    if (!g) return;
    $$("#tl-list .yg.is-active").forEach((n) => n.classList.remove("is-active"));
    g.classList.add("is-active");
    $("#tl-year").textContent = g.dataset.year;
    $("#tl-era").textContent = g.dataset.era;
  }

  function renderFilters(S) {
    const box = $("#era-chips");
    box.textContent = "";
    const eras = [];
    S.events.forEach((e) => !eras.includes(e.era) && eras.push(e.era));
    [null, ...eras].forEach((era) => {
      box.append(
        el("button", {
          type: "button",
          class: "chip",
          text: era || "全部",
          "aria-pressed": String(state.era === era),
          dataset: { era: era || "" },
          onclick: () => {
            state.era = era;
            $$("#era-chips .chip").forEach((c) => c.setAttribute("aria-pressed", String((c.dataset.era || null) === era)));
            renderTimeline(S);
          },
        })
      );
    });
    $("#only-high").addEventListener("change", (e) => {
      state.onlyHigh = e.target.checked;
      renderTimeline(S);
    });
  }

  /* ───────── cross links ───────── */
  function flash(node) {
    node.classList.remove("is-flash");
    void node.offsetWidth;
    node.classList.add("is-flash");
    setTimeout(() => node.classList.remove("is-flash"), 2000);
  }

  function jumpToEvent(S, id) {
    const evt = S.events.find((e) => e.id === id);
    const hidden = !$(`#${id}`);
    if (hidden) {
      state.era = null;
      state.onlyHigh = false;
      $("#only-high").checked = false;
      $$("#era-chips .chip").forEach((c) => c.setAttribute("aria-pressed", String(!c.dataset.era)));
      renderTimeline(S);
    }
    const node = $(`#${id}`);
    if (!node || !evt) return;
    node.classList.add("is-in");
    node.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    setTimeout(() => flash(node), reduce ? 0 : 500);
  }

  function jumpToLeaf(S, leaf) {
    setView(S, "domains");
    selectDomain(S, leaf.domainId, leaf.id);
    $("#domains").scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
    setTimeout(() => {
      const n = $(`#leaf-${leaf.id}`);
      if (n) flash(n);
    }, 300);
  }

  /* ───────── nav highlight ───────── */
  function bindNav() {
    const links = $$(".nav a");
    const map = new Map(links.map((a) => [a.dataset.nav, a]));
    if (!hasIO) return;
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          links.forEach((a) => a.classList.remove("is-on"));
          const a = map.get(en.target.id);
          if (a) a.classList.add("is-on");
        }),
      { rootMargin: "-45% 0px -50% 0px" }
    );
    ["top", "domains", "timeline"].forEach((id) => {
      const n = document.getElementById(id);
      if (n) io.observe(n);
    });
  }

  /* ───────── boot ───────── */
  async function main() {
    const S = prepare(await loadData());
    renderHero(S);

    const lowest = [...S.domains].sort((a, b) => a.remaining - b.remaining)[0];
    state.domainId = lowest ? lowest.id : null;
    renderDomainList(S);
    renderDetail(S);
    bindDomainControls(S);

    renderFilters(S);
    renderTimeline(S);
    bindNav();
  }

  main().catch((err) => {
    console.error(err);
    const t = $("#site-subtitle");
    if (t) t.textContent = "数据加载失败。请用本地服务器打开，或确认 data.json 与本页同目录。";
  });
})();
