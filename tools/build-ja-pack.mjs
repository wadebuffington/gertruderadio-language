// Builds packs/ja/pack.js: the Japanese language pack for the proof of concept.
//
// Content (readings, meanings, mnemonics) lives in this file. Stroke paths
// are fetched from KanjiVG and inlined, so the app needs no network at runtime.
//
//   node tools/build-ja-pack.mjs
//
// KanjiVG (c) Ulrich Apel, CC BY-SA 3.0 — https://kanjivg.tagaini.net
// The stroke data in the generated file stays under that licence.

import { writeFile } from "node:fs/promises";

const KVG = "https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/";

// [kana, romaji, mnemonic]. Rows in teaching order, あ row to わ row.
const ROWS = [
  ["a", [["あ","a","An apple with a stalk — say \"ah\" as you bite it."],
         ["い","i","Two eels side by side: \"ee\"-ls."],
         ["う","u","A face with a little hat, going \"oo\"."],
         ["え","e","An exotic bird with a crest: \"eh?\""],
         ["お","o","A golfer swings and the ball flies off: \"oh!\""]]],
  ["ka",[["か","ka","A cutting blade with a spark — \"ka\"-ching."],
         ["き","ki","A key with two teeth."],
         ["く","ku","A cuckoo's open beak: \"ku\"."],
         ["け","ke","A keg on a stand, with a tap."],
         ["こ","ko","Two worms co-habiting: \"ko\"."]]],
  ["sa",[["さ","sa","A sign with a curvy post — say \"sa\"."],
         ["し","shi","A fish hook — \"she\" caught a fish."],
         ["す","su","A swing with a loop in the rope: \"su\"."],
         ["せ","se","A mouth with a long tooth saying \"say\"."],
         ["そ","so","A zig-zag seam being sewn: \"so\"."]]],
  ["ta",[["た","ta","The letters t and a, nearly: \"ta\"."],
         ["ち","chi","A cheerleader leaning back: \"chi\"."],
         ["つ","tsu","A tsunami wave curling over."],
         ["て","te","A tail curling down: \"te\"."],
         ["と","to","A toe with a splinter in it."]]],
  ["na",[["な","na","A nun kneeling beside a cross: \"na\"."],
         ["に","ni","A knee next to a table: \"ni\"."],
         ["ぬ","nu","Noodles on a fork — \"nu\"-dles."],
         ["ね","ne","A cat curled up, tail looped: \"neko\"."],
         ["の","no","A no-entry sign: \"no\"."]]],
  ["ha",[["は","ha","A man laughing with his arms out: \"ha!\""],
         ["ひ","hi","A big grin: \"hee hee\"."],
         ["ふ","fu","Mount Fuji with clouds around it."],
         ["へ","he","A gentle hill: \"heh\", that's easy."],
         ["ほ","ho","A ho-ho-holly bush in a pot."]]],
  ["ma",[["ま","ma","A mama with a ribbon in her hair."],
         ["み","mi","The number 21 — \"me\" at twenty-one."],
         ["む","mu","A cow saying \"moo\" with its tail up."],
         ["め","me","An eye (\"me\" in Japanese) with a lash."],
         ["も","mo","A fish hook with more worms on it: \"mo\"."]]],
  ["ya",[["や","ya","A yak with horns: \"ya\"."],
         ["ゆ","yu","A unique fish swimming: \"yu\"."],
         ["よ","yo","A yo-yo hanging from a string."]]],
  ["ra",[["ら","ra","A rabbit with one tall ear: \"ra\"."],
         ["り","ri","Two reeds by a river: \"ri\"."],
         ["る","ru","A route that loops back: \"ru\"."],
         ["れ","re","A man kneeling to retch: \"re\"."],
         ["ろ","ro","A road with no loop at the end: \"ro\"."]]],
  ["wa",[["わ","wa","A wasp with a long stinger: \"wa\"."],
         ["を","wo","A man on a whoa-ing horse: \"wo\"."],
         ["ん","n","A lower-case n with a tail: \"n\"."]]],
];

// First pictographic kanji. [kanji, meanings, on, kun, mnemonic]
const KANJI = [
  ["日",["sun","day"],["ニチ","ジツ"],["ひ","か"],"A window with the sun shining through it."],
  ["月",["moon","month"],["ゲツ","ガツ"],["つき"],"A crescent moon, drawn tall and narrow."],
  ["火",["fire"],["カ"],["ひ"],"A campfire with sparks flying off both sides."],
  ["水",["water"],["スイ"],["みず"],"A stream with water splashing off either bank."],
  ["木",["tree","wood"],["モク","ボク"],["き"],"A tree: trunk, branches, and roots."],
  ["山",["mountain"],["サン"],["やま"],"Three peaks, the middle one tallest."],
  ["川",["river"],["セン"],["かわ"],"Three lines of water flowing downhill."],
  ["人",["person"],["ジン","ニン"],["ひと"],"A person walking, two legs apart."],
  ["口",["mouth"],["コウ","ク"],["くち"],"An open mouth, drawn as a box."],
  ["田",["rice field"],["デン"],["た"],"A rice paddy, split into four plots."],
];

const hex = ch => ch.codePointAt(0).toString(16).padStart(5, "0");

async function strokes(ch) {
  const res = await fetch(KVG + hex(ch) + ".svg");
  if (!res.ok) throw new Error(`KanjiVG ${ch}: HTTP ${res.status}`);
  const svg = await res.text();
  // Stroke paths are numbered -s1, -s2 … in drawing order.
  const out = [];
  for (const m of svg.matchAll(/<path id="kvg:[0-9a-f]+-s(\d+)"[^>]*\sd="([^"]+)"/g)) {
    out[Number(m[1]) - 1] = m[2];
  }
  if (!out.length || out.includes(undefined)) throw new Error(`KanjiVG ${ch}: bad strokes`);
  return out;
}

const items = [];
for (const [row, kana] of ROWS) {
  for (const [form, romaji, mnemonic] of kana) {
    items.push({
      id: "ja:h:" + form, type: "letter", form, reading: romaji, romaji,
      meanings: [], mnemonic, components: [],
      tags: ["hiragana", "row-" + row], lesson: "hira-" + row,
      strokes: await strokes(form),
    });
  }
}
for (const [form, meanings, on, kun, mnemonic] of KANJI) {
  items.push({
    id: "ja:k:" + form, type: "kanji", form,
    reading: kun[0], readings: { on, kun }, meanings, mnemonic, components: [],
    tags: ["kanji", "N5"], lesson: "kanji-1",
    strokes: await strokes(form),
  });
}

const lessons = [
  ...ROWS.map(([row, kana]) => ({
    id: "hira-" + row, title: kana[0][0] + " row",
    items: kana.map(k => "ja:h:" + k[0]),
  })),
  { id: "kanji-1", title: "First kanji", items: KANJI.map(k => "ja:k:" + k[0]),
    unlock: { lessons: ROWS.map(([row]) => "hira-" + row), minState: "learned" } },
];

const pack = {
  id: "ja", name: "Japanese", nativeName: "日本語",
  lang: "ja", dir: "ltr", speechLang: "ja-JP",
  canvas: { grid: "square-cross", viewBox: 109 },
  credits: [
    { what: "Stroke data", who: "KanjiVG, © Ulrich Apel",
      licence: "CC BY-SA 3.0", url: "https://kanjivg.tagaini.net" },
  ],
  lessons, items,
};

const banner =
`// GENERATED by tools/build-ja-pack.mjs — edit that file, not this one.
// Stroke paths: KanjiVG (c) Ulrich Apel, CC BY-SA 3.0, https://kanjivg.tagaini.net
`;
await writeFile(new URL("../packs/ja/pack.js", import.meta.url),
  banner + "(window.LANG_PACKS = window.LANG_PACKS || {}).ja = " +
  JSON.stringify(pack, null, 1) + ";\n");
console.log(`packs/ja/pack.js: ${items.length} items, ${lessons.length} lessons`);
