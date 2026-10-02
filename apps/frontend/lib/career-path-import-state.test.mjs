import assert from "node:assert/strict";
import test from "node:test";
import {
  getCareerPathImportRowStatus,
  getCareerPathImportSelectionState,
  normalizeCareerPathImportRows,
  summarizeCareerPathImport,
  toCareerPathImportPayloadRow,
} from "./career-path-import-state.mjs";

test("imported create actions use server auto-resolution while explicit update and skip remain", () => {
  const rows = normalizeCareerPathImportRows([
    { row_number: 2, action: "create", code: "NEW" },
    { row_number: 3, action: "update", code: "UPDATE" },
    { row_number: 4, action: "skip", code: "SKIP" },
  ]);

  assert.deepEqual(rows.map(({ action, actionIntent }) => [action, actionIntent]), [
    ["", "auto"],
    ["update", "update"],
    ["skip", "skip"],
  ]);
});

test("new valid rows auto-select and existing rows auto-skip", () => {
  const [fresh, duplicate] = normalizeCareerPathImportRows([
    { row_number: 1, code: "NEW" },
    { row_number: 2, code: "OLD" },
  ]);

  assert.equal(getCareerPathImportSelectionState(fresh, { valid: true, action: "create", selected: true }), true);
  assert.equal(getCareerPathImportSelectionState(duplicate, { valid: true, action: "skip", selected: false, career_path_id: 8 }), false);
  assert.equal(getCareerPathImportRowStatus(duplicate, { valid: true, action: "skip", career_path_id: 8 }), "duplicate");
});

test("manual include and exclude override automatic selection without selecting invalid rows", () => {
  const [row] = normalizeCareerPathImportRows([{ row_number: 1, code: "NEW" }]);
  const preview = { valid: true, action: "create", selected: false };

  assert.equal(getCareerPathImportSelectionState({ ...row, selectionIntent: "include" }, preview), true);
  assert.equal(getCareerPathImportSelectionState({ ...row, selectionIntent: "exclude" }, preview), false);
  assert.equal(getCareerPathImportSelectionState({ ...row, selectionIntent: "include" }, { ...preview, valid: false }), false);
});

test("manual selection remains visible while a preview is stale, but auto duplicates stay skipped", () => {
  const [included, duplicate] = normalizeCareerPathImportRows([
    { row_number: 1, code: "NEW" },
    { row_number: 2, code: "OLD" },
  ]);

  assert.equal(getCareerPathImportSelectionState({ ...included, selectionIntent: "include" }, { valid: true, action: "create", selected: true }, false, true), true);
  assert.equal(getCareerPathImportSelectionState(duplicate, { valid: true, action: "skip", selected: false, career_path_id: 8 }, false, true), false);
});

test("summary counts errors, duplicates, ready rows, and selected rows", () => {
  const rows = normalizeCareerPathImportRows([
    { row_number: 1, code: "NEW" },
    { row_number: 2, code: "OLD" },
    { row_number: 3, code: "BAD" },
  ]);
  const previews = new Map([
    [1, { valid: true, action: "create", selected: true }],
    [2, { valid: true, action: "skip", selected: false, career_path_id: 8 }],
    [3, { valid: false, action: "create", selected: true }],
  ]);

  assert.deepEqual(summarizeCareerPathImport(rows, previews, (row) => row.code === "BAD"), {
    total: 3,
    ready: 1,
    errors: 1,
    duplicates: 1,
    skipped: 0,
    stale: 0,
    pending: 0,
    selected: 1,
  });
});

test("client-only identifiers are stripped and selection is added to API rows", () => {
  const [row] = normalizeCareerPathImportRows([{ row_number: 9, action: "create", code: "NEW" }]);
  const payload = toCareerPathImportPayloadRow(row, true);

  assert.equal(payload.action, "");
  assert.equal(payload.selected, true);
  assert.equal("clientKey" in payload, false);
  assert.equal("actionIntent" in payload, false);
  assert.equal("selectionIntent" in payload, false);
});
