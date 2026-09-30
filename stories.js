(() => {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";

  function el(name, attrs = {}, kids = []) {
    const node = document.createElementNS(NS, name);
    Object.entries(attrs).forEach(([k, v]) => {
      if (v == null || v === false) return;
      node.setAttribute(k, String(v));
    });
    kids.forEach((c) => {
      if (c == null) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }

  function clamp01(t) {
    return Math.max(0, Math.min(1, t));
  }

  function easeOut(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function setTransform(node, tr) {
    node.setAttribute("transform", tr);
  }

  function clipBlurb(s, n) {
    const t = String(s || "").trim();
    if (t.length <= n) return t;
    return t.slice(0, n - 1) + "…";
  }

  function trackOf(evt) {
    if (window.__HUMANITY_TRACKS__ && window.__HUMANITY_TRACKS__.trackOf) {
      return window.__HUMANITY_TRACKS__.trackOf(evt);
    }
    return "lang";
  }

  function trackMeta(id) {
    if (window.__HUMANITY_TRACKS__ && window.__HUMANITY_TRACKS__.trackMeta) {
      return window.__HUMANITY_TRACKS__.trackMeta(id);
    }
    return { id: "mind", name: "语言与推理", top: "30%" };
  }

  /* ——— 语言与代码：排印 / 括号 / 行 cascade（非侧滑盒子） ——— */
  function sceneLang(evt) {
    const title = evt.title || "";
    /* Letterforms as print objects — short mark, not a second caption of the full title. */
    const mark = /[\u4e00-\u9fff]/.test(title)
      ? title.replace(/\s+/g, "").slice(0, 4)
      : title.replace(/\s+/g, " ").slice(0, 12);
    const glyphs = [...mark];
    const baseline = el("line", {
      x1: 320, y1: 268, x2: 320, y2: 268,
      stroke: "#1d4e89", "stroke-width": 1.6, "stroke-linecap": "round"
    });
    const caret = el("line", {
      x1: 120, y1: 220, x2: 120, y2: 280,
      stroke: "#2f6fed", "stroke-width": 2
    });
    const brL = el("text", {
      x: 96, y: 258, fill: "#16324f", "font-size": 72,
      "font-family": "Instrument Serif, serif", "text-anchor": "middle"
    }, ["⟨"]);
    const brR = el("text", {
      x: 544, y: 258, fill: "#16324f", "font-size": 72,
      "font-family": "Instrument Serif, serif", "text-anchor": "middle"
    }, ["⟩"]);
    const brLG = el("g", {}, [brL]);
    const brRG = el("g", {}, [brR]);
    const letters = glyphs.map((ch, i) => {
      const x = 140 + i * 26;
      const g = el("g", {}, [
        el("text", {
          x, y: 262, fill: "#102033",
          "font-family": "Noto Serif SC, serif", "font-size": 28,
          "text-anchor": "middle"
        }, [ch])
      ]);
      return { g, i, x };
    });
    const codeLine = ((evt.tags || []).slice(0, 3).join(" · ")) || "print";
    const codeClip = el("clipPath", { id: `clip-lang-${Math.random().toString(36).slice(2, 8)}` }, [
      el("rect", { x: 140, y: 300, width: 0, height: 36 })
    ]);
    const codeText = el("text", {
      x: 148, y: 324, fill: "#1d4e89",
      "font-family": "ui-monospace, Noto Sans SC, monospace", "font-size": 13
    }, [codeLine]);
    const codeG = el("g", { "clip-path": `url(#${codeClip.id})` }, [
      el("rect", { x: 140, y: 300, width: 360, height: 36, fill: "#e8eef6" }),
      codeText
    ]);
    const tagG = el("g", {});
    const vbridge = el("line", {
      x1: 320, y1: 40, x2: 320, y2: 40,
      stroke: "#2f6fed", "stroke-width": 1, "stroke-dasharray": "3 5", opacity: 0.55
    });
    const crossArm = el("line", {
      x1: 320, y1: 300, x2: 320, y2: 300,
      stroke: "#d5deea", "stroke-width": 1
    });
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [
      vbridge, crossArm, codeClip, tagG, baseline, brLG, brRG, caret, ...letters.map((L) => L.g), codeG
    ]);

    function apply(p) {
      const e = easeOut(clamp01(p));
      baseline.setAttribute("x1", String(320 - 200 * e));
      baseline.setAttribute("x2", String(320 + 210 * e));
      /* Glyphs fall onto the baseline — vertical cascade, staggered. */
      letters.forEach(({ g, i, x }) => {
        const local = clamp01((e - i * 0.045) / 0.7);
        const drop = (1 - local * local) * -90;
        const rot = (1 - local) * (i % 2 === 0 ? -18 : 14);
        setTransform(g, `translate(0 ${drop.toFixed(2)}) rotate(${rot.toFixed(2)} ${x} 262)`);
      });
      const caretX = 120 + 360 * e;
      caret.setAttribute("x1", String(caretX));
      caret.setAttribute("x2", String(caretX));
      setTransform(brLG, `translate(${((1 - e) * -70).toFixed(2)} 0)`);
      setTransform(brRG, `translate(${((1 - e) * 70).toFixed(2)} 0)`);
      const clipRect = codeClip.firstChild;
      clipRect.setAttribute("width", String(360 * e * e));
      setTransform(tagG, `translate(0 ${((1 - e) * -24).toFixed(2)})`);
      /* Vertical bridge grows through neighboring rail bands. */
      vbridge.setAttribute("y2", String(40 + 400 * e));
      crossArm.setAttribute("x1", String(320 - 90 * e));
      crossArm.setAttribute("x2", String(320 + 90 * e));
      crossArm.setAttribute("y1", String(360));
      crossArm.setAttribute("y2", String(360));
    }

    return { svg, apply };
  }

  /* ——— 图像与创作：裁切线 / 画框 / 齿孔（角部汇聚，非侧滑） ——— */
  function sceneImage(evt) {
    const frame = el("rect", {
      x: 160, y: 150, width: 320, height: 200,
      fill: "#f4f7fb", stroke: "#1d4e89", "stroke-width": 2.2
    });
    const frameG = el("g", {}, [frame]);
    const crops = [
      { x: 160, y: 150, dx: -1, dy: -1 },
      { x: 480, y: 150, dx: 1, dy: -1 },
      { x: 160, y: 350, dx: -1, dy: 1 },
      { x: 480, y: 350, dx: 1, dy: 1 },
    ].map((c, i) => {
      const g = el("g", {}, [
        el("line", { x1: c.x, y1: c.y, x2: c.x + c.dx * 18, y2: c.y, stroke: "#2f6fed", "stroke-width": 1.6 }),
        el("line", { x1: c.x, y1: c.y, x2: c.x, y2: c.y + c.dy * 18, stroke: "#2f6fed", "stroke-width": 1.6 }),
      ]);
      return { g, c, i };
    });
    const shapes = [
      el("circle", { cx: 240, cy: 230, r: 36, fill: "none", stroke: "#16324f", "stroke-width": 1.8 }),
      el("rect", { x: 300, y: 200, width: 90, height: 70, fill: "none", stroke: "#2f6fed", "stroke-width": 1.8 }),
      el("path", { d: "M420 280 L460 210 L500 280 Z", fill: "none", stroke: "#1d4e89", "stroke-width": 1.8 }),
    ].map((node, i) => el("g", { "data-shape": String(i) }, [node]));
    const sprockets = [];
    for (let i = 0; i < 8; i++) {
      sprockets.push(el("rect", {
        x: 132, y: 160 + i * 24, width: 14, height: 10,
        fill: "none", stroke: "#1d4e89", "stroke-width": 1.2
      }));
    }
    const sprocketG = el("g", {}, sprockets);
    const prompt = el("text", {
      x: 176, y: 138, fill: "#1d4e89",
      "font-family": "Noto Sans SC, sans-serif", "font-size": 13, "letter-spacing": "0.08em"
    }, [clipBlurb((evt.tags && evt.tags.join(" · ")) || "图像", 28)]);
    const promptG = el("g", {}, [prompt]);
    const tagG = el("g", {});
    const rule = el("line", {
      x1: 320, y1: 370, x2: 320, y2: 370, stroke: "#1d4e89", "stroke-width": 1.4
    });
    const vbridge = el("line", {
      x1: 320, y1: 60, x2: 320, y2: 60,
      stroke: "#2f6fed", "stroke-width": 1, "stroke-dasharray": "2 6", opacity: 0.5
    });
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [
      vbridge, sprocketG, ...crops.map((c) => c.g), frameG, ...shapes, promptG, rule, tagG
    ]);

    function apply(p) {
      const e = easeInOut(clamp01(p));
      /* Frame: rotate + scale from center — print press feel. */
      const rot = (1 - e) * -9;
      const sc = 0.62 + 0.38 * e;
      setTransform(frameG, `translate(320 250) rotate(${rot.toFixed(2)}) scale(${sc.toFixed(3)}) translate(-320 -250)`);
      crops.forEach(({ g, c }) => {
        const ox = c.dx * 56 * (1 - e);
        const oy = c.dy * 56 * (1 - e);
        setTransform(g, `translate(${ox.toFixed(2)} ${oy.toFixed(2)})`);
      });
      shapes.forEach((g, i) => {
        const ang = (i / 3) * Math.PI * 2 + (1 - e) * 1.2;
        const r = (1 - e) * 48;
        const dx = Math.cos(ang) * r;
        const dy = Math.sin(ang) * r - (1 - e) * 20;
        setTransform(g, `translate(${dx.toFixed(2)} ${dy.toFixed(2)})`);
      });
      /* Sprockets travel down the film edge. */
      setTransform(sprocketG, `translate(0 ${((1 - e) * -80).toFixed(2)})`);
      setTransform(promptG, `translate(${((1 - e) * -40).toFixed(2)} 0)`);
      rule.setAttribute("x1", String(320 - 160 * e));
      rule.setAttribute("x2", String(320 + 160 * e));
      setTransform(tagG, `translate(0 ${((1 - e) * 30).toFixed(2)})`);
      vbridge.setAttribute("y1", String(60 - 40 * e));
      vbridge.setAttribute("y2", String(60 + 360 * e));
    }

    return { svg, apply };
  }

  /* ——— 棋与控制：准星 / 网格展开 / 落子（从中心扩张，非模板侧滑） ——— */
  function sceneControl(evt) {
    const isBoard = /深蓝|AlphaGo|棋/.test(evt.title || "");
    const isCabinets = /ENIAC/.test(evt.title || "");
    const crossH = el("line", { x1: 320, y1: 240, x2: 320, y2: 240, stroke: "#2f6fed", "stroke-width": 1.4 });
    const crossV = el("line", { x1: 320, y1: 240, x2: 320, y2: 240, stroke: "#2f6fed", "stroke-width": 1.4 });
    const grid = [];
    for (let i = 0; i < 5; i++) {
      grid.push(el("line", { x1: 320, y1: 160 + i * 40, x2: 320, y2: 160 + i * 40, stroke: "#d5deea", "stroke-width": 1 }));
      grid.push(el("line", { x1: 200 + i * 60, y1: 240, x2: 200 + i * 60, y2: 240, stroke: "#d5deea", "stroke-width": 1 }));
    }
    const piece = el("g", {}, [
      el("circle", { cx: 320, cy: 240, r: 14, fill: "#e8eef6", stroke: "#16324f", "stroke-width": 2 }),
      el("circle", { cx: 320, cy: 240, r: 5, fill: "#2f6fed" }),
    ]);
    const cursor = el("path", {
      d: "M300 200 L300 200", fill: "none", stroke: "#1d4e89", "stroke-width": 1.5, "stroke-dasharray": "4 3"
    });
    const cabinets = [];
    if (isCabinets) {
      for (let i = 0; i < 5; i++) {
        const x = 170 + i * 70;
        cabinets.push(el("g", { "data-cab": String(i) }, [
          el("rect", { x, y: 150, width: 54, height: 180, fill: "#e8eef6", stroke: "#1d4e89", "stroke-width": 1.8 }),
          el("rect", { x: x + 8, y: 168, width: 38, height: 14, fill: "none", stroke: "#2f6fed", "stroke-width": 1.2 }),
          el("rect", { x: x + 8, y: 196, width: 38, height: 14, fill: "none", stroke: "#2f6fed", "stroke-width": 1.2 }),
          el("rect", { x: x + 8, y: 224, width: 38, height: 14, fill: "none", stroke: "#2f6fed", "stroke-width": 1.2 }),
        ]));
      }
    }
    const cells = [];
    if (isBoard) {
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          cells.push(el("rect", {
            x: 240 + c * 40, y: 160 + r * 40, width: 36, height: 36,
            fill: (r + c) % 2 ? "#e8eef6" : "#f4f7fb", stroke: "#1d4e89", "stroke-width": 1
          }));
        }
      }
    }
    const tagG = el("g", {});
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [
      ...grid, crossH, crossV, ...cells, ...cabinets, piece, cursor, tagG
    ]);

    function apply(p) {
      const e = easeOut(clamp01(p));
      const arm = 140 * e;
      crossH.setAttribute("x1", String(320 - arm));
      crossH.setAttribute("x2", String(320 + arm));
      /* Vertical arm reaches into neighboring rails. */
      crossV.setAttribute("y1", String(240 - 160 * e));
      crossV.setAttribute("y2", String(240 + 160 * e));
      grid.forEach((ln, i) => {
        const local = clamp01((e - (i % 5) * 0.06) / 0.85);
        if (i < 5) {
          ln.setAttribute("x1", String(320 - 140 * local));
          ln.setAttribute("x2", String(320 + 140 * local));
        } else {
          ln.setAttribute("y1", String(240 - 100 * local));
          ln.setAttribute("y2", String(240 + 100 * local));
        }
      });
      /* Piece drops onto the board. */
      const drop = (1 - e * e) * -110;
      setTransform(piece, `translate(0 ${drop.toFixed(2)}) scale(${(0.4 + 0.6 * e).toFixed(3)})`);
      const pathLen = e;
      cursor.setAttribute("d", `M260 180 Q${280 + 40 * pathLen} ${200 + 20 * pathLen} ${300 + 40 * pathLen} ${230 + 10 * pathLen}`);
      cabinets.forEach((g, i) => {
        const local = clamp01((e - i * 0.1) / 0.75);
        const dy = (1 - local * local) * -140;
        const sc = 0.7 + 0.3 * local;
        setTransform(g, `translate(0 ${dy.toFixed(2)}) scale(1 ${sc.toFixed(3)})`);
      });
      cells.forEach((cell, i) => {
        const local = clamp01((e - (i % 4) * 0.05 - Math.floor(i / 4) * 0.08) / 0.7);
        const sc = 0.2 + 0.8 * local * local;
        const cx = 240 + (i % 4) * 40 + 18;
        const cy = 160 + Math.floor(i / 4) * 40 + 18;
        setTransform(cell, `translate(${cx} ${cy}) scale(${sc.toFixed(3)}) translate(${-cx} ${-cy})`);
      });
      setTransform(tagG, `translate(0 ${((1 - e) * 24).toFixed(2)})`);
    }

    return { svg, apply };
  }

  /* ——— 推理与通用：纵深层叠 / 弧线珠 / 结论板旋转入位 ——— */
  function sceneReason(evt) {
    const layers = ["读题", "拆解", "演算", "核验"].map((lab, i) => {
      const y = 150 + i * 36;
      const g = el("g", {}, [
        el("rect", {
          x: 180, y, width: 280, height: 28,
          fill: "#e8eef6", stroke: "#1d4e89", "stroke-width": 1.4
        }),
        el("text", {
          x: 320, y: y + 19, "text-anchor": "middle", fill: "#102033",
          "font-family": "Noto Sans SC, sans-serif", "font-size": 13
        }, [lab]),
      ]);
      return { g, i, y };
    });
    const arc = el("path", {
      d: "M120 320 Q320 200 520 320",
      fill: "none", stroke: "#d5deea", "stroke-width": 2
    });
    const beads = [0.15, 0.4, 0.65, 0.88].map((u, i) =>
      el("circle", {
        cx: 0, cy: 0, r: 9, fill: i === 3 ? "#2f6fed" : "#e8eef6",
        stroke: "#16324f", "stroke-width": 1.5, "data-u": String(u)
      })
    );
    const beadGs = beads.map((b) => el("g", {}, [b]));
    const plate = el("g", {}, [
      el("rect", {
        x: 200, y: 340, width: 240, height: 52,
        fill: "#f4f7fb", stroke: "#2f6fed", "stroke-width": 2.2
      }),
      el("text", {
        x: 320, y: 372, "text-anchor": "middle", fill: "#102033",
        "font-family": "Noto Serif SC, serif", "font-size": 18
      }, [(evt.tags && evt.tags[0]) || "结论"]),
    ]);
    const ticks = [];
    for (let i = 0; i < 6; i++) {
      ticks.push(el("line", {
        x1: 100, y1: 140 + i * 40, x2: 100, y2: 140 + i * 40,
        stroke: "#1d4e89", "stroke-width": 1.5
      }));
    }
    const tagG = el("g", {});
    const blurbG = el("g", {});
    const vbridge = el("line", {
      x1: 320, y1: 50, x2: 320, y2: 50,
      stroke: "#2f6fed", "stroke-width": 1, "stroke-dasharray": "3 5", opacity: 0.5
    });
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [
      vbridge, tagG, ...ticks, arc, ...layers.map((L) => L.g), ...beadGs, plate, blurbG
    ]);

    function pointOnArc(u) {
      /* Quadratic Bezier M120,320 Q320,200 520,320 */
      const t = clamp01(u);
      const x = (1 - t) * (1 - t) * 120 + 2 * (1 - t) * t * 320 + t * t * 520;
      const y = (1 - t) * (1 - t) * 320 + 2 * (1 - t) * t * 200 + t * t * 320;
      return [x, y];
    }

    function apply(p) {
      const e = easeOut(clamp01(p));
      /* Depth stack: back layers start smaller/higher, settle forward. */
      layers.forEach(({ g, i, y }) => {
        const local = clamp01((e - i * 0.08) / 0.7);
        const sc = 0.75 + 0.25 * local;
        const dy = (1 - local) * (-40 - i * 12);
        const dx = (1 - local) * (i % 2 === 0 ? -30 : 30);
        setTransform(
          g,
          `translate(320 ${(y + 14 + dy).toFixed(2)}) scale(${sc.toFixed(3)}) translate(-320 ${-(y + 14).toFixed(2)}) translate(${dx.toFixed(2)} 0)`
        );
      });
      beads.forEach((b, i) => {
        const target = Number(b.getAttribute("data-u"));
        const u = target * e;
        const [x, y] = pointOnArc(u);
        setTransform(beadGs[i], `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
      });
      const rot = (1 - e) * -16;
      const py = (1 - e) * 70;
      setTransform(plate, `translate(320 ${(366 + py).toFixed(2)}) rotate(${rot.toFixed(2)}) scale(${(0.85 + 0.15 * e).toFixed(3)}) translate(-320 -366)`);
      ticks.forEach((ln, i) => {
        const local = clamp01((e - i * 0.07) / 0.6);
        ln.setAttribute("x2", String(100 + 28 * local));
      });
      setTransform(tagG, `translate(0 ${((1 - e) * -18).toFixed(2)})`);
      setTransform(blurbG, `translate(0 ${((1 - e) * 20).toFixed(2)})`);
      vbridge.setAttribute("y2", String(50 + 380 * e));
    }

    return { svg, apply };
  }

  function matchStory(evt) {
    const id = trackOf(evt);
    if (id === "image") return () => sceneImage(evt);
    if (id === "control") return () => sceneControl(evt);
    /* mind = 语言与推理：排印 + 推理层叠融合 */
    if (id === "mind" && (/推理|DeepSeek|o1|o3|o4|AlphaFold|Astra|旗舰|科学/.test(
      (evt.title || "") + (evt.tags || []).join(",")
    ) || (evt.tags || []).some((t) => ["推理", "科学", "数学", "AGI叙事", "旗舰"].includes(t)))) {
      return () => sceneReason(evt);
    }
    return () => sceneLang(evt);
  }

  function buildStill(evt) {
    const wrap = document.createElement("div");
    const tid = trackOf(evt);
    wrap.className = `story-panel track-${tid}`;
    wrap.dataset.track = tid;
    wrap.setAttribute("aria-hidden", "true");
    const scene = matchStory(evt)();
    /* Tall crop so art can bridge neighboring rails. */
    scene.svg.setAttribute("viewBox", "20 20 600 440");
    scene.svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    wrap.appendChild(scene.svg);
    wrap.__apply = scene.apply;
    scene.apply(0, 1);
    /* No in-strip title plate — axis readout is the sole caption. */
    return wrap;
  }

  function panelHalfWidth(i, n, xOfIndex) {
    const x = xOfIndex(i);
    const xPrev = i > 0 ? xOfIndex(i - 1) : x - 900;
    const xNext = i < n - 1 ? xOfIndex(i + 1) : x + 900;
    return Math.min(560, Math.max(400, (xNext - xPrev) / 2 - 8));
  }

  function mountStrip(strip, events, xOfIndex, trackFn) {
    if (!strip) return;
    strip.textContent = "";
    strip.className = "story-strip";
    const n = events.length;
    const getTrack = trackFn || trackOf;
    events.forEach((evt, i) => {
      const panel = buildStill(evt);
      panel.dataset.index = String(i);
      const half = panelHalfWidth(i, n, xOfIndex);
      panel.style.left = `${xOfIndex(i)}px`;
      panel.style.width = `${half * 2}px`;
      const meta = trackMeta(getTrack(evt));
      /* Anchor panel visually to its rail. */
      panel.style.top = meta.top;
      strip.appendChild(panel);
    });
  }

  function layoutStrip(strip, xOfIndex) {
    if (!strip) return;
    const panels = [...strip.querySelectorAll(".story-panel")];
    const n = panels.length;
    panels.forEach((panel) => {
      const i = Number(panel.dataset.index);
      if (!Number.isFinite(i)) return;
      const half = panelHalfWidth(i, n, xOfIndex);
      panel.style.left = `${xOfIndex(i)}px`;
      panel.style.width = `${half * 2}px`;
    });
  }

  function focusStrip(strip, xOfIndex, centerX, reduceMotion) {
    if (!strip) return;
    const panels = [...strip.querySelectorAll(".story-panel")];
    const reach = 820;
    panels.forEach((panel) => {
      const i = Number(panel.dataset.index);
      const x = xOfIndex(i);
      const delta = x - centerX;
      const signed = delta / reach;
      const p = reduceMotion ? 1 : clamp01(1 - Math.abs(signed));
      if (typeof panel.__apply === "function") panel.__apply(p, signed);
      /* Neighbors stay faintly visible so rails feel woven, not empty lanes. */
      const vis = p < 0.12 ? 0.08 : 0.12 + Math.pow(p, 1.2) * 0.88;
      panel.style.opacity = String(vis);
      panel.style.zIndex = String(1 + Math.round(p * 40));
    });
  }

  window.__HUMANITY_STORY__ = {
    buildStill, mountStrip, layoutStrip, focusStrip, matchStory, trackOf
  };
})();
