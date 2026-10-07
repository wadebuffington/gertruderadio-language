/* The Japanese pack's cultural look: sumi-e watermarks in pale green and
   blue, drawn with the engine's brush (LS.Decor). Hand-written, not
   generated. Each motif is a function of the brush API so it is drawn once,
   at load, with no images.

   Motifs: tanchō crane in flight, koi, an ensō, bamboo, seigaiha waves, and
   kanji written large with a wet brush. `scenes` says which motifs sit where
   on each screen, on the page (sheet) and on the desk around it. */
"use strict";
(function () {
  const pack = (window.LANG_PACKS || {}).ja;
  if (!pack) return;

  /* A kanji from the pack, written as calligraphy: the KanjiVG centre lines
     with a broad brush. */
  /* A kanji from the pack, written as calligraphy: the KanjiVG centre lines
     re-inked with the brush, pressing down at the start of each stroke and
     lifting at the end. */
  const brushedKanji = form => B => {
    const it = pack.items.find(i => i.form === form);
    return it.strokes.map(d => B.path(B.brush(B.pathPoints(d, 9), [6, 11, 10, 9, 9, 8.5, 8, 6, 2.5], 6))).join("");
  };

  pack.culture = {
    palette: { green: "#8CCB9B", blue: "#86BCE3", seal: "#C8402F" },
    rule: "brushRule",
    seal: { text: "日本語", vertical: true },   // a hanko, carved top to bottom
    motifs: {
      /* the underline under section headings: one quick horizontal stroke */
      brushRule: {
        viewBox: "0 0 200 12",
        draw: B => B.path(B.brush([[2, 7], [40, 5], [110, 6], [170, 5], [198, 4]], [3, 9, 8, 6, 0])),
      },

      crane: {
        viewBox: "0 0 220 190",
        draw: B => [
          // far wing, raised
          B.brush([[104, 94], [112, 64], [130, 36], [156, 16], [184, 6]], [18, 30, 26, 14, 0]),
          // its primaries, spread like fingers
          B.brush([[160, 18], [182, 10], [206, 8]], [6, 6, 0]),
          B.brush([[156, 25], [180, 21], [202, 24]], [6, 6, 0]),
          B.brush([[150, 33], [172, 35], [194, 42]], [6, 5, 0]),
          // near wing, swept down and back
          B.brush([[110, 106], [128, 126], [150, 146], [176, 158], [200, 164]], [18, 30, 22, 10, 0]),
          B.brush([[174, 156], [194, 170], [206, 186]], [6, 5, 0]),
          B.brush([[164, 156], [182, 174], [190, 188]], [6, 5, 0]),
          // body
          B.brush([[80, 99], [102, 96], [126, 100], [146, 107]], [8, 24, 20, 4]),
          // neck, long and straight out in front
          B.brush([[86, 97], [64, 88], [44, 80], [30, 76]], [9, 6, 5, 6]),
          // head and beak
          `<circle cx="27" cy="75.5" r="5.5"/>`,
          B.brush([[24, 77], [12, 80], [2, 83]], [3.4, 2, 0]),
          // legs trailing behind
          B.brush([[140, 106], [172, 114], [208, 120]], [2.6, 2, 0.6]),
          B.brush([[140, 110], [170, 120], [204, 129]], [2.6, 2, 0.6]),
        ].map(d => d.startsWith("<") ? d : B.path(d)).join(""),
      },

      koi: {
        viewBox: "0 0 210 130",
        draw: B => [
          // a plump body bending as it swims, blunt head to narrow tail wrist
          B.brush([[22, 66], [44, 58], [76, 56], [108, 64], [138, 76], [162, 76]], [26, 40, 38, 26, 12, 6]),
          `<circle cx="22" cy="66" r="13"/>`,
          // tail: two long flowing lobes
          B.brush([[158, 76], [176, 64], [192, 46], [208, 38]], [8, 14, 10, 0]),
          B.brush([[158, 77], [178, 88], [192, 106], [206, 120]], [8, 14, 10, 0]),
          // pectoral fins, broad fans
          B.brush([[48, 44], [56, 30], [70, 18]], [6, 14, 0]),
          B.brush([[48, 82], [56, 98], [70, 110]], [6, 14, 0]),
          // pelvic fins, smaller
          B.brush([[104, 54], [112, 44], [124, 38]], [5, 8, 0]),
          B.brush([[106, 76], [114, 88], [126, 94]], [5, 8, 0]),
          // barbels
          B.brush([[13, 58], [6, 50], [3, 40]], [1.8, 1.2, 0]),
          B.brush([[13, 74], [6, 82], [3, 92]], [1.8, 1.2, 0]),
          // ripples where it passed
          B.brush([[150, 30], [172, 22], [194, 24]], [0, 2.4, 0]),
          B.brush([[136, 112], [162, 122], [186, 118]], [0, 2.4, 0]),
        ].map(d => d.startsWith("<") ? d : B.path(d)).join(""),
      },

      enso: {
        viewBox: "0 0 200 200",
        draw: B => B.path(B.enso(100, 100, 78, { from: 215, sweep: 318, heavy: 22, light: 3 })),
      },

      bamboo: {
        viewBox: "0 0 140 300",
        draw: B => {
          const parts = [];
          // two culms, each in jointed sections
          const culm = (x, y0, lean, segs, w) => {
            let y = y0;
            for (let i = 0; i < segs.length; i++) {
              const h = segs[i], x0 = x + lean * (y0 - y), x1 = x + lean * (y0 - y + h);
              parts.push(B.brush([[x0, y], [x0 + (x1 - x0) / 2 + 1, y - h / 2], [x1, y - h + 3]], [w * 1.15, w, w * 1.1]));
              parts.push(B.brush([[x1 - w * 0.9, y - h + 1], [x1, y - h], [x1 + w * 0.9, y - h + 1]], [1.6, 3, 1.6]));
              y -= h + 4;
            }
          };
          culm(40, 300, 0.05, [70, 62, 56, 50, 44], 9);
          culm(84, 300, -0.03, [80, 66, 58, 46], 6);
          // leaves: quick tapered strokes, in clusters off the joints
          const leaf = (x, y, dx, dy) => parts.push(B.brush([[x, y], [x + dx * 0.5, y + dy * 0.5 - 4], [x + dx, y + dy]], [1, 7, 0]));
          leaf(52, 104, 46, -10); leaf(52, 104, 40, 16); leaf(52, 104, 30, 34);
          leaf(36, 166, -34, 8); leaf(36, 166, -30, 28);
          leaf(80, 96, -40, -16); leaf(80, 96, -32, 10);
          leaf(88, 156, 40, -6); leaf(88, 156, 36, 20); leaf(88, 156, 22, 38);
          leaf(46, 42, 36, -22); leaf(46, 42, -28, -18);
          return parts.map(d => B.path(d)).join("");
        },
      },

      /* seigaiha, 青海波, "waves of the blue sea": overlapping fans of rings */
      waves: {
        viewBox: "0 0 480 40",    // a low band along the foot of the page
        draw: () => {
          let s = `<defs><pattern id="seigaiha" width="40" height="20" patternUnits="userSpaceOnUse">`;
          // each fan hides the ones behind it, so rows are drawn back to front
          const fan = (cx, cy) => `<path d="M${cx - 20},${cy} a20,20 0 0 1 40,0 Z" fill="var(--sheet, #fff)"/>` +
            [18, 13, 8, 3].map(r =>
              `<path d="M${cx - r},${cy} a${r},${r} 0 0 1 ${r * 2},0" fill="none" stroke="currentColor" stroke-width="1.6"/>`).join("");
          s += fan(0, 10) + fan(40, 10) + fan(20, 20) + fan(0, 30) + fan(40, 30);
          s += `</pattern></defs><rect width="480" height="40" fill="url(#seigaiha)"/>`;
          return s;
        },
      },

      kanjiWater: { viewBox: "0 0 109 109", draw: brushedKanji("水") },
      kanjiMountain: { viewBox: "0 0 109 109", draw: brushedKanji("山") },
      kanjiSun: { viewBox: "0 0 109 109", draw: brushedKanji("日") },
      kanjiTree: { viewBox: "0 0 109 109", draw: brushedKanji("木") },
    },

    /* Where things sit. Positions are CSS, relative to the page (sheet) or
       the window (desk). The sheet's motifs stay faint enough to read over. */
    scenes: {
      home: {
        sheet: [
          { motif: "crane", tone: "blue", top: "-10px", right: "-30px", width: "min(420px, 62%)", rotate: -6 },
          { motif: "enso", tone: "green", bottom: "70px", left: "-60px", width: "min(300px, 50%)" },
          { motif: "waves", tone: "blue", bottom: "0", left: "0", width: "100%", opacity: 0.5 },
        ],
        desk: [
          { motif: "koi", tone: "blue", bottom: "6vh", left: "1vw", width: "22vw", rotate: -24 },
          { motif: "bamboo", tone: "green", top: "70px", right: "0", width: "12vw" },
        ],
      },
      session: {
        sheet: [
          { motif: "koi", tone: "blue", bottom: "30px", right: "-20px", width: "min(340px, 55%)", rotate: 160, flip: true },
          { motif: "koi", tone: "green", top: "50px", left: "-40px", width: "min(260px, 42%)", rotate: 18 },
          { motif: "waves", tone: "blue", bottom: "0", left: "0", width: "100%", opacity: 0.5 },
        ],
        desk: [
          { motif: "enso", tone: "green", top: "90px", left: "1vw", width: "18vw" },
          { motif: "crane", tone: "blue", bottom: "4vh", right: "1vw", width: "22vw", rotate: -10 },
        ],
      },
      learn: {
        sheet: [
          { motif: "bamboo", tone: "green", top: "20px", right: "-10px", width: "min(220px, 30%)" },
          { motif: "kanjiMountain", tone: "blue", bottom: "30px", left: "-10px", width: "min(320px, 45%)" },
        ],
        desk: [
          { motif: "crane", tone: "blue", top: "80px", left: "0", width: "20vw", rotate: -4, flip: true },
          { motif: "koi", tone: "green", bottom: "4vh", right: "1vw", width: "20vw", rotate: 200 },
        ],
      },
      games: {
        sheet: [
          { motif: "koi", tone: "blue", top: "40px", right: "4%", width: "min(300px, 48%)", rotate: 30 },
          { motif: "koi", tone: "green", top: "130px", right: "14%", width: "min(260px, 42%)", rotate: 210 },
          { motif: "waves", tone: "blue", bottom: "0", left: "0", width: "100%", opacity: 0.5 },
        ],
        desk: [
          { motif: "kanjiWater", tone: "blue", top: "90px", left: "1vw", width: "16vw" },
          { motif: "bamboo", tone: "green", bottom: "0", right: "1vw", width: "11vw" },
        ],
      },
      settings: {
        sheet: [
          { motif: "enso", tone: "green", top: "30px", right: "-30px", width: "min(320px, 48%)" },
          { motif: "kanjiTree", tone: "blue", bottom: "40px", right: "6%", width: "min(220px, 34%)" },
        ],
        desk: [
          { motif: "crane", tone: "blue", top: "90px", left: "1vw", width: "20vw" },
        ],
      },
    },
  };
})();
