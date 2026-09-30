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

  /** Run a timeline of {at, run} steps. Returns cancel fn. */
  function runTimeline(steps, duration, reduceMotion, onDone) {
    if (reduceMotion) {
      steps.forEach((s) => s.run(1));
      onDone && onDone();
      return () => {};
    }
    let raf = 0;
    let dead = false;
    const t0 = performance.now();
    const tick = (now) => {
      if (dead) return;
      const u = Math.min(1, (now - t0) / duration);
      steps.forEach((s) => {
        const local = Math.max(0, Math.min(1, (u - s.at) / (s.dur || 0.001)));
        if (u >= s.at) s.run(s.ease ? s.ease(local) : local);
      });
      if (u < 1) raf = requestAnimationFrame(tick);
      else onDone && onDone();
    };
    raf = requestAnimationFrame(tick);
    return () => {
      dead = true;
      cancelAnimationFrame(raf);
    };
  }

  function setOpacity(node, v) {
    node.setAttribute("opacity", String(v));
  }

  function setTransform(node, t) {
    node.setAttribute("transform", t);
  }

  /* ——— Scene builders: each returns {svg, play(reduceMotion)->cancel} ——— */

  function sceneEniac(props) {
    const floor = el("line", { x1: 70, y1: 400, x2: 580, y2: 400, stroke: "#1d4e89", "stroke-width": 1.5, opacity: 0 });
    const wall = el("line", { x1: 70, y1: 110, x2: 70, y2: 400, stroke: "#d5deea", "stroke-width": 1.5, opacity: 0 });
    const racks = [];
    const panels = [];
    for (let i = 0; i < 6; i++) {
      const x = 90 + i * 82;
      racks.push(el("rect", {
        x, y: 130, width: 68, height: 250,
        fill: "#e8eef6", stroke: "#1d4e89", "stroke-width": 2, opacity: 0
      }));
      for (let row = 0; row < 6; row++) {
        panels.push(el("rect", {
          x: x + 10, y: 148 + row * 36, width: 48, height: 22,
          fill: "none", stroke: "#2f6fed", "stroke-width": 1.4, opacity: 0
        }));
      }
    }
    const pulse = el("text", {
      x: 320, y: 118, "text-anchor": "middle", fill: "#1d4e89",
      "font-family": "Noto Sans SC, sans-serif", "font-size": 20, "letter-spacing": "0.28em", opacity: 0
    }, ["机房 · 百平柜机"]);
    const mark = el("g", { class: "st-mark", opacity: 0 }, [
      el("rect", { x: 250, y: 220, width: 140, height: 64, fill: "#f4f7fb", stroke: "#2f6fed", "stroke-width": 2.2 }),
      el("text", {
        x: 320, y: 262, "text-anchor": "middle", fill: "#102033",
        "font-family": "Instrument Serif, serif", "font-size": 34
      }, ["CALC"]),
    ]);
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [
      wall, floor, pulse, ...racks, ...panels, mark
    ]);
    return {
      svg,
      play(rm) {
        return runTimeline([
          { at: 0, dur: 0.25, run: (t) => { setOpacity(floor, t * 0.7); setOpacity(wall, t * 0.8); setOpacity(pulse, t); } },
          { at: 0.1, dur: 0.45, ease: easeOut, run: (t) => racks.forEach((r, i) => setOpacity(r, Math.min(1, Math.max(0, (t - i * 0.05) * 1.4)))) },
          { at: 0.3, dur: 0.35, run: (t) => panels.forEach((p, i) => setOpacity(p, t * (0.4 + (i % 3) * 0.2))) },
          { at: 0.55, dur: 0.4, ease: easeOut, run: (t) => {
            setOpacity(mark, t);
            racks.forEach((r) => setOpacity(r, 1));
            panels.forEach((p) => setOpacity(p, 0.55 + t * 0.25));
            setOpacity(pulse, 1);
          }},
        ], 2000, rm);
      },
    };
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
    const boxes = tokens.map((tok, i) => {
      const x = 40 + i * 118;
      return {
        g: el("g", { opacity: 0 }, [
          el("rect", { x, y: 210, width: 108, height: 48, fill: "#e8eef6", stroke: "#1d4e89", "stroke-width": 2 }),
          el("text", { x: x + 54, y: 240, "text-anchor": "middle", fill: "#102033",
            "font-family": "Noto Sans SC, sans-serif", "font-size": 15, "font-weight": "500" }, [tok]),
        ]),
        x: x + 54,
      };
    });
    const lines = [];
    // attention from middle token to others with different weights
    const src = 2;
    boxes.forEach((b, i) => {
      if (i === src) return;
      const w = i === 1 || i === 3 ? 2.2 : 0.8;
      lines.push(el("line", {
        x1: boxes[src].x, y1: 210, x2: boxes[src].x, y2: 210,
        stroke: "#2f6fed", "stroke-width": w + 0.6, opacity: 0,
        "data-tx": b.x, "data-ty": 210
      }));
    });
    const title = el("text", {
      x: 320, y: 150, "text-anchor": "middle", fill: "#1d4e89",
      "font-family": "Noto Sans SC, sans-serif", "font-size": 18, "letter-spacing": "0.22em", opacity: 0
    }, [props.caption || "自注意力"]);
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [
      title, ...lines, ...boxes.map((b) => b.g)
    ]);
    return {
      svg,
      play(rm) {
        return runTimeline([
          { at: 0, dur: 0.2, run: (t) => setOpacity(title, t) },
          ...boxes.map((b, i) => ({
            at: 0.1 + i * 0.08, dur: 0.2, ease: easeOut,
            run: (t) => setOpacity(b.g, t)
          })),
          { at: 0.55, dur: 0.4, ease: easeOut, run: (t) => {
            lines.forEach((ln) => {
              setOpacity(ln, t * 0.85);
              ln.setAttribute("x2", String(boxes[src].x + (Number(ln.getAttribute("data-tx")) - boxes[src].x) * t));
              ln.setAttribute("y2", String(210 - 55 * t));
            });
          }},
        ], 2000, rm);
      },
    };
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
    const nodes = steps.map((s, i) =>
      el("g", { opacity: 0 }, [
        el("circle", { cx: 100 + i * 145, cy: 195, r: 36, fill: "#e8eef6", stroke: "#1d4e89", "stroke-width": 2.4 }),
        el("text", { x: 100 + i * 145, y: 202, "text-anchor": "middle", fill: "#102033", "font-size": 17,
          "font-family": "Noto Sans SC, sans-serif" }, [s]),
      ])
    );
    const links = [];
    for (let i = 0; i < steps.length - 1; i++) {
      links.push(el("line", {
        x1: 136 + i * 145, y1: 195, x2: 136 + i * 145, y2: 195,
        stroke: "#2f6fed", "stroke-width": 2.4, opacity: 0, "data-x2": 64 + (i + 1) * 145
      }));
    }
    const answer = el("g", { opacity: 0 }, [
      el("rect", { x: 150, y: 270, width: 340, height: 70, fill: "#e8eef6", stroke: "#2f6fed", "stroke-width": 2.4 }),
      el("text", { x: 320, y: 315, "text-anchor": "middle", fill: "#102033", "font-size": 24,
        "font-family": "Noto Serif SC, serif" }, [props.answer || "答案"]),
    ]);
    const svg = el("svg", { viewBox: "0 0 640 480", class: "story-svg" }, [...links, ...nodes, answer]);
    return {
      svg,
      play(rm) {
        return runTimeline([
          ...nodes.map((n, i) => ({ at: 0.05 + i * 0.12, dur: 0.2, run: (t) => setOpacity(n, t) })),
          ...links.map((ln, i) => ({
            at: 0.15 + i * 0.12, dur: 0.2, ease: easeOut,
            run: (t) => {
              setOpacity(ln, t);
              ln.setAttribute("x2", String(136 + i * 145 + (Number(ln.getAttribute("data-x2")) - (136 + i * 145)) * t));
            }
          })),
          { at: 0.65, dur: 0.3, ease: easeOut, run: (t) => {
            nodes.forEach((n) => setOpacity(n, 1));
            links.forEach((ln) => setOpacity(ln, 1));
            setOpacity(answer, t);
            setTransform(answer, `translate(0 ${(1 - t) * 12})`);
          }},
        ], 2200, rm);
      },
    };
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

  /** Build the final still frame for one event (no timed play). */
  function buildStill(evt) {
    const wrap = document.createElement("div");
    wrap.className = "story-panel";
    wrap.setAttribute("aria-hidden", "true");
    const scene = matchStory(evt)();
    /* Crop empty margins so the print fills the large panel. */
    scene.svg.setAttribute("viewBox", "30 70 580 340");
    scene.svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    wrap.appendChild(scene.svg);
    scene.play(true); /* jump to composed still — not a running timeline */

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
    return wrap;
  }

  /** Wide panels so art is readable; neighbors may peek under focus opacity. */
  function panelHalfWidth(i, n, xOfIndex) {
    const x = xOfIndex(i);
    const xPrev = i > 0 ? xOfIndex(i - 1) : x - 900;
    const xNext = i < n - 1 ? xOfIndex(i + 1) : x + 900;
    const gapBased = (xNext - xPrev) / 2 - 8;
    return Math.min(560, Math.max(400, gapBased));
  }

  /**
   * Mount a continuous strip inside the scrolling track.
   * Panel i is centered on xAt(i). scrollLeft → picture is 1:1.
   */
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

  /** Focus opacity from viewport center — deterministic for a given scrollLeft. */
  function focusStrip(strip, xOfIndex, centerX) {
    if (!strip) return;
    const panels = [...strip.querySelectorAll(".story-panel")];
    const reach = 900;
    panels.forEach((panel) => {
      const i = Number(panel.dataset.index);
      const x = xOfIndex(i);
      const d = Math.abs(x - centerX);
      const t = Math.max(0, 1 - d / reach);
      const op = 0.04 + t * t * 0.96;
      panel.style.opacity = String(op);
      panel.style.zIndex = String(1 + Math.round(t * 40));
    });
  }

  window.__HUMANITY_STORY__ = { buildStill, mountStrip, layoutStrip, focusStrip, matchStory };
})();
