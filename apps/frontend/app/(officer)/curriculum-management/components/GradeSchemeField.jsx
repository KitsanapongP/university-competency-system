"use client";

import { useLanguage } from "../../../../providers/LanguageContext";
import {
  GRADE_SCHEME_LETTER,
  GRADE_SCHEME_SATISFACTORY,
} from "../../../../lib/grade-schemes";

export default function GradeSchemeField({
  value = "",
  onChange,
  disabled = false,
  compact = false,
}) {
  const { t } = useLanguage();

  return (
    <div
      className={`grade-scheme-field${compact ? " grade-scheme-field--compact" : ""}`}
    >
      {!compact && (
        <label className="grade-scheme-field__label" htmlFor="grade-scheme">
          {t("grade_scheme")}
        </label>
      )}
      <select
        id={compact ? undefined : "grade-scheme"}
        className="ss-input ss-input--select grade-scheme-field__select"
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        disabled={disabled}
        aria-label={t("grade_scheme")}
      >
        <option value="">{t("select_grade_scheme")}</option>
        <option value={GRADE_SCHEME_LETTER}>
          {t("grade_scheme_letter")}
        </option>
        <option value={GRADE_SCHEME_SATISFACTORY}>
          {t("grade_scheme_satisfactory")}
        </option>
      </select>
      {!compact && (
        <p className="grade-scheme-field__hint">
          {value === GRADE_SCHEME_SATISFACTORY
            ? t("grade_scheme_satisfactory_hint")
            : t("grade_scheme_letter_hint")}
        </p>
      )}
    </div>
  );
}
