"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BookOpen, ExternalLink, Layers, Pencil, Save, X } from "lucide-react";
import { useLanguage } from "../../../../providers/LanguageContext";
import "./CurriculumMetadataPanel.css";

const DEGREE_LEVEL_TRANSLATION_KEYS = {
  bachelor: "curriculum_degree_bachelor",
  master: "curriculum_degree_master",
  phd: "curriculum_degree_phd",
  other: "curriculum_degree_other",
};

function createForm(curriculum, major) {
  return {
    facultyId: String(major?.facultyId || ""),
    majorId: String(curriculum?.majorId || ""),
    code: curriculum?.code || "",
    nameTh: curriculum?.nameTh || "",
    nameEn: curriculum?.nameEn || "",
    year: String(curriculum?.year || ""),
  };
}

function normalizeForm(form) {
  return {
    majorId: String(form.majorId || ""),
    code: String(form.code || "").trim(),
    nameTh: String(form.nameTh || "").trim(),
    nameEn: String(form.nameEn || "").trim(),
    year: String(form.year || "").trim(),
  };
}

function sameForm(left, right) {
  const normalizedLeft = normalizeForm(left);
  const normalizedRight = normalizeForm(right);
  return Object.keys(normalizedLeft).every(
    (key) => normalizedLeft[key] === normalizedRight[key],
  );
}

function getDegreeLabel(t, degreeLevel) {
  const translationKey = DEGREE_LEVEL_TRANSLATION_KEYS[degreeLevel];
  return translationKey ? t(translationKey) : degreeLevel || "-";
}

function FieldError({ message }) {
  return message ? (
    <p className="curriculum-metadata-field-error">{message}</p>
  ) : null;
}

export default function CurriculumMetadataPanel({
  curriculum,
  majors = [],
  faculties = [],
  isAdmin = false,
  disabled = false,
  locked = false,
  activeTemplateCount = 0,
  fieldErrors = {},
  resetVersion = 0,
  onSave,
  onFieldChange,
  onEditingStateChange,
  onManageStructure,
}) {
  const { t } = useLanguage();
  const currentMajor = useMemo(
    () =>
      majors.find(
        (major) => String(major.majorId) === String(curriculum?.majorId),
      ),
    [curriculum?.majorId, majors],
  );
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => createForm(curriculum, currentMajor));
  const resetVersionRef = useRef(resetVersion);

  useEffect(() => {
    if (!editing) {
      setForm(createForm(curriculum, currentMajor));
    }
  }, [curriculum, currentMajor, editing]);

  useEffect(() => {
    if (resetVersionRef.current === resetVersion) return;
    resetVersionRef.current = resetVersion;
    setForm(createForm(curriculum, currentMajor));
    setEditing(false);
  }, [currentMajor, curriculum, resetVersion]);

  const originalForm = useMemo(
    () => createForm(curriculum, currentMajor),
    [curriculum, currentMajor],
  );
  const dirty = !sameForm(form, originalForm);
  const canChangeMajor = curriculum?.status === "draft";
  const selectedMajor =
    majors.find((major) => String(major.majorId) === String(form.majorId)) ||
    currentMajor;
  const selectedFaculty = faculties.find(
    (faculty) => String(faculty.facultyId) === String(form.facultyId),
  );
  const majorOptions = majors.filter((major) => {
    const isCurrentMajor =
      String(major.majorId) === String(curriculum?.majorId);
    const matchesFaculty =
      !form.facultyId || String(major.facultyId) === String(form.facultyId);
    return matchesFaculty && (major.isActive || isCurrentMajor);
  });
  const valid = Boolean(
    String(form.majorId || "").trim() &&
      String(form.code || "").trim() &&
      String(form.nameTh || "").trim() &&
      Number(form.year) > 0,
  );
  const stats = {
    totalCourses: Number(curriculum?.stats?.totalCourses) || 0,
    totalCategories: Number(curriculum?.stats?.totalCategories) || 0,
    totalCredits: Number(curriculum?.stats?.totalCredits) || 0,
  };
  const templateCount = Number(curriculum?.templateCount) || 0;
  const activeTemplates =
    Number(activeTemplateCount ?? curriculum?.activeTemplateCount) || 0;

  useEffect(() => {
    onEditingStateChange?.({ editing, dirty });
  }, [dirty, editing, onEditingStateChange]);

  useEffect(
    () => () => onEditingStateChange?.({ editing: false, dirty: false }),
    [onEditingStateChange],
  );

  const startEditing = () => {
    if (disabled || locked) return;
    setForm(createForm(curriculum, currentMajor));
    setEditing(true);
  };

  const cancelEditing = () => {
    setForm(createForm(curriculum, currentMajor));
    setEditing(false);
  };

  const updateField = (field, value) => {
    onFieldChange?.(field);
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateFaculty = (facultyId) => {
    onFieldChange?.("majorId");
    setForm((current) => ({
      ...current,
      facultyId,
      majorId: "",
    }));
  };

  const save = async () => {
    if (!valid || !dirty || disabled || locked) return;
    const saved = await onSave?.(normalizeForm(form));
    if (saved) {
      setEditing(false);
    }
  };

  const majorStatus =
    currentMajor && !currentMajor.isActive ? t("curriculum_inactive") : "";
  const degreeLabel = getDegreeLabel(t, currentMajor?.degreeLevel);

  return (
    <section
      className="curriculum-metadata-panel"
      aria-label={t("curriculum_metadata_title")}
    >
      <div className="curriculum-metadata-panel__header">
        <div>
          <h2>{t("curriculum_metadata_title")}</h2>
          <p>{t("curriculum_metadata_description")}</p>
        </div>
        {!editing ? (
          <button
            type="button"
            className="course-btn course-btn--primary"
            onClick={startEditing}
            disabled={disabled || locked}
            title={
              locked
                ? `${t("curriculum_active_templates")}: ${activeTemplates} ${t("curriculum_items")}`
                : undefined
            }
          >
            <Pencil size={16} /> {t("curriculum_edit_metadata")}
          </button>
        ) : (
          <div className="curriculum-metadata-panel__actions">
            <button
              type="button"
              className="course-btn course-btn--ghost"
              onClick={cancelEditing}
              disabled={disabled}
            >
              <X size={16} /> {t("curriculum_cancel")}
            </button>
            <button
              type="button"
              className="course-btn course-btn--primary"
              onClick={save}
              disabled={disabled || !dirty || !valid}
            >
              <Save size={16} /> {t("curriculum_save")}
            </button>
          </div>
        )}
      </div>

      <div className="curriculum-metadata-workspace">
        <div className="curriculum-metadata-workspace__main">
          {!editing ? (
            <dl className="curriculum-metadata-grid">
              <div>
                <dt>{t("curriculum_code")}</dt>
                <dd>{curriculum?.code || "-"}</dd>
              </div>
              <div>
                <dt>{t("curriculum_academic_year")}</dt>
                <dd>{curriculum?.year || "-"}</dd>
              </div>
              <div>
                <dt>{t("curriculum_name_th")}</dt>
                <dd>{curriculum?.nameTh || "-"}</dd>
              </div>
              <div>
                <dt>{t("curriculum_name_en")}</dt>
                <dd>{curriculum?.nameEn || "-"}</dd>
              </div>
              <div>
                <dt>{t("curriculum_faculty")}</dt>
                <dd>{currentMajor?.facultyNameTh || "-"}</dd>
              </div>
              <div>
                <dt>{t("curriculum_major")}</dt>
                <dd>
                  {currentMajor?.nameTh || curriculum?.degreeName || "-"}
                  {majorStatus && (
                    <span className="curriculum-metadata-status">
                      {majorStatus}
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt>{t("curriculum_degree_level")}</dt>
                <dd>{degreeLabel}</dd>
              </div>
              <div>
                <dt>{t("curriculum_manage_major")}</dt>
                <dd>
                  <Link
                    className="curriculum-metadata-link"
                    href="/major-management"
                  >
                    {t("curriculum_go_to_major_management")}{" "}
                    <ExternalLink size={14} />
                  </Link>
                </dd>
              </div>
            </dl>
          ) : (
            <div className="curriculum-metadata-form">
              <label className="course-field">
                <span className="course-label">
                  {t("curriculum_code")}{" "}
                  <span className="course-required">*</span>
                </span>
                <input
                  className="course-input"
                  value={form.code}
                  onChange={(event) => updateField("code", event.target.value)}
                  disabled={disabled}
                />
                <FieldError message={fieldErrors.code} />
              </label>
              <label className="course-field">
                <span className="course-label">
                  {t("curriculum_academic_year")}{" "}
                  <span className="course-required">*</span>
                </span>
                <input
                  className="course-input"
                  type="number"
                  min="1"
                  value={form.year}
                  onChange={(event) => updateField("year", event.target.value)}
                  disabled={disabled}
                />
                <FieldError message={fieldErrors.year} />
              </label>
              <label className="course-field curriculum-metadata-form__wide">
                <span className="course-label">
                  {t("curriculum_name_th")}{" "}
                  <span className="course-required">*</span>
                </span>
                <input
                  className="course-input"
                  value={form.nameTh}
                  onChange={(event) =>
                    updateField("nameTh", event.target.value)
                  }
                  disabled={disabled}
                />
                <FieldError message={fieldErrors.nameTh} />
              </label>
              <label className="course-field curriculum-metadata-form__wide">
                <span className="course-label">{t("curriculum_name_en")}</span>
                <input
                  className="course-input"
                  value={form.nameEn}
                  onChange={(event) =>
                    updateField("nameEn", event.target.value)
                  }
                  disabled={disabled}
                />
              </label>

              <label className="course-field">
                <span className="course-label">{t("curriculum_faculty")}</span>
                <select
                  className="course-input"
                  value={form.facultyId}
                  onChange={(event) => updateFaculty(event.target.value)}
                  disabled={disabled || !canChangeMajor || !isAdmin}
                >
                  <option value="">{t("curriculum_select_faculty")}</option>
                  {faculties.map((faculty) => (
                    <option key={faculty.facultyId} value={faculty.facultyId}>
                      {faculty.nameTh}
                    </option>
                  ))}
                </select>
                {!isAdmin && selectedFaculty && (
                  <span className="curriculum-metadata-field-hint">
                    {t("curriculum_faculty_scope_hint")}
                  </span>
                )}
              </label>
              <label className="course-field">
                <span className="course-label">
                  {t("curriculum_major")}{" "}
                  <span className="course-required">*</span>
                </span>
                <select
                  className="course-input"
                  value={form.majorId}
                  onChange={(event) =>
                    updateField("majorId", event.target.value)
                  }
                  disabled={disabled || !canChangeMajor}
                >
                  <option value="">{t("curriculum_select_major")}</option>
                  {majorOptions.map((major) => (
                    <option key={major.majorId} value={major.majorId}>
                      {major.nameTh}
                      {!major.isActive ? ` (${t("curriculum_inactive")})` : ""}
                    </option>
                  ))}
                </select>
                {canChangeMajor ? (
                  <FieldError message={fieldErrors.majorId} />
                ) : (
                  <span className="curriculum-metadata-field-hint">
                    {t("curriculum_major_draft_only")}
                  </span>
                )}
              </label>
              <div className="curriculum-metadata-readonly">
                <span>{t("curriculum_degree_level")}</span>
                <strong>{getDegreeLabel(t, selectedMajor?.degreeLevel)}</strong>
                <small>{t("curriculum_degree_managed_in_major")}</small>
              </div>
            </div>
          )}
        </div>

        <aside
          className="curriculum-metadata-summary"
          aria-label={t("curriculum_structure_overview")}
        >
          <div className="curriculum-metadata-summary__header">
            <BookOpen size={18} />
            <h3>{t("curriculum_structure_overview")}</h3>
          </div>
          <dl className="curriculum-metadata-summary__metrics">
            <div>
              <dt>{t("curriculum_total_courses")}</dt>
              <dd>
                {stats.totalCourses} <span>{t("curriculum_courses_unit")}</span>
              </dd>
            </div>
            <div>
              <dt>{t("curriculum_total_categories")}</dt>
              <dd>
                {stats.totalCategories}{" "}
                <span>{t("curriculum_categories_unit")}</span>
              </dd>
            </div>
            <div>
              <dt>{t("curriculum_total_credits")}</dt>
              <dd>
                {stats.totalCredits} <span>{t("curriculum_credits_unit")}</span>
              </dd>
            </div>
          </dl>

          {templateCount > 0 && (
            <div className="curriculum-metadata-template-context">
              <div className="curriculum-metadata-template-context__count">
                <Layers size={16} />
                <span>{t("curriculum_templates_connected")}</span>
                <strong>
                  {templateCount} {t("curriculum_items")}
                </strong>
              </div>
              {activeTemplates > 0 && (
                <div
                  className="curriculum-metadata-template-context__warning"
                  role="status"
                >
                  <strong>
                    {t("curriculum_active_templates")}: {activeTemplates}{" "}
                    {t("curriculum_items")}
                  </strong>
                  <span>
                    {t("curriculum_structure_locked_by_active_templates")}
                  </span>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            className="curriculum-metadata-summary__action"
            onClick={onManageStructure}
          >
            <BookOpen size={16} /> {t("curriculum_manage_structure")}{" "}
            <span aria-hidden="true">&rarr;</span>
          </button>
        </aside>
      </div>
    </section>
  );
}
