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

  let aktuellerNutzer = localStorage.getItem("nutzerCode");

  if (!aktuellerNutzer) {
    aktuellerNutzer = prompt("Bitte gib deinen Nutzer-Code ein:");
    if (!aktuellerNutzer || !aktuellerNutzer.trim()) {
      aktuellerNutzer = "Gast";
    }
    aktuellerNutzer = aktuellerNutzer.trim();
    localStorage.setItem("nutzerCode", aktuellerNutzer);
  }

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
  });

function zeigeBereich(viewId) {
    document.querySelectorAll(".view").forEach(function(view) {
      view.classList.remove("active");
    });

    const ziel = document.getElementById(viewId);
    if (ziel) {
      ziel.classList.add("active");
    }

    document.querySelectorAll(".nav-btn").forEach(function(btn) {
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
  }

function oeffneTrainerMitTeilbereich(teilbereich) {
    zeigeBereich("trainerView");
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
    const bereitsGelesen = localStorage.getItem("hinweisGelesen") === "true";
    const checkbox = document.getElementById("hinweisCheckbox");

    if (!bereitsGelesen && !checkbox.checked) {
      return;
    }

    document.getElementById("hinweisOverlay").style.display = "none";
    localStorage.setItem("hinweisGelesen", "true");
  }

function hinweisNurSchliessen() {
    document.getElementById("hinweisOverlay").style.display = "none";
  }

function toggleTrainerDropdown(event) {
  event.stopPropagation();

  const dropdown = document.getElementById("navTrainer").closest(".dropdown");
  dropdown.classList.toggle("open");
}

document.addEventListener("click", function() {
  document.querySelectorAll(".dropdown.open").forEach(function(dropdown) {
    dropdown.classList.remove("open");
  });
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
