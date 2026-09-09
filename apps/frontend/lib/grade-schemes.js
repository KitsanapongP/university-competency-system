export const GRADE_SCHEME_LETTER = "letter";
export const GRADE_SCHEME_SATISFACTORY = "satisfactory";

export const GRADE_SCHEMES = [
  GRADE_SCHEME_LETTER,
  GRADE_SCHEME_SATISFACTORY,
];

export const LETTER_GRADE_OPTIONS = [
  "",
  "A",
  "B+",
  "B",
  "C+",
  "C",
  "D+",
  "D",
  "F",
  "W",
  "I",
];

export const SATISFACTORY_GRADE_OPTIONS = ["", "S", "U", "W", "I"];

export function isValidGradeScheme(value) {
  return GRADE_SCHEMES.includes(String(value || "").trim().toLowerCase());
}

export function normalizeGradeScheme(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return isValidGradeScheme(normalized) ? normalized : "";
}

export function getGradeOptions(gradeScheme) {
  return normalizeGradeScheme(gradeScheme) === GRADE_SCHEME_SATISFACTORY
    ? SATISFACTORY_GRADE_OPTIONS
    : LETTER_GRADE_OPTIONS;
}

export function isGradeAllowed(grade, gradeScheme) {
  return getGradeOptions(gradeScheme).includes(String(grade || "").trim());
}
