# Podcast Staging Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and verify 13 isolated Staging podcast bundles from 479 hash-validated reused and 42 regenerated segments without writing any productive podcast object.

**Architecture:** Parameterize source and target storage paths, validate every target before writes, and keep production objects read-only. Decode every segment to canonical PCM, concatenate at sample boundaries, encode each subject once, and drive grouped navigation and resume from stable IDs in the versioned sidecar.

**Tech Stack:** Node.js test runner, Firebase Admin Storage, Google Apps Script frontend, Piper TTS, FFmpeg/libmp3lame.

**Spec:** `docs/superpowers/specs/2026-10-04-podcast-staging-migration-design.md`

## Global Constraints

- Staging target prefix is exactly `podcast/staging/lerntext-rev2/`.
- Production Version 114 and all productive Storage objects remain unchanged.
- Exactly 479 sources are reused and exactly 42 texts regenerated; invalid reuse aborts.
- Bundle assembly is canonical PCM at 22,050 Hz, mono, s16le, followed by one 96 kbit/s MP3 encode per subject.
- No merge to `main`, no push, no productive deployment.

## Review Focus

- A malformed or production target path must fail before the first write.
- Four source-path migrations must remain reused, never silently regenerated.
- Encoder delay/padding must not corrupt logical sample offsets or boundary navigation.
- A stale bundle version must not apply an old absolute seconds offset.
- The last Lerntext in every subject/chapter must remain directly selectable.

---

### Task 1: Fix the test baseline

**Files:**
- Modify: `tests/podcast-progress.test.js`

**Interfaces:**
- Produces: complete `SpreadsheetApp.openById` test double matching the existing Staging spreadsheet routing.

- [x] Write/adjust the failing tests so the real podcast-progress code uses `openById` and preserves prior behavior.
- [x] Run `node --test tests/podcast-progress.test.js` and confirm the two known failures.
- [x] Add the minimal test-double support and verify the file passes.
- [x] Run the podcast/Lerntext regression suite.

### Task 2: Separate source and target namespaces

**Files:**
- Modify: `tools/podcast-sync/hash-paths.js`
- Modify: `tools/podcast-sync/sync-all.js`
- Modify: `tools/podcast-sync/continuous-bundle.js`
- Modify: `tools/podcast-sync/sync-bundles.js`
- Modify: `tools/podcast-sync/run-local.ps1`
- Test: `tests/podcast-sync-core.test.js`
- Test: `tests/podcast-continuous-bundle.test.js`
- Test: `tests/podcast-continuous-all-subjects.test.js`

**Interfaces:**
- Produces: validated storage configuration with distinct read sources and staging-only targets; every writer rejects a target outside the allowed prefix before calling Storage.

- [x] Add failing behavior tests for production reads, staging writes, production-target rejection and no-delete/no-overwrite behavior.
- [x] Implement minimal prefix-aware path builders and injected configuration.
- [x] Run focused tests, then the full podcast/Lerntext regression suite.

### Task 3: Build from the approved 521-item inventory

**Files:**
- Create/Modify: focused migration orchestrator under `tools/podcast-sync/`
- Test: matching `tests/podcast-*.test.js`

**Interfaces:**
- Consumes: `Podcast_Inventar_521.json`, final Staging catalog and the final order manifest.
- Produces: exact 521-entry build plan, 479 reused/42 regenerated, four old-path sources, 13 ordered subject plans and a complete staging-only target list.

- [x] Add failing tests for inventory drift, duplicate/missing IDs, hash mismatch, wrong reuse count and target-path audit.
- [x] Implement read-only preflight that aborts before writes on any mismatch.
- [x] Verify focused and regression suites.

### Task 4: Canonical PCM and gapless boundary verification

**Files:**
- Modify: `tools/podcast-sync/continuous-bundle.js`
- Test: `tests/podcast-continuous-bundle.test.js`
- Test: new boundary audit test if separation improves clarity.

**Interfaces:**
- Produces: per-source audio probe, canonical PCM segments, integer sample boundaries and an audit for all 520 transitions including reuse/regeneration direction.

- [x] Add failing tests proving blind MP3 concatenation is not used and mixed source properties are normalized.
- [x] Add failing tests for overlap, inserted silence/sample gap, boundary timing mismatch and both mixed-origin transitions.
- [x] Implement sample-based concatenation and boundary audit; encode the finished subject once.
- [x] Verify focused and regression suites.

### Task 5: Versioned grouped sidecar, navigation and resume

**Files:**
- Modify: `js/lerntexte.js`
- Modify: `js/podcast-continuous.js`
- Modify: relevant podcast navigation/resume tests.

**Interfaces:**
- Consumes: versioned sidecar with chapter groups and stable IDs.
- Produces: 48 grouped visible chapters, 521 ID-based targets and version-aware resume mapping.

- [x] Add failing tests for 48 groups/521 targets, first/last reachability, exact ID-offset selection and stale-version resume.
- [x] Implement minimal grouped option rendering and ID-based resolution without exposing detail groups.
- [x] Verify navigation, Media Session, mobile/lock-screen and full regression suites.

### Task 6: Staging preflight, build and publication

**Files:**
- Create: build/audit outputs under `outputs/podcast-staging-migration-2026-10-04/`

**Interfaces:**
- Consumes: Tasks 2–5 and external Staging/Firebase configuration.
- Produces: 42 staging segment pairs, 13 staging bundles/sidecars, zero productive writes and a full artifact receipt.

- [x] Run preflight and record all targets before any write.
- [x] Revalidate 479 reuse sources; abort on any change.
- [x] Generate exactly 42 segments under Staging and rebuild/publish all 13 bundles.
- [x] Read back and validate hashes, counts, durations, paths and 520 boundaries.

### Task 7: Staging UI acceptance, report and local commit

**Files:**
- Create: final report under `outputs/podcast-staging-migration-2026-10-04/`.

**Interfaces:**
- Produces: per-subject duration/size/hash/navigation/resume report and production-write proof.

- [x] Exercise Staging frontend playback, grouping, direct jumps, navigation, resume, Fachwechsel and continuous boundaries.
- [x] Run full verification and inspect git diff.
- [x] Commit local code/test/report changes; do not push or merge.
