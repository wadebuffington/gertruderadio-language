# Language Studio — proof of concept

A browser app for learning to read and write a language, built as a language-neutral engine plus swappable **language packs**. The first pack is Japanese: the 46 basic hiragana, plus 10 starter kanji (日 月 火 水 木 山 川 人 口 田).

The plan behind it is in the design paper (*Browser Language Studio: Design Paper*, Oct 2026). This build is the proof of concept from that paper: hiragana end to end (learn, draw, review, play).

## Run it

No build step and no server needed. Either:

- open `index.html` in a browser, or
- serve the folder (`python3 -m http.server`) and visit `http://localhost:8000`.

To deploy, copy the whole folder to any static host (Cloudflare Pages works).

## What's in it

| Paper item | Status |
|---|---|
| Hiragana pack: 46 items, rows, KanjiVG stroke paths inlined, browser Japanese voice | ✅ (+10 kanji) |
| FSRS scheduling (ts-fsrs) with a daily queue and a daily-goal ring | ✅ |
| Lesson card: form, reading, mnemonic, animated stroke order | ✅ |
| Flashcards: Recognize (self-rated, 4 buttons) and Write (stroke-checked) | ✅ |
| Writing canvas: stroke checking, watch → trace → guided → recall (+ free in Learn) | ✅ |
| Games: Kana Rain and Match Pairs, both reporting to the scheduler | ✅ |
| XP, coins, streak with rest days, a companion that grows | ✅ |
| Progress in IndexedDB, with export and import | ✅ |
| Keyboard play, adjustable or no timers, large type, reduced motion, no-drawing alternative | ✅ |
| Mobile lite layout and desktop full layout | ✅ |

**Keyboard:** `Space` shows the answer, `1`–`4` rate it, `H` gives a hint while writing, `Enter` continues. In Choose-strokes mode, `1`–`3` pick an option.

## Layout

```
index.html            page shell: kit bar, nav, view
kit/                  Gertrude Radio Interface Kit v3.3 (verbatim copy; section 8 demo removed)
app/engine.js         items, cards, FSRS, daily queue, unlocks, rewards (knows no Japanese)
app/writing.js        stroke canvas: watch / draw / choose
app/games.js          Kana Rain, Match Pairs
app/ui.js             routing, screens, settings, effects
app/store.js          IndexedDB save, export/import
app/decor.js          the brush, and placing a pack's watermarks on each screen
packs/ja/pack.js      GENERATED Japanese pack (content + stroke paths + UI words)
packs/ja/culture.js   the Japanese look: sumi-e motifs, colours, seal, scenes
tools/build-ja-pack.mjs   builds the pack; edit content here
vendor/ts-fsrs.umd.js ts-fsrs 5.4.2 (MIT)
```

## One shell, many languages

The interface is the same for every language. The language you're studying is picked in the top bar. It is named on the home screen with a seal, and each language keeps its own progress. Everything language-specific lives in the pack:

- **`pack.js`**: content (`items`, `lessons`) and the words the shell uses (`ui.types`, `ui.games`, for example "Kana Rain").
- **`culture.js`**: the look. It sets two watermark colours (pale green and blue for Japanese), a seal, and **motifs** drawn with the engine's brush (`LS.Decor.brush`: a centre line plus a width profile, giving a tapered ink stroke). It also has a `scenes` table that says where each motif sits on each screen.

The Japanese look follows a reference painting (`packs/ja/art/source/painting.jpg`): ink and wash on rice paper, with a crane over old pine, Fuji, 平和 in bold brush, koi in a swirling stream, cherry, plum, bamboo and iris. `tools/cut-ja-art.py` lifts the paper out of the painting so each element becomes its own transparent piece in `packs/ja/art/`. The scenes then place those pieces:

- **Desk:** they frame the page around it.
- **Page:** they sit faint behind it, kept clear of the text.
- **Plain Light theme:** it becomes rice paper, with indigo accents. A colour scheme the learner picks still takes priority.
- **Dark themes:** the ink is inverted to pale wash.
- **Terminal, MacWrite and print:** the pieces are hidden.

To re-cut after changing a crop:

```
python3 tools/cut-ja-art.py packs/ja/art/source/painting.jpg
```

Adding a language means writing these two files, not engine code. Add the two `<script>` tags in `index.html`, and the language appears in the picker.

To rebuild the Japanese pack (this fetches stroke data from KanjiVG):

```
node tools/build-ja-pack.mjs
```

## How grading works

- **Recognize** cards are self-rated Again / Hard / Good / Easy. Each button shows when the card would come back.
- **Write** cards are graded from the drawing: clean → Good, a miss or two → Hard, a stroke shown after three misses → Again. Each stroke is resampled and compared with the KanjiVG path on start point, end point, and average distance. That comparison also catches a stroke drawn backwards, and a stroke that matches a later one is flagged as "wrong order".
- **Games** report right or wrong. A wrong answer always reschedules the card. A right answer reschedules it only if it was due, so playing can't push a card further out than you've earned.
- Anything due again within 20 minutes comes back later in the same session.

## Credits

- Stroke data: [KanjiVG](https://kanjivg.tagaini.net) © Ulrich Apel, **CC BY-SA 3.0**. The generated `packs/ja/pack.js` contains this data and stays under that licence.
- Scheduling: [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs), MIT (`vendor/ts-fsrs.LICENSE`).
- Interface: Gertrude Radio Interface Kit v3.3.
