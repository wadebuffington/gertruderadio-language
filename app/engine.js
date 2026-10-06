/* The engine. Knows nothing about Japanese: everything language-specific
   comes from the pack (window.LANG_PACKS[id]).

   - Items come from the pack. Each item makes one card per FACE
     (recognize, write), and each card is scheduled on its own by FSRS.
   - Activities report results here; the engine schedules, logs, and pays
     out XP and coins.
*/
"use strict";
window.LS = window.LS || {};

LS.Engine = (function () {
  const { fsrs, generatorParameters, createEmptyCard, Rating, State } = window.FSRS;
  const scheduler = fsrs(generatorParameters({ enable_fuzz: true, enable_short_term: true }));

  const FACES = ["recognize", "write"];
  const GOALS = {           // the learner picks one; minutes are approximate
    casual:  { label: "Casual · 5 min",   xp: 30,  newItems: 5,  session: 15 },
    regular: { label: "Regular · 10 min", xp: 60,  newItems: 8,  session: 30 },
    serious: { label: "Serious · 20 min", xp: 120, newItems: 12, session: 50 },
  };
  const XP = { [Rating.Again]: 1, [Rating.Hard]: 2, [Rating.Good]: 3, [Rating.Easy]: 3,
               lesson: 5, game: 2 };
  const LEECH_LAPSES = 8;
  const MASTERED_DAYS = 21;
  const COMPANION = [  // grows with the number of learned items
    [0, "🌰", "a seed"], [3, "🌱", "a sprout"], [12, "🌿", "a seedling"],
    [25, "🪴", "a potted plant"], [46, "🌳", "a tree"], [56, "🌸", "a tree in blossom"],
  ];

  let pack = null, state = null, byId = new Map();
  const listeners = new Set();

  /* ---------- days ---------- */
  const dayKey = (d = new Date()) =>
    d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const daysBetween = (a, b) =>
    Math.round((new Date(b + "T12:00") - new Date(a + "T12:00")) / 864e5);

  /* ---------- state ---------- */
  function freshState(packId) {
    return {
      version: 1, pack: packId,
      introduced: {},              // itemId -> ISO date first taught
      cards: {},                   // "itemId|face" -> FSRS card
      log: [],                     // recent reviews, newest last
      bests: {},                   // game -> best score
      stats: {
        xp: 0, coins: 0, streak: 0, bestStreak: 0, restTokens: 1, restDays: [],
        lastGoalDay: null, day: dayKey(), dayXp: 0, dayNew: 0, goalDone: false,
      },
      settings: {
        goal: "casual", timerScale: 1, largeType: false, reduceMotion: false,
        sound: true, unlockAll: false, drawAlternative: false,
      },
    };
  }

  function reviveCard(c) {
    c.due = new Date(c.due);
    c.last_review = c.last_review ? new Date(c.last_review) : undefined;
    return c;
  }

  function init(p, saved) {
    pack = p;
    byId = new Map(p.items.map(i => [i.id, i]));
    const base = freshState(p.id);
    state = saved && saved.pack === p.id ? saved : base;
    // Settings and stats added after a save was made still get defaults.
    state.settings = Object.assign(base.settings, state.settings);
    state.stats = Object.assign(base.stats, state.stats);
    state.bests = state.bests || {};
    for (const k in state.cards) reviveCard(state.cards[k]);
    rollDay();
    persist();
  }

  function persist() {
    LS.Store.save(state);
    listeners.forEach(fn => fn());
  }
  const onChange = fn => listeners.add(fn);

  /* ---------- streak with rest days ----------
     The streak counts days the daily goal was met. Missed days are covered
     by rest tokens if there are enough of them; no guilt, no nags. One token
     to start, one more for every seven-day run, up to three. */
  function rollDay() {
    const s = state.stats, today = dayKey();
    if (s.day === today) return;
    s.day = today; s.dayXp = 0; s.dayNew = 0; s.goalDone = false;
    if (!s.lastGoalDay) return;
    const missed = daysBetween(s.lastGoalDay, today) - 1;
    if (missed <= 0) return;
    if (s.streak > 0 && missed <= s.restTokens) {
      s.restTokens -= missed;
      for (let i = 1; i <= missed; i++) {
        const d = new Date(s.lastGoalDay + "T12:00"); d.setDate(d.getDate() + i);
        s.restDays.push(dayKey(d));
      }
      s.restDays = s.restDays.slice(-30);
      const y = new Date(); y.setDate(y.getDate() - 1);
      s.lastGoalDay = dayKey(y);
    } else {
      s.streak = 0;
    }
  }

  function addXp(n) {
    rollDay();
    const s = state.stats, goal = GOALS[state.settings.goal].xp;
    const before = s.xp;
    s.xp += n; s.dayXp += n;
    s.coins += Math.floor(s.xp / 10) - Math.floor(before / 10);
    let goalJustMet = false;
    if (!s.goalDone && s.dayXp >= goal) {
      s.goalDone = true; goalJustMet = true;
      if (s.lastGoalDay !== s.day) {
        s.streak += 1; s.lastGoalDay = s.day;
        s.bestStreak = Math.max(s.bestStreak, s.streak);
        if (s.streak % 7 === 0) s.restTokens = Math.min(3, s.restTokens + 1);
      }
      s.coins += 10;
    }
    return { xp: n, goalJustMet };
  }

  /* ---------- items and lessons ---------- */
  const item = id => byId.get(id);
  const cardId = (itemId, face) => itemId + "|" + face;
  const card = (itemId, face) => state.cards[cardId(itemId, face)];
  const splitCardId = cid => { const i = cid.lastIndexOf("|"); return [cid.slice(0, i), cid.slice(i + 1)]; };

  function itemState(itemId) {
    const c = card(itemId, "recognize");
    if (!c) return "new";
    if (c.state !== State.Review) return "learning";
    return c.stability >= MASTERED_DAYS ? "mastered" : "learned";
  }
  const isLearned = id => ["learned", "mastered"].includes(itemState(id));
  const isLeech = cid => (state.cards[cid] || {}).lapses >= LEECH_LAPSES;

  function lessonUnlocked(lesson) {
    if (state.settings.unlockAll) return true;
    const idx = pack.lessons.indexOf(lesson);
    if (idx === 0) return true;
    // Components before compounds: a lesson opens once what it builds on is learned.
    const needs = lesson.unlock ? lesson.unlock.lessons : [pack.lessons[idx - 1].id];
    return needs.every(lid => pack.lessons.find(l => l.id === lid).items.every(isLearned));
  }

  function lessonStatus(lesson) {
    const total = lesson.items.length;
    const introduced = lesson.items.filter(id => state.introduced[id]).length;
    const learned = lesson.items.filter(isLearned).length;
    return { unlocked: lessonUnlocked(lesson), total, introduced, learned };
  }

  function nextNewItems(n) {
    const out = [];
    for (const l of pack.lessons) {
      if (!lessonUnlocked(l)) continue;
      for (const id of l.items) if (!state.introduced[id] && out.length < n) out.push(id);
    }
    return out;
  }

  function introduce(itemId) {
    if (state.introduced[itemId]) return { xp: 0 };
    state.introduced[itemId] = new Date().toISOString();
    state.stats.dayNew += 1;
    const now = new Date();
    for (const f of FACES) {
      if (f === "write" && !item(itemId).strokes) continue;
      state.cards[cardId(itemId, f)] = createEmptyCard(now);
    }
    const r = addXp(XP.lesson);
    persist();
    return r;
  }

  /* ---------- scheduling ---------- */
  function dueCards(now = new Date()) {
    return Object.keys(state.cards)
      .filter(k => state.cards[k].due <= now)
      .sort((a, b) => state.cards[a].due - state.cards[b].due);
  }

  /* What each button would do, for showing "10m / 2d" under it. */
  function preview(cid, now = new Date()) {
    const r = scheduler.repeat(state.cards[cid], now);
    const out = {};
    for (const g of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]) out[g] = r[g].card.due;
    return out;
  }

  function grade(cid, rating, meta = {}) {
    const now = new Date();
    const res = scheduler.next(state.cards[cid], now, rating);
    state.cards[cid] = res.card;
    state.log.push({ c: cid, r: rating, t: now.getTime(), ms: meta.ms || 0, src: meta.src || "card" });
    if (state.log.length > 5000) state.log.splice(0, state.log.length - 5000);
    const r = addXp(XP[rating]);
    persist();
    return Object.assign(r, { due: res.card.due, leech: isLeech(cid) });
  }

  /* Games report right or wrong. A correct answer on a card that is not due
     yet earns XP but does not reschedule it, so a game cannot push a card
     further out than it has earned. A wrong answer always counts. */
  function gradeAuto(cid, correct, meta = {}) {
    const c = state.cards[cid];
    if (!c) return { xp: 0 };
    if (correct && c.due > new Date()) {
      const r = addXp(XP.game);
      persist();
      return r;
    }
    return grade(cid, correct ? Rating.Good : Rating.Again, meta);
  }

  /* Write cards are graded from misses and hints, never self-rated. */
  function ratingFromWriting({ misses, hints, reveals }) {
    if (reveals > 0) return Rating.Again;
    if (misses === 0 && hints === 0) return Rating.Good;
    if (misses + hints * 2 <= 2) return Rating.Hard;
    return Rating.Again;
  }

  /* The trace → guided → recall scaffold, chosen from the write card's
     own history. Watch happens in the lesson. */
  function writeMode(itemId) {
    const c = card(itemId, "write");
    if (!c || c.reps === 0) return "trace";
    if (c.state === State.Review) return "recall";
    return c.reps < 2 ? "trace" : "guided";
  }

  /* ---------- the daily queue ----------
     Reviews due today first, then a few new items, each taught before its
     first review. Capped by the goal the learner picked. */
  function buildSession({ extraLesson = false } = {}) {
    rollDay();
    const g = GOALS[state.settings.goal];
    const tasks = dueCards().slice(0, g.session).map(cid => ({ kind: "card", cid }));
    const room = extraLesson ? 5
      : Math.max(0, Math.min(g.newItems - state.stats.dayNew, g.session - tasks.length));
    const fresh = nextNewItems(room);
    for (const id of fresh) tasks.push({ kind: "lesson", itemId: id });
    for (const id of fresh) tasks.push({ kind: "card", cid: cardId(id, "recognize") });
    for (const id of fresh) if (item(id).strokes) tasks.push({ kind: "card", cid: cardId(id, "write") });
    return tasks;
  }

  /* Items for a game round: due first, then the most-learned for confidence. */
  function gamePool(filter = () => true, n = 12) {
    const ids = Object.keys(state.introduced).filter(id => filter(item(id)));
    const now = new Date();
    const due = ids.filter(id => card(id, "recognize").due <= now);
    const rest = ids.filter(id => !due.includes(id))
      .sort((a, b) => card(b, "recognize").stability - card(a, "recognize").stability);
    return shuffle(due).concat(rest).slice(0, n);
  }

  function shuffle(a) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function companion() {
    const n = pack.items.filter(i => isLearned(i.id)).length;
    let c = COMPANION[0];
    for (const step of COMPANION) if (n >= step[0]) c = step;
    const next = COMPANION[COMPANION.indexOf(c) + 1];
    return { emoji: c[1], name: c[2], learned: n, next: next ? next[0] : null };
  }

  function setBest(game, score) {
    const better = !(state.bests[game] >= score);
    if (better) { state.bests[game] = score; persist(); }
    return better;
  }

  function replaceState(s) {
    init(pack, s);
  }
  function reset() {
    init(pack, null);
  }

  return {
    Rating, State, FACES, GOALS,
    init, onChange, persist,
    get pack() { return pack; }, get state() { return state; },
    item, card, cardId, splitCardId, itemState, isLearned, isLeech,
    lessonStatus, lessonUnlocked, nextNewItems, introduce,
    dueCards, preview, grade, gradeAuto, ratingFromWriting, writeMode,
    buildSession, gamePool, shuffle, companion, setBest, addXp, rollDay,
    replaceState, reset, dayKey,
  };
})();
