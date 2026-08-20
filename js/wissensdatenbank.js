function kartenTeilbereichWaehlen() {
  karteikartenAudioStoppen();
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
  karteikartenAudioStoppen();
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
  karteikartenAudioStoppen();
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

  karteikartenAudioStoppen();

  aktuelleKartenIndex++;

  if (aktuelleKartenIndex >= karteikartenDaten.length) {
    aktuelleKartenIndex = 0;
  }

  zeigeAktuelleKarte();
}

function vorherigeKarte() {
  if (!karteikartenDaten.length) return;

  karteikartenAudioStoppen();

  aktuelleKartenIndex--;

  if (aktuelleKartenIndex < 0) {
    aktuelleKartenIndex = karteikartenDaten.length - 1;
  }

  zeigeAktuelleKarte();
}

let audioModus = "einzelkarte";
let audioTempo = 1;
let podcastPauseSekunden = 5;
let podcastAktiv = false;
let podcastPausiert = false;
let podcastTimer = null;
let podcastPauseEnde = 0;
let audioGeneration = 0;

function audioElement(id) {
  return document.getElementById(id);
}

function audioModusWaehlen(modus) {
  karteikartenAudioStoppen();
  audioModus = modus === "podcast" ? "podcast" : "einzelkarte";
  audioElement("podcastPauseEinstellung").hidden = audioModus !== "podcast";
  audioElement("audioEinzelStartBtn").hidden = audioModus === "podcast";
  audioElement("podcastStartBtn").hidden = audioModus !== "podcast";
  audioElement("audioPauseBtn").hidden = audioModus !== "podcast";
  audioElement("audioFortsetzenBtn").hidden = audioModus !== "podcast";
  audioElement("audioStopBtn").textContent = audioModus === "podcast" ? "Stoppen" : "Audio stoppen";
  audioSteuerungAktualisieren();
}

function audioTempoWaehlen(tempo) {
  audioTempo = Number(tempo) || 1;
}

function podcastPauseWaehlen(sekunden) {
  podcastPauseSekunden = Number(sekunden) || 5;
}

function audioSteuerungAktualisieren() {
  const aktiv = podcastAktiv && !podcastPausiert;
  audioElement("audioPauseBtn").disabled = !aktiv;
  audioElement("audioFortsetzenBtn").disabled = !podcastPausiert;
  audioElement("podcastStartBtn").disabled = podcastAktiv;
}

function karteikartenAudioStoppen(status) {
  audioGeneration++;
  podcastAktiv = false;
  podcastPausiert = false;
  podcastPauseEnde = 0;
  if (podcastTimer !== null) {
    clearTimeout(podcastTimer);
    podcastTimer = null;
  }
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  if (status && audioElement("audioStatus")) {
    audioElement("audioStatus").textContent = status;
  }
  if (audioElement("audioPauseBtn")) {
    audioSteuerungAktualisieren();
  }
}

function audioAktuelleKarte() {
  if (audioModus === "podcast") {
    podcastStarten();
    return;
  }
  if (!karteikartenDaten.length) {
    audioElement("audioStatus").textContent = "Bitte zuerst Karteikarten laden.";
    return;
  }
  if (!("speechSynthesis" in window)) {
    audioElement("audioStatus").textContent = "Dein Browser unterstützt die Vorlesefunktion leider nicht.";
    return;
  }
  karteikartenAudioStoppen();
  sprecheKarte(aktuelleKartenIndex, false, ++audioGeneration);
}

function sprecheKarte(index, podcast, generation) {
  const karte = karteikartenDaten[index];
  if (!karte || generation !== audioGeneration || !((podcast && podcastAktiv) || !podcast)) return;

  const texte = [
    "Frage. " + String(karte.vorderseite || ""),
    "Musterlösung. " + String(karte.rueckseite || "")
  ];
  let textIndex = 0;

  function sprecheNaechstenText() {
    if (generation !== audioGeneration || (podcast && (!podcastAktiv || podcastPausiert))) return;
    const utterance = new SpeechSynthesisUtterance(texte[textIndex]);
    utterance.lang = "de-DE";
    utterance.rate = audioTempo;
    utterance.pitch = 1;
    utterance.onstart = function() {
      audioElement("audioStatus").textContent = "Audio läuft: Karte " + (index + 1) + " von " + karteikartenDaten.length;
    };
    utterance.onend = function() {
      if (generation !== audioGeneration) return;
      textIndex++;
      if (textIndex < texte.length) {
        sprecheNaechstenText();
      } else if (podcast) {
        podcastNaechsteKarte(generation, index);
      } else {
        audioElement("audioStatus").textContent = "Audio beendet.";
      }
    };
    utterance.onerror = function() {
      if (generation === audioGeneration) {
        audioElement("audioStatus").textContent = "Audio konnte nicht abgespielt werden.";
      }
    };
    window.speechSynthesis.speak(utterance);
  }

  window.speechSynthesis.cancel();
  sprecheNaechstenText();
}

function podcastStarten() {
  if (!karteikartenDaten.length) {
    audioElement("audioStatus").textContent = "Bitte zuerst Karteikarten laden.";
    return;
  }
  if (!("speechSynthesis" in window)) {
    audioElement("audioStatus").textContent = "Dein Browser unterstützt die Vorlesefunktion leider nicht.";
    return;
  }
  karteikartenAudioStoppen();
  podcastAktiv = true;
  const generation = ++audioGeneration;
  audioSteuerungAktualisieren();
  sprecheKarte(aktuelleKartenIndex, true, generation);
}

function podcastNaechsteKarte(generation, index) {
  if (generation !== audioGeneration || !podcastAktiv) return;
  if (index >= karteikartenDaten.length - 1) {
    karteikartenAudioStoppen("Alle Karteikarten wurden vorgelesen.");
    return;
  }
  podcastPauseEnde = Date.now() + podcastPauseSekunden * 1000;
  audioElement("audioStatus").textContent = "Pause zwischen den Karten.";
  podcastTimer = setTimeout(function() {
    podcastTimer = null;
    if (generation !== audioGeneration || !podcastAktiv || podcastPausiert) return;
    aktuelleKartenIndex = index + 1;
    zeigeAktuelleKarte();
    sprecheKarte(aktuelleKartenIndex, true, generation);
  }, podcastPauseSekunden * 1000);
}

function audioPausieren() {
  if (!podcastAktiv || podcastPausiert) return;
  podcastPausiert = true;
  if (podcastTimer !== null) {
    clearTimeout(podcastTimer);
    podcastTimer = null;
    podcastPauseEnde = Math.max(0, podcastPauseEnde - Date.now());
  }
  if ("speechSynthesis" in window) window.speechSynthesis.pause();
  audioElement("audioStatus").textContent = "Podcast pausiert.";
  audioSteuerungAktualisieren();
}

function audioFortsetzen() {
  if (!podcastAktiv || !podcastPausiert) return;
  podcastPausiert = false;
  if ("speechSynthesis" in window) window.speechSynthesis.resume();
  if (podcastPauseEnde > 0) {
    const generation = audioGeneration;
    podcastTimer = setTimeout(function() {
      podcastTimer = null;
      if (generation !== audioGeneration || !podcastAktiv || podcastPausiert) return;
      aktuelleKartenIndex++;
      zeigeAktuelleKarte();
      sprecheKarte(aktuelleKartenIndex, true, generation);
    }, podcastPauseEnde);
    podcastPauseEnde = 0;
  }
  audioSteuerungAktualisieren();
}

function audioStoppen() {
  karteikartenAudioStoppen("Audio gestoppt.");
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
