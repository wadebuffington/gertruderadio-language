/* Gertrude Radio Interface Kit v3.3 — copied verbatim from Interface-Kit-v3.3.html.
   Do not edit here; update the kit and re-copy. */
"use strict";
/* Which themes get a glowing tube. MacWrite deliberately does not. */
const GLOW_THEMES = ["hacker","dark","nightdesk"];
/* Which theme boots with the CRT already on. */
const CRT_DEFAULT = t => t === "hacker";

const $ = s => document.querySelector(s);
const store = {
  get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } },
  set(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
};
const clamp = (v,lo,hi) => Math.max(lo, Math.min(hi, v));

/* ---------- theme ---------- */
function setTheme(t){
  document.documentElement.dataset.theme = t;
  store.set("ui.theme", t);
  syncSkins();
  applyCRTForTheme();
}

/* ---------- custom phosphor ---------- */
function hexToHsl(hex){
  let r=parseInt(hex.slice(1,3),16)/255, g=parseInt(hex.slice(3,5),16)/255, b=parseInt(hex.slice(5,7),16)/255;
  const mx=Math.max(r,g,b), mn=Math.min(r,g,b), d=mx-mn;
  let hh=0;
  if(d){ if(mx===r) hh=((g-b)/d)%6; else if(mx===g) hh=(b-r)/d+2; else hh=(r-g)/d+4; }
  hh*=60; if(hh<0) hh+=360;
  const l=(mx+mn)/2, s = d ? d/(1-Math.abs(2*l-1)) : 0;
  return {h:hh, s:s, l:l};
}
function hslToHex(hh,s,l){
  s=Math.max(0,Math.min(1,s)); l=Math.max(0,Math.min(1,l));
  const c=(1-Math.abs(2*l-1))*s, x=c*(1-Math.abs(((hh/60)%2)-1)), m=l-c/2;
  let r=0,g=0,b=0;
  if(hh<60){r=c;g=x;} else if(hh<120){r=x;g=c;} else if(hh<180){g=c;b=x;}
  else if(hh<240){g=x;b=c;} else if(hh<300){r=x;b=c;} else {r=c;b=x;}
  const q=v=>Math.round((v+m)*255).toString(16).padStart(2,"0");
  return "#"+q(r)+q(g)+q(b);
}
const CUSTOM_VARS = ["--chrome-bg","--chrome-fg","--chrome-line","--menu-bg","--menu-hover",
  "--rule","--app-bg","--sheet","--sheet-fg","--sheet-edge","--panel-bg","--panel-fg",
  "--card-bg","--card-edge","--accent","--accent-fg","--muted","--focus",
  "--ink-a","--ink-b","--ink-c"];
function applyCustomPhosphor(hex){
  const c = hexToHsl(hex);
  const neutral = c.s < 0.10;                          // grey means white, not red
  const sat = neutral ? 0 : Math.max(0.30, c.s);
  const fgL = Math.max(0.60, Math.min(0.80, c.l));     // legibility floor and ceiling
  const fg     = hslToHex(c.h, sat, fgL);
  const bright = hslToHex(c.h, neutral ? 0 : Math.max(0.20, sat*0.55), Math.min(0.92, fgL+0.20));
  const dim    = hslToHex(c.h, sat*0.78, Math.max(0.28, fgL-0.32));
  const screen = hslToHex(c.h, neutral ? 0.04 : Math.min(0.55, sat*0.65), 0.035);
  const panel  = hslToHex(c.h, neutral ? 0.04 : Math.min(0.55, sat*0.65), 0.062);
  const line   = hslToHex(c.h, neutral ? 0.05 : sat*0.55, 0.135);
  const st = document.documentElement.style, set = (k,v)=>st.setProperty(k,v);
  set("--chrome-bg",panel); set("--chrome-fg",fg); set("--chrome-line",line);
  set("--menu-bg",panel); set("--menu-hover",line); set("--rule",line);
  set("--app-bg",screen); set("--sheet",screen); set("--sheet-fg",fg); set("--sheet-edge",line);
  set("--panel-bg",panel); set("--panel-fg",fg); set("--card-bg",panel); set("--card-edge",line);
  set("--accent",bright); set("--accent-fg",screen); set("--muted",dim); set("--focus",bright);
}
/* Both skins write the same inline variables, so both are cleared the same way. */
function clearSkinVars(){
  CUSTOM_VARS.forEach(k=>document.documentElement.style.removeProperty(k));
}
function clearCustomPhosphor(){ clearSkinVars(); }

/* ---------- the light theme's colour ----------
   A SCHEME IS A SET OF COLOURS SORTED BY LIGHTNESS, not a pair of tints.
   The palest two colour the FURNITURE — the desk, the chrome, the panels,
   the cards — and the page underneath stays paper. The deepest two or three
   become INK: --ink-a, --ink-b, --ink-c, for whatever your app accents.

   Sorting by lightness rather than by the order the colours were given is
   the whole trick, and it is why a scheme can contain something deep without
   that colour ever ending up behind body text.

   Nothing here is eyeballed. darkTo() walks a hue down in lightness until it
   actually measures the ratio asked of it against the surface it will sit on,
   so no colour anyone picks can produce type that cannot be read. A pale
   yellow and a pale blue are the same lightness and nowhere near the same
   brightness to an eye; that is why lightness alone was never going to be
   enough, and why every value here is measured instead.

   v2 shipped twelve named pastel palettes alongside this. They are gone, and
   they deserved to be: three of them were the same pink, every one was a pair
   this function could derive from a single pick, and two arrived describing
   colours they did not contain — periwinkle paired with a second pink and
   called cantaloupe, teal paired with an off-white and called coral. If you
   ever take a palette list from anywhere, read the hexes and not the names.

   The seven that replaced them are not a longer list of the same thing. They
   are Wada combinations, and they earn their place by containing a colour
   this file could not have invented: a red, a deep teal, an olive. The values
   are the book's published ones. Photographs of the printed page came out a
   stop dark — Spectrum Red sampled as #820813, nearly maroon, against a true
   #DB5961 — so the photographs chose the plates and the published values
   supplied the colour. Never sample a swatch off a photo.

   Two of the seven are quiet on purpose. Not every session wants a red. */

/* WCAG relative luminance, and the ratio between two colours. */
function relLum(hex){
  const v = [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255)
    .map(c=>c<=0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4));
  return 0.2126*v[0] + 0.7152*v[1] + 0.0722*v[2];
}
function contrastRatio(a,b){
  const L1=relLum(a), L2=relLum(b);
  return (Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05);
}
/* Darken a hue until it clears `want` against `bg`. Every text colour below
   comes out of this, which is why the numbers hold whatever you feed it. */
function darkTo(h,s,bg,want,startL){
  for(let l = (startL===undefined?0.60:startL); l >= 0.04; l -= 0.01){
    const c = hslToHex(h,s,l);
    if(contrastRatio(c,bg) >= want) return c;
  }
  return hslToHex(h,s,0.04);
}
/* darkTo's mirror, and the reason it had to exist. On paper a colour is made
   readable by walking it DOWN; on a console there is nowhere down to go, so it
   walks UP instead. Without this, a dark theme's accents are a table of
   hand-picked hexes — which holds for the one palette somebody thought about
   and fails the moment a user picks their own. Same rule, opposite direction. */
function lightTo(h,s,bg,want,startL){
  for(let l = (startL===undefined?0.50:startL); l <= 0.98; l += 0.01){
    const c = hslToHex(h,s,l);
    if(contrastRatio(c,bg) >= want) return c;
  }
  return hslToHex(h,s,0.98);
}

/* The desk carries no text, so it does not need a text ratio — it needs to be
   far enough from the paper that the page reads as a page. Pushed too far it
   stops being a pastel at all: darkening a peach until it cleared 2.4:1 turned
   it to mud, which is what the first cut of this looked like. It stops at a
   soft distance and lets the sheet's own shadow and edge do the separating. */
function deskFor(h,s,sheet,want){
  for(let l=0.90; l>=0.40; l-=0.01){
    const c = hslToHex(h,s,l);
    if(contrastRatio(c,sheet) >= want) return c;
  }
  return hslToHex(h,s,0.40);
}
/* One pick, and the wheel supplies the partner: opposite hue, same softness. */
function complementOf(hex){
  const c = hexToHsl(hex);
  if(c.s < 0.10) return hslToHex(0, 0, 0.78);        // grey in, grey out
  return hslToHex((c.h+180)%360, Math.min(0.75, Math.max(0.25, c.s)), Math.min(0.86, Math.max(0.68, c.l)));
}
/* The seven schemes. UNLISTED SINCE v3.3 — nothing in the toolbar offers
   them any more, and this table is kept for two honest reasons rather than
   sentiment: a user who chose w266 last month still has that string in
   localStorage and boot below still resolves it, and an app that wants a
   preset menu of its own can read this and build one. Delete it and the
   only cost is those two things; applyScheme() does not need it.

   Colour order here is the book's; the code sorts them.
   Sanzo Wada, Haishoku Soukan (1933-34); Seigensha edition, published values.
   灰汁色 is printed "Ecru" in the Seigensha English and "Lye" in the standard
   digitisation. It ships here as the printed book has it. */
const SCHEMES = {
  w266:{label:"Spectrum Red and Benzol Green", plate:266,
        colors:["#DB5961","#EAD3A5","#828C74","#1B9391"]},
  w281:{label:"Antwarp Blue and Benzol Green", plate:281,
        colors:["#407990","#1B9391","#FFF3AF","#96CCAA"]},
  w334:{label:"Olive and Antwarp Blue", plate:334,
        colors:["#B28D60","#407990","#A6CF84","#FCD3BB"]},
  w264:{label:"Cerulian Blue and Red Orange", plate:264,
        colors:["#F6B5B9","#5491A2","#D46262","#B2BFAA"]},
  w135:{label:"Salvia Blue and Cossack Green", plate:135,
        colors:["#9CAAC4","#F8F0C0","#5D7D69"]},
  wq1: {label:"Antwarp Blue and Nile Blue", plate:null,
        colors:["#FABB7C","#C0AF99","#407990","#BDE1E4"]},
  wq2: {label:"Ecru and Isabella", plate:null,
        colors:["#FFF3AF","#C0AF99","#F8B58B","#C4A67F"]}
};

/* One scheme in, a whole interface out.

   Give it any number of colours. It sorts them by measured luminance, hands
   the palest two to the furniture and the deepest to the ink, and solves
   every text colour against the surface it will actually land on.

   A two-colour scheme is just the short case: that is what the colour picker
   produces, and it goes through exactly the same code. There is no separate
   path for "custom", which is how the pastel and the phosphor used to end up
   disagreeing with each other. */
function applyScheme(colors){
  const list = colors.slice().sort((x,y)=>relLum(y)-relLum(x));   // palest first
  const A = hexToHsl(list[0]);
  const B = hexToHsl(list[Math.min(1, list.length-1)]);

  /* A grey pick means grey, the same way a grey phosphor means white: forcing
     saturation onto a hueless colour invents a tint nobody asked for. Pick a
     grey and you get pencil on paper, which is a perfectly good scheme. */
  const flatA = A.s < 0.10, flatB = B.s < 0.10;
  const SA = v => flatA ? 0 : v, SB = v => flatB ? 0 : v;
  const sa = SA(Math.min(0.80, Math.max(0.20, A.s)));
  const sb = SB(Math.min(0.80, Math.max(0.20, B.s)));

  /* surfaces: tinted, never coloured */
  const sheet    = hslToHex(A.h, sa*0.14, 0.986);
  const menuBg   = hslToHex(A.h, sa*0.38, 0.958);
  const chromeBg = hslToHex(A.h, sa*0.58, 0.900);
  const menuHov  = hslToHex(A.h, sa*0.62, 0.845);
  const panelBg  = hslToHex(B.h, sb*0.50, 0.930);
  const cardBg   = hslToHex(B.h, sb*0.52, 0.950);
  const line     = hslToHex(A.h, sa*0.40, 0.740);
  const cardEdge = hslToHex(B.h, sb*0.45, 0.720);
  const appBg    = deskFor(B.h, sb*0.62, sheet, 1.28);
  const accentFg = hslToHex(A.h, SA(0.30), 0.986);
  const accent   = darkTo(B.h, SB(Math.max(0.50, sb)), accentFg, 5.0, 0.55);

  /* every one of these is measured against the surface it lands on */
  const sheetFg  = darkTo(A.h, SA(0.16), sheet, 15.0, 0.30);
  const muted    = darkTo(A.h, SA(0.24), menuBg, 5.5, 0.55);
  const st = document.documentElement.style, set = (k,v)=>st.setProperty(k,v);
  set("--sheet", sheet);        set("--sheet-fg", sheetFg);
  set("--sheet-edge", cardEdge);
  set("--app-bg", appBg);
  set("--chrome-bg", chromeBg); set("--chrome-fg", darkTo(A.h,SA(0.34),chromeBg,9.0,0.40));
  set("--chrome-line", line);   set("--rule", line);
  set("--menu-bg", menuBg);     set("--menu-hover", menuHov);
  set("--panel-bg", panelBg);   set("--panel-fg", darkTo(B.h,SB(0.30),panelBg,9.0,0.40));
  set("--card-bg", cardBg);     set("--card-edge", cardEdge);
  set("--accent", accent);      set("--accent-fg", accentFg);
  set("--muted", muted);
  set("--focus", darkTo(B.h,SB(Math.max(0.60,sb)),chromeBg,4.5,0.55));

  /* INK. Darkest first, so the strongest colour in the scheme gets the
     loudest job. Hue and saturation are kept; only lightness moves, which is
     why a deep colour still looks like itself afterwards and a pale one does
     not. That is the honest limit of this: darken a cream far enough to read
     on paper and you have a brown. It is a real colour and it is no longer
     the one the book named, and that is exactly why the palest members are
     given to the furniture instead. */
  const deep = list.slice().reverse();
  const ink = (i, want) => {
    const c = hexToHsl(deep[Math.min(i, deep.length-1)]);
    const s = flatA && flatB ? 0 : Math.min(0.85, Math.max(0.18, c.s));
    return darkTo(c.h, s, sheet, want, Math.min(0.60, Math.max(c.l, 0.30)));
  };
  set("--ink-a", ink(0, 8.0));
  set("--ink-b", ink(1, 8.0));
  set("--ink-c", deep.length > 2 ? ink(2, 7.0) : muted);

  /* An app maps these to its own tokens and adds any it still needs.
     OpenSlate does:
       --scene-fg: var(--ink-a);  --char-fg: var(--ink-b);
       --trans-fg: var(--ink-c);  --dlg-fg:  var(--sheet-fg);
       --paren-fg: var(--muted);
     Map them. Never hand-pick a hex to sit beside them. */
}
/* Kept under the old name for anything already calling it with a pair. */
function applyPastel(aHex,bHex){ applyScheme([aHex,bHex]); }

/* ---------- the signal (Night Desk) ----------
   One colour in, a lit console out. The rack itself never changes: the
   surfaces are fixed near-blacks, because a console you can retint entirely
   is a phosphor, and there is already a phosphor. What the signal colours is
   the things that are LIVE — the accent, the caps, the ink.

   Everything is solved with lightTo() against the surface it lands on, so no
   pick can produce an unreadable console. A grey pick goes greyscale rather
   than inventing a tint, the same rule the grey phosphor follows. */
const SIGNAL_VARS = ["--accent","--accent-fg","--focus","--ink-a","--ink-b","--ink-c"];
function applySignal(hex){
  const c = hexToHsl(hex);
  const neutral = c.s < 0.10;
  const S = v => neutral ? 0 : v;
  const sat = neutral ? 0 : Math.min(0.92, Math.max(0.42, c.s));
  const chrome = "#0E141C", sheet = "#0C1219", desk = "#070A0F";

  /* The accent is a filled block with text on it, so it is solved the other
     way round: bright enough that the near-black reads on top of it.

     lightTo returns the DIMMEST colour that passes, which is right for text —
     the dimmest passing value against a near-black is also the one closest to
     the colour asked for. It is wrong for a signal lamp, which should look
     lit. So the floor comes from the solver and the actual lightness is the
     brighter of that and the pick's own, held inside a sane band. Brighter
     against a near-black is always more contrast, so raising it cannot break
     what the solver just guaranteed. */
  const floorL = hexToHsl(lightTo(c.h, sat, desk, 6.0, 0.42)).l;
  const wantL  = Math.min(0.70, Math.max(0.52, c.l));
  const accent = hslToHex(c.h, sat, Math.max(floorL, wantL));
  const st = document.documentElement.style, set = (k,v)=>st.setProperty(k,v);
  set("--accent", accent);
  set("--accent-fg", desk);
  set("--focus", lightTo(c.h, S(0.55), chrome, 6.0, 0.55));
  set("--ink-a", lightTo(c.h, sat, sheet, 7.0, 0.50));
  /* The partner: opposite hue, so the second ink is legible AS a second ink
     and not just a paler version of the first. */
  set("--ink-b", lightTo((c.h+180)%360, S(0.62), sheet, 7.0, 0.55));
  set("--ink-c", lightTo(c.h, S(0.20), sheet, 5.5, 0.55));
}
function clearSignal(){
  SIGNAL_VARS.forEach(k=>document.documentElement.style.removeProperty(k));
}


/* ---------- one place decides which skin is live ----------
   The terminal gets phosphors, the light theme gets a colour, Night Desk gets
   a signal. All of them write the SAME variables, so the clear has to happen
   once, here, before anything is written. Two functions each clearing and
   writing independently is how you get a pastel bleeding into a tube. */
function schemeKey(){ return store.get("ui.scheme") || ""; }
function syncSkins(){
  const th = document.documentElement.dataset.theme;
  const isTerm = th === "hacker", isLight = th === "light";
  const isNight = th === "nightdesk";
  const sel = $("#kit-phosphor"), pick = $("#kit-pick");
  const scheme = $("#kit-scheme"), ppick = $("#kit-pastelpick");
  const signal = $("#kit-signal");
  if(!sel) return;

  signal.hidden = !isNight;
  sel.hidden    = !isTerm;
  pick.hidden   = !(isTerm && sel.value === "custom");
  scheme.hidden = !isLight;
  ppick.hidden  = !(isLight && scheme.value === "custom");

  clearSkinVars();
  clearSignal();
  document.documentElement.removeAttribute("data-phosphor");

  if(isNight){ applySignal(signal.value); return; }

  if(isTerm){
    if(sel.value) document.documentElement.dataset.phosphor = sel.value;
    if(sel.value === "custom") applyCustomPhosphor(pick.value);
    return;
  }
  if(isLight && scheme.value){
    if(scheme.value === "custom") applyScheme([ppick.value, complementOf(ppick.value)]);
    else if(SCHEMES[scheme.value]) applyScheme(SCHEMES[scheme.value].colors);
  }
}
/* Kept under the old name for anything already calling it. */
function syncPhosphor(){ syncSkins(); }

/* ---------- CRT, remembered per theme ----------
   Both the switch and the dial are per theme. A green tube at full strength
   and a dark theme at a quarter are two different opinions about two
   different screens, and there is no reason one should overwrite the other. */
function crtIntensity(th){
  const v = parseInt(store.get("ui.crtInt." + th), 10);
  return clamp(isNaN(v) ? 100 : v, 10, 100);
}
function applyCRTForTheme(){
  const th = document.documentElement.dataset.theme;
  const saved = store.get("ui.crt." + th);
  const on = (saved === null || saved === "") ? CRT_DEFAULT(th) : saved === "1";
  document.body.classList.toggle("crt", on);
  setCRTIntensity(crtIntensity(th), false);
  syncCRT();
}
function setCRTIntensity(v, save){
  v = clamp(v, 10, 100);
  const th = document.documentElement.dataset.theme;
  if(save !== false) store.set("ui.crtInt." + th, String(v));
  document.documentElement.style.setProperty("--crt-intensity", (v/100).toFixed(2));
  const s = $("#kit-crtint"), o = $("#kit-crtint-out");
  if(s) s.value = v;
  if(o) o.textContent = v + "%";
}
function syncCRT(){
  const th = document.documentElement.dataset.theme;
  const on = document.body.classList.contains("crt");
  document.body.classList.toggle("glowable", on && GLOW_THEMES.includes(th));
  const b = $("#kit-crt"); if(b) b.setAttribute("aria-pressed", String(on));
  /* The dial is only there when there is something to dial. */
  const d = $("#kit-crtint-dial"); if(d) d.hidden = !on;
}
function toggleCRT(){
  const on = document.body.classList.toggle("crt");
  store.set("ui.crt." + document.documentElement.dataset.theme, on ? "1" : "0");
  syncCRT();
}

/* ---------- wiring ---------- */
$("#kit-theme").addEventListener("change", e=>setTheme(e.target.value));
$("#kit-phosphor").addEventListener("change", e=>{ store.set("ui.phosphor", e.target.value); syncPhosphor(); });
$("#kit-pick").addEventListener("input", e=>{ store.set("ui.phosphorHex", e.target.value); applyCustomPhosphor(e.target.value); });
$("#kit-signal").addEventListener("input", e=>{
  store.set("ui.signal", e.target.value);
  applySignal(e.target.value);
});
$("#kit-scheme").addEventListener("change", e=>{
  store.set("ui.scheme", e.target.value);
  syncSkins();
  /* Choosing "Pick your own" reveals the wheel; put the keyboard on it, or
     the next Tab lands somewhere the eye is not. */
  if(e.target.value === "custom") $("#kit-pastelpick").focus();
});
/* Touching the colour IS switching the tint on. Making someone pick a colour
   and then press something to see it is a step that exists only in the code. */
$("#kit-pastelpick").addEventListener("input", e=>{
  store.set("ui.pastelHex", e.target.value);
  applyScheme([e.target.value, complementOf(e.target.value)]);
});
$("#kit-crt").addEventListener("click", toggleCRT);
$("#kit-crtint").addEventListener("input", e=>setCRTIntensity(parseInt(e.target.value,10)));

/* ---------- boot ---------- */
(function(){
  const t = store.get("ui.theme") || "light";
  $("#kit-theme").value = t;
  document.documentElement.dataset.theme = t;

  const ph = store.get("ui.phosphor") || "";
  $("#kit-phosphor").value = ph;
  const hex = store.get("ui.phosphorHex"); if(hex) $("#kit-pick").value = hex;

  const sig = store.get("ui.signal"); if(sig) $("#kit-signal").value = sig;

  const pax = store.get("ui.pastelHex"); if(pax) $("#kit-pastelpick").value = pax;
  /* v2 stored a palette name in ui.pastel and a flag in ui.pastelOn. Anyone
     upgrading keeps a tinted interface rather than being silently reset to
     plain: the old flag becomes the custom scheme, using the colour they had. */
  let sc = store.get("ui.scheme");
  if(sc === null){
    sc = store.get("ui.pastelOn") === "1" ? "custom" : "";
    store.set("ui.scheme", sc);
  }
  /* A stored Wada key still resolves — syncSkins reads SCHEMES for it — but
     it is no longer in the list, so assigning it would blank the select and
     the next change event would silently drop the user's colour. Show the
     nearest truthful option instead and leave the scheme itself applied. */
  if(sc === "" || sc === "custom") $("#kit-scheme").value = sc;
  else if(SCHEMES[sc]) $("#kit-scheme").value = "custom";

  syncSkins();
  applyCRTForTheme();
})();
