#!/usr/bin/env python3
"""Fail-closed production Sheet gate and exact patch planner.

The tool never talks to Google APIs.  It consumes a freshly exported XLSX,
checks every conflict guard from the approved packages, and writes only a
read-only audit plus Google Sheets batchUpdate request payloads.  A separate
caller must execute those requests after the audit has passed.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import math
from pathlib import Path
from typing import Any, Iterable

import openpyxl
from openpyxl.utils.datetime import to_excel


RELEASE_ROOT = Path("release/WIFA-GESAMT-PROD-20261007-RC1")
PACKAGE_PATHS = {
    "trainer": RELEASE_ROOT / "packages/trainer/Inhaltsaenderungen_neun-IDs.json",
    "quiz": RELEASE_ROOT / "packages/quiz/Quiz_Inhaltsergaenzungen_final.json",
    "cards": RELEASE_ROOT / "packages/karteikarten/Karteikarten_Inhaltsergaenzungen_final.json",
    "learning": RELEASE_ROOT / "packages/lerntexte/Lerntexte_Gesamtumsetzung_final.json",
}

SHEET_IDS = {
    "Führung und Zusammenarbeit": 0,
    "Rechnungswesen": 231143499,
    "Recht": 1004496982,
    "Steuern": 1514010412,
    "BWL": 1512525304,
    "VWL": 1872582713,
    "Unternehmensführung": 806477333,
    "Betriebliches Management": 146281958,
    "Logistik": 2029666039,
    "Marketing": 1552019272,
    "Vertrieb": 1881208743,
    "Betriebliches Rechnungswesen und Controlling": 1959589965,
    "Investition und Finanzierung": 1238035611,
    "Quizfragen": 1729497775,
    "Lerntexte": 1675012345,
    "Trainer_Themen": 210927101,
    "Trainer_Detailgruppen": 210927102,
    "Trainer_Zuordnung": 210927103,
    "Trainer_Rahmenplanbezug": 210927104,
    "Rahmenplan_Abdeckung": 210927105,
    "Trainer_Migrationen": 210927106,
    "Karteikarten_Ergaenzungen": 2076100701,
}

PROTECTED_SHEETS = ("NutzerFortschritt", "PodcastFortschritt", "Lernstand")
TRAINER_METADATA_SHEETS = (
    "Trainer_Themen",
    "Trainer_Detailgruppen",
    "Trainer_Zuordnung",
    "Trainer_Rahmenplanbezug",
    "Rahmenplan_Abdeckung",
    "Trainer_Migrationen",
)
OVERLAY_HEADERS = (
    "KartenID",
    "Fach",
    "Typ",
    "Thema",
    "Vorderseite",
    "Rueckseite",
    "Aktiv",
    "Revision",
)


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def a1_column_to_index(column: str) -> int:
    value = 0
    for char in column.upper():
        if not ("A" <= char <= "Z"):
            raise ValueError(f"Ungültige Spalte: {column}")
        value = value * 26 + ord(char) - 64
    return value - 1


def normalize_actual_for_expected(actual: Any, expected: Any, number_format: str = "") -> Any:
    if actual is None:
        return "" if isinstance(expected, str) else None
    if isinstance(expected, bool):
        return actual
    if isinstance(expected, (int, float)) and not isinstance(expected, bool):
        if isinstance(actual, (dt.datetime, dt.date, dt.time)):
            serial = to_excel(actual)
            return int(serial) if float(serial).is_integer() else serial
        if isinstance(actual, float) and actual.is_integer() and isinstance(expected, int):
            return int(actual)
        return actual
    if isinstance(expected, str):
        if isinstance(actual, dt.datetime):
            fmt = (number_format or "").lower().replace("\\", "")
            if fmt in {"d.m", "d.m.", "dd.mm", "dd.mm."}:
                suffix = "." if fmt.endswith(".") else ""
                return f"{actual.day}.{actual.month}{suffix}"
            return actual.isoformat(sep=" ")
        if isinstance(actual, dt.date):
            return actual.isoformat()
        if isinstance(actual, float):
            if actual.is_integer():
                return str(int(actual))
            return format(actual, ".15g")
        return str(actual)
    return actual


def canonical_value(value: Any) -> Any:
    if value is None:
        return ""
    if isinstance(value, (dt.datetime, dt.date, dt.time)):
        return value.isoformat()
    if isinstance(value, float):
        if math.isnan(value):
            return "NaN"
        if value.is_integer():
            return int(value)
    return value


def sha256_json(value: Any) -> str:
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def sheet_hash(ws: Any) -> dict[str, Any]:
    rows: list[list[Any]] = []
    for row in ws.iter_rows(values_only=True):
        values = [canonical_value(value) for value in row]
        while values and values[-1] == "":
            values.pop()
        if values:
            rows.append(values)
    return {"rows": len(rows), "sha256": sha256_json(rows)}


def values_by_header(ws: Any, row_number: int, header: list[str]) -> dict[str, Any]:
    values: dict[str, Any] = {}
    for index, name in enumerate(header, start=1):
        cell = ws.cell(row=row_number, column=index)
        values[name] = cell.value
    return values


def find_rows(ws: Any, column_index: int, wanted: str, start_row: int = 1) -> list[int]:
    result: list[int] = []
    for row in range(start_row, ws.max_row + 1):
        value = ws.cell(row=row, column=column_index).value
        if str(value or "").strip() == wanted:
            result.append(row)
    return result


def compare_fields(ws: Any, row: int, headers: list[str], expected: dict[str, Any]) -> list[dict[str, Any]]:
    header_index = {name: index + 1 for index, name in enumerate(headers)}
    mismatches: list[dict[str, Any]] = []
    for name, wanted in expected.items():
        if name not in header_index:
            mismatches.append({"field": name, "reason": "HEADER_MISSING"})
            continue
        cell = ws.cell(row=row, column=header_index[name])
        actual = normalize_actual_for_expected(cell.value, wanted, cell.number_format)
        if actual != wanted:
            mismatches.append({"field": name, "expected": wanted, "actual": actual})
    return mismatches


def trainer_row(ws: Any, identifier: str) -> int:
    matches = find_rows(ws, 1, identifier)
    if len(matches) != 1:
        raise ValueError(f"{ws.title}/{identifier}: erwartet 1 Zeile, gefunden {len(matches)}")
    return matches[0]


def quiz_headers(ws: Any) -> list[str]:
    return [str(ws.cell(1, col).value or "") for col in range(1, 15)]


def learning_headers(ws: Any) -> list[str]:
    return [str(ws.cell(2, col).value or "") for col in range(1, 16)]


def run_preflight(xlsx_path: Path) -> tuple[dict[str, Any], dict[str, Any]]:
    packages = {name: load_json(path) for name, path in PACKAGE_PATHS.items()}
    workbook = openpyxl.load_workbook(xlsx_path, data_only=False, read_only=False)
    conflicts: list[dict[str, Any]] = []
    resolved: dict[str, Any] = {"trainer": {}, "quiz": {}, "learning": {}}

    trainer_checked = 0
    for item in packages["trainer"]["records"]:
        ws = workbook[item["sourceSheet"]]
        try:
            row = trainer_row(ws, item["id"])
        except ValueError as error:
            conflicts.append({"component": "trainer", "id": item["id"], "error": str(error)})
            continue
        mismatches = []
        for column, wanted in item["expectedFields"].items():
            cell = ws.cell(row=row, column=a1_column_to_index(column) + 1)
            actual = normalize_actual_for_expected(cell.value, wanted, cell.number_format)
            if actual != wanted:
                mismatches.append({"field": column, "expected": wanted, "actual": actual})
        if mismatches:
            conflicts.append({"component": "trainer", "id": item["id"], "row": row, "mismatches": mismatches})
        else:
            trainer_checked += 1
            resolved["trainer"][item["id"]] = {"sheet": item["sourceSheet"], "row": row}

    quiz_ws = workbook["Quizfragen"]
    quiz_header = quiz_headers(quiz_ws)
    key_rows: dict[str, list[int]] = {}
    id_rows: dict[str, list[int]] = {}
    for row in range(2, quiz_ws.max_row + 1):
        key = str(quiz_ws.cell(row, 1).value or "").strip()
        question_id = str(quiz_ws.cell(row, 3).value or "").strip()
        if key:
            key_rows.setdefault(key, []).append(row)
        if question_id:
            id_rows.setdefault(question_id, []).append(row)

    quiz_creates_absent = 0
    quiz_updates_checked = 0
    for item in packages["quiz"]["changes"]:
        action = str(item["action"]).lower()
        key = item["quizKey"]
        identifier = item["id"]
        if action == "create":
            collisions = sorted(set(key_rows.get(key, []) + id_rows.get(identifier, [])))
            if collisions:
                conflicts.append({"component": "quiz-create", "id": identifier, "rows": collisions})
            else:
                quiz_creates_absent += 1
            continue
        matches = key_rows.get(key, [])
        if len(matches) != 1:
            conflicts.append({"component": "quiz-update", "id": identifier, "error": f"erwartet 1 Zeile, gefunden {len(matches)}"})
            continue
        row = matches[0]
        mismatches = compare_fields(quiz_ws, row, quiz_header, item["expectedOldFields"])
        if mismatches:
            conflicts.append({"component": "quiz-update", "id": identifier, "row": row, "mismatches": mismatches})
        else:
            quiz_updates_checked += 1
            resolved["quiz"][identifier] = {"row": row}

    learning_ws = workbook["Lerntexte"]
    learning_header = learning_headers(learning_ws)
    learning_rows = {}
    for row in range(3, learning_ws.max_row + 1):
        identifier = str(learning_ws.cell(row, 1).value or "").strip()
        if identifier:
            learning_rows.setdefault(identifier, []).append(row)
    learning_checked = 0
    for item in packages["learning"]["records"]:
        matches = learning_rows.get(item["id"], [])
        if len(matches) != 1:
            conflicts.append({"component": "learning", "id": item["id"], "error": f"erwartet 1 Zeile, gefunden {len(matches)}"})
            continue
        row = matches[0]
        mismatches = compare_fields(learning_ws, row, learning_header, item["expectedOld"])
        if mismatches:
            conflicts.append({"component": "learning", "id": item["id"], "row": row, "mismatches": mismatches})
        else:
            learning_checked += 1
            resolved["learning"][item["id"]] = {"row": row}

    overlay_absent = "Karteikarten_Ergaenzungen" not in workbook.sheetnames
    if not overlay_absent:
        conflicts.append({"component": "cards", "error": "Karteikarten_Ergaenzungen bereits vorhanden"})

    protected = {name: sheet_hash(workbook[name]) for name in PROTECTED_SHEETS if name in workbook.sheetnames}
    metadata = {name: sheet_hash(workbook[name]) for name in TRAINER_METADATA_SHEETS}
    report = {
        "schemaVersion": 1,
        "mode": "READ_ONLY_PREWRITE_CONFLICT_CHECK",
        "xlsx": str(xlsx_path),
        "xlsxSha256": file_sha256(xlsx_path),
        "status": "PASS" if not conflicts else "STOP_CONFLICT",
        "conflictCount": len(conflicts),
        "conflicts": conflicts,
        "checks": {
            "trainerOldStates": {"expected": 9, "passed": trainer_checked},
            "quizCreateIdsAbsent": {"expected": 53, "passed": quiz_creates_absent},
            "quizUpdateOldStates": {"expected": 14, "passed": quiz_updates_checked},
            "learningTextOldStates": {"expected": 521, "passed": learning_checked},
            "flashcardOverlayAbsent": overlay_absent,
        },
        "protectedSheets": protected,
        "trainerMetadata": metadata,
        "writeScope": {
            "allowedSheets": sorted(set(
                [item["sourceSheet"] for item in packages["trainer"]["records"]]
                + ["Quizfragen", "Lerntexte", "Karteikarten_Ergaenzungen"]
            )),
            "protectedSheets": list(PROTECTED_SHEETS),
            "userDataWrites": 0,
            "trainerMetadataWrites": 0,
        },
    }
    return report, {"packages": packages, "resolved": resolved, "workbook": workbook}


def to_user_entered_value(value: Any) -> dict[str, Any]:
    if isinstance(value, bool):
        return {"boolValue": value}
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return {"numberValue": value}
    return {"stringValue": "" if value is None else str(value)}


def cell_update(sheet_id: int, row: int, column_index: int, value: Any) -> dict[str, Any]:
    return {
        "updateCells": {
            "start": {"sheetId": sheet_id, "rowIndex": row - 1, "columnIndex": column_index},
            "rows": [{"values": [{"userEnteredValue": to_user_entered_value(value)}]}],
            "fields": "userEnteredValue",
        }
    }


def build_requests(context: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    packages = context["packages"]
    resolved = context["resolved"]
    workbook = context["workbook"]

    trainer: list[dict[str, Any]] = []
    for item in packages["trainer"]["records"]:
        row = resolved["trainer"][item["id"]]["row"]
        sheet_id = SHEET_IDS[item["sourceSheet"]]
        for column in item["writeColumns"]:
            trainer.append(cell_update(sheet_id, row, a1_column_to_index(column), item["changes"][column]))

    quiz_updates: list[dict[str, Any]] = []
    quiz_header = quiz_headers(workbook["Quizfragen"])
    quiz_column = {name: index for index, name in enumerate(quiz_header)}
    creates = []
    for item in packages["quiz"]["changes"]:
        if str(item["action"]).lower() == "create":
            creates.append(item)
            continue
        row = resolved["quiz"][item["id"]]["row"]
        for field, value in item["writeFields"].items():
            quiz_updates.append(cell_update(SHEET_IDS["Quizfragen"], row, quiz_column[field], value))
    quiz_create_rows = []
    for item in creates:
        quiz_create_rows.append({
            "values": [
                {"userEnteredValue": to_user_entered_value(item["writeFields"].get(field, ""))}
                for field in quiz_header
            ]
        })
    quiz_creates = [{
        "appendCells": {
            "sheetId": SHEET_IDS["Quizfragen"],
            "rows": quiz_create_rows,
            "fields": "userEnteredValue",
        }
    }]

    card_rows = [list(OVERLAY_HEADERS)]
    card_revision = packages["cards"]["revision"]
    for item in packages["cards"]["changes"]:
        fields = item.get("fieldsToWrite") or {}
        card_rows.append([
            item["id"],
            item["source"],
            "NEU" if item["kind"] == "create" else "OVERRIDE",
            item["topic"],
            fields.get("front", ""),
            fields.get("back", ""),
            "ja",
            card_revision,
        ])
    cards = [
        {"addSheet": {"properties": {"sheetId": SHEET_IDS["Karteikarten_Ergaenzungen"], "title": "Karteikarten_Ergaenzungen", "gridProperties": {"rowCount": 1000, "columnCount": 8, "frozenRowCount": 1}}}},
        {"updateCells": {"start": {"sheetId": SHEET_IDS["Karteikarten_Ergaenzungen"], "rowIndex": 0, "columnIndex": 0}, "rows": [{"values": [{"userEnteredValue": to_user_entered_value(value)} for value in row]} for row in card_rows], "fields": "userEnteredValue"}},
    ]

    learning: list[dict[str, Any]] = []
    learning_header = learning_headers(workbook["Lerntexte"])
    learning_column = {name: index for index, name in enumerate(learning_header)}
    for item in packages["learning"]["records"]:
        if not item.get("writes"):
            continue
        row = resolved["learning"][item["id"]]["row"]
        for write in item["writes"]:
            field = write["field"]
            value = item["finalValues"][field]
            learning.append(cell_update(SHEET_IDS["Lerntexte"], row, learning_column[field], value))

    return {
        "trainer": trainer,
        "quiz-updates": quiz_updates,
        "quiz-creates": quiz_creates,
        "cards": cards,
        "learning": learning,
    }


def write_request_chunks(requests: dict[str, list[dict[str, Any]]], output_dir: Path) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True)
    chunk_sizes = {"trainer": 40, "quiz-updates": 100, "quiz-creates": 1, "cards": 2, "learning": 60}
    inventory: dict[str, Any] = {}
    for component, items in requests.items():
        chunks = []
        size = chunk_sizes[component]
        for index in range(0, len(items), size):
            payload = {"component": component, "requests": items[index:index + size]}
            path = output_dir / f"{component}-{index // size + 1:02d}.json"
            path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
            chunks.append({"path": str(path), "requests": len(payload["requests"]), "sha256": file_sha256(path)})
        inventory[component] = {"requests": len(items), "chunks": chunks}
    return inventory


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--xlsx", required=True, type=Path)
    parser.add_argument("--report", required=True, type=Path)
    parser.add_argument("--requests-dir", type=Path)
    args = parser.parse_args()

    report, context = run_preflight(args.xlsx)
    if report["status"] == "PASS" and args.requests_dir:
        requests = build_requests(context)
        report["requestPlan"] = write_request_chunks(requests, args.requests_dir)
        report["plannedWrites"] = {
            "trainerCells": len(requests["trainer"]),
            "quizUpdateCells": len(requests["quiz-updates"]),
            "quizCreateRows": len(context["packages"]["quiz"]["changes"]) - 14,
            "quizCreateCells": sum(len(item["writeFields"]) for item in context["packages"]["quiz"]["changes"] if item["action"] == "create"),
            "cardOverlayRows": len(context["packages"]["cards"]["changes"]),
            "learningCells": len(requests["learning"]),
        }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"status": report["status"], "conflicts": report["conflictCount"], "checks": report["checks"], "plannedWrites": report.get("plannedWrites")}, ensure_ascii=False))
    return 0 if report["status"] == "PASS" else 2


if __name__ == "__main__":
    raise SystemExit(main())
