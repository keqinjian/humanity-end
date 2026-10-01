/* Unique scroll-bound stills — one composition per high-impact milestone.
   Mid/low use distinct geometry families (not label swaps). Vanilla only. */
(function () {
  "use strict";

  function el(name, attrs = {}, kids = []) {
    const n = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.entries(attrs).forEach(([k, v]) => {
      if (v == null || v === false) return;
      n.setAttribute(k, String(v));
    });
    (Array.isArray(kids) ? kids : [kids]).forEach((c) => {
      if (c == null) return;
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return n;
  }
  function clamp01(t) { return Math.max(0, Math.min(1, t)); }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function easeOutBack(t) {
    const c = 1.70158;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  }
  function setTransform(node, tr) { node.setAttribute("transform", tr); }
  function clipBlurb(s, n) {
    const t = String(s || "");
    return t.length <= n ? t : t.slice(0, n - 1) + "…";
  }
  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function trackOf(evt) {
    const tags = new Set(evt.tags || []);
    const title = evt.title || "";
    if (
      tags.has("图像") || tags.has("视频") || tags.has("视觉") ||
      tags.has("CNN") || tags.has("语音") || /Midjourney|Sora|DALL|ImageNet|AlexNet|ResNet|WaveNet/.test(title)
    ) return "image";
    if (
      tags.has("博弈") || tags.has("强化学习") || tags.has("控制") ||
      /AlphaGo|AlphaZero|深蓝|Chess|机器人/.test(title)
    ) return "control";
    return "mind";
  }
  function trackMeta(id) {
    if (id === "image") return { id, name: "图像与创作", top: "52%" };
    if (id === "control") return { id, name: "棋与控制", top: "70%" };
    return { id: "mind", name: "语言与推理", top: "34%" };
  }

  const C = {
    paper: "#121826", ink: "#e8eef8", steel: "#7a8eaa", cyan: "#8aa4c8",
    navy: "#c5d0e0", warm: "#f5e11a", gold: "#f5e11a", teal: "#5a8f86",
    soft: "rgba(232,238,248,0.15)"
  };

  /* ——— High-impact: each factory returns structurally unique SVG ——— */

  function hiENIAC(evt) {
    const tubes = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) {
      tubes.push({ g: el("g", {}, [
        el("rect", { x: 120 + c * 52, y: 120 + r * 58, width: 28, height: 44, rx: 4,
          fill: "none", stroke: C.steel, "stroke-width": 1.4 }),
        el("circle", { cx: 134 + c * 52, cy: 138 + r * 58, r: 5, fill: C.warm, opacity: 0.15 })
      ]), r, c });
    }
    const spark = el("path", { d: "M100 340 L540 340", fill: "none", stroke: C.cyan, "stroke-width": 2 });
    const label = el("text", { x: 320, y: 380, fill: C.navy, "text-anchor": "middle",
      "font-family": "Noto Sans SC,sans-serif", "font-size": 14, "letter-spacing": "0.2em" }, ["ENIAC · 电子管阵列"]);
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" },
      [...tubes.map((t) => t.g), spark, label]);
    function apply(p) {
      const e = easeOut(clamp01(p));
      tubes.forEach(({ g, r, c }) => {
        const local = clamp01((e - (r * 8 + c) * 0.012) / 0.55);
        const lit = easeOut(local);
        g.children[1].setAttribute("opacity", String(0.08 + lit * 0.85));
        setTransform(g, `translate(0 ${(1 - lit) * 18})`);
      });
      spark.setAttribute("stroke-dasharray", "8 10");
      spark.setAttribute("stroke-dashoffset", String((1 - e) * 120));
    }
    return { svg, apply };
  }

  function hiTuring(evt) {
    const ring = el("circle", { cx: 320, cy: 230, r: 110, fill: "none", stroke: C.navy, "stroke-width": 1.6 });
    const q = el("text", { x: 320, y: 238, fill: C.ink, "text-anchor": "middle",
      "font-family": "Instrument Serif,serif", "font-size": 72 }, ["?"]);
    const ticks = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ticks.push(el("line", {
        x1: 320 + Math.cos(a) * 118, y1: 230 + Math.sin(a) * 118,
        x2: 320 + Math.cos(a) * 132, y2: 230 + Math.sin(a) * 132,
        stroke: C.steel, "stroke-width": 2
      }));
    }
    const tape = el("rect", { x: 160, y: 370, width: 320, height: 28, fill: "none", stroke: C.cyan, "stroke-width": 1.5 });
    const cells = [];
    for (let i = 0; i < 8; i++) {
      cells.push(el("text", { x: 180 + i * 38, y: 390, fill: C.steel, "font-size": 12,
        "font-family": "Noto Sans SC,sans-serif" }, [i % 2 ? "1" : "0"]));
    }
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [ring, q, ...ticks, tape, ...cells]);
    function apply(p) {
      const e = easeInOut(clamp01(p));
      setTransform(q, `scale(${0.4 + e * 0.6})`);
      q.setAttribute("opacity", String(e));
      ring.setAttribute("r", String(70 + 50 * e));
      ticks.forEach((ln, i) => {
        const local = clamp01((e - i * 0.04) / 0.6);
        ln.setAttribute("opacity", String(local));
      });
      setTransform(tape, `translate(${(1 - e) * -40} 0)`);
    }
    return { svg, apply };
  }

  function hiDartmouth(evt) {
    const roof = el("path", { d: "M140 220 L320 110 L500 220", fill: "none", stroke: C.navy, "stroke-width": 2.2 });
    const hall = el("rect", { x: 180, y: 220, width: 280, height: 140, fill: "none", stroke: C.steel, "stroke-width": 1.8 });
    const names = ["McCarthy", "Minsky", "Rochester", "Shannon"].map((n, i) =>
      el("text", { x: 210 + (i % 2) * 140, y: 260 + Math.floor(i / 2) * 40, fill: C.ink,
        "font-size": 13, "font-family": "Instrument Serif,serif" }, [n]));
    const year = el("text", { x: 320, y: 400, fill: C.warm, "text-anchor": "middle",
      "font-family": "Instrument Serif,serif", "font-size": 28 }, ["1956"]);
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [roof, hall, ...names, year]);
    function apply(p) {
      const e = easeOutBack(clamp01(p));
      setTransform(roof, `translate(0 ${(1 - e) * -40})`);
      setTransform(hall, `scale(1 ${0.2 + 0.8 * e})`);
      names.forEach((t, i) => {
        const local = clamp01((e - 0.2 - i * 0.08) / 0.5);
        t.setAttribute("opacity", String(local));
        setTransform(t, `translate(${(1 - local) * (i % 2 ? 20 : -20)} 0)`);
      });
      year.setAttribute("opacity", String(easeOut(clamp01((p - 0.5) / 0.5))));
    }
    return { svg, apply };
  }

  function hiBackprop(evt) {
    const layers = [4, 6, 5, 3].map((n, li) => {
      const nodes = [];
      for (let i = 0; i < n; i++) {
        nodes.push(el("circle", { cx: 140 + li * 120, cy: 140 + i * 42 + (6 - n) * 12, r: 10,
          fill: C.paper, stroke: C.cyan, "stroke-width": 1.6 }));
      }
      return nodes;
    });
    const links = el("g", {});
    const err = el("path", { d: "M520 200 C480 260, 400 300, 320 280", fill: "none",
      stroke: C.warm, "stroke-width": 2.2 });
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" },
      [links, ...layers.flat(), err,
        el("text", { x: 320, y: 420, fill: C.navy, "text-anchor": "middle", "font-size": 13,
          "font-family": "Noto Sans SC,sans-serif", "letter-spacing": "0.12em" }, ["反向传播 · 误差回流"])]);
    function apply(p) {
      const e = easeInOut(clamp01(p));
      links.textContent = "";
      for (let li = 0; li < layers.length - 1; li++) {
        layers[li].forEach((a) => {
          layers[li + 1].forEach((b) => {
            const ln = el("line", {
              x1: a.getAttribute("cx"), y1: a.getAttribute("cy"),
              x2: b.getAttribute("cx"), y2: b.getAttribute("cy"),
              stroke: C.soft, "stroke-width": 0.8, opacity: 0.25 + e * 0.55
            });
            links.appendChild(ln);
          });
        });
      }
      err.setAttribute("stroke-dasharray", "10 8");
      err.setAttribute("stroke-dashoffset", String((1 - e) * 160));
      layers.flat().forEach((c, i) => {
        const local = clamp01((e - i * 0.015) / 0.7);
        c.setAttribute("r", String(6 + local * 5));
      });
    }
    return { svg, apply };
  }

  function hiDeepBlue(evt) {
    const board = el("g", {});
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      board.appendChild(el("rect", {
        x: 180 + c * 34, y: 100 + r * 34, width: 34, height: 34,
        fill: (r + c) % 2 ? C.navy : C.paper, stroke: C.steel, "stroke-width": 0.4, opacity: 0.85
      }));
    }
    const king = el("text", { x: 320, y: 250, fill: C.warm, "text-anchor": "middle",
      "font-family": "Instrument Serif,serif", "font-size": 36 }, ["K"]);
    const search = el("path", { d: "M100 420 L200 300 L280 360 L360 220 L460 300 L540 180",
      fill: "none", stroke: C.cyan, "stroke-width": 1.8 });
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [board, king, search,
      el("text", { x: 320, y: 450, fill: C.steel, "text-anchor": "middle", "font-size": 12,
        "letter-spacing": "0.16em" }, ["深蓝 · 博弈树剪枝"])]);
    function apply(p) {
      const e = easeOut(clamp01(p));
      setTransform(board, `rotate(${(1 - e) * -8} 320 236) scale(${0.7 + 0.3 * e})`);
      setTransform(king, `translate(0 ${(1 - e) * 40})`);
      search.setAttribute("stroke-dasharray", "14 10");
      search.setAttribute("stroke-dashoffset", String((1 - e) * 280));
    }
    return { svg, apply };
  }

  function hiLSTM(evt) {
    const cell = el("rect", { x: 200, y: 160, width: 240, height: 160, rx: 12,
      fill: "none", stroke: C.navy, "stroke-width": 2 });
    const gates = ["遗忘", "输入", "输出"].map((lab, i) => el("g", {}, [
      el("rect", { x: 220 + i * 70, y: 190, width: 56, height: 36, rx: 4,
        fill: C.paper, stroke: C.cyan, "stroke-width": 1.4 }),
      el("text", { x: 248 + i * 70, y: 213, fill: C.ink, "text-anchor": "middle", "font-size": 11 }, [lab])
    ]));
    const mem = el("path", { d: "M160 240 C180 240, 180 240, 200 240", fill: "none", stroke: C.warm, "stroke-width": 2.4 });
    const out = el("path", { d: "M440 240 C480 240, 500 200, 540 200", fill: "none", stroke: C.steel, "stroke-width": 2 });
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [cell, ...gates, mem, out,
      el("text", { x: 320, y: 380, fill: C.navy, "text-anchor": "middle", "font-size": 13,
        "letter-spacing": "0.14em" }, ["LSTM · 门控记忆"])]);
    function apply(p) {
      const e = easeInOut(clamp01(p));
      gates.forEach((g, i) => {
        const local = clamp01((e - i * 0.12) / 0.5);
        setTransform(g, `translate(0 ${(1 - local) * -24})`);
        g.setAttribute("opacity", String(0.2 + local * 0.8));
      });
      mem.setAttribute("d", `M160 240 C180 240, 180 240, ${200 + 40 * e} 240`);
      out.setAttribute("stroke-dashoffset", String((1 - e) * 100));
      out.setAttribute("stroke-dasharray", "8 6");
      setTransform(cell, `scale(${0.85 + 0.15 * e})`);
    }
    return { svg, apply };
  }

  function hiAlexNet(evt) {
    const stack = [];
    for (let i = 0; i < 6; i++) {
      stack.push(el("rect", {
        x: 160 + i * 18, y: 140 + i * 12, width: 280 - i * 20, height: 160 - i * 16,
        fill: "none", stroke: i % 2 ? C.cyan : C.navy, "stroke-width": 1.6
      }));
    }
    const cat = el("path", { d: "M300 220 C320 180, 360 180, 380 220 C400 260, 340 300, 320 280 C300 300, 240 260, 300 220",
      fill: "none", stroke: C.warm, "stroke-width": 1.8 });
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [...stack, cat,
      el("text", { x: 320, y: 400, fill: C.steel, "text-anchor": "middle", "font-size": 13,
        "letter-spacing": "0.12em" }, ["AlexNet · 卷积层级联"])]);
    function apply(p) {
      const e = easeOut(clamp01(p));
      stack.forEach((r, i) => {
        const local = clamp01((e - i * 0.08) / 0.55);
        setTransform(r, `translate(${(1 - local) * (40 - i * 6)} ${(1 - local) * 20})`);
        r.setAttribute("opacity", String(local));
      });
      cat.setAttribute("stroke-dasharray", "200");
      cat.setAttribute("stroke-dashoffset", String((1 - e) * 200));
    }
    return { svg, apply };
  }

  function hiResNet(evt) {
    const blocks = [];
    for (let i = 0; i < 4; i++) {
      blocks.push(el("rect", { x: 200, y: 100 + i * 70, width: 160, height: 48, rx: 6,
        fill: C.paper, stroke: C.steel, "stroke-width": 1.6 }));
    }
    const skip = el("path", { d: "M380 124 C480 124, 480 334, 360 334", fill: "none",
      stroke: C.warm, "stroke-width": 2.4 });
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [...blocks, skip,
      el("text", { x: 320, y: 420, fill: C.navy, "text-anchor": "middle", "font-size": 13,
        "letter-spacing": "0.14em" }, ["ResNet · 残差捷径"])]);
    function apply(p) {
      const e = easeInOut(clamp01(p));
      blocks.forEach((b, i) => {
        const local = clamp01((e - i * 0.1) / 0.5);
        setTransform(b, `translate(${(1 - local) * -30} 0)`);
        b.setAttribute("opacity", String(0.25 + local * 0.75));
      });
      skip.setAttribute("stroke-dasharray", "12 8");
      skip.setAttribute("stroke-dashoffset", String((1 - e) * 220));
    }
    return { svg, apply };
  }

  function hiAlphaGo(evt) {
    /* Larger board (~center-right 45%+); pins as旁注; year stays in type area only */
    const boardBg = el("rect", { x: 248, y: 70, width: 340, height: 340, fill: "#1a2233", stroke: "rgba(232,238,248,0.22)", "stroke-width": 1 });
    const lines = [];
    for (let i = 0; i < 15; i++) {
      lines.push(el("line", { x1: 268, y1: 90 + i * 21.5, x2: 568, y2: 90 + i * 21.5, stroke: "rgba(232,238,248,0.12)", "stroke-width": 1 }));
      lines.push(el("line", { x1: 268 + i * 21.5, y1: 90, x2: 268 + i * 21.5, y2: 390, stroke: "rgba(232,238,248,0.12)", "stroke-width": 1 }));
    }
    const heat = el("circle", { cx: 418, cy: 230, r: 44, fill: "rgba(245,225,26,0.16)" });
    const black = el("circle", { cx: 418, cy: 230, r: 13, fill: "#0b0e16", stroke: "#f5e11a", "stroke-width": 1.3 });
    const white = el("circle", { cx: 440, cy: 252, r: 12, fill: "#e8eef8", opacity: 0.92 });
    const pin = el("line", { x1: 418, y1: 230, x2: 170, y2: 150, stroke: "rgba(245,225,26,0.45)", "stroke-width": 1 });
    const pinLab = el("text", { x: 48, y: 145, fill: "rgba(232,238,248,0.75)", "font-size": 13,
      "font-family": "Noto Sans SC,sans-serif" }, ["第37手 · 神之一手"]);
    const pin2 = el("line", { x1: 440, y1: 252, x2: 170, y2: 200, stroke: "rgba(232,238,248,0.25)", "stroke-width": 1 });
    const pinLab2 = el("text", { x: 48, y: 195, fill: "rgba(168,180,200,0.7)", "font-size": 12 }, ["李世石 · 白"]);
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" },
      [boardBg, ...lines, heat, black, white, pin, pinLab, pin2, pinLab2]);
    function apply(p) {
      const e = easeOut(clamp01(p));
      setTransform(boardBg, `translate(${(1 - e) * 36} 0) scale(${0.78 + 0.22 * e})`);
      [...lines, heat, black, white].forEach((n, i) => {
        /* board group motion via shared translate on boardBg only — stones follow visually via opacity */
      });
      setTransform(heat, `scale(${0.35 + e * 1.15})`);
      heat.setAttribute("opacity", String(0.1 + e * 0.35));
      setTransform(black, `translate(0 ${(1 - e) * -16})`);
      pin.setAttribute("opacity", String(e));
      pinLab.setAttribute("opacity", String(e));
      pin2.setAttribute("opacity", String(clamp01((e - 0.25) / 0.5)));
      pinLab2.setAttribute("opacity", String(clamp01((e - 0.25) / 0.5)));
    }
    return { svg, apply, layout: "break" };
  }

  function hiTransformer(evt) {
    const heads = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      heads.push(el("g", {}, [
        el("line", { x1: 320, y1: 230, x2: 320 + Math.cos(a) * 100, y2: 230 + Math.sin(a) * 100,
          stroke: C.cyan, "stroke-width": 1.4 }),
        el("circle", { cx: 320 + Math.cos(a) * 100, cy: 230 + Math.sin(a) * 100, r: 8,
          fill: C.paper, stroke: C.navy, "stroke-width": 1.5 })
      ]));
    }
    const core = el("circle", { cx: 320, cy: 230, r: 28, fill: C.paper, stroke: C.warm, "stroke-width": 2.2 });
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [...heads, core,
      el("text", { x: 320, y: 400, fill: C.navy, "text-anchor": "middle", "font-size": 13,
        "letter-spacing": "0.12em" }, ["Transformer · 多头注意"])]);
    function apply(p) {
      const e = easeOutBack(clamp01(p));
      heads.forEach((g, i) => {
        const local = clamp01((e - i * 0.05) / 0.6);
        setTransform(g, `scale(${local})`);
        g.setAttribute("opacity", String(local));
      });
      setTransform(core, `rotate(${e * 180} 320 230) scale(${0.5 + 0.5 * e})`);
    }
    return { svg, apply, layout: "slice" };
  }

  function hiAlphaZero(evt) {
    const hex = el("path", {
      d: "M320 120 L420 170 L420 270 L320 320 L220 270 L220 170 Z",
      fill: "none", stroke: C.navy, "stroke-width": 2
    });
    const inner = el("path", {
      d: "M320 170 L380 200 L380 250 L320 280 L260 250 L260 200 Z",
      fill: "none", stroke: C.cyan, "stroke-width": 1.5
    });
    const games = ["围棋", "将棋", "国际象棋"].map((t, i) =>
      el("text", { x: 140, y: 360 + i * 28, fill: C.ink, "font-size": 14,
        "font-family": "Noto Sans SC,sans-serif" }, [t]));
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [hex, inner, ...games]);
    function apply(p) {
      const e = easeInOut(clamp01(p));
      setTransform(hex, `rotate(${e * 60} 320 220)`);
      setTransform(inner, `rotate(${-e * 90} 320 225) scale(${0.4 + 0.6 * e})`);
      games.forEach((t, i) => {
        t.setAttribute("opacity", String(clamp01((e - i * 0.15) / 0.4)));
        setTransform(t, `translate(${(1 - clamp01((e - i * 0.15) / 0.4)) * -40} 0)`);
      });
    }
    return { svg, apply };
  }

  function hiGPT1(evt) {
    const blocks = [];
    for (let i = 0; i < 12; i++) {
      blocks.push(el("rect", { x: 100 + (i % 6) * 70, y: 140 + Math.floor(i / 6) * 90,
        width: 58, height: 70, rx: 4, fill: "none", stroke: C.steel, "stroke-width": 1.4 }));
    }
    const arrow = el("path", { d: "M120 360 L520 360", fill: "none", stroke: C.warm, "stroke-width": 2 });
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [...blocks, arrow,
      el("text", { x: 320, y: 400, fill: C.navy, "text-anchor": "middle", "font-size": 13,
        "letter-spacing": "0.14em" }, ["GPT-1 · 单向堆叠"])]);
    function apply(p) {
      const e = easeOut(clamp01(p));
      blocks.forEach((b, i) => {
        const local = clamp01((e - i * 0.04) / 0.5);
        setTransform(b, `translate(0 ${(1 - local) * 30}) rotate(${(1 - local) * 6})`);
        b.setAttribute("opacity", String(local));
      });
      arrow.setAttribute("stroke-dasharray", "6 6");
      arrow.setAttribute("stroke-dashoffset", String((1 - e) * 80));
    }
    return { svg, apply };
  }

  function hiGPT3(evt) {
    const bars = [];
    for (let i = 0; i < 24; i++) {
      const h = 40 + (hashStr("gpt3" + i) % 140);
      bars.push(el("rect", { x: 80 + i * 20, y: 320 - h, width: 14, height: h,
        fill: i % 3 === 0 ? C.warm : C.cyan, opacity: 0.35 }));
    }
    const api = el("text", { x: 320, y: 380, fill: C.navy, "text-anchor": "middle",
      "font-family": "Instrument Serif,serif", "font-size": 22 }, ["API"]);
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [...bars, api,
      el("text", { x: 320, y: 420, fill: C.steel, "text-anchor": "middle", "font-size": 12,
        "letter-spacing": "0.16em" }, ["GPT-3 · 规模涌现"])]);
    function apply(p) {
      const e = easeOut(clamp01(p));
      bars.forEach((b, i) => {
        const local = clamp01((e - i * 0.02) / 0.55);
        const h0 = Number(b.getAttribute("height"));
        b.setAttribute("height", String(h0 * local));
        b.setAttribute("y", String(320 - h0 * local));
        b.setAttribute("opacity", String(0.2 + local * 0.7));
      });
      setTransform(api, `scale(${0.5 + 0.5 * e})`);
    }
    return { svg, apply };
  }

  function hiAlphaFold(evt) {
    const ribbon = el("path", {
      d: "M120 280 C180 120, 240 400, 320 200 S460 100, 520 260",
      fill: "none", stroke: C.teal, "stroke-width": 3.2, "stroke-linecap": "round"
    });
    const dots = [0.2, 0.4, 0.55, 0.7, 0.85].map((u, i) =>
      el("circle", { cx: 120 + u * 400, cy: 240, r: 6, fill: C.gold }));
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [ribbon, ...dots,
      el("text", { x: 320, y: 400, fill: C.navy, "text-anchor": "middle", "font-size": 13,
        "letter-spacing": "0.12em" }, ["AlphaFold · 蛋白折叠"])]);
    function apply(p) {
      const e = easeInOut(clamp01(p));
      ribbon.setAttribute("stroke-dasharray", "600");
      ribbon.setAttribute("stroke-dashoffset", String((1 - e) * 600));
      dots.forEach((d, i) => {
        const local = clamp01((e - i * 0.1) / 0.5);
        d.setAttribute("r", String(3 + local * 6));
        d.setAttribute("opacity", String(local));
      });
    }
    return { svg, apply };
  }

  function hiInstruct(evt) {
    const human = el("rect", { x: 100, y: 160, width: 180, height: 120, rx: 8,
      fill: "none", stroke: C.steel, "stroke-width": 1.8 });
    const model = el("rect", { x: 360, y: 160, width: 180, height: 120, rx: 8,
      fill: "none", stroke: C.cyan, "stroke-width": 1.8 });
    const arrows = el("g", {}, [
      el("path", { d: "M290 200 L350 200", stroke: C.warm, "stroke-width": 2, fill: "none" }),
      el("path", { d: "M350 240 L290 240", stroke: C.gold, "stroke-width": 2, fill: "none" })
    ]);
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [
      human, model, arrows,
      el("text", { x: 190, y: 225, fill: C.ink, "text-anchor": "middle", "font-size": 14 }, ["人类偏好"]),
      el("text", { x: 450, y: 225, fill: C.ink, "text-anchor": "middle", "font-size": 14 }, ["模型"]),
      el("text", { x: 320, y: 360, fill: C.navy, "text-anchor": "middle", "font-size": 13,
        "letter-spacing": "0.14em" }, ["InstructGPT · RLHF"])
    ]);
    function apply(p) {
      const e = easeOut(clamp01(p));
      setTransform(human, `translate(${(1 - e) * -50} 0)`);
      setTransform(model, `translate(${(1 - e) * 50} 0)`);
      arrows.setAttribute("opacity", String(e));
      arrows.children[0].setAttribute("stroke-dasharray", "8 6");
      arrows.children[0].setAttribute("stroke-dashoffset", String((1 - e) * 40));
    }
    return { svg, apply };
  }

  function hiMidjourney(evt) {
    const frame = el("rect", { x: 170, y: 110, width: 300, height: 240, fill: "none",
      stroke: C.navy, "stroke-width": 2.4 });
    const blossom = [];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      blossom.push(el("ellipse", {
        cx: 320, cy: 230, rx: 28, ry: 70,
        fill: "none", stroke: C.warm, "stroke-width": 1.4,
        transform: `rotate(${(i * 360) / 7} 320 230)`
      }));
    }
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [frame, ...blossom,
      el("text", { x: 320, y: 400, fill: C.steel, "text-anchor": "middle", "font-size": 13,
        "letter-spacing": "0.14em" }, ["Midjourney · 画框绽放"])]);
    function apply(p) {
      const e = easeOutBack(clamp01(p));
      setTransform(frame, `scale(${0.6 + 0.4 * e})`);
      blossom.forEach((ep, i) => {
        const local = clamp01((e - i * 0.04) / 0.6);
        ep.setAttribute("ry", String(20 + local * 55));
        ep.setAttribute("opacity", String(local));
      });
    }
    return { svg, apply };
  }

  function hiChatGPT(evt) {
    const bubbles = [
      { x: 140, y: 140, w: 260, h: 70, side: "user" },
      { x: 240, y: 230, w: 280, h: 90, side: "bot" },
      { x: 140, y: 340, w: 200, h: 50, side: "user" }
    ].map((b) => el("rect", { x: b.x, y: b.y, width: b.w, height: b.h, rx: 14,
      fill: b.side === "bot" ? "rgba(47,111,237,0.14)" : "#eef3f9",
      stroke: b.side === "bot" ? C.cyan : C.steel, "stroke-width": 1.6 }));
    const cursor = el("rect", { x: 260, y: 360, width: 3, height: 18, fill: C.warm });
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [...bubbles, cursor,
      el("text", { x: 320, y: 440, fill: C.navy, "text-anchor": "middle", "font-size": 13,
        "letter-spacing": "0.14em" }, ["ChatGPT · 对话浪潮"])]);
    function apply(p) {
      const e = easeOut(clamp01(p));
      bubbles.forEach((b, i) => {
        const local = clamp01((e - i * 0.18) / 0.45);
        setTransform(b, `translate(${(1 - local) * (i % 2 ? 40 : -40)} ${(1 - local) * 20})`);
        b.setAttribute("opacity", String(local));
      });
      cursor.setAttribute("opacity", String(0.3 + Math.sin(e * Math.PI * 4) * 0.5 * e));
    }
    return { svg, apply, layout: "slice" };
  }

  function hiGPT4(evt) {
    const facets = [];
    for (let i = 0; i < 6; i++) {
      const a0 = (i / 6) * Math.PI * 2;
      const a1 = ((i + 1) / 6) * Math.PI * 2;
      facets.push(el("path", {
        d: `M320 230 L${320 + Math.cos(a0) * 120} ${230 + Math.sin(a0) * 120} L${320 + Math.cos(a1) * 120} ${230 + Math.sin(a1) * 120} Z`,
        fill: "none", stroke: i % 2 ? C.cyan : C.navy, "stroke-width": 1.6
      }));
    }
    const eye = el("circle", { cx: 320, cy: 230, r: 18, fill: C.warm, opacity: 0.5 });
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [...facets, eye,
      el("text", { x: 320, y: 400, fill: C.navy, "text-anchor": "middle", "font-size": 13,
        "letter-spacing": "0.14em" }, ["GPT-4 · 多面旗舰"])]);
    function apply(p) {
      const e = easeInOut(clamp01(p));
      facets.forEach((f, i) => {
        const local = clamp01((e - i * 0.06) / 0.55);
        setTransform(f, `scale(${local})`);
      });
      setTransform(eye, `scale(${0.2 + e * 0.8})`);
    }
    return { svg, apply };
  }

  function hiClaude1(evt) {
    const shield = el("path", {
      d: "M320 100 L460 160 L460 280 C460 340, 320 400, 320 400 C320 400, 180 340, 180 280 L180 160 Z",
      fill: "none", stroke: C.teal, "stroke-width": 2.4
    });
    const check = el("path", { d: "M260 240 L300 280 L390 180", fill: "none",
      stroke: C.warm, "stroke-width": 3, "stroke-linecap": "round" });
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [shield, check,
      el("text", { x: 320, y: 440, fill: C.navy, "text-anchor": "middle", "font-size": 13,
        "letter-spacing": "0.14em" }, ["Claude · 宪法对齐"])]);
    function apply(p) {
      const e = easeOut(clamp01(p));
      setTransform(shield, `translate(0 ${(1 - e) * -30}) scale(${0.7 + 0.3 * e})`);
      check.setAttribute("stroke-dasharray", "200");
      check.setAttribute("stroke-dashoffset", String((1 - e) * 200));
    }
    return { svg, apply };
  }

  function hiSoraPrev(evt) {
    const matte = el("rect", { x: 60, y: 150, width: 520, height: 220, fill: "#0a0d14" });
    const grain = [];
    for (let i = 0; i < 12; i++) {
      grain.push(el("line", {
        x1: 80 + i * 40, y1: 160, x2: 100 + i * 38, y2: 360,
        stroke: "rgba(245,225,26,0.08)", "stroke-width": 1
      }));
    }
    const beam = el("rect", { x: 60, y: 240, width: 520, height: 40, fill: "rgba(245,225,26,0.12)" });
    const lab = el("text", { x: 80, y: 400, fill: "rgba(232,238,248,0.4)", "font-size": 12,
      "letter-spacing": "0.22em" }, ["SORA · TECH PREVIEW"]);
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [matte, ...grain, beam, lab]);
    function apply(p) {
      const e = easeInOut(clamp01(p));
      beam.setAttribute("width", String(80 + 440 * e));
      beam.setAttribute("opacity", String(0.15 + e * 0.5));
      setTransform(matte, `scale(${0.9 + 0.1 * e})`);
    }
    return { svg, apply, layout: "film" };
  }

  function hiClaude3(evt) {
    const tiers = ["Haiku", "Sonnet", "Opus"].map((name, i) => el("g", {}, [
      el("circle", { cx: 200 + i * 120, cy: 240, r: 40 + i * 12, fill: "none",
        stroke: i === 2 ? C.warm : C.cyan, "stroke-width": 2 }),
      el("text", { x: 200 + i * 120, y: 246, fill: C.ink, "text-anchor": "middle", "font-size": 13 }, [name])
    ]));
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [...tiers,
      el("text", { x: 320, y: 380, fill: C.navy, "text-anchor": "middle", "font-size": 13,
        "letter-spacing": "0.14em" }, ["Claude 3 · 三档家族"])]);
    function apply(p) {
      const e = easeOutBack(clamp01(p));
      tiers.forEach((g, i) => {
        const local = clamp01((e - i * 0.12) / 0.55);
        setTransform(g, `translate(0 ${(1 - local) * 50}) scale(${0.5 + 0.5 * local})`);
        g.setAttribute("opacity", String(local));
      });
    }
    return { svg, apply };
  }

  function hiGPT4o(evt) {
    const waves = [];
    for (let i = 0; i < 5; i++) {
      waves.push(el("path", {
        d: `M100 ${200 + i * 18} Q200 ${160 + i * 10}, 320 ${200 + i * 18} T540 ${200 + i * 18}`,
        fill: "none", stroke: i % 2 ? C.cyan : C.steel, "stroke-width": 1.6
      }));
    }
    const cam = el("circle", { cx: 320, cy: 140, r: 22, fill: "none", stroke: C.warm, "stroke-width": 2 });
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [...waves, cam,
      el("text", { x: 320, y: 400, fill: C.navy, "text-anchor": "middle", "font-size": 13,
        "letter-spacing": "0.14em" }, ["GPT-4o · 视听同频"])]);
    function apply(p) {
      const e = easeInOut(clamp01(p));
      waves.forEach((w, i) => {
        w.setAttribute("stroke-dasharray", "12 8");
        w.setAttribute("stroke-dashoffset", String((1 - e) * (80 + i * 20)));
        w.setAttribute("opacity", String(0.3 + e * 0.7));
      });
      setTransform(cam, `scale(${0.4 + e * 0.6})`);
    }
    return { svg, apply };
  }

  function hiSonnet35(evt) {
    const editor = el("rect", { x: 120, y: 100, width: 400, height: 280, rx: 6,
      fill: "none", stroke: C.navy, "stroke-width": 1.8 });
    const lines = [];
    for (let i = 0; i < 10; i++) {
      lines.push(el("rect", { x: 150, y: 130 + i * 22, width: 80 + (hashStr("c35" + i) % 200),
        height: 8, rx: 2, fill: i === 3 ? C.warm : C.cyan, opacity: 0.45 }));
    }
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [editor, ...lines,
      el("text", { x: 320, y: 420, fill: C.steel, "text-anchor": "middle", "font-size": 13,
        "letter-spacing": "0.12em" }, ["Claude 3.5 · 编码加速"])]);
    function apply(p) {
      const e = easeOut(clamp01(p));
      lines.forEach((ln, i) => {
        const local = clamp01((e - i * 0.05) / 0.5);
        const w = Number(ln.getAttribute("width"));
        ln.setAttribute("width", String(w * local));
        ln.setAttribute("opacity", String(0.2 + local * 0.7));
      });
      setTransform(editor, `translate(0 ${(1 - e) * 16})`);
    }
    return { svg, apply };
  }

  function hiO1(evt) {
    const spiral = el("path", {
      d: "M320 230 m0 -20 a20 20 0 1 1 0 40 a40 40 0 1 1 0 -80 a60 60 0 1 1 0 120 a80 80 0 1 1 0 -160",
      fill: "none", stroke: C.gold, "stroke-width": 2
    });
    const steps = ["读题", "拆解", "核验"].map((t, i) =>
      el("text", { x: 480, y: 180 + i * 40, fill: C.ink, "font-size": 15,
        "font-family": "Noto Sans SC,sans-serif" }, [t]));
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [spiral, ...steps,
      el("text", { x: 320, y: 420, fill: C.navy, "text-anchor": "middle", "font-size": 13,
        "letter-spacing": "0.14em" }, ["o1 · 隐式思维链"])]);
    function apply(p) {
      const e = easeInOut(clamp01(p));
      spiral.setAttribute("stroke-dasharray", "500");
      spiral.setAttribute("stroke-dashoffset", String((1 - e) * 500));
      steps.forEach((t, i) => {
        const local = clamp01((e - 0.25 - i * 0.15) / 0.4);
        t.setAttribute("opacity", String(local));
        setTransform(t, `translate(${(1 - local) * 30} 0)`);
      });
    }
    return { svg, apply };
  }

  function hiSoraPub(evt) {
    /* Wide 2.39 cinema frame — picture content dominates; waveform overlay only */
    const W = 640, H = 480;
    const fx = 28, fy = 108, fw = 584, fh = 246; /* ~2.37 aspect inside viewBox */
    const matte = el("rect", { x: 0, y: 0, width: W, height: H, fill: "transparent" });
    const frame = el("rect", { x: fx, y: fy, width: fw, height: fh, fill: "#070a10", stroke: "rgba(245,225,26,0.28)", "stroke-width": 1.2 });
    /* Soft depth bands (actual picture) */
    const bandG = el("g", {});
    const bands = [
      { y: 0.08, h: 0.22, c: "#1a2840" },
      { y: 0.28, h: 0.18, c: "#243554" },
      { y: 0.42, h: 0.2, c: "#152238" },
      { y: 0.55, h: 0.28, c: "#0e1828" },
      { y: 0.72, h: 0.2, c: "#1e2f4a" }
    ];
    bands.forEach((b) => {
      bandG.appendChild(el("rect", {
        x: fx + 4, y: fy + fh * b.y, width: fw - 8, height: fh * b.h,
        fill: b.c, opacity: 0.95
      }));
    });
    /* Horizontal light sweep — soft luminous slab */
    const sweepGlow = el("ellipse", {
      cx: fx + fw * 0.45, cy: fy + fh * 0.42, rx: fw * 0.38, ry: fh * 0.18,
      fill: "rgba(245,225,26,0.14)"
    });
    const sweepCore = el("rect", {
      x: fx + 8, y: fy + fh * 0.38, width: fw - 16, height: fh * 0.12,
      fill: "url(#soraGrad)", opacity: 0.85
    });
    const defs = el("defs", {}, [
      el("linearGradient", { id: "soraGrad", x1: "0", y1: "0", x2: "1", y2: "0" }, [
        el("stop", { offset: "0%", "stop-color": "#1c2740", "stop-opacity": "0.2" }),
        el("stop", { offset: "45%", "stop-color": "#f5e11a", "stop-opacity": "0.55" }),
        el("stop", { offset: "100%", "stop-color": "#8aa4c8", "stop-opacity": "0.15" })
      ])
    ]);
    /* Sliced color strips */
    const slices = el("g", {});
    for (let i = 0; i < 5; i++) {
      slices.appendChild(el("rect", {
        x: fx + fw * (0.12 + i * 0.15), y: fy + 6, width: fw * 0.02, height: fh - 12,
        fill: i % 2 ? "rgba(245,225,26,0.08)" : "rgba(232,238,248,0.06)"
      }));
    }
    /* Waveform overlay (secondary) */
    const wave = el("path", {
      d: "M80 240 C140 210, 180 270, 240 230 S340 200, 400 245 S520 220, 580 250",
      fill: "none", stroke: "rgba(245,225,26,0.55)", "stroke-width": 1.6, opacity: 0.7
    });
    const sprockets = [];
    for (let i = 0; i < 10; i++) {
      sprockets.push(el("rect", { x: fx + 3, y: fy + 10 + i * 22, width: 8, height: 10, rx: 1, fill: "rgba(232,238,248,0.18)" }));
      sprockets.push(el("rect", { x: fx + fw - 11, y: fy + 10 + i * 22, width: 8, height: 10, rx: 1, fill: "rgba(232,238,248,0.18)" }));
    }
    const leader = el("line", { x1: fx + fw - 36, y1: fy + 22, x2: fx + fw + 18, y2: fy - 28, stroke: "rgba(245,225,26,0.55)", "stroke-width": 1 });
    const lab = el("text", { x: fx + fw + 22, y: fy - 32, fill: "rgba(232,238,248,0.55)", "font-size": 11,
      "font-family": "Noto Sans SC,sans-serif", "letter-spacing": "0.16em" }, ["VIDEO"]);
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" },
      [defs, matte, frame, bandG, sweepGlow, sweepCore, slices, wave, ...sprockets, leader, lab]);
    function apply(p) {
      const e = easeInOut(clamp01(p));
      sweepCore.setAttribute("width", String((fw - 16) * (0.25 + 0.75 * e)));
      sweepGlow.setAttribute("rx", String(fw * (0.15 + 0.28 * e)));
      wave.setAttribute("stroke-dasharray", "600");
      wave.setAttribute("stroke-dashoffset", String((1 - e) * 600));
      wave.setAttribute("opacity", String(0.25 + e * 0.5));
      setTransform(frame, `scale(${0.92 + 0.08 * e})`);
      leader.setAttribute("opacity", String(e));
      lab.setAttribute("opacity", String(e));
      [...bandG.children].forEach((b, i) => {
        b.setAttribute("opacity", String(0.4 + e * 0.55));
        setTransform(b, `translate(${(1 - e) * (i - 2) * 6} 0)`);
      });
    }
    return { svg, apply, layout: "film" };
  }

  function hiR1(evt) {
    const open = el("path", { d: "M200 160 L320 100 L440 160 L440 300 L320 360 L200 300 Z",
      fill: "none", stroke: C.warm, "stroke-width": 2.2 });
    const nodes = [];
    for (let i = 0; i < 9; i++) {
      nodes.push(el("circle", {
        cx: 260 + (i % 3) * 60, cy: 180 + Math.floor(i / 3) * 60, r: 10,
        fill: C.paper, stroke: C.cyan, "stroke-width": 1.4
      }));
    }
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [open, ...nodes,
      el("text", { x: 320, y: 420, fill: C.navy, "text-anchor": "middle", "font-size": 13,
        "letter-spacing": "0.12em" }, ["DeepSeek-R1 · 开源推理"])]);
    function apply(p) {
      const e = easeOut(clamp01(p));
      setTransform(open, `scale(${0.5 + 0.5 * e})`);
      nodes.forEach((c, i) => {
        const local = clamp01((e - i * 0.04) / 0.5);
        c.setAttribute("r", String(4 + local * 8));
        c.setAttribute("opacity", String(local));
      });
    }
    return { svg, apply };
  }

  function hiClaude37(evt) {
    const split = el("line", { x1: 320, y1: 100, x2: 320, y2: 380, stroke: C.soft, "stroke-width": 1.5 });
    const left = el("rect", { x: 120, y: 140, width: 170, height: 200, rx: 6,
      fill: "none", stroke: C.cyan, "stroke-width": 1.8 });
    const right = el("rect", { x: 350, y: 140, width: 170, height: 200, rx: 6,
      fill: "none", stroke: C.warm, "stroke-width": 1.8 });
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [split, left, right,
      el("text", { x: 205, y: 250, fill: C.ink, "text-anchor": "middle", "font-size": 14 }, ["即时"]),
      el("text", { x: 435, y: 250, fill: C.ink, "text-anchor": "middle", "font-size": 14 }, ["延伸思考"]),
      el("text", { x: 320, y: 420, fill: C.navy, "text-anchor": "middle", "font-size": 13,
        "letter-spacing": "0.12em" }, ["Claude 3.7 · 双模推理"])]);
    function apply(p) {
      const e = easeInOut(clamp01(p));
      setTransform(left, `translate(${(1 - e) * -40} 0)`);
      setTransform(right, `translate(${(1 - e) * 40} 0)`);
      split.setAttribute("opacity", String(e));
    }
    return { svg, apply };
  }

  function hiGPT5(evt) {
    const ring = el("circle", { cx: 320, cy: 220, r: 100, fill: "none", stroke: C.navy, "stroke-width": 2 });
    const orbit = [];
    for (let i = 0; i < 5; i++) {
      orbit.push(el("circle", { cx: 320, cy: 120, r: 10, fill: C.cyan }));
    }
    const core = el("text", { x: 320, y: 230, fill: C.warm, "text-anchor": "middle",
      "font-family": "Instrument Serif,serif", "font-size": 42 }, ["5"]);
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [ring, ...orbit, core,
      el("text", { x: 320, y: 400, fill: C.steel, "text-anchor": "middle", "font-size": 13,
        "letter-spacing": "0.14em" }, ["GPT-5 · 统一旗舰"])]);
    function apply(p) {
      const e = easeOutBack(clamp01(p));
      setTransform(core, `scale(${0.3 + 0.7 * e})`);
      ring.setAttribute("r", String(40 + 70 * e));
      orbit.forEach((c, i) => {
        const a = (i / 5) * Math.PI * 2 + e * Math.PI;
        const r = 90 * e;
        c.setAttribute("cx", String(320 + Math.cos(a) * r));
        c.setAttribute("cy", String(220 + Math.sin(a) * r));
        c.setAttribute("opacity", String(e));
      });
    }
    return { svg, apply };
  }

  function hiGPT52(evt) {
    const agents = [];
    for (let i = 0; i < 4; i++) {
      agents.push(el("g", {}, [
        el("rect", { x: 140 + i * 100, y: 180, width: 70, height: 90, rx: 8,
          fill: "none", stroke: C.steel, "stroke-width": 1.6 }),
        el("circle", { cx: 175 + i * 100, cy: 210, r: 12, fill: C.cyan, opacity: 0.4 })
      ]));
    }
    const link = el("path", { d: "M175 270 C250 320, 390 320, 465 270", fill: "none",
      stroke: C.warm, "stroke-width": 1.8 });
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [...agents, link,
      el("text", { x: 320, y: 400, fill: C.navy, "text-anchor": "middle", "font-size": 13,
        "letter-spacing": "0.12em" }, ["GPT-5.2 · 智能体协作"])]);
    function apply(p) {
      const e = easeOut(clamp01(p));
      agents.forEach((g, i) => {
        const local = clamp01((e - i * 0.1) / 0.5);
        setTransform(g, `translate(0 ${(1 - local) * 35})`);
        g.setAttribute("opacity", String(local));
      });
      link.setAttribute("stroke-dasharray", "10 8");
      link.setAttribute("stroke-dashoffset", String((1 - e) * 160));
    }
    return { svg, apply };
  }

  function hiGPT55(evt) {
    const desktop = el("rect", { x: 150, y: 120, width: 340, height: 220, rx: 8,
      fill: "none", stroke: C.navy, "stroke-width": 2 });
    const pointer = el("path", { d: "M300 200 L340 260 L310 255 L320 290 Z", fill: C.warm });
    const win = el("rect", { x: 190, y: 150, width: 140, height: 90, fill: "none",
      stroke: C.cyan, "stroke-width": 1.4 });
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [desktop, win, pointer,
      el("text", { x: 320, y: 400, fill: C.steel, "text-anchor": "middle", "font-size": 13,
        "letter-spacing": "0.12em" }, ["GPT-5.5 · 计算机使用"])]);
    function apply(p) {
      const e = easeInOut(clamp01(p));
      setTransform(desktop, `scale(${0.8 + 0.2 * e})`);
      setTransform(pointer, `translate(${e * 40} ${e * 20})`);
      setTransform(win, `translate(${(1 - e) * -20} ${(1 - e) * 10})`);
      win.setAttribute("opacity", String(0.3 + e * 0.7));
    }
    return { svg, apply };
  }

  function hiGPT56(evt) {
    const layers = [
      { y: 140, lab: "Sol", col: C.gold },
      { y: 230, lab: "Terra", col: C.teal },
      { y: 320, lab: "Luna", col: C.cyan }
    ].map((L) => el("g", {}, [
      el("rect", { x: 160, y: L.y, width: 320, height: 60, rx: 8, fill: "none",
        stroke: L.col, "stroke-width": 2 }),
      el("text", { x: 320, y: L.y + 38, fill: C.ink, "text-anchor": "middle",
        "font-family": "Instrument Serif,serif", "font-size": 22 }, [L.lab])
    ]));
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [...layers,
      el("text", { x: 320, y: 430, fill: C.navy, "text-anchor": "middle", "font-size": 13,
        "letter-spacing": "0.12em" }, ["GPT-5.6 · 分层星体"])]);
    function apply(p) {
      const e = easeOutBack(clamp01(p));
      layers.forEach((g, i) => {
        const local = clamp01((e - i * 0.14) / 0.5);
        setTransform(g, `translate(${(1 - local) * (i % 2 ? 50 : -50)} 0) scale(${0.7 + 0.3 * local})`);
        g.setAttribute("opacity", String(local));
      });
    }
    return { svg, apply };
  }

  function hiGPT6(evt) {
    const horizon = el("line", { x1: 80, y1: 300, x2: 560, y2: 300, stroke: C.navy, "stroke-width": 2 });
    const rays = [];
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI + (i / 8) * Math.PI;
      rays.push(el("line", {
        x1: 320, y1: 300, x2: 320 + Math.cos(a) * 160, y2: 300 + Math.sin(a) * 160,
        stroke: C.gold, "stroke-width": 1.4
      }));
    }
    const sun = el("circle", { cx: 320, cy: 300, r: 36, fill: "#f0d5c0", stroke: C.warm, "stroke-width": 2.4 });
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [horizon, ...rays, sun,
      el("text", { x: 320, y: 400, fill: C.navy, "text-anchor": "middle", "font-size": 13,
        "letter-spacing": "0.14em" }, ["GPT-6 Astra · 地平升起"])]);
    function apply(p) {
      const e = easeInOut(clamp01(p));
      setTransform(sun, `translate(0 ${(1 - e) * 80}) scale(${0.4 + 0.6 * e})`);
      rays.forEach((ln, i) => {
        ln.setAttribute("opacity", String(clamp01((e - 0.2 - i * 0.04) / 0.5)));
        const len = 60 + e * 120;
        const a = -Math.PI + (i / 8) * Math.PI;
        ln.setAttribute("x2", String(320 + Math.cos(a) * len));
        ln.setAttribute("y2", String(300 + Math.sin(a) * len));
      });
    }
    return { svg, apply };
  }

  function hiGemini4(evt) {
    const gem = el("path", {
      d: "M320 110 L420 200 L380 340 L260 340 L220 200 Z",
      fill: "none", stroke: C.cyan, "stroke-width": 2.4
    });
    const facets = el("g", {}, [
      el("line", { x1: 320, y1: 110, x2: 320, y2: 340, stroke: C.steel, "stroke-width": 1 }),
      el("line", { x1: 220, y1: 200, x2: 420, y2: 200, stroke: C.steel, "stroke-width": 1 }),
      el("line", { x1: 260, y1: 340, x2: 380, y2: 200, stroke: C.soft, "stroke-width": 1 }),
      el("line", { x1: 380, y1: 340, x2: 260, y2: 200, stroke: C.soft, "stroke-width": 1 })
    ]);
    const badge = el("text", { x: 320, y: 400, fill: C.warm, "text-anchor": "middle",
      "font-family": "Instrument Serif,serif", "font-size": 20 }, ["Argon"]);
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [gem, facets, badge,
      el("text", { x: 320, y: 440, fill: C.navy, "text-anchor": "middle", "font-size": 12,
        "letter-spacing": "0.14em" }, ["Gemini 4 · 晶体切面"])]);
    function apply(p) {
      const e = easeOutBack(clamp01(p));
      setTransform(gem, `rotate(${(1 - e) * -25} 320 240) scale(${0.55 + 0.45 * e})`);
      facets.setAttribute("opacity", String(e));
      badge.setAttribute("opacity", String(clamp01((e - 0.4) / 0.5)));
    }
    return { svg, apply };
  }

  /* Mid/low: distinct families by hash — different structures, not label swaps */
  function midFamily(evt, index) {
    const h = hashStr(evt.title + evt.date);
    /* Consecutive same-track nodes forced into different families */
    const fam = (h + (index || 0) * 3) % 8;
    const accent = [C.cyan, C.warm, C.teal, C.gold, C.steel, C.navy, C.cyan, C.warm][fam];
    if (fam === 0) {
      const arcs = [40, 70, 100].map((r, i) =>
        el("path", { d: `M${320 - r} 260 A${r} ${r} 0 0 1 ${320 + r} 260`, fill: "none",
          stroke: accent, "stroke-width": 1.6 + i * 0.3 }));
      const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, arcs);
      return { svg, apply(p) {
        const e = easeOut(clamp01(p));
        arcs.forEach((a, i) => {
          a.setAttribute("stroke-dasharray", String(rLen(i)));
          a.setAttribute("stroke-dashoffset", String((1 - e) * rLen(i)));
        });
        function rLen(i) { return Math.PI * (40 + i * 30); }
      }};
    }
    if (fam === 1) {
      const tris = [];
      for (let i = 0; i < 5; i++) {
        const x = 180 + i * 70;
        tris.push(el("path", { d: `M${x} 280 L${x + 30} 160 L${x + 60} 280 Z`, fill: "none",
          stroke: accent, "stroke-width": 1.5 }));
      }
      const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, tris);
      return { svg, apply(p) {
        const e = easeOutBack(clamp01(p));
        tris.forEach((t, i) => {
          const local = clamp01((e - i * 0.08) / 0.55);
          setTransform(t, `translate(0 ${(1 - local) * 40})`);
          t.setAttribute("opacity", String(local));
        });
      }};
    }
    if (fam === 2) {
      const grid = el("g", {});
      for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) {
        grid.appendChild(el("circle", { cx: 180 + i * 55, cy: 160 + j * 50, r: 6,
          fill: "none", stroke: accent, "stroke-width": 1.3 }));
      }
      const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [grid]);
      return { svg, apply(p) {
        const e = easeInOut(clamp01(p));
        [...grid.children].forEach((c, i) => {
          const local = clamp01((e - i * 0.02) / 0.6);
          c.setAttribute("r", String(3 + local * 8));
          c.setAttribute("opacity", String(local));
        });
      }};
    }
    if (fam === 3) {
      const ribbon = el("path", { d: "M100 240 C200 120, 300 360, 400 200 S540 280, 560 240",
        fill: "none", stroke: accent, "stroke-width": 2.4 });
      const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [ribbon]);
      return { svg, apply(p) {
        const e = easeInOut(clamp01(p));
        ribbon.setAttribute("stroke-dasharray", "500");
        ribbon.setAttribute("stroke-dashoffset", String((1 - e) * 500));
      }};
    }
    if (fam === 4) {
      const dial = el("circle", { cx: 320, cy: 230, r: 90, fill: "none", stroke: accent, "stroke-width": 2 });
      const hand = el("line", { x1: 320, y1: 230, x2: 320, y2: 160, stroke: C.warm, "stroke-width": 2.4 });
      const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [dial, hand]);
      return { svg, apply(p) {
        const e = easeOut(clamp01(p));
        setTransform(hand, `rotate(${e * 270} 320 230)`);
        dial.setAttribute("stroke-dasharray", `${e * 400} 600`);
      }};
    }
    if (fam === 5) {
      const bars = [];
      for (let i = 0; i < 7; i++) {
        bars.push(el("rect", { x: 160 + i * 45, y: 140, width: 28, height: 200,
          fill: "none", stroke: accent, "stroke-width": 1.4 }));
      }
      const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, bars);
      return { svg, apply(p) {
        const e = easeOut(clamp01(p));
        bars.forEach((b, i) => {
          const local = clamp01((e - i * 0.07) / 0.5);
          const hh = 50 + (hashStr(evt.title + i) % 150);
          b.setAttribute("height", String(hh * local));
          b.setAttribute("y", String(340 - hh * local));
        });
      }};
    }
    if (fam === 6) {
      const stack = [];
      for (let i = 0; i < 5; i++) {
        stack.push(el("rect", { x: 220 - i * 10, y: 120 + i * 40, width: 200 + i * 20, height: 32,
          fill: "none", stroke: accent, "stroke-width": 1.5 }));
      }
      const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, stack);
      return { svg, apply(p) {
        const e = easeOutBack(clamp01(p));
        stack.forEach((r, i) => {
          const local = clamp01((e - i * 0.1) / 0.55);
          setTransform(r, `translate(${(1 - local) * 30} 0)`);
          r.setAttribute("opacity", String(local));
        });
      }};
    }
    /* fam 7 */
    const star = el("path", {
      d: starPath(320, 230, 5, 90, 40),
      fill: "none", stroke: accent, "stroke-width": 2
    });
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [star]);
    return { svg, apply(p) {
      const e = easeOutBack(clamp01(p));
      setTransform(star, `rotate(${e * 144} 320 230) scale(${0.3 + 0.7 * e})`);
    }};
  }

  function starPath(cx, cy, points, outer, inner) {
    let d = "";
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a = -Math.PI / 2 + (i * Math.PI) / points;
      d += `${i ? "L" : "M"}${cx + Math.cos(a) * r} ${cy + Math.sin(a) * r} `;
    }
    return d + "Z";
  }

  function matchHigh(evt) {
    const t = evt.title || "";
    const d = evt.date || "";
    if (/ENIAC/.test(t)) return hiENIAC;
    if (/图灵/.test(t)) return hiTuring;
    if (/达特茅斯/.test(t)) return hiDartmouth;
    if (/反向传播|backprop/i.test(t)) return hiBackprop;
    if (/深蓝/.test(t)) return hiDeepBlue;
    if (/LSTM/.test(t)) return hiLSTM;
    if (/AlexNet/.test(t)) return hiAlexNet;
    if (/ResNet/.test(t)) return hiResNet;
    if (/AlphaGo/.test(t) && !/Zero/.test(t)) return hiAlphaGo;
    if (/Transformer/.test(t)) return hiTransformer;
    if (/AlphaZero/.test(t)) return hiAlphaZero;
    if (/GPT-1(?!\d)/.test(t) || (t === "GPT-1")) return hiGPT1;
    if (/GPT-3/.test(t) && !/GPT-3\./.test(t) && !/4|5|6/.test(t.split(" ")[0])) return hiGPT3;
    if (/AlphaFold/.test(t)) return hiAlphaFold;
    if (/InstructGPT|RLHF/.test(t)) return hiInstruct;
    if (/Midjourney/.test(t)) return hiMidjourney;
    if (/ChatGPT/.test(t)) return hiChatGPT;
    if (/GPT-4(?!o)/.test(t) && !/GPT-4o/.test(t) && d.startsWith("2023")) return hiGPT4;
    if (/Claude 首次|Claude$/.test(t) || (t.includes("Claude") && d.startsWith("2023-03"))) return hiClaude1;
    if (/Sora 技术/.test(t)) return hiSoraPrev;
    if (/Claude 3 家族/.test(t)) return hiClaude3;
    if (/GPT-4o/.test(t)) return hiGPT4o;
    if (/3\.5 Sonnet/.test(t)) return hiSonnet35;
    if (/o1-preview|o1/.test(t) && /preview|推理/.test(t + (evt.tags||[]).join(""))) return hiO1;
    if (/o1-preview/.test(t)) return hiO1;
    if (/Sora 公开/.test(t)) return hiSoraPub;
    if (/DeepSeek-R1|R1/.test(t)) return hiR1;
    if (/3\.7 Sonnet/.test(t)) return hiClaude37;
    if (/GPT-5(?!\.\d)/.test(t) && d.startsWith("2025-08")) return hiGPT5;
    if (/GPT-5\.2/.test(t)) return hiGPT52;
    if (/GPT-5\.5/.test(t)) return hiGPT55;
    if (/GPT-5\.6|Sol \/ Terra/.test(t)) return hiGPT56;
    if (/GPT-6 Astra|GPT-6(?!\.)/.test(t)) return hiGPT6;
    if (/Gemini 4|Argon/.test(t)) return hiGemini4;
    return null;
  }

  function matchStory(evt, index) {
    if (evt.impact === "high") {
      const fn = matchHigh(evt);
      if (fn) return () => fn(evt);
    }
    return () => midFamily(evt, index || 0);
  }

  function buildStill(evt, index) {
    const wrap = document.createElement("div");
    wrap.className = "story-panel";
    const tid = trackOf(evt);
    wrap.classList.add("track-" + tid);
    wrap.dataset.track = tid;
    const scene = matchStory(evt, index)();
    scene.svg.setAttribute("viewBox", "20 20 600 440");
    scene.svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    wrap.appendChild(scene.svg);
    wrap.__apply = scene.apply;
    wrap.__layout = scene.layout || null;
    if (scene.layout) wrap.classList.add("layout-" + scene.layout);
    scene.apply(0);
    return wrap;
  }

  function panelHalfWidth(i, n, xOfIndex) {
    if (n <= 1) return 420;
    const left = i === 0 ? xOfIndex(0) : (xOfIndex(i) + xOfIndex(i - 1)) / 2;
    const right = i === n - 1 ? xOfIndex(i) : (xOfIndex(i) + xOfIndex(i + 1)) / 2;
    return Math.max(280, Math.min(720, (right - left) * 0.95));
  }

  function mountStrip(strip, events, xOfIndex, trackFn) {
    strip.textContent = "";
    events.forEach((evt, i) => {
      const panel = buildStill(evt, i);
      panel.dataset.index = String(i);
      const meta = trackMeta((trackFn || trackOf)(evt));
      panel.style.left = `${xOfIndex(i)}px`;
      panel.style.width = `${panelHalfWidth(i, events.length, xOfIndex) * 2}px`;
      panel.style.top = meta.top;
      panel.setAttribute("aria-hidden", "true");
      strip.appendChild(panel);
    });
  }

  function layoutStrip(strip, xOfIndex) {
    if (!strip) return;
    const panels = [...strip.querySelectorAll(".story-panel")];
    const n = panels.length;
    panels.forEach((panel, i) => {
      panel.style.left = `${xOfIndex(i)}px`;
      panel.style.width = `${panelHalfWidth(i, n, xOfIndex) * 2}px`;
    });
  }

  function focusStrip(strip, xOfIndex, centerX, reduceMotion) {
    if (!strip) return;
    const panels = [...strip.querySelectorAll(".story-panel")];
    let best = 0;
    let bestP = -1;
    const scored = panels.map((panel, i) => {
      const x = xOfIndex(i);
      const half = Math.max(200, panelHalfWidth(i, panels.length, xOfIndex));
      const dist = centerX - x;
      const signed = Math.max(-1, Math.min(1, dist / half));
      let p = reduceMotion ? (Math.abs(signed) < 0.45 ? 1 : 0) : clamp01(1 - Math.abs(signed));
      /* Nonlinear focus: sharpen peak so one hero dominates. */
      p = p * p * (3 - 2 * p);
      if (p > bestP) { bestP = p; best = i; }
      return { panel, i, p, signed, half };
    });
    scored.forEach(({ panel, i, p, signed }) => {
      if (typeof panel.__apply === "function") panel.__apply(p, signed);
      const isHero = i === best && p > 0.35;
      panel.classList.toggle("is-hero", isHero);
      panel.classList.toggle("is-near", i !== best && p > 0.18);
      if (isHero && panel.__layout) {
        panel.classList.add("layout-" + panel.__layout);
      }
      const sc = 0.72 + p * 0.34;
      const lift = (1 - p) * 18;
      panel.style.transform = `translate(-50%, calc(-50% + ${lift.toFixed(1)}px)) scale(${sc.toFixed(3)})`;
      panel.style.opacity = ""; /* CSS classes drive opacity */
      panel.style.zIndex = String(i === best ? 8 : Math.round(p * 5));
    });
  }

  window.__HUMANITY_STORY__ = {
    buildStill, mountStrip, layoutStrip, focusStrip, matchStory, trackOf
  };
})();
