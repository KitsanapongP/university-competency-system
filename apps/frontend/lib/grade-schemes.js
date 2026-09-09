export const GRADE_SCHEME_LETTER = "letter";
export const GRADE_SCHEME_SATISFACTORY = "satisfactory";

export const GRADE_SCHEMES = [
  GRADE_SCHEME_LETTER,
  GRADE_SCHEME_SATISFACTORY,
];

export function isValidGradeScheme(value) {
  return GRADE_SCHEMES.includes(String(value || "").trim().toLowerCase());
}

export function normalizeGradeScheme(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return isValidGradeScheme(normalized) ? normalized : "";
}
