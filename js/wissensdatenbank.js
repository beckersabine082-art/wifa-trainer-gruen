function kartenTeilbereichWaehlen() {
  const teilbereich = document.getElementById("kartenTeilbereichSelect").value;
  const fachSelect = document.getElementById("kartenFachSelect");
  const themaSelect = document.getElementById("kartenThemaSelect");

  fachSelect.innerHTML = '<option value="">-- Fach wählen --</option>';
  themaSelect.innerHTML = '<option value="">Alle Themen</option>';

  karteikartenDaten = [];
  aktuelleKartenIndex = 0;

  document.getElementById("karteikartenBox").style.display = "none";
  document.getElementById("kartenStatus").textContent = "Bitte Fach auswählen.";

  if (!teilbereich) {
    document.getElementById("kartenStatus").textContent = "Bitte Teilbereich und Fach auswählen.";
    return;
  }

  const faecher = faecherNachTeilbereich[teilbereich] || [];

  faecher.forEach(function(fach) {
    const option = document.createElement("option");
    option.value = fach;
    option.textContent = fach;
    fachSelect.appendChild(option);
  });
}

async function kartenFachWaehlen() {
  const fach = document.getElementById("kartenFachSelect").value;
  const themaSelect = document.getElementById("kartenThemaSelect");

  themaSelect.innerHTML = '<option value="">Alle Themen</option>';

  karteikartenDaten = [];
  aktuelleKartenIndex = 0;

  document.getElementById("karteikartenBox").style.display = "none";

  if (!fach) {
    document.getElementById("kartenStatus").textContent = "Bitte Fach auswählen.";
    return;
  }

  try {
    document.getElementById("kartenStatus").textContent = "Themen werden geladen...";

    const result = await apiGet("topics", { fach });

    if (!result.success) {
      throw new Error(result.error || "Themen konnten nicht geladen werden.");
    }

    const themen = result.data || [];

    themen.forEach(function(thema) {
      const option = document.createElement("option");
      option.value = thema;
      option.textContent = thema;
      themaSelect.appendChild(option);
    });

    document.getElementById("kartenStatus").textContent =
      "Fach gewählt. Du kannst jetzt ein Thema auswählen oder alle Themen laden.";

  } catch (error) {
    document.getElementById("kartenStatus").textContent =
      "Fehler beim Laden der Themen: " + error.message;
  }
}

async function ladeKarteikarten() {
  const fach = document.getElementById("kartenFachSelect").value;
  const thema = document.getElementById("kartenThemaSelect").value;

  if (!fach) {
    alert("Bitte zuerst ein Fach auswählen.");
    return;
  }

  try {
    document.getElementById("kartenStatus").textContent = "Karteikarten werden geladen...";

    const result = await apiGet("getKarteikarten", {
      fach: fach,
      thema: thema
    });

    if (!result.success) {
      throw new Error(result.error || "Karteikarten konnten nicht geladen werden.");
    }

    karteikartenDaten = result.data || [];
    aktuelleKartenIndex = 0;

    if (!karteikartenDaten.length) {
      document.getElementById("karteikartenBox").style.display = "none";
      document.getElementById("kartenStatus").textContent =
        "Keine Karteikarten gefunden. Prüfe, ob aktive Fragen mit Musterlösung vorhanden sind.";
      return;
    }

    document.getElementById("karteikartenBox").style.display = "block";
    document.getElementById("kartenStatus").textContent =
      karteikartenDaten.length + " Karteikarten geladen.";

    zeigeAktuelleKarte();

  } catch (error) {
    document.getElementById("kartenStatus").textContent =
      "Fehler beim Laden der Karteikarten: " + error.message;
  }
}

function zeigeAktuelleKarte() {
  if (!karteikartenDaten.length) return;

  const karte = karteikartenDaten[aktuelleKartenIndex];

  document.getElementById("kartenZaehler").textContent =
    (aktuelleKartenIndex + 1) + " von " + karteikartenDaten.length;

  document.getElementById("kartenFachAnzeige").textContent =
    karte.fach || "Kein Fach";

  document.getElementById("kartenThemaAnzeige").textContent =
    karte.thema || "Kein Thema";

  document.getElementById("kartenVorderseite").textContent =
    karte.vorderseite || "Keine Vorderseite vorhanden.";

  document.getElementById("kartenRueckseiteText").textContent =
    karte.rueckseite || "Keine Rückseite vorhanden.";

  document.getElementById("kartenRueckseite").style.display = "none";
}

function karteUmdrehen() {
  const rueckseite = document.getElementById("kartenRueckseite");

  if (!karteikartenDaten.length) return;

  rueckseite.style.display =
    rueckseite.style.display === "none" ? "block" : "none";
}

function naechsteKarteAnzeigen() {
  if (!karteikartenDaten.length) return;

  aktuelleKartenIndex++;

  if (aktuelleKartenIndex >= karteikartenDaten.length) {
    aktuelleKartenIndex = 0;
  }

  zeigeAktuelleKarte();
}

function vorherigeKarte() {
  if (!karteikartenDaten.length) return;

  aktuelleKartenIndex--;

  if (aktuelleKartenIndex < 0) {
    aktuelleKartenIndex = karteikartenDaten.length - 1;
  }

  zeigeAktuelleKarte();
}

function audioAktuelleKarte() {
  if (!karteikartenDaten.length) {
    document.getElementById("audioStatus").textContent =
      "Bitte zuerst Karteikarten laden.";
    return;
  }

  if (!("speechSynthesis" in window)) {
    document.getElementById("audioStatus").textContent =
      "Dein Browser unterstützt die Vorlesefunktion leider nicht.";
    return;
  }

  const karte = karteikartenDaten[aktuelleKartenIndex];

  const text =
    "Frage. " +
    String(karte.vorderseite || "") +
    ". Musterlösung. " +
    String(karte.rueckseite || "");

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "de-DE";
  utterance.rate = 0.95;
  utterance.pitch = 1;

  utterance.onstart = function() {
    document.getElementById("audioStatus").textContent =
      "Audio läuft: Karte " + (aktuelleKartenIndex + 1) + " von " + karteikartenDaten.length;
  };

  utterance.onend = function() {
    document.getElementById("audioStatus").textContent =
      "Audio beendet.";
  };

  utterance.onerror = function() {
    document.getElementById("audioStatus").textContent =
      "Audio konnte nicht abgespielt werden.";
  };

  window.speechSynthesis.speak(utterance);
}

function audioStoppen() {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }

  document.getElementById("audioStatus").textContent =
    "Audio gestoppt.";
}

async function frageKilian() {
  const frage = document.getElementById("kilianInput").value.trim();

  if (!frage) {
    alert("Bitte zuerst eine Frage eingeben.");
    return;
  }

  try {
    document.getElementById("kilianStatus").textContent = "Kilian denkt nach.";
    document.getElementById("kilianAntwort").textContent = "Antwort wird geladen.";

    const kilianResult = await apiPost("frageKilian", {
      frage: frage
    });

    if (!kilianResult.success) {
      throw new Error(kilianResult.error || "Fehler bei der Anfrage.");
    }

    document.getElementById("kilianAntwort").innerHTML =
      formatKilianAntwort(kilianResult.data?.antwort || "Keine Antwort erhalten.");

    document.getElementById("kilianStatus").textContent = "Antwort erhalten.";

  } catch (error) {
    document.getElementById("kilianStatus").textContent =
      "Fehler: " + error.message;
  }
}

function kilianLeeren() {
  document.getElementById("kilianInput").value = "";

  document.getElementById("kilianAntwort").textContent =
    "Hier erscheint die Antwort von Kilian.";

  document.getElementById("kilianStatus").textContent =
    "Kilian wartet auf deine Frage.";
}

function toggleKilianBubble() {
  const fenster = document.getElementById("kilianBubbleFenster");

  fenster.style.display =
    fenster.style.display === "block" ? "none" : "block";
}

async function frageKilianBubble() {
  const frage = document.getElementById("kilianBubbleInput").value.trim();

  if (!frage) {
    alert("Bitte zuerst eine Frage eingeben.");
    return;
  }

  try {
    document.getElementById("kilianBubbleStatus").textContent =
      "Kilian denkt nach...";

    document.getElementById("kilianBubbleAntwort").innerHTML =
      "Antwort wird geladen...";

    const result = await apiPost("frageKilian", {
      frage: frage
    });

    if (!result.success) {
      throw new Error(result.error || "Fehler bei der Anfrage.");
    }

    const antwort =
      result.data?.antwort || "Keine Antwort erhalten.";

    document.getElementById("kilianBubbleAntwort").innerHTML =
      formatKilianAntwort(antwort);

    document.getElementById("kilianBubbleStatus").textContent =
      "Antwort erhalten.";

  } catch (error) {
    document.getElementById("kilianBubbleStatus").textContent =
      "Fehler: " + error.message;
  }
}

function kilianBubbleVorlesen() {
  if (!("speechSynthesis" in window)) {
    return;
  }

  const text =
    document.getElementById("kilianBubbleAntwort").textContent;

  if (!text.trim()) return;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);

  utterance.lang = "de-DE";
  utterance.rate = 0.95;
  utterance.pitch = 1;

  window.speechSynthesis.speak(utterance);
}

function kilianBubbleAudioStoppen() {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}
