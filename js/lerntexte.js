// Ansicht "Lerntexte & Podcast"

const lerntexteFaecher = [
  "Führung und Zusammenarbeit",
  "Rechnungswesen",
  "Recht",
  "Steuern",
  "BWL",
  "VWL",
  "Unternehmensführung",
  "Betriebliches Management",
  "Logistik",
  "Marketing",
  "Vertrieb",
  "Betriebliches Rechnungswesen und Controlling",
  "Investition und Finanzierung"
];

let lerntexteFaecherAufgebaut = false;
let lerntexteAktuellesFach = "";
let lerntexteAktuellesKapitel = "";
let lerntexteDaten = [];

let lerntexteAudioAktiv = false;
let lerntexteAudioPausiert = false;
let lerntexteAudioGeneration = 0;
let lerntexteAudioChunks = [];
let lerntexteAudioChunkIndex = 0;
let lerntexteAudioProgressTotal = 0;
let lerntexteAudioProgressCompleted = 0;
let lerntexteAudioProgressCurrent = 0;
let lerntexteAudioCurrentChunkLength = 0;
let lerntexteAudioCurrentUtterance = null;
let lerntexteAudioTestAudio = null;
let lerntexteAudioTestCurrentUrl = "";
let lerntexteAudioTestHash = "";
let lerntexteAudioTestKapitelAktiv = false;
let lerntexteAudioPlaylist = [];
let lerntexteAudioPlaylistIndex = 0;
let lerntexteAudioQuelle = "";
const lerntexteAudioTestStatischeQuelle = "https://beckersabine082-art.github.io/wifa-trainer-gruen/audio/podcast/recht-rechtssubjekte-rechtsobjekte.mp3";

// Konvertiert einen Wert zu einem sicheren URL-Slug für Podcast-Dateipfade
function lerntexteAudioSlug(wert) {
  const text = String(wert || "").trim().toLowerCase();
  
  // Umlaute und ß ersetzen
  let slug = text
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
  
  // Andere Diakritika entfernen (Akzente, etc.)
  slug = slug.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  // Alles außer a-z, 0-9 und Bindestriche durch Bindestrich ersetzen
  slug = slug.replace(/[^a-z0-9\-]/g, "-");
  
  // Mehrfache Bindestriche zu einzelnen Bindestrichen zusammenfassen
  slug = slug.replace(/\-{2,}/g, "-");
  
  // Bindestriche am Anfang und Ende entfernen
  slug = slug.replace(/^\-+|\-+$/g, "");
  
  return slug;
}

// Erzeugt Firebase Storage-Pfad: podcast/<fach-slug>-<titel-slug>.mp3
function lerntexteAudioFirebasePfad(fach, eintrag) {
  if (!eintrag || !eintrag.titel) {
    return "";
  }
  
  const fachSlug = lerntexteAudioSlug(fach);
  const titelSlug = lerntexteAudioSlug(eintrag.titel);
  
  return "podcast/" + fachSlug + "-" + titelSlug + ".mp3";
}

function lerntexteAudioTestKapitelFinden(einheiten) {
  if (lerntexteAktuellesFach !== "Recht") return null;

  const passendeEinheiten = (einheiten || []).filter(function (eintrag) {
    // Prüfe auf hauptkapitel (z.B. "Rechtssubjekte und Rechtsobjekte")
    return String(eintrag && eintrag.titel || "").trim() === "Rechtssubjekte und Rechtsobjekte";
  });

  return passendeEinheiten.length >= 1
    ? passendeEinheiten[0]
    : null;
}

function lerntexteAudioTestKapitelMetadatenSetzen() {
  if (!("mediaSession" in navigator)) return;

  if ("MediaMetadata" in window) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: "Rechtssubjekte und Rechtsobjekte",
      artist: "Recht",
      album: "WiFa Trainer"
    });
  }
}

async function lerntexteAudioFirebaseUrlLaden(eintrag) {
  try {
    const { storage, ref, getDownloadURL } = await import('./firebase-config.js');
    
    // Verwende generalisierte Pfad-Funktion
    const storagePath = lerntexteAudioFirebasePfad(lerntexteAktuellesFach, eintrag);
    const storageRef = ref(storage, storagePath);
    const url = await getDownloadURL(storageRef);
    return url;
  } catch (error) {
    console.error("Firebase Storage Error:", error.code, error.message, error);
    throw error;
  }
}

function lerntexteAudioTestEreignisseBinden() {
  lerntexteAudioTestAudio.onended = function () {
    lerntexteAudioProgressSet(100, "Audio-Test beendet");
    lerntexteElement("lerntexteAudioStatus").textContent = "Test-Audio beendet.";
    if (lerntexteAudioTestKapitelAktiv) {
      lerntexteAudioAktiv = false;
      lerntexteAudioPausiert = false;
      lerntexteAudioSteuerungAktualisieren();
      lerntexteAudioMediaSessionAktualisieren();
    }
  };
  lerntexteAudioTestAudio.ontimeupdate = function () {
    if (!lerntexteAudioTestAudio.duration || !isFinite(lerntexteAudioTestAudio.duration)) return;
    const percent = (lerntexteAudioTestAudio.currentTime / lerntexteAudioTestAudio.duration) * 100;
    const minsCurrent = Math.floor(lerntexteAudioTestAudio.currentTime / 60);
    const secsCurrent = Math.floor(lerntexteAudioTestAudio.currentTime % 60);
    const minsTotal = Math.floor(lerntexteAudioTestAudio.duration / 60);
    const secsTotal = Math.floor(lerntexteAudioTestAudio.duration % 60);
    const timeText = String(minsCurrent).padStart(2, "0") + ":" + String(secsCurrent).padStart(2, "0") + " / " + String(minsTotal).padStart(2, "0") + ":" + String(secsTotal).padStart(2, "0");
    lerntexteAudioProgressSet(percent, timeText);
  };
}

function lerntexteTestAudioQuelleSetzen(url, text, eintrag, istTestKapitel) {
  lerntexteAudioTestCurrentUrl = url;
  lerntexteAudioTestHash = lerntexteAudioHash(text);
  lerntexteAudioTestKapitelAktiv = istTestKapitel;

  const domAudio = document.getElementById("lerntexteAudioPlayer");
  if (istTestKapitel && domAudio) {
    lerntexteAudioTestAudio = domAudio;
    lerntexteAudioTestAudio.preload = "auto";
    lerntexteAudioTestEreignisseBinden();
  } else if (!lerntexteAudioTestAudio || lerntexteAudioTestAudio === domAudio) {
    lerntexteAudioTestAudio = new Audio(url);
    lerntexteAudioTestAudio.preload = "auto";
    lerntexteAudioTestEreignisseBinden();
  }
  lerntexteAudioTestAudio.src = url;

  lerntexteAudioTestAudio.play();
  if (istTestKapitel) lerntexteAudioTestKapitelMetadatenSetzen();
  lerntexteElement("lerntexteAudioStatus").textContent = "Test-Audio läuft.";
  lerntexteAudioProgressSet(0, "0:00 / 0:00");
}

function lerntexteElement(id) {
  return document.getElementById(id);
}

function lerntexteAudioTextFuerEintrag(eintrag) {
  const directText = eintrag && eintrag.podcastText ? String(eintrag.podcastText).trim() : "";
  if (directText) {
    return directText;
  }

  const fallbackText = eintrag && eintrag.lerntext ? String(eintrag.lerntext).trim() : "";
  return fallbackText;
}

function lerntexteAudioPlaylistErstellen(einheiten) {
  const playlist = [];
  const liste = Array.isArray(einheiten) ? einheiten : [];

  liste.forEach(function (eintrag) {
    const text = lerntexteAudioTextFuerEintrag(eintrag);
    if (!text) {
      return;
    }

    playlist.push({
      eintrag: eintrag,
      titel: eintrag && eintrag.titel ? String(eintrag.titel) : "Lerneinheit",
      text: text,
      fach: String(lerntexteAktuellesFach || "")
    });
  });

  return playlist;
}

function lerntexteAudioHash(text) {
  const source = String(text || "");
  let hash = 0;
  for (let i = 0; i < source.length; i++) {
    hash = (hash * 31 + source.charCodeAt(i)) >>> 0;
  }
  return "audio-test-" + hash.toString(16);
}

async function lerntexteTestAudioStarten() {
  const einheiten = lerntexteAusgewaehlteEinheiten();
  if (!einheiten.length) {
    lerntexteElement("lerntexteAudioStatus").textContent = "Für den Test ist kein Kapitel ausgewählt.";
    return;
  }

  const eintrag = lerntexteAudioTestKapitelFinden(einheiten) || einheiten
    .slice()
    .sort(function (a, b) {
      return String(b.podcastText || b.lerntext || "").length - String(a.podcastText || a.lerntext || "").length;
    })[0];

  const text = String((eintrag && (eintrag.podcastText || eintrag.lerntext)) || "").trim();
  if (!text) {
    lerntexteElement("lerntexteAudioStatus").textContent = "Für den Test gibt es keinen Podcast-Text.";
    return;
  }

  const testKapitelCandidate = lerntexteAudioTestKapitelFinden(einheiten);
  const istTestKapitel = testKapitelCandidate === eintrag;
  
  if (istTestKapitel) {
    try {
      const firebaseUrl = await lerntexteAudioFirebaseUrlLaden(eintrag);
      lerntexteTestAudioQuelleSetzen(firebaseUrl, text, eintrag, true);
      return;
    } catch (error) {
      const errorMsg = "Firebase Audio konnte nicht geladen werden: " + error.message;
      console.error(errorMsg, error);
      lerntexteElement("lerntexteAudioStatus").textContent = errorMsg;
      return;
    }
  }

  if (lerntexteAudioTestAudio && lerntexteAudioTestHash === lerntexteAudioHash(text)) {
    lerntexteAudioTestKapitelAktiv = lerntexteAudioTestKapitelFinden(einheiten) === eintrag;
    if (lerntexteAudioTestAudio.ended) lerntexteAudioTestAudio.currentTime = 0;
    lerntexteAudioTestAudio.play();
    if (lerntexteAudioTestKapitelAktiv) lerntexteAudioTestKapitelMetadatenSetzen();
    lerntexteElement("lerntexteAudioStatus").textContent = "Test-Audio läuft.";
    return;
  }

  const baseUrl = new URL("https://script.google.com/macros/s/AKfycbxTymUhl29rdmXONuWRlVkoe8xiFXqVf2bWUju1XgC44l2qoUT3LTU_PownQrNHbBKUVA/exec");
  baseUrl.searchParams.set("action", "podcastAudioTest");
  baseUrl.searchParams.set("fach", String(lerntexteAktuellesFach || ""));
  baseUrl.searchParams.set("chapter", String(eintrag.hauptkapitelNr || ""));
  baseUrl.searchParams.set("titel", String(eintrag.titel || ""));
  baseUrl.searchParams.set("text", text);

  fetch(baseUrl.toString())
    .then(function (response) {
      if (!response.ok) {
        throw new Error("TTS-Request fehlgeschlagen: " + response.status);
      }
      return response.json();
    })
    .then(function (payload) {
      if (!payload || !payload.success) {
        throw new Error(payload && payload.error ? payload.error : "OpenAI-Response war ungültig.");
      }

      const data = payload.data || {};
      const base64Audio = String(data.audioBase64 || "").trim();
      if (!base64Audio) {
        throw new Error("OpenAI TTS lieferte keine Base64-Audiodaten.");
      }

      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: "audio/mpeg" });
      if (!blob || blob.size === 0) {
        throw new Error("OpenAI TTS lieferte keine Audio-Daten.");
      }

      const url = URL.createObjectURL(blob);
      lerntexteTestAudioQuelleSetzen(url, text, eintrag, false);
    })
    .catch(function (error) {
      lerntexteElement("lerntexteAudioStatus").textContent = "Test-Audio fehlgeschlagen: " + error.message;
    });
}

function lerntexteTestAudioStoppen() {
  if (lerntexteAudioTestAudio) {
    lerntexteAudioTestAudio.pause();
    lerntexteAudioTestAudio.currentTime = 0;
  }
  lerntexteAudioProgressZuruecksetzen();
  lerntexteElement("lerntexteAudioStatus").textContent = "Test-Audio gestoppt.";
}

function lerntexteAudioSteuerungAktualisieren() {
  const playBtn = lerntexteElement("lerntexteAudioPlayBtn");
  const pauseBtn = lerntexteElement("lerntexteAudioPauseBtn");
  const stopBtn = lerntexteElement("lerntexteAudioStopBtn");

  if (playBtn) {
    if (lerntexteAudioAktiv && !lerntexteAudioPausiert) {
      playBtn.textContent = "▶ Wiedergabe läuft";
      playBtn.disabled = true;
    } else if (lerntexteAudioPausiert) {
      playBtn.textContent = "▶ Fortsetzen";
      playBtn.disabled = false;
    } else {
      playBtn.textContent = "▶ Anhören";
      playBtn.disabled = false;
    }
  }

  if (pauseBtn) {
    pauseBtn.disabled = !(lerntexteAudioAktiv && !lerntexteAudioPausiert);
  }

  if (stopBtn) {
    stopBtn.disabled = !lerntexteAudioAktiv;
  }
}

function lerntexteAudioProgressSet(percent, metaText) {
  const bar = lerntexteElement("lerntexteAudioProgressBar");
  const percentLabel = lerntexteElement("lerntexteAudioProgressPercent");
  const metaLabel = lerntexteElement("lerntexteAudioProgressMeta");
  const wrapper = lerntexteElement("lerntexteAudioProgressWrapper");

  const clampedPercent = Math.max(0, Math.min(100, Number(percent) || 0));

  if (wrapper) {
    wrapper.hidden = false;
  }

  if (bar) {
    bar.style.width = clampedPercent + "%";
  }

  if (percentLabel) {
    percentLabel.textContent = Math.round(clampedPercent) + " %";
  }

  if (metaLabel && metaText) {
    metaLabel.textContent = metaText;
  }
}

function lerntexteAudioProgressZuruecksetzen() {
  lerntexteAudioProgressTotal = 0;
  lerntexteAudioProgressCompleted = 0;
  lerntexteAudioProgressCurrent = 0;
  lerntexteAudioChunkIndex = 0;
  lerntexteAudioCurrentChunkLength = 0;
  lerntexteAudioProgressSet(0, "Abschnitt 0 von 0");
}

function lerntexteAudioProgressAktualisieren() {
  const totalChars = Math.max(1, lerntexteAudioProgressTotal);
  const currentChunkLength = Math.max(0, lerntexteAudioCurrentChunkLength || 0);
  const currentProgressChars = Math.max(0, Math.min(currentChunkLength, lerntexteAudioProgressCurrent || 0));
  const totalProgress = lerntexteAudioProgressCompleted + currentProgressChars;
  const percent = (totalProgress / totalChars) * 100;

  const currentChunkNumber = lerntexteAudioChunks.length
    ? Math.max(1, Math.min(lerntexteAudioChunks.length, lerntexteAudioChunkIndex + 1))
    : 0;
  const metaText = lerntexteAudioChunks.length
    ? "Abschnitt " + currentChunkNumber + " von " + lerntexteAudioChunks.length
    : "Abschnitt 0 von 0";

  lerntexteAudioProgressSet(percent, metaText);
}

function lerntexteAudioMediaSessionAktualisieren() {
  if (!("mediaSession" in navigator)) return;

  let title = "Lerntext";
  if (lerntexteAudioPlaylist.length && lerntexteAudioPlaylistIndex >= 0 && lerntexteAudioPlaylistIndex < lerntexteAudioPlaylist.length) {
    const currentItem = lerntexteAudioPlaylist[lerntexteAudioPlaylistIndex];
    if (currentItem && currentItem.titel) {
      title = currentItem.titel;
    }
  }

  const chapterLabel = lerntexteElement("lerntexteAudioChapterLabel");
  if (chapterLabel && chapterLabel.textContent) {
    title = chapterLabel.textContent;
  }

  if ("MediaMetadata" in window) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: title,
      artist: lerntexteAktuellesFach || "WiFa Trainer",
      album: "WiFa Trainer"
    });
  }

  navigator.mediaSession.playbackState = lerntexteAudioAktiv && !lerntexteAudioPausiert ? "playing" : "paused";
  navigator.mediaSession.setActionHandler("play", function () {
    lerntexteAudioAbspielen();
  });
  navigator.mediaSession.setActionHandler("pause", function () {
    lerntexteAudioPausieren();
  });
  navigator.mediaSession.setActionHandler("stop", function () {
    lerntexteAudioStoppen("Wiedergabe beendet.");
  });
}

function initialisiereLerntexteAnsicht() {
  if (lerntexteFaecherAufgebaut) return;
  lerntexteFaecherAufgebaut = true;

  const grid = lerntexteElement("lerntexteFachGrid");
  grid.innerHTML = "";

  lerntexteFaecher.forEach(function (fach) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "subject-btn";
    button.textContent = fach;
    button.onclick = function () {
      lerntexteFachWaehlen(fach);
    };
    grid.appendChild(button);
  });
}

async function lerntexteFachWaehlen(fach) {
  lerntexteAudioStoppen();
  lerntexteAktuellesFach = fach;
  lerntexteAktuellesKapitel = "";
  lerntexteDaten = [];

  document.querySelectorAll("#lerntexteFachGrid .subject-btn").forEach(function (button) {
    button.classList.toggle("active", button.textContent === fach);
  });

  lerntexteElement("lerntexteKapitelBereich").style.display = "none";
  lerntexteElement("lerntexteAudioCard").style.display = "none";
  lerntexteElement("lerntexteInhaltBereich").innerHTML = "";
  lerntexteAudioProgressZuruecksetzen();

  try {
    lerntexteElement("lerntexteStatus").textContent = "Lerntexte werden geladen...";

    const result = await apiGet("getLerntexte", { fach: fach });

    if (!result.success) {
      throw new Error(result.error || "Lerntexte konnten nicht geladen werden.");
    }

    lerntexteDaten = (result.data || [])
      .slice()
      .sort(function (a, b) {
        return (Number(a.reihenfolgeFach) || 0) - (Number(b.reihenfolgeFach) || 0)
          || (Number(a.reihenfolgeKapitel) || 0) - (Number(b.reihenfolgeKapitel) || 0);
      });

    if (!lerntexteDaten.length) {
      lerntexteElement("lerntexteStatus").textContent = "Für dieses Fach sind noch keine Lerntexte hinterlegt.";
      return;
    }

    lerntexteBaueKapitelDropdown();
    lerntexteElement("lerntexteKapitelBereich").style.display = "block";
    lerntexteElement("lerntexteAudioCard").style.display = "block";
    lerntexteElement("lerntexteStatus").textContent = lerntexteDaten.length + " Lerneinheiten geladen.";

    const titelElement = lerntexteElement("lerntexteAudioChapterLabel");
    if (titelElement) {
      titelElement.textContent = lerntexteAktuellesKapitel ? "Kapitel " + lerntexteAktuellesKapitel : lerntexteAktuellesFach;
    }

    lerntexteAnzeigen();

  } catch (error) {
    lerntexteElement("lerntexteStatus").textContent =
      "Fehler beim Laden der Lerntexte: " + error.message;
  }
}

function lerntexteBaueKapitelDropdown() {
  const select = lerntexteElement("lerntexteKapitelSelect");
  select.innerHTML = '<option value="">Alle Kapitel</option>';

  const gesehen = new Set();

  lerntexteDaten.forEach(function (eintrag) {
    const key = String(eintrag.hauptkapitelNr);
    if (gesehen.has(key)) return;
    gesehen.add(key);

    const option = document.createElement("option");
    option.value = key;
    option.textContent = "Kapitel " + eintrag.hauptkapitelNr + " – " + eintrag.hauptkapitel;
    select.appendChild(option);
  });
}

function lerntexteKapitelWaehlen() {
  lerntexteAudioStoppen();
  lerntexteAktuellesKapitel = lerntexteElement("lerntexteKapitelSelect").value;
  const titelElement = lerntexteElement("lerntexteAudioChapterLabel");
  if (titelElement) {
    titelElement.textContent = lerntexteAktuellesKapitel ? "Kapitel " + lerntexteAktuellesKapitel : lerntexteAktuellesFach;
  }
  lerntexteAnzeigen();
}

function lerntexteAusgewaehlteEinheiten() {
  if (!lerntexteAktuellesKapitel) return lerntexteDaten;
  return lerntexteDaten.filter(function (eintrag) {
    return String(eintrag.hauptkapitelNr) === lerntexteAktuellesKapitel;
  });
}

function lerntexteTextZuChunks(text) {
  const normalisierterText = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\u00A0/g, " ")
    .replace(/\s*\|\s*/g, "\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!normalisierterText) {
    return [];
  }

  const blocks = normalisierterText
    .split(/\n\s*\n+/)
    .map(function (block) {
      return String(block || "").trim();
    })
    .filter(Boolean);

  const chunks = [];

  blocks.forEach(function (block) {
    const sentenceCandidates = block
      .split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ0-9])/)
      .map(function (piece) {
        return String(piece || "").replace(/\s+/g, " ").trim();
      })
      .filter(Boolean);

    if (sentenceCandidates.length > 1) {
      chunks.push.apply(chunks, sentenceCandidates);
      return;
    }

    const lineCandidates = block
      .split(/\n+/)
      .map(function (line) {
        return String(line || "").replace(/\s+/g, " ").trim();
      })
      .filter(Boolean);

    if (lineCandidates.length > 1) {
      chunks.push.apply(chunks, lineCandidates);
      return;
    }

    chunks.push(block.replace(/\s+/g, " ").trim());
  });

  return chunks.filter(Boolean);
}

function lerntexteAbschnitteFuerEinheiten(einheiten) {
  const chunks = [];

  einheiten.forEach(function (eintrag) {
    const textQuelle = String((eintrag.podcastText && eintrag.podcastText.trim()) || (eintrag.lerntext || "")).trim();
    if (!textQuelle) {
      return;
    }

    const abschnitte = lerntexteTextZuChunks(textQuelle);
    if (abschnitte.length) {
      chunks.push.apply(chunks, abschnitte);
    }
  });

  return chunks.filter(function (chunk) {
    return String(chunk || "").trim();
  });
}

// Erkennt vollständig großgeschriebene Abschnittsbezeichnungen (z.B. "KERNIDEE:") am Absatzanfang,
// nach einem Zeilenumbruch oder nach " | " und formatiert sie als klare Lernabschnitte.
function lerntexteHebeAbschnittsbezeichnungenHervor(escapedText) {
  return escapedText.replace(
    /(^|\n|\|\s*)([A-ZÄÖÜ][A-ZÄÖÜ0-9 \/\-\.()&]*:)/gm,
    function (match, prefix, label) {
      return prefix + '<strong class="lerntexte-abschnitt">' + label + "</strong>";
    }
  );
}

function lerntexteFormatiereText(text) {
  const normalisierterText = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\s*\|\s*/g, "\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const absatzListe = normalisierterText.split(/\n\s*\n/).filter(function (absatz) {
    return String(absatz || "").trim();
  });

  return absatzListe
    .map(function (absatz) {
      const klarerAbsatz = String(absatz || "").trim();
      if (!klarerAbsatz) return "";

      const sectionMatcher = klarerAbsatz.match(/^([A-ZÄÖÜ][A-ZÄÖÜ0-9 \/\-\.()&]*?)(?::|\s*$)\s*(.*)$/s);
      if (sectionMatcher) {
        const label = String(sectionMatcher[1] || "").trim();
        const rest = String(sectionMatcher[2] || "").trim();
        const normalizedLabel = label.toUpperCase();
        const isKernidee = normalizedLabel === "KERNIDEE";
        const isSectionHeading = /^(KERNIDEE|NATÜRLICHE PERSONEN|JURISTISCHE PERSONEN|SACHEN UND RECHTE|BEWEGLICHE ODER UNBEWEGLICH|BEWEGLICHE UND UNBEWEGLICHE SACHEN|BESTANDTEILE|EIGENSCHAFTEN|RECHTSFOLGEN)$/i.test(normalizedLabel);

        if (isKernidee || isSectionHeading) {
          const wrapperClass = isKernidee ? "lerntexte-kernidee" : "lerntexte-sektionsblock";
          const sectionHeader = '<div class="lerntexte-section-header">' + escapeHtml(label.replace(/:$/, "")) + '</div>';
          const bodyHtml = rest
            ? '<p>' + lerntexteHebeAbschnittsbezeichnungenHervor(escapeHtml(rest)).replace(/\n/g, "<br>") + '</p>'
            : "";
          return '<div class="' + wrapperClass + '">' + sectionHeader + bodyHtml + '</div>';
        }
      }

      const hervorgehoben = lerntexteHebeAbschnittsbezeichnungenHervor(escapeHtml(klarerAbsatz));
      return "<p>" + hervorgehoben.replace(/\n/g, "<br>") + "</p>";
    })
    .join("");
}

// Google Sheets interpretiert Werte wie "1.1" oder "5.10" teils als Datum
function lerntexteNormalisiereUnterkapitelNr(wert) {
  const text = String(wert === null || wert === undefined ? "" : wert).trim();

  if (/^\d+\.\d+$/.test(text)) return text;

  const datum = new Date(wert);
  if (!isNaN(datum.getTime())) {
    return datum.getDate() + "." + (datum.getMonth() + 1);
  }

  return text;
}

function lerntexteAnzeigen() {
  const bereich = lerntexteElement("lerntexteInhaltBereich");
  bereich.innerHTML = "";

  const einheiten = lerntexteAusgewaehlteEinheiten();
  if (!einheiten.length) return;

  const zeigeKapitelUeberschrift = !lerntexteAktuellesKapitel;
  let letzteKapitelNr = null;

  einheiten.forEach(function (eintrag) {
    if (zeigeKapitelUeberschrift && String(eintrag.hauptkapitelNr) !== letzteKapitelNr) {
      letzteKapitelNr = String(eintrag.hauptkapitelNr);

      const kapitelTitel = document.createElement("h3");
      kapitelTitel.className = "lerntexte-kapitel-titel";
      kapitelTitel.textContent = "Kapitel " + eintrag.hauptkapitelNr + " – " + eintrag.hauptkapitel;
      bereich.appendChild(kapitelTitel);
    }

    const block = document.createElement("div");
    block.className = "lerntexte-einheit";

    const titel = document.createElement("h4");
    titel.className = "lerntexte-einheit-titel";
    const unterkapitelNr = eintrag.unterkapitelNr ? lerntexteNormalisiereUnterkapitelNr(eintrag.unterkapitelNr) : "";
    titel.textContent = (unterkapitelNr ? unterkapitelNr + " " : "") + (eintrag.titel || "");

    const text = document.createElement("div");
    text.className = "lerntexte-text";
    text.innerHTML = lerntexteFormatiereText(eintrag.lerntext);

    block.appendChild(titel);
    block.appendChild(text);
    bereich.appendChild(block);
  });
}

function lerntexteAudioPlaylistWeiter() {
  if (!lerntexteAudioPlaylist.length) {
    lerntexteAudioStoppen("Alle Lerneinheiten wurden abgespielt.");
    return;
  }

  if (lerntexteAudioPlaylistIndex >= lerntexteAudioPlaylist.length) {
    lerntexteAudioStoppen("Alle Lerneinheiten wurden abgespielt.");
    return;
  }

  const total = lerntexteAudioPlaylist.length;
  const currentItem = lerntexteAudioPlaylist[lerntexteAudioPlaylistIndex];
  const title = currentItem && currentItem.titel ? currentItem.titel : "Lerneinheit";
  const statusText = "Audio läuft: " + (lerntexteAudioPlaylistIndex + 1) + " von " + total + " – " + title;

  if (lerntexteElement("lerntexteAudioStatus")) {
    lerntexteElement("lerntexteAudioStatus").textContent = statusText;
  }

  const chapterLabel = lerntexteElement("lerntexteAudioChapterLabel");
  if (chapterLabel) {
    chapterLabel.textContent = title;
  }

  lerntexteAudioProgressSet(0, "0:00 / 0:00");
  lerntexteAudioMediaSessionAktualisieren();

  async function startFirebaseTry() {
    const domAudio = document.getElementById("lerntexteAudioPlayer");

    try {
      const url = await lerntexteAudioFirebaseUrlLaden(currentItem.eintrag);
      lerntexteAudioQuelle = "firebase";
      if (domAudio) {
        domAudio.src = url;
        domAudio.load();
        domAudio.onended = function () {
          if (!lerntexteAudioAktiv || lerntexteAudioPausiert) return;
          lerntexteAudioPlaylistIndex += 1;
          lerntexteAudioPlaylistWeiter();
        };
        domAudio.ontimeupdate = function () {
          if (!domAudio.duration || !isFinite(domAudio.duration)) return;
          const percent = (domAudio.currentTime / domAudio.duration) * 100;
          const minsCurrent = Math.floor(domAudio.currentTime / 60);
          const secsCurrent = Math.floor(domAudio.currentTime % 60);
          const minsTotal = Math.floor(domAudio.duration / 60);
          const secsTotal = Math.floor(domAudio.duration % 60);
          const timeText = String(minsCurrent).padStart(2, "0") + ":" + String(secsCurrent).padStart(2, "0") + " / " + String(minsTotal).padStart(2, "0") + ":" + String(secsTotal).padStart(2, "0");
          lerntexteAudioProgressSet(percent, timeText);
        };
        domAudio.play();
      }
      return;
    } catch (error) {
      const reasonCode = error && error.code ? error.code : "";
      if (reasonCode === "storage/object-not-found") {
        lerntexteAudioQuelle = "speechSynthesis";
        const generation = ++lerntexteAudioGeneration;
        lerntexteAudioAktiv = true;
        lerntexteAudioPausiert = false;
        lerntexteAudioChunks = [currentItem.text];
        lerntexteAudioChunkIndex = 0;
        lerntexteAudioProgressTotal = currentItem.text.length;
        lerntexteAudioProgressCompleted = 0;
        lerntexteAudioProgressCurrent = 0;
        lerntexteAudioCurrentChunkLength = currentItem.text.length;
        lerntexteAudioProgressAktualisieren();
        lerntexteAudioSteuerungAktualisieren();

        if (!("speechSynthesis" in window)) {
          lerntexteElement("lerntexteAudioStatus").textContent = "Dein Browser unterstützt die Vorlesefunktion leider nicht.";
          return;
        }

        const utterance = new SpeechSynthesisUtterance(currentItem.text);
        utterance.lang = "de-DE";
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.volume = 1;
        lerntexteAudioCurrentUtterance = utterance;

        utterance.onstart = function () {
          if (generation !== lerntexteAudioGeneration) return;
          lerntexteAudioAktiv = true;
          lerntexteAudioPausiert = false;
          lerntexteElement("lerntexteAudioStatus").textContent = "Audio läuft: " + (lerntexteAudioPlaylistIndex + 1) + " von " + total + " – " + title;
          lerntexteAudioSteuerungAktualisieren();
          lerntexteAudioMediaSessionAktualisieren();
        };

        utterance.onboundary = function (event) {
          if (generation !== lerntexteAudioGeneration || !lerntexteAudioAktiv) return;
          const nextProgress = typeof event.charIndex === "number" ? event.charIndex : 0;
          lerntexteAudioProgressCurrent = Math.max(0, Math.min(lerntexteAudioCurrentChunkLength, nextProgress));
          lerntexteAudioProgressAktualisieren();
        };

        utterance.onend = function () {
          if (generation !== lerntexteAudioGeneration || !lerntexteAudioAktiv) return;
          lerntexteAudioPlaylistIndex += 1;
          lerntexteAudioPlaylistWeiter();
        };

        utterance.onerror = function () {
          if (generation === lerntexteAudioGeneration) {
            lerntexteAudioStoppen("Audio konnte nicht abgespielt werden.");
          }
        };

        window.speechSynthesis.speak(utterance);
        return;
      }

      const errorMessage = error && error.message ? error.message : "Unbekannter Fehler";
      lerntexteAudioStoppen("Audio konnte nicht geladen werden.");
      lerntexteElement("lerntexteAudioStatus").textContent = "Audio konnte nicht geladen werden: " + errorMessage;
    }
  }

  startFirebaseTry();
}

function lerntexteAudioStoppen(status) {
  lerntexteAudioGeneration++;
  lerntexteAudioAktiv = false;
  lerntexteAudioPausiert = false;
  lerntexteAudioQuelle = "";
  lerntexteAudioPlaylist = [];
  lerntexteAudioPlaylistIndex = 0;
  lerntexteAudioChunks = [];
  lerntexteAudioChunkIndex = 0;
  lerntexteAudioProgressCompleted = 0;
  lerntexteAudioProgressCurrent = 0;
  lerntexteAudioCurrentChunkLength = 0;
  lerntexteAudioCurrentUtterance = null;

  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }

  const player = document.getElementById("lerntexteAudioPlayer");
  if (player) {
    player.pause();
    player.currentTime = 0;
    player.onended = null;
    player.ontimeupdate = null;
  }

  if (lerntexteAudioTestKapitelAktiv && lerntexteAudioTestAudio) {
    lerntexteAudioTestAudio.pause();
    lerntexteAudioTestAudio.currentTime = 0;
    lerntexteAudioTestKapitelAktiv = false;
  }

  if (lerntexteElement("lerntexteAudioStatus")) {
    lerntexteElement("lerntexteAudioStatus").textContent = status || "Audio gestoppt.";
  }

  lerntexteAudioProgressZuruecksetzen();
  lerntexteAudioSteuerungAktualisieren();
  lerntexteAudioMediaSessionAktualisieren();
}

function lerntexteAudioAbspielen() {
  if (lerntexteAudioPausiert) {
    if (lerntexteAudioQuelle === "firebase") {
      const player = document.getElementById("lerntexteAudioPlayer");
      if (player) {
        player.play();
      }
    } else if (lerntexteAudioQuelle === "speechSynthesis" && "speechSynthesis" in window) {
      window.speechSynthesis.resume();
    }

    lerntexteAudioPausiert = false;
    lerntexteAudioSteuerungAktualisieren();
    lerntexteElement("lerntexteAudioStatus").textContent = "Audio läuft.";
    lerntexteAudioMediaSessionAktualisieren();
    return;
  }

  const einheiten = lerntexteAusgewaehlteEinheiten();
  if (!einheiten.length) {
    lerntexteElement("lerntexteAudioStatus").textContent = "Keine Lerneinheiten zum Anhören vorhanden.";
    return;
  }

  const playlist = lerntexteAudioPlaylistErstellen(einheiten);
  if (!playlist.length) {
    lerntexteElement("lerntexteAudioStatus").textContent = "Für diesen Abschnitt sind keine Vorlesetexte verfügbar.";
    return;
  }

  lerntexteAudioAktiv = true;
  lerntexteAudioPausiert = false;
  lerntexteAudioPlaylist = playlist;
  lerntexteAudioPlaylistIndex = 0;
  lerntexteAudioQuelle = "";
  lerntexteAudioProgressSet(0, "0:00 / 0:00");
  lerntexteAudioSteuerungAktualisieren();
  lerntexteAudioPlaylistWeiter();
}

function lerntexteSprechen(chunks, index, generation) {
  if (generation !== lerntexteAudioGeneration || !lerntexteAudioAktiv) return;
  if (index >= chunks.length) {
    lerntexteAudioProgressCompleted = Math.max(lerntexteAudioProgressCompleted, lerntexteAudioProgressTotal);
    lerntexteAudioProgressCurrent = 0;
    lerntexteAudioCurrentChunkLength = 0;
    lerntexteAudioProgressSet(100, "Abschnitt " + chunks.length + " von " + chunks.length);
    lerntexteAudioStoppen("Alle Podcast-Texte wurden vorgelesen.");
    return;
  }

  const chunk = String(chunks[index] || "").trim();
  if (!chunk) {
    lerntexteSprechen(chunks, index + 1, generation);
    return;
  }

  const utterance = new SpeechSynthesisUtterance(chunk);
  utterance.lang = "de-DE";
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.volume = 1;
  lerntexteAudioCurrentUtterance = utterance;
  lerntexteAudioChunkIndex = index;
  lerntexteAudioProgressCurrent = 0;
  lerntexteAudioCurrentChunkLength = chunk.length;
  lerntexteAudioProgressAktualisieren();

  utterance.onstart = function () {
    if (generation !== lerntexteAudioGeneration) return;
    lerntexteAudioAktiv = true;
    lerntexteAudioPausiert = false;
    lerntexteElement("lerntexteAudioStatus").textContent =
      "Audio läuft: Abschnitt " + (index + 1) + " von " + chunks.length;
    lerntexteAudioSteuerungAktualisieren();
    lerntexteAudioMediaSessionAktualisieren();
  };

  utterance.onboundary = function (event) {
    if (generation !== lerntexteAudioGeneration || !lerntexteAudioAktiv) return;
    const nextProgress = typeof event.charIndex === "number" ? event.charIndex : 0;
    lerntexteAudioProgressCurrent = Math.max(0, Math.min(lerntexteAudioCurrentChunkLength, nextProgress));
    lerntexteAudioProgressAktualisieren();
  };

  utterance.onend = function () {
    if (generation !== lerntexteAudioGeneration || !lerntexteAudioAktiv) return;
    lerntexteAudioProgressCompleted += lerntexteAudioCurrentChunkLength;
    lerntexteAudioProgressCurrent = 0;
    lerntexteAudioCurrentChunkLength = 0;
    lerntexteAudioCurrentUtterance = null;
    lerntexteSprechen(chunks, index + 1, generation);
  };

  utterance.onerror = function () {
    if (generation === lerntexteAudioGeneration) {
      lerntexteAudioStoppen("Audio konnte nicht abgespielt werden.");
    }
  };

  window.speechSynthesis.speak(utterance);
}

function lerntexteAudioPausieren() {
  if (!lerntexteAudioAktiv || lerntexteAudioPausiert) return;
  lerntexteAudioPausiert = true;

  if (lerntexteAudioQuelle === "firebase") {
    const player = document.getElementById("lerntexteAudioPlayer");
    if (player) {
      player.pause();
    }
  } else if ("speechSynthesis" in window) {
    window.speechSynthesis.pause();
  }

  lerntexteElement("lerntexteAudioStatus").textContent = "Audio pausiert.";
  lerntexteAudioSteuerungAktualisieren();
  lerntexteAudioMediaSessionAktualisieren();
}

window.initialisiereLerntexteAnsicht = initialisiereLerntexteAnsicht;
window.lerntexteAudioStoppen = lerntexteAudioStoppen;
window.lerntexteAudioAbspielen = lerntexteAudioAbspielen;
window.lerntexteAudioSlug = lerntexteAudioSlug;
window.lerntexteAudioFirebasePfad = lerntexteAudioFirebasePfad;
window.lerntexteAudioTextFuerEintrag = lerntexteAudioTextFuerEintrag;
window.lerntexteAudioPlaylistErstellen = lerntexteAudioPlaylistErstellen;
