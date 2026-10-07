/* The Japanese pack's cultural look, after the reference painting: an ink
   and wash scroll of a crane over old pine, Fuji above the clouds, 平和 in
   bold brush, two koi turning in a swirling stream, cherry, plum, bamboo
   and iris, on warm rice paper.

   The painted pieces in art/ are cut from that painting by
   tools/cut-ja-art.py, which lifts the paper out so each piece keeps its own
   brushwork. The heading underline and the ensō are drawn with the engine's
   brush (LS.Decor). `scenes` says where each piece sits on each screen: on
   the page (sheet), faint enough to read over, and on the desk around it. */
"use strict";
(function () {
  const pack = (window.LANG_PACKS || {}).ja;
  if (!pack) return;
  const art = name => ({ image: "packs/ja/art/" + name + ".webp" });

  // Pieces used on every desk: the scroll's edges, framing the page.
  const deskLeft = (top, bottom) => [
    { motif: top, top: "70px", left: "0", width: "min(340px, 26vw)", opacity: 0.85 },
    { motif: bottom, bottom: "0", left: "0", width: "min(300px, 24vw)", opacity: 0.85 },
  ];
  const deskRight = (top, bottom) => [
    { motif: top, top: "80px", right: "1.5vw", width: "min(150px, 11vw)", opacity: 0.9 },
    { motif: bottom, bottom: "0", right: "0", width: "min(250px, 19vw)", opacity: 0.85 },
  ];

  pack.culture = {
    // the painting's own inks: indigo, pine green, and the seal's vermilion
    palette: { green: "#7E9C6E", blue: "#5B7FA6", seal: "#B8382B" },
    // Plain Light becomes rice paper. A colour the learner picks still wins.
    surfaces: {
      light: {
        "--chrome-bg": "#F1E9D6", "--chrome-line": "#D9CCAD", "--menu-bg": "#FBF6EA", "--menu-hover": "#E8DDC3",
        "--app-bg": "#E7DDC5", "--sheet": "#FCF8EE", "--sheet-edge": "#00000018",
        "--card-bg": "#FFFDF7", "--card-edge": "#E0D3B4", "--panel-bg": "#F5EEDC",
        "--rule": "#D6C9A9", "--muted": "#655E50", "--accent": "#2E4A6E", "--focus": "#2E4A6E",
        "--ink-a": "#22374F", "--ink-b": "#3F6650", "--ink-c": "#8E3B2E",
        "--sheet-shadow": "0 3px 22px rgba(70,55,25,.22)",
      },
    },
    rule: "brushRule",
    seal: { text: "日本語", vertical: true },   // a hanko, carved top to bottom

    motifs: {
      crane: art("crane"), fuji: art("fuji"), heiwa: art("heiwa"), koi: art("koi"),
      blossom: art("blossom"), pine: art("pine"), bamboo: art("bamboo"),
      iris: art("iris"), stream: art("stream"), seal: art("seal"),

      /* the underline under section headings: one quick horizontal stroke */
      brushRule: {
        viewBox: "0 0 200 12",
        draw: B => B.path(B.brush([[2, 7], [40, 5], [110, 6], [170, 5], [198, 4]], [3, 9, 8, 6, 0])),
      },
      enso: {
        viewBox: "0 0 200 200",
        draw: B => B.path(B.enso(100, 100, 78, { from: 215, sweep: 318, heavy: 22, light: 3 })),
      },
    },

    scenes: {
      home: {
        sheet: [
          // in the open ground between the two columns, clear of the text
          { motif: "crane", top: "6px", left: "39%", width: "min(340px, 34%)", opacity: 0.32 },
          { motif: "stream", bottom: "0", left: "-10px", width: "min(640px, 66%)", opacity: 0.42 },
          { motif: "koi", bottom: "4px", left: "44%", width: "min(200px, 21%)", opacity: 0.34 },
          { motif: "seal", bottom: "16px", left: "18px", width: "34px", opacity: 0.85, plain: true },
        ],
        desk: [...deskLeft("blossom", "iris"), ...deskRight("heiwa", "bamboo")],
      },
      session: {
        sheet: [
          { motif: "fuji", top: "-4px", right: "2%", width: "min(300px, 34%)", opacity: 0.3 },
          { motif: "stream", bottom: "0", right: "-10px", width: "min(600px, 70%)", opacity: 0.4 },
          { motif: "koi", bottom: "6px", left: "-8px", width: "min(220px, 28%)", opacity: 0.3 },
        ],
        desk: [...deskLeft("crane", "iris"), ...deskRight("heiwa", "bamboo")],
      },
      learn: {
        sheet: [
          { motif: "bamboo", top: "20px", right: "-6px", width: "min(260px, 30%)", opacity: 0.35 },
          { motif: "pine", top: "-6px", right: "26%", width: "min(220px, 24%)", opacity: 0.28 },
          { motif: "iris", bottom: "0", right: "2%", width: "min(260px, 30%)", opacity: 0.35 },
        ],
        desk: [...deskLeft("crane", "blossom"), ...deskRight("heiwa", "stream")],
      },
      games: {
        sheet: [
          { motif: "koi", top: "-30px", right: "1%", width: "min(300px, 32%)", opacity: 0.32 },
          { motif: "seal", bottom: "14px", right: "18px", width: "30px", opacity: 0.8, plain: true },
        ],
        desk: [...deskLeft("blossom", "iris"), ...deskRight("heiwa", "bamboo")],
      },
      settings: {
        sheet: [
          { motif: "heiwa", top: "40px", right: "5%", width: "min(140px, 16%)", opacity: 0.16 },
          { motif: "blossom", bottom: "0", right: "0", width: "min(320px, 38%)", opacity: 0.32 },
        ],
        desk: [...deskLeft("pine", "iris"), ...deskRight("fuji", "bamboo")],
      },
    },
  };
})();
