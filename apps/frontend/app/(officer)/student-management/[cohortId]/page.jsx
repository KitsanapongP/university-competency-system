"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Edit3,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  Save,
  Search,
  Target,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { useLanguage } from "../../../../providers/LanguageContext";
import {
  addCohortStudent,
  commitCohortImport,
  fetchCohortStudents,
  fetchCohortCompetencyRequirements,
  fetchCohortCourseCompetencyScoreSummary,
  fetchStudentCohort,
  previewCohortImport,
  removeCohortStudent,
  recalculateCohortCourseCompetencyScores,
  saveCohortCompetencyRequirements,
  updateCohortStudent,
} from "../../../../lib/student-management";
import {
  downloadStudentImportTemplate,
  parseStudentImportFile,
} from "../../../../lib/student-import";
import CourseGradeWorkspace from "./CourseGradeWorkspace";
import BaseModal from "../../../../components/ui/BaseModal";
import ConfirmActionModal from "../../../../components/ui/ConfirmActionModal";
import ToastNotifications from "../../../../components/ui/ToastNotifications";
import "../../curriculum-management/CourseLayout.css";
import "../../curriculum-management/CourseList.css";
import "../StudentManagement.css";
import "./CohortRoster.css";
import "./CourseGradeWorkspace.css";

const EMPTY_STUDENT = {
  studentCode: "",
  prefixTh: "",
  firstNameTh: "",
  lastNameTh: "",
  firstNameEn: "",
  lastNameEn: "",
  email: "",
  phone: "",
  enrollmentStatus: "student",
};
const STATUS_OPTIONS = ["student", "suspended", "alumni", "inactive"];
const STUDENT_STATUS_LABELS = {
  student: ["นักศึกษา", "Student"],
  suspended: ["พักการศึกษา", "Suspended"],
  alumni: ["ศิษย์เก่า", "Alumni"],
  inactive: ["ไม่ใช้งาน", "Inactive"],
};

function label(language, th, en) {
  return language === "en" ? en : th;
}
function studentStatusLabel(language, status) {
  const [th, en] = STUDENT_STATUS_LABELS[status] || [status, status];
  return label(language, th, en);
}
function personName(student) {
  return `${student.prefixTh ? `${student.prefixTh} ` : ""}${student.firstNameTh} ${student.lastNameTh}`.trim();
}

function rosterError(error, language) {
  const message = error?.message || error?.payload?.error?.message || "";
  const messages = {
    "student code already exists": [
      "มีรหัสนักศึกษานี้ในระบบแล้ว",
      "Student code already exists.",
    ],
    "student code cannot be changed": [
      "ไม่สามารถแก้ไขรหัสนักศึกษาได้",
      "Student code cannot be changed.",
    ],
    "student_code, first_name_th, and last_name_th are required": [
      "กรุณากรอกรหัสนักศึกษา ชื่อ และนามสกุลภาษาไทย",
      "Student code and Thai name are required.",
    ],
    "student cannot be removed after academic, attendance, or score usage exists":
      [
        "ถอดรายชื่อนี้ไม่ได้ เพราะมีข้อมูลเรียน เข้าร่วมกิจกรรม หรือคะแนนแล้ว",
        "This student has academic, attendance, or score usage.",
      ],
    "archived cohort is read-only": [
      "รุ่นที่เก็บเข้าคลังแล้วไม่สามารถแก้ไขได้",
      "An archived cohort is read-only.",
    ],
    "import contains invalid or conflicting rows": [
      "ไฟล์มีข้อมูลไม่ถูกต้องหรือชนกับข้อมูลเดิม",
      "The import contains invalid or conflicting rows.",
    ],
    "student cohort operation failed": [
      "ไม่สามารถดำเนินการกับข้อมูลนักศึกษาได้",
      "Unable to complete the student operation.",
    ],
  };
  return messages[message]
    ? label(language, ...messages[message])
    : message ||
        label(
          language,
          "ไม่สามารถดำเนินการได้",
          "Unable to complete the operation.",
        );
}

function StudentFormModal({
  language,
  form,
  setForm,
  mode,
  submitting,
  readOnly,
  onClose,
  onSubmit,
}) {
  const canSave =
    form.studentCode.trim() &&
    form.firstNameTh.trim() &&
    form.lastNameTh.trim() &&
    !submitting &&
    !readOnly;
  return (
    <BaseModal
      open
      title={
        mode === "edit"
          ? label(language, "แก้ไขข้อมูลนักศึกษา", "Edit student")
          : label(language, "เพิ่มนักศึกษา", "Add student")
      }
      size="lg"
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
            disabled={!canSave}
          >
            {label(language, "บันทึก", "Save")}
          </button>
        </>
      }
    >
      <div className="course-row">
        <label className="course-field">
          <span className="course-label">
            {label(language, "รหัสนักศึกษา", "Student code")}
            <span className="course-required">*</span>
          </span>
          <input
            className="course-input"
            value={form.studentCode}
            disabled={mode === "edit"}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, studentCode: event.target.value }))
            }
          />
        </label>
        <label className="course-field">
          <span className="course-label">
            {label(language, "สถานะ", "Status")}
          </span>
          <select
            className="course-input"
            value={form.enrollmentStatus}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                enrollmentStatus: event.target.value,
              }))
            }
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {studentStatusLabel(language, status)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="course-row">
        <label className="course-field">
          <span className="course-label">
            {label(language, "คำนำหน้า", "Prefix")}
          </span>
          <input
            className="course-input"
            value={form.prefixTh}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, prefixTh: event.target.value }))
            }
          />
        </label>
        <label className="course-field">
          <span className="course-label">
            {label(language, "ชื่อ (ภาษาไทย)", "First name (Thai)")}
            <span className="course-required">*</span>
          </span>
          <input
            className="course-input"
            value={form.firstNameTh}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, firstNameTh: event.target.value }))
            }
          />
        </label>
        <label className="course-field">
          <span className="course-label">
            {label(language, "นามสกุล (ภาษาไทย)", "Last name (Thai)")}
            <span className="course-required">*</span>
          </span>
          <input
            className="course-input"
            value={form.lastNameTh}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, lastNameTh: event.target.value }))
            }
          />
        </label>
      </div>
      <div className="course-row">
        <label className="course-field">
          <span className="course-label">
            {label(language, "ชื่อ (ภาษาอังกฤษ)", "First name (English)")}
          </span>
          <input
            className="course-input"
            value={form.firstNameEn}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, firstNameEn: event.target.value }))
            }
          />
        </label>
        <label className="course-field">
          <span className="course-label">
            {label(language, "นามสกุล (ภาษาอังกฤษ)", "Last name (English)")}
          </span>
          <input
            className="course-input"
            value={form.lastNameEn}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, lastNameEn: event.target.value }))
            }
          />
        </label>
      </div>
      <div className="course-row">
        <label className="course-field">
          <span className="course-label">Email</span>
          <input
            className="course-input"
            type="email"
            value={form.email}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, email: event.target.value }))
            }
          />
        </label>
        <label className="course-field">
          <span className="course-label">
            {label(language, "โทรศัพท์", "Phone")}
          </span>
          <input
            className="course-input"
            value={form.phone}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, phone: event.target.value }))
            }
          />
        </label>
      </div>
    </BaseModal>
  );
}

function ImportModal({
  language,
  cohortId,
  submitting,
  onClose,
  onSuccess,
  onError,
}) {
  const [rows, setRows] = useState([]);
  const [preview, setPreview] = useState(null);
  const [parsing, setParsing] = useState(false);

  const loadFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setParsing(true);
    setPreview(null);
    try {
      const importedRows = await parseStudentImportFile(file);
      const nextPreview = await previewCohortImport(cohortId, importedRows);
      const candidateCodes = new Set(
        (nextPreview.update_candidates || []).map((item) => item.student_code),
      );
      setRows(
        importedRows.map((row) => ({
          ...row,
          applyUpdate: candidateCodes.has(row.studentCode)
            ? false
            : row.applyUpdate,
        })),
      );
      setPreview(nextPreview);
    } catch (error) {
      onError(error);
    } finally {
      setParsing(false);
    }
  };

  const updateCandidates = preview?.update_candidates || [];
  const errors = preview?.errors || [];
  const skipped = preview?.skipped_rows || [];
  const validRows = preview?.valid_rows || [];
  const canCommit =
    preview &&
    errors.length === 0 &&
    validRows.length > 0 &&
    !submitting &&
    !parsing;

  const commit = async () => {
    try {
      await commitCohortImport(cohortId, rows);
      onSuccess();
    } catch (error) {
      onError(error);
    }
  };

  return (
    <BaseModal
      open
      title={label(language, "นำเข้ารายชื่อนักศึกษา", "Import student roster")}
      size="xl"
      onClose={onClose}
      closeDisabled={submitting || parsing}
      footer={
        <>
          <button
            className="course-btn course-btn--ghost"
            onClick={onClose}
            disabled={submitting || parsing}
          >
            {label(language, "ยกเลิก", "Cancel")}
          </button>
          <button
            className="course-btn course-btn--primary"
            onClick={commit}
            disabled={!canCommit}
          >
            {submitting
              ? label(language, "กำลังนำเข้า...", "Importing...")
              : label(language, "ยืนยันนำเข้า", "Commit import")}
          </button>
        </>
      }
    >
      <div className="student-import-toolbar">
        <label className="course-btn course-btn--primary student-file-picker">
          <Upload size={16} />
          {parsing
            ? label(language, "กำลังอ่านไฟล์...", "Reading file...")
            : label(language, "เลือกไฟล์ CSV/XLSX", "Choose CSV/XLSX")}
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={loadFile}
            disabled={parsing || submitting}
          />
        </label>
        <button
          className="course-btn course-btn--ghost"
          onClick={downloadStudentImportTemplate}
          disabled={parsing || submitting}
        >
          <FileSpreadsheet size={16} />
          {label(language, "ดาวน์โหลดไฟล์ตัวอย่าง", "Download template")}
        </button>
        <span>
          {label(
            language,
            "สูงสุด 5 MB, 1,000 แถว, อ่านจาก Sheet 1",
            "Maximum 5 MB, 1,000 rows, reads Sheet 1.",
          )}
        </span>
      </div>
      {!preview && (
        <div className="student-import-empty">
          {label(
            language,
            "เลือกไฟล์เพื่อดูผลการตรวจสอบก่อนบันทึก",
            "Choose a file to validate before saving.",
          )}
        </div>
      )}
      {preview && (
        <>
          <div className="student-import-summary">
            <strong>
              {validRows.length} {label(language, "พร้อมนำเข้า", "ready")}
            </strong>
            <span>
              {updateCandidates.length}{" "}
              {label(
                language,
                "รายการต้องยืนยันการอัปเดต",
                "update candidates",
              )}
            </span>
            <span>
              {skipped.length} {label(language, "ข้าม", "skipped")}
            </span>
            <span
              className={errors.length ? "student-import-summary__error" : ""}
            >
              {errors.length} {label(language, "ข้อผิดพลาด", "errors")}
            </span>
          </div>
          {updateCandidates.length > 0 && (
            <section className="student-import-section">
              <strong>
                {label(
                  language,
                  "ข้อมูลที่มีอยู่แล้วและต่างจากไฟล์",
                  "Existing students with changed data",
                )}
              </strong>
              <p>
                {label(
                  language,
                  "เลือกเฉพาะรายการที่ต้องการอัปเดตข้อมูลส่วนตัว รหัสนักศึกษาจะไม่เปลี่ยน",
                  "Select only records whose personal data should be updated. Student codes never change.",
                )}
              </p>
              {updateCandidates.map((student) => (
                <label
                  className="student-import-candidate"
                  key={student.student_code}
                >
                  <input
                    type="checkbox"
                    checked={
                      rows.find(
                        (row) => row.studentCode === student.student_code,
                      )?.applyUpdate || false
                    }
                    onChange={(event) =>
                      setRows((current) =>
                        current.map((row) =>
                          row.studentCode === student.student_code
                            ? { ...row, applyUpdate: event.target.checked }
                            : row,
                        ),
                      )
                    }
                  />
                  <span>
                    {student.student_code} · {student.first_name_th}{" "}
                    {student.last_name_th}
                  </span>
                </label>
              ))}
            </section>
          )}
          {errors.length > 0 && (
            <section className="student-import-section student-import-section--error">
              <strong>
                {label(
                  language,
                  "รายการที่ต้องแก้ไข",
                  "Rows that must be fixed",
                )}
              </strong>
              {errors.map((issue) => (
                <div key={`${issue.row_number}-${issue.student_code}`}>
                  <b>
                    {label(language, "แถว", "Row")} {issue.row_number}
                  </b>{" "}
                  {issue.student_code && `· ${issue.student_code}`} —{" "}
                  {issue.message}
                </div>
              ))}
            </section>
          )}
          {skipped.length > 0 && (
            <section className="student-import-section">
              <strong>
                {label(language, "รายการที่ข้าม", "Skipped rows")}
              </strong>
              {skipped.map((issue) => (
                <div key={`${issue.row_number}-${issue.student_code}`}>
                  {label(language, "แถว", "Row")} {issue.row_number} ·{" "}
                  {issue.student_code} — {issue.message}
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </BaseModal>
  );
}

function CompetencyScorePanel({
  language,
  requirements,
  summary,
  loading,
  readOnly,
  submitting,
  onChangeRequirement,
  onSaveRequirements,
  onRequestRecalculate,
}) {
  const summaryByStudent = useMemo(() => {
    const grouped = new Map();
    summary.forEach((item) => {
      const key = item.enrollmentId;
      if (!grouped.has(key))
        grouped.set(key, {
          studentCode: item.studentCode,
          studentNameTh: item.studentNameTh,
          items: [],
        });
      grouped.get(key).items.push(item);
    });
    return [...grouped.values()];
  }, [summary]);

  return (
    <section className="student-management-panel cohort-score-panel">
      <div className="cohort-score-panel__header">
        <div>
          <h2>
            {label(
              language,
              "เป้าหมายและคะแนนสมรรถนะ",
              "Competency targets and scores",
            )}
          </h2>
          <p>
            {label(
              language,
              "คะแนนหลักมาจากวิชาบังคับ คะแนนเสริมมาจากวิชาเลือก และคะแนนกิจกรรมจะแสดงแยกเป็นคะแนนสะสม",
              "Core comes from required courses, bonus from electives, and activity remains a separate accumulated score.",
            )}
          </p>
        </div>
        <div className="course-list-header__actions">
          <button
            className="course-btn course-btn--ghost"
            onClick={onSaveRequirements}
            disabled={
              readOnly || submitting || loading || requirements.length === 0
            }
          >
            <Save size={16} />
            {label(language, "บันทึกเป้าหมาย", "Save targets")}
          </button>
          <button
            className="course-btn course-btn--primary"
            onClick={onRequestRecalculate}
            disabled={
              readOnly || submitting || loading || requirements.length === 0
            }
          >
            <RefreshCw size={16} />
            {label(language, "คำนวณคะแนนใหม่", "Recalculate scores")}
          </button>
        </div>
      </div>
      <div className="student-table-wrap">
        <table className="student-table cohort-score-targets">
          <thead>
            <tr>
              <th>{label(language, "สมรรถนะ", "Competency")}</th>
              <th>
                {label(language, "เป้าหมายคะแนนรายวิชา", "Course target")}
              </th>
              <th>{label(language, "น้ำหนักคะแนนหลัก", "Core weight")}</th>
              <th>{label(language, "น้ำหนักคะแนนเสริม", "Bonus weight")}</th>
              <th>{label(language, "เป็นเกณฑ์ผ่าน", "Required")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="student-empty">
                  {label(
                    language,
                    "กำลังโหลดการตั้งค่า...",
                    "Loading configuration...",
                  )}
                </td>
              </tr>
            ) : requirements.length ? (
              requirements.map((item, index) => (
                <tr key={item.competencyId}>
                  <td>
                    <strong>{item.competencyName}</strong>
                    <span className="cohort-score-code">
                      {item.competencyCode}
                    </span>
                  </td>
                  <td>
                    <input
                      className="course-input cohort-score-target-input"
                      type="number"
                      min="0"
                      value={item.targetScore}
                      disabled={readOnly || submitting}
                      onChange={(event) =>
                        onChangeRequirement(index, {
                          targetScore: event.target.value,
                        })
                      }
                    />
                  </td>
                  <td>
                    <strong>{item.coreWeight.toFixed(2)}%</strong>
                  </td>
                  <td>
                    <strong>{item.bonusWeight.toFixed(2)}%</strong>
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={item.isRequired}
                      disabled={readOnly || submitting}
                      onChange={(event) =>
                        onChangeRequirement(index, {
                          isRequired: event.target.checked,
                        })
                      }
                    />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="student-empty">
                  {label(
                    language,
                    "ยังไม่มีแบบแผนการประเมินที่เชื่อมกับรุ่นนี้",
                    "No assigned assessment plan for this cohort.",
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="cohort-score-results">
        <h3>{label(language, "ผลคะแนนผู้เรียน", "Learner score results")}</h3>
        <div className="student-table-wrap">
          <table className="student-table">
            <thead>
              <tr>
                <th>{label(language, "ผู้เรียน", "Learner")}</th>
                <th>{label(language, "สมรรถนะ", "Competency")}</th>
                <th>{label(language, "คะแนนหลัก", "Core")}</th>
                <th>{label(language, "คะแนนเสริม", "Bonus")}</th>
                <th>{label(language, "รวมรายวิชา", "Course total")}</th>
                <th>{label(language, "กิจกรรม", "Activity")}</th>
                <th>{label(language, "สะสมทั้งหมด", "Accumulated")}</th>
                <th>{label(language, "สถานะ", "Status")}</th>
              </tr>
            </thead>
            <tbody>
              {summaryByStudent.length ? (
                summaryByStudent.flatMap((student) =>
                  student.items.map((item, index) => (
                    <tr key={`${student.studentCode}-${item.competencyId}`}>
                      <td>
                        {index === 0 && (
                          <div className="student-cohort-cell">
                            <strong>{student.studentCode}</strong>
                            <span>{student.studentNameTh}</span>
                          </div>
                        )}
                      </td>
                      <td>{item.competencyName}</td>
                      <td>{item.coreScore.toFixed(2)}</td>
                      <td>{item.courseBonusScore.toFixed(2)}</td>
                      <td>
                        {item.courseTotalScore.toFixed(2)} /{" "}
                        {item.targetScore.toFixed(2)}
                      </td>
                      <td>{item.activityScore.toFixed(2)}</td>
                      <td>{item.accumulatedScore.toFixed(2)}</td>
                      <td>
                        <span
                          className={
                            item.passedRequirement
                              ? "cohort-score-status cohort-score-status--pass"
                              : "cohort-score-status cohort-score-status--pending"
                          }
                        >
                          {item.passedRequirement
                            ? label(language, "ผ่าน", "Pass")
                            : label(
                                language,
                                "ยังไม่ถึงเป้าหมาย",
                                "Below target",
                              )}
                        </span>
                      </td>
                    </tr>
                  )),
                )
              ) : (
                <tr>
                  <td colSpan={8} className="student-empty">
                    {label(
                      language,
                      "กดคำนวณคะแนนจากผลการเรียนเพื่อแสดงผล",
                      "Recalculate from course grades to show results.",
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default function CohortRosterPage() {
  const { cohortId } = useParams();
  const { language } = useLanguage();
  const [cohort, setCohort] = useState(null);
  const [students, setStudents] = useState([]);
  const [filters, setFilters] = useState({ search: "", status: "" });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", message: "" });
  const [formMode, setFormMode] = useState("");
  const [form, setForm] = useState(EMPTY_STUDENT);
  const [editingStudent, setEditingStudent] = useState(null);
  const [removingStudent, setRemovingStudent] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState("roster");
  const [requirements, setRequirements] = useState([]);
  const [scoreSummary, setScoreSummary] = useState([]);
  const [scoreLoading, setScoreLoading] = useState(false);
  const [recalculateOpen, setRecalculateOpen] = useState(false);
  const [gradeReloadToken, setGradeReloadToken] = useState(0);

  const loadWorkspace = useCallback(async () => {
    if (!cohortId) return;
    setLoading(true);
    try {
      const [nextCohort, nextStudents] = await Promise.all([
        fetchStudentCohort(cohortId),
        fetchCohortStudents(cohortId, filters),
      ]);
      setCohort(nextCohort);
      setStudents(nextStudents);
    } catch (error) {
      setFeedback({ type: "error", message: rosterError(error, language) });
    } finally {
      setLoading(false);
    }
  }, [cohortId, filters, language]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);
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

  const loadScores = useCallback(async () => {
    if (!cohortId) return;
    setScoreLoading(true);
    try {
      const [nextRequirements, nextSummary] = await Promise.all([
        fetchCohortCompetencyRequirements(cohortId),
        fetchCohortCourseCompetencyScoreSummary(cohortId),
      ]);
      setRequirements(nextRequirements);
      setScoreSummary(nextSummary);
    } catch (error) {
      setFeedback({ type: "error", message: rosterError(error, language) });
    } finally {
      setScoreLoading(false);
    }
  }, [cohortId, language]);

  useEffect(() => {
    if (workspaceTab === "scores") loadScores();
  }, [workspaceTab, loadScores]);

  const readOnly = cohort?.status === "archived";
  const openAdd = () => {
    setEditingStudent(null);
    setForm(EMPTY_STUDENT);
    setFormMode("add");
  };
  const openEdit = (student) => {
    setEditingStudent(student);
    setForm({
      studentCode: student.studentCode,
      prefixTh: student.prefixTh,
      firstNameTh: student.firstNameTh,
      lastNameTh: student.lastNameTh,
      firstNameEn: student.firstNameEn,
      lastNameEn: student.lastNameEn,
      email: student.email,
      phone: student.phone,
      enrollmentStatus: student.enrollmentStatus,
    });
    setFormMode("edit");
  };

  const saveStudent = async () => {
    if (!cohort) return;
    setSubmitting(true);
    setFeedback({ type: "", message: "" });
    try {
      if (formMode === "add") await addCohortStudent(cohort.cohortId, form);
      else
        await updateCohortStudent(
          cohort.cohortId,
          editingStudent.enrollmentId,
          form,
        );
      setFormMode("");
      setFeedback({
        type: "success",
        message:
          formMode === "add"
            ? label(language, "เพิ่มนักศึกษาแล้ว", "Student added.")
            : label(language, "บันทึกข้อมูลนักศึกษาแล้ว", "Student saved."),
      });
      await loadWorkspace();
    } catch (error) {
      setFeedback({ type: "error", message: rosterError(error, language) });
    } finally {
      setSubmitting(false);
    }
  };

  const removeStudent = async () => {
    if (!cohort || !removingStudent) return;
    setSubmitting(true);
    setFeedback({ type: "", message: "" });
    try {
      await removeCohortStudent(cohort.cohortId, removingStudent.enrollmentId);
      setRemovingStudent(null);
      setFeedback({
        type: "success",
        message: label(
          language,
          "ถอดรายชื่อนักศึกษาแล้ว",
          "Student removed from cohort.",
        ),
      });
      await loadWorkspace();
    } catch (error) {
      setFeedback({ type: "error", message: rosterError(error, language) });
    } finally {
      setSubmitting(false);
    }
  };

  const saveRequirements = async () => {
    if (!cohort) return;
    setSubmitting(true);
    try {
      const next = await saveCohortCompetencyRequirements(
        cohort.cohortId,
        requirements,
      );
      setRequirements(next);
      setFeedback({
        type: "success",
        message: label(
          language,
          "บันทึกเป้าหมายสมรรถนะแล้ว",
          "Competency targets saved.",
        ),
      });
    } catch (error) {
      setFeedback({ type: "error", message: rosterError(error, language) });
    } finally {
      setSubmitting(false);
    }
  };

  const recalculateScores = async () => {
    if (!cohort) return;
    setSubmitting(true);
    try {
      const result = await recalculateCohortCourseCompetencyScores(
        cohort.cohortId,
      );
      setRecalculateOpen(false);
      setGradeReloadToken((current) => current + 1);
      setFeedback({
        type: "success",
        message: label(
          language,
          `คำนวณคะแนนผู้เรียน ${result?.calculated_students || 0} คนแล้ว`,
          `Recalculated scores for ${result?.calculated_students || 0} learners.`,
        ),
      });
      await loadScores();
    } catch (error) {
      setFeedback({ type: "error", message: rosterError(error, language) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="student-management-page cohort-roster-page">
      <div className="cohort-roster-header">
        <div>
          <Link
            className="course-btn course-btn--ghost cohort-back"
            href="/student-management"
          >
            <ArrowLeft size={16} />
            {label(language, "รุ่นนักศึกษาทั้งหมด", "All cohorts")}
          </Link>
          {cohort ? (
            <>
              <h1>
                {language === "en"
                  ? cohort.curriculumNameEn || cohort.curriculumNameTh
                  : cohort.curriculumNameTh || cohort.curriculumNameEn}{" "}
                ·{" "}
                {label(
                  language,
                  `รุ่น ${cohort.entryYearBe}`,
                  `Entry ${cohort.entryYearBe}`,
                )}
              </h1>
              <p>{cohort.majorNameTh}</p>
            </>
          ) : (
            <h1>
              {label(language, "กำลังโหลดรุ่นนักศึกษา...", "Loading cohort...")}
            </h1>
          )}
        </div>
        <div className="course-list-header__actions">
          <button
            className="course-btn course-btn--ghost"
            onClick={loadWorkspace}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? "student-spin" : ""} />
            {label(language, "โหลดใหม่", "Refresh")}
          </button>
          <button
            className="course-btn course-btn--ghost"
            onClick={() => setImportOpen(true)}
            disabled={!cohort || readOnly}
          >
            <Upload size={16} />
            {label(language, "นำเข้ารายชื่อ", "Import roster")}
          </button>
          <button
            className="course-btn course-btn--primary"
            onClick={openAdd}
            disabled={!cohort || readOnly}
          >
            <Plus size={16} />
            {label(language, "เพิ่มนักศึกษา", "Add student")}
          </button>
        </div>
      </div>
      <ToastNotifications
        success={feedback.type === "success" ? feedback.message : ""}
        error={feedback.type === "error" ? feedback.message : ""}
        onCloseSuccess={() => setFeedback({ type: "", message: "" })}
        onCloseError={() => setFeedback({ type: "", message: "" })}
      />
      {cohort && (
        <div className="cohort-summary">
          <div>
            <span>{label(language, "สถานะรุ่น", "Cohort status")}</span>
            <strong>{cohort.status}</strong>
          </div>
          <div>
            <span>{label(language, "จำนวนรายชื่อ", "Roster")}</span>
            <strong>{cohort.rosterCount}</strong>
          </div>
          <div>
            <span>
              {label(language, "นักศึกษาปัจจุบัน", "Current students")}
            </span>
            <strong>{cohort.studentCount}</strong>
          </div>
          <div>
            <span>{label(language, "ผู้พักการศึกษา", "Suspended")}</span>
            <strong>{cohort.suspendedCount}</strong>
          </div>
          {readOnly && (
            <p>
              {label(
                language,
                "รุ่นนี้เก็บเข้าคลังแล้ว จึงดูข้อมูลได้อย่างเดียว",
                "This cohort is archived and read-only.",
              )}
            </p>
          )}
        </div>
      )}
      <div className="cohort-workspace-tabs" role="tablist">
        <button
          type="button"
          className={workspaceTab === "roster" ? "is-active" : ""}
          onClick={() => setWorkspaceTab("roster")}
        >
          <Users size={16} />
          {label(language, "รายชื่อนักศึกษา", "Roster")}
        </button>
        <button
          type="button"
          className={workspaceTab === "grades" ? "is-active" : ""}
          onClick={() => setWorkspaceTab("grades")}
        >
          <BookOpen size={16} />
          {label(language, "ผลการเรียน", "Course grades")}
        </button>
        <button
          type="button"
          className={workspaceTab === "scores" ? "is-active" : ""}
          onClick={() => setWorkspaceTab("scores")}
        >
          <Target size={16} />
          {label(language, "เป้าหมายสมรรถนะ", "Competency targets")}
        </button>
      </div>
      {workspaceTab === "roster" ? (
        <section className="student-management-panel">
          <div className="cohort-roster-toolbar">
            <div className="student-search">
              <Search size={16} />
              <input
                value={filters.search}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    search: event.target.value,
                  }))
                }
                placeholder={label(
                  language,
                  "ค้นหารหัสหรือชื่อนักศึกษา",
                  "Search student code or name",
                )}
              />
            </div>
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
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {studentStatusLabel(language, status)}
                </option>
              ))}
            </select>
            <span>
              <Users size={16} /> {students.length}{" "}
              {label(language, "รายการ", "items")}
            </span>
          </div>
          <div className="student-table-wrap">
            <table className="student-table cohort-roster-table">
              <thead>
                <tr>
                  <th>{label(language, "นักศึกษา", "Student")}</th>
                  <th>{label(language, "ชื่อภาษาอังกฤษ", "English name")}</th>
                  <th>{label(language, "ติดต่อ", "Contact")}</th>
                  <th>{label(language, "สถานะ", "Status")}</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="student-empty" colSpan={5}>
                      {label(
                        language,
                        "กำลังโหลดรายชื่อนักศึกษา...",
                        "Loading student roster...",
                      )}
                    </td>
                  </tr>
                ) : students.length ? (
                  students.map((student) => (
                    <tr key={student.enrollmentId}>
                      <td>
                        <div className="student-cohort-cell">
                          <strong>{student.studentCode}</strong>
                          <span>{personName(student)}</span>
                        </div>
                      </td>
                      <td>
                        {student.firstNameEn || student.lastNameEn
                          ? `${student.firstNameEn} ${student.lastNameEn}`.trim()
                          : "-"}
                      </td>
                      <td>
                        <div className="student-cohort-cell">
                          <span>{student.email || "-"}</span>
                          <span>{student.phone || "-"}</span>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`student-enrollment-status student-enrollment-status--${student.enrollmentStatus}`}
                        >
                          {studentStatusLabel(
                            language,
                            student.enrollmentStatus,
                          )}
                        </span>
                      </td>
                      <td>
                        <div className="student-row-actions">
                          <button
                            className="course-icon-btn"
                            onClick={() => openEdit(student)}
                            disabled={readOnly}
                            title={label(language, "แก้ไข", "Edit")}
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            className="course-icon-btn course-icon-btn--danger"
                            onClick={() => setRemovingStudent(student)}
                            disabled={readOnly}
                            title={label(
                              language,
                              "ถอดจากรุ่น",
                              "Remove from cohort",
                            )}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="student-empty" colSpan={5}>
                      {label(
                        language,
                        "ยังไม่มีรายชื่อนักศึกษา",
                        "No students in this cohort yet.",
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : workspaceTab === "grades" ? (
        <CourseGradeWorkspace
          language={language}
          cohort={cohort}
          cohortId={cohortId}
          readOnly={readOnly}
          submitting={submitting}
          reloadToken={gradeReloadToken}
          onFeedback={setFeedback}
          onRequestRecalculate={() => setRecalculateOpen(true)}
        />
      ) : (
        <CompetencyScorePanel
          language={language}
          requirements={requirements}
          summary={scoreSummary}
          loading={scoreLoading}
          readOnly={readOnly}
          submitting={submitting}
          onChangeRequirement={(index, changes) =>
            setRequirements((current) =>
              current.map((item, itemIndex) =>
                itemIndex === index ? { ...item, ...changes } : item,
              ),
            )
          }
          onSaveRequirements={saveRequirements}
          onRequestRecalculate={() => setRecalculateOpen(true)}
        />
      )}
      {formMode && (
        <StudentFormModal
          language={language}
          form={form}
          setForm={setForm}
          mode={formMode}
          submitting={submitting}
          readOnly={readOnly}
          onClose={() => !submitting && setFormMode("")}
          onSubmit={saveStudent}
        />
      )}
      {importOpen && cohort && (
        <ImportModal
          language={language}
          cohortId={cohort.cohortId}
          submitting={submitting}
          onClose={() => !submitting && setImportOpen(false)}
          onError={(error) =>
            setFeedback({
              type: "error",
              message: rosterError(error, language),
            })
          }
          onSuccess={async () => {
            setImportOpen(false);
            setFeedback({
              type: "success",
              message: label(
                language,
                "นำเข้ารายชื่อนักศึกษาสำเร็จ",
                "Student roster imported.",
              ),
            });
            await loadWorkspace();
          }}
        />
      )}
      <ConfirmActionModal
        open={Boolean(removingStudent)}
        title={label(
          language,
          "ถอดนักศึกษาออกจากรุ่น",
          "Remove student from cohort",
        )}
        message={label(
          language,
          `ถอด ${removingStudent ? personName(removingStudent) : ""} ออกจากรุ่นนี้หรือไม่`,
          `Remove ${removingStudent ? personName(removingStudent) : ""} from this cohort?`,
        )}
        hint={label(
          language,
          "ข้อมูลบุคคลและบัญชีผู้ใช้จะไม่ถูกลบ",
          "Person data and login accounts are never deleted.",
        )}
        confirmLabel={label(language, "ถอดออก", "Remove")}
        variant="danger"
        loading={submitting}
        onCancel={() => !submitting && setRemovingStudent(null)}
        onConfirm={removeStudent}
      />
      <ConfirmActionModal
        open={recalculateOpen}
        title={label(
          language,
          "คำนวณคะแนนจากผลการเรียนใหม่",
          "Recalculate course competency scores",
        )}
        message={label(
          language,
          "ระบบจะอ่านเกรดที่ดีที่สุดของผู้เรียนและบันทึก snapshot ใหม่ตามน้ำหนักแบบแผนการประเมินปัจจุบัน",
          "The system will use each learner's best grades and save new snapshots using the current assessment-plan weights.",
        )}
        hint={label(
          language,
          "การคำนวณจะไม่เกิดขึ้นอัตโนมัติเมื่อแก้หลักสูตรหรือค่าน้ำหนัก",
          "Curriculum and weight edits never automatically rewrite historical scores.",
        )}
        confirmLabel={label(language, "ยืนยันคำนวณ", "Recalculate")}
        variant="warning"
        loading={submitting}
        onCancel={() => !submitting && setRecalculateOpen(false)}
        onConfirm={recalculateScores}
      />
    </div>
  );
}
