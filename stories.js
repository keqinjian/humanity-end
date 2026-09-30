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

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function easeOut(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function clamp01(t) {
    return Math.max(0, Math.min(1, t));
  }

  /** Bake a legacy timed scene to its final pose (used only at mount). */
  function runTimeline(steps, duration, reduceMotion, onDone) {
    steps.forEach((s) => s.run(1));
    onDone && onDone();
    return () => {};
  }

  function setOpacity(node, v) {
    node.setAttribute("opacity", String(v));
  }

  function setTransform(node, tr) {
    node.setAttribute("transform", tr);
  }

  function forceOpaque(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll("[opacity]").forEach((n) => n.setAttribute("opacity", "1"));
    if (root.hasAttribute && root.hasAttribute("opacity")) root.setAttribute("opacity", "1");
  }

  /** Wrap each element child in a motion <g> so transforms do not fight x/y attrs. */
  function wrapMotionParts(svg) {
    const parts = [];
    [...svg.children].forEach((kid, i) => {
      if (kid.namespaceURI !== NS) return;
      const g = el("g", { class: "motion-part", "data-i": String(i) });
      svg.insertBefore(g, kid);
      g.appendChild(kid);
      parts.push(g);
    });
    return parts;
  }

  function genericApply(parts) {
    return (p, signed) => {
      const e = easeOut(clamp01(p));
      const side = signed === 0 || !Number.isFinite(signed) ? 1 : Math.sign(signed);
      parts.forEach((g, i) => {
        const dir = (i % 2 === 0 ? -1 : 1) * (side || 1);
        const dx = dir * (110 + i * 26) * (1 - e);
        const dy = (32 + (i % 4) * 16) * (1 - e);
        const rot = dir * (14 + i * 4) * (1 - e);
        const sc = 0.68 + 0.32 * e;
        setTransform(
          g,
          `translate(320 240) rotate(${rot.toFixed(2)}) scale(${sc.toFixed(3)}) translate(-320 -240) translate(${dx.toFixed(2)} ${dy.toFixed(2)})`
        );
      });
    };
  }

  /* ——— Scene builders: return {svg, apply(progress, signed)} — progress from scroll only ——— */

  function sceneEniac(props) {
    const floor = el("line", {
      x1: 320, y1: 400, x2: 320, y2: 400,
      stroke: "#1d4e89", "stroke-width": 1.5, opacity: 1
    });
    const wall = el("line", {
      x1: 70, y1: 255, x2: 70, y2: 255,
      stroke: "#d5deea", "stroke-width": 1.5, opacity: 1
    });
    const rackGroups = [];
    const panelGroups = [];
    for (let i = 0; i < 6; i++) {
      const x = 90 + i * 82;
      const rack = el("rect", {
        x, y: 130, width: 68, height: 250,
        fill: "#e8eef6", stroke: "#1d4e89", "stroke-width": 2, opacity: 1
      });
      const rg = el("g", { class: "eniac-rack", "data-i": String(i) }, [rack]);
      const pgs = [];
      for (let row = 0; row < 6; row++) {
        const panel = el("rect", {
          x: x + 10, y: 148 + row * 36, width: 48, height: 22,
          fill: "none", stroke: "#2f6fed", "stroke-width": 1.4, opacity: 1
        });
        const pg = el("g", { class: "eniac-panel" }, [panel]);
        pgs.push(pg);
        panelGroups.push({ g: pg, i, row });
      }
      rg.append(...pgs);
      rackGroups.push(rg);
    }
    const pulse = el("text", {
      x: 320, y: 118, "text-anchor": "middle", fill: "#1d4e89",
      "font-family": "Noto Sans SC, sans-serif", "font-size": 20, "letter-spacing": "0.28em", opacity: 1
    }, ["机房 · 百平柜机"]);
    const pulseG = el("g", { class: "eniac-label" }, [pulse]);
    const markInner = el("g", {}, [
      el("rect", { x: 250, y: 220, width: 140, height: 64, fill: "#f4f7fb", stroke: "#2f6fed", "stroke-width": 2.2 }),
      el("text", {
        x: 320, y: 262, "text-anchor": "middle", fill: "#102033",
        "font-family": "Instrument Serif, serif", "font-size": 34
      }, ["CALC"]),
    ]);
    const mark = el("g", { class: "eniac-mark" }, [markInner]);
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [
      wall, floor, pulseG, ...rackGroups, mark
    ]);

    function apply(p) {
      const e = easeOut(clamp01(p));
      /* Floor rule grows from center; wall drops from midline — geometry, not fade. */
      floor.setAttribute("x1", String(320 - 250 * e));
      floor.setAttribute("x2", String(320 + 260 * e));
      wall.setAttribute("y1", String(255 - 145 * e));
      wall.setAttribute("y2", String(255 + 145 * e));
      /* Cabinets slide in from alternating sides and settle into a stack. */
      rackGroups.forEach((g, i) => {
        const fromX = (i < 3 ? -1 : 1) * (340 + (i % 3) * 48);
        const start = i * 0.08;
        const t = clamp01((e - start) / Math.max(0.001, 1 - start));
        const local = t * t; /* ease-in so mid-progress stays visibly offset */
        const dx = fromX * (1 - local);
        const dy = 48 * (1 - local);
        const rot = (i < 3 ? -1 : 1) * 16 * (1 - local);
        setTransform(g, `translate(${dx.toFixed(2)} ${dy.toFixed(2)}) rotate(${rot.toFixed(2)})`);
      });
      panelGroups.forEach(({ g, row }) => {
        const local = easeOut(clamp01((e - 0.15 - row * 0.04) / 0.7));
        const dy = (1 - local) * -18;
        setTransform(g, `translate(0 ${dy.toFixed(2)})`);
      });
      setTransform(pulseG, `translate(0 ${((1 - e) * -40).toFixed(2)})`);
      const ms = 0.45 + 0.55 * e;
      setTransform(mark, `translate(320 252) scale(${ms.toFixed(3)}) translate(-320 -252) translate(0 ${((1 - e) * 72).toFixed(2)})`);
    }

    return { svg, apply };
  }

  function sceneTypeSet(props) {
    const word = props.word || "人工智能";
    const chars = [...word];
    const letters = chars.map((ch, i) =>
      el("text", {
        class: "st-letter",
        x: 320 - (chars.length - 1) * 28 + i * 56,
        y: 300,
        "text-anchor": "middle",
        fill: "#102033",
        "font-family": "Noto Serif SC, serif",
        "font-size": 64,
        opacity: 0,
      }, [ch])
    );
    const rule = el("line", {
      x1: 160, y1: 320, x2: 160, y2: 320, stroke: "#1d4e89", "stroke-width": 1, opacity: 0.6
    });
    const meta = el("text", {
      x: 320, y: 360, "text-anchor": "middle", fill: "#1d4e89",
      "font-family": "Noto Sans SC, sans-serif", "font-size": 12, "letter-spacing": "0.18em", opacity: 0
    }, [props.caption || "1956 · 达特茅斯"]);
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [
      el("rect", { x: 140, y: 230, width: 360, height: 100, fill: "none", stroke: "#d5deea", "stroke-width": 1 }),
      rule, ...letters, meta
    ]);
    return {
      svg,
      play(rm) {
        return runTimeline([
          { at: 0, dur: 0.3, run: (t) => { rule.setAttribute("x2", String(160 + t * 320)); setOpacity(rule, 0.4 + t * 0.4); } },
          ...letters.map((node, i) => ({
            at: 0.15 + i * 0.12, dur: 0.2, ease: easeOut,
            run: (t) => { setOpacity(node, t); setTransform(node, `translate(0 ${ (1 - t) * 12 })`); }
          })),
          { at: 0.7, dur: 0.25, run: (t) => setOpacity(meta, t) },
        ], 2000, rm);
      },
    };
  }

  function sceneDialogue(props) {
    const prompt = props.prompt || "Human:";
    const reply = props.reply || "ELIZA:";
    const pLine = el("text", {
      x: 120, y: 240, fill: "#1d4e89", "font-family": "Noto Sans SC, sans-serif", "font-size": 16, opacity: 0
    }, [prompt]);
    const rLine = el("text", {
      x: 120, y: 290, fill: "#102033", "font-family": "Noto Sans SC, sans-serif", "font-size": 16, opacity: 0
    }, [reply]);
    const pBar = el("line", { x1: 120, y1: 250, x2: 120, y2: 250, stroke: "#2f6fed", "stroke-width": 1.5, opacity: 0 });
    const rBar = el("line", { x1: 120, y1: 300, x2: 120, y2: 300, stroke: "#16324f", "stroke-width": 1.5, opacity: 0 });
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [
      el("text", { x: 120, y: 180, fill: "#1d4e89", "font-size": 12, "letter-spacing": "0.2em", opacity: 0.5,
        "font-family": "Noto Sans SC, sans-serif" }, [props.caption || "对话"]),
      pLine, pBar, rLine, rBar
    ]);
    return {
      svg,
      play(rm) {
        return runTimeline([
          { at: 0.05, dur: 0.25, run: (t) => setOpacity(pLine, t) },
          { at: 0.2, dur: 0.35, ease: easeOut, run: (t) => { setOpacity(pBar, 1); pBar.setAttribute("x2", String(120 + t * 280)); } },
          { at: 0.5, dur: 0.25, run: (t) => setOpacity(rLine, t) },
          { at: 0.65, dur: 0.3, ease: easeOut, run: (t) => { setOpacity(rBar, 1); rBar.setAttribute("x2", String(120 + t * 340)); } },
        ], 1700, rm);
      },
    };
  }

  function sceneChess(props) {
    const cells = [];
    const origin = { x: 200, y: 140 };
    const size = 28;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        cells.push(el("rect", {
          x: origin.x + c * size, y: origin.y + r * size, width: size, height: size,
          fill: (r + c) % 2 ? "#e8eef6" : "#f4f7fb",
          stroke: "#1d4e89", "stroke-width": 0.5, opacity: 0
        }));
      }
    }
    const lockR = props.lockRow ?? 3;
    const lockC = props.lockCol ?? 4;
    const lock = el("rect", {
      x: origin.x + lockC * size, y: origin.y + lockR * size, width: size, height: size,
      fill: "none", stroke: "#2f6fed", "stroke-width": 2.5, opacity: 0
    });
    const king = el("circle", {
      cx: origin.x + lockC * size + size / 2,
      cy: origin.y + lockR * size + size / 2,
      r: 0, fill: "#16324f", opacity: 0
    });
    const caption = el("text", {
      x: 320, y: 390, "text-anchor": "middle", fill: "#1d4e89",
      "font-family": "Noto Sans SC, sans-serif", "font-size": 12, "letter-spacing": "0.16em", opacity: 0
    }, [props.caption || "深蓝 · 1997"]);
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [...cells, lock, king, caption]);
    return {
      svg,
      play(rm) {
        return runTimeline([
          { at: 0, dur: 0.4, run: (t) => cells.forEach((c, i) => setOpacity(c, Math.min(1, t * 2 - (i % 8) * 0.05))) },
          { at: 0.45, dur: 0.3, ease: easeOut, run: (t) => { setOpacity(lock, t); setOpacity(king, t); king.setAttribute("r", String(t * 7)); } },
          { at: 0.7, dur: 0.25, run: (t) => setOpacity(caption, t) },
        ], 1700, rm);
      },
    };
  }

  function sceneJeopardy(props) {
    const card = el("rect", { x: 180, y: 160, width: 280, height: 160, fill: "#16324f", opacity: 0 });
    const q = el("text", {
      x: 320, y: 230, "text-anchor": "middle", fill: "#f4f7fb",
      "font-family": "Noto Serif SC, serif", "font-size": 18, opacity: 0
    }, [props.question || "ANSWER?"]);
    const a = el("text", {
      x: 320, y: 280, "text-anchor": "middle", fill: "#2f6fed",
      "font-family": "Noto Sans SC, sans-serif", "font-size": 14, opacity: 0
    }, [props.answer || "Watson"]);
    const bar = el("rect", { x: 200, y: 300, width: 0, height: 4, fill: "#2f6fed", opacity: 0 });
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [card, q, a, bar]);
    return {
      svg,
      play(rm) {
        return runTimeline([
          { at: 0, dur: 0.3, ease: easeOut, run: (t) => setOpacity(card, t * 0.92) },
          { at: 0.25, dur: 0.25, run: (t) => setOpacity(q, t) },
          { at: 0.5, dur: 0.3, ease: easeOut, run: (t) => { setOpacity(a, t); setOpacity(bar, 1); bar.setAttribute("width", String(t * 240)); } },
        ], 1600, rm);
      },
    };
  }

  function sceneAlexNet(props) {
    const bands = [];
    const colors = ["#16324f", "#1d4e89", "#2f6fed", "#5a8fd4", "#9bb8e0"];
    for (let i = 0; i < 5; i++) {
      bands.push(el("rect", {
        x: 220, y: 200, width: 200, height: 36,
        fill: colors[i], opacity: 0
      }));
    }
    const frame = el("rect", {
      x: 220, y: 160, width: 200, height: 140,
      fill: "none", stroke: "#1d4e89", "stroke-width": 1.2, opacity: 0
    });
    const cap = el("text", {
      x: 320, y: 360, "text-anchor": "middle", fill: "#1d4e89",
      "font-family": "Noto Sans SC, sans-serif", "font-size": 12, "letter-spacing": "0.14em", opacity: 0
    }, [props.caption || "AlexNet · 特征层"]);
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [frame, ...bands, cap]);
    return {
      svg,
      play(rm) {
        return runTimeline([
          { at: 0, dur: 0.25, run: (t) => setOpacity(frame, t) },
          { at: 0.15, dur: 0.15, run: (t) => { setOpacity(bands[0], t); } },
          ...bands.map((b, i) => ({
            at: 0.2 + i * 0.12, dur: 0.28, ease: easeOut,
            run: (t) => {
              setOpacity(b, 0.55 + t * 0.45);
              b.setAttribute("y", String(160 + i * (28 + t * 8)));
              b.setAttribute("height", String(24 + t * 4));
            }
          })),
          { at: 0.75, dur: 0.2, run: (t) => setOpacity(cap, t) },
        ], 1900, rm);
      },
    };
  }

  function sceneGan(props) {
    const gen = el("rect", { x: 140, y: 220, width: 0, height: 28, fill: "#2f6fed", opacity: 0.85 });
    const dis = el("rect", { x: 500, y: 220, width: 0, height: 28, fill: "#16324f", opacity: 0.85 });
    const mid = el("circle", { cx: 320, cy: 234, r: 0, fill: "none", stroke: "#1d4e89", "stroke-width": 1.5, opacity: 0 });
    const gLab = el("text", { x: 140, y: 200, fill: "#1d4e89", "font-size": 12, opacity: 0,
      "font-family": "Noto Sans SC, sans-serif" }, ["生成器"]);
    const dLab = el("text", { x: 500, y: 200, "text-anchor": "end", fill: "#1d4e89", "font-size": 12, opacity: 0,
      "font-family": "Noto Sans SC, sans-serif" }, ["判别器"]);
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [gen, dis, mid, gLab, dLab]);
    return {
      svg,
      play(rm) {
        return runTimeline([
          { at: 0, dur: 0.2, run: (t) => { setOpacity(gLab, t); setOpacity(dLab, t); } },
          { at: 0.15, dur: 0.45, ease: easeInOut, run: (t) => {
            gen.setAttribute("width", String(t * 140));
            dis.setAttribute("x", String(500 - t * 140));
            dis.setAttribute("width", String(t * 140));
          }},
          { at: 0.55, dur: 0.3, ease: easeOut, run: (t) => { setOpacity(mid, t); mid.setAttribute("r", String(t * 18)); } },
        ], 1600, rm);
      },
    };
  }

  function sceneGo(props) {
    const lines = [];
    const o = { x: 180, y: 120 };
    const n = 9;
    const step = 32;
    for (let i = 0; i < n; i++) {
      lines.push(el("line", { x1: o.x, y1: o.y + i * step, x2: o.x + (n - 1) * step, y2: o.y + i * step,
        stroke: "#1d4e89", "stroke-width": 1, opacity: 0 }));
      lines.push(el("line", { x1: o.x + i * step, y1: o.y, x2: o.x + i * step, y2: o.y + (n - 1) * step,
        stroke: "#1d4e89", "stroke-width": 1, opacity: 0 }));
    }
    const stone = el("circle", {
      cx: o.x + 4 * step, cy: o.y + 4 * step, r: 0, fill: "#102033", opacity: 0
    });
    const cap = el("text", {
      x: 320, y: 430, "text-anchor": "middle", fill: "#1d4e89",
      "font-family": "Noto Sans SC, sans-serif", "font-size": 12, "letter-spacing": "0.16em", opacity: 0
    }, [props.caption || "AlphaGo · 一子"]);
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [...lines, stone, cap]);
    return {
      svg,
      play(rm) {
        return runTimeline([
          { at: 0, dur: 0.4, run: (t) => lines.forEach((l) => setOpacity(l, t * 0.7)) },
          { at: 0.45, dur: 0.35, ease: easeOut, run: (t) => { setOpacity(stone, t); stone.setAttribute("r", String(t * 11)); } },
          { at: 0.75, dur: 0.2, run: (t) => setOpacity(cap, t) },
        ], 1700, rm);
      },
    };
  }

  function sceneTransformer(props) {
    const tokens = (props.tokens || ["Attention", "Is", "All", "You", "Need"]).slice(0, 5);
    const home = tokens.map((tok, i) => ({ tok, x: 40 + i * 118, cx: 40 + i * 118 + 54 }));
    const boxes = home.map((h, i) => {
      const g = el("g", { class: "tf-token", "data-i": String(i), opacity: 1 }, [
        el("rect", { x: h.x, y: 210, width: 108, height: 48, fill: "#e8eef6", stroke: "#1d4e89", "stroke-width": 2 }),
        el("text", { x: h.cx, y: 240, "text-anchor": "middle", fill: "#102033",
          "font-family": "Noto Sans SC, sans-serif", "font-size": 15, "font-weight": "500" }, [h.tok]),
      ]);
      return { g, cx: h.cx, i };
    });
    const src = 2;
    const lines = [];
    boxes.forEach((b, i) => {
      if (i === src) return;
      const w = i === 1 || i === 3 ? 2.8 : 1.4;
      const ln = el("path", {
        class: "tf-attn",
        d: `M${boxes[src].cx} 210 Q${(boxes[src].cx + b.cx) / 2} 140 ${b.cx} 210`,
        fill: "none", stroke: "#2f6fed", "stroke-width": w, opacity: 1,
        "stroke-linecap": "round"
      });
      const len = 220;
      ln.setAttribute("stroke-dasharray", String(len));
      ln.setAttribute("stroke-dashoffset", String(len));
      ln._dash = len;
      lines.push({ ln, i });
    });
    const titleG = el("g", { class: "tf-title" }, [
      el("text", {
        x: 320, y: 150, "text-anchor": "middle", fill: "#1d4e89",
        "font-family": "Noto Sans SC, sans-serif", "font-size": 18, "letter-spacing": "0.22em", opacity: 1
      }, [props.caption || "自注意力"])
    ]);
    const rule = el("line", {
      class: "tf-rule", x1: 320, y1: 280, x2: 320, y2: 280,
      stroke: "#1d4e89", "stroke-width": 1.5, opacity: 1
    });
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [
      titleG, rule, ...lines.map((L) => L.ln), ...boxes.map((b) => b.g)
    ]);

    function apply(p) {
      const e = easeOut(clamp01(p));
      /* Tokens start stacked at center, then separate along x. */
      boxes.forEach((b) => {
        const targetX = home[b.i].cx;
        const fromX = 320;
        const spread = e * e; /* ease-in separation */
        const x = fromX + (targetX - fromX) * spread;
        const dx = x - targetX;
        const dy = (1 - e) * 36;
        const rot = (b.i - src) * 12 * (1 - e);
        setTransform(b.g, `translate(${dx.toFixed(2)} ${dy.toFixed(2)}) rotate(${rot.toFixed(2)})`);
      });
      lines.forEach(({ ln }, idx) => {
        const local = clamp01((e - 0.28 - idx * 0.06) / 0.62);
        const draw = local * local;
        ln.setAttribute("stroke-dashoffset", String(ln._dash * (1 - draw)));
      });
      setTransform(titleG, `translate(0 ${((1 - e) * -36).toFixed(2)})`);
      rule.setAttribute("x1", String(320 - 200 * e));
      rule.setAttribute("x2", String(320 + 200 * e));
    }

    return { svg, apply };
  }

  function sceneMask(props) {
    const words = props.words || ["The", "[MASK]", "cat"];
    const nodes = words.map((w, i) =>
      el("g", { opacity: 0 }, [
        el("rect", { x: 140 + i * 120, y: 220, width: 100, height: 40, fill: w.includes("MASK") ? "#e8eef6" : "none",
          stroke: "#1d4e89", "stroke-width": 1.2, "stroke-dasharray": w.includes("MASK") ? "4 3" : "0" }),
        el("text", { x: 190 + i * 120, y: 246, "text-anchor": "middle", fill: "#102033",
          "font-family": "Noto Sans SC, sans-serif", "font-size": 14 }, [w]),
      ])
    );
    const reveal = el("text", {
      x: 310, y: 246, "text-anchor": "middle", fill: "#2f6fed",
      "font-family": "Noto Serif SC, serif", "font-size": 16, opacity: 0
    }, [props.reveal || "black"]);
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [...nodes, reveal]);
    return {
      svg,
      play(rm) {
        return runTimeline([
          ...nodes.map((n, i) => ({ at: 0.05 + i * 0.12, dur: 0.2, run: (t) => setOpacity(n, t) })),
          { at: 0.55, dur: 0.35, ease: easeOut, run: (t) => {
            setOpacity(nodes[1], 1 - t);
            setOpacity(reveal, t);
          }},
        ], 1600, rm);
      },
    };
  }

  function sceneScale(props) {
    const bars = (props.scales || [0.2, 0.45, 0.75, 1]).map((h, i) =>
      el("rect", {
        x: 180 + i * 70, y: 320, width: 40, height: 0,
        fill: i === (props.scales || []).length - 1 ? "#2f6fed" : "#1d4e89", opacity: 0.85
      })
    );
    const lab = el("text", {
      x: 320, y: 360, "text-anchor": "middle", fill: "#1d4e89",
      "font-family": "Noto Sans SC, sans-serif", "font-size": 12, "letter-spacing": "0.14em", opacity: 0
    }, [props.caption || "参数规模"]);
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [...bars, lab]);
    return {
      svg,
      play(rm) {
        const scales = props.scales || [0.2, 0.45, 0.75, 1];
        return runTimeline([
          ...bars.map((b, i) => ({
            at: 0.1 + i * 0.15, dur: 0.35, ease: easeOut,
            run: (t) => {
              const h = scales[i] * 140 * t;
              b.setAttribute("height", String(h));
              b.setAttribute("y", String(320 - h));
            }
          })),
          { at: 0.75, dur: 0.2, run: (t) => setOpacity(lab, t) },
        ], 1700, rm);
      },
    };
  }

  function sceneFrameFill(props) {
    const frame = el("rect", {
      x: 120, y: 110, width: 400, height: 250,
      fill: "#f4f7fb", stroke: "#1d4e89", "stroke-width": 2.2, opacity: 0
    });
    const shapes = [];
    const specs = props.shapes || [
      { type: "rect", x: 200, y: 180, w: 80, h: 50 },
      { type: "circle", cx: 340, cy: 210, r: 28 },
      { type: "rect", x: 280, y: 260, w: 120, h: 40 },
      { type: "line", x1: 210, y1: 280, x2: 300, y2: 180 },
    ];
    specs.forEach((s) => {
      if (s.type === "rect") shapes.push(el("rect", { x: s.x, y: s.y, width: s.w, height: s.h, fill: "none", stroke: "#2f6fed", "stroke-width": 1.4, opacity: 0 }));
      else if (s.type === "circle") shapes.push(el("circle", { cx: s.cx, cy: s.cy, r: s.r, fill: "none", stroke: "#16324f", "stroke-width": 1.4, opacity: 0 }));
      else shapes.push(el("line", { x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2, stroke: "#1d4e89", "stroke-width": 1.2, opacity: 0 }));
    });
    const prompt = el("text", {
      x: 130, y: 96, fill: "#1d4e89", "font-size": 16, "letter-spacing": "0.12em", opacity: 0,
      "font-family": "Noto Sans SC, sans-serif"
    }, [props.prompt || "a constructed still life"]);
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [prompt, frame, ...shapes]);
    return {
      svg,
      play(rm) {
        return runTimeline([
          { at: 0, dur: 0.25, run: (t) => { setOpacity(frame, t); setOpacity(prompt, t * 0.8); } },
          ...shapes.map((s, i) => ({ at: 0.25 + i * 0.15, dur: 0.25, ease: easeOut, run: (t) => setOpacity(s, t) })),
        ], 1800, rm);
      },
    };
  }

  function sceneFold(props) {
    const ribbon = [];
    const pts = [];
    for (let i = 0; i < 12; i++) {
      pts.push([160 + i * 28, 260 + Math.sin(i * 0.7) * 40]);
    }
    const pathFlat = pts.map((p, i) => `${i ? "L" : "M"}${p[0]} ${240}`).join(" ");
    const pathFold = pts.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`).join(" ");
    const path = el("path", { d: pathFlat, fill: "none", stroke: "#2f6fed", "stroke-width": 2.5, opacity: 0 });
    const cap = el("text", {
      x: 320, y: 360, "text-anchor": "middle", fill: "#1d4e89",
      "font-family": "Noto Sans SC, sans-serif", "font-size": 12, "letter-spacing": "0.14em", opacity: 0
    }, [props.caption || "AlphaFold · 折叠"]);
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [path, cap]);
    return {
      svg,
      play(rm) {
        return runTimeline([
          { at: 0, dur: 0.25, run: (t) => setOpacity(path, t) },
          { at: 0.2, dur: 0.55, ease: easeInOut, run: (t) => {
            // interpolate Y between flat and folded
            const d = pts.map((p, i) => {
              const y = 240 + (p[1] - 240) * t;
              return `${i ? "L" : "M"}${p[0]} ${y}`;
            }).join(" ");
            path.setAttribute("d", d);
          }},
          { at: 0.75, dur: 0.2, run: (t) => setOpacity(cap, t) },
        ], 1900, rm);
      },
    };
  }

  function sceneCode(props) {
    const nl = el("text", {
      x: 120, y: 200, fill: "#1d4e89", "font-size": 14, opacity: 0,
      "font-family": "Noto Sans SC, sans-serif"
    }, [props.prompt || "写一个排序函数"]);
    const lines = (props.code || ["def sort(a):", "  return sorted(a)"]).map((ln, i) =>
      el("text", {
        x: 140, y: 250 + i * 28, fill: "#102033", "font-size": 15, opacity: 0,
        "font-family": "ui-monospace, monospace"
      }, [ln])
    );
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [
      el("rect", { x: 100, y: 220, width: 440, height: 120, fill: "#e8eef6", opacity: 0 }),
      nl, ...lines
    ]);
    const panel = svg.firstChild;
    return {
      svg,
      play(rm) {
        return runTimeline([
          { at: 0, dur: 0.25, run: (t) => setOpacity(nl, t) },
          { at: 0.25, dur: 0.2, run: (t) => setOpacity(panel, t * 0.7) },
          ...lines.map((ln, i) => ({ at: 0.4 + i * 0.18, dur: 0.25, ease: easeOut, run: (t) => setOpacity(ln, t) })),
        ], 1700, rm);
      },
    };
  }

  function sceneChat(props) {
    return sceneDialogue({
      prompt: props.prompt || "你：解释量子纠缠",
      reply: props.reply || "助手：用两粒子的相关……",
      caption: props.caption || "对话界面",
    });
  }

  function sceneOpenWeight(props) {
    const lock = el("g", { opacity: 0 }, [
      el("rect", { x: 290, y: 210, width: 60, height: 50, rx: 4, fill: "none", stroke: "#1d4e89", "stroke-width": 2 }),
      el("path", { d: "M305 210 V190 a15 15 0 0 1 30 0 V210", fill: "none", stroke: "#1d4e89", "stroke-width": 2 }),
    ]);
    const open = el("g", { opacity: 0 }, [
      el("rect", { x: 290, y: 210, width: 60, height: 50, rx: 4, fill: "none", stroke: "#2f6fed", "stroke-width": 2 }),
      el("path", { d: "M305 210 V185 a15 15 0 0 1 28 -2", fill: "none", stroke: "#2f6fed", "stroke-width": 2 }),
    ]);
    const rays = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      rays.push(el("line", {
        x1: 320, y1: 235, x2: 320, y2: 235,
        stroke: "#2f6fed", "stroke-width": 1.2, opacity: 0,
        "data-x": 320 + Math.cos(a) * 80, "data-y": 235 + Math.sin(a) * 80
      }));
    }
    const cap = el("text", {
      x: 320, y: 320, "text-anchor": "middle", fill: "#1d4e89",
      "font-family": "Noto Sans SC, sans-serif", "font-size": 12, "letter-spacing": "0.16em", opacity: 0
    }, [props.caption || "开放权重"]);
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [lock, open, ...rays, cap]);
    return {
      svg,
      play(rm) {
        return runTimeline([
          { at: 0, dur: 0.3, run: (t) => setOpacity(lock, t) },
          { at: 0.35, dur: 0.3, run: (t) => { setOpacity(lock, 1 - t); setOpacity(open, t); } },
          { at: 0.55, dur: 0.35, ease: easeOut, run: (t) => {
            rays.forEach((ln) => {
              setOpacity(ln, t * 0.7);
              ln.setAttribute("x2", String(320 + (Number(ln.getAttribute("data-x")) - 320) * t));
              ln.setAttribute("y2", String(235 + (Number(ln.getAttribute("data-y")) - 235) * t));
            });
          }},
          { at: 0.75, dur: 0.2, run: (t) => setOpacity(cap, t) },
        ], 1800, rm);
      },
    };
  }

  function sceneMultimodal(props) {
    const panes = [
      el("rect", { x: 140, y: 180, width: 150, height: 120, fill: "none", stroke: "#1d4e89", "stroke-width": 1.2, opacity: 0 }),
      el("rect", { x: 320, y: 180, width: 150, height: 120, fill: "none", stroke: "#1d4e89", "stroke-width": 1.2, opacity: 0 }),
    ];
    const t1 = el("text", { x: 215, y: 245, "text-anchor": "middle", fill: "#102033", "font-size": 13, opacity: 0,
      "font-family": "Noto Sans SC, sans-serif" }, ["文本"]);
    const t2 = el("text", { x: 395, y: 245, "text-anchor": "middle", fill: "#102033", "font-size": 13, opacity: 0,
      "font-family": "Noto Sans SC, sans-serif" }, [props.second || "图像"]);
    const bridge = el("line", { x1: 290, y1: 240, x2: 290, y2: 240, stroke: "#2f6fed", "stroke-width": 2, opacity: 0 });
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [...panes, t1, t2, bridge]);
    return {
      svg,
      play(rm) {
        return runTimeline([
          { at: 0, dur: 0.3, run: (t) => { setOpacity(panes[0], t); setOpacity(t1, t); } },
          { at: 0.25, dur: 0.3, run: (t) => { setOpacity(panes[1], t); setOpacity(t2, t); } },
          { at: 0.55, dur: 0.3, ease: easeOut, run: (t) => { setOpacity(bridge, t); bridge.setAttribute("x2", String(290 + t * 30)); } },
        ], 1500, rm);
      },
    };
  }

  function sceneVoice(props) {
    const waves = [];
    for (let i = 0; i < 16; i++) {
      waves.push(el("line", {
        x1: 160 + i * 20, y1: 240, x2: 160 + i * 20, y2: 240,
        stroke: "#2f6fed", "stroke-width": 2, opacity: 0
      }));
    }
    const eye = el("rect", { x: 400, y: 190, width: 80, height: 60, fill: "none", stroke: "#1d4e89", "stroke-width": 1.2, opacity: 0 });
    const cap = el("text", {
      x: 320, y: 340, "text-anchor": "middle", fill: "#1d4e89",
      "font-family": "Noto Sans SC, sans-serif", "font-size": 12, "letter-spacing": "0.14em", opacity: 0
    }, [props.caption || "实时语音 · 视觉"]);
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [...waves, eye, cap]);
    return {
      svg,
      play(rm) {
        return runTimeline([
          { at: 0, dur: 0.5, ease: easeOut, run: (t) => {
            waves.forEach((w, i) => {
              setOpacity(w, t);
              const h = (8 + (i % 5) * 10) * t;
              w.setAttribute("y1", String(240 - h));
              w.setAttribute("y2", String(240 + h));
            });
          }},
          { at: 0.4, dur: 0.3, run: (t) => setOpacity(eye, t) },
          { at: 0.7, dur: 0.2, run: (t) => setOpacity(cap, t) },
        ], 1600, rm);
      },
    };
  }

  function sceneReasonChain(props) {
    const steps = props.steps || ["读题", "分解", "演算", "核验"];
    const rail = el("line", {
      class: "rc-rail", x1: 80, y1: 195, x2: 80, y2: 195,
      stroke: "#d5deea", "stroke-width": 3, opacity: 1, "stroke-linecap": "round"
    });
    const nodes = steps.map((s, i) => {
      const cx = 100 + i * 145;
      const g = el("g", { class: "rc-step", "data-i": String(i), opacity: 1 }, [
        el("circle", { cx, cy: 195, r: 36, fill: "#e8eef6", stroke: "#1d4e89", "stroke-width": 2.4 }),
        el("text", { x: cx, y: 202, "text-anchor": "middle", fill: "#102033", "font-size": 17,
          "font-family": "Noto Sans SC, sans-serif" }, [s]),
      ]);
      return { g, cx, i };
    });
    const links = [];
    for (let i = 0; i < steps.length - 1; i++) {
      const x1 = 136 + i * 145;
      const x2 = 64 + (i + 1) * 145;
      const ln = el("line", {
        class: "rc-link", x1, y1: 195, x2: x1, y2: 195,
        stroke: "#2f6fed", "stroke-width": 2.4, opacity: 1, "stroke-linecap": "round"
      });
      ln._x1 = x1;
      ln._x2 = x2;
      links.push(ln);
    }
    const answer = el("g", { class: "rc-answer", opacity: 1 }, [
      el("rect", { x: 150, y: 270, width: 340, height: 70, fill: "#e8eef6", stroke: "#2f6fed", "stroke-width": 2.4 }),
      el("text", { x: 320, y: 315, "text-anchor": "middle", fill: "#102033", "font-size": 24,
        "font-family": "Noto Serif SC, serif" }, [props.answer || "答案"]),
    ]);
    const cap = el("g", { class: "rc-cap" }, [
      el("text", {
        x: 320, y: 130, "text-anchor": "middle", fill: "#1d4e89",
        "font-family": "Noto Sans SC, sans-serif", "font-size": 16, "letter-spacing": "0.18em", opacity: 1
      }, [props.caption || "推理链"])
    ]);
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [
      rail, ...links, ...nodes.map((n) => n.g), answer, cap
    ]);

    function apply(p) {
      const e = easeOut(clamp01(p));
      rail.setAttribute("x2", String(80 + 480 * e));
      /* Steps travel along the rail from the left with stagger. */
      nodes.forEach((n) => {
        const start = n.i * 0.1;
        const t = clamp01((e - start) / Math.max(0.001, 1 - start));
        const local = t * t;
        const fromX = -40;
        const dx = (fromX - n.cx) * (1 - local);
        const dy = (1 - local) * 70;
        const sc = 0.55 + 0.45 * local;
        setTransform(
          n.g,
          `translate(${(n.cx + dx).toFixed(2)} ${(195 + dy).toFixed(2)}) scale(${sc.toFixed(3)}) translate(${(-n.cx).toFixed(2)} -195)`
        );
      });
      links.forEach((ln, i) => {
        const local = easeOut(clamp01((e - 0.2 - i * 0.1) / 0.65));
        ln.setAttribute("x2", String(ln._x1 + (ln._x2 - ln._x1) * local));
      });
      /* Result plate rises from below and settles. */
      const ap = easeOut(clamp01((e - 0.35) / 0.65));
      const ay = (1 - ap) * 90;
      const asc = 0.8 + 0.2 * ap;
      setTransform(
        answer,
        `translate(320 ${(305 + ay).toFixed(2)}) scale(${asc.toFixed(3)}) translate(-320 -305)`
      );
      setTransform(cap, `translate(0 ${((1 - e) * -30).toFixed(2)})`);
    }

    return { svg, apply };
  }

  function sceneFilm(props) {
    const frames = [];
    for (let i = 0; i < 5; i++) {
      frames.push(el("rect", {
        x: 100 + i * 90, y: 200, width: 70, height: 50,
        fill: "#e8eef6", stroke: "#1d4e89", "stroke-width": 1.2, opacity: 0
      }));
    }
    const fills = frames.map((_, i) =>
      el("rect", {
        x: 100 + i * 90 + 8, y: 208, width: 0, height: 34,
        fill: "#2f6fed", opacity: 0.35
      })
    );
    const cap = el("text", {
      x: 320, y: 300, "text-anchor": "middle", fill: "#1d4e89",
      "font-family": "Noto Sans SC, sans-serif", "font-size": 12, "letter-spacing": "0.16em", opacity: 0
    }, [props.caption || "文本到视频"]);
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [...frames, ...fills, cap]);
    return {
      svg,
      play(rm) {
        return runTimeline([
          ...frames.map((f, i) => ({ at: 0.05 + i * 0.1, dur: 0.2, run: (t) => setOpacity(f, t) })),
          ...fills.map((f, i) => ({
            at: 0.35 + i * 0.1, dur: 0.25, ease: easeOut,
            run: (t) => { setOpacity(f, 0.35); f.setAttribute("width", String(t * 54)); }
          })),
          { at: 0.8, dur: 0.15, run: (t) => setOpacity(cap, t) },
        ], 1900, rm);
      },
    };
  }

  function sceneAgent(props) {
    const win = el("rect", { x: 180, y: 150, width: 280, height: 180, fill: "none", stroke: "#1d4e89", "stroke-width": 1.3, opacity: 0 });
    const titlebar = el("rect", { x: 180, y: 150, width: 280, height: 22, fill: "#e8eef6", opacity: 0 });
    const cursor = el("path", {
      d: "M300 220 L300 220 L300 220", fill: "#2f6fed", stroke: "#16324f", "stroke-width": 1, opacity: 0
    });
    const trail = el("polyline", {
      points: "220,280", fill: "none", stroke: "#2f6fed", "stroke-width": 1.2, "stroke-dasharray": "4 3", opacity: 0
    });
    const cap = el("text", {
      x: 320, y: 370, "text-anchor": "middle", fill: "#1d4e89",
      "font-family": "Noto Sans SC, sans-serif", "font-size": 12, "letter-spacing": "0.14em", opacity: 0
    }, [props.caption || "计算机使用"]);
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [win, titlebar, trail, cursor, cap]);
    return {
      svg,
      play(rm) {
        const path = [[220, 280], [300, 220], [380, 260], [340, 300]];
        return runTimeline([
          { at: 0, dur: 0.25, run: (t) => { setOpacity(win, t); setOpacity(titlebar, t * 0.9); } },
          { at: 0.25, dur: 0.55, ease: easeInOut, run: (t) => {
            setOpacity(cursor, 1);
            setOpacity(trail, 0.7);
            const idx = Math.min(path.length - 2, Math.floor(t * (path.length - 1)));
            const local = t * (path.length - 1) - idx;
            const a = path[idx];
            const b = path[Math.min(path.length - 1, idx + 1)];
            const x = a[0] + (b[0] - a[0]) * local;
            const y = a[1] + (b[1] - a[1]) * local;
            cursor.setAttribute("d", `M${x} ${y} l8 14 l-4 -1 l2 6 z`);
            const pts = path.slice(0, idx + 1).map((p) => p.join(",")).concat([`${x},${y}`]);
            trail.setAttribute("points", pts.join(" "));
          }},
          { at: 0.8, dur: 0.15, run: (t) => setOpacity(cap, t) },
        ], 2000, rm);
      },
    };
  }

  function sceneLayers(props) {
    const labels = props.layers || ["快速", "推理", "工具"];
    const rows = labels.map((lab, i) =>
      el("g", { opacity: 0 }, [
        el("rect", { x: 180, y: 160 + i * 50, width: 280, height: 36, fill: i === labels.length - 1 ? "#e8eef6" : "none",
          stroke: "#1d4e89", "stroke-width": 1.2 }),
        el("text", { x: 200, y: 184 + i * 50, fill: "#102033", "font-size": 14,
          "font-family": "Noto Sans SC, sans-serif" }, [lab]),
      ])
    );
    const cap = el("text", {
      x: 320, y: 340, "text-anchor": "middle", fill: "#1d4e89",
      "font-family": "Noto Sans SC, sans-serif", "font-size": 12, "letter-spacing": "0.14em", opacity: 0
    }, [props.caption || "统一路由"]);
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [...rows, cap]);
    return {
      svg,
      play(rm) {
        return runTimeline([
          ...rows.map((r, i) => ({ at: 0.1 + i * 0.18, dur: 0.28, ease: easeOut, run: (t) => {
            setOpacity(r, t);
            setTransform(r, `translate(0 ${(1 - t) * 16})`);
          }})),
          { at: 0.75, dur: 0.2, run: (t) => setOpacity(cap, t) },
        ], 1700, rm);
      },
    };
  }

  function sceneAgi(props) {
    const ring = el("circle", { cx: 320, cy: 230, r: 0, fill: "none", stroke: "#2f6fed", "stroke-width": 1.5, opacity: 0 });
    const core = el("circle", { cx: 320, cy: 230, r: 0, fill: "#16324f", opacity: 0 });
    const rays = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      rays.push(el("line", {
        x1: 320, y1: 230, x2: 320, y2: 230, stroke: "#1d4e89", "stroke-width": 1, opacity: 0,
        "data-x": 320 + Math.cos(a) * 90, "data-y": 230 + Math.sin(a) * 90
      }));
    }
    const word = el("text", {
      x: 320, y: 340, "text-anchor": "middle", fill: "#102033",
      "font-family": "Noto Serif SC, serif", "font-size": 20, opacity: 0
    }, [props.word || "AGI"]);
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [ring, ...rays, core, word]);
    return {
      svg,
      play(rm) {
        return runTimeline([
          { at: 0, dur: 0.4, ease: easeOut, run: (t) => { setOpacity(ring, t); ring.setAttribute("r", String(t * 70)); } },
          { at: 0.25, dur: 0.4, ease: easeOut, run: (t) => {
            rays.forEach((ln) => {
              setOpacity(ln, t * 0.7);
              ln.setAttribute("x2", String(320 + (Number(ln.getAttribute("data-x")) - 320) * t));
              ln.setAttribute("y2", String(230 + (Number(ln.getAttribute("data-y")) - 230) * t));
            });
          }},
          { at: 0.5, dur: 0.3, run: (t) => { setOpacity(core, t); core.setAttribute("r", String(t * 10)); } },
          { at: 0.7, dur: 0.25, run: (t) => setOpacity(word, t) },
        ], 2000, rm);
      },
    };
  }

  /* Map events → scene factory + props */
  function matchStory(evt) {
    const t = evt.title || "";
    const tags = evt.tags || [];
    const year = (evt.date || "").slice(0, 4);
    const era = evt.era || "";

    if (/ENIAC/.test(t)) return () => sceneEniac({});
    if (/达特茅斯/.test(t)) return () => sceneTypeSet({ word: "人工智能", caption: `${year} · 达特茅斯研讨班` });
    if (/ELIZA/.test(t)) return () => sceneDialogue({ prompt: "用户：我很难过", reply: "ELIZA：为何难过？", caption: "模式匹配对话" });
    if (/深蓝|Deep Blue/.test(t)) return () => sceneChess({ caption: `${year} · 深蓝击败卡斯帕罗夫`, lockRow: 3, lockCol: 4 });
    if (/Watson/.test(t)) return () => sceneJeopardy({ question: "Who is…?", answer: "Watson", caption: "危险边缘" });
    if (/AlexNet/.test(t)) return () => sceneAlexNet({ caption: `${year} · ImageNet 特征层` });
    if (/GAN|对抗/.test(t)) return () => sceneGan({});
    if (/AlphaGo/.test(t)) return () => sceneGo({ caption: `${year} · AlphaGo 落子` });
    if (/^Transformer$/.test(t) || (t === "Transformer")) return () => sceneTransformer({ caption: `${year} · Attention` });
    if (/BERT/.test(t)) return () => sceneMask({ words: ["The", "[MASK]", "cat"], reveal: "black", caption: "掩码语言模型" });
    if (/GPT-2/.test(t)) return () => sceneScale({ scales: [0.15, 0.35, 0.55, 0.85], caption: `${year} · GPT-2 规模` });
    if (/GPT-3/.test(t)) return () => sceneScale({ scales: [0.2, 0.4, 0.65, 1], caption: `${year} · GPT-3 / API` });
    if (/DALL/.test(t)) return () => sceneFrameFill({ prompt: "an astronaut riding a horse", caption: "文生图" });
    if (/AlphaFold/.test(t)) return () => sceneFold({ caption: `${year} · 蛋白质折叠` });
    if (/Codex|Copilot/.test(t)) return () => sceneCode({ prompt: "写一个 HTTP 客户端", code: ["async def get(url):", "  return await fetch(url)"] });
    if (/Midjourney/.test(t)) return () => sceneFrameFill({
      prompt: "ethereal landscape —v 4",
      shapes: [
        { type: "circle", cx: 280, cy: 220, r: 36 },
        { type: "rect", x: 320, y: 200, w: 100, h: 70 },
        { type: "line", x1: 200, y1: 300, x2: 400, y2: 180 },
        { type: "rect", x: 210, y: 250, w: 60, h: 60 },
      ],
    });
    if (/Stable Diffusion/.test(t)) return () => sceneFrameFill({
      prompt: "open weights · local GPU",
      shapes: [
        { type: "rect", x: 210, y: 190, w: 90, h: 90 },
        { type: "circle", cx: 360, cy: 230, r: 40 },
        { type: "rect", x: 300, y: 270, w: 130, h: 35 },
      ],
    });
    if (/ChatGPT/.test(t)) return () => sceneChat({ prompt: "你：用一句话解释重力", reply: "助手：质量弯曲时空……", caption: "ChatGPT" });
    if (/^LLaMA$/.test(t) || t === "LLaMA") return () => sceneOpenWeight({ caption: `${year} · LLaMA 研究权重` });
    if (/Llama 2/.test(t)) return () => sceneOpenWeight({ caption: `${year} · Llama 2 可商用` });
    if (/Llama 3/.test(t)) return () => sceneOpenWeight({ caption: `${year} · Llama 3.1 405B` });
    if (/Llama 4/.test(t)) return () => sceneOpenWeight({ caption: `${year} · Llama 4 多模态` });
    if (/GPT-4o/.test(t)) return () => sceneVoice({ caption: `${year} · 实时语音与视觉` });
    if (/GPT-4(?!o)/.test(t)) return () => sceneMultimodal({ second: "图像", caption: `${year} · GPT-4` });
    if (/Claude 3\.5 Sonnet/.test(t)) return () => sceneCode({ prompt: "重构这段异步代码", code: ["async function run(job) {", "  await queue.push(job)", "}"] });
    if (/Claude 首次|Claude 首次公开发布/.test(t)) return () => sceneChat({ prompt: "你：保持安全地回答", reply: "Claude：我可以……", caption: "Claude" });
    if (/Gemini 1/.test(t)) return () => sceneMultimodal({ second: "代码", caption: `${year} · Gemini 1.0` });
    if (/Gemini 3\.8/.test(t)) return () => sceneCode({ prompt: "高速推理工作马", code: ["flash.infer(task)", "defense.mode()"] });
    if (/Gemini 3/.test(t)) return () => sceneMultimodal({ second: "多模态", caption: `${year} · Gemini 3` });
    if (/o1-preview/.test(t)) return () => sceneReasonChain({ steps: ["读题", "拆解", "推理", "作答"], answer: "长链推理", caption: "o1" });
    if (/DeepSeek-R1/.test(t)) return () => sceneReasonChain({ steps: ["采样", "强化", "蒸馏", "输出"], answer: "开源推理", caption: "DeepSeek-R1" });
    if (/o3|o4-mini/.test(t)) return () => sceneReasonChain({ steps: ["计划", "调工具", "编码", "验证"], answer: "工具增强推理" });
    if (/Claude 3\.7/.test(t)) return () => sceneLayers({ layers: ["瞬时回答", "延长思考"], caption: "混合推理" });
    if (/Sora 2/.test(t)) return () => sceneFilm({ caption: `${year} · Sora 2` });
    if (/Sora/.test(t)) return () => sceneFilm({ caption: `${year} · Sora` });
    if (/Opus 4\.5|Sonnet 4\.5|Opus 4 \/|Sonnet 4/.test(t) || /Claude Opus 4/.test(t) || /Claude Sonnet 4/.test(t))
      return () => sceneAgent({ caption: `${year} · 编码与智能体` });
    if (/Opus 5/.test(t)) return () => sceneLayers({ layers: ["编码", "智能体", "科学"], caption: `${year} · Claude Opus 5` });
    if (/Sonnet 5\.5/.test(t)) return () => sceneCode({ prompt: "修 bug · 写幻灯片", code: ["patch(file)", "slides.render()"] });
    if (/GPT-5\.6/.test(t)) return () => sceneLayers({ layers: ["Sol", "Terra", "Luna"], caption: "分层旗舰" });
    if (/GPT-5\.5/.test(t)) return () => sceneAgent({ caption: `${year} · 计算机使用` });
    if (/GPT-5\.2/.test(t)) return () => sceneLayers({ layers: ["知识工作", "长上下文", "智能体"], caption: "GPT-5.2" });
    if (/GPT-5(?![\.\d])/.test(t) || t === "GPT-5") return () => sceneLayers({ layers: ["快速", "深度推理", "路由"], caption: "GPT-5 统一" });
    if (/GPT-6|Astra/.test(t)) return () => sceneAgi({ word: "Astra", caption: `${year} · 代际叙事` });
    if (/Claude/.test(t) && tags.includes("编码")) return () => sceneCode({ prompt: evt.title, code: ["agent.run()", "terminal.exec()"] });
    if (tags.includes("视频")) return () => sceneFilm({ caption: `${year} · ${t}` });
    if (tags.includes("推理")) return () => sceneReasonChain({ steps: ["想", "算", "查", "答"], answer: year, caption: t });
    if (tags.includes("开源")) return () => sceneOpenWeight({ caption: `${year} · ${t}` });
    if (tags.includes("对话")) return () => sceneChat({ caption: t });
    if (tags.includes("图像") || tags.includes("生成")) return () => sceneFrameFill({ prompt: t, caption: year });
    if (era.includes("2026") || era.includes("2025")) return () => sceneLayers({ layers: [year, era, t.slice(0, 10)], caption: t });
    // fallback still story-like: title letters
    return () => sceneTypeSet({ word: year, caption: t });
  }


  function clipBlurb(s, n) {
    const t = String(s || "").trim();
    if (t.length <= n) return t;
    return t.slice(0, n - 1) + "…";
  }

  /**
   * Normalize any scene to {svg, apply(p, signed)}.
   * Legacy play()-only scenes are baked once, then wrapped with geometric scrub motion.
   */
  function toScrollScene(scene) {
    if (!scene) return null;
    if (typeof scene.apply === "function") {
      forceOpaque(scene.svg);
      return scene;
    }
    if (typeof scene.play === "function") {
      scene.play(true);
    }
    forceOpaque(scene.svg);
    const parts = wrapMotionParts(scene.svg);
    return { svg: scene.svg, apply: genericApply(parts) };
  }

  /** Build one scrub-driven panel (no clock-based play). */
  function buildStill(evt) {
    const wrap = document.createElement("div");
    wrap.className = "story-panel";
    wrap.setAttribute("aria-hidden", "true");
    const scene = toScrollScene(matchStory(evt)());
    scene.svg.setAttribute("viewBox", "30 70 580 340");
    scene.svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    wrap.appendChild(scene.svg);
    wrap.__apply = scene.apply;
    scene.apply(0, 1); /* approach pose until focusStrip runs */

    const plate = document.createElement("div");
    plate.className = "story-plate";
    const title = document.createElement("p");
    title.className = "story-plate-title";
    title.textContent = evt.title || "";
    const blurb = document.createElement("p");
    blurb.className = "story-plate-blurb";
    blurb.textContent = clipBlurb(evt.blurb, 72);
    plate.append(title, blurb);
    wrap.appendChild(plate);
    wrap.__plate = plate;
    return wrap;
  }

  function panelHalfWidth(i, n, xOfIndex) {
    const x = xOfIndex(i);
    const xPrev = i > 0 ? xOfIndex(i - 1) : x - 900;
    const xNext = i < n - 1 ? xOfIndex(i + 1) : x + 900;
    const gapBased = (xNext - xPrev) / 2 - 8;
    return Math.min(560, Math.max(400, gapBased));
  }

  function mountStrip(strip, events, xOfIndex) {
    if (!strip) return;
    strip.textContent = "";
    strip.className = "story-strip";
    const n = events.length;
    events.forEach((evt, i) => {
      const panel = buildStill(evt);
      panel.dataset.index = String(i);
      const half = panelHalfWidth(i, n, xOfIndex);
      panel.style.left = `${xOfIndex(i)}px`;
      panel.style.width = `${half * 2}px`;
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

  /**
   * Bind every panel's parts to scroll: progress = 1 at viewport center.
   * Scrubbing back reverses transforms exactly. No CSS keyframe clocks.
   */
  function focusStrip(strip, xOfIndex, centerX, reduceMotion) {
    if (!strip) return;
    const panels = [...strip.querySelectorAll(".story-panel")];
    const reach = 820;
    panels.forEach((panel) => {
      const i = Number(panel.dataset.index);
      const x = xOfIndex(i);
      const delta = x - centerX;
      const signed = delta / reach;
      let p = reduceMotion ? 1 : clamp01(1 - Math.abs(signed));
      if (typeof panel.__apply === "function") {
        panel.__apply(p, signed);
      }
      /* Plate rides up as the scene resolves — still scroll-bound. */
      if (panel.__plate) {
        const lift = (1 - p) * 28;
        panel.__plate.style.transform = `translateY(${lift.toFixed(1)}px)`;
      }
      /* Keep near panels readable; far ones tuck back — not the primary motion. */
      panel.style.opacity = String(0.12 + p * p * 0.88);
      panel.style.zIndex = String(1 + Math.round(p * 40));
    });
  }

  window.__HUMANITY_STORY__ = { buildStill, mountStrip, layoutStrip, focusStrip, matchStory, toScrollScene };
})();
