import datetime as dt
import unittest

from openpyxl.styles.numbers import BUILTIN_FORMATS

from tools.release.production_sheet_gate import (
    a1_column_to_index,
    normalize_actual_for_expected,
    to_user_entered_value,
)


class ProductionSheetGateTests(unittest.TestCase):
    def test_normalizes_blank_and_integral_values(self):
        self.assertEqual(normalize_actual_for_expected(None, ""), "")
        self.assertEqual(normalize_actual_for_expected(1.0, "1"), "1")
        self.assertEqual(normalize_actual_for_expected(1.25, "1.25"), "1.25")

    def test_normalizes_displayed_chapter_number_from_date_formatted_cell(self):
        self.assertEqual(
            normalize_actual_for_expected(dt.datetime(2026, 1, 1), "1.1", "d.m"),
            "1.1",
        )

    def test_normalizes_excel_serial_for_numeric_date_guard(self):
        self.assertEqual(
            normalize_actual_for_expected(dt.datetime(2026, 9, 16), 46281, "dd.mm.yyyy"),
            46281,
        )

    def test_converts_values_to_sheets_user_entered_value(self):
        self.assertEqual(to_user_entered_value("Text"), {"stringValue": "Text"})
        self.assertEqual(to_user_entered_value(3), {"numberValue": 3})
        self.assertEqual(to_user_entered_value(True), {"boolValue": True})
        self.assertEqual(to_user_entered_value(""), {"stringValue": ""})

    def test_a1_column_conversion(self):
        self.assertEqual(a1_column_to_index("A"), 0)
        self.assertEqual(a1_column_to_index("O"), 14)
        self.assertEqual(a1_column_to_index("AA"), 26)


if __name__ == "__main__":
    unittest.main()
