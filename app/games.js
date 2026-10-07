/* Games. Every round draws from the learner's own items and reports each
   answer back to the scheduler, so playing is studying. Nothing here is
   language-specific: prompts are item.form, answers are item.reading or
   item.meanings. */
"use strict";
window.LS = window.LS || {};

LS.Games = (function () {
  const E = () => LS.Engine;
  const h = (tag, attrs = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const k in attrs) {
      if (k === "class") e.className = attrs[k];
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== false && attrs[k] != null) e.setAttribute(k, attrs[k]);
    }
    for (const c of kids) if (c != null) e.append(c);
    return e;
  };
  // Items with a meaning are answered by meaning; letters by their sound.
  const answerOf = it => it.meanings.length ? it.meanings[0] : it.reading;
  const cfg = id => E().pack.ui.games[id];

  /* ---------- Rain (Kana Rain in Japanese) ----------
     Characters fall; type or tap the reading before they land. Speeds up
     with each streak. Timer can be slowed or turned off in Settings. */
  function rain(root, { onExit }) {
    const st = E().state.settings, scale = st.timerScale;   // 0 = untimed
    const g = cfg("rain");
    const pool = E().gamePool(it => !g.itemType || it.type === g.itemType, 40);
    if (pool.length < 3) return notEnough(root, onExit, `${g.name} needs three learned ${g.unit}. Do a lesson first.`);

    const ROUND_MS = 90000 * (scale || 1), UNTIMED_ANSWERS = 20;
    let drops = [], score = 0, streak = 0, answered = 0, hits = 0;
    let running = false, paused = false, ended = false, last = 0, left = ROUND_MS, raf = 0, nextId = 0;

    const area = h("div", { class: "rain-area", "aria-hidden": "true" });
    const input = h("input", { class: "rain-input", type: "text", autocomplete: "off", autocapitalize: "off",
      spellcheck: "false", "aria-label": "Type the reading, then Enter", placeholder: "type the reading…" });
    const taps = h("div", { class: "rain-taps", role: "group", "aria-label": "Or tap the reading of the lowest character" });
    const hud = h("div", { class: "game-hud" });
    const pauseBtn = h("button", { type: "button", class: "btn", onclick: () => togglePause() }, "Pause");
    const now = h("p", { class: "sr-only", "aria-live": "polite" });
    root.replaceChildren(
      h("div", { class: "game-head" }, h("h2", {}, g.name), pauseBtn,
        h("button", { type: "button", class: "btn", onclick: () => finish(true) }, "End round")),
      hud, area, input, taps, now);

    const speed = () => (scale ? 1 / scale : 0) * Math.min(2.2, 1 + streak * 0.06); // area-heights per 7s
    const maxDrops = () => Math.min(3, 1 + Math.floor(streak / 6));

    function spawn() {
      const taken = new Set(drops.map(d => d.it.id));
      const choices = pool.filter(id => !taken.has(id));
      if (!choices.length) return;
      const it = E().item(choices[Math.floor(Math.random() * choices.length)]);
      const el = h("span", { class: "rain-drop", lang: E().pack.lang }, it.form);
      el.style.left = (8 + Math.random() * 76) + "%";
      area.appendChild(el);
      drops.push({ id: nextId++, it, el, y: 0, born: performance.now() });
      now.textContent = "Falling: " + it.form;
      renderTaps();
    }
    function lowest() { return drops.reduce((a, d) => (!a || d.y > a.y ? d : a), null); }
    function renderTaps() {
      const t = lowest();
      taps.replaceChildren();
      if (!t) return;
      const opts = E().shuffle([t.it.id].concat(E().shuffle(pool.filter(id => id !== t.it.id)).slice(0, 3)));
      opts.forEach(id => taps.appendChild(h("button", { type: "button", class: "btn tap",
        onclick: () => answer(answerOf(E().item(id)), t) }, answerOf(E().item(id)))));
    }
    function remove(d) { d.el.remove(); drops = drops.filter(x => x !== d); }

    function hit(d) {
      const ms = performance.now() - d.born;
      streak++; hits++; answered++;
      score += 10 + Math.min(20, streak);
      E().gradeAuto(E().cardId(d.it.id, "recognize"), true, { ms, src: "rain" });
      const r = d.el.getBoundingClientRect();
      LS.FX.burst(r.left + r.width / 2, r.top + r.height / 2);
      LS.FX.sfx("good");
      remove(d);
      now.textContent = `Yes, ${d.it.form} is ${answerOf(d.it)}.`;
    }
    function miss(d, why) {
      streak = 0; answered++;
      E().gradeAuto(E().cardId(d.it.id, "recognize"), false, { src: "rain" });
      LS.FX.sfx("bad"); LS.FX.shake(area);
      remove(d);
      now.textContent = `${why}: ${d.it.form} is ${answerOf(d.it)}.`;
      LS.UI.toast(`${d.it.form} = ${answerOf(d.it)}`, "miss");
    }
    function answer(val, target) {
      if (!running || paused) return;
      val = val.trim().toLowerCase();
      const d = drops.find(x => answerOf(x.it).toLowerCase() === val);
      if (d) hit(d); else miss(target || lowest(), "Not quite");
      input.value = "";
      after();
    }
    input.addEventListener("input", () => {
      const v = input.value.trim().toLowerCase();
      if (!v) return;
      // Answer as soon as it is unambiguous: "n" must wait in case it is "na".
      const exact = drops.find(x => answerOf(x.it).toLowerCase() === v);
      const longer = drops.some(x => answerOf(x.it).toLowerCase().startsWith(v) && answerOf(x.it).length > v.length);
      if (exact && !longer) answer(v);
    });
    input.addEventListener("keydown", e => {
      if (e.key === "Enter" && input.value.trim()) { e.preventDefault(); answer(input.value); }
      if (e.key === "Escape") { e.preventDefault(); togglePause(); }
    });

    function after() {
      if (!scale && answered >= UNTIMED_ANSWERS) return finish();
      while (drops.length < maxDrops()) spawn();
      renderTaps(); drawHud();
    }
    function drawHud() {
      const time = scale ? Math.ceil(left / 1000) + "s" : `${answered}/${UNTIMED_ANSWERS}`;
      hud.textContent = `Score ${score} · Streak ${streak} · ${time}`;
    }
    function tick(t) {
      if (!running) return;
      const dt = last ? Math.min(100, t - last) : 0; last = t;
      if (!paused) {
        if (scale) { left -= dt; if (left <= 0) return finish(); }
        const v = speed() / 7000;
        for (const d of drops.slice()) {
          d.y += v * dt;
          d.el.style.top = (d.y * 100) + "%";
          if (d.y >= 0.92) { miss(d, "Landed"); after(); }
        }
        drawHud();
      }
      raf = requestAnimationFrame(tick);
    }
    function togglePause() {
      if (!running) return;
      paused = !paused;
      pauseBtn.textContent = paused ? "Resume" : "Pause";
      area.classList.toggle("paused", paused);
      now.textContent = paused ? "Paused." : "Resumed.";
      if (!paused) { last = 0; input.focus(); }
    }
    function finish(early) {
      if (ended) return;
      ended = true; running = false;
      cancelAnimationFrame(raf);
      results(root, "rain", score, hits, answered, E().setBest("rain", score), onExit, () => rain(root, { onExit }));
    }

    running = true; after(); input.focus();
    raf = requestAnimationFrame(tick);
    return { destroy() { running = false; ended = true; cancelAnimationFrame(raf); } };
  }

  /* ---------- Match Pairs ----------
     A memory grid of character ↔ reading (or meaning). No time pressure:
     the clock only counts up, for a personal best. */
  function match(root, { onExit }) {
    const g = cfg("match");
    const pool = E().gamePool(() => true, 6);
    if (pool.length < 3) return notEnough(root, onExit, `${g.name} needs three learned items. Do a lesson first.`);
    const tiles = E().shuffle(pool.flatMap(id => [{ id, side: "form" }, { id, side: "answer" }]));
    const misses = {}, start = performance.now();
    let open = [], matched = 0, moves = 0, done = false, timer = 0;

    const live = h("p", { class: "sr-only", "aria-live": "polite" });
    const hud = h("div", { class: "game-hud" });
    const grid = h("div", { class: "match-grid", role: "group", "aria-label": "Cards" });
    root.replaceChildren(
      h("div", { class: "game-head" }, h("h2", {}, g.name),
        h("button", { type: "button", class: "btn", onclick: () => { stop(); onExit(); } }, "Leave")),
      hud, grid, live);

    const textOf = t => { const it = E().item(t.id); return t.side === "form" ? it.form : answerOf(it); };
    tiles.forEach((t, i) => {
      t.btn = h("button", { type: "button", class: "match-tile", "aria-label": `Card ${i + 1}, face down`,
        onclick: () => flip(t) }, h("span", {}, ""));
      if (t.side === "form") t.btn.firstChild.setAttribute("lang", E().pack.lang);
      grid.appendChild(t.btn);
    });

    function show(t, up) {
      t.btn.classList.toggle("up", up);
      t.btn.firstChild.textContent = up ? textOf(t) : "";
      t.btn.setAttribute("aria-label", up ? textOf(t) : `Card ${tiles.indexOf(t) + 1}, face down`);
    }
    function flip(t) {
      if (done || t.matched || open.includes(t) || open.length === 2) return;
      show(t, true); open.push(t);
      live.textContent = textOf(t);
      if (open.length < 2) return;
      moves++;
      const [a, b] = open;
      if (a.id === b.id) {
        a.matched = b.matched = true;
        a.btn.classList.add("matched"); b.btn.classList.add("matched");
        a.btn.disabled = b.btn.disabled = true;
        matched++; open = [];
        live.textContent = `Match: ${textOf(a)} and ${textOf(b)}.`;
        LS.FX.sfx("good");
        const r = b.btn.getBoundingClientRect(); LS.FX.burst(r.left + r.width / 2, r.top + r.height / 2);
        if (matched === pool.length) finish();
      } else {
        misses[a.id] = (misses[a.id] || 0) + 1; misses[b.id] = (misses[b.id] || 0) + 1;
        live.textContent = `No match: ${textOf(a)} and ${textOf(b)}.`;
        setTimeout(() => { show(a, false); show(b, false); open = []; }, 900);
      }
      drawHud();
    }
    function secs() { return Math.round((performance.now() - start) / 1000); }
    function drawHud() { hud.textContent = `Pairs ${matched}/${pool.length} · Moves ${moves} · ${secs()}s`; }
    function stop() { done = true; clearInterval(timer); }
    function finish() {
      stop();
      // An item counts as known if it was matched with at most one wrong flip.
      let right = 0;
      for (const id of pool) {
        const ok = (misses[id] || 0) <= 1;
        if (ok) right++;
        E().gradeAuto(E().cardId(id, "recognize"), ok, { src: "match" });
      }
      const score = Math.max(10, 300 - secs() * 2 - (moves - pool.length) * 10);
      setTimeout(() => results(root, "match", score, right, pool.length,
        E().setBest("match", score), onExit, () => match(root, { onExit })), 500);
    }
    timer = setInterval(drawHud, 1000); drawHud();
    grid.querySelector("button").focus();
    return { destroy: stop };
  }

  function notEnough(root, onExit, msg) {
    root.replaceChildren(h("p", {}, msg),
      h("button", { type: "button", class: "btn primary", onclick: onExit }, "Back"));
    root.querySelector("button").focus();
    return { destroy() {} };
  }

  function results(root, id, score, right, total, best, onExit, again) {
    LS.FX.sfx(best ? "best" : "done");
    root.replaceChildren(
      h("div", { class: "results", role: "status" },
        h("h2", {}, cfg(id).name + " — done"),
        h("p", { class: "big-num" }, String(score)),
        h("p", {}, best ? "A new personal best." : `Personal best: ${E().state.bests[id]}`),
        h("p", { class: "dim" }, `${right} of ${total} right. Every answer went to your review schedule.`),
        h("div", { class: "row" },
          h("button", { type: "button", class: "btn primary", onclick: again }, "Play again"),
          h("button", { type: "button", class: "btn", onclick: onExit }, "Done"))));
    root.querySelector(".btn.primary").focus();
  }

  return { rain, match };
})();
