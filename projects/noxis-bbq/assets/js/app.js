/* ============================================================
   NOXIS BBQ — aplicația statică pentru NOXIS UNIVERS
   Port vanilla (fără framework) al aplicației Next.js.
   - motor i18n cu 6 limbi (dicționarele oficiale din i18n-data.js)
   - muzică: o singură instanță <audio>, intrare doar la click
   - toate jocurile și secțiunile comice
   - Escape: închide mai întâi ferestrele interne, apoi → NOXIS UNIVERS
   ============================================================ */
(() => {
  "use strict";

  var BACK_URL = "../../index.html#discover-ai";
  var D = window.NOXIS_I18N;
  var LANGS = [
    { code: "ro", label: "Română", flag: "🇷🇴" },
    { code: "de", label: "Deutsch", flag: "🇩🇪" },
    { code: "en", label: "English", flag: "🇬🇧" },
    { code: "pl", label: "Polski", flag: "🇵🇱" },
    { code: "sl", label: "Slovenščina", flag: "🇸🇮" },
    { code: "zh-CN", label: "简体中文", flag: "🇨🇳" },
  ];
  var STORE_LANG = "noxis-bbq-lang";
  var STORE_SOUND = "noxis-bbq-sound";

  /* ---------- utilitare ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(html) {
    var t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function rnd(n) { return Math.floor(Math.random() * n); }
  function pick(arr) { return arr[rnd(arr.length)]; }

  /* ---------- starea globală ---------- */
  var state = {
    lang: "en",
    t: D.en,
    entered: false,
    soundOn: false,
    // stres
    stress: 0, events: [], evId: 0,
    // vânătoarea muștarului
    jarSpot: rnd(12), searched: {}, attempts: 0, found: false, outcome: null, reactKey: "robot",
    // ERROR 402
    stage: 0,
    // Nyra
    nyraMood: "idle", nyraLine: null, nyraAccepted: [],
    // Z230
    zTemp: 22, zPhase: "idle", zLine: null, zCooking: false, zTimer: null,
    // Mici-O-Metru
    mici: 0,
    // quiz
    qIndex: 0, qDone: false, qAnswered: 0,
    qScores: { Philosopher: 0, Artist: 0, Ninja: 0, Planner: 0, Experimenter: 0, Veteran: 0 },
    // scuze
    scuza: null, scuzeCount: 0,
    // ferestre interne deschise (Escape le închide pe rând)
    openWindow: null, // 'lang' | 'family'
    volume: 0.75,
  };

  /* ---------- motorul de sunete (port din lib/sound.ts) ---------- */
  var audioCtx = null;
  function setSoundEnabled(on) { state._soundEnabled = on; }
  function getCtx() {
    if (!state._soundEnabled) return null;
    try {
      if (!audioCtx) {
        var Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return null;
        audioCtx = new Ctor();
      }
      if (audioCtx.state === "suspended") audioCtx.resume();
      return audioCtx;
    } catch (e) { return null; }
  }
  function tone(ctx, freq, start, dur, type, gain) {
    var osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
    g.gain.setValueAtTime(gain, ctx.currentTime + start);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(ctx.currentTime + start);
    osc.stop(ctx.currentTime + start + dur + 0.05);
  }
  function noise(ctx, start, dur, gain) {
    var size = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, size, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < size; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / size);
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var g = ctx.createGain();
    g.gain.setValueAtTime(gain, ctx.currentTime + start);
    src.connect(g); g.connect(ctx.destination);
    src.start(ctx.currentTime + start);
  }
  function sfx(name) {
    var ctx = getCtx(); if (!ctx) return;
    try {
      switch (name) {
        case "click": tone(ctx, 660, 0, 0.07, "square", 0.05); break;
        case "error": tone(ctx, 180, 0, 0.16, "sawtooth", 0.07); tone(ctx, 140, 0.14, 0.22, "sawtooth", 0.07); break;
        case "coin": tone(ctx, 988, 0, 0.08, "square", 0.05); tone(ctx, 1319, 0.08, 0.18, "square", 0.05); break;
        case "meow": tone(ctx, 700, 0, 0.12, "triangle", 0.07); tone(ctx, 520, 0.1, 0.18, "triangle", 0.06); break;
        case "sizzle": noise(ctx, 0, 0.5, 0.035); noise(ctx, 0.5, 0.4, 0.025); break;
        case "boom": tone(ctx, 90, 0, 0.4, "sawtooth", 0.09); noise(ctx, 0, 0.3, 0.06); break;
        case "win": tone(ctx, 523, 0, 0.12, "square", 0.05); tone(ctx, 659, 0.12, 0.12, "square", 0.05); tone(ctx, 784, 0.24, 0.12, "square", 0.05); tone(ctx, 1047, 0.36, 0.3, "square", 0.05); break;
        case "sad": tone(ctx, 392, 0, 0.2, "triangle", 0.06); tone(ctx, 330, 0.2, 0.2, "triangle", 0.06); tone(ctx, 262, 0.4, 0.35, "triangle", 0.06); break;
      }
    } catch (e) { /* non-fatal */ }
  }

  /* ---------- i18n ---------- */
  function detectLang() {
    var cands = [];
    try { cands.push(navigator.language); } catch (e) {}
    try { (navigator.languages || []).forEach(function (l) { cands.push(l); }); } catch (e) {}
    for (var i = 0; i < cands.length; i++) {
      var s = (cands[i] || "").toLowerCase();
      if (s.indexOf("ro") === 0) return "ro";
      if (s.indexOf("de") === 0) return "de";
      if (s.indexOf("pl") === 0) return "pl";
      if (s.indexOf("sl") === 0) return "sl";
      if (s.indexOf("zh") === 0) return "zh-CN";
      if (s.indexOf("en") === 0) return "en";
    }
    return "en";
  }
  function savedLang() {
    try { var v = localStorage.getItem(STORE_LANG); return v && D[v] ? v : null; } catch (e) { return null; }
  }
  function getPath(obj, path) {
    var parts = path.split(".");
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      var m = parts[i].match(/^(.+?)\[(\d+)\]$/);
      if (m) { cur = cur[m[1]]; cur = cur[parseInt(m[2], 10)]; }
      else cur = cur[parts[i]];
      if (cur == null) return null;
    }
    return cur;
  }

  // Harta EN → cheie (construită o dată din dicționarul englez)
  var EN_MAP = {};
  var EN_VALUES = {};
  (function buildMap() {
    function walk(node, path) {
      if (node && typeof node === "object") {
        if (Array.isArray(node)) { for (var i = 0; i < node.length; i++) walk(node[i], path + "[" + i + "]"); }
        else { Object.keys(node).forEach(function (k) { walk(node[k], path ? path + "." + k : k); }); }
      } else if (typeof node === "string") {
        if (!(node in EN_MAP)) { EN_MAP[node] = path; EN_VALUES[node] = true; }
      }
    }
    walk(D.en, "");
  })();

  function applyStaticLang() {
    var t = state.t;
    // 1. atributele data-i18n explicite (cardul Zidului etc.)
    $$("[data-i18n]").forEach(function (n) {
      var v = getPath(t, n.getAttribute("data-i18n"));
      if (typeof v === "string") n.textContent = v;
    });
    // 2. atributele standard (placeholder, title, aria-label, alt)
    $$("[placeholder],[title],[aria-label],[alt]").forEach(function (n) {
      ["placeholder", "title", "aria-label", "alt"].forEach(function (a) {
        var v = n.getAttribute && n.getAttribute(a);
        n._noxisI18nAttrs = n._noxisI18nAttrs || {};
        var key = n._noxisI18nAttrs[a] || (v && EN_MAP[v]);
        if (key) {
          n._noxisI18nAttrs[a] = key;
          var rep = getPath(t, key);
          if (typeof rep === "string") n.setAttribute(a, rep);
        }
      });
    });
    // 3. nodurile de text statice (valoare EN → cheie → limba curentă)
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentNode && n.parentNode.nodeName;
        if (p === "SCRIPT" || p === "STYLE") return NodeFilter.FILTER_REJECT;
        var v = (n.nodeValue || "").trim();
        return n._noxisI18nKey || (v && EN_VALUES[v]) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      },
    });
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (n) {
      var v = (n.nodeValue || "").trim();
      n._noxisI18nKey = n._noxisI18nKey || EN_MAP[v];
      var rep = getPath(state.t, n._noxisI18nKey);
      if (typeof rep === "string") n.nodeValue = rep;
    });
    document.documentElement.lang = state.lang === "zh-CN" ? "zh-CN" : state.lang;
  }

  function setLang(l) {
    if (!D[l]) l = "en";
    state.lang = l;
    state.t = D[l];
    try { localStorage.setItem(STORE_LANG, l); } catch (e) {}
    applyStaticLang();
    renderAll();
  }

  /* ---------- SVG-uri lucide (echivalente iconițelor React) ---------- */
  var SVG = {
    play: '<svg class="h-5 w-5 translate-x-[1px]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg>',
    pause: '<svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="14" y="4" width="4" height="16" rx="1" ry="1"></rect><rect x="4" y="4" width="4" height="16" rx="1" ry="1"></rect></svg>',
    vol2: '<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 18.298z"></path><path d="M16 9a5 5 0 0 1 0 6"></path><path d="M19.364 18.364a9 9 0 0 0 0-12.728"></path></svg>',
    volx: '<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 18.298z"></path><line x1="22" x2="16" y1="9" y2="15"></line><line x1="16" x2="22" y1="9" y2="15"></line></svg>',
    chevron: '<svg class="size-4 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg>',
    chevronAcc: '<svg class="text-muted-foreground pointer-events-none size-4 shrink-0 translate-y-0.5 transition-transform duration-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>',
    flame: '<svg class="h-6 w-6 text-yellow-300 anim-flicker" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>',
  };

  /* ---------- personaje ---------- */
  var AVATARS = {
    tara: "../../assets/gallery/portraits/tara.webp", nyxer: "../../assets/gallery/portraits/nyxer.webp",
    nyxar: "../../assets/gallery/portraits/nyxar.webp", aren: "../../assets/gallery/portraits/aren.webp",
    nyra: "../../assets/gallery/portraits/nyra.webp", robot: "assets/characters/robot.webp",
    aron: "../../assets/gallery/portraits/ar-on.webp", arin: "../../assets/gallery/portraits/ar-in.webp",
    nyxin: "../../assets/gallery/portraits/nyxin.webp",
  };
  var EMOJI = { tara: "🌟", nyxer: "💸", nyxar: "🖥️", aren: "🔍", nyra: "👑", z230: "🐌", robot: "🤖", aron: "🌙", arin: "❄️", nyxin: "🔮" };
  var MAIN_KEYS = ["tara", "nyxer", "aren", "nyra", "z230", "robot"];
  var CAMEO_KEYS = ["aron", "arin", "nyxin", "nyxar"];
  var PICTURES = AVATARS; // z230 = null în React; aici rămâne emoji

  function dialogBoxHtml(character, text) {
    var role = state.t.characters.roles[character];
    var av = AVATARS[character];
    var avatar = av
      ? '<img src="' + av + '" alt="" class="h-full w-full object-cover" loading="lazy"/>'
      : EMOJI[character];
    return (
      '<div class="flex items-start gap-3 rounded-2xl border-2 border-orange-200 bg-white p-3 shadow-sm" role="status" aria-live="polite">' +
      '<span aria-hidden="true" class="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-amber-300 bg-gradient-to-br from-amber-100 to-orange-200 text-2xl shadow-inner">' + avatar + "</span>" +
      '<div class="min-w-0"><p class="text-sm font-black text-red-700">' + esc(role.name) + "</p>" +
      '<p class="mt-0.5 text-sm font-medium leading-snug text-orange-900/85 sm:text-base">' + esc(text) + "</p></div></div>"
    );
  }

  var BTN_BASE = "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

  function characterCardHtml(id) {
    var role = state.t.characters.roles[id];
    var pic = PICTURES[id];
    var media;
    if (id === "z230") {
      media =
        '<div class="flex h-full w-full flex-col items-center justify-center gap-2" aria-label="' + esc(role.name + " — " + role.role) + '">' +
        '<span aria-hidden="true" class="text-8xl anim-floaty">🐌</span>' +
        '<span aria-hidden="true" class="rounded-full bg-orange-900/80 px-4 py-1 font-mono text-xs font-bold tracking-widest text-lime-300">Z230 ONLINE</span></div>';
    } else {
      media = '<img src="' + pic + '" alt="' + esc(role.name + " — " + role.role) + '" class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy"/>';
    }
    var sayBtn =
      '<button type="button" data-say="' + id + '" class="' + BTN_BASE +
      " border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground h-8 gap-1.5 px-3 mt-auto w-full rounded-full border-2 border-orange-300 font-bold text-orange-800 hover:bg-orange-50\">" +
      esc(state.t.generic.say) + " 💬</button>";
    var familyBtn = id === "robot"
      ? '<button type="button" data-family="1" class="' + BTN_BASE +
        " bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 h-8 gap-1.5 px-3 w-full rounded-full bg-gradient-to-r from-purple-600 to-orange-500 font-bold text-white shadow-md transition-transform hover:scale-[1.03]\">" +
        "👨‍👩‍👧‍👦 " + esc(state.t.characters.familyCta) + "</button>"
      : "";
    return (
      '<div data-slot="card" class="bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm group flex flex-col overflow-hidden rounded-3xl border-2 border-orange-200 bg-white shadow-md transition-all hover:-translate-y-1 hover:border-orange-500 hover:shadow-xl">' +
      '<div class="relative aspect-square w-full overflow-hidden bg-gradient-to-br from-amber-100 to-orange-200">' + media + "</div>" +
      '<div data-slot="card-content" class="flex flex-1 flex-col gap-3 p-5">' +
      "<div><h3 class=\"text-lg font-black text-orange-950\">" + esc(role.name) + "</h3>" +
      '<p class="text-xs font-bold uppercase tracking-wide text-red-600">' + esc(role.role) + "</p></div>" +
      '<p class="text-sm font-medium leading-relaxed text-orange-900/75">' + esc(role.desc) + "</p>" +
      sayBtn + familyBtn +
      '<div data-slot="card-line"></div>' +
      "</div></div>"
    );
  }

  function renderCharacters() {
    $("#grid-main").innerHTML = MAIN_KEYS.map(characterCardHtml).join("");
    $("#grid-cameo").innerHTML = CAMEO_KEYS.map(characterCardHtml).join("");
    $$("[data-say]").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.getAttribute("data-say");
        sfx("click");
        var lines = state.t.characters.dialogues[id];
        var card = b.closest("[data-slot='card']");
        var slot = card.querySelector("[data-slot='card-line']");
        slot.innerHTML = dialogBoxHtml(id, pick(lines));
      });
    });
    $$("[data-family]").forEach(function (b) {
      b.addEventListener("click", function () {
        sfx("coin");
        openFamilyModal();
      });
    });
  }

  function sectionTitleHtml(emoji, title, subtitle) {
    return (
      '<div class="text-center"><span aria-hidden="true" class="inline-block text-5xl anim-floaty">' + emoji + "</span>" +
      '<h2 class="mt-3 text-3xl font-black tracking-tight text-orange-950 sm:text-4xl">' + esc(title) + "</h2>" +
      (subtitle ? '<p class="mx-auto mt-3 max-w-2xl text-base font-medium text-orange-800/70 sm:text-lg">' + esc(subtitle) + "</p>" : "") +
      "</div>"
    );
  }

  /* ---------- ferestre interne (Escape le închide mai întâi) ---------- */
  function openWindow(name, node) {
    closeWindow();
    $("#modal-root").appendChild(node);
    state.openWindow = name;
  }
  function closeWindow() {
    if (state.openWindow) {
      $("#modal-root").innerHTML = "";
      state.openWindow = null;
      return true;
    }
    return false;
  }

  function openFamilyModal() {
    var t = state.t.characters;
    var overlay =
      '<div data-slot="dialog-overlay" class="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50"></div>';
    var content =
      '<div data-slot="dialog-content" role="dialog" aria-modal="true" data-state="open" class="bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 rounded-3xl border-4 border-orange-300 bg-white p-4 shadow-lg duration-200 sm:max-w-lg">' +
      '<button type="button" data-close="1" class="ring-offset-background focus:ring-ring absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=&quot;size-&quot;])]:size-4">' + SVG.x + '<span class="sr-only">Close</span></button>' +
      '<div data-slot="dialog-header" class="flex flex-col gap-2 text-center">' +
      '<h2 data-slot="dialog-title" class="text-center text-lg font-black leading-none text-orange-950">' + esc(t.familyTitle) + "</h2>" +
      '<p data-slot="dialog-description" class="text-center text-sm font-semibold text-orange-700/80">' + esc(t.familySubtitle) + "</p></div>" +
      '<div class="overflow-hidden rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-100 to-orange-200">' +
      '<img src="assets/characters/familie.webp" alt="' + esc(t.familyAlt) + '" class="h-auto w-full object-cover"/></div>' +
      '<p class="text-center text-xs font-bold italic text-orange-600/70">' + esc(t.familyCaption) + "</p></div>";
    var node = el('<div class="fixed inset-0 z-50">' + overlay + content + "</div>");
    node.querySelector("[data-close]").addEventListener("click", closeWindow);
    node.querySelector("[data-slot='dialog-overlay']").addEventListener("click", closeWindow);
    openWindow("family", node);
  }

  /* ---------- meniul de limbi (dropdown custom) ---------- */
  function renderLangTrigger() {
    var trig = $("#lang-trigger");
    if (!trig) return;
    var cur = LANGS.filter(function (l) { return l.code === state.lang; })[0] || LANGS[2];
    trig.innerHTML =
      '<span aria-hidden="true">' + cur.flag + '</span><span class="uppercase">' + cur.code + "</span>" + SVG.chevron;
  }
  function toggleLangMenu() {
    if (state.openWindow === "lang") { closeWindow(); return; }
    var trig = $("#lang-trigger");
    var wrap = trig.parentNode;
    wrap.style.position = "relative";
    var items = LANGS.map(function (l) {
      return (
        '<button type="button" data-lang="' + l.code + '" role="option" class="focus:bg-accent focus:text-accent-foreground relative flex w-full cursor-pointer items-center gap-2 rounded-lg py-1.5 pr-8 pl-2 text-sm outline-none select-none hover:bg-accent">' +
        '<span aria-hidden="true" class="mr-2">' + l.flag + "</span>" + esc(l.label) + "</button>"
      );
    }).join("");
    var menu =
      '<div data-slot="select-content" class="noxis-lang-menu bg-popover text-popover-foreground relative z-50 min-w-[8rem] overflow-x-hidden overflow-y-auto rounded-xl border border-orange-200 shadow-md"><div class="p-1">' + items + "</div></div>";
    var node = el('<div class="fixed inset-0 z-50" data-lang-overlay="1"><div class="absolute inset-0"></div>' + menu + "</div>");
    node.firstElementChild.addEventListener("click", closeWindow);
    node.style.background = "transparent";
    var panel = node.querySelector("[data-slot='select-content']");
    panel.style.position = "fixed";
    var r = trig.getBoundingClientRect();
    panel.style.top = r.bottom + 4 + "px";
    panel.style.right = window.innerWidth - r.right + "px";
    panel.style.left = "auto";
    $$("[data-lang]", panel).forEach(function (b) {
      b.addEventListener("click", function () {
        closeWindow();
        setLang(b.getAttribute("data-lang"));
      });
    });
    openWindow("lang", node);
  }

  /* ---------- muzica (o singură instanță audio) ---------- */
  var SONG_TITLE = "NOXIS BBQ: WHERE'S THE MUSTARD?!";
  var SONG_ARTIST = "TARA NOXIS";
  function formatTime(sec) {
    if (!isFinite(sec) || sec < 0) return "0:00";
    var m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return m + ":" + (s < 10 ? "0" : "") + s;
  }
  function audio() { return $("#noxis-song"); }

  function enterSite(withMusic) {
    if (state.entered) return;
    state.entered = true;
    var w = $("#welcome");
    if (w) w.classList.add("noxis-gone");
    document.body.classList.remove("noxis-locked");
    if (withMusic) {
      var a = audio();
      a.volume = state.volume;
      var p = a.play();
      if (p && p.catch) p.catch(function () {});
    }
    renderPlayer();
  }

  function renderPlayer() {
    var t = state.t.music;
    var node = $("#noxis-player");
    node.classList.add("noxis-on");
    node.setAttribute("aria-label", SONG_ARTIST + " — " + SONG_TITLE);
    node.innerHTML =
      '<div class="mb-2 h-1 w-full overflow-hidden rounded-full bg-orange-100" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-label="' + esc(SONG_TITLE) + '"><div id="player-fill" class="h-full rounded-full bg-gradient-to-r from-red-600 via-orange-500 to-amber-400 transition-[width] duration-300" style="width:0%"></div></div>' +
      '<div class="flex items-center gap-2">' +
      '<button type="button" id="player-play" aria-label="' + esc(t.play) + '" class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-600 to-orange-500 text-white shadow-md transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-600">' + SVG.play + "</button>" +
      '<div class="min-w-0 flex-1 leading-tight">' +
      '<p class="truncate text-[0.7rem] font-black text-orange-950 sm:text-xs" title="' + esc(SONG_ARTIST + " — " + SONG_TITLE) + '">' + SONG_ARTIST + " — " + SONG_TITLE + "</p>" +
      '<p class="truncate text-[0.6rem] font-semibold text-orange-600/70">' + esc(t.nowPlaying) + " · Music © Tara Noxis" +
      '<span id="player-time" class="tabular-nums"></span></p></div>' +
      '<button type="button" id="player-mute" aria-label="' + esc(t.mute) + '" aria-pressed="false" class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-orange-200 bg-white text-orange-700 transition-colors hover:bg-orange-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-600">' + SVG.vol2 + "</button>" +
      '<input type="range" id="player-vol" min="0" max="1" step="0.01" value="' + state.volume + '" aria-label="' + esc(t.volume) + '" class="h-1.5 w-14 cursor-pointer accent-orange-600 sm:w-20"/>' +
      "</div>";
    $("#player-play").addEventListener("click", togglePlay);
    $("#player-mute").addEventListener("click", toggleMute);
    $("#player-vol").addEventListener("input", function () { setVolume(parseFloat(this.value)); });
    updatePlayerControls();
  }

  function updatePlayerControls() {
    var a = audio();
    var playBtn = $("#player-play");
    if (!playBtn) return;
    playBtn.innerHTML = a.paused ? SVG.play : SVG.pause;
    playBtn.setAttribute("aria-label", a.paused ? state.t.music.play : state.t.music.pause);
    var muteBtn = $("#player-mute");
    muteBtn.innerHTML = a.muted || a.volume === 0 ? SVG.volx : SVG.vol2;
    muteBtn.setAttribute("aria-label", a.muted ? state.t.music.unmute : state.t.music.mute);
    muteBtn.setAttribute("aria-pressed", a.muted ? "true" : "false");
    var vol = $("#player-vol");
    if (vol && document.activeElement !== vol) vol.value = a.muted ? 0 : a.volume;
  }

  function togglePlay() {
    var a = audio();
    if (a.paused) { var p = a.play(); if (p && p.catch) p.catch(function () {}); }
    else a.pause();
  }
  function toggleMute() { var a = audio(); a.muted = !a.muted; }
  function setVolume(v) {
    var a = audio();
    v = Math.min(1, Math.max(0, v));
    state.volume = v;
    a.volume = v;
    if (v > 0 && a.muted) a.muted = false;
  }
  function bindAudioEvents() {
    var a = audio();
    a.addEventListener("play", function () { updatePlayerControls(); });
    a.addEventListener("pause", function () { updatePlayerControls(); });
    a.addEventListener("ended", function () {
      a.currentTime = 0;
      $("#player-fill").style.width = "0%";
      $("#player-time").textContent = "";
      updatePlayerControls();
    });
    a.addEventListener("timeupdate", function () {
      var pct = a.duration > 0 ? Math.round((a.currentTime / a.duration) * 100) : 0;
      var f = $("#player-fill");
      if (f) f.style.width = pct + "%";
      var tm = $("#player-time");
      if (tm && isFinite(a.duration)) tm.textContent = " · " + formatTime(a.currentTime) + " / " + formatTime(a.duration);
    });
  }

  /* ---------- stres (Nyxer Stress Level) ---------- */
  function addStress(points, reason) {
    state.stress = Math.min(state.stress + points, 100);
    state.evId += 1;
    state.events.unshift({ id: state.evId, points: points, reason: reason });
    state.events = state.events.slice(0, 6);
    renderStress();
  }
  function resetStress() { state.stress = 10; state.events = []; renderStress(); }

  function renderStress() {
    var t = state.t.stress;
    var s = state.stress;
    var maxed = s >= 100;
    var level = s < 25 ? "calm" : s < 55 ? "worried" : s < 90 ? "panicked" : "meltdown";
    var FACE = { calm: "😌", worried: "😕", panicked: "😰", meltdown: "🤯" };
    $("#stress-number").innerHTML = s + '<span class="text-2xl font-bold text-orange-400">/100</span>';
    $("#stress-level").textContent = FACE[level] + " " + t.levels[level];
    $("#stress-needle").style.transform = "translateX(-50%) rotate(" + (-90 + (s / 100) * 180) + "deg)";
    var card = $("#stress-card");
    if (maxed) { card.classList.add("border-red-500", "anim-wiggle-hover"); card.classList.remove("border-orange-300"); }
    else { card.classList.remove("border-red-500", "anim-wiggle-hover"); card.classList.add("border-orange-300"); }
    // shout
    var old = $("#stress-shout");
    if (old) old.remove();
    if (maxed) {
      var shout = el('<p id="stress-shout" class="mx-auto mt-4 max-w-lg animate-pulse rounded-2xl border-4 border-red-500 bg-red-600 p-4 text-lg font-black leading-snug text-yellow-300 sm:text-xl">📢 ' + esc(t.shout) + "</p>");
      $("#stress-level").after(shout);
    }
    // jurnal
    var log = $("#stress-log");
    log.innerHTML =
      '<p class="text-sm font-black uppercase tracking-wide text-orange-700">' + esc(t.logTitle) + "</p>" +
      (state.events.length === 0
        ? '<p class="mt-2 text-sm font-medium italic text-orange-800/60">' + esc(t.emptyLog) + "</p>"
        : '<ul class="mt-2 max-h-40 space-y-1.5 overflow-y-auto pr-1">' +
          state.events.map(function (ev) {
            return '<li class="flex items-start gap-2 rounded-lg bg-white/80 px-3 py-1.5 text-sm font-medium text-orange-900/85"><span class="shrink-0 font-black text-red-600">+' + ev.points + "</span><span>" + esc(t.reasons[ev.reason]) + "</span></li>";
          }).join("") + "</ul>") +
      (s === 10 && state.events.length === 0 && s > 0
        ? '<p class="mt-2 text-sm font-bold italic text-emerald-700">' + esc(t.afterReset) + "</p>"
        : "");
  }

  /* ---------- vânătoarea muștarului ---------- */
  var SPOT_EMOJI = ["🧊", "🗄️", "🗄️", "🔥", "📺", "🧂", "🍪", "🧼", "🥫", "🗑️", "🧰", "🎄"];
  var DECOY = { 6: 0, 10: 1, 11: 2 };
  var NEAR = [0, 1, 2, 5, 7];
  var FAR = [3, 4, 8, 9];
  var REACT_KEYS = ["robot", "nyxer", "aren", "nyra", "z230", "tara", "aron", "nyxar"];

  function huntReset() {
    state.jarSpot = rnd(12);
    state.searched = {};
    state.attempts = 0;
    state.found = false;
    state.outcome = null;
    state.reactKey = "robot";
    renderHunt();
  }
  function searchSpot(i) {
    if (state.found || state.searched[i]) return;
    sfx("click");
    state.searched[i] = true;
    state.attempts += 1;
    var t = state.t.mustard;
    if (i === state.jarSpot) {
      sfx("win");
      state.found = true;
      state.outcome = { kind: "win" };
      addStress(5, "mustard");
    } else if (i in DECOY) {
      var d = t.decoys[DECOY[i]];
      state.outcome = { kind: "decoy", title: d.title, text: d.text };
      addStress(1, "wrongSearch");
    } else if ((NEAR.indexOf(i) >= 0) === (NEAR.indexOf(state.jarSpot) >= 0)) {
      sfx("coin");
      state.outcome = { kind: "near", text: pick(t.cluesNear) };
    } else {
      sfx("sad");
      state.outcome = { kind: "far", text: pick(t.cluesFar) };
      addStress(1, "wrongSearch");
    }
    state.reactKey = REACT_KEYS[(REACT_KEYS.indexOf(state.reactKey) + 1) % REACT_KEYS.length];
    renderHunt();
  }
  function renderHunt() {
    var t = state.t.mustard;
    $("#hunt-attempts").textContent = state.attempts;
    $("#hunt-spots").innerHTML = t.spots.map(function (spot, i) {
      var searched = !!state.searched[i];
      var isJar = state.found && i === state.jarSpot;
      var cls =
        "flex flex-col items-center gap-1.5 rounded-2xl border-2 p-3 text-center transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 " +
        (isJar
          ? "border-lime-500 bg-lime-50 shadow-lg shadow-lime-500/30"
          : searched
            ? "cursor-not-allowed border-orange-200 bg-orange-100/60 opacity-60"
            : "border-orange-200 bg-white hover:-translate-y-0.5 hover:border-orange-500 hover:bg-orange-50 hover:shadow-md active:scale-95");
      return (
        '<button type="button" data-spot="' + i + '"' + (searched || state.found ? " disabled" : "") +
        ' aria-label="' + esc(t.start + " " + spot) + '" class="' + cls + '">' +
        '<span aria-hidden="true" class="text-3xl' + (isJar ? " anim-flicker" : "") + '">' + (isJar ? "🏺" : SPOT_EMOJI[i]) + "</span>" +
        '<span class="text-[0.7rem] font-bold leading-tight text-orange-900/80">' + esc(spot) + "</span></button>"
      );
    }).join("");
    $$("[data-spot]").forEach(function (b) {
      b.addEventListener("click", function () { searchSpot(parseInt(b.getAttribute("data-spot"), 10)); });
    });
    var out = $("#hunt-outcome");
    var html = "";
    if (state.outcome && !state.found) {
      var o = state.outcome;
      var cls = o.kind === "near" ? "border-amber-400 bg-amber-50" : o.kind === "decoy" ? "border-purple-300 bg-purple-50" : "border-sky-300 bg-sky-50";
      html += '<div class="rounded-2xl border-2 p-4 text-center ' + cls + '" aria-live="polite">' +
        (o.title ? '<p class="text-lg font-black text-orange-950">' + esc(o.title) + "</p>" : "") +
        '<p class="mt-1 text-base font-bold text-orange-900/85">' + esc(o.text) + "</p></div>";
      var lines = state.t.mustard.reactions[state.reactKey];
      if (lines) {
        html += dialogBoxHtml(state.reactKey, lines[state.attempts % lines.length]);
      }
    }
    if (state.found) {
      var w = state.t.mustard.win;
      html += '<div class="space-y-3 rounded-2xl border-4 border-lime-400 bg-lime-50 p-5 text-center" aria-live="polite">' +
        '<p class="text-2xl font-black text-lime-700 sm:text-3xl">🏺 ' + esc(w.title) + "</p>" +
        '<p class="text-base font-bold text-orange-900/85">' + esc(w.empty) + "</p>" +
        '<p class="text-base font-medium text-orange-900/75">' + esc(w.robotConfession) + "</p>" +
        '<p class="text-base font-bold italic text-red-700">' + esc(w.nyraLine) + "</p>" +
        '<div class="flex flex-wrap justify-center gap-2 pt-1 text-3xl" aria-hidden="true"><span class="anim-floaty">🤖</span><span class="anim-flicker">🔥</span><span class="anim-floaty" style="animation-delay:0.7s">👑</span></div>' +
        '<button type="button" data-hunt-again="1" class="' + BTN_BASE + " bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 mt-2 h-12 rounded-full bg-lime-600 px-8 text-base font-black text-white shadow-lg shadow-lime-600/30 transition-transform hover:scale-105 hover:bg-lime-700\">" + esc(w.again) + " 🔁</button></div>";
    }
    out.innerHTML = html;
    var again = $("[data-hunt-again]");
    if (again) again.addEventListener("click", huntReset);
  }

  /* ---------- ERROR 402 (comanda de 100 de mici) ---------- */
  function renderOrder() {
    var t = state.t.order402;
    var stage = state.stage;
    var started = stage > 0;
    var html = "";
    if (!started) {
      html =
        '<div class="space-y-6"><span aria-hidden="true" class="inline-block text-7xl anim-floaty">🌭</span>' +
        '<p class="mx-auto max-w-md text-base font-bold text-orange-900/75">' + esc(t.disclaimer) + "</p>" +
        '<button type="button" data-order-start="1" class="' + BTN_BASE + " bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 h-16 rounded-full bg-red-600 px-10 text-xl font-black text-white shadow-lg shadow-red-600/40 transition-transform hover:scale-105 active:scale-95 hover:bg-red-700\">" + esc(t.button) + "</button></div>";
    } else {
      var panic = "";
      for (var i = 2; i <= Math.min(stage, 4); i++) {
        panic += '<p class="rounded-xl bg-red-50 p-3 text-base font-bold text-red-800 anim-pop">' + esc(t.panic[i - 2]) + "</p>";
      }
      if (stage >= 5) panic += '<p class="rounded-xl bg-emerald-50 p-3 text-base font-bold text-emerald-800 anim-pop">' + esc(t.taraLine) + "</p>";
      if (stage >= 6) panic += '<p class="rounded-xl border-2 border-red-300 bg-white p-3 text-lg font-black text-red-700 anim-pop">' + esc(t.nyxerFinal) + "</p>";
      var btn = stage < 6
        ? '<button type="button" data-order-advance="1" class="' + BTN_BASE + " bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 h-12 rounded-full bg-orange-600 px-8 text-base font-black text-white shadow-lg shadow-orange-600/30 transition-transform hover:scale-105 hover:bg-orange-700\">" + esc(stage === 1 ? t.button : state.t.generic.say) + " ▶</button>"
        : '<button type="button" data-order-reset="1" class="' + BTN_BASE + " bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 h-12 rounded-full bg-red-600 px-8 text-base font-black text-white shadow-lg shadow-red-600/30 transition-transform hover:scale-105 hover:bg-red-700\">" + esc(t.again) + " 🔁</button>";
      html =
        '<div class="space-y-4">' +
        '<div class="rounded-2xl border-4 border-red-600 bg-red-600 p-5 shadow-lg" aria-live="polite"><p class="font-mono text-2xl font-black tracking-widest text-yellow-300 sm:text-3xl">⚠ ' + esc(t.errorTitle) + ' ⚠</p><p class="mt-2 text-sm font-bold text-white/90">' + esc(t.errorSub) + "</p></div>" +
        '<div class="space-y-2 text-left">' + panic + "</div>" +
        '<div class="flex flex-wrap items-center justify-center gap-3 pt-2">' + btn + "</div>" +
        '<p class="pt-2 text-xs font-semibold italic text-orange-700/60">' + esc(t.disclaimer) + "</p></div>";
    }
    $("[data-noxis-order]").innerHTML = html;
    var s = $("[data-order-start]");
    if (s) s.addEventListener("click", function () { sfx("error"); state.stage = 1; addStress(7, "order"); renderOrder(); });
    var adv = $("[data-order-advance]");
    if (adv) adv.addEventListener("click", function () { sfx("click"); state.stage = Math.min(state.stage + 1, 6); renderOrder(); });
    var rst = $("[data-order-reset]");
    if (rst) rst.addEventListener("click", function () { sfx("sad"); state.stage = 0; renderOrder(); });
  }

  /* ---------- Nyra (mini-jocul) ---------- */
  var FOODS = [
    { key: "salmon", emoji: "🐟", safe: true }, { key: "chicken", emoji: "🍗", safe: true },
    { key: "egg", emoji: "🥚", safe: true }, { key: "cheese", emoji: "🧀", safe: true },
    { key: "shrimp", emoji: "🍤", safe: true }, { key: "milk", emoji: "🥛", safe: false },
    { key: "onion", emoji: "🧅", safe: false }, { key: "garlic", emoji: "🧄", safe: false },
    { key: "chocolate", emoji: "🍫", safe: false }, { key: "grapes", emoji: "🍇", safe: false },
  ];
  function renderNyra() {
    var t = state.t.nyra;
    var mood = state.nyraMood;
    var face = mood === "eating" ? "😋" : mood === "angry" ? "😾" : mood === "disdain" ? "🙄" : mood === "menu" ? "😼" : "🐱";
    var anim = mood === "eating" ? "anim-pop" : mood === "angry" ? "anim-wiggle-hover" : "anim-floaty";
    var chips = state.nyraAccepted.length
      ? '<div class="flex flex-wrap justify-center gap-2">' + state.nyraAccepted.map(function (it) {
          return '<span class="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-900">' + esc(it) + " ✓</span>";
        }).join("") + "</div>"
      : "";
    var foods = '<div class="grid w-full grid-cols-5 gap-2 sm:gap-3">' + FOODS.map(function (f) {
      var name = t.foods[f.key];
      return (
        '<button type="button" data-food="' + f.key + '" aria-label="' + esc(t.offer + ": " + name + (f.safe ? "" : " (" + t.unsafeLabel + ")")) +
        '" title="' + esc(f.safe ? t.safeLabel : t.unsafeLabel) +
        '" class="flex flex-col items-center gap-1 rounded-2xl border-2 p-2.5 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 hover:-translate-y-0.5 active:scale-95 sm:p-3 ' +
        (f.safe ? "border-lime-300 bg-lime-50 hover:border-lime-500 hover:shadow-md" : "border-red-300 bg-red-50 hover:border-red-500 hover:shadow-md") + '">' +
        '<span aria-hidden="true" class="text-2xl sm:text-3xl">' + f.emoji + "</span>" +
        '<span class="text-[0.65rem] font-bold leading-tight text-orange-900/80 sm:text-xs">' + esc(name) + "</span>" +
        '<span aria-hidden="true" class="text-[0.6rem]">' + (f.safe ? "✅" : "⚠️") + "</span></button>"
      );
    }).join("") + "</div>";
    var line = state.nyraLine ? dialogBoxHtml("nyra", state.nyraLine) : "";
    var menuBtns = mood === "menu"
      ? '<div class="flex flex-wrap items-center justify-center gap-3">' +
        '<button type="button" data-nyra-ask="1" class="' + BTN_BASE + " bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 h-11 rounded-full bg-orange-600 px-6 text-sm font-black text-white shadow hover:bg-orange-700\">" + esc(t.nyxerQuestion) + " 🧾</button>" +
        '<button type="button" data-nyra-reset="1" class="' + BTN_BASE + " border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground h-11 rounded-full border-2 border-orange-300 px-5 text-sm font-bold text-orange-800 hover:bg-orange-50\">" + esc(state.t.generic.reset) + " ↺</button></div>"
      : "";
    $("[data-noxis-nyra]").innerHTML =
      '<div class="flex flex-col items-center gap-4">' +
      '<span aria-hidden="true" class="inline-block text-7xl sm:text-8xl ' + anim + '">' + face + "</span>" + chips + foods + line + menuBtns +
      '<p class="text-center text-xs font-semibold italic text-orange-700/70">⚠️ ' + esc(t.vetNote) + "</p></div>";
    $$("[data-food]").forEach(function (b) {
      b.addEventListener("click", function () { offerFood(b.getAttribute("data-food")); });
    });
    var ask = $("[data-nyra-ask]");
    if (ask) ask.addEventListener("click", function () {
      sfx("click"); state.nyraLine = state.t.nyra.nyraAnswer; state.nyraMood = "menu"; renderNyra();
    });
    var rst = $("[data-nyra-reset]");
    if (rst) rst.addEventListener("click", function () {
      sfx("sad"); state.nyraMood = "idle"; state.nyraLine = null; state.nyraAccepted = []; renderNyra();
    });
  }
  function offerFood(key) {
    var t = state.t.nyra;
    var f = null;
    for (var i = 0; i < FOODS.length; i++) if (FOODS[i].key === key) f = FOODS[i];
    var name = t.foods[key];
    if (!f.safe) {
      sfx("error");
      state.nyraLine = pick(t.reject).replace("{food}", name);
      state.nyraMood = "angry";
      renderNyra();
      return;
    }
    if (Math.random() < 0.35) {
      sfx("meow");
      state.nyraLine = pick(t.disdain);
      state.nyraMood = "disdain";
    } else {
      sfx("coin");
      state.nyraLine = pick(t.accepted);
      state.nyraMood = "eating";
      var label = f.emoji + " " + name;
      if (state.nyraAccepted.indexOf(label) < 0 && state.nyraAccepted.length < 3) {
        state.nyraAccepted.push(label);
        if (state.nyraAccepted.length === 3) {
          window.setTimeout(function () {
            state.nyraMood = "menu";
            state.nyraLine = t.specialMenu;
            addStress(2, "nyraMenu");
            sfx("win");
            renderNyra();
          }, 700);
        }
      }
    }
    renderNyra();
  }

  /* ---------- Z230 (melcul supraîncălzit) ---------- */
  function renderZ230Shell() {
    $("[data-noxis-z230]").innerHTML =
      '<div class="relative mx-auto flex h-40 w-40 items-center justify-center sm:h-48 sm:w-48">' +
      '<span id="z-smoke1" aria-hidden="true" class="absolute left-6 top-2 text-2xl anim-smoke">💨</span>' +
      '<span id="z-smoke2" aria-hidden="true" class="absolute right-8 top-0 text-xl anim-smoke" style="animation-delay:1.1s">💨</span>' +
      '<span id="z-smoke3" aria-hidden="true" class="absolute right-2 top-4 text-2xl anim-smoke" style="animation-delay:2.2s">💨</span>' +
      '<span id="z-snail" aria-hidden="true" class="text-8xl sm:text-9xl anim-floaty">🐌</span>' +
      '<span aria-hidden="true" class="absolute -bottom-1 rounded-full bg-orange-900/85 px-3 py-0.5 font-mono text-[0.65rem] font-bold tracking-widest text-lime-300" id="z-badge">Z230 · TEMP OK</span></div>' +
      '<div class="mt-4 flex items-center justify-center gap-3">' +
      '<div id="z-robot" class="relative h-16 w-16 overflow-hidden rounded-2xl border-2 border-orange-200"><img src="assets/characters/robot.webp" alt="" class="h-full w-full object-cover"/></div>' +
      '<span id="z-fire" aria-hidden="true" class="text-2xl opacity-40">🔥</span>' +
      '<span id="z-robot-label" class="text-xs font-bold uppercase tracking-wider text-orange-700/70"></span></div>' +
      '<div class="mx-auto mt-6 max-w-md">' +
      '<div class="flex items-center justify-between text-xs font-bold text-orange-800/70"><span>0 °SN</span><span id="z-tlabel"></span><span>120 °SN</span></div>' +
      '<div class="mt-1.5 h-6 w-full overflow-hidden rounded-full border border-orange-200 bg-orange-100"><div id="z-fill" class="h-full rounded-full transition-all duration-500 bg-lime-500" style="width:18%" role="meter" aria-valuemin="0" aria-valuemax="120"></div></div>' +
      '<p id="z-temp" class="mt-1 text-lg font-black tabular-nums text-orange-950">22 °SN</p></div>' +
      '<div id="z-line" class="mt-4 text-left"></div>' +
      '<div class="mt-6 flex flex-wrap items-center justify-center gap-3">' +
      '<button type="button" id="z-start" class="' + BTN_BASE + " bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 h-10 px-4 h-14 rounded-full bg-red-600 px-8 text-lg font-black text-white shadow-lg shadow-red-600/40 transition-transform hover:scale-105 active:scale-95 hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50\">🔥 <span id=\"z-start-label\"></span></button>" +
      '<button type="button" id="z-stop" class="' + BTN_BASE + " border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground h-10 px-4 h-14 rounded-full border-2 border-sky-300 bg-sky-50 px-6 text-base font-bold text-sky-800 hover:bg-sky-100\">🧊 <span id=\"z-stop-label\"></span></button></div>" +
      '<p id="z-disclaimer" class="mt-5 text-xs font-semibold italic text-orange-700/60"></p>';
    $("#z-start").addEventListener("click", zStart);
    $("#z-stop").addEventListener("click", zCool);
    zUpdateTexts();
    zUpdateView();
  }
  function zUpdateTexts() {
    var t = state.t.z230;
    $("#z-tlabel").textContent = t.tempLabel;
    $("#z-start-label").textContent = t.start;
    $("#z-stop-label").textContent = t.stop;
    $("#z-disclaimer").textContent = "⚠️ " + t.disclaimer;
    $("#z-robot-label").textContent = state.t.hero.caption.split("—")[0].trim();
  }
  function zUpdateView() {
    var t = state.t.z230;
    var cooking = state.zCooking, phase = state.zPhase, temp = state.zTemp;
    ["z-smoke1", "z-smoke2", "z-smoke3"].forEach(function (id) {
      var n = $("#" + id);
      if (n) n.style.display = cooking ? "" : "none";
    });
    var snail = $("#z-snail");
    snail.className = "text-8xl sm:text-9xl " + (cooking ? "anim-drift" : "anim-floaty") + (phase === "shutdown" ? " opacity-40 grayscale" : "");
    $("#z-badge").textContent = "Z230 · TEMP " + (cooking ? "↑↑" : "OK");
    $("#z-robot").className = "relative h-16 w-16 overflow-hidden rounded-2xl border-2 border-orange-200" + (cooking ? " anim-wiggle-hover" : "");
    $("#z-fire").className = "text-2xl " + (cooking ? "anim-flicker" : "opacity-40");
    var pct = Math.min((temp / 120) * 100, 100);
    var color = temp < 40 ? "bg-lime-500" : temp < 70 ? "bg-amber-400" : temp < 95 ? "bg-orange-500" : "bg-red-600";
    var fill = $("#z-fill");
    fill.className = "h-full rounded-full transition-all duration-500 " + color;
    fill.style.width = pct + "%";
    fill.setAttribute("aria-valuenow", Math.round(temp));
    fill.setAttribute("aria-label", t.tempLabel);
    $("#z-temp").textContent = Math.round(temp) + " °SN";
    var lineBox = $("#z-line");
    lineBox.innerHTML = state.zLine ? dialogBoxHtml("z230", state.zLine) : "";
    $("#z-start").disabled = cooking;
  }
  function zStart() {
    if (state.zCooking) return;
    sfx("sizzle");
    state.zCooking = true;
    state.zLine = state.t.z230.react;
    if (state.zTimer) clearInterval(state.zTimer);
    state.zTimer = window.setInterval(function () {
      state.zTemp = Math.min(state.zTemp + Math.random() * 6 + 2, 120);
      var cur = state.zTemp;
      if (cur >= 115 && state.zPhase !== "shutdown") {
        state.zPhase = "shutdown";
        state.zCooking = false;
        state.zLine = state.t.z230.shutdown;
        clearInterval(state.zTimer);
        sfx("boom");
      } else if (cur >= 95 && state.zPhase !== "critical" && state.zPhase !== "shutdown") {
        state.zPhase = "critical";
        state.zLine = pick(state.t.z230.lines.critical);
        addStress(4, "z230hot");
        sfx("error");
      } else if (cur >= 70 && state.zPhase !== "hot" && state.zPhase !== "critical" && state.zPhase !== "shutdown") {
        state.zPhase = "hot";
        state.zLine = pick(state.t.z230.lines.hot);
        sfx("sizzle");
      } else if (cur >= 40 && state.zPhase === "idle") {
        state.zPhase = "warm";
        state.zLine = pick(state.t.z230.lines.warm);
      }
      zUpdateView();
    }, 700);
    zUpdateView();
  }
  function zCool() {
    if (state.zTimer) clearInterval(state.zTimer);
    state.zTemp = 22; state.zPhase = "idle"; state.zCooking = false; state.zLine = null;
    sfx("coin");
    zUpdateView();
  }

  /* ---------- comandamente (acordeon) ---------- */
  function renderComandamente() {
    var items = state.t.comandamente.items;
    $("#comandamente-list").innerHTML = items.map(function (item, i) {
      return (
        '<div data-acc-item="' + i + '" data-state="closed" class="rounded-2xl border-2 border-orange-200 bg-white px-5 shadow-sm transition-colors hover:border-orange-400">' +
        '<div class="flex">' +
        '<button type="button" data-acc-toggle="' + i + '" class="focus-visible:border-ring focus-visible:ring-ring/50 flex flex-1 items-start justify-between gap-4 rounded-md py-4 text-left text-base font-black transition-all outline-none hover:no-underline focus-visible:ring-[3px] text-orange-950 hover:text-red-700 sm:text-lg">' +
        '<span class="flex items-center gap-3"><span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-600 to-orange-500 text-sm font-black text-white shadow">' + (i + 1) + "</span>" + esc(item.title) + "</span>" +
        SVG.chevronAcc + "</button></div>" +
        '<div class="noxis-acc-content"><div class="pt-0 pb-4"><p class="pl-11 text-base font-medium leading-relaxed text-orange-900/80">' + esc(item.text) + "</p></div></div></div>"
      );
    }).join("");
    $$("[data-acc-toggle]").forEach(function (b) {
      b.addEventListener("click", function () {
        var i = b.getAttribute("data-acc-toggle");
        var item = $('[data-acc-item="' + i + '"]');
        var content = $(".noxis-acc-content", item);
        var open = item.getAttribute("data-state") === "open";
        if (open) {
          content.style.height = content.scrollHeight + "px";
          requestAnimationFrame(function () { content.style.height = "0px"; });
          item.setAttribute("data-state", "closed");
        } else {
          item.setAttribute("data-state", "open");
          content.style.height = content.scrollHeight + "px";
          content.addEventListener("transitionend", function done() {
            if (item.getAttribute("data-state") === "open") content.style.height = "auto";
            content.removeEventListener("transitionend", done);
          });
        }
        sfx("click");
      });
    });
  }

  /* ---------- tipuri + dicționar (grile statice din dicționar) ---------- */
  var TIPURI_EMOJI = ["🎨", "🧘", "🥷", "📋", "🧪", "🎖️"];
  function renderTipuri() {
    $("#tipuri-grid").innerHTML = state.t.tipuri.items.map(function (tip, i) {
      return (
        '<div data-slot="card" class="bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm group overflow-hidden rounded-3xl border-2 border-orange-200 bg-white shadow-md transition-all hover:-translate-y-1 hover:border-orange-500 hover:shadow-xl">' +
        '<div data-slot="card-content" class="p-6">' +
        '<div class="flex items-center gap-4"><span aria-hidden="true" class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-orange-200 text-3xl transition-transform group-hover:scale-110 group-hover:rotate-6">' + TIPURI_EMOJI[i] + "</span>" +
        "<div><h3 class=\"text-xl font-black text-orange-950\">" + esc(tip.name) + '</h3><p class="text-xs font-bold uppercase tracking-wide text-orange-600">' + esc(tip.level) + "</p></div></div>" +
        '<p class="mt-4 text-base font-bold italic text-red-700">' + esc(tip.motto) + "</p>" +
        '<p class="mt-2 text-base leading-relaxed font-medium text-orange-900/75">' + esc(tip.desc) + "</p></div></div>"
      );
    }).join("");
  }
  function renderDictionar() {
    $("#dictionar-grid").innerHTML = state.t.dictionar.items.map(function (item) {
      return (
        '<div data-slot="card" class="bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm rounded-3xl border-2 border-orange-200 bg-white shadow-md transition-all hover:-translate-y-1 hover:border-orange-500 hover:shadow-lg">' +
        '<div data-slot="card-content" class="p-6">' +
        '<h3 class="text-xl font-black text-red-700">' + esc(item.term) + "</h3>" +
        '<p class="mt-1 text-sm font-bold italic text-orange-500">' + esc(item.phonetic) + "</p>" +
        '<p class="mt-3 text-base leading-relaxed font-medium text-orange-900/80">' + esc(item.def) + "</p></div></div>"
      );
    }).join("");
  }

  /* ---------- quiz ---------- */
  var ANSWER_MAP = [
    ["Planner", "Philosopher", "Veteran"],
    ["Planner", "Ninja", "Artist"],
    ["Philosopher", "Ninja", "Veteran"],
    ["Experimenter", "Artist", "Ninja"],
  ];
  function renderQuiz() {
    var t = state.t.quiz;
    var html;
    if (!state.qDone) {
      var q = t.questions[state.qIndex];
      html =
        '<div><div class="flex items-center justify-between">' +
        '<span class="rounded-full bg-orange-100 px-4 py-1 text-sm font-black text-orange-800">' + esc(t.qOf) + " " + (state.qIndex + 1) + " " + esc(t.of) + " " + t.questions.length + "</span>" +
        '<span class="text-2xl" aria-hidden="true">🍖</span></div>' +
        '<div class="mt-4 h-2 w-full overflow-hidden rounded-full bg-orange-100"><div class="h-full rounded-full bg-gradient-to-r from-red-600 to-amber-400 transition-all duration-300" style="width:' + (((state.qIndex + 1) / t.questions.length) * 100) + '%"></div></div>' +
        '<h3 class="mt-6 text-center text-xl font-black leading-snug text-orange-950 sm:text-2xl">' + esc(q.q) + "</h3>" +
        '<div class="mt-8 space-y-3">' +
        q.a.map(function (ans, i) {
          return (
            '<button type="button" data-quiz-answer="' + i + '" class="' + BTN_BASE +
            " border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground h-auto w-full rounded-2xl border-2 border-orange-200 bg-amber-50/50 px-5 py-4 text-left text-base font-bold text-orange-950 transition-all hover:scale-[1.02] hover:border-orange-500 hover:bg-orange-50\">" +
            '<span class="mr-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-600 to-orange-500 text-sm font-black text-white">' + String.fromCharCode(65 + i) + "</span>" + esc(ans) + "</button>"
          );
        }).join("") + "</div></div>";
    } else {
      var best = "Philosopher", max = -1;
      Object.keys(state.qScores).forEach(function (k) {
        if (state.qScores[k] > max) { max = state.qScores[k]; best = k; }
      });
      var icons = { Philosopher: "🧘", Artist: "🎨", Ninja: "🥷", Planner: "📋", Experimenter: "🧪", Veteran: "🎖️" };
      html =
        '<div class="text-center"><p class="text-sm font-bold uppercase tracking-widest text-orange-600">' + esc(t.resultTitle) + "</p>" +
        '<span aria-hidden="true" class="mt-4 inline-block text-7xl anim-floaty">' + icons[best] + "</span>" +
        '<h3 class="mt-3 text-3xl font-black text-red-600 sm:text-4xl">' + esc(t.results[best].name) + "</h3>" +
        '<p class="mx-auto mt-4 max-w-md text-lg font-medium leading-relaxed text-orange-900/80">' + esc(t.results[best].desc) + "</p>" +
        (state.qAnswered === 0 ? '<p class="mt-4 text-sm font-bold italic text-orange-600">' + esc(t.ghost) + "</p>" : "") +
        '<button type="button" data-quiz-restart="1" class="' + BTN_BASE + " bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 mt-8 h-12 rounded-full bg-orange-600 px-8 text-base font-black text-white shadow-lg shadow-orange-600/30 transition-transform hover:scale-105 hover:bg-orange-700\">" + esc(t.restart) + "</button></div>";
    }
    $("[data-noxis-quiz]").innerHTML = html;
    $$("[data-quiz-answer]").forEach(function (b) {
      b.addEventListener("click", function () {
        var i = parseInt(b.getAttribute("data-quiz-answer"), 10);
        state.qScores[ANSWER_MAP[state.qIndex][i]] += 1;
        state.qAnswered += 1;
        if (state.qIndex + 1 >= state.t.quiz.questions.length) state.qDone = true;
        else state.qIndex += 1;
        renderQuiz();
      });
    });
    var rst = $("[data-quiz-restart]");
    if (rst) rst.addEventListener("click", function () {
      state.qIndex = 0; state.qDone = false; state.qAnswered = 0;
      state.qScores = { Philosopher: 0, Artist: 0, Ninja: 0, Planner: 0, Experimenter: 0, Veteran: 0 };
      renderQuiz();
    });
  }

  /* ---------- scuze ---------- */
  function renderScuzeBox() {
    var box = $("#scuze-box");
    if (state.scuza) {
      box.innerHTML = '<p class="text-xl font-black leading-relaxed text-red-700 anim-pop sm:text-2xl">' + esc(state.scuza) + "</p>";
    } else {
      box.innerHTML = '<p class="text-lg font-bold italic text-orange-800/60">' + esc(state.t.scuze.placeholder) + "</p>";
    }
    var counter = $("#scuze-counter");
    if (!counter) {
      counter = el('<p id="scuze-counter" class="mt-4 text-sm font-bold text-orange-700/70 hidden"></p>');
      var genBtn = $('#scuze button[data-slot="button"]');
      if (genBtn) genBtn.after(counter); else $("#scuze-box").after(counter);
    }
    if (state.scuzeCount > 0) {
      counter.innerHTML = esc(state.t.scuze.counter) + ': <span class="tabular-nums">' + state.scuzeCount + "</span>" + (state.scuzeCount >= 5 ? esc(state.t.scuze.legend) : "");
      counter.classList.remove("hidden");
    } else {
      counter.classList.add("hidden");
    }
  }

  /* ---------- miciometru ---------- */
  function miciMilestoneIndex(c) {
    if (c === 0) return 0;
    if (c < 3) return 1;
    if (c < 5) return 2;
    if (c < 8) return 3;
    if (c < 10) return 4;
    if (c < 15) return 5;
    if (c < 20) return 6;
    if (c < 30) return 7;
    if (c < 50) return 8;
    return 9;
  }
  function renderMici() {
    var t = state.t.miciometru;
    var c = state.mici;
    var countEl = $("#mici-count");
    countEl.textContent = c;
    countEl.classList.remove("anim-pop");
    void countEl.offsetWidth;
    countEl.classList.add("anim-pop");
    $("#mici-progress").style.transform = "translateX(-" + (100 - Math.min((c / 50) * 100, 100)) + "%)";
    $("#mici-milestone").textContent = t.milestones[miciMilestoneIndex(c)];
  }

  /* ---------- Zidul Comediei (versiune statică ONESTĂ) ---------- */
  function renderWallTitle() {
    $("#wall-title").innerHTML = sectionTitleHtml("🧱", state.t.wall.title, state.t.wall.subtitle);
    var docLink = $("#wall-doc-link");
    if (docLink) docLink.textContent = state.t.wall.backendDoc;
  }

  /* ---------- sigiliul ---------- */
  function bindSeal() {
    var seal = $("#seal");
    if (!seal || seal._bound) return;
    seal._bound = true;
    seal.addEventListener("click", function () {
      sfx("boom");
      var inner = seal.querySelector("span:nth-of-type(2)") || seal.querySelector("span.rounded-full");
      inner.classList.add("rotate-[360deg]");
      window.setTimeout(function () { inner.classList.remove("rotate-[360deg]"); }, 900);
    });
  }

  /* ---------- nav ---------- */
  function bindNav() {
    var snd = $("#sound-toggle");
    snd.addEventListener("click", function () {
      state.soundOn = !state.soundOn;
      setSoundEnabled(state.soundOn);
      try { localStorage.setItem(STORE_SOUND, state.soundOn ? "on" : "off"); } catch (e) {}
      updateSoundBtn();
      if (state.soundOn) window.setTimeout(function () { sfx("coin"); }, 50);
    });
    var trig = $("#lang-trigger");
    trig.addEventListener("click", toggleLangMenu);
    // împiedică deschiderea nativă Radix (nu există Radix aici)
  }
  function updateSoundBtn() {
    var snd = $("#sound-toggle");
    snd.innerHTML = state.soundOn ? SVG.vol2.replace('class="h-4 w-4"', 'class="h-4.5 w-4.5"') : SVG.volx.replace('class="h-4 w-4"', 'class="h-4.5 w-4.5"');
    snd.setAttribute("aria-pressed", state.soundOn ? "true" : "false");
    snd.setAttribute("title", state.soundOn ? state.t.nav.soundOn : state.t.nav.soundOff);
    snd.setAttribute("aria-label", state.soundOn ? state.t.nav.soundOn : state.t.nav.soundOff);
  }

  /* ---------- Escape & back ---------- */
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (!state.entered) { enterSite(false); return; }        // 1. welcome → intră fără muzică
    if (state.openWindow) { closeWindow(); return; }          // 2. ferestre interne → închide
    window.location.href = BACK_URL;                          // 3. altfel → NOXIS UNIVERS
  });

  /* ---------- randare completă la schimbarea limbii ---------- */
  function renderAll() {
    renderLangTrigger();
    updateSoundBtn();
    renderCharacters();
    renderHunt();
    renderOrder();
    renderStress();
    renderNyra();
    renderZ230Shell();
    renderComandamente();
    renderTipuri();
    renderQuiz();
    renderDictionar();
    renderScuzeBox();
    renderMici();
    renderWallTitle();
    if (state.entered) renderPlayer();
    bindSeal();
    // rebind butoanele statice care rămân în DOM (după swap-ul de text rămân aceleași elemente)
    bindStaticButtons();
  }

  function bindStaticButtons() {
    // hunt reset (element static)
    var huntResetBtn = $('#mustard button[data-slot="button"]');
    if (huntResetBtn && !huntResetBtn._bound) {
      huntResetBtn._bound = true;
      huntResetBtn.addEventListener("click", function () { sfx("click"); huntReset(); });
    }
    // stress: chaos + reset
    var stressBtns = $$('#stress button[data-slot="button"]');
    if (stressBtns[0] && !stressBtns[0]._bound) {
      stressBtns[0]._bound = true;
      stressBtns[0].addEventListener("click", function () {
        var keys = ["chaosTara", "chaosAren", "chaosRobot", "chaosNyra", "chaosZ230"];
        var pts = { chaosTara: 4, chaosAren: 3, chaosRobot: 3, chaosNyra: 2, chaosZ230: 3 };
        var k = pick(keys);
        sfx(state.stress >= 100 ? "error" : "click");
        addStress(pts[k], k);
      });
    }
    if (stressBtns[1] && !stressBtns[1]._bound) {
      stressBtns[1]._bound = true;
      stressBtns[1].addEventListener("click", function () { sfx("coin"); resetStress(); });
    }
    // miciometru: mănâncă + reset
    var miciBtns = $$('#miciometru button[data-slot="button"]');
    if (miciBtns[0] && !miciBtns[0]._bound) {
      miciBtns[0]._bound = true;
      miciBtns[0].addEventListener("click", function () {
        state.mici += 1;
        renderMici();
      });
    }
    if (miciBtns[1] && !miciBtns[1]._bound) {
      miciBtns[1]._bound = true;
      miciBtns[1].addEventListener("click", function () { state.mici = 0; renderMici(); });
    }
    // scuze: generate
    var genBtn = $('#scuze button[data-slot="button"]');
    if (genBtn && !genBtn._bound) {
      genBtn._bound = true;
      genBtn.addEventListener("click", function () {
        var items = state.t.scuze.items;
        var noua = pick(items);
        if (items.length > 1 && noua === state.scuza) {
          noua = items[(items.indexOf(noua) + 1) % items.length];
        }
        state.scuza = noua;
        state.scuzeCount += 1;
        renderScuzeBox();
      });
    }
  }

  /* ---------- pornire ---------- */
  function init() {
    // elementele cu ID-uri pe care SSR le-a adus + wall card fix
    var lang = savedLang() || detectLang();
    state.lang = lang;
    state.t = D[lang] || D.en;
    document.body.classList.add("noxis-locked");
    bindAudioEvents();
    bindNav();
    applyStaticLang();
    renderAll();
    // welcome: butoane + Escape + focus
    $$("[data-enter]").forEach(function (b) {
      b.addEventListener("click", function () { enterSite(b.getAttribute("data-enter") === "music"); });
    });
    window.setTimeout(function () {
      var mb = $("[data-enter='music']");
      if (mb && !state.entered) mb.focus();
    }, 350);
    // preferința de sunet salvată
    try {
      if (localStorage.getItem(STORE_SOUND) === "on") {
        state.soundOn = true;
        setSoundEnabled(true);
        updateSoundBtn();
      }
    } catch (e) {}
  }

  // Debugging window (harmless in production — helps diagnose static issues)
  window.__noxis = { state: state, toggleLangMenu: toggleLangMenu, openWindow: openWindow, closeWindow: closeWindow, setLang: setLang, enterSite: enterSite, renderAll: renderAll };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
