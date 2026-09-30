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
    if (n >= 55) return "high";
    if (n <= 25) return "critical";
    return "";
  }

  function barClass(n) {
    return n >= 55 ? "survive-high" : "";
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
    t.textContent = formatISO(data.updated);
    $("#aggregate-num").textContent = String(aggregate);
    $("#score-disclaimer").textContent =
      data.scoreDisclaimer ||
      `血条为编辑估算（估算），非测量值。基准日 ${data.updated}。`;
  }

  function makeBar(remaining) {
    const wrap = document.createElement("div");
    wrap.className = "bar-wrap";

    const bar = document.createElement("div");
    bar.className = `bar ${barClass(remaining)}`.trim();
    bar.setAttribute("role", "img");
    bar.setAttribute(
      "aria-label",
      `人类剩余 ${remaining}%，AI 占据 ${100 - remaining}%`
    );

    const fill = document.createElement("div");
    fill.className = "bar-fill";
    fill.style.width = `${Math.max(0, Math.min(100, remaining))}%`;

    bar.append(fill);
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

    domains.forEach((domain) => {
      const remaining = avgLeaves(domain);
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

      const name = document.createElement("span");
      name.className = "domain-name";
      name.innerHTML = `<span class="chev" aria-hidden="true"></span><span class="domain-name-text">${escapeHtml(
        domain.name
      )}</span>`;

      btn.append(name, makeBar(remaining), makePct(remaining));

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

        cr.append(cn, makeBar(child.remaining), makePct(child.remaining), meta);
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

  function renderTimeline(events, filterEra) {
    const list = $("#timeline-list");
    list.textContent = "";

    const filtered = filterEra
      ? events.filter((e) => e.era === filterEra)
      : events.slice();

    const byEra = new Map();
    filtered.forEach((e) => {
      if (!byEra.has(e.era)) byEra.set(e.era, []);
      byEra.get(e.era).push(e);
    });

    byEra.forEach((evts, era) => {
      const block = document.createElement("div");
      block.className = "era-block";

      const label = document.createElement("h3");
      label.className = "era-label";
      label.textContent = era;
      block.append(label);

      evts.forEach((e) => {
        const art = document.createElement("article");
        art.className = "event";

        const year = document.createElement("div");
        year.className = "event-year";
        year.innerHTML = `${yearOf(e.date)}<span class="event-date-full">${formatISO(
          e.date
        )}</span>`;

        const body = document.createElement("div");
        const title = document.createElement("h4");
        title.className = "event-title";
        title.textContent = e.title;

        const blurb = document.createElement("p");
        blurb.className = "event-blurb";
        blurb.textContent = e.blurb;

        body.append(title, blurb);

        if (e.tags && e.tags.length) {
          const tags = document.createElement("div");
          tags.className = "event-tags";
          e.tags.forEach((t) => {
            const span = document.createElement("span");
            span.className = "tag";
            span.textContent = t;
            tags.append(span);
          });
          body.append(tags);
        }

        art.append(year, body);
        block.append(art);
      });

      list.append(block);
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

    const eras = uniqueEras(data.events || []);
    const paint = (era) => renderTimeline(data.events || [], era);
    renderFilters(eras, paint);
    paint(null);
  }

  main().catch((err) => {
    console.error(err);
    const t = $("#site-subtitle");
    if (t) {
      t.textContent =
        "数据文件加载失败。请用本地服务器打开，或确认 data.json 与本页同目录。";
      t.style.color = "#d85a3a";
    }
  });
})();
