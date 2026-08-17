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

  // Aktueller Nutzer (UID) wird in `window.aktuellerNutzer` verwaltet von `js/login.js`.
  // Stelle sicher, dass kein lokales `aktuellerNutzer` existiert.
  if (typeof window.aktuellerNutzer === 'undefined') window.aktuellerNutzer = null;

  const sessionStats = {
    totalErreicht: 0,
    totalMax: 0,
    faecher: {},
    eintraege: []
  };

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
    if (viewId === "trainerView") document.getElementById("navTrainer").classList.add("active");
    if (viewId === "lernstandView") document.getElementById("navLernstand").classList.add("active");
    if (viewId === "glossarView") {
  document.getElementById("navGlossar").classList.add("active");

  if (!glossarDaten.length && !appIstBeschaeftigt) {
    ladeGlossar();
  }
}
if (viewId === "formelView") {
  document.getElementById("navFormeln").classList.add("active");

  if (!formelDaten.length && !appIstBeschaeftigt) {
    ladeFormelsammlung();
  }
}
    if (viewId === "pruefungView") document.getElementById("navPruefung").classList.add("active");
    if (viewId === "wissenView") document.getElementById("navWissen").classList.add("active");
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

  // find the main heading inside the view
  const h1 = view.querySelector('h1');
  if (!h1) {
    // fallback: place hamburger at start of view
    view.insertBefore(hamburger, view.firstChild);
    view.insertBefore(menu, hamburger.nextSibling);
    return;
  }

  // ensure title-row wrapper exists
  let titleRow = h1.closest('.title-row');
  if (!titleRow) {
    titleRow = document.createElement('div');
    titleRow.className = 'title-row';
    // insert titleRow before h1 and move h1 inside it
    h1.parentNode.insertBefore(titleRow, h1);
    titleRow.appendChild(h1);
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
  const closeButton = document.getElementById("hinweisCloseButton");

    if (!localStorage.getItem("hinweisGelesen")) {
      document.getElementById("hinweisOverlay").style.display = "flex";
    }

    checkbox.addEventListener("change", function () {
      if (checkbox.checked) {
        button.disabled = false;
        closeButton.disabled = false;
        button.style.background = "linear-gradient(135deg, #f0b429, #d97706)";
        button.style.color = "#ffffff";
        button.style.cursor = "pointer";
        closeButton.style.cursor = "pointer";
      } else {
        button.disabled = true;
        closeButton.disabled = true;
        button.style.background = "#d9d9d9";
        button.style.color = "#666";
        button.style.cursor = "not-allowed";
        closeButton.style.cursor = "not-allowed";
      }
    });
  }

function hinweisAnzeigen() {
    document.getElementById("hinweisOverlay").style.display = "flex";

    const checkboxWrap = document.getElementById("hinweisCheckboxWrap");
    const checkbox = document.getElementById("hinweisCheckbox");
    const button = document.getElementById("hinweisButton");
    const closeButton = document.getElementById("hinweisCloseButton");

    checkboxWrap.style.display = "flex";
    checkbox.checked = false;
    button.disabled = true;
    closeButton.disabled = true;
    button.style.background = "#d9d9d9";
    button.style.color = "#666";
    button.style.cursor = "not-allowed";
    button.textContent = "Gelesen und fortfahren";
  }

function hinweisSchliessen() {
    const bereitsGelesen = localStorage.getItem("hinweisGelesen") === "true";
    const checkbox = document.getElementById("hinweisCheckbox");

    if (!bereitsGelesen && !checkbox.checked) {
      return;
    }

    document.getElementById("hinweisOverlay").style.display = "none";
    localStorage.setItem("hinweisGelesen", "true");
  }

function hinweisNurSchliessen() {
  hinweisSchliessen();
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
