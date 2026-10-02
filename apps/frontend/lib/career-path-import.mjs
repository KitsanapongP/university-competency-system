export const CAREER_PATH_IMPORT_SCHEMA_VERSION = 1;
export const CAREER_PATH_IMPORT_MAX_BYTES = 5 * 1024 * 1024;
export const CAREER_PATH_IMPORT_MAX_ROWS = 500;

export const CAREER_PATH_IMPORT_HEADERS = [
  "code",
  "name_th",
  "name_en",
  "description_th",
  "description_en",
  "skills_description_th",
  "skills_description_en",
  "source_reference",
  "action",
  "clear_fields",
];

const EXCEL_HEADERS_TH = {
  code: "รหัสสายงาน",
  name_th: "ชื่อสายงาน (ไทย)",
  name_en: "ชื่อสายงาน (อังกฤษ)",
  description_th: "ลักษณะงาน (ไทย)",
  description_en: "ลักษณะงาน (อังกฤษ)",
  skills_description_th: "ทักษะ (ไทย)",
  skills_description_en: "ทักษะ (อังกฤษ)",
  source_reference: "แหล่งอ้างอิง/หมายเหตุ",
  action: "การทำงาน (create/update/skip)",
  clear_fields: "ล้างฟิลด์ (คั่นด้วย ,)",
};

const MAPPING_HEADERS = ["career_code", "curriculum_code", "competency_code"];
const REFERENCE_HEADERS = ["id", "code", "name_th", "name_en"];

function text(value) {
  return String(value ?? "").trim();
}

function issue(rowNumber, field, code, message) {
  return { row_number: rowNumber, field, code, message, severity: "error" };
}

function optionalField(target, source, field) {
  if (!Object.prototype.hasOwnProperty.call(source, field)) return;
  const value = source[field];
  if (value === null || value === undefined || text(value) === "") return;
  target[field] = text(value);
}

function normalizeImportRow(raw, index) {
  const row = {
    row_number: Number(raw.row_number) > 0 ? Number(raw.row_number) : index + 1,
    code: text(raw.code),
    action: text(raw.action).toLowerCase(),
    clear_fields: Array.isArray(raw.clear_fields)
      ? raw.clear_fields.map(text).filter(Boolean)
      : text(raw.clear_fields).split(",").map(text).filter(Boolean),
  };
  for (const field of CAREER_PATH_IMPORT_HEADERS.slice(1, 8)) {
    optionalField(row, raw, field);
  }
  for (const field of ["curriculum_ids", "competency_ids"]) {
    if (Object.prototype.hasOwnProperty.call(raw, field) && Array.isArray(raw[field]) && raw[field].length > 0) {
      row[field] = raw[field].map(Number);
    }
  }
  return row;
}

function parseJSONImport(value) {
  if (value?.schema_version !== CAREER_PATH_IMPORT_SCHEMA_VERSION) {
    return { rows: [], issues: [issue(0, "schema_version", "UNSUPPORTED_SCHEMA", "Unsupported import schema version.")] };
  }
  if (!Array.isArray(value.career_paths)) {
    return { rows: [], issues: [issue(0, "career_paths", "INVALID_SCHEMA", "The JSON file must contain a career_paths array.")] };
  }
  if (value.career_paths.length === 0 || value.career_paths.length > CAREER_PATH_IMPORT_MAX_ROWS) {
    return { rows: [], issues: [issue(0, "career_paths", "INVALID_ROW_COUNT", "The import must contain between 1 and 500 career paths.")] };
  }
  return {
    rows: value.career_paths.map((entry, index) => {
      const row = normalizeImportRow(entry, index + 1);
      if (Array.isArray(entry.curriculum_ids) && entry.curriculum_ids.length) row.curriculum_ids = entry.curriculum_ids.map(Number);
      if (Array.isArray(entry.competency_ids) && entry.competency_ids.length) row.competency_ids = entry.competency_ids.map(Number);
      return row;
    }),
    issues: [],
  };
}

function getWorkbookModule(module) {
  return module.default ?? module;
}

function sheetRows(XLSX, sheet) {
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
}

function readReference(rows, field, issues) {
  if (!rows.length) return new Map();
  const headers = (rows[0] || []).map(text);
  const missing = REFERENCE_HEADERS.filter((header) => !headers.includes(header));
  if (missing.length) {
    issues.push(issue(1, field, "REFERENCE_HEADERS_MISSING", `Reference sheet is missing: ${missing.join(", ")}.`));
    return new Map();
  }
  const indexes = Object.fromEntries(headers.map((header, index) => [header, index]));
  const values = new Map();
  rows.slice(1).forEach((line) => {
    const code = text(line[indexes.code]).toLocaleLowerCase();
    const id = Number(text(line[indexes.id]));
    if (!code || !Number.isInteger(id) || id <= 0) return;
    if (values.has(code)) {
      values.set(code, null);
      return;
    }
    values.set(code, id);
  });
  return values;
}

function parseExcelWorkbook(XLSX, workbook) {
  const issues = [];
  const careerSheet = workbook.Sheets.CareerPaths;
  if (!careerSheet) {
    return { rows: [], issues: [issue(1, "CareerPaths", "SHEET_MISSING", "The CareerPaths sheet is required.")] };
  }
  const careerRows = sheetRows(XLSX, careerSheet);
  const headers = (careerRows[0] || []).map(text);
  const englishHeaders = CAREER_PATH_IMPORT_HEADERS;
  const thaiHeaders = Object.values(EXCEL_HEADERS_TH);
  const headerSet = new Set(headers);
  const useThaiHeaders = thaiHeaders.some((header) => headerSet.has(header));
  const expected = useThaiHeaders ? EXCEL_HEADERS_TH : Object.fromEntries(englishHeaders.map((key) => [key, key]));
  const missing = Object.values(expected).filter((header) => !headers.includes(header));
  if (missing.length) {
    return { rows: [], issues: [issue(1, "header", "HEADERS_MISSING", `Missing headers: ${missing.join(", ")}.`)] };
  }
  const indexes = Object.fromEntries(headers.map((header, index) => [header, index]));
  const sourceRows = [];
  careerRows.slice(1).forEach((line, index) => {
    const get = (field) => text(line[indexes[expected[field]]]);
    const code = get("code");
    const hasContent = Object.keys(expected).some((field) => get(field));
    if (!hasContent) return;
    const row = normalizeImportRow({
      row_number: index + 2,
      code,
      action: get("action"),
      clear_fields: get("clear_fields"),
      ...Object.fromEntries(CAREER_PATH_IMPORT_HEADERS.slice(1, 8).map((field) => [field, get(field)])),
    }, index + 1);
    sourceRows.push(row);
  });
  if (sourceRows.length === 0 || sourceRows.length > CAREER_PATH_IMPORT_MAX_ROWS) {
    return { rows: [], issues: [issue(0, "CareerPaths", "INVALID_ROW_COUNT", "The import must contain between 1 and 500 career paths.")] };
  }

  const curriculumReferences = readReference(sheetRows(XLSX, workbook.Sheets.Curricula), "Curricula", issues);
  const competencyReferences = readReference(sheetRows(XLSX, workbook.Sheets.Competencies), "Competencies", issues);
  const sourceByCode = new Map(sourceRows.map((row) => [row.code.toLocaleLowerCase(), row]));
  const mappedCurricula = new Map();
  const mappedCompetencies = new Map();
  const mappingSheet = workbook.Sheets.Mappings;
  if (mappingSheet) {
    const mappingRows = sheetRows(XLSX, mappingSheet);
    const mappingHeaders = (mappingRows[0] || []).map(text);
    if (MAPPING_HEADERS.some((header) => !mappingHeaders.includes(header))) {
      issues.push(issue(1, "Mappings", "MAPPING_HEADERS_MISSING", `Mappings sheet must contain ${MAPPING_HEADERS.join(", ")}.`));
    } else {
      const columns = Object.fromEntries(mappingHeaders.map((header, index) => [header, index]));
      mappingRows.slice(1).forEach((line, index) => {
        const careerCode = text(line[columns.career_code]);
        const curriculumCode = text(line[columns.curriculum_code]).toLocaleLowerCase();
        const competencyCode = text(line[columns.competency_code]).toLocaleLowerCase();
        if (!careerCode && !curriculumCode && !competencyCode) return;
        const row = sourceByCode.get(careerCode.toLocaleLowerCase());
        if (!row) {
          issues.push(issue(index + 2, "career_code", "CAREER_CODE_UNKNOWN", `No career path row matches ${careerCode}.`));
          return;
        }
        if (curriculumCode) {
          const id = curriculumReferences.get(curriculumCode);
          if (!id) {
            issues.push({ ...issue(index + 2, "curriculum_code", "CURRICULUM_CODE_UNKNOWN", `Curriculum code ${curriculumCode} is missing or ambiguous in the Curricula reference sheet.`), career_code: careerCode });
          } else {
            if (!mappedCurricula.has(row)) mappedCurricula.set(row, new Set());
            mappedCurricula.get(row).add(id);
          }
        }
        if (competencyCode) {
          const id = competencyReferences.get(competencyCode);
          if (!id) {
            issues.push({ ...issue(index + 2, "competency_code", "COMPETENCY_CODE_UNKNOWN", `Competency code ${competencyCode} is missing or ambiguous in the Competencies reference sheet.`), career_code: careerCode });
          } else {
            if (!mappedCompetencies.has(row)) mappedCompetencies.set(row, new Set());
            mappedCompetencies.get(row).add(id);
          }
        }
      });
    }
  }
  for (const row of sourceRows) {
    if (mappedCurricula.has(row)) row.curriculum_ids = [...mappedCurricula.get(row)];
    if (mappedCompetencies.has(row)) row.competency_ids = [...mappedCompetencies.get(row)];
  }
  return { rows: sourceRows, issues };
}

export async function parseCareerPathImportFile(file) {
  if (!file || Number(file.size) > CAREER_PATH_IMPORT_MAX_BYTES) {
    return { rows: [], issues: [issue(0, "file", "FILE_TOO_LARGE", "The file exceeds the 5 MB limit.")] };
  }
  const buffer = await file.arrayBuffer();
  const filename = text(file.name).toLocaleLowerCase();
  if (filename.endsWith(".json")) {
    try {
      return parseJSONImport(JSON.parse(new TextDecoder().decode(buffer)));
    } catch {
      return { rows: [], issues: [issue(0, "file", "INVALID_JSON", "The JSON file could not be parsed.")] };
    }
  }
  try {
    const XLSX = getWorkbookModule(await import("xlsx"));
    const workbook = XLSX.read(buffer, { type: "array", cellText: true, cellDates: false });
    return parseExcelWorkbook(XLSX, workbook);
  } catch {
    return { rows: [], issues: [issue(0, "file", "INVALID_WORKBOOK", "The Excel workbook could not be parsed.")] };
  }
}

export async function downloadCareerPathImportTemplate(curricula, competencies) {
  const XLSX = getWorkbookModule(await import("xlsx"));
  const careerHeaders = Object.values(EXCEL_HEADERS_TH);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([careerHeaders]), "CareerPaths");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([MAPPING_HEADERS]), "Mappings");
  const makeReference = (items) => [REFERENCE_HEADERS, ...(items || []).map((item) => [item.id, item.code, item.nameTh, item.nameEn])];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(makeReference(curricula)), "Curricula");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(makeReference(competencies)), "Competencies");
  XLSX.writeFile(workbook, "career-path-import-template.xlsx");
}

export function downloadCareerPathImportJSONTemplate(curricula, competencies) {
  const sample = {
    schema_version: CAREER_PATH_IMPORT_SCHEMA_VERSION,
    career_paths: [{
      code: "DATA-ANALYST",
      name_th: "นักวิเคราะห์ข้อมูล",
      name_en: "Data Analyst",
      description_th: "วิเคราะห์และสื่อสารข้อมูลเพื่อสนับสนุนการตัดสินใจ",
      description_en: "Analyze and communicate data to support decisions.",
      skills_description_th: "SQL, การสื่อสารข้อมูล",
      skills_description_en: "SQL, data communication",
      curriculum_ids: [],
      competency_ids: [],
      action: "create",
      clear_fields: [],
    }],
    references: {
      curricula: (curricula || []).map(({ id, code, nameTh, nameEn }) => ({ id, code, name_th: nameTh, name_en: nameEn })),
      competencies: (competencies || []).map(({ id, code, nameTh, nameEn }) => ({ id, code, name_th: nameTh, name_en: nameEn })),
    },
  };
  const blob = new Blob([JSON.stringify(sample, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "career-path-import-template.json";
  anchor.click();
  URL.revokeObjectURL(url);
}
