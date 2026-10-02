import assert from "node:assert/strict";
import test from "node:test";
import {
  CAREER_PATH_IMPORT_MAX_BYTES,
  parseCareerPathImportFile,
} from "./career-path-import.mjs";

function fileFromText(name, value) {
  const bytes = new TextEncoder().encode(value);
  return { name, size: bytes.byteLength, arrayBuffer: async () => bytes.buffer };
}

test("JSON import keeps blank fields absent and carries explicit clear fields", async () => {
  const file = fileFromText("career-paths.json", JSON.stringify({
    schema_version: 1,
    career_paths: [{
      row_number: 8,
      code: "DATA",
      name_th: "นักวิเคราะห์ข้อมูล",
      name_en: "   ",
      clear_fields: ["description_en"],
      curriculum_ids: [],
      competency_ids: [5, 6],
    }],
  }));
  const result = await parseCareerPathImportFile(file);

  assert.deepEqual(result.issues, []);
  assert.equal(result.rows[0].row_number, 8);
  assert.equal("name_en" in result.rows[0], false);
  assert.equal("curriculum_ids" in result.rows[0], false);
  assert.deepEqual(result.rows[0].clear_fields, ["description_en"]);
  assert.deepEqual(result.rows[0].competency_ids, [5, 6]);
});

test("invalid JSON, unsupported schema, and oversized files return parser issues", async () => {
  const invalidJSON = await parseCareerPathImportFile(fileFromText("bad.json", "{"));
  assert.equal(invalidJSON.issues[0].code, "INVALID_JSON");

  const unsupported = await parseCareerPathImportFile(fileFromText("old.json", JSON.stringify({ schema_version: 4, career_paths: [] })));
  assert.equal(unsupported.issues[0].code, "UNSUPPORTED_SCHEMA");

  const oversized = await parseCareerPathImportFile({ name: "large.xlsx", size: CAREER_PATH_IMPORT_MAX_BYTES + 1, arrayBuffer: async () => new ArrayBuffer(0) });
  assert.equal(oversized.issues[0].code, "FILE_TOO_LARGE");
});

test("Excel import resolves curriculum and competency codes from reference sheets", async () => {
  const xlsxModule = await import("xlsx");
  const XLSX = xlsxModule.default ?? xlsxModule;
  const workbook = XLSX.utils.book_new();
  const careerHeaders = ["รหัสสายงาน", "ชื่อสายงาน (ไทย)", "ชื่อสายงาน (อังกฤษ)", "ลักษณะงาน (ไทย)", "ลักษณะงาน (อังกฤษ)", "ทักษะ (ไทย)", "ทักษะ (อังกฤษ)", "แหล่งอ้างอิง/หมายเหตุ", "การทำงาน (create/update/skip)", "ล้างฟิลด์ (คั่นด้วย ,)"];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([careerHeaders, ["DATA", "นักวิเคราะห์ข้อมูล", "Data Analyst", "", "", "SQL", "", "", "", ""]]), "CareerPaths");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["career_code", "curriculum_code", "competency_code"], ["DATA", "CS66", "ANALYZE"]]), "Mappings");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["id", "code", "name_th", "name_en"], [14, "CS66", "วิทยาการคอมพิวเตอร์", "Computer Science"]]), "Curricula");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["id", "code", "name_th", "name_en"], [21, "ANALYZE", "การวิเคราะห์", "Analysis"]]), "Competencies");
  const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  const file = { name: "career-paths.xlsx", size: bytes.byteLength, arrayBuffer: async () => bytes };
  const result = await parseCareerPathImportFile(file);

  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.rows[0].curriculum_ids, [14]);
  assert.deepEqual(result.rows[0].competency_ids, [21]);
});
