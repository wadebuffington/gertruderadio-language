/* Decor: the cultural look of a language pack.

   The engine supplies one drawing primitive, a BRUSH: a centre line and a
   width profile become a filled, tapered stroke, the way an ink brush
   swells and lifts. A pack's culture file draws its motifs with it, and
   says where each motif sits on each screen. Everything is drawn as faint
   watermarks behind the content, in the pack's two watermark colours.

   No images, no network: every motif is a few lines of SVG made at load.
*/
"use strict";
window.LS = window.LS || {};

LS.Decor = (function () {
  const f = n => Math.round(n * 10) / 10;

  /* Catmull-Rom through the control points: a smooth line that passes
     through every point it is given, which is how a brush path is drawn. */
  function spline(pts, per = 14) {
    if (pts.length < 3) return pts.slice();
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      for (let k = 0; k < per; k++) {
        const t = k / per, t2 = t * t, t3 = t2 * t;
        out.push([0, 1].map(j => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t +
          (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  /* One brush stroke. `widths` gives the width at each control point and is
     interpolated between them; 0 is a lifted brush. */
  function brush(ctrl, widths, per = 14) {
    const pts = spline(ctrl, per), n = pts.length, L = [], R = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      let dx = b[0] - a[0], dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
      const u = (i / (n - 1)) * (widths.length - 1), k = Math.min(widths.length - 2, Math.floor(u));
      const w = (widths[k] + (widths[k + 1] - widths[k]) * (u - k)) / 2;
      L.push([pts[i][0] - dy * w, pts[i][1] + dx * w]);
      R.push([pts[i][0] + dy * w, pts[i][1] - dx * w]);
    }
    const ring = L.concat(R.reverse());
    return "M" + ring.map(p => f(p[0]) + "," + f(p[1])).join("L") + "Z";
  }

  /* An ensō: one breath, one circle. Heavy where the brush lands, dry and
     thin where it lifts, with the gap left open. */
  function enso(cx, cy, r, { from = 200, sweep = 320, heavy = 16, light = 3 } = {}) {
    const ctrl = [], widths = [], steps = 18;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, a = ((from + sweep * t) * Math.PI) / 180;
      const rr = r * (1 + 0.025 * Math.sin(t * 9));
      ctrl.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
      widths.push(i === 0 ? heavy * 0.7 : light + (heavy - light) * Math.pow(1 - t, 0.8));
    }
    widths[widths.length - 1] = 0;
    return brush(ctrl, widths, 8);
  }

  /* Points along an SVG path, so stroke data (like KanjiVG's) can be
     re-inked with the brush. Needs the DOM for the path geometry. */
  let probe = null;
  function pathPoints(d, n = 8) {
    if (!probe) {
      probe = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      probe.setAttribute("style", "position:absolute;width:0;height:0;visibility:hidden");
      document.documentElement.appendChild(probe);
    }
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", d); probe.appendChild(p);
    const L = p.getTotalLength(), out = [];
    for (let i = 0; i < n; i++) { const q = p.getPointAtLength((L * i) / (n - 1)); out.push([q.x, q.y]); }
    p.remove();
    return out;
  }

  const P = (d, cls) => `<path d="${d}"${cls ? ` class="${cls}"` : ""}/>`;
  const api = { brush, spline, enso, pathPoints, path: P };

  /* ---------- placing motifs ---------- */
  const cache = {};
  function motifSvg(culture, name) {
    if (!cache[name]) {
      const m = culture.motifs[name];
      const body = typeof m.draw === "function" ? m.draw(api) : m.draw;
      cache[name] = `<svg viewBox="${m.viewBox}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">${body}</svg>`;
    }
    return cache[name];
  }

  function place(layer, culture, spec) {
    const el = document.createElement("div");
    el.className = "motif motif-" + spec.motif + " tone-" + (spec.tone || "blue");
    const s = el.style;
    for (const k of ["top", "right", "bottom", "left", "width"]) if (spec[k] != null) s[k] = spec[k];
    const tf = [];
    if (spec.rotate) tf.push(`rotate(${spec.rotate}deg)`);
    if (spec.flip) tf.push("scaleX(-1)");
    if (tf.length) s.transform = tf.join(" ");
    if (spec.opacity) s.setProperty("--motif-o", spec.opacity);
    el.innerHTML = motifSvg(culture, spec.motif);
    layer.appendChild(el);
  }

  let desk = null;
  function apply(pack, route) {
    const c = pack.culture;
    const root = document.documentElement;
    root.dataset.lang = pack.id;
    const sheetLayer = document.querySelector(".decor-sheet");
    if (!desk) {
      desk = document.createElement("div");
      desk.className = "decor-desk";
      desk.setAttribute("aria-hidden", "true");
      document.getElementById("main").prepend(desk);   // inside the desk, under the page
    }
    desk.replaceChildren(); sheetLayer.replaceChildren();
    if (!c) return;
    root.style.setProperty("--motif-green", c.palette.green);
    root.style.setProperty("--motif-blue", c.palette.blue);
    if (c.palette.seal) root.style.setProperty("--seal", c.palette.seal);
    if (c.rule && !c._rule) {
      c._rule = `url("data:image/svg+xml,${encodeURIComponent(motifSvg(c, c.rule).replace("<svg ", '<svg preserveAspectRatio="none" fill="#000" '))}")`;
    }
    if (c._rule) root.style.setProperty("--brush-rule", c._rule);
    const scene = c.scenes[route] || c.scenes.home;
    (scene.sheet || []).forEach(s => place(sheetLayer, c, s));
    (scene.desk || []).forEach(s => place(desk, c, s));
  }

  return Object.assign(api, { apply });
})();
