# Scoring Regression Investigation Report
## Vision & Mission Question

**Date:** 2026-08-30
**Question:** "Definieren Sie die Begriffe Vision und Mission."
**Issue:** Answer contains variations of criteria but marked as missing.

---

## Executive Summary

**Status:** NOT a code regression. Semantic evaluation gap in OpenAI prompt.

**Root Cause:** OpenAI's gpt-4o-mini model is not recognizing:
- German grammatical case variations: "langfristigen Ziele" (dative) vs "langfristige Ziele" (stored nominative)
- Generalization of semantic examples to similar compound terms

**Verdict:** 
- ✅ Code is working correctly
- ✅ Parsing logic is correct and unchanged
- ✅ Both evaluation paths (trainer & exam) use identical semantic matching
- ❌ OpenAI prompt examples insufficient for this specific case

---

## Technical Investigation

### 1. Evaluation Flow (Verified & Working)

**Frontend Path:**
```
js/bewertung.js → bewerteAntwort() 
  → apiPost("bewerteAntwort", {...})
  → backend/apps-script/Code.gs → bewerteAntwortFrontend()
  → OpenAI API call with detailed prompt
  → parseKriterienErgebnis_() [WORKING CORRECTLY]
  → Map criterion IDs back to text
  → zeigeBewertungskriterien() displays results
```

**Exam Path:**
```
js/pruefungssimulation.js → bewertePruefung()
  → apiPost("bewertePruefung", {...})
  → Code.gs → bewertePruefungFrontend()
  → [Same evaluation logic as trainer path]
```

### 2. Key Functions Verified

| Function | Status | Purpose |
|----------|--------|---------|
| `bewerteAntwortFrontend()` | ✅ Line 992 | Main evaluation dispatcher |
| `parseKriterienErgebnis_()` | ✅ Line 901 | Parse OpenAI JSON response |
| `normalizeKriterienId_()` | ✅ Line 658 | ID normalization (K1, K2, etc) |
| `getStichpunkteListe_()` | ✅ Line 638 | Extract criteria from sheet |
| `zeigeBewertungskriterien()` | ✅ js/bewertung.js:588 | Display results UI |

### 3. Prompt Architecture (Current State)

**OpenAI Prompt Location:** Code.gs lines 1122-1180 (trainer) & 2060-2130 (exam)

**Key Instructions Present:**
- ✅ "Anerkenne grammatische Varianten" (Recognize grammatical variants)
- ✅ "Inhalt vor Wortlaut" (Content before exact wording)
- ✅ "Singular/Plural" variations mentioned
- ✅ Semantic example: "Nutzen für Kunden" → "Mehrwert", "profitieren", "Vorteile"

**Missing:**
- ❌ Specific German case/gender variation examples
- ❌ Example showing dative case handling
- ❌ Examples for "Gesellschaft" variations

### 4. Reproduction Test Results

**Test File:** `tests/vision-mission-regression.test.js`

**Setup:**
```javascript
Question: "Definieren Sie die Begriffe Vision und Mission."
Criteria: ["langfristige Ziele", "Nutzen für Gesellschaft"]
User Answer: "Vision ist eine Beschreibung der langfristigen Ziele eines 
              Unternehmens. Mission beschreibt, welchen Nutzen das 
              Unternehmen für die Gesellschaft bietet."
```

**Current Behavior:**
```json
OpenAI Response: {"erfuellt":[],"nicht_erfuellt":["K1","K2"]}
Parsed Result: recognized=[], missing=["langfristige Ziele", "Nutzen für Gesellschaft"]
```

**Expected Behavior:**
```json
Should be: {"erfuellt":["K1","K2"],"nicht_erfuellt":[]}
Result: recognized=["langfristige Ziele", "Nutzen für Gesellschaft"], missing=[]
```

### 5. Version History

**Git Commits Related to Semantic Evaluation:**
```
28af534 (HEAD)  - Add persistent Trainer and Quiz progress
aface7c         - Improve semantic criterion evaluation ← SEMANTIC FIX HERE
45f17df         - Fix semantic scoring for open answers
```

**Status:** The semantic fix is STILL PRESENT in current code (28af534).

---

## Root Cause Analysis

### Why This Appears to Be a Regression

User observed:
1. Semantic matching was supposedly "fixed previously"
2. Same answer/criteria now fail evaluation
3. System says criteria are "missing" when they're present

### Why It's NOT a Code Regression

**Evidence:**
1. All evaluation code unchanged since semantic fix was applied
2. Both evaluation paths use identical prompts
3. Test locally confirms: parsing/mapping logic works correctly
4. The failure is in OpenAI's JSON response, not in code handling

```
Code Flow: Working ✅
  Question → Criteria ✅
  Prompt Assembly ✅  
  OpenAI Call ✅
  JSON Parsing ✅
  ID → Text Mapping ✅

OpenAI Response: Problem ❌
  erfuellt: [] (should have K1, K2)
  nicht_erfuellt: ["K1", "K2"] (incorrect)
```

### Why Semantic Matching Is Failing

**The Prompt Issue:**
The prompt says:
> "z. B. gelten Aussagen wie "wertvoll für Kunden", "Mehrwert für Kunden", 
> "Kunden profitieren davon" ... als Erfüllung des Kriteriums "Nutzen für Kunden"."

**The Reality:**
- This example mentions Singular/Plural variations
- It mentions synonym "Mehrwert" for "Nutzen"
- But it does NOT demonstrate:
  - Dative case handling (langfristig**en** vs langfristig**e**)
  - Pronoun variations ("es für Gesellschaft" vs "für Gesellschaft")
  - How to generalize from one domain (Kunden) to others (Gesellschaft)

**Why OpenAI Fails:**
- gpt-4o-mini sees criterion "Nutzen für Gesellschaft" (nominative phrase)
- Answer contains "Nutzen" + "Gesellschaft" but no exact phrase match
- Example only shows Kunden domain, not Gesellschaft
- Model fails to generalize the semantic principle to new domain

---

## Classification

| Aspect | Status | Evidence |
|--------|--------|----------|
| Code Regression | NO | All functions unchanged since fix applied |
| Deployment Mismatch | NO | Both frontend and backend use same prompt |
| Semantic Gap | YES | OpenAI failing to generalize semantic rules |
| Different Evaluation Path | NO | Identical paths for trainer and exam |

**Final Diagnosis:** 
```
SEMANTIC EVALUATION GAP
├─ Code: Working correctly ✅
├─ Prompt: Insufficient German grammar examples ❌
└─ OpenAI: Not generalizing semantic rules as intended ❌
```

---

## Evaluation Chain Summary

```
Question Sheet:
  ├─ ID: (unknown - would need to query sheet)
  ├─ Criteria: "langfristige Ziele; Nutzen für Gesellschaft"
  ├─ Criterion IDs: K1; K2
  └─ Expected: Both should be recognized

↓ User Answer ↓

Frontend Call → Backend → OpenAI Evaluation
  Input:
    - Question: "Definieren Sie..."
    - Criteria: [K1: "langfristige Ziele", K2: "Nutzen für Gesellschaft"]
    - Answer: "langfristigen Ziele...Nutzen...Gesellschaft"
  
  OpenAI Decision:
    ❌ K1 "langfristige Ziele" ≠ "langfristigen Ziele" 
       (Case variation not recognized)
    ❌ K2 "Nutzen für Gesellschaft" ≠ "Nutzen" + "Gesellschaft"
       (Phrase decomposition not recognized)
  
  Response: {"erfuellt":[], "nicht_erfuellt":["K1","K2"]}

  Backend Processing:
    parseKriterienErgebnis_() → Correctly maps IDs to text
    
  UI Display: ✓ WORKING CORRECTLY
    Recognized: []
    Missing: ["langfristige Ziele", "Nutzen für Gesellschaft"]
```

---

## Files Involved

| File | Lines | Role |
|------|-------|------|
| `backend/apps-script/Code.gs` | 1122-1180 | Trainer eval prompt |
| `backend/apps-script/Code.gs` | 2060-2130 | Exam eval prompt |
| `backend/apps-script/Code.gs` | 901-973 | parseKriterienErgebnis_ |
| `backend/apps-script/Code.gs` | 658 | normalizeKriterienId_ |
| `backend/apps-script/Code.gs` | 638 | getStichpunkteListe_ |
| `js/bewertung.js` | 244-400 | Frontend evaluation handler |
| `js/bewertung.js` | 588-640 | Result display logic |

---

## Recommendation

This is NOT a code regression requiring debugging. The issue is that OpenAI's prompt instructions need enhancement for German grammatical variations.

**To fix:** Enhance prompt with explicit German grammar examples before attempting to debug code.

