# Real Evaluation Diagnostic Guide

**Goal:** Capture actual criteria and OpenAI response for: "Definieren Sie die Begriffe Vision und Mission."

---

## What We Know From UI Output

**Recognized Criteria (marked as ✓):**
1. Vision Zukunftsbild
2. Mission Unternehmensauftrag
3. Nutzen für Kunden

**Missing Criteria (marked as ✗):**
1. langfristige Ziele
2. Nutzen für Gesellschaft

**User Answer:**
"Vision ist zukunftsleittragende Gedanke und die Mission zeigt welche langfristigen Ziele das Unternehmen hat und welche langfristigen Ziele das Unternehmen hat und welche Nutzen die Gesellschaft, Kunden, verbraucher und Kooperationspartner haben"

---

## What We Need to Prove Root Cause

To determine if this is a **code regression** vs **semantic evaluation gap** vs **deployment mismatch**, we need:

### 1. Exact Criteria Sent to OpenAI

**From the Google Sheet:**
- Question ID: `?`
- Full Criteria String (Stichpunkte Column): `?`
- Solution/Musterlösung: `?`

**Currently Unknown:** The exact criteria are stored in a Google Sheet that this local environment cannot access.

### 2. Real OpenAI Response

**The actual JSON response OpenAI returns:**
```json
{
  "erfuellt": [...],
  "nicht_erfuellt": [...]
}
```

**Currently Unknown:** Cannot make real OpenAI calls locally without:
- Actual OpenAI API key
- Actual criteria from the sheet
- The real question text and model solution

### 3. Backend Processing

**Verification needed:**
- Does `parseKriterienErgebnis_()` correctly map the IDs to criteria? ✅ (Already verified in local test - YES)
- Does `zeigeBewertungskriterien()` correctly display them? ✅ (Code working correctly)

### 4. Deployment Status

**Currently Unknown:** Whether deployed `backend/apps-script/Code.gs` matches the local repository version.

---

## How to Capture Real Data

### Option A: Browser Network Tab (Easiest)

1. Open WiFa Trainer: [file:///C:/Users/sbeck/Documents/wifa-trainer-gruen-1/index.html](file:///C:/Users/sbeck/Documents/wifa-trainer-gruen-1/index.html)

2. Open Browser DevTools: **F12** → **Network** tab

3. Navigate to the Vision/Mission question

4. Clear previous network activity

5. Enter the exact user answer:
   ```
   Vision ist zukunftsleittragende Gedanke und die Mission zeigt welche langfristigen Ziele das Unternehmen hat und welche langfristigen Ziele das Unternehmen hat und welche Nutzen die Gesellschaft, Kunden, verbraucher und Kooperationspartner haben
   ```

6. Click "Auswerten" (Evaluate)

7. In Network tab, look for:
   - POST request to `script.google.com/macros/...`
   - **Request Body** will contain: `{"action":"bewerteAntwort", "fach":"...", "frageId":"...", "antwort":"..."}`
   - **Response Body** will contain full result with criteria

8. Copy the response JSON and share it

### Option B: Apps Script Logging (If Deployed)

Go to Google Apps Script deployment and check logs for:
- What `stichpunkteListe` was passed
- What `prompt` was assembled
- What `text` came back from OpenAI

### Option C: Query the Google Sheet Directly

If you have access to the Google Sheet:
- Find the "Vision und Mission" question row
- Get the exact content of:
  - Column: Frage (Question)
  - Column: Musterlösung (Solution)
  - Column: Stichpunkte (Criteria)

---

## What Each Captured Piece Reveals

### If Real OpenAI Response Shows:
```json
{"erfuellt":[], "nicht_erfuellt":["K1","K2","K3","K4","K5"]}
```
**Then:** OpenAI failed to recognize ALL criteria despite detailed instructions → **Semantic evaluation gap**

### If Real OpenAI Response Shows:
```json
{"erfuellt":["K1","K2","K3"], "nicht_erfuellt":["K4","K5"]}
```
**Then:** OpenAI correctly recognized some → Investigate which ones and why

### If Deployed Code Differs From Local:
**Then:** Deployment mismatch discovered

### If Criteria Don't Include Both "langfristige Ziele" and "Nutzen für Gesellschaft":
**Then:** Question configuration issue, not evaluation issue

---

## Temporary Diagnostic: What We CAN Verify Locally

Without real sheet data, here's what we verified:

**✅ Verified Working:**
- Parsing logic: `parseKriterienErgebnis_()` correctly converts IDs to criterion text
- ID generation: `getKriterienIdsFuerStichpunkte_()` creates K1, K2, K3... correctly
- Criteria splitting: `getStichpunkteListe_()` splits semicolon-delimited criteria correctly
- Display logic: `zeigeBewertungskriterien()` formats results correctly

**❓ Cannot Verify Without Real Data:**
- Whether OpenAI receives correct prompt format
- What OpenAI actually returns
- Whether prompt instructions are sufficient for German grammar
- Whether deployed version matches repository

---

## Next Steps

1. **Capture Option A data** (Network tab) - Takes 2 minutes, gives 100% proof
2. Or provide the exact criteria string from the Google Sheet
3. Or check if deployed Apps Script logs are accessible

Once we have the real OpenAI response, root cause will be **definitively proven**.
