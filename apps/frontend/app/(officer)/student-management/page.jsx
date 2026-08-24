"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Archive,
  Edit3,
  Eye,
  GraduationCap,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { useAuth } from "../../../providers/auth-provider";
import { useLanguage } from "../../../providers/LanguageContext";
import {
  fetchCurriculums,
  fetchFaculties,
  fetchMajors,
} from "../../../lib/curriculum";
import {
  createStudentCohort,
  deleteStudentCohort,
  fetchStudentCohorts,
  mapCurriculumChangeImpact,
  updateStudentCohort,
  updateStudentCohortStatus,
} from "../../../lib/student-management";
import BaseModal from "../../../components/ui/BaseModal";
import ConfirmActionModal from "../../../components/ui/ConfirmActionModal";
import ToastNotifications from "../../../components/ui/ToastNotifications";
import "../curriculum-management/CourseLayout.css";
import "../curriculum-management/CourseList.css";
import "./StudentManagement.css";
import "./StudentManagement.css";

const EMPTY_COHORT_FORM = { curriculumId: "", entryYearBe: "", note: "" };

function label(language, th, en) {
  return language === "en" ? en : th;
}

function cohortStatusMeta(status, language) {
  const map = {
    draft: ["ร่าง", "Draft"],
    active: ["ใช้งาน", "Active"],
    archived: ["เก็บถาวร", "Archived"],
  };
  return {
    className: status || "draft",
    label: label(language, ...(map[status] || [status, status])),
  };
}

function mapStudentManagementError(error, language) {
  const message = error?.message || error?.payload?.error?.message || "";
  const messages = {
    "cohort requires an active curriculum": [
      "ต้องเลือกหลักสูตรที่เปิดใช้งานอยู่",
      "An active curriculum is required.",
    ],
    "entry_year_be cannot be before curriculum effective year": [
      "ปีที่เข้าเรียนต้องไม่ก่อนปีที่หลักสูตรเริ่มใช้",
      "Entry year cannot be before the curriculum effective year.",
    ],
    "a cohort already exists for this curriculum and entry year": [
      "มีรุ่นของหลักสูตรและปีที่เข้าเรียนนี้อยู่แล้ว",
      "A cohort already exists for this curriculum and entry year.",
    ],
    "cohort cannot be archived while student or suspended members remain": [
      "ยังปิดรุ่นไม่ได้ เพราะยังมีนักศึกษาหรือผู้พักการศึกษาอยู่",
      "The cohort still has active or suspended members.",
    ],
    "cohort cannot be archived while active templates are connected": [
      "ยังปิดรุ่นไม่ได้ เพราะมี Template ที่ใช้งานอยู่เชื่อมไว้",
      "The cohort has active templates connected.",
    ],
    "only draft cohort can be deleted": [
      "ลบได้เฉพาะรุ่นสถานะร่าง",
      "Only a draft cohort can be deleted.",
    ],
    "cohort cannot be deleted while students are connected": [
      "ลบไม่ได้ เพราะยังมีรายชื่อนักศึกษาอยู่",
      "The cohort still has student records.",
    ],
    "archived cohort is read-only": [
      "รุ่นที่เก็บถาวรเป็นแบบอ่านอย่างเดียว",
      "Archived cohorts are read-only.",
    ],
    "curriculum and entry year can only be changed for an empty draft cohort without templates":
      [
        "ปีที่เข้าเรียนเปลี่ยนได้เฉพาะรุ่นร่างที่ยังไม่มีรายชื่อและ Template",
        "Entry year can only change for an empty draft cohort without templates.",
      ],
    "curriculum reassignment is no longer needed": [
      "ข้อมูลหลักสูตรถูกเปลี่ยนไปแล้ว กรุณาโหลดข้อมูลใหม่",
      "The curriculum was already changed. Please refresh and try again.",
    ],
    "student cohort not found": [
      "ไม่พบรุ่นนักศึกษา",
      "Student cohort not found.",
    ],
    "insufficient student cohort scope": [
      "คุณไม่มีสิทธิ์จัดการรุ่นนี้",
      "You do not have permission to manage this cohort.",
    ],
    "student cohort operation failed": [
      "ไม่สามารถดำเนินการกับรุ่นนักศึกษาได้",
      "Unable to complete the cohort operation.",
    ],
  };
  const translated = messages[message];
  return translated
    ? label(language, ...translated)
    : message ||
        label(
          language,
          "ไม่สามารถดำเนินการได้",
          "Unable to complete the operation.",
        );
}

function CohortFormModal({
  language,
  form,
  setForm,
  curricula,
  submitting,
  mode,
  curriculumEditable,
  entryYearEditable,
  onClose,
  onSubmit,
}) {
  const selectedCurriculum = curricula.find(
    (item) => String(item.curriculumId) === String(form.curriculumId),
  );
  const canSubmit =
    mode === "edit"
      ? !submitting
      : Boolean(
          form.curriculumId &&
            form.entryYearBe &&
            Number(form.entryYearBe) >= Number(selectedCurriculum?.year || 0) &&
            !submitting,
        );
  return (
    <BaseModal
      open
      title={
        mode === "edit"
          ? label(language, "แก้ไขข้อมูลรุ่น", "Edit cohort")
          : label(language, "สร้างรุ่นนักศึกษา", "Create student cohort")
      }
      size="md"
      onClose={onClose}
      closeDisabled={submitting}
      footer={
        <>
          <button
            className="course-btn course-btn--ghost"
            onClick={onClose}
            disabled={submitting}
          >
            {label(language, "ยกเลิก", "Cancel")}
          </button>
          <button
            className="course-btn course-btn--primary"
            onClick={onSubmit}
            disabled={!canSubmit}
          >
            {label(language, "บันทึก", "Save")}
          </button>
        </>
      }
    >
      {(mode === "create" || curriculumEditable) && (
        <>
          <label className="course-field">
            <span className="course-label">
              {label(language, "หลักสูตร", "Curriculum")}
              <span className="course-required">*</span>
            </span>
            <select
              className="course-input"
              value={form.curriculumId}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  curriculumId: event.target.value,
                }))
              }
            >
              <option value="">
                {label(language, "เลือกหลักสูตร", "Select curriculum")}
              </option>
              {curricula
                .filter(
                  (item) =>
                    item.status === "active" ||
                    String(item.curriculumId) === String(form.curriculumId),
                )
                .map((item) => (
                  <option key={item.curriculumId} value={item.curriculumId}>
                    {language === "en"
                      ? item.nameEn || item.nameTh
                      : item.nameTh || item.nameEn}{" "}
                    ({item.year})
                  </option>
                ))}
            </select>
          </label>
          <label className="course-field">
            <span className="course-label">
              {label(language, "ปีที่เข้าเรียน", "Entry year")}
              <span className="course-required">*</span>
            </span>
            <input
              className="course-input"
              type="number"
              min={selectedCurriculum?.year || 0}
              value={form.entryYearBe}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  entryYearBe: event.target.value,
                }))
              }
              placeholder="เช่น 2566"
              disabled={mode === "edit" && !entryYearEditable}
            />
            {selectedCurriculum && (
              <span className="student-form-hint">
                {label(
                  language,
                  `หลักสูตรเริ่มใช้ปี ${selectedCurriculum.year}`,
                  `Curriculum effective year: ${selectedCurriculum.year}`,
                )}
              </span>
            )}
          </label>
        </>
      )}
      {mode === "edit" && !curriculumEditable && (
        <div className="student-identity-readonly">
          <span>
            {label(language, "หลักสูตรถูกล็อก", "Curriculum is locked")}
          </span>
          <strong>
            {selectedCurriculum
              ? language === "en"
                ? selectedCurriculum.nameEn || selectedCurriculum.nameTh
                : selectedCurriculum.nameTh || selectedCurriculum.nameEn
              : "-"}
          </strong>
          <small>
            {label(
              language,
              "รุ่นที่เก็บถาวรเป็นแบบอ่านอย่างเดียว",
              "Archived cohorts are read-only.",
            )}
          </small>
        </div>
      )}
      {mode === "edit" && !entryYearEditable && (
        <div className="student-identity-readonly">
          <span>
            {label(language, "ปีที่เข้าเรียนถูกล็อก", "Entry year is locked")}
          </span>
          <strong>{form.entryYearBe || "-"}</strong>
          <small>
            {label(
              language,
              "เปลี่ยนปีที่เข้าเรียนได้เฉพาะรุ่นร่างที่ยังไม่มีรายชื่อและ Template",
              "Entry year can change only for an empty draft cohort without templates.",
            )}
          </small>
        </div>
      )}
      <label className="course-field">
        <span className="course-label">
          {label(language, "หมายเหตุ", "Note")}
        </span>
        <textarea
          className="course-input student-textarea"
          value={form.note}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, note: event.target.value }))
          }
          placeholder={label(
            language,
            "ข้อมูลเพิ่มเติมของรุ่นนี้",
            "Optional cohort note",
          )}
        />
      </label>
    </BaseModal>
  );
}

function ReactivateModal({ language, cohort, submitting, onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  return (
    <BaseModal
      open
      title={label(language, "เปิดใช้งานรุ่นอีกครั้ง", "Reactivate cohort")}
      variant="warning"
      size="sm"
      onClose={onClose}
      closeDisabled={submitting}
      footer={
        <>
          <button
            className="course-btn course-btn--ghost"
            onClick={onClose}
            disabled={submitting}
          >
            {label(language, "ยกเลิก", "Cancel")}
          </button>
          <button
            className="course-btn course-btn--primary"
            onClick={() => onConfirm(reason)}
            disabled={!reason.trim() || submitting}
          >
            {label(language, "ยืนยันการเปิดใช้งาน", "Confirm reactivation")}
          </button>
        </>
      }
    >
      <p className="course-modal-message">
        {label(
          language,
          `คุณกำลังเปิดใช้งานรุ่น ${cohort.curriculumNameTh || cohort.curriculumNameEn} ปี ${cohort.entryYearBe} อีกครั้ง`,
          `You are reactivating ${cohort.curriculumNameEn || cohort.curriculumNameTh}, entry year ${cohort.entryYearBe}.`,
        )}
      </p>
      <label className="course-field">
        <span className="course-label">
          {label(language, "เหตุผล", "Reason")}
          <span className="course-required">*</span>
        </span>
        <textarea
          className="course-input student-textarea"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
    </BaseModal>
  );
}

function CurriculumChangeImpact({ language, impact }) {
  if (!impact) return null;

  const rows = [
    [
      label(language, "รายชื่อนักศึกษาที่จะย้าย", "Roster records to move"),
      impact.rosterCount,
    ],
    [
      label(language, "Template ที่จะถูกถอด", "Template assignments to end"),
      impact.templateAssignmentCount,
    ],
    [
      label(language, "ผลการเรียนรายวิชาที่จะรีเซ็ต", "Course grades to reset"),
      impact.courseEnrollmentCount,
    ],
    [
      label(
        language,
        "คะแนนรายวิชาที่จะรีเซ็ต",
        "Course competency scores to reset",
      ),
      impact.courseScoreCount,
    ],
    [
      label(
        language,
        "เป้าหมายสมรรถนะที่จะรีเซ็ต",
        "Competency targets to reset",
      ),
      impact.competencyRequirementCount,
    ],
    [
      label(language, "ผลรวมสมรรถนะที่จะรีเซ็ต", "Competency results to reset"),
      impact.competencyResultCount,
    ],
  ];

  return (
    <div className="student-curriculum-impact">
      <strong>
        {impact.fromCurriculumCode || "-"} → {impact.toCurriculumCode || "-"}
      </strong>
      <ul className="student-curriculum-impact__list">
        {rows.map(([text, count]) => (
          <li key={text}>
            <span>{text}</span>
            <b>{count}</b>
          </li>
        ))}
      </ul>
      <p className="student-curriculum-impact__preserved">
        {label(
          language,
          `ข้อมูลกิจกรรมจะคงไว้ (การเข้าร่วม ${impact.activityAttendanceCount} รายการ, คะแนนกิจกรรม ${impact.activityScoreCount} รายการ)`,
          `Activity data will be preserved (${impact.activityAttendanceCount} attendance records, ${impact.activityScoreCount} activity scores).`,
        )}
      </p>
    </div>
  );
}

export default function StudentManagementPage() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const isAdmin = user?.roles?.includes("admin");
  const [cohorts, setCohorts] = useState([]);
  const [faculties, setFaculties] = useState([]);
  const [majors, setMajors] = useState([]);
  const [curricula, setCurricula] = useState([]);
  const [filters, setFilters] = useState({
    facultyId: "",
    majorId: "",
    curriculumId: "",
    entryYearBe: "",
    status: "",
    search: "",
  });
  const [loading, setLoading] = useState(true);
  const [lookupsLoading, setLookupsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", message: "" });
  const [formMode, setFormMode] = useState("");
  const [form, setForm] = useState(EMPTY_COHORT_FORM);
  const [editingCohort, setEditingCohort] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [reactivatingCohort, setReactivatingCohort] = useState(null);

  const loadLookups = useCallback(async () => {
    setLookupsLoading(true);
    try {
      const [nextFaculties, nextCurricula] = await Promise.all([
        fetchFaculties(),
        fetchCurriculums(),
      ]);
      setFaculties(nextFaculties);
      setCurricula(nextCurricula);
      const scopedFaculty =
        !isAdmin && nextFaculties.length === 1
          ? String(nextFaculties[0].facultyId)
          : "";
      setFilters((prev) => ({
        ...prev,
        facultyId: prev.facultyId || scopedFaculty,
      }));
    } catch (error) {
      setFeedback({
        type: "error",
        message: mapStudentManagementError(error, language),
      });
    } finally {
      setLookupsLoading(false);
    }
  }, [isAdmin, language]);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    let active = true;
    fetchMajors({
      includeInactive: true,
      facultyId: filters.facultyId || undefined,
    })
      .then((items) => {
        if (active) setMajors(items);
      })
      .catch((error) => {
        if (active)
          setFeedback({
            type: "error",
            message: mapStudentManagementError(error, language),
          });
      });
    return () => {
      active = false;
    };
  }, [filters.facultyId, language]);

  const loadCohorts = useCallback(
    async (clearFeedback = false) => {
      setLoading(true);
      if (clearFeedback) setFeedback({ type: "", message: "" });
      try {
        setCohorts(await fetchStudentCohorts(filters));
      } catch (error) {
        setFeedback({
          type: "error",
          message: mapStudentManagementError(error, language),
        });
      } finally {
        setLoading(false);
      }
    },
    [filters, language],
  );

  useEffect(() => {
    loadCohorts();
  }, [loadCohorts]);

  useEffect(() => {
    if (feedback.type !== "success") return undefined;
    const timer = window.setTimeout(
      () =>
        setFeedback((current) =>
          current.type === "success" ? { type: "", message: "" } : current,
        ),
      4500,
    );
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const visibleCurricula = useMemo(
    () =>
      curricula.filter(
        (item) =>
          (!filters.facultyId ||
            String(item.facultyId) === String(filters.facultyId)) &&
          (!filters.majorId ||
            String(item.majorId) === String(filters.majorId)),
      ),
    [curricula, filters.facultyId, filters.majorId],
  );
  const formCurricula = useMemo(
    () =>
      curricula.filter(
        (item) =>
          (item.status === "active" ||
            String(item.curriculumId) === String(form.curriculumId)) &&
          (isAdmin ||
            !filters.facultyId ||
            String(item.facultyId) === String(filters.facultyId)),
      ),
    [curricula, form.curriculumId, filters.facultyId, isAdmin],
  );
  const facultyLocked = !isAdmin || faculties.length <= 1;

  const openCreate = () => {
    setEditingCohort(null);
    setForm(EMPTY_COHORT_FORM);
    setFormMode("create");
  };
  const openEdit = (cohort) => {
    setEditingCohort(cohort);
    setForm({
      curriculumId: cohort.curriculumId,
      entryYearBe: cohort.entryYearBe,
      note: cohort.note,
    });
    setFormMode("edit");
  };
  const closeForm = () => {
    if (!submitting) setFormMode("");
  };

  const submitForm = async () => {
    const curriculumChanged =
      formMode === "edit" &&
      String(form.curriculumId) !== String(editingCohort?.curriculumId);
    setSubmitting(true);
    setFeedback({ type: "", message: "" });
    try {
      if (formMode === "create") await createStudentCohort(form);
      else await updateStudentCohort(editingCohort.cohortId, form);
      setFormMode("");
      setFeedback({
        type: "success",
        message:
          formMode === "create"
            ? label(
                language,
                "สร้างรุ่นนักศึกษาสำเร็จ",
                "Student cohort created.",
              )
            : label(
                language,
                "บันทึกข้อมูลรุ่นแล้ว",
                "Cohort information saved.",
              ),
      });
      await loadCohorts();
    } catch (error) {
      if (
        curriculumChanged &&
        error.code === "CONFIRMATION_REQUIRED" &&
        error.payload?.data
      ) {
        setConfirmAction({
          type: "curriculum-change",
          cohort: editingCohort,
          form: { ...form },
          impact: mapCurriculumChangeImpact(error.payload.data),
        });
      } else {
        setFeedback({
          type: "error",
          message: mapStudentManagementError(error, language),
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const performConfirmAction = async () => {
    if (!confirmAction) return;
    setSubmitting(true);
    setFeedback({ type: "", message: "" });
    try {
      if (confirmAction.type === "curriculum-change") {
        await updateStudentCohort(
          confirmAction.cohort.cohortId,
          confirmAction.form,
          { confirmCurriculumChange: true },
        );
        setFormMode("");
        setEditingCohort(null);
        setFeedback({
          type: "success",
          message: label(
            language,
            "เปลี่ยนหลักสูตรและรีเซ็ตข้อมูลที่เกี่ยวข้องแล้ว",
            "Curriculum changed and related academic data was reset.",
          ),
        });
      } else if (confirmAction.type === "delete") {
        await deleteStudentCohort(confirmAction.cohort.cohortId);
        setFeedback({
          type: "success",
          message: label(
            language,
            "ลบรุ่นนักศึกษาแล้ว",
            "Student cohort deleted.",
          ),
        });
      } else {
        await updateStudentCohortStatus(
          confirmAction.cohort.cohortId,
          confirmAction.nextStatus,
        );
        setFeedback({
          type: "success",
          message:
            confirmAction.nextStatus === "active"
              ? label(language, "เปิดใช้งานรุ่นแล้ว", "Cohort activated.")
              : label(language, "เก็บรุ่นเข้าคลังแล้ว", "Cohort archived."),
        });
      }
      setConfirmAction(null);
      await loadCohorts();
    } catch (error) {
      setFeedback({
        type: "error",
        message: mapStudentManagementError(error, language),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const reactivate = async (reason) => {
    if (!reactivatingCohort) return;
    setSubmitting(true);
    setFeedback({ type: "", message: "" });
    try {
      await updateStudentCohortStatus(reactivatingCohort.cohortId, "active", {
        confirmReactivation: true,
        reactivationReason: reason,
      });
      setReactivatingCohort(null);
      setFeedback({
        type: "success",
        message: label(
          language,
          "เปิดใช้งานรุ่นอีกครั้งแล้ว",
          "Cohort reactivated.",
        ),
      });
      await loadCohorts();
    } catch (error) {
      setFeedback({
        type: "error",
        message: mapStudentManagementError(error, language),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="student-management-page">
      <header className="course-list-header">
        <div className="course-list-header__left">
          <h1 className="course-list-header__title">
            {label(language, "จัดการข้อมูลนักศึกษา", "Student Management")}
          </h1>
          <p className="course-list-header__subtitle">
            {label(
              language,
              "สร้างรุ่น จัดการรายชื่อ และนำเข้าข้อมูลนักศึกษา",
              "Create cohorts, manage rosters, and import student data.",
            )}
          </p>
        </div>
        <div className="course-list-header__actions">
          <button
            className="course-btn course-btn--ghost"
            onClick={() => loadCohorts(true)}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? "student-spin" : ""} />
            {label(language, "โหลดใหม่", "Refresh")}
          </button>
          <button
            className="course-btn course-btn--primary"
            onClick={openCreate}
            disabled={lookupsLoading}
          >
            <Plus size={16} />
            {label(language, "สร้างรุ่น", "Create cohort")}
          </button>
        </div>
      </header>

      <ToastNotifications
        success={feedback.type === "success" ? feedback.message : ""}
        error={feedback.type === "error" ? feedback.message : ""}
        onCloseSuccess={() => setFeedback({ type: "", message: "" })}
        onCloseError={() => setFeedback({ type: "", message: "" })}
      />

      <section className="student-filter-panel">
        <label className="course-field">
          <span className="course-label">
            {label(language, "คณะ", "Faculty")}
          </span>
          <select
            className="course-input student-input--disabled-aware"
            value={filters.facultyId}
            disabled={facultyLocked || lookupsLoading}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                facultyId: event.target.value,
                majorId: "",
                curriculumId: "",
              }))
            }
          >
            <option value="">
              {isAdmin
                ? label(language, "ทุกคณะ", "All faculties")
                : label(language, "คณะของคุณ", "Your faculty")}
            </option>
            {faculties.map((item) => (
              <option key={item.facultyId} value={item.facultyId}>
                {item.nameTh}
              </option>
            ))}
          </select>
        </label>
        <label className="course-field">
          <span className="course-label">
            {label(language, "สาขา", "Major")}
          </span>
          <select
            className="course-input"
            value={filters.majorId}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                majorId: event.target.value,
                curriculumId: "",
              }))
            }
          >
            <option value="">{label(language, "ทุกสาขา", "All majors")}</option>
            {majors.map((item) => (
              <option key={item.majorId} value={item.majorId}>
                {item.nameTh}
              </option>
            ))}
          </select>
        </label>
        <label className="course-field">
          <span className="course-label">
            {label(language, "หลักสูตร", "Curriculum")}
          </span>
          <select
            className="course-input"
            value={filters.curriculumId}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                curriculumId: event.target.value,
              }))
            }
          >
            <option value="">
              {label(language, "ทุกหลักสูตร", "All curricula")}
            </option>
            {visibleCurricula.map((item) => (
              <option key={item.curriculumId} value={item.curriculumId}>
                {language === "en"
                  ? item.nameEn || item.nameTh
                  : item.nameTh || item.nameEn}
              </option>
            ))}
          </select>
        </label>
        <label className="course-field">
          <span className="course-label">
            {label(language, "สถานะ", "Status")}
          </span>
          <select
            className="course-input"
            value={filters.status}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, status: event.target.value }))
            }
          >
            <option value="">
              {label(language, "ทุกสถานะ", "All statuses")}
            </option>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label className="course-field student-filter-panel__search">
          <span className="course-label">
            {label(language, "ค้นหา", "Search")}
          </span>
          <span className="student-search">
            <Search size={16} />
            <input
              value={filters.search}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, search: event.target.value }))
              }
              placeholder={label(
                language,
                "ค้นหารหัสหรือชื่อหลักสูตร",
                "Search curriculum code or name",
              )}
            />
          </span>
        </label>
      </section>

      <section className="student-management-panel">
        <div className="student-management-panel__header">
          <div>
            <span>{label(language, "รุ่นนักศึกษา", "Student cohorts")}</span>
            <strong>
              {cohorts.length} {label(language, "รายการ", "items")}
            </strong>
          </div>
          <span>
            {label(
              language,
              "Cohort = หลักสูตร + ปีที่เข้าเรียน",
              "Cohort = curriculum + entry year",
            )}
          </span>
        </div>
        <div className="student-table-wrap">
          <table className="student-table">
            <thead>
              <tr>
                <th>
                  {label(language, "รุ่น / หลักสูตร", "Cohort / curriculum")}
                </th>
                <th>{label(language, "สังกัด", "Affiliation")}</th>
                <th>{label(language, "รายชื่อ", "Roster")}</th>
                <th>{label(language, "สถานะ", "Status")}</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="student-empty">
                    {label(
                      language,
                      "กำลังโหลดข้อมูลรุ่นนักศึกษา...",
                      "Loading student cohorts...",
                    )}
                  </td>
                </tr>
              ) : cohorts.length ? (
                cohorts.map((cohort) => {
                  const status = cohortStatusMeta(cohort.status, language);
                  const curriculumName =
                    language === "en"
                      ? cohort.curriculumNameEn || cohort.curriculumNameTh
                      : cohort.curriculumNameTh || cohort.curriculumNameEn;
                  return (
                    <tr key={cohort.cohortId}>
                      <td>
                        <div className="student-cohort-cell">
                          <strong>{curriculumName}</strong>
                          {cohort.curriculumNameEn && language !== "en" && (
                            <span>
                              {cohort.curriculumNameEn}
                              <span>
                                {label(
                                  language,
                                  ` รุ่น ${cohort.entryYearBe}`,
                                  ` Entry ${cohort.entryYearBe}`,
                                )}
                              </span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="student-cohort-cell">
                          <span>{cohort.facultyNameTh}</span>
                          <span>{cohort.majorNameTh}</span>
                        </div>
                      </td>
                      <td>
                        <div className="student-roster-count">
                          <Users size={15} />
                          <strong>{cohort.rosterCount}</strong>
                          <span>{label(language, "รายชื่อ", "students")}</span>
                          {cohort.suspendedCount > 0 && (
                            <em>
                              {label(
                                language,
                                `พักการศึกษา ${cohort.suspendedCount}`,
                                `${cohort.suspendedCount} suspended`,
                              )}
                            </em>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="student-status-stack">
                          <span
                            className={`student-status student-status--${status.className}`}
                          >
                            {status.label}
                          </span>
                          {cohort.activeTemplateCount > 0 && (
                            <span className="student-template-note">
                              {cohort.activeTemplateCount} Active Template
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="student-row-actions">
                          <Link
                            className="course-icon-btn"
                            href={`/student-management/${cohort.cohortId}`}
                            title={label(
                              language,
                              "จัดการรายชื่อ",
                              "Manage roster",
                            )}
                          >
                            <Eye size={17} />
                          </Link>
                          <button
                            className="course-icon-btn"
                            onClick={() => openEdit(cohort)}
                            title={label(
                              language,
                              "แก้ไขหมายเหตุ",
                              "Edit note",
                            )}
                          >
                            <Edit3 size={16} />
                          </button>
                          {cohort.status === "draft" && (
                            <button
                              className="course-icon-btn"
                              onClick={() =>
                                setConfirmAction({
                                  type: "status",
                                  cohort,
                                  nextStatus: "active",
                                })
                              }
                              title={label(language, "เปิดใช้งาน", "Activate")}
                            >
                              <GraduationCap size={16} />
                            </button>
                          )}
                          {cohort.status === "active" && (
                            <button
                              className="course-icon-btn"
                              onClick={() =>
                                setConfirmAction({
                                  type: "status",
                                  cohort,
                                  nextStatus: "archived",
                                })
                              }
                              title={label(language, "เก็บเข้าคลัง", "Archive")}
                            >
                              <Archive size={16} />
                            </button>
                          )}
                          {cohort.status === "archived" && isAdmin && (
                            <button
                              className="course-icon-btn"
                              onClick={() => setReactivatingCohort(cohort)}
                              title={label(
                                language,
                                "เปิดใช้งานอีกครั้ง",
                                "Reactivate",
                              )}
                            >
                              <GraduationCap size={16} />
                            </button>
                          )}
                          {cohort.status === "draft" && (
                            <button
                              className="course-icon-btn course-icon-btn--danger"
                              onClick={() =>
                                setConfirmAction({ type: "delete", cohort })
                              }
                              title={label(language, "ลบรุ่น", "Delete cohort")}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="student-empty">
                    {label(
                      language,
                      "ยังไม่พบรุ่นนักศึกษาที่ตรงกับตัวกรอง",
                      "No cohorts match the current filters.",
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {formMode && (
        <CohortFormModal
          language={language}
          form={form}
          setForm={setForm}
          curricula={formCurricula}
          submitting={submitting}
          mode={formMode}
          curriculumEditable={
            formMode === "create" ||
            editingCohort?.status === "draft" ||
            editingCohort?.status === "active"
          }
          entryYearEditable={
            formMode === "create" ||
            (editingCohort?.status === "draft" &&
              editingCohort?.rosterCount === 0 &&
              editingCohort?.templateCount === 0)
          }
          onClose={closeForm}
          onSubmit={submitForm}
        />
      )}
      {reactivatingCohort && (
        <ReactivateModal
          language={language}
          cohort={reactivatingCohort}
          submitting={submitting}
          onClose={() => !submitting && setReactivatingCohort(null)}
          onConfirm={reactivate}
        />
      )}
      <ConfirmActionModal
        open={Boolean(confirmAction)}
        size={confirmAction?.type === "curriculum-change" ? "md" : "sm"}
        title={
          confirmAction?.type === "curriculum-change"
            ? label(
                language,
                "ยืนยันการเปลี่ยนหลักสูตร",
                "Confirm curriculum change",
              )
            : confirmAction?.type === "delete"
              ? label(language, "ลบรุ่นนักศึกษา", "Delete student cohort")
              : confirmAction?.nextStatus === "archived"
                ? label(language, "เก็บรุ่นเข้าคลัง", "Archive cohort")
                : label(language, "เปิดใช้งานรุ่น", "Activate cohort")
        }
        message={
          confirmAction?.type === "curriculum-change"
            ? label(
                language,
                "การเปลี่ยนหลักสูตรจะถอด Template เดิมและรีเซ็ตข้อมูลวิชา/คะแนนที่เกี่ยวข้อง คุณต้องการดำเนินการต่อหรือไม่",
                "Changing the curriculum will end the current Template assignment and reset related course and score data. Continue?",
              )
            : confirmAction?.type === "delete"
              ? label(
                  language,
                  "การลบเป็นแบบ Soft Delete และจะลบได้เฉพาะรุ่นร่างที่ไม่มีรายชื่อ",
                  "This is a soft delete. Only an empty draft cohort can be deleted.",
                )
              : confirmAction?.nextStatus === "archived"
                ? label(
                    language,
                    "รุ่นที่เก็บเข้าคลังจะเป็นแบบอ่านอย่างเดียว",
                    "An archived cohort becomes read-only.",
                  )
                : label(
                    language,
                    "หลังเปิดใช้งานสามารถเพิ่มและจัดการรายชื่อนักศึกษาได้",
                    "An active cohort can receive and manage student records.",
                  )
        }
        impact={
          confirmAction?.type === "curriculum-change" ? (
            <CurriculumChangeImpact
              language={language}
              impact={confirmAction.impact}
            />
          ) : null
        }
        hint={
          confirmAction?.type === "curriculum-change"
            ? label(
                language,
                "ข้อมูลการเข้าร่วมกิจกรรมและคะแนนกิจกรรมต้นทางจะคงไว้ แต่ต้องเชื่อม Template และตั้งเป้าหมายใหม่ก่อนคำนวณอีกครั้ง",
                "Raw activity attendance and activity scores will be preserved, but a new Template and targets are required before recalculation.",
              )
            : null
        }
        confirmLabel={
          confirmAction?.type === "curriculum-change"
            ? label(
                language,
                "ยืนยันการเปลี่ยนหลักสูตร",
                "Confirm curriculum change",
              )
            : confirmAction?.type === "delete"
              ? label(language, "ลบรุ่น", "Delete cohort")
              : label(language, "ยืนยัน", "Confirm")
        }
        variant={
          confirmAction?.type === "curriculum-change" ||
          confirmAction?.type === "delete"
            ? "danger"
            : "warning"
        }
        loading={submitting}
        onCancel={() => !submitting && setConfirmAction(null)}
        onConfirm={performConfirmAction}
      />
    </div>
  );
}
