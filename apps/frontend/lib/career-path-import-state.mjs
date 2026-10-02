export const CAREER_PATH_IMPORT_PAGE_SIZE = 25;

const EXPLICIT_ACTIONS = new Set(["update", "skip"]);

export function normalizeCareerPathImportRows(rows = []) {
  return rows.map((row, index) => {
    const action = String(row.action || "").trim().toLowerCase();
    const actionIntent = EXPLICIT_ACTIONS.has(action) ? action : "auto";
    return {
      ...row,
      clientKey: `import-row-${index + 1}`,
      action: actionIntent === "auto" ? "" : actionIntent,
      actionIntent,
      selectionIntent: "auto",
    };
  });
}

export function getCareerPathImportSelectionState(row, previewRow, hasParseIssue = false, stale = false) {
  if (hasParseIssue || row.actionIntent === "skip") return false;
  if (row.selectionIntent === "include") return stale || Boolean(previewRow?.valid);
  if (row.selectionIntent === "exclude") return false;
  if (!previewRow?.valid || (!stale && previewRow.action === "skip")) return false;
  return Boolean(previewRow.selected);
}

export function getCareerPathImportRowStatus(row, previewRow, hasParseIssue = false, stale = false) {
  if (hasParseIssue) return "error";
  if (!previewRow) return "pending";
  if (stale) return "stale";
  if (previewRow.valid === false) return "error";
  if (previewRow.action === "skip" && previewRow.career_path_id) return "duplicate";
  if (previewRow.action === "skip") return "skipped";
  if (previewRow.action === "update") return "update";
  return "ready";
}

export function summarizeCareerPathImport(rows, previewRows, hasParseIssue, stale = false) {
  let ready = 0;
  let errors = 0;
  let duplicates = 0;
  let skipped = 0;
  let staleRows = 0;
  let pending = 0;
  let selected = 0;

  for (const row of rows) {
    const previewRow = previewRows.get(row.row_number);
    const parseIssue = hasParseIssue(row);
    const status = getCareerPathImportRowStatus(row, previewRow, parseIssue, stale);
    if (status === "error") errors += 1;
    if (status === "duplicate") duplicates += 1;
    if (status === "skipped") skipped += 1;
    if (status === "stale") staleRows += 1;
    if (status === "pending") pending += 1;
    if (status === "ready" || status === "update") ready += 1;
    if (getCareerPathImportSelectionState(row, previewRow, parseIssue, stale)) selected += 1;
  }

  return { total: rows.length, ready, errors, duplicates, skipped, stale: staleRows, pending, selected };
}

export function toCareerPathImportPayloadRow(row, selected) {
  const payload = { ...row };
  delete payload.clientKey;
  delete payload.actionIntent;
  delete payload.selectionIntent;
  return {
    ...payload,
    action: row.actionIntent === "auto" ? "" : row.actionIntent,
    selected: Boolean(selected),
  };
}
