/* The shell: routing, views, settings, and the small effects layer.
   One home screen with one big Start button. */
"use strict";
window.LS = window.LS || {};

(function () {
  const E = LS.Engine;
  const view = document.getElementById("view");
  const h = (tag, attrs = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const k in attrs) {
      const v = attrs[k];
      if (k === "class") e.className = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else if (v === true) e.setAttribute(k, "");
      else if (v !== false && v != null) e.setAttribute(k, v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) e.append(c);
    return e;
  };
  const ja = (text, cls = "") => h("span", { lang: E.pack ? E.pack.lang : "ja", class: cls }, text);
  /* "あ row": only the target-language part is marked lang, so a screen
     reader reads each half in the right voice. */
  const title = t => { const m = /^(\S+)( .*)$/.exec(t); return m && /[^\x00-\x7f]/.test(m[1]) ? [ja(m[1]), m[2]] : t; };

  /* ---------- announcements, toasts, effects ---------- */
  const live = document.getElementById("live");
  function announce(msg) { live.textContent = ""; setTimeout(() => { live.textContent = msg; }, 30); }
  function toast(msg, kind = "") {
    const box = document.getElementById("toasts");
    // One caption at a time, and never more than two toasts on screen.
    if (kind === "caption") box.querySelectorAll(".caption").forEach(x => x.remove());
    while (box.children.length >= 2) box.firstChild.remove();
    const t = h("div", { class: "toast " + kind }, msg);
    box.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }
  const motionOff = () => E.state.settings.reduceMotion ||
    matchMedia("(prefers-reduced-motion: reduce)").matches;

  let audio = null;
  const FX = {
    sfx(kind) {
      if (!E.state.settings.sound) return;
      try {
        audio = audio || new (window.AudioContext || window.webkitAudioContext)();
        const notes = { good: [660, 880], bad: [220, 180], done: [523, 659, 784], best: [523, 659, 784, 1047], goal: [784, 988, 1175] }[kind] || [440];
        notes.forEach((f, i) => {
          const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime + i * 0.09;
          o.type = kind === "bad" ? "triangle" : "sine"; o.frequency.value = f;
          g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
          o.connect(g).connect(audio.destination); o.start(t); o.stop(t + 0.2);
        });
      } catch (e) { /* no audio, no matter */ }
    },
    burst(x, y) {
      if (motionOff()) return;
      const layer = document.getElementById("fx");
      for (let i = 0; i < 12; i++) {
        const p = h("i", { class: "spark" });
        const a = (Math.PI * 2 * i) / 12, r = 30 + Math.random() * 30;
        p.style.left = x + "px"; p.style.top = y + "px";
        p.style.setProperty("--dx", Math.cos(a) * r + "px");
        p.style.setProperty("--dy", Math.sin(a) * r + "px");
        layer.appendChild(p);
        setTimeout(() => p.remove(), 600);
      }
    },
    shake(el) {
      if (motionOff() || !el) return;
      el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake");
    },
  };
  LS.FX = FX;
  LS.UI = { announce, toast };

  /* ---------- speech ----------
     The browser's Japanese voice for now. Every utterance is also shown as
     a caption, so nothing depends on hearing it. */
  function voice() {
    const vs = speechSynthesis.getVoices();
    const want = E.pack.speechLang;
    return vs.find(v => v.lang === want) || vs.find(v => v.lang.startsWith(want.slice(0, 2)));
  }
  function say(text) {
    toast("🔊 " + text, "caption");
    if (!("speechSynthesis" in window)) return;
    const v = voice();
    if (!v) { announce("No Japanese voice is installed on this device."); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = v; u.lang = v.lang; u.rate = 0.8;
    speechSynthesis.speak(u);
  }
  if ("speechSynthesis" in window) speechSynthesis.getVoices();
  const spoken = it => it.type === "letter" ? it.form : (it.readings ? it.readings.kun[0].replace(/\./g, "") : it.form);
  const hearBtn = it => h("button", { type: "button", class: "btn", onclick: () => say(spoken(it)),
    "aria-label": "Hear " + it.form }, "🔊 Hear it");

  /* ---------- keys ----------
     One handler per screen. Typing in a field never triggers a shortcut. */
  let keys = null;
  document.addEventListener("keydown", e => {
    if (!keys || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t.matches && t.matches("input, textarea, select")) return;
    if (keys(e) === true) e.preventDefault();
  });

  /* ---------- small pieces ---------- */
  function ring(value, goal) {
    const pct = Math.min(1, value / goal), C = 2 * Math.PI * 42;
    const wrap = h("div", { class: "ring", role: "img", "aria-label": `Daily goal: ${value} of ${goal} XP` });
    wrap.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true"><circle class="ring-bg" cx="50" cy="50" r="42"/>` +
      `<circle class="ring-fg" cx="50" cy="50" r="42" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}"/></svg>`;
    wrap.append(h("div", { class: "ring-label" }, h("strong", {}, String(value)), h("span", {}, `/ ${goal} XP`)));
    return wrap;
  }
  function statLine() {
    const s = E.state.stats;
    return h("ul", { class: "statline" },
      h("li", { title: "Days in a row you met your goal" }, `🔥 ${s.streak}-day streak`),
      h("li", { title: "Rest days cover a missed day without breaking the streak" }, `💤 ${s.restTokens} rest day${s.restTokens === 1 ? "" : "s"}`),
      h("li", {}, `🪙 ${s.coins} coins`),
      h("li", {}, `✨ ${s.xp} XP`));
  }
  const stateLabel = { new: "New", learning: "Learning", learned: "Learned", mastered: "Mastered" };
  const stateIcon = { new: "○", learning: "◐", learned: "●", mastered: "★" };

  /* ---------- router ---------- */
  let current = null;   // the active screen's teardown
  function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }
  function route() {
    if (current && current.destroy) current.destroy();
    current = null; keys = null;
    const path = (location.hash || "#/").slice(1);
    const [, a, b] = path.split("/");
    document.querySelectorAll(".app-nav a").forEach(l => {
      if (l.dataset.route === (a || "home")) l.setAttribute("aria-current", "page"); else l.removeAttribute("aria-current");
    });
    view.replaceChildren();
    if (!a) home();
    else if (a === "session") session(b === "more");
    else if (a === "learn") b ? itemDetail(decodeURIComponent(b)) : learn();
    else if (a === "games") b ? game(b) : games();
    else if (a === "settings") settings();
    else home();
    window.scrollTo(0, 0);
  }
  addEventListener("hashchange", route);

  /* ---------- home ---------- */
  function home() {
    const s = E.state.stats, g = E.GOALS[E.state.settings.goal];
    const due = E.dueCards().length;
    const fresh = E.nextNewItems(Math.max(0, g.newItems - s.dayNew)).length;
    const comp = E.companion();

    const start = due + fresh > 0
      ? h("button", { type: "button", class: "btn start", onclick: () => go("#/session") },
          h("span", {}, "Start"),
          h("small", {}, [due && `${due} review${due === 1 ? "" : "s"}`, fresh && `${fresh} new`].filter(Boolean).join(" · ")))
      : h("div", { class: "alldone" }, h("p", {}, s.goalDone ? "Goal met. That's the day's win." : "Nothing due right now."),
          E.nextNewItems(1).length
            ? h("button", { type: "button", class: "btn", onclick: () => go("#/session/more") }, "Learn a few more")
            : null);

    const main = h("section", { class: "home-main" },
      h("h1", { class: "sr-only" }, "Today"),
      h("div", { class: "home-top" },
        ring(s.dayXp, g.xp),
        h("div", { class: "companion", role: "img", "aria-label": `Your companion is ${comp.name}. ${comp.learned} items learned.` },
          h("span", { class: "companion-face", "aria-hidden": "true" }, comp.emoji),
          h("span", { class: "dim" }, comp.next ? `${comp.learned} learned · grows at ${comp.next}` : `${comp.learned} learned`))),
      statLine(),
      start,
      h("h2", {}, "Play"),
      gameCards());

    const aside = h("aside", { class: "home-aside desktop-only", "aria-label": "Lessons and stats" },
      h("h2", {}, "Lessons"), lessonList(true),
      h("h2", {}, "Stats"), stats());
    view.append(h("div", { class: "home" }, main, aside));
    keys = e => { if (e.key === "Enter" || e.key === " ") { const b = view.querySelector(".start, .alldone .btn"); if (b && document.activeElement === document.body) { b.click(); return true; } } };
    const b = view.querySelector(".start"); if (b) b.focus({ preventScroll: true });
  }

  function lessonList(compact) {
    const ul = h("ul", { class: "lessons" + (compact ? " compact" : "") });
    for (const l of E.pack.lessons) {
      const st = E.lessonStatus(l);
      ul.append(h("li", { class: st.unlocked ? "" : "locked" },
        h("span", { class: "lesson-title" }, title(l.title)),
        h("span", { class: "bar", role: "img", "aria-label": `${st.learned} of ${st.total} learned` },
          h("i", { style: `width:${(100 * st.learned) / st.total}%` })),
        h("span", { class: "dim" }, st.unlocked ? `${st.learned}/${st.total}` : "🔒 locked")));
    }
    return ul;
  }

  function stats() {
    const st = E.state, today = E.dayKey();
    const todayReviews = st.log.filter(r => E.dayKey(new Date(r.t)) === today).length;
    const counts = { new: 0, learning: 0, learned: 0, mastered: 0 };
    E.pack.items.forEach(i => counts[E.itemState(i.id)]++);
    return h("table", { class: "stats" },
      h("tbody", {},
        ...Object.keys(counts).map(k => h("tr", {}, h("th", { scope: "row" }, `${stateIcon[k]} ${stateLabel[k]}`), h("td", {}, String(counts[k])))),
        h("tr", {}, h("th", { scope: "row" }, "Reviews today"), h("td", {}, String(todayReviews))),
        h("tr", {}, h("th", { scope: "row" }, "Best streak"), h("td", {}, `${st.stats.bestStreak} day${st.stats.bestStreak === 1 ? "" : "s"}`)),
        h("tr", {}, h("th", { scope: "row" }, "Kana Rain best"), h("td", {}, String(st.bests.rain || "—"))),
        h("tr", {}, h("th", { scope: "row" }, "Match Pairs best"), h("td", {}, String(st.bests.match || "—")))));
  }

  function gameCards() {
    const card = (id, name, desc, icon) => h("a", { class: "game-card", href: "#/games/" + id },
      h("span", { class: "game-icon", "aria-hidden": "true", lang: "ja" }, icon),
      h("span", {}, h("strong", {}, name), h("span", { class: "dim" }, desc)));
    return h("div", { class: "game-cards" },
      card("rain", "Kana Rain", "Type or tap the reading before it lands.", "あ"),
      card("match", "Match Pairs", "Flip and match characters to readings.", "🂠"));
  }

  /* ---------- session: review queue → lessons → done ---------- */
  function session(extra) {
    const tasks = E.buildSession({ extraLesson: extra });
    const shown = {};           // cid -> times shown this session
    let i = 0, xp = 0, child = null;
    const startXp = E.state.stats.xp;
    const head = h("div", { class: "session-head" },
      h("a", { href: "#/", class: "btn" }, "✕ Stop"),
      h("div", { class: "bar wide", role: "progressbar", "aria-label": "Session progress", "aria-valuemin": 0 }, h("i", {})),
      h("span", { class: "dim session-count" }, ""));
    const stage = h("div", { class: "stage" });
    view.append(h("h1", { class: "sr-only" }, "Study session"), head, stage);

    function progress() {
      const bar = head.querySelector(".bar");
      bar.setAttribute("aria-valuemax", tasks.length); bar.setAttribute("aria-valuenow", i);
      bar.firstChild.style.width = (100 * i) / Math.max(1, tasks.length) + "%";
      head.querySelector(".session-count").textContent = `${Math.min(i + 1, tasks.length)} / ${tasks.length}`;
    }
    function next() {
      if (child && child.destroy) child.destroy();
      if (i >= tasks.length) return finish();
      progress();
      const t = tasks[i];
      stage.replaceChildren();
      if (t.kind === "lesson") child = lessonCard(stage, E.item(t.itemId), done);
      else {
        shown[t.cid] = (shown[t.cid] || 0) + 1;
        const [itemId, face] = E.splitCardId(t.cid);
        child = face === "write" ? writeCard(stage, E.item(itemId), t.cid, done) : recognizeCard(stage, E.item(itemId), t.cid, done);
      }
      const f = stage.querySelector("[data-autofocus]") || stage.querySelector("button");
      if (f) f.focus({ preventScroll: true });
    }
    function done(res) {
      const t = tasks[i];
      if (res && res.goalJustMet) { FX.sfx("goal"); toast("🎯 Daily goal met!", "good"); announce("Daily goal met."); }
      // Gentle on mistakes: anything due again within twenty minutes comes
      // back later in this same session, up to three times.
      if (t.kind === "card" && res && res.due && res.due - new Date() < 20 * 60e3 && shown[t.cid] < 3) {
        tasks.splice(Math.min(tasks.length, i + 4), 0, { kind: "card", cid: t.cid });
      }
      i++;
      next();
    }
    function finish() {
      progress();
      xp = E.state.stats.xp - startXp;
      const s = E.state.stats, g = E.GOALS[E.state.settings.goal];
      FX.sfx("done");
      stage.replaceChildren(h("div", { class: "results", role: "status" },
        h("h2", {}, tasks.length ? "Session complete" : "Nothing to study right now"),
        ring(s.dayXp, g.xp),
        h("p", {}, `+${xp} XP this session.`),
        h("p", { class: "dim" }, "Next: one quick game, and that's the day."),
        gameCards(),
        h("div", { class: "row" }, h("a", { href: "#/", class: "btn primary", "data-autofocus": true }, "Done"))));
      stage.querySelector("[data-autofocus]").focus();
      keys = null;
    }
    next();
    current = { destroy() { if (child && child.destroy) child.destroy(); } };
  }

  /* Lesson card: form, reading, mnemonic, audio, animated stroke order. */
  function lessonCard(stage, it, done) {
    const watchBox = h("div", { class: "canvas-box" });
    const card = h("article", { class: "card lesson", "aria-labelledby": "lc-form" },
      h("p", { class: "eyebrow" }, it.type === "kanji" ? "New kanji" : "New character"),
      h("div", { class: "lesson-grid" },
        h("div", {},
          h("p", { class: "big-char", id: "lc-form" }, ja(it.form)),
          h("p", { class: "reading" }, readingText(it)),
          it.meanings.length ? h("p", { class: "meaning" }, it.meanings.join(", ")) : null,
          it.readings ? h("p", { class: "dim" }, "On: ", ja(it.readings.on.join("、")), " · Kun: ", ja(it.readings.kun.join("、"))) : null,
          h("p", { class: "mnemonic" }, it.mnemonic),
          h("div", { class: "row" }, hearBtn(it))),
        h("div", {}, watchBox,
          h("div", { class: "row" },
            h("button", { type: "button", class: "btn", onclick: () => w.replay() }, "↻ Replay strokes"),
            h("span", { class: "dim" }, `${it.strokes.length} stroke${it.strokes.length === 1 ? "" : "s"}`)))),
      h("div", { class: "row end" },
        h("button", { type: "button", class: "btn primary", "data-autofocus": true, onclick: got }, "Got it →")));
    stage.append(card);
    const w = LS.Writing.watch(watchBox, it, { reduceMotion: motionOff() });
    if (E.state.settings.sound) say(spoken(it));
    function got() { done(E.introduce(it.id)); }
    keys = e => { if (e.key === "Enter" || e.key === " ") { got(); return true; } };
    return w;
  }
  function readingText(it) {
    if (it.type === "letter") return it.romaji;
    return h("span", {}, ja(it.readings.kun[0].replace(/\./g, "")), " / ", ja(it.readings.on[0]));
  }

  /* Recognize: see the character, recall it, rate yourself. */
  function recognizeCard(stage, it, cid, done) {
    let revealed = false;
    const answer = h("div", { class: "answer", hidden: true });
    const leech = E.isLeech(cid);
    const card = h("article", { class: "card recognize" },
      h("p", { class: "eyebrow" }, "What is this?" + (leech ? " · tricky one" : "")),
      h("p", { class: "big-char" }, ja(it.form)),
      answer,
      h("div", { class: "row center reveal-row" },
        h("button", { type: "button", class: "btn primary", "data-autofocus": true, onclick: reveal }, "Show answer ",
          h("kbd", {}, "Space"))));
    stage.append(card);

    function reveal() {
      if (revealed) return;
      revealed = true;
      answer.hidden = false;
      answer.append(...[
        h("p", { class: "reading" }, readingText(it)),
        it.meanings.length ? h("p", { class: "meaning" }, it.meanings.join(", ")) : null,
        h("p", { class: "mnemonic" + (leech ? " leech" : "") }, (leech ? "This one keeps slipping. " : "") + it.mnemonic),
        h("div", { class: "row center" }, hearBtn(it))].filter(Boolean));
      const pv = E.preview(cid);
      const names = { [E.Rating.Again]: "Again", [E.Rating.Hard]: "Hard", [E.Rating.Good]: "Good", [E.Rating.Easy]: "Easy" };
      const row = h("div", { class: "row center grades", role: "group", "aria-label": "How well did you know it?" });
      for (const r of [1, 2, 3, 4]) {
        row.append(h("button", { type: "button", class: "btn grade g" + r, onclick: () => rate(r) },
          h("span", {}, names[r]), h("small", {}, `${r} · ${when(pv[r])}`)));
      }
      card.querySelector(".reveal-row").replaceWith(row);
      row.querySelector(".g3").focus();
      announce(`${typeof readingText(it) === "string" ? readingText(it) : ""} ${it.meanings.join(", ")}`);
      if (E.state.settings.sound) say(spoken(it));
    }
    function rate(r) {
      const res = E.grade(cid, r, { src: "recognize" });
      if (r === 1) FX.sfx("bad"); else FX.sfx("good");
      done(res);
    }
    keys = e => {
      if (!revealed && (e.key === " " || e.key === "Enter")) { reveal(); return true; }
      if (revealed && "1234".includes(e.key)) { rate(Number(e.key)); return true; }
    };
  }
  function when(d) {
    const m = Math.round((d - new Date()) / 60e3);
    if (m < 60) return Math.max(1, m) + "m";
    if (m < 60 * 24) return Math.round(m / 60) + "h";
    const days = Math.round(m / 1440);
    return days < 31 ? days + "d" : Math.round(days / 30) + "mo";
  }

  /* Write: draw the character from its reading. Graded by the stroke checker. */
  function writeCard(stage, it, cid, done) {
    const mode = E.writeMode(it.id);
    const box = h("div", { class: "canvas-box draw" });
    const status = h("p", { class: "write-status", "aria-live": "polite" }, "");
    let useChoose = E.state.settings.drawAlternative, pad = null, finished = false;
    const others = E.pack.items.filter(x => x.id !== it.id).flatMap(x => x.strokes).filter((_, k) => k % 7 === 0);
    const modeText = { trace: "Trace over the grey character.", guided: "The dot shows where the next stroke starts.", recall: "From memory." };

    const altBtn = h("button", { type: "button", class: "btn", onclick: () => { useChoose = !useChoose; mount(); } }, "");
    const hintBtn = h("button", { type: "button", class: "btn", onclick: () => pad && pad.hint() }, "Hint ", h("kbd", {}, "H"));
    const card = h("article", { class: "card write" },
      h("p", { class: "eyebrow" }, "Write it · " + mode),
      h("p", { class: "prompt" }, it.type === "letter" ? h("span", {}, "Write ", h("strong", {}, it.romaji)) :
        h("span", {}, "Write the kanji for ", h("strong", {}, it.meanings[0]), " (", ja(it.readings.kun[0].replace(/\./g, "")), ")")),
      h("p", { class: "dim mode-text" }, modeText[mode]),
      box, status,
      h("div", { class: "row center tools" }, hintBtn, altBtn, hearBtn(it)));
    stage.append(card);

    function mount() {
      if (pad) pad.destroy();
      altBtn.textContent = useChoose ? "✎ Draw instead" : "☰ Choose strokes instead";
      hintBtn.hidden = useChoose;
      card.querySelector(".mode-text").textContent = useChoose ? "Pick each stroke in order." : modeText[mode];
      const opts = { onDone: finish, announce: m => { status.textContent = m; }, otherStrokes: others };
      pad = useChoose ? LS.Writing.choose(box, it, opts) : LS.Writing.draw(box, it, Object.assign({ mode }, opts));
    }
    function finish(score) {
      if (finished) return;
      finished = true;
      const rating = E.ratingFromWriting(score);
      const res = E.grade(cid, rating, { src: useChoose ? "choose" : "write" });
      const msg = score.misses + score.hints + score.reveals === 0 ? "Clean — every stroke right first time."
        : `${score.misses} miss${score.misses === 1 ? "" : "es"}` + (score.hints ? `, ${score.hints} hint${score.hints === 1 ? "" : "s"}` : "") +
          (score.reveals ? `, ${score.reveals} shown` : "") + ".";
      status.textContent = msg;
      FX.sfx(rating >= 3 ? "good" : "bad");
      if (rating >= 3) { const r = box.getBoundingClientRect(); FX.burst(r.left + r.width / 2, r.top + r.height / 2); }
      const cont = h("button", { type: "button", class: "btn primary" }, "Continue →");
      cont.addEventListener("click", () => done(res));
      card.querySelector(".tools").replaceWith(h("div", { class: "row center" }, cont));
      cont.focus();
      keys = e => { if (e.key === "Enter" || e.key === " ") { done(res); return true; } };
    }
    mount();
    keys = e => {
      if (e.key === "h" || e.key === "H") { if (pad) pad.hint(); return true; }
      if (useChoose && "123".includes(e.key)) { pad.keypick(Number(e.key) - 1); return true; }
    };
    return { destroy() { if (pad) pad.destroy(); } };
  }

  /* ---------- learn: the browser ---------- */
  function learn() {
    view.append(h("h1", {}, "Learn"),
      h("p", { class: "dim" }, "Every character in the pack. Pick one to watch its stroke order and practise freely — practice here is not graded."));
    for (const l of E.pack.lessons) {
      const st = E.lessonStatus(l);
      view.append(h("h2", {}, title(l.title), st.unlocked ? "" : " · 🔒"),
        h("ul", { class: "tiles" }, l.items.map(id => {
          const it = E.item(id), s = E.itemState(id);
          return h("li", {}, h("a", { href: "#/learn/" + encodeURIComponent(id), class: "tile s-" + s,
            "aria-label": `${it.form}, ${it.type === "letter" ? it.romaji : it.meanings[0]}, ${stateLabel[s]}` },
            ja(it.form, "tile-form"), h("span", { class: "tile-sub" }, it.type === "letter" ? it.romaji : it.meanings[0]),
            h("span", { class: "tile-state", "aria-hidden": "true" }, stateIcon[s])));
        })));
    }
    view.append(h("p", { class: "dim legend" }, Object.keys(stateLabel).map(k => `${stateIcon[k]} ${stateLabel[k]}`).join("   ")));
  }

  function itemDetail(id) {
    const it = E.item(id);
    if (!it) return learn();
    const lesson = E.pack.lessons.find(l => l.items.includes(id));
    const canTeach = !E.state.introduced[id] && E.lessonUnlocked(lesson);
    const watchBox = h("div", { class: "canvas-box" }), drawBox = h("div", { class: "canvas-box draw" });
    const status = h("p", { class: "write-status", "aria-live": "polite" });
    let w = null, pad = null, mode = "trace";
    const modes = h("div", { class: "row seg", role: "group", "aria-label": "Practice mode" },
      ["trace", "guided", "recall", "free"].map(m => h("button", { type: "button", class: "btn", "aria-pressed": String(m === mode),
        onclick: e => { mode = m; modes.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b === e.currentTarget))); practise(); } }, m)));

    view.append(
      h("p", {}, h("a", { href: "#/learn" }, "← All characters")),
      h("div", { class: "lesson-grid" },
        h("div", {},
          h("h1", { class: "big-char" }, ja(it.form)),
          h("p", { class: "reading" }, readingText(it)),
          it.meanings.length ? h("p", { class: "meaning" }, it.meanings.join(", ")) : null,
          h("p", { class: "mnemonic" }, it.mnemonic),
          h("p", { class: "dim" }, `Status: ${stateLabel[E.itemState(id)]}`),
          h("div", { class: "row" }, hearBtn(it),
            canTeach ? h("button", { type: "button", class: "btn primary", onclick: () => { E.introduce(id); toast("Added to your reviews", "good"); route(); } }, "Add to my reviews") : null),
          h("h2", {}, "Stroke order"), watchBox,
          h("button", { type: "button", class: "btn", onclick: () => w.replay() }, "↻ Replay")),
        h("div", {},
          h("h2", {}, "Practise"), modes, drawBox, status,
          h("div", { class: "row" },
            h("button", { type: "button", class: "btn", onclick: () => pad.hint() }, "Hint"),
            h("button", { type: "button", class: "btn", onclick: practise }, "Clear")))));
    w = LS.Writing.watch(watchBox, it, { reduceMotion: motionOff() });
    function practise() {
      if (pad) pad.destroy();
      status.textContent = "";
      pad = LS.Writing.draw(drawBox, it, { mode, announce: m => { status.textContent = m; },
        onDone: s => { status.textContent = `Done: ${s.misses} misses, ${s.hints} hints. Press Clear to go again.`; } });
    }
    practise();
    current = { destroy() { w.destroy(); if (pad) pad.destroy(); } };
  }

  /* ---------- games ---------- */
  function games() {
    view.append(h("h1", {}, "Games"),
      h("p", { class: "dim" }, "Short rounds built from the characters you've learned. Every answer counts as review."),
      gameCards(),
      h("p", { class: "dim" }, "Timers can be slowed or turned off in ", h("a", { href: "#/settings" }, "Settings"), "."));
  }
  function game(id) {
    const root = h("div", { class: "game" });
    view.append(root);
    const onExit = () => go("#/games");
    current = id === "rain" ? LS.Games.rain(root, { onExit }) : LS.Games.match(root, { onExit });
  }

  /* ---------- settings ---------- */
  function settings() {
    const st = E.state.settings;
    const set = (k, v) => { st[k] = v; E.persist(); applySettings(); };
    const radios = (name, legend, options, value, onPick) => h("fieldset", {},
      h("legend", {}, legend),
      options.map(([v, label]) => h("label", { class: "choice" },
        h("input", { type: "radio", name, value: String(v), checked: String(v) === String(value), onchange: () => onPick(v) }), " ", label)));
    const check = (key, label, help) => h("label", { class: "choice" },
      h("input", { type: "checkbox", checked: !!st[key], onchange: e => set(key, e.target.checked) }), " ", label,
      help ? h("span", { class: "dim help" }, help) : null);
    const file = h("input", { type: "file", accept: "application/json,.json", class: "sr-only", id: "import-file",
      onchange: async e => {
        const f = e.target.files[0]; if (!f) return;
        try { E.replaceState(await LS.Store.importFile(f)); toast("Progress imported", "good"); route(); }
        catch (err) { toast("That file couldn't be read: " + err.message, "miss"); }
      } });

    view.append(h("h1", {}, "Settings"),
      radios("goal", "Daily goal", Object.entries(E.GOALS).map(([k, g]) => [k, `${g.label} (${g.xp} XP, up to ${g.newItems} new)`]), st.goal, v => set("goal", v)),
      radios("timer", "Game timers", [[1, "Normal"], [1.5, "Relaxed"], [2, "Slow"], [0, "Off — no time pressure"]], st.timerScale, v => set("timerScale", v)),
      h("fieldset", {}, h("legend", {}, "Comfort"),
        check("largeType", "Large type", "Characters up to 200px."),
        check("reduceMotion", "Reduce motion", "No shake or sparkle. Your system setting is honoured too."),
        check("sound", "Sound and voice", "Effects and the Japanese voice. Everything spoken is also captioned."),
        check("drawAlternative", "Choose strokes instead of drawing", "Write cards become pick-the-next-stroke. Graded the same way.")),
      h("fieldset", {}, h("legend", {}, "Lessons"),
        check("unlockAll", "Unlock every lesson", "Skip ahead — handy for trying the kanji in this preview.")),
      h("fieldset", {}, h("legend", {}, "Your progress"),
        h("p", { class: "dim" }, "Saved in this browser only. Export a file to back it up or move it to another device."),
        h("div", { class: "row" },
          h("button", { type: "button", class: "btn", onclick: () => LS.Store.exportFile(E.state) }, "Export progress"),
          h("label", { class: "btn", for: "import-file", tabindex: "0",
            onkeydown: e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); file.click(); } } }, "Import progress"), file,
          h("button", { type: "button", class: "btn danger", onclick: () => {
            if (confirm("Erase all progress in this browser? Export first if you might want it back.")) { E.reset(); toast("Progress reset"); route(); }
          } }, "Reset"))),
      h("h2", {}, "Credits"),
      h("ul", { class: "dim credits" },
        ...E.pack.credits.map(c => h("li", {}, `${c.what}: ${c.who}, `, h("a", { href: c.url, rel: "noopener", target: "_blank" }, c.licence), ".")),
        h("li", {}, "Scheduling: ", h("a", { href: "https://github.com/open-spaced-repetition/ts-fsrs", rel: "noopener", target: "_blank" }, "ts-fsrs"), " (MIT)."),
        h("li", {}, "Interface: Gertrude Radio Interface Kit v3.3.")));
  }

  function applySettings() {
    const st = E.state.settings, root = document.documentElement;
    root.classList.toggle("large-type", !!st.largeType);
    root.classList.toggle("reduce-motion", !!st.reduceMotion);
  }

  /* ---------- boot ---------- */
  (async function boot() {
    const pack = window.LANG_PACKS.ja;
    E.init(pack, await LS.Store.load());
    applySettings();
    E.onChange(() => applySettings());
    // A new day can start while the tab sits open.
    setInterval(() => { const d = E.state.stats.day; E.rollDay(); if (d !== E.state.stats.day) { E.persist(); if (!location.hash || location.hash === "#/") route(); } }, 60e3);
    route();
  })();
})();
