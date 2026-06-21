const API_BASE_URL = "https://script.google.com/macros/s/AKfycbxTymUhl29rdmXONuWRlVkoe8xiFXqVf2bWUju1XgC44l2qoUT3LTU_PownQrNHbBKUVA/exec";

async function apiGet(action, params = {}) {
    const url = new URL(API_BASE_URL);
    url.searchParams.set("action", action);

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, value);
      }
    });

    const response = await fetch(url.toString(), { method: "GET" });

    if (!response.ok) {
      throw new Error("HTTP-Fehler: " + response.status);
    }

    return await response.json();
  }

async function apiPost(action, payload = {}) {
    const response = await fetch(API_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        action,
        ...payload
      })
    });

    if (!response.ok) {
      throw new Error("HTTP-Fehler: " + response.status);
    }

    return await response.json();
  }

async function bewertePruefungsAntworten(daten) {

  const response = await fetch(API_BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify({
      action: "bewertePruefung",
      daten: daten
    })
  });

  return await response.json();
}
