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
      "Finance Controlling"
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
  let ladeToken = 0;
  let appIstBeschaeftigt = false;
  // Interner Zustand: true, wenn die aktuelle Frage über die Fehleranalyse-Wiederholung geöffnet wurde (nicht anhand von sichtbarem Text erkennen)
  let wiederholungsKontext = null;

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
      const linksBereich = document.getElementById("wissenLinksBereich");
      const kartenBereich = document.getElementById("wissenKarteikartenBereich");
      if (linksBereich) linksBereich.style.display = bereich === "links" ? "" : "none";
      if (kartenBereich) kartenBereich.style.display = bereich === "karteikarten" ? "" : "none";
      if (bereich === "karteikarten") {
        document.getElementById("navLernenUeben").classList.add("active");
      } else {
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
    // Wenn requireAuth verfügbar ist, verwende es, sonst direkt öffnen
    if (typeof requireAuth === 'function') {
      requireAuth('trainerView');
    } else {
      zeigeBereich('trainerView');
    }
    const select = document.getElementById("teilbereichSelect");
    select.value = teilbereich;
    waehleTeilbereich();
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

function formatKilianAntwort(text) {
  return String(text || "")
    .replace(/### (.*?)(\n|$)/g, "<h3>$1</h3>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n- /g, "<br>• ")
    .replace(/\n/g, "<br>");
}

function initialisiereHinweis() {
    const checkbox = document.getElementById("hinweisCheckbox");
    const button = document.getElementById("hinweisButton");

    if (!localStorage.getItem("hinweisGelesen")) {
      document.getElementById("hinweisOverlay").style.display = "flex";
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
    document.getElementById("hinweisOverlay").style.display = "flex";

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

    document.getElementById("hinweisOverlay").style.display = "none";
    localStorage.setItem("hinweisGelesen", "true");
  }

function toggleTrainerDropdown(event) {
  event.stopPropagation();

  const button = document.getElementById("navTrainer");
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
