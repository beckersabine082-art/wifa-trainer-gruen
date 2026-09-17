const faecherNachTeilbereich = {
    WQ: [
      "Recht",
      "Steuern",
      "Rechnungswesen",
      "BWL",
      "VWL",
      "Unternehmensführung"
    ],
    HQ: [
      "Führung und Zusammenarbeit",
      "Betriebliches Management",
      "Logistik",
      "Marketing",
      "Vertrieb",
      "Investition und Finanzierung",
      "Betriebliches Rechnungswesen und Controlling"
    ]
  };

  let aktuellerTeilbereich = "";
  let aktuellesFach = "";
  let aktuelleFrage = "";
  let pruefungTimerInterval = null;
  let pruefungRestzeitSekunden = 0;
  let aktuellePruefungsDaten = [];
  let letztePruefungsAntworten = [];
  let aktuellesThema = "";
  let aktuelleMusterloesung = "";
  let aktuelleStichpunkte = [];
  let aktuelleFrageId = "";
  let letzteAusgewerteteAntwort = "";
  let ladeToken = 0;
  let appIstBeschaeftigt = false;
  let hinweisScrollLock = null;
  // Interner Zustand: true, wenn die aktuelle Frage über die Fehleranalyse-Wiederholung geöffnet wurde (nicht anhand von sichtbarem Text erkennen)
  let wiederholungsKontext = null;

  const erfolgsFortschritt = {};
  window.meldeErfolgsFortschritt = function(bereich, prozent, userId) {
    const schluessel = String(userId || '');
    if (!schluessel || !['trainer', 'quiz', 'pruefung'].includes(bereich)) return;
    const wert = Number(prozent);
    if (!Number.isFinite(wert)) return;
    erfolgsFortschritt[bereich] = { prozent: wert, userId: schluessel };
    const alleBereiche = ['trainer', 'quiz', 'pruefung'];
    if (!alleBereiche.every(name => erfolgsFortschritt[name]?.userId === schluessel
      && erfolgsFortschritt[name].prozent > 80)) return;
    const gespeichert = `wifa.erfolg.ueber80.v1.${schluessel}`;
    try {
      if (window.localStorage.getItem(gespeichert)) return;
      window.localStorage.setItem(gespeichert, 'true');
    } catch (_) { return; }
    if (document.getElementById('erfolgUeber80')) return;
    const meldung = document.createElement('aside');
    meldung.id = 'erfolgUeber80';
    meldung.className = 'erfolg-ueber80-overlay';
    meldung.setAttribute('role', 'status');
    const konfetti = Array.from({ length: 72 }, (_, index) => {
      const teilIndex = index % 36;
      const zweiteWelle = index >= 36;
      const x = (teilIndex * 37) % 100;
      const hue = (teilIndex * 47) % 360;
      const delay = (teilIndex % 9) * 0.055;
      const drift = ((teilIndex * 29) % 44) - 22;
      const spin = 240 + ((teilIndex * 71) % 480);
      const wellenKlasse = zweiteWelle ? ' erfolg-konfetti-zweite-welle' : '';
      return `<i class="erfolg-konfetti-teil${wellenKlasse}" style="--x:${x}vw;--hue:${hue};--delay:${delay}s;--drift:${drift}vw;--spin:${spin}deg"></i>`;
    }).join('');
    meldung.innerHTML = `<div class="erfolg-konfetti-feld" aria-hidden="true">${konfetti}<span class="erfolg-feuerwerk erfolg-feuerwerk-links">✦</span><span class="erfolg-feuerwerk erfolg-feuerwerk-rechts">✦</span></div><section class="erfolg-ueber80-karte"><div class="erfolg-ueber80-glanz" aria-hidden="true">🎆　✨　🎇</div><strong>Stark! In Trainer, Quiz und Prüfungssimulation liegst du über <span class="erfolg-ueber80-quote">80&nbsp;%</span>.</strong><span>Die erfolgreiche Prüfung ist zum Greifen nah.</span></section>`;
    document.body.appendChild(meldung);
    window.setTimeout(() => {
      meldung.classList.add('erfolg-ueber80-schliessen');
      window.setTimeout(() => meldung.remove(), 350);
    }, 4650);
  };

  // Aktueller Nutzer (UID) wird in `window.aktuellerNutzer` verwaltet von `js/login.js`.
  // Stelle sicher, dass kein lokales `aktuellerNutzer` existiert.
  if (typeof window.aktuellerNutzer === 'undefined') window.aktuellerNutzer = null;

  const sessionStats = {
    totalErreicht: 0,
    totalMax: 0,
    faecher: {},
    eintraege: []
  };

  window.faecherNachTeilbereich = faecherNachTeilbereich;

  let glossarDaten = [];
    let formelDaten = [];
let glossarAktiverBuchstabe = "";
 let karteikartenDaten = [];
let aktuelleKartenIndex = 0; 
    
  window.addEventListener("load", function () {
    updateStatAnzeige();
    initialisiereHinweis();
    // place hamburger into the active view on load
    try {
      const active = document.querySelector('.view.active');
      moveHamburgerToView(active ? active.id : 'startView');
    } catch (e) { console.warn('moveHamburgerToView init error', e); }
  });

function zeigeBereich(viewId) {
    if (viewId !== "wissenView" && typeof karteikartenAudioStoppen === "function") {
      karteikartenAudioStoppen();
    }
    if (viewId !== "lerntextePodcastView" && typeof window.lerntexteAudioStoppen === "function") {
      window.lerntexteAudioStoppen();
    }

    document.querySelectorAll(".view").forEach(function(view) {
      view.classList.remove("active");
    });

    const ziel = document.getElementById(viewId);
    if (ziel) {
      ziel.classList.add("active");
      window.WifaAnalytics?.view(viewId);
      window.WifaUsage?.view(viewId);
    }

    document.querySelectorAll(".nav-actions .nav-btn").forEach(function(btn) {
      btn.classList.remove("active");
    });

    if (viewId === "startView") document.getElementById("navStart").classList.add("active");
    if (["trainerView", "quizView", "lerntextePodcastView"].includes(viewId)) {
      document.getElementById("navLernenUeben").classList.add("active");
    }
    if (["lernstandView", "lernstandPruefungView", "lernstandQuizView", "lernstandFehlerView"].includes(viewId)) {
      document.getElementById("navLernstand").classList.add("active");
    }
    if (viewId === "lernstandView" && typeof window.ladeWifaLernstand === "function") {
      window.ladeWifaLernstand();
    }
    if (viewId === "lernstandFehlerView" && typeof window.ladeFehleranalyse === "function") {
      window.ladeFehleranalyse();
    }
    if (viewId === "lernstandPruefungView" && typeof window.ladePruefungsLernstand === "function") {
      window.ladePruefungsLernstand();
    }
    if (viewId === "lernstandQuizView" && typeof window.ladeQuizLernstand === "function") {
      window.ladeQuizLernstand();
    }
    if (viewId === "quizView" && typeof window.initialisiereQuiz === "function") {
      window.initialisiereQuiz();
    }
    if (viewId === "lerntextePodcastView" && typeof window.initialisiereLerntexteAnsicht === "function") {
      window.initialisiereLerntexteAnsicht();
    }
    if (viewId === "praesentationView") document.getElementById("navPraesentation")?.classList.add("active");
    if (viewId === "glossarView") {
  document.getElementById("navNachschlagen").classList.add("active");

  if (!glossarDaten.length && !appIstBeschaeftigt) {
    ladeGlossar();
  }
}
if (viewId === "formelView") {
  document.getElementById("navNachschlagen").classList.add("active");

  if (!formelDaten.length && !appIstBeschaeftigt) {
    ladeFormelsammlung();
  }
}
    if (viewId === "pruefungView") document.getElementById("navPruefung").classList.add("active");
    if (viewId === "wissenView") {
      const bereich = window.wissenAktiverBereich === "karteikarten" ? "karteikarten" : "links";
      const wissenViewTitle = document.getElementById("wissenViewTitle");
      const wissenViewIntro = document.getElementById("wissenViewIntro");
      const linksBereich = document.getElementById("wissenLinksBereich");
      const kartenBereich = document.getElementById("wissenKarteikartenBereich");
      if (linksBereich) linksBereich.style.display = bereich === "links" ? "" : "none";
      if (kartenBereich) kartenBereich.style.display = bereich === "karteikarten" ? "" : "none";
      if (bereich === "karteikarten") {
        if (wissenViewTitle) wissenViewTitle.textContent = "Karteikarten";
        if (wissenViewIntro) wissenViewIntro.textContent = "Lernkarten auf Basis deiner aktiven Fragen mit Musterl\u00f6sung.";
        document.getElementById("navLernenUeben").classList.add("active");
      } else {
        if (wissenViewTitle) wissenViewTitle.textContent = "Gesetzeslinks";
        if (wissenViewIntro) wissenViewIntro.textContent = "Hier findest du hilfreiche zus\u00e4tzliche Seiten und weiterf\u00fchrende Lernlinks.";
        document.getElementById("navNachschlagen").classList.add("active");
      }
    }
    if (viewId === "kilianView") document.getElementById("navKilian").classList.add("active");

    window.scrollTo({ top: 0, behavior: "smooth" });
    // move the single hamburger/menu into the active view's heading
    try { moveHamburgerToView(viewId); } catch (e) { console.warn('moveHamburgerToView error', e); }
  }

function moveHamburgerToView(viewId) {
  const hamburger = document.querySelector('.nav-hamburger');
  const menu = document.querySelector('.nav-menu');
  if (!hamburger || !menu) return;

  const view = document.getElementById(viewId);
  if (!view) return;

  // Find the main heading inside the view.
  const heading = view.querySelector('h1, h2');
  if (!heading) return;

  // ensure title-row wrapper exists
  let titleRow = heading.closest('.title-row');
  if (!titleRow) {
    titleRow = document.createElement('div');
    titleRow.className = 'title-row';
    // Insert titleRow before the heading and move the heading inside it.
    heading.parentNode.insertBefore(titleRow, heading);
    titleRow.appendChild(heading);
  }

  // make titleRow positioned so menu can be absolute relative to it
  titleRow.style.position = 'relative';

  // move hamburger and menu into titleRow (hamburger before the h1)
  if (hamburger.parentNode !== titleRow) {
    titleRow.insertBefore(hamburger, titleRow.firstChild);
  }
  if (menu.parentNode !== titleRow) {
    titleRow.appendChild(menu);
  }

  // small spacing
  hamburger.style.marginRight = '16px';
}

function oeffneTrainerMitTeilbereich(teilbereich) {
    if (typeof requireAuth === 'function') {
      requireAuth('trainerView');
    } else {
      zeigeBereich('trainerView');
    }

    const select = document.getElementById("teilbereichSelect");
    if (select) {
      select.value = teilbereich || "";
      select.style.display = "none";
    }

    const fachBereich = document.getElementById("fachBereich");
    const themaBereich = document.getElementById("themaBereich");
    if (fachBereich) fachBereich.style.display = "none";
    if (themaBereich) themaBereich.style.display = "none";

    if (typeof teilbereich === "string" && teilbereich) {
      window.setTimeout(function() {
        const trainerView = document.getElementById("trainerView");
        if (trainerView && trainerView.classList.contains("active") && select) {
          waehleTeilbereich();
        }
      }, 0);
    }
  }

function setzeAppBeschaeftigt(status) {
    appIstBeschaeftigt = status;

    document.querySelectorAll("button, select, textarea, input").forEach(function(el) {
      if (el.id === "hinweisCheckbox") return;
      if (el.id === "hinweisButton") return;
      if (el.closest("#hinweisOverlay")) return;

      el.disabled = status;
      el.style.opacity = status ? "0.65" : "1";
      el.style.cursor = status ? "wait" : "";
    });
    if (!status && typeof trainerAktualisiereVorherigeSchaltflaeche === "function") {
      trainerAktualisiereVorherigeSchaltflaeche();
    }
  }

function setzeStatus(text) {
    document.getElementById("ladeStatus").textContent = text || "";
  }

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function kilianMathFallbackText(source) {
  return String(source || "")
    .replace(/\\(?:left|right|text|mathrm|operatorname|frac|sqrt|sum|prod|int|lim)\b/g, "")
    .replace(/\\([%$&#_{}()[\]\\])/g, "$1")
    .replace(/\\([a-zA-Z]+)/g, "$1")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function renderKilianMathContent(source) {
  const input = String(source || "");
  const state = { index: 0, unsupported: false };
  const operators = {
    cdot: "·", times: "×", div: "÷", pm: "±", mp: "∓", le: "≤", leq: "≤",
    ge: "≥", geq: "≥", neq: "≠", ne: "≠", approx: "≈", equiv: "≡", propto: "∝",
    in: "∈", notin: "∉", to: "→", rightarrow: "→", leftarrow: "←", leftrightarrow: "↔",
    mapsto: "↦", infinity: "∞", infty: "∞", sum: "∑", prod: "∏", int: "∫",
    partial: "∂", nabla: "∇", ldots: "…", cdots: "⋯", dots: "…", alpha: "α",
    beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", theta: "θ", lambda: "λ",
    mu: "μ", pi: "π", sigma: "σ", phi: "φ", omega: "ω"
  };
  const words = new Set(["sin", "cos", "tan", "log", "ln", "exp", "min", "max", "lim"]);

  function parseSequence(endCharacter) {
    const nodes = [];
    while (state.index < input.length) {
      const character = input[state.index];
      if (endCharacter && character === endCharacter) {
        state.index += 1;
        return { html: nodes.join(""), closed: true };
      }
      if (character === "^" || character === "_") {
        state.index += 1;
        let trailingSpace = "";
        while (nodes.length && nodes[nodes.length - 1] === " ") trailingSpace = " " + nodes.pop();
        const base = nodes.pop();
        const argument = parseArgument();
        if (!base || argument === null) {
          state.unsupported = true;
          if (argument !== null) nodes.push(argument);
          continue;
        }
        nodes.push(base + "<" + (character === "^" ? "sup" : "sub") + ">" + argument + "</" + (character === "^" ? "sup" : "sub") + ">" + trailingSpace);
        continue;
      }
      if (character === "{") {
        nodes.push(parseGroup());
        continue;
      }
      if (character === "}") {
        state.unsupported = true;
        state.index += 1;
        continue;
      }
      if (character === "\\") {
        nodes.push(parseCommand());
        continue;
      }
      if (character === "(" || character === "[") {
        nodes.push(parseDelimited(character, character === "(" ? ")" : "]"));
        continue;
      }
      nodes.push(escapeHtml(character));
      state.index += 1;
    }
    return { html: nodes.join(""), closed: !endCharacter };
  }

  function parseGroup() {
    state.index += 1;
    const result = parseSequence("}");
    if (!result.closed) state.unsupported = true;
    return result.html;
  }

  function parseDelimited(open, close) {
    state.index += 1;
    const result = parseSequence(close);
    if (!result.closed) state.unsupported = true;
    return escapeHtml(open) + result.html + escapeHtml(close);
  }

  function parseArgument() {
    while (input[state.index] === " ") state.index += 1;
    if (state.index >= input.length) return null;
    if (input[state.index] === "{") return parseGroup();
    if (input[state.index] === "\\") return parseCommand();
    if (input[state.index] === "(" || input[state.index] === "[") {
      const open = input[state.index];
      return parseDelimited(open, open === "(" ? ")" : "]");
    }
    const character = input[state.index];
    state.index += 1;
    return escapeHtml(character);
  }

  function parseRequiredGroup() {
    while (input[state.index] === " ") state.index += 1;
    if (input[state.index] !== "{") {
      state.unsupported = true;
      return null;
    }
    return parseGroup();
  }

  function parseCommand() {
    state.index += 1;
    if (state.index >= input.length) {
      state.unsupported = true;
      return "";
    }
    if (!/[A-Za-z]/.test(input[state.index])) {
      const escaped = escapeHtml(input[state.index]);
      state.index += 1;
      return escaped;
    }
    const start = state.index;
    while (state.index < input.length && /[A-Za-z]/.test(input[state.index])) state.index += 1;
    const command = input.slice(start, state.index);
    if (command === "frac") {
      const numerator = parseRequiredGroup();
      const denominator = parseRequiredGroup();
      if (numerator === null || denominator === null) return numerator || denominator || "";
      return '<span class="formula-fraction"><span class="formula-numerator">' + numerator + '</span><span class="formula-denominator">' + denominator + "</span></span>";
    }
    if (command === "text" || command === "mathrm" || command === "operatorname") {
      const content = parseRequiredGroup();
      if (content === null) return "";
      return '<span class="formula-text">' + content + "</span>";
    }
    if (command === "sqrt") {
      const content = parseRequiredGroup();
      if (content === null) return "";
      return '<span class="formula-sqrt">√<span class="formula-radicand">' + content + "</span></span>";
    }
    if (command === "left" || command === "right") return "";
    if (command === "quad" || command === "qquad" || command === "," || command === ";" || command === "!") return " ";
    if (Object.prototype.hasOwnProperty.call(operators, command)) return escapeHtml(operators[command]);
    if (words.has(command)) return '<span class="formula-text">' + escapeHtml(command) + "</span>";

    state.unsupported = true;
    const fallback = parseArgument();
    return fallback === null ? escapeHtml(command) : fallback;
  }

  const parsed = parseSequence(null);
  return {
    html: parsed.html || escapeHtml(kilianMathFallbackText(input)),
    unsupported: state.unsupported
  };
}

function renderKilianMathFormula(source, display) {
  const rendered = renderKilianMathContent(source);
  const className = (display ? "formula-display" : "formula-inline") + (rendered.unsupported ? " formula-fallback" : "");
  const content = rendered.html || escapeHtml(kilianMathFallbackText(source)) || "?";
  return '<span class="' + className + '" role="math">' + content + "</span>";
}

function formatKilianAntwort(text) {
  const mathSlots = [];
  let source = String(text || "");
  const addMathSlot = function(content, display) {
    const marker = "KILIAN_MATH_SLOT_" + mathSlots.length + "_END";
    mathSlots.push({ marker, html: renderKilianMathFormula(content, display) });
    return marker;
  };
  source = source
    .replace(/\\\[([\s\S]*?)\\\]/g, function(_, content) { return addMathSlot(content, true); })
    .replace(/\\\(([\s\S]*?)\\\)/g, function(_, content) { return addMathSlot(content, false); })
    .replace(/\\\[([\s\S]*)$/g, function(_, content) { return addMathSlot(content, true); })
    .replace(/\\\(([\s\S]*)$/g, function(_, content) { return addMathSlot(content, false); });

  let formatted = escapeHtml(source)
    .replace(/### (.*?)(\n|$)/g, "<h3>$1</h3>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n- /g, "<br>• ")
    .replace(/\n/g, "<br>");
  mathSlots.forEach(function(slot) {
    formatted = formatted.split(slot.marker).join(slot.html);
  });
  return formatted.replace(/\\(?=[\[\]()])/g, "");
}

function sanitizeAufgabenHtml(html) {
  const template = document.createElement('template');
  template.innerHTML = String(html || '');
  const output = document.createElement('div');
  const tags = new Set('DIV SPAN P BR HR H1 H2 H3 H4 H5 H6 STRONG B EM I U S SUB SUP UL OL LI TABLE THEAD TBODY TFOOT TR TD TH CAPTION COLGROUP COL INPUT TEXTAREA SELECT OPTION OPTGROUP LABEL IMG'.split(' '));
  const attributes = new Set('class title colspan rowspan scope headers span width height border cellpadding cellspacing type name value placeholder rows cols min max step maxlength size checked selected disabled readonly multiple required label alt'.split(' '));
  const styles = new Set('width max-width min-width height max-height min-height margin margin-top margin-bottom margin-left margin-right padding padding-top padding-bottom padding-left padding-right border border-top border-bottom border-left border-right border-width border-style border-color border-radius border-collapse border-spacing background background-color color font-size font-weight font-style font-family text-align vertical-align line-height white-space display table-layout'.split(' '));
  function copy(parent, node) {
    if (node.nodeType === 3) { parent.appendChild(document.createTextNode(node.textContent)); return; }
    if (node.nodeType !== 1 || node.namespaceURI !== 'http://www.w3.org/1999/xhtml' || !tags.has(node.tagName)) return;
    const clean = document.createElement(node.tagName.toLowerCase());
    for (const attr of node.attributes) {
      const name = attr.name.toLowerCase();
      if (attributes.has(name) || /^data-(answer|index|key)$/.test(name) || /^aria-[a-z-]+$/.test(name)) {
        if (name === 'type' && !['text','number','checkbox','radio','hidden'].includes(attr.value.toLowerCase())) continue;
        clean.setAttribute(name, attr.value);
      } else if (name === 'id' || name === 'for') {
        clean.setAttribute(name, 'aufgabe-' + attr.value);
      } else if (name === 'style') {
        for (const property of node.style) {
          const value = node.style.getPropertyValue(property);
          if (styles.has(property) && !/url\s*\(|expression|var\s*\(|[\\<>@]/i.test(value)) clean.style.setProperty(property, value);
        }
      } else if (name === 'src' && node.tagName === 'IMG') {
        // Raster data URLs and ordinary HTTPS/relative image paths only.
        try {
          const url = new URL(attr.value, window.location.href);
          if (url.protocol === 'https:' || (/^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=]+$/i.test(attr.value)) ||
              (url.origin === window.location.origin && url.protocol === 'http:')) clean.setAttribute('src', attr.value);
        } catch (_) { /* Invalid image source is omitted. */ }
      }
    }
    for (const child of node.childNodes) copy(clean, child);
    parent.appendChild(clean);
  }
  for (const child of template.content.childNodes) copy(output, child);
  return output.innerHTML;
}

function setzeHinweisSichtbarkeit(sichtbar) {
    const overlay = document.getElementById("hinweisOverlay");
    const html = document.documentElement;
    const body = document.body;
    if (!overlay || !html || !body) return;

    if (sichtbar && !hinweisScrollLock) {
      const scrollY = window.scrollY || window.pageYOffset || 0;
      hinweisScrollLock = {
        scrollY,
        body: {
          position: body.style.position,
          top: body.style.top,
          left: body.style.left,
          right: body.style.right,
          width: body.style.width,
          overflow: body.style.overflow,
          paddingRight: body.style.paddingRight
        },
        htmlOverflow: html.style.overflow
      };

      const scrollbarWidth = Math.max(0, window.innerWidth - html.clientWidth);
      body.style.position = "fixed";
      body.style.top = `-${scrollY}px`;
      body.style.left = "0";
      body.style.right = "0";
      body.style.width = "100%";
      body.style.overflow = "hidden";
      if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
      html.style.overflow = "hidden";
    }

    overlay.style.display = sichtbar ? "flex" : "none";
    overlay.setAttribute("aria-hidden", sichtbar ? "false" : "true");
    html.classList.toggle("hinweis-open", sichtbar);
    body.classList.toggle("hinweis-open", sichtbar);

    if (!sichtbar && hinweisScrollLock) {
      const lock = hinweisScrollLock;
      body.style.position = lock.body.position;
      body.style.top = lock.body.top;
      body.style.left = lock.body.left;
      body.style.right = lock.body.right;
      body.style.width = lock.body.width;
      body.style.overflow = lock.body.overflow;
      body.style.paddingRight = lock.body.paddingRight;
      html.style.overflow = lock.htmlOverflow;
      hinweisScrollLock = null;
      window.scrollTo(0, lock.scrollY);
    }
  }

function initialisiereHinweis() {
    const checkbox = document.getElementById("hinweisCheckbox");
    const button = document.getElementById("hinweisButton");

    if (!localStorage.getItem("hinweisGelesen")) {
      setzeHinweisSichtbarkeit(true);
    } else {
      setzeHinweisSichtbarkeit(false);
    }

    checkbox.addEventListener("change", function () {
      if (checkbox.checked) {
        button.disabled = false;
        button.style.background = "linear-gradient(135deg, #f0b429, #d97706)";
        button.style.color = "#ffffff";
        button.style.cursor = "pointer";
      } else {
        button.disabled = true;
        button.style.background = "#d9d9d9";
        button.style.color = "#666";
        button.style.cursor = "not-allowed";
      }
    });
  }

function hinweisAnzeigen() {
    setzeHinweisSichtbarkeit(true);

    const checkboxWrap = document.getElementById("hinweisCheckboxWrap");
    const checkbox = document.getElementById("hinweisCheckbox");
    const button = document.getElementById("hinweisButton");

    checkboxWrap.style.display = "flex";
    checkbox.checked = false;
    button.disabled = true;
    button.style.background = "#d9d9d9";
    button.style.color = "#666";
    button.style.cursor = "not-allowed";
    button.textContent = "Gelesen und fortfahren";
  }

function hinweisSchliessen() {
    const checkbox = document.getElementById("hinweisCheckbox");

  if (!checkbox.checked) {
      return;
    }

    setzeHinweisSichtbarkeit(false);
    localStorage.setItem("hinweisGelesen", "true");
  }

function toggleTrainerDropdown(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  const button = document.getElementById("navTrainer");
  const dropdown = button.closest(".dropdown");
  const isOpen = dropdown.classList.contains("open");

  document.querySelectorAll(".dropdown.open").forEach(function(openDropdown) {
    if (openDropdown === dropdown || openDropdown.contains(dropdown) || dropdown.contains(openDropdown)) return;
    openDropdown.classList.remove("open");
    const openButton = openDropdown.querySelector("button");
    if (openButton) {
      openButton.setAttribute("aria-expanded", "false");
    }
  });

  dropdown.classList.toggle("open", !isOpen);
  button.setAttribute("aria-expanded", String(!isOpen));
  button.textContent = "🎓 WiFa Trainer " + (!isOpen ? "▴" : "▾");
}

function toggleLernenUebenDropdown(event) {
  event.stopPropagation();

  const button = document.getElementById("navLernenUeben");
  const dropdown = button.closest(".dropdown");
  const isOpen = dropdown.classList.contains("open");

  document.querySelectorAll(".dropdown.open").forEach(function(openDropdown) {
    openDropdown.classList.remove("open");
    const openButton = openDropdown.querySelector("button");
    if (openButton) {
      openButton.setAttribute("aria-expanded", "false");
    }
  });

  dropdown.classList.toggle("open", !isOpen);
  button.setAttribute("aria-expanded", String(!isOpen));
}

function toggleLernstandDropdown(event) {
  event.stopPropagation();
  const button = document.getElementById("navLernstand");
  const dropdown = button.closest(".dropdown");
  const isOpen = dropdown.classList.contains("open");

  document.querySelectorAll(".dropdown.open").forEach(function(openDropdown) {
    openDropdown.classList.remove("open");
    const openButton = openDropdown.querySelector("button");
    if (openButton) openButton.setAttribute("aria-expanded", "false");
  });

  dropdown.classList.toggle("open", !isOpen);
  button.setAttribute("aria-expanded", String(!isOpen));
}

function toggleNachschlagenDropdown(event) {
  event.stopPropagation();

  const button = document.getElementById("navNachschlagen");
  const dropdown = button.closest(".dropdown");
  const isOpen = dropdown.classList.contains("open");

  document.querySelectorAll(".dropdown.open").forEach(function(openDropdown) {
    openDropdown.classList.remove("open");
    const openButton = openDropdown.querySelector("button");
    if (openButton) {
      openButton.setAttribute("aria-expanded", "false");
    }
  });

  dropdown.classList.toggle("open", !isOpen);
  button.setAttribute("aria-expanded", String(!isOpen));
}

function oeffneLernstandBereich(viewId) {
  if (typeof requireAuth === "function") {
    requireAuth(viewId);
  } else {
    zeigeBereich(viewId);
  }
}

function oeffneWissenBereich(teil) {
  if (teil !== "karteikarten" && typeof karteikartenAudioStoppen === "function") {
    karteikartenAudioStoppen();
  }
  window.wissenAktiverBereich = teil === "karteikarten" ? "karteikarten" : "links";
  if (typeof requireAuth === "function") {
    requireAuth("wissenView");
  } else {
    zeigeBereich("wissenView");
  }
}

function closeMainMenu() {
  const menu = document.querySelector(".nav-menu");
  const button = document.querySelector(".nav-hamburger");

  if (!menu || !button) return;

  menu.classList.remove("open");
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-label", "Hauptmenü öffnen");

  document.querySelectorAll(".dropdown.open").forEach(function(dropdown) {
    dropdown.classList.remove("open");
    const itemButton = dropdown.querySelector("button");
    if (itemButton) {
      itemButton.setAttribute("aria-expanded", "false");
      if (itemButton.id === "navTrainer") {
        itemButton.textContent = "🎓 WiFa Trainer ▾";
      }
    }
  });
}

function toggleMainMenu() {
  const menu = document.querySelector(".nav-menu");
  const button = document.querySelector(".nav-hamburger");

  if (!menu || !button) return;

  const isOpen = menu.classList.contains("open");
  menu.classList.toggle("open");
  button.setAttribute("aria-expanded", String(!isOpen));
  button.setAttribute("aria-label", isOpen ? "Hauptmenü öffnen" : "Hauptmenü schließen");

  if (!isOpen) {
    document.querySelectorAll(".dropdown.open").forEach(function(dropdown) {
      dropdown.classList.remove("open");
      const itemButton = dropdown.querySelector("button");
      if (itemButton) {
        itemButton.setAttribute("aria-expanded", "false");
      }
    });
  }
}

document.addEventListener("click", function(event) {
  const menu = document.querySelector(".nav-menu");
  const toggleButton = document.querySelector(".nav-hamburger");
  const clickedWithinMenu = menu && menu.contains(event.target);
  const clickedToggle = toggleButton && toggleButton.contains(event.target);

  if (!clickedWithinMenu && !clickedToggle) {
    closeMainMenu();
  }

  document.querySelectorAll(".dropdown.open").forEach(function(dropdown) {
    if (!dropdown.contains(event.target) && !dropdown.previousElementSibling?.contains(event.target)) {
      dropdown.classList.remove("open");
      const itemButton = dropdown.querySelector("button");
      if (itemButton) {
        itemButton.setAttribute("aria-expanded", "false");
      }
    }
  });
});

document.addEventListener("keydown", function(event) {
  if (event.key === "Escape") {
    closeMainMenu();
  }
});

// Erlaubt das Öffnen der Funktionskarten und des Kilian-Buttons per Tastatur (role="button")
document.addEventListener("keydown", function(event) {
  if (event.key !== "Enter" && event.key !== " ") return;
  const card = event.target.closest && event.target.closest(".feature-card, #kilianBubbleButton");
  if (!card) return;
  event.preventDefault();
  card.click();
});

window.addEventListener("DOMContentLoaded", function() {
  const hamburger = document.querySelector(".nav-hamburger");
  if (hamburger) {
    hamburger.addEventListener("click", function(event) {
      event.stopPropagation();
      toggleMainMenu();
    });
  }
});

function autoResizeTextarea(el) {
  el.style.height = "auto";
  el.style.height = Math.max(42, el.scrollHeight) + "px";

  const td = el.closest("td");
  const tr = el.closest("tr");

  if (td) {
    td.style.height = "auto";
    td.style.verticalAlign = "top";
  }

  if (tr) {
    tr.style.height = "auto";
  }
}

document.addEventListener("input", function(e) {
  if (
    e.target.tagName === "TEXTAREA" ||
    e.target.classList.contains("pruefung-input")
  ) {
    autoResizeTextarea(e.target);
  }
});

window.addEventListener("load", function() {
  document.querySelectorAll("textarea, .pruefung-input").forEach(function(el) {
    autoResizeTextarea(el);
  });
});
