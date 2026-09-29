"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  Check,
  ChevronRight,
  ChevronDown,
  BookOpenCheck,
  PenLine,
  Search,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Sparkles,
} from "lucide-react";
import {
  fetchCurriculums,
  fetchCurriculumDetail,
} from "../../../../lib/curriculum";
import { useLanguage } from "../../../../providers/LanguageContext";

// ============================================================
// Step indicator
// ============================================================
function StepIndicator({ step, labels }) {
  const steps = labels;
  return (
    <div className="tfm-steps">
      {steps.map((label, i) => {
        const n = i + 1;
        const active = step === n;
        const done = step > n;
        return (
          <div
            key={n}
            className={`tfm-step ${active ? "tfm-step--active" : ""} ${done ? "tfm-step--done" : ""}`}
          >
            <span className="tfm-step__num">
              {done ? <Check size={11} /> : n}
            </span>
            <span className="tfm-step__label">{label}</span>
            {i < steps.length - 1 && <span className="tfm-step__line" />}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// CourseMasterTree — แสดง category/course ของ master
// ============================================================
function CourseMasterTree({ categories, depth = 0, language = "th" }) {
  const [expanded, setExpanded] = useState({});
  const toggle = (id) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  return (
    <div>
      {categories.map((cat) => {
        const hasChildren = cat.children?.length > 0;
        const hasCourses = cat.courses?.length > 0;
        const isOpen = expanded[cat.id] !== false;

        return (
          <div key={cat.id}>
            <div
              className="master-cat-row"
              style={{ paddingLeft: `${0.5 + depth * 0.875}rem` }}
              onClick={() => toggle(cat.id)}
            >
              <span className="master-cat-row__toggle">
                {hasChildren || hasCourses ? (
                  isOpen ? (
                    <ChevronDown size={12} />
                  ) : (
                    <ChevronRight size={12} />
                  )
                ) : (
                  <span style={{ width: 12 }} />
                )}
              </span>
              <span className="master-cat-row__code">{cat.code}</span>
              <span className="master-cat-row__name">{cat.name}</span>
              {hasCourses && (
                <span className="master-cat-row__badge">
                  {cat.courses.length} {language === "th" ? "วิชา" : "courses"}
                </span>
              )}
            </div>

            {isOpen && (
              <>
                {hasCourses &&
                  cat.courses.map((course) => (
                    <div
                      key={course.id}
                      className="master-course-row"
                      style={{ paddingLeft: `${1.25 + depth * 0.875}rem` }}
                    >
                      <span className="master-course-row__code">
                        {course.code}
                      </span>
                      <span className="master-course-row__name">
                        {course.nameTh || course.nameEn}
                      </span>
                      <span className="master-course-row__credits">
                        {course.credits} {language === "th" ? "น." : "cr."}
                      </span>
                    </div>
                  ))}
                {hasChildren && (
                  <CourseMasterTree
                    categories={cat.children}
                    depth={depth + 1}
                    language={language}
                  />
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Step 1 — ข้อมูลหลักสูตร + เลือก Curriculum Master
// ============================================================
function Step1({
  form,
  setForm,
  masters = [],
  setMasters,
  loadingMasters = false,
  language = "th",
}) {
  const [search, setSearch] = useState("");
  const [previewId, setPreviewId] = useState(form.masterId || null);
  const [loadingDetailId, setLoadingDetailId] = useState(null);
  const [previewError, setPreviewError] = useState("");
  const detailRequestsRef = useRef(new Map());
  const loadedDetailIdsRef = useRef(new Set());
  const mountedRef = useRef(true);
  const selectedPreviewIdRef = useRef(form.masterId || null);
  const copy =
    language === "th"
      ? {
          name: "ชื่อแบบแผนการประเมิน",
          namePlaceholder: "เช่น แบบแผนการประเมินวิทยาการคอมพิวเตอร์",
          curriculum: "หลักสูตร",
          hint: "แบบแผนการประเมินจะเป็นของหลักสูตรที่เลือก และกำหนดให้รุ่นนักศึกษาในภายหลัง",
          search: "ค้นหาหลักสูตร...",
          loading: "กำลังโหลดรายชื่อหลักสูตรจากระบบ...",
          year: "ปี",
          empty: "ไม่พบหลักสูตรที่ตรงกับการค้นหา",
          previewLoading: "กำลังโหลดโครงสร้างหลักสูตร...",
          previewError: "ไม่สามารถโหลดโครงสร้างหลักสูตรได้",
          previewEmpty: "หลักสูตรนี้ยังไม่มีโครงสร้างรายวิชา",
        }
      : {
          name: "Assessment plan name",
          namePlaceholder: "e.g. Computer Science assessment plan",
          curriculum: "Curriculum",
          hint: "This assessment plan belongs to the selected curriculum and can be assigned to a cohort later.",
          search: "Search curricula...",
          loading: "Loading curricula...",
          year: "Year",
          empty: "No curricula match your search",
          previewLoading: "Loading curriculum structure...",
          previewError: "Unable to load curriculum structure.",
          previewEmpty: "This curriculum has no course structure yet.",
        };

  const filtered = masters.filter(
    (m) =>
      (m.nameTh && m.nameTh.toLowerCase().includes(search.toLowerCase())) ||
      (m.nameEn && m.nameEn.toLowerCase().includes(search.toLowerCase())) ||
      String(m.year || "").includes(search) ||
      (m.code && m.code.toLowerCase().includes(search.toLowerCase())),
  );

  const preview = masters.find((m) => m.id === previewId);

  useEffect(() => {
    // React Strict Mode mounts, cleans up, and mounts again in development.
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    selectedPreviewIdRef.current = previewId;
    setPreviewError("");
  }, [previewId]);

  const loadMasterDetail = useCallback(
    async (masterId) => {
      if (!masterId) return null;

      const master = masters.find(
        (item) => String(item.id) === String(masterId),
      );
      if (!master || master.categories?.length > 0) return master;

      const requestKey = String(masterId);
      const existingRequest = detailRequestsRef.current.get(requestKey);
      if (existingRequest) return existingRequest;

      const request = (async () => {
        if (mountedRef.current) setLoadingDetailId(masterId);
        try {
          const detail = await fetchCurriculumDetail(masterId);
          if (!detail || !mountedRef.current) return detail;
          loadedDetailIdsRef.current.add(requestKey);

          const enrichedMaster = {
            ...master,
            ...detail,
            name: detail.nameTh || detail.name || master.nameTh,
          };
          setMasters?.((previous) =>
            previous.map((item) =>
              String(item.id) === requestKey ? enrichedMaster : item,
            ),
          );
          return enrichedMaster;
        } catch (error) {
          console.error("Failed to fetch curriculum detail:", error);
          if (
            mountedRef.current &&
            String(selectedPreviewIdRef.current) === requestKey
          ) {
            setPreviewError(copy.previewError);
          }
          return null;
        } finally {
          detailRequestsRef.current.delete(requestKey);
          if (mountedRef.current) {
            setLoadingDetailId((current) =>
              String(current) === requestKey ? null : current,
            );
          }
        }
      })();

      detailRequestsRef.current.set(requestKey, request);
      return request;
    },
    [copy.previewError, masters, setMasters],
  );

  useEffect(() => {
    if (!loadingMasters && form.masterId) {
      loadMasterDetail(form.masterId);
    }
  }, [form.masterId, loadingMasters, loadMasterDetail]);

  const handleMasterSelect = async (masterId) => {
    selectedPreviewIdRef.current = masterId;
    setPreviewError("");
    setForm((p) => ({ ...p, masterId }));
    setPreviewId(masterId);
    await loadMasterDetail(masterId);
  };

  return (
    <div className="tfm-step1">
      {/* ชื่อ */}
      <div className="cfm-field">
        <label className="cfm-label">
          {copy.name} <span className="cfm-required">*</span>
        </label>
        <input
          className="cfm-input"
          autoFocus
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          placeholder={copy.namePlaceholder}
        />
      </div>

      {/* เลือก Curriculum Master */}
      <div className="cfm-field" style={{ marginTop: "1.25rem" }}>
        <label className="cfm-label">
          {copy.curriculum} <span className="cfm-required">*</span>
        </label>
        <p className="tfm-hint">{copy.hint}</p>
      </div>

      {/* Search */}
      <div className="tfm-search-wrap">
        <Search size={14} className="tfm-search-icon" />
        <input
          className="tfm-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={copy.search}
        />
      </div>

      <div className="tfm-master-layout">
        <div className="tfm-master-picker">
          {/* ตัวเลือก: ไม่เลือก master */}
          <div
            className={`tfm-master-card ${form.masterId === null ? "tfm-master-card--selected" : ""}`}
            onClick={() => handleMasterSelect(null)}
            style={{ display: "none" }}
            aria-hidden="true"
          >
            <div
              className={`tfm-master-card__icon ${form.masterId === null ? "tfm-master-card__icon--blue" : ""}`}
            >
              <PenLine size={20} />
            </div>
            <div>
              <div
                className={`tfm-master-card__name ${form.masterId === null ? "tfm-master-card__name--selected" : ""}`}
              >
                สร้างใหม่ทั้งหมด
              </div>
              <div
                className={`tfm-master-card__meta ${form.masterId === null ? "tfm-master-card__meta--selected" : ""}`}
              >
                กรอกหมวดวิชาและรายวิชาเอง
              </div>
            </div>
            {form.masterId === null && (
              <Check size={16} className="tfm-master-card__check" />
            )}
          </div>

          <div className="tfm-master-list" aria-label="รายการหลักสูตร">
            {loadingMasters && (
              <div
                style={{
                  padding: "1.5rem",
                  textAlign: "center",
                  color: "#64748b",
                  fontSize: "0.875rem",
                }}
              >
                {copy.loading}
              </div>
            )}
            {!loadingMasters &&
              filtered.map((m) => (
                <div
                  key={m.id}
                  className={`tfm-master-card ${form.masterId === m.id ? "tfm-master-card--selected" : ""}`}
                  onClick={() => handleMasterSelect(m.id)}
                >
                  <div
                    className={`tfm-master-card__icon ${form.masterId === m.id ? "tfm-master-card__icon--blue" : ""}`}
                  >
                    <BookOpenCheck size={20} />
                  </div>
                  <div>
                    <div
                      className={`tfm-master-card__name ${form.masterId === m.id ? "tfm-master-card__name--selected" : ""}`}
                    >
                      {m.nameTh}
                    </div>
                    <div
                      className={`tfm-master-card__meta ${form.masterId === m.id ? "tfm-master-card__meta--selected" : ""}`}
                    >
                      {m.degreeName ? `${m.degreeName} • ` : ""}
                      {copy.year} {m.year}
                    </div>
                  </div>
                  {form.masterId === m.id && (
                    <Check size={16} className="tfm-master-card__check" />
                  )}
                </div>
              ))}
            {!loadingMasters && filtered.length === 0 && (
              <div className="tfm-master-list__empty">{copy.empty}</div>
            )}
          </div>
        </div>

        {/* Preview */}
        {preview ? (
          <div className="tfm-master-preview">
            <div className="tfm-preview-header">
              <span>
                {preview.nameTh} ({preview.year})
              </span>
            </div>
            {preview.categories?.length > 0 ? (
              <div className="tfm-preview-body">
                <CourseMasterTree
                  categories={preview.categories}
                  language={language}
                />
              </div>
            ) : (
              <div className="tfm-preview-body tfm-preview-body--empty">
                <BookOpenCheck size={28} opacity={0.2} />
                <span>
                  {loadingDetailId &&
                  String(loadingDetailId) === String(previewId)
                    ? copy.previewLoading
                    : previewError ||
                      (loadedDetailIdsRef.current.has(String(previewId))
                        ? copy.previewEmpty
                        : copy.previewLoading)}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="tfm-master-preview tfm-master-preview--empty">
            <BookOpenCheck size={28} opacity={0.2} />
            <span>
              {language === "th"
                ? "เลือกหลักสูตรเพื่อดูตัวอย่าง"
                : "Select a curriculum to preview"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Step 2 — เลือก Competency
// ============================================================
function Step2({ form, setForm, allCompetencies, onRefreshCompetencies }) {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const refreshInFlightRef = useRef(false);

  const toggle = (id) => {
    setForm((previous) => {
      const competencyIds = new Set(previous.competencyIds);
      if (competencyIds.has(id)) competencyIds.delete(id);
      else competencyIds.add(id);
      return { ...previous, competencyIds };
    });
  };

  const sortedCompetencies = useMemo(
    () =>
      [...allCompetencies].sort((left, right) => {
        const nameComparison = String(
          left.nameTh || left.name || "",
        ).localeCompare(String(right.nameTh || right.name || ""), "th");
        return (
          nameComparison ||
          String(left.code || "").localeCompare(String(right.code || ""), "en")
        );
      }),
    [allCompetencies],
  );

  const filteredCompetencies = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return sortedCompetencies;

    return sortedCompetencies.filter((comp) =>
      [comp.code, comp.nameTh || comp.name, comp.nameEn].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(keyword),
      ),
    );
  }, [search, sortedCompetencies]);

  const selectedCompetencies = useMemo(
    () => sortedCompetencies.filter((comp) => form.competencyIds.has(comp.id)),
    [form.competencyIds, sortedCompetencies],
  );

  const refreshCompetencies = useCallback(async () => {
    if (refreshInFlightRef.current || !onRefreshCompetencies) return;

    refreshInFlightRef.current = true;
    setRefreshing(true);
    setRefreshError("");
    try {
      await onRefreshCompetencies();
    } catch (error) {
      console.error("Failed to refresh competencies:", error);
      setRefreshError(t("template_competencies_load_failed"));
    } finally {
      refreshInFlightRef.current = false;
      setRefreshing(false);
    }
  }, [onRefreshCompetencies, t]);

  useEffect(() => {
    refreshCompetencies();
  }, [refreshCompetencies]);

  useEffect(() => {
    const handleFocus = () => refreshCompetencies();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refreshCompetencies]);

  const openCompetencyManagement = () => {
    window.open("/competency-management", "_blank", "noopener,noreferrer");
  };

  return (
    <div className="tfm-step2">
      <div className="tfm-step2-header">
        <p className="tfm-hint" style={{ margin: 0 }}>
          {t("template_competency_picker_hint")}
        </p>
      </div>

      <div className="tfm-competency-toolbar">
        <div className="tfm-competency-search-wrap">
          <Search size={15} className="tfm-search-icon" />
          <input
            className="tfm-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("template_competency_search")}
          />
        </div>
        <button
          type="button"
          className="btn btn--ghost btn--sm tfm-competency-toolbar__button"
          onClick={refreshCompetencies}
          disabled={refreshing}
          title={t("template_reload_competencies")}
        >
          <RefreshCw
            size={14}
            className={refreshing ? "tfm-competency-toolbar__refreshing" : ""}
          />
          <span>{t("template_reload_competencies")}</span>
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--sm tfm-competency-toolbar__button"
          onClick={openCompetencyManagement}
        >
          <ExternalLink size={14} />
          <span>{t("template_manage_competencies")}</span>
        </button>
      </div>

      <div className="tfm-selected-competencies" aria-live="polite">
        <span className="tfm-selected-competencies__count">
          {t("template_selected_competencies")} {selectedCompetencies.length}
        </span>
        {selectedCompetencies.length > 0 && (
          <div className="tfm-selected-competencies__chips">
            {selectedCompetencies.map((comp) => (
              <button
                key={comp.id}
                type="button"
                className="tfm-selected-competencies__chip"
                onClick={() => toggle(comp.id)}
                title={t("template_remove_selected_competency")}
              >
                <span
                  className="tfm-comp-dot"
                  style={{ background: comp.color }}
                />
                <span>{comp.nameTh || comp.name}</span>
                <X size={13} />
              </button>
            ))}
          </div>
        )}
      </div>

      {refreshError && (
        <div className="tfm-competency-feedback" role="alert">
          <span>{refreshError}</span>
          <button
            type="button"
            className="tfm-competency-feedback__retry"
            onClick={refreshCompetencies}
          >
            {t("template_retry")}
          </button>
        </div>
      )}

      <div className="tfm-competency-list" aria-busy={refreshing}>
        {refreshing && filteredCompetencies.length === 0 && (
          <div className="tfm-competency-empty">{t("loading")}</div>
        )}
        {filteredCompetencies.map((comp) => {
          const selected = form.competencyIds.has(comp.id);
          return (
            <label
              key={comp.id}
              className={`tfm-competency-option ${selected ? "tfm-competency-option--selected" : ""}`}
              style={{ "--cc": comp.color }}
            >
              <input
                type="checkbox"
                className="tfm-competency-option__checkbox"
                checked={selected}
                onChange={() => toggle(comp.id)}
              />
              <span className="tfm-competency-option__indicator">
                {selected && <Check size={13} />}
              </span>
              <span
                className="tfm-comp-dot"
                style={{ background: comp.color }}
              />
              <span className="tfm-competency-option__content">
                <span className="tfm-competency-option__name">
                  {comp.nameTh || comp.name}
                </span>
                <span className="tfm-competency-option__meta">
                  {comp.code}
                  {comp.nameEn ? ` • ${comp.nameEn}` : ""}
                </span>
              </span>
            </label>
          );
        })}

        {!refreshing && filteredCompetencies.length === 0 && (
          <div className="tfm-competency-empty">
            <p>{t("template_competency_empty")}</p>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={openCompetencyManagement}
            >
              <ExternalLink size={14} />
              {t("template_manage_competencies")}
            </button>
          </div>
        )}
      </div>

      {form.competencyIds.size === 0 && (
        <p className="tfm-warn">{t("template_competency_required")}</p>
      )}
    </div>
  );
}

function DuplicatePreview({ preview, language = "th" }) {
  const isThai = language === "th";
  const warnings = Array.isArray(preview?.warnings) ? preview.warnings : [];
  const courseWarnings = warnings.filter(
    (warning) =>
      warning.code === "SOURCE_COURSE_MISSING" ||
      warning.code === "TARGET_COURSE_UNMAPPED",
  );
  const removedCompetencyGroups = new Map();
  const newCompetencyGroups = new Map();
  const knownWarningCodes = new Set([
    "SOURCE_COURSE_MISSING",
    "TARGET_COURSE_UNMAPPED",
    "REMOVED_COMPETENCY_MAPPING",
    "NEW_COMPETENCY_NO_WEIGHT",
  ]);

  warnings.forEach((warning) => {
    if (warning.code === "REMOVED_COMPETENCY_MAPPING") {
      const key = warning.competency || "unknown-competency";
      const group = removedCompetencyGroups.get(key) || {
        name:
          warning.competency ||
          (isThai ? "ไม่ระบุสมรรถนะ" : "Unnamed Competency"),
        courses: [],
      };
      if (warning.course_code) {
        const course = `${warning.course_code}${warning.course_name ? ` · ${warning.course_name}` : ""}`;
        if (!group.courses.includes(course)) group.courses.push(course);
      }
      removedCompetencyGroups.set(key, group);
    }
    if (warning.code === "NEW_COMPETENCY_NO_WEIGHT") {
      const key = warning.competency || "unknown-competency";
      newCompetencyGroups.set(
        key,
        warning.competency ||
          (isThai ? "ไม่ระบุสมรรถนะ" : "Unnamed Competency"),
      );
    }
  });

  const competencyGroups = [
    ...Array.from(removedCompetencyGroups.entries()).map(([key, group]) => ({
      key,
      type: "removed",
      ...group,
    })),
    ...Array.from(newCompetencyGroups.entries()).map(([key, name]) => ({
      key,
      type: "new",
      name,
      courses: [],
    })),
  ];
  const unknownWarnings = warnings.filter(
    (warning) => !knownWarningCodes.has(warning.code),
  );

  const [expandedCompetencies, setExpandedCompetencies] = useState(
    () => new Set(),
  );
  const toggleCompetency = (key) => {
    setExpandedCompetencies((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const formatCourse = (warning) =>
    warning.course_code
      ? `${warning.course_code}${warning.course_name ? ` · ${warning.course_name}` : ""}`
      : isThai
        ? "ไม่ระบุรายวิชา"
        : "Unnamed course";

  const renderWarningGroup = ({
    title,
    Icon,
    count,
    countLabel,
    groupKey,
    children,
  }) => {
    if (count === 0) return null;
    return (
      <section
        className="tfm-duplicate-preview__warning-group"
        aria-labelledby={`duplicate-warning-${groupKey}`}
      >
        <div className="tfm-duplicate-preview__warning-group-header">
          <div
            className="tfm-duplicate-preview__warning-group-title"
            id={`duplicate-warning-${groupKey}`}
          >
            <Icon size={16} aria-hidden="true" />
            <h4>{title}</h4>
          </div>
          <span className="tfm-duplicate-preview__warning-count">
            {count} {countLabel}
          </span>
        </div>
        <ul className="tfm-duplicate-preview__warning-list">{children}</ul>
      </section>
    );
  };

  const renderCourseWarning = (warning, index) => {
    const isMissing = warning.code === "SOURCE_COURSE_MISSING";
    return (
      <li
        key={`${warning.code}-${warning.course_code || index}`}
        className="tfm-duplicate-preview__warning-item"
      >
        <div className="tfm-duplicate-preview__warning-item-top">
          <strong>
            {isMissing
              ? isThai
                ? "วิชาจากแบบแผนเดิมไม่มีในหลักสูตรใหม่"
                : "Source course is not in the new curriculum"
              : isThai
                ? "วิชาในหลักสูตรใหม่ยังไม่มีน้ำหนัก"
                : "New curriculum course has no weight yet"}
          </strong>
          <span className="tfm-duplicate-preview__warning-kind">
            {isThai ? "วิชา" : "Course"}
          </span>
        </div>
        <span className="tfm-duplicate-preview__warning-description">
          <strong>{formatCourse(warning)}</strong>
          <br />
          {isMissing
            ? isThai
              ? "หลักสูตรปลายทางที่เลือกไม่มีวิชานี้ จึงไม่สามารถนำวิชาและน้ำหนักมาใช้ในแผนการประเมินนี้ได้"
              : "The target curriculum does not contain this course, so its course and weights cannot be used in this template"
            : isThai
              ? "วิชานี้มีอยู่ในหลักสูตรปลายทางที่เลือก แต่แบบแผนเดิมยังไม่มี Competency ที่เชื่อมกับวิชานี้"
              : "The course exists in the target curriculum, but the template has no Competency mapping for it"}
        </span>
        <span className="tfm-duplicate-preview__warning-effect">
          {isMissing
            ? isThai
              ? "ผลที่จะเกิดขึ้น: วิชานี้จะไม่ถูกคัดลอกน้ำหนักไปยังแบบแผนใหม่"
              : "Result: this course weight will not be copied to the new plan"
            : isThai
              ? "ผลที่จะเกิดขึ้น: วิชาจะถูกคัดลอกมา แต่ยังไม่มีน้ำหนัก"
              : "Result: the course is copied, but it has no weight yet"}
        </span>
        {!isMissing && (
          <span className="tfm-duplicate-preview__warning-next">
            <strong>{isThai ? "สิ่งที่ต้องทำต่อ:" : "Next step:"}</strong>{" "}
            {isThai
              ? "กำหนด Competency และน้ำหนักให้วิชานี้ก่อนเปิดใช้งานแบบแผน"
              : "Configure a Competency mapping and weight before activating the plan"}
          </span>
        )}
      </li>
    );
  };

  const renderCompetencyWarning = (group) => {
    const isRemoved = group.type === "removed";
    const expanded = expandedCompetencies.has(group.key);
    const affectedCount = group.courses.length;
    return (
      <li
        key={`${group.type}-${group.key}`}
        className="tfm-duplicate-preview__warning-item"
      >
        <div className="tfm-duplicate-preview__warning-item-top">
          <strong>
            {isRemoved
              ? isThai
                ? "คุณนำสมรรถนะนี้ออกจากแบบแผนใหม่"
                : "You removed this Competency from the new plan"
              : isThai
                ? "สมรรถนะใหม่ยังไม่มีน้ำหนักรายวิชา"
                : "New Competency has no course weight yet"}
          </strong>
          <span className="tfm-duplicate-preview__warning-kind">
            {isThai ? "สมรรถนะ" : "Competency"}
          </span>
        </div>
        <span className="tfm-duplicate-preview__warning-description">
          <strong>“{group.name}”</strong>
          <br />
          {isRemoved
            ? isThai
              ? "สมรรถนะเดิมถูกใช้กับรายวิชาในแบบแผนต้นฉบับ"
              : "This Competency was used by courses in the source plan"
            : isThai
              ? "คุณเพิ่ม Competency นี้ แต่แบบแผนต้นฉบับไม่มี mapping เดิมให้คัดลอก"
              : "You added this Competency, but the source plan has no previous mapping to copy"}
        </span>
        <span className="tfm-duplicate-preview__warning-effect">
          {isRemoved
            ? isThai
              ? `ผลที่จะเกิดขึ้น: น้ำหนักที่เชื่อมกับ ${affectedCount} รายวิชาจะไม่ถูกคัดลอกไปยังแบบแผนใหม่`
              : `Result: weights connected to ${affectedCount} course${affectedCount === 1 ? "" : "s"} will not be copied to the new plan`
            : isThai
              ? "ผลที่จะเกิดขึ้น: สมรรถนะจะแสดงในแบบแผน แต่ยังไม่มีน้ำหนักรายวิชาและคะแนนจะเริ่มที่ 0"
              : "Result: the Competency appears in the plan, but it has no course weight and scores start at 0"}
        </span>
        {isRemoved && affectedCount > 0 && (
          <>
            <span className="tfm-duplicate-preview__warning-next">
              <strong>{isThai ? "สิ่งที่ต้องทำต่อ:" : "Next step:"}</strong>{" "}
              {isThai
                ? "เลือกสมรรถนะนี้กลับมา หรือกำหนด mapping ใหม่หลังสร้างแบบแผน"
                : "Select this Competency again or configure new mappings after creation"}
            </span>
            <button
              type="button"
              className="tfm-duplicate-preview__details-button"
              aria-expanded={expanded}
              aria-controls={`duplicate-affected-courses-${group.key}`}
              onClick={() => toggleCompetency(group.key)}
            >
              {expanded
                ? isThai
                  ? "ซ่อนรายวิชาที่ได้รับผลกระทบ"
                  : "Hide affected courses"
                : isThai
                  ? `ดูรายวิชาที่ได้รับผลกระทบ ${affectedCount} วิชา`
                  : `View ${affectedCount} affected course${affectedCount === 1 ? "" : "s"}`}
            </button>
            <div
              id={`duplicate-affected-courses-${group.key}`}
              className={`tfm-duplicate-preview__affected-courses ${expanded ? "tfm-duplicate-preview__affected-courses--open" : ""}`}
              hidden={!expanded}
            >
              <span>
                {isThai ? "รายวิชาที่ได้รับผลกระทบ" : "Affected courses"}
              </span>
              <ul>
                {group.courses.map((course) => (
                  <li key={course}>{course}</li>
                ))}
              </ul>
            </div>
          </>
        )}
        {!isRemoved && (
          <span className="tfm-duplicate-preview__warning-next">
            <strong>{isThai ? "สิ่งที่ต้องทำต่อ:" : "Next step:"}</strong>{" "}
            {isThai
              ? "กำหนดน้ำหนักให้รายวิชาในหน้าใส่น้ำหนักสมรรถนะก่อนเปิดใช้งาน"
              : "Configure course weights in the Competency weight editor before activating the plan"}
          </span>
        )}
      </li>
    );
  };

  const renderUnknownWarning = (warning, index) => (
    <li
      key={`unknown-${index}`}
      className="tfm-duplicate-preview__warning-item"
    >
      <div className="tfm-duplicate-preview__warning-item-top">
        <strong>
          {isThai
            ? "รายการที่ต้องตรวจสอบเพิ่มเติม"
            : "Additional item to review"}
        </strong>
        <span className="tfm-duplicate-preview__warning-kind">
          {isThai ? "ข้อมูล" : "Data"}
        </span>
      </div>
      <span className="tfm-duplicate-preview__warning-description">
        {warning.message ||
          (isThai
            ? "ระบบพบข้อมูลที่ควรตรวจสอบ"
            : "The system found an item to review")}
      </span>
    </li>
  );

  if (!preview) {
    return (
      <div className="tfm-duplicate-preview__empty">
        {isThai ? "ยังไม่มีข้อมูล Preview" : "No preview is available."}
      </div>
    );
  }

  return (
    <div className="tfm-duplicate-preview">
      <div
        className={`tfm-duplicate-preview__result ${preview.has_warnings ? "tfm-duplicate-preview__result--warning" : "tfm-duplicate-preview__result--success"}`}
      >
        {preview.has_warnings ? (
          <AlertTriangle size={18} />
        ) : (
          <CheckCircle2 size={18} />
        )}
        <div>
          <strong>
            {preview.has_warnings
              ? isThai
                ? "ยังสร้างได้ แต่ต้องตั้งค่าต่อ"
                : "Can be created, but needs setup"
              : isThai
                ? "ไม่พบปัญหาใด ๆ"
                : "No issues found"}
          </strong>
          <span>
            {preview.has_warnings
              ? isThai
                ? "การแจ้งเตือนครั้งนี้ไม่ได้บล็อกการสร้าง แต่บางน้ำหนักอาจไม่ถูกคัดลอกหรือยังต้องกำหนดเพิ่ม"
                : "Warnings do not block creation, but some weights may not be copied or still need setup"
              : preview.same_curriculum
                ? isThai
                  ? "คัดลอกไปยังหลักสูตรเดิมได้ครบตามข้อมูลปัจจุบัน"
                  : "The current data can be copied to the same curriculum"
                : isThai
                  ? "คัดลอกไปยังหลักสูตรใหม่ได้ครบตามข้อมูลปัจจุบัน"
                  : "The current data can be copied to the new curriculum"}
          </span>
        </div>
        {preview.has_warnings && (
          <span className="tfm-duplicate-preview__result-count">
            {courseWarnings.length +
              competencyGroups.length +
              unknownWarnings.length}
          </span>
        )}
      </div>

      <div className="tfm-duplicate-preview__stats">
        <div>
          <span>{isThai ? "วิชาที่คัดลอกน้ำหนัก" : "Mapped courses"}</span>
          <strong>{preview.mapped_course_count ?? 0}</strong>
        </div>
        <div>
          <span>{isThai ? "วิชาเพิ่มเฉพาะแบบแผน" : "Additional courses"}</span>
          <strong>{preview.additional_course_count ?? 0}</strong>
        </div>
        <div>
          <span>
            {isThai ? "หมวดเพิ่มเฉพาะแบบแผน" : "Additional categories"}
          </span>
          <strong>{preview.additional_category_count ?? 0}</strong>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="tfm-duplicate-preview__warnings" role="status">
          <div className="tfm-duplicate-preview__warnings-title">
            <AlertTriangle size={16} aria-hidden="true" />
            <div>
              <h4>{isThai ? "รายละเอียดผลกระทบ" : "Impact details"}</h4>
              <span>
                {isThai
                  ? "ระบบแสดงให้เห็นว่าการตั้งค่าครั้งนี้มีผลอย่างไร"
                  : "See how these choices affect the copied plan"}
              </span>
            </div>
          </div>
          {renderWarningGroup({
            title: isThai ? "วิชาที่ต้องตรวจสอบ" : "Courses to review",
            Icon: BookOpenCheck,
            count: courseWarnings.length,
            countLabel: isThai ? "รายการ" : "items",
            groupKey: "courses",
            children: courseWarnings.map(renderCourseWarning),
          })}
          {renderWarningGroup({
            title: isThai ? "สมรรถนะที่ต้องตรวจสอบ" : "Competencies to review",
            Icon: Sparkles,
            count: competencyGroups.length,
            countLabel: isThai ? "รายการ" : "items",
            groupKey: "competencies",
            children: competencyGroups.map(renderCompetencyWarning),
          })}
          {renderWarningGroup({
            title: isThai
              ? "ข้อมูลที่ต้องตรวจสอบเพิ่มเติม"
              : "Additional data to review",
            Icon: AlertTriangle,
            count: unknownWarnings.length,
            countLabel: isThai ? "รายการ" : "items",
            groupKey: "other",
            children: unknownWarnings.map(renderUnknownWarning),
          })}
        </div>
      )}

      <div className="tfm-duplicate-preview__note">
        {isThai
          ? "แบบแผนใหม่จะเริ่มเป็นสถานะไม่พร้อมใช้งาน และจะไม่คัดลอกการเชื่อมรุ่นหรือคะแนนผู้เรียน"
          : "The new assessment plan starts inactive. Cohort assignments and learner scores are not copied."}
      </div>
    </div>
  );
}

// ============================================================
// TemplateFormModal — main export
// ============================================================
export default function TemplateFormModal({
  onClose,
  onSave,
  onPreviewDuplicate,
  onSaveDuplicate,
  duplicateSource = null,
  duplicateCompetencyIds = [],
  allCompetencies = [],
  onRefreshCompetencies,
  language = "th",
}) {
  const { t } = useLanguage();
  const isDuplicate = Boolean(duplicateSource);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: isDuplicate ? `สำเนา - ${duplicateSource.name || ""}` : "",
    masterId:
      duplicateSource?.curriculum_id ||
      duplicateSource?.curriculumId ||
      duplicateSource?.masterData?.id ||
      null,
    competencyIds: new Set(duplicateCompetencyIds),
  });
  const [masters, setMasters] = useState([]);
  const [loadingMasters, setLoadingMasters] = useState(true);
  const [duplicatePreview, setDuplicatePreview] = useState(null);
  const [duplicatePreviewLoading, setDuplicatePreviewLoading] = useState(false);
  const [duplicatePreviewError, setDuplicatePreviewError] = useState("");

  useEffect(() => {
    fetchCurriculums()
      .then((data) =>
        setMasters(
          (data || []).map((m) => ({ ...m, name: m.name || m.nameTh })),
        ),
      )
      .catch((err) => {
        console.error("Failed to load curriculums:", err);
        setMasters([]);
      })
      .finally(() => setLoadingMasters(false));
  }, []);

  const canNext =
    step === 1
      ? form.name.trim().length > 0 && form.masterId !== null
      : form.competencyIds.size > 0;

  const handleSave = () => {
    if (!canNext) return;
    const master = masters.find((m) => m.id === form.masterId) ?? null;
    if (!isDuplicate) {
      onSave?.({
        name: form.name.trim(),
        masterId: form.masterId,
        masterData: master,
        competencyIds: [...form.competencyIds],
      });
      return;
    }

    setDuplicatePreview(null);
    setDuplicatePreviewError("");
    setDuplicatePreviewLoading(true);
    Promise.resolve(
      onPreviewDuplicate?.({
        name: form.name.trim(),
        curriculum_id: form.masterId,
        competency_ids: [...form.competencyIds],
      }),
    )
      .then((preview) => {
        setDuplicatePreview(preview);
        setStep(3);
      })
      .catch((error) =>
        setDuplicatePreviewError(
          error?.message ||
            (language === "th"
              ? "ไม่สามารถสร้าง Preview ได้"
              : "Unable to create preview."),
        ),
      )
      .finally(() => setDuplicatePreviewLoading(false));
  };

  const handleCreateDuplicate = () => {
    if (!duplicatePreview || duplicatePreviewLoading || !onSaveDuplicate)
      return;
    onSaveDuplicate({
      name: form.name.trim(),
      curriculum_id: form.masterId,
      competency_ids: [...form.competencyIds],
    });
  };

  const title = isDuplicate
    ? language === "th"
      ? "ทำสำเนาแบบแผนการประเมิน"
      : "Duplicate assessment plan"
    : t("template_create_title");
  const labels = isDuplicate
    ? language === "th"
      ? ["ข้อมูลแบบแผน", "เลือก Competency", "ตรวจสอบ"]
      : ["Plan details", "Choose competencies", "Review"]
    : [t("template_step_curriculum"), t("template_step_competency")];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box modal-box--tfm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: "0.75rem 1.5rem 0" }}>
          <StepIndicator step={step} labels={labels} />
        </div>
        <div className="modal-body tfm-body">
          {step === 1 && (
            <Step1
              form={form}
              setForm={setForm}
              masters={masters}
              setMasters={setMasters}
              loadingMasters={loadingMasters}
              language={language}
            />
          )}
          {step === 2 && (
            <Step2
              form={form}
              setForm={setForm}
              allCompetencies={allCompetencies}
              onRefreshCompetencies={onRefreshCompetencies}
            />
          )}
          {isDuplicate && step === 3 && (
            <DuplicatePreview preview={duplicatePreview} language={language} />
          )}
          {duplicatePreviewError && (
            <div className="tfm-duplicate-preview__error" role="alert">
              {duplicatePreviewError}
            </div>
          )}
        </div>
        <div className="modal-footer">
          {step === 1 ? (
            <button className="btn btn--ghost" onClick={onClose}>
              {t("template_cancel")}
            </button>
          ) : (
            <button
              className="btn btn--ghost"
              onClick={() => setStep(step === 3 ? 2 : 1)}
            >
              ← {t("template_back")}
            </button>
          )}
          {step === 1 ? (
            <button
              className="btn btn--primary"
              disabled={!canNext}
              onClick={() => setStep(2)}
            >
              {t("template_next")} →
            </button>
          ) : step === 2 ? (
            <button
              className="btn btn--primary"
              disabled={!canNext || duplicatePreviewLoading}
              onClick={handleSave}
            >
              {duplicatePreviewLoading ? (
                language === "th" ? (
                  "กำลังตรวจสอบ..."
                ) : (
                  "Checking..."
                )
              ) : isDuplicate ? (
                `${t("template_next")} →`
              ) : (
                <>
                  <Check size={15} /> {t("template_create_action")}
                </>
              )}
            </button>
          ) : (
            <button
              className="btn btn--primary"
              disabled={
                duplicatePreviewLoading ||
                !duplicatePreview ||
                duplicatePreview.ready_to_create === false
              }
              onClick={handleCreateDuplicate}
            >
              <Copy size={15} />{" "}
              {language === "th" ? "สร้างแบบแผน" : "Create assessment plan"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
