/* The writing canvas. Checks each stroke against the pack's reference stroke
   paths as it is drawn: order, direction and shape, with no handwriting
   recognition model. Works for any script whose pack has stroke paths.

   Modes, from the trace → hint → recall scaffold:
     watch   animated stroke order with numbered strokes
     trace   faint full character under the ink
     guided  only the start dot of the next stroke
     recall  blank box
     free    no snapping: the learner's own ink is kept
*/
"use strict";
window.LS = window.LS || {};

LS.Writing = (function () {
  const NS = "http://www.w3.org/2000/svg";
  const N = 24;                 // points each stroke is resampled to
  const MAX_MISSES = 3;         // misses on one stroke before it is shown

  const el = (tag, attrs = {}, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

  function resample(pts, n = N) {
    if (pts.length === 1) return Array(n).fill(pts[0]);
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i]));
    const total = cum[cum.length - 1] || 1, out = [];
    let j = 0;
    for (let k = 0; k < n; k++) {
      const t = (total * k) / (n - 1);
      while (j < cum.length - 2 && cum[j + 1] < t) j++;
      const seg = cum[j + 1] - cum[j] || 1, f = Math.min(1, (t - cum[j]) / seg);
      out.push([pts[j][0] + (pts[j + 1][0] - pts[j][0]) * f, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * f]);
    }
    return out;
  }
  const lengthOf = pts => pts.reduce((s, p, i) => i ? s + dist(pts[i - 1], p) : 0, 0);

  /* Reference points come from the browser's own path geometry. */
  function sampleRefs(svg, strokes) {
    const g = el("g", { visibility: "hidden" }, svg);
    const refs = strokes.map(d => {
      const p = el("path", { d }, g), L = p.getTotalLength();
      const pts = [];
      for (let k = 0; k < N; k++) { const q = p.getPointAtLength((L * k) / (N - 1)); pts.push([q.x, q.y]); }
      return { d, len: L, pts };
    });
    g.remove();
    return refs;
  }

  /* Pass if the start, end and average distance are all within tolerance.
     Comparing point by point also checks direction: a stroke drawn
     backwards starts at the far end and fails. */
  function matches(drawn, ref, tol) {
    const d = resample(drawn);
    const start = dist(d[0], ref.pts[0]), end = dist(d[N - 1], ref.pts[N - 1]);
    if (ref.len < 12) {                                   // a dot or a tick
      return start < tol * 1.8 && lengthOf(drawn) < ref.len + 30;
    }
    let mean = 0;
    for (let i = 0; i < N; i++) mean += dist(d[i], ref.pts[i]);
    mean /= N;
    return mean < tol && start < tol * 1.7 && end < tol * 1.7;
  }

  function frame(container, label) {
    container.innerHTML = "";
    const svg = el("svg", { viewBox: "0 0 109 109", class: "w-svg", role: "img", "aria-label": label }, container);
    const grid = el("g", { class: "w-grid" }, svg);
    el("rect", { x: 1, y: 1, width: 107, height: 107, rx: 3 }, grid);
    el("line", { x1: 54.5, y1: 1, x2: 54.5, y2: 108 }, grid);
    el("line", { x1: 1, y1: 54.5, x2: 108, y2: 54.5 }, grid);
    return svg;
  }

  /* ---------- watch ---------- */
  function watch(container, item, { reduceMotion = false } = {}) {
    const svg = frame(container, `Stroke order for ${item.form}: ${item.strokes.length} strokes`);
    const refs = sampleRefs(svg, item.strokes);
    const ink = el("g", { class: "w-model" }, svg), nums = el("g", { class: "w-nums" }, svg);
    let timers = [];
    function play() {
      timers.forEach(clearTimeout); timers = [];
      ink.innerHTML = ""; nums.innerHTML = "";
      refs.forEach((r, i) => {
        const p = el("path", { d: r.d }, ink);
        const t = el("text", { x: r.pts[0][0] - 6, y: r.pts[0][1] - 3 }, nums);
        t.textContent = i + 1;
        if (reduceMotion) return;
        p.style.strokeDasharray = r.len; p.style.strokeDashoffset = r.len;
        t.style.opacity = 0;
        timers.push(setTimeout(() => {
          p.style.transition = `stroke-dashoffset ${Math.max(350, r.len * 9)}ms linear`;
          p.style.strokeDashoffset = 0; t.style.opacity = 1;
        }, 150 + i * 750));
      });
    }
    play();
    return { replay: play, destroy() { timers.forEach(clearTimeout); container.innerHTML = ""; } };
  }

  /* ---------- draw ---------- */
  function draw(container, item, opts = {}) {
    const { mode = "trace", onDone = () => {}, announce = () => {} } = opts;
    const total = item.strokes.length;
    const svg = frame(container, "");
    const refs = sampleRefs(svg, item.strokes);
    const ghost = el("g", { class: "w-ghost" }, svg);
    const done = el("g", { class: "w-done" }, svg);
    const flash = el("g", { class: "w-flash" }, svg);
    const hintG = el("g", { class: "w-hint" }, svg);
    const ink = el("polyline", { class: "w-ink", points: "" }, svg);
    if (mode === "trace") refs.forEach(r => el("path", { d: r.d }, ghost));

    let idx = 0, pts = null, pointerType = "mouse";
    const score = { misses: 0, hints: 0, reveals: 0 };
    let strokeMisses = 0, finished = false;

    function label() {
      const what = finished ? "complete" : `stroke ${idx + 1} of ${total}`;
      svg.setAttribute("aria-label", `Writing area for ${item.form}, ${mode} mode, ${what}. ` +
        "Draw with a finger, mouse or stylus. To answer without drawing, use Choose strokes instead.");
    }
    function showGuide() {
      hintG.innerHTML = "";
      if (finished || mode !== "guided") return;
      const p = refs[idx].pts[0];
      el("circle", { cx: p[0], cy: p[1], r: 3.2, class: "w-start" }, hintG);
    }
    function accept(i, rawPts) {
      if (mode === "free" && rawPts) el("polyline", { points: rawPts.map(p => p.join(",")).join(" "), class: "w-raw" }, done);
      else el("path", { d: refs[i].d }, done);
    }
    function flashStroke(i, cls, ms = 900) {
      const p = el("path", { d: refs[i].d, class: cls }, flash);
      setTimeout(() => p.remove(), ms);
    }
    function advance() {
      idx++; strokeMisses = 0;
      if (idx >= total) {
        finished = true;
        hintG.innerHTML = "";
        label();
        onDone(Object.assign({}, score));
      } else { showGuide(); label(); }
    }
    function tol() {
      let t = 11;
      if (pointerType === "touch") t += 4;           // fingers are wider than pens
      if (mode === "trace") t += 2;
      return t;
    }
    function judge(drawn) {
      if (finished) return;
      if (matches(drawn, refs[idx], tol())) {
        accept(idx, drawn);
        announce(`Stroke ${idx + 1}: good.`);
        advance();
        return;
      }
      score.misses++; strokeMisses++;
      let later = -1;
      for (let j = idx + 1; j < total; j++) if (matches(drawn, refs[j], tol())) { later = j; break; }
      if (strokeMisses >= MAX_MISSES) {
        score.reveals++;
        flashStroke(idx, "w-reveal", 1200);
        accept(idx);
        announce(`Here is stroke ${idx + 1}. It has been drawn in for you.`);
        advance();
      } else if (later >= 0) {
        flashStroke(idx, "w-right");
        announce(`That is stroke ${later + 1}; stroke ${idx + 1} comes first. Wrong order.`);
      } else {
        flashStroke(idx, "w-right");
        announce(`Not quite. Stroke ${idx + 1} is shown; try again.`);
      }
    }

    function toSvg(e) {
      const m = svg.getScreenCTM().inverse();
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m);
      return [p.x, p.y];
    }
    svg.addEventListener("pointerdown", e => {
      if (finished || e.button > 0) return;
      e.preventDefault();
      pointerType = e.pointerType;
      svg.setPointerCapture(e.pointerId);
      pts = [toSvg(e)];
      ink.setAttribute("points", pts[0].join(","));
    });
    svg.addEventListener("pointermove", e => {
      if (!pts) return;
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ev of evs.length ? evs : [e]) pts.push(toSvg(ev));
      ink.setAttribute("points", pts.map(p => p.join(",")).join(" "));
    });
    const end = () => {
      if (!pts) return;
      const drawn = pts; pts = null;
      ink.setAttribute("points", "");
      judge(drawn);
    };
    svg.addEventListener("pointerup", end);
    svg.addEventListener("pointercancel", () => { pts = null; ink.setAttribute("points", ""); });

    label(); showGuide();

    return {
      get score() { return score; },
      get finished() { return finished; },
      hint() {
        if (finished) return;
        score.hints++;
        flashStroke(idx, "w-right", 1400);
        announce(`Hint: stroke ${idx + 1} is shown.`);
      },
      destroy() { container.innerHTML = ""; },
    };
  }

  /* ---------- choose: the no-drawing alternative ----------
     For learners who cannot draw. Pick the next stroke from three options;
     graded exactly like drawing, so motor ability never blocks progress. */
  function choose(container, item, opts = {}) {
    const { onDone = () => {}, announce = () => {}, otherStrokes = [] } = opts;
    const total = item.strokes.length;
    let idx = 0, strokeMisses = 0;
    const score = { misses: 0, hints: 0, reveals: 0 };
    container.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "w-choose";
    container.appendChild(wrap);

    function mini(parent, doneStrokes, cand) {
      const svg = el("svg", { viewBox: "0 0 109 109", class: "w-svg w-mini", "aria-hidden": "true" }, parent);
      const g = el("g", { class: "w-done" }, svg);
      doneStrokes.forEach(d => el("path", { d }, g));
      if (cand) el("path", { d: cand, class: "w-cand" }, svg);
      return svg;
    }
    function render() {
      wrap.innerHTML = "";
      const have = item.strokes.slice(0, idx);
      const big = document.createElement("div");
      big.className = "w-choose-sofar";
      mini(big, have).setAttribute("aria-hidden", "true");
      const p = document.createElement("p");
      p.textContent = idx < total ? `Which is stroke ${idx + 1} of ${total}?` : "Complete.";
      p.id = "w-choose-q";
      wrap.append(big, p);
      if (idx >= total) return;
      // Distractors: a later stroke of this character (an order mistake),
      // then strokes from other characters.
      const pool = item.strokes.slice(idx + 1).concat(LS.Engine.shuffle(otherStrokes));
      const opts3 = LS.Engine.shuffle([item.strokes[idx]].concat(LS.Engine.shuffle(pool.slice(0, 4)).slice(0, 2)));
      const row = document.createElement("div");
      row.className = "w-choose-row"; row.setAttribute("role", "group"); row.setAttribute("aria-labelledby", "w-choose-q");
      opts3.forEach((d, k) => {
        const b = document.createElement("button");
        b.type = "button"; b.className = "w-opt";
        b.setAttribute("aria-label", `Option ${k + 1}`);
        mini(b, have, d);
        const n = document.createElement("span"); n.textContent = k + 1; b.appendChild(n);
        b.addEventListener("click", () => pick(d, b));
        row.appendChild(b);
      });
      wrap.appendChild(row);
      row.querySelector("button").focus();
    }
    function pick(d, btn) {
      if (d === item.strokes[idx]) {
        announce(`Correct, stroke ${idx + 1}.`);
        idx++; strokeMisses = 0;
        render();
        if (idx >= total) onDone(Object.assign({}, score));
        return;
      }
      score.misses++; strokeMisses++;
      btn.disabled = true;
      if (strokeMisses >= MAX_MISSES - 1) {
        score.reveals++;
        announce(`The answer was the remaining option. Moving on.`);
        idx++; strokeMisses = 0;
        render();
        if (idx >= total) onDone(Object.assign({}, score));
      } else announce("Not that one. Try again.");
    }
    render();
    return {
      get score() { return score; },
      hint() {},
      destroy() { container.innerHTML = ""; },
      keypick(k) { const b = wrap.querySelectorAll(".w-opt")[k]; if (b && !b.disabled) b.click(); },
    };
  }

  return { watch, draw, choose };
})();
