"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Database,
  Edit3,
  MoreHorizontal,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import BaseModal from "../../../../components/ui/BaseModal";
import ConfirmActionModal from "../../../../components/ui/ConfirmActionModal";
import {
  commitCourseGradeImport,
  downloadCourseGradeImportTemplate,
  fetchCourseGradeCourseRoster,
  fetchCourseGradeOverview,
  fetchStudentCourseGrades,
  parseCourseGradeImportFile,
  previewCourseGradeImport,
  saveCourseGrades,
} from "../../../../lib/course-grades";

const GRADE_OPTIONS = [
  "",
  "A",
  "B+",
  "B",
  "C+",
  "C",
  "D+",
  "D",
  "F",
  "S",
  "U",
  "W",
  "I",
];

function label(language, th, en) {
  return language === "en" ? en : th;
}
function courseName(course, language) {
  return language === "en"
    ? course.courseNameEn || course.courseNameTh
    : course.courseNameTh;
}
function sourceLabel(source, language) {
  const labels = {
    manual: ["กรอกเอง", "Manual"],
    excel: ["Excel", "Excel"],
    reg: ["REG", "REG"],
  };
  return labels[source]
    ? label(language, ...labels[source])
    : source || label(language, "ไม่ระบุ", "Unknown");
}
function gradeError(error, language) {
  const message = error?.message || error?.payload?.error?.message || "";
  const messages = {
    "archived cohort is read-only": [
      "รุ่นที่เก็บเข้าคลังแล้วไม่สามารถแก้ไขผลการเรียนได้",
      "An archived cohort is read-only.",
    ],
    "grade import contains invalid rows": [
      "ไฟล์เกรดมีข้อมูลที่ต้องแก้ไข",
      "The grade import contains invalid rows.",
    ],
    "course scores can only be calculated for an active cohort": [
      "คำนวณคะแนนได้เฉพาะรุ่นที่ใช้งานอยู่",
      "Scores can only be recalculated for an active cohort.",
    ],
    "a course grade already exists for this student, course, academic year, and semester": [
      "มีผลการเรียนของวิชานี้ในปีการศึกษาและภาคเรียนนี้อยู่แล้ว",
      "A grade already exists for this student, course, academic year, and semester.",
    ],
    "the selected course grade record was not found in this cohort": [
      "ไม่พบรายการผลการเรียนที่เลือกในรุ่นนี้",
      "The selected grade record was not found in this cohort.",
    ],
    "a course grade cannot be edited and deleted at the same time": [
      "รายการผลการเรียนเดียวกันไม่สามารถแก้ไขและลบพร้อมกันได้",
      "A course grade cannot be edited and deleted at the same time.",
    ],
    "the selected course grade record does not match the selected student and course": [
      "รายการผลการเรียนไม่ตรงกับผู้เรียนหรือวิชาที่เลือก",
      "The selected grade record does not match the selected student and course.",
    ],
  };
  return messages[message]
    ? label(language, ...messages[message])
    : message ||
        label(
          language,
          "ไม่สามารถดำเนินการกับผลการเรียนได้",
          "Unable to complete the grade operation.",
        );
}

function notify(onFeedback, type, message) {
  onFeedback?.({ type, message });
}

function periodLabel(row, language) {
  if (!row.academicYearBe || !row.semester)
    return label(language, "ยังไม่มีข้อมูลผลการเรียน", "No grade history");
  return `${row.academicYearBe}/${row.semester}${row.grade ? ` · ${row.grade}` : ""}`;
}

function rowEditorKey(row) {
  return (
    row.editorKey ||
    `${row.enrollmentId}-${row.courseId}-${row.courseStudentId || "draft"}`
  );
}

function makePlaceholderRow(row) {
  return {
    ...row,
    courseStudentId: 0,
    academicYearBe: "",
    semester: "",
    grade: "",
    gradeSource: "manual",
    sourceReference: "",
    isBestGrade: false,
    isPlaceholder: true,
    isNewRecord: false,
    isHistoryRecord: false,
    hasSelectedGrade: false,
    editorKey: `placeholder-${row.enrollmentId}-${row.courseId}`,
  };
}

function GradeEditorTable({
  language,
  editor,
  rows,
  setRows,
  readOnly,
  submitting,
  editableRowKeys,
  savingRowKeys,
  studentOptions,
  courseOptions,
  focusRowKey,
  onDirty,
  onEditRow,
  onCancelRow,
  onSaveRow,
  onRequestDelete,
  scrollRef,
  onScroll,
}) {
  const [openActionKey, setOpenActionKey] = useState(null);
  const focusedRowRef = useRef(null);

  useEffect(() => {
    if (focusRowKey && rows.some((row) => rowEditorKey(row) === focusRowKey)) {
      focusedRowRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [focusRowKey, rows]);

  const updateRow = (row, field, value) => {
    const key = rowEditorKey(row);
    onDirty?.(key);
    setRows((current) =>
      current.map((item) => {
        if (rowEditorKey(item) !== key) return item;
        if (field === "enrollmentId") {
          const student = studentOptions.find(
            (option) => String(option.enrollmentId) === String(value),
          );
          return {
            ...item,
            enrollmentId: Number(value),
            studentCode: student?.studentCode || "",
            studentNameTh: student?.studentNameTh || "",
          };
        }
        if (field === "courseId") {
          const course = courseOptions.find(
            (option) => String(option.courseId) === String(value),
          );
          return {
            ...item,
            courseId: Number(value),
            courseCode: course?.courseCode || "",
            courseNameTh: course?.courseNameTh || "",
            courseNameEn: course?.courseNameEn || "",
            courseType: course?.courseType || "core",
            credits: course?.credits || 0,
          };
        }
        return { ...item, [field]: value };
      }),
    );
  };
  const hasActiveEdit = editableRowKeys?.size > 0;

  const renderStudentCell = (row, editable) => {
    if (row.isNewRecord && editor?.mode === "course") {
      return (
        <select
          className="course-input course-grade-student-select"
          value={row.enrollmentId || ""}
          disabled={!editable}
          onChange={(event) =>
            updateRow(row, "enrollmentId", event.target.value)
          }
        >
          <option value="">
            {label(language, "เลือกผู้เรียน", "Select student")}
          </option>
          {studentOptions.map((student) => (
            <option key={student.enrollmentId} value={student.enrollmentId}>
              {student.studentCode} · {student.studentNameTh}
            </option>
          ))}
        </select>
      );
    }
    return (
      <div className="student-cohort-cell">
        <strong>{row.studentCode || "-"}</strong>
        <span>{row.studentNameTh || "-"}</span>
      </div>
    );
  };

  const renderCourseCell = (row, editable) => {
    if (row.isNewRecord && editor?.mode === "student") {
      return (
        <select
          className="course-input course-grade-course-select"
          value={row.courseId || ""}
          disabled={!editable}
          onChange={(event) => updateRow(row, "courseId", event.target.value)}
        >
          <option value="">
            {label(language, "เลือกวิชา", "Select course")}
          </option>
          {courseOptions.map((course) => (
            <option key={course.courseId} value={course.courseId}>
              {course.courseCode} · {courseName(course, language)}
            </option>
          ))}
        </select>
      );
    }
    return (
      <div className="student-cohort-cell">
        <strong>{row.courseCode || "-"}</strong>
        <span>{courseName(row, language) || "-"}</span>
      </div>
    );
  };

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="student-table-wrap course-grade-modal-table"
    >
      <table className="student-table">
        <thead>
          <tr>
            <th>{label(language, "ผู้เรียน", "Student")}</th>
            <th>{label(language, "รายวิชา", "Course")}</th>
            <th>{label(language, "สถานะรายการ", "Record status")}</th>
            <th>{label(language, "ปีการศึกษา", "Academic year")}</th>
            <th>{label(language, "ภาคเรียน", "Semester")}</th>
            <th>{label(language, "เกรด", "Grade")}</th>
            <th>{label(language, "แหล่งข้อมูล", "Source")}</th>
            <th>{label(language, "เกรดที่ดีที่สุด", "Best")}</th>
            <th>{label(language, "การจัดการ", "Actions")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => {
              const key = rowEditorKey(row);
              const saving = savingRowKeys?.has(key);
              const editable =
                !readOnly &&
                !submitting &&
                !saving &&
                editableRowKeys?.has(key);
              const status = row.isNewRecord
                ? label(language, "รายการใหม่", "New record")
                : row.isPlaceholder
                  ? label(language, "ยังไม่มีผลการเรียน", "No grade")
                  : label(language, "รายการเดิม", "Existing record");
              return (
                <tr
                  key={key}
                  ref={focusRowKey === key ? focusedRowRef : null}
                  data-row-key={key}
                  className={row.isNewRecord ? "course-grade-draft-row" : ""}
                >
                  <td>{renderStudentCell(row, editable)}</td>
                  <td>{renderCourseCell(row, editable)}</td>
                  <td>
                    <span
                      className={`course-grade-record-status ${row.isNewRecord ? "course-grade-record-status--new" : ""}`}
                    >
                      {status}
                    </span>
                  </td>
                  <td>
                    <input
                      className="course-input course-grade-number"
                      type="number"
                      min="2000"
                      value={row.academicYearBe || ""}
                      disabled={!editable}
                      onChange={(event) =>
                        updateRow(row, "academicYearBe", event.target.value)
                      }
                    />
                  </td>
                  <td>
                    <select
                      className="course-input course-grade-term"
                      value={row.semester || ""}
                      disabled={!editable}
                      onChange={(event) =>
                        updateRow(row, "semester", event.target.value)
                      }
                    >
                      <option value="">-</option>
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                    </select>
                  </td>
                  <td>
                    <select
                      className="course-input course-grade-value"
                      value={row.grade || ""}
                      disabled={!editable}
                      onChange={(event) =>
                        updateRow(row, "grade", event.target.value)
                      }
                    >
                      {GRADE_OPTIONS.map((grade) => (
                        <option key={grade} value={grade}>
                          {grade ||
                            label(language, "ยังไม่บันทึก", "Not recorded")}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <span className="course-grade-source">
                      {sourceLabel(row.gradeSource || "manual", language)}
                    </span>
                  </td>
                  <td>
                    {row.isBestGrade ? (
                      <span className="course-grade-best">
                        {label(language, "ใช่", "Yes")}
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>
                    <div className="course-grade-record-actions">
                      {editable || row.isNewRecord ? (
                        <>
                          <button
                            type="button"
                            className="course-grade-record-action course-grade-record-action--danger"
                            onClick={() => onCancelRow?.(row)}
                            disabled={saving}
                            title={label(language, "ยกเลิก", "Cancel")}
                            aria-label={label(language, "ยกเลิก", "Cancel")}
                          >
                            <X size={15} />
                          </button>
                          <button
                            type="button"
                            className="course-grade-record-action course-grade-record-action--save"
                            onClick={() => onSaveRow?.(row)}
                            disabled={saving}
                            title={label(language, "บันทึกผลการเรียน", "Save grade")}
                            aria-label={label(language, "บันทึกผลการเรียน", "Save grade")}
                          >
                            <Save size={15} />
                          </button>
                        </>
                      ) : !readOnly && !row.isPlaceholder ? (
                        <div className="course-grade-action-menu">
                          <button
                            type="button"
                            className="course-grade-record-action"
                            onClick={() =>
                              setOpenActionKey((current) =>
                                current === key ? null : key,
                              )
                            }
                            disabled={submitting || (hasActiveEdit && !editable)}
                            title={label(language, "การจัดการ", "Actions")}
                            aria-label={label(language, "การจัดการ", "Actions")}
                            aria-expanded={openActionKey === key}
                          >
                            <MoreHorizontal size={16} />
                          </button>
                          {openActionKey === key && (
                            <div className="course-grade-action-menu__list">
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenActionKey(null);
                                  onEditRow?.(row);
                                }}
                              >
                                <Edit3 size={14} />
                                {label(language, "แก้ไขผลการเรียน", "Edit grade")}
                              </button>
                              <button
                                type="button"
                                className="is-danger"
                                onClick={() => {
                                  setOpenActionKey(null);
                                  onRequestDelete?.(row);
                                }}
                              >
                                <Trash2 size={14} />
                                {label(language, "ลบผลการเรียน", "Delete grade")}
                              </button>
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={9} className="student-empty">
                {label(
                  language,
                  "ไม่พบรายการผลการเรียน",
                  "No grade records found.",
                )}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function GradeEditorModal({
  language,
  editor,
  rows,
  setRows,
  submitting,
  readOnly,
  onClose,
  editableRowKeys,
  savingRowKeys,
  studentOptions,
  courseOptions,
  focusRowKey,
  onDirty,
  onEditRow,
  onCancelRow,
  onSaveRow,
  onDeleteRow,
  onAddRetake,
}) {
  const tableScrollRefs = useRef([]);
  const bottomScrollRef = useRef(null);
  const syncingScroll = useRef(false);
  const [scrollContentWidth, setScrollContentWidth] = useState(0);
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const title =
    editor?.mode === "course"
      ? label(
          language,
          `แก้เกรดวิชา ${editor.course?.courseCode || ""}`,
          `Edit grades for ${editor.course?.courseCode || ""}`,
        )
      : label(
          language,
          `แก้ผลการเรียนของ ${editor?.student?.studentCode || ""}`,
          `Edit grades for ${editor?.student?.studentCode || ""}`,
        );
  const syncScrollPosition = useCallback((source) => {
    if (syncingScroll.current) return;
    syncingScroll.current = true;
    const left = source.scrollLeft;
    tableScrollRefs.current.forEach((element) => {
      if (element && element !== source) element.scrollLeft = left;
    });
    if (bottomScrollRef.current && bottomScrollRef.current !== source)
      bottomScrollRef.current.scrollLeft = left;
    requestAnimationFrame(() => {
      syncingScroll.current = false;
    });
  }, []);
  const syncScrollWidth = useCallback(() => {
    const width = Math.max(
      0,
      ...tableScrollRefs.current
        .filter(Boolean)
        .map((element) => element.scrollWidth),
    );
    setScrollContentWidth(width);
  }, []);
  useEffect(() => {
    syncScrollWidth();
    const observer = new ResizeObserver(syncScrollWidth);
    tableScrollRefs.current
      .filter(Boolean)
      .forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [editor?.mode, rows.length, syncScrollWidth]);
  useEffect(() => {
    if (!focusRowKey) return;
    requestAnimationFrame(() => {
      tableScrollRefs.current.filter(Boolean).forEach((element) => {
        element.scrollLeft = element.scrollWidth;
      });
      if (bottomScrollRef.current) {
        bottomScrollRef.current.scrollLeft = bottomScrollRef.current.scrollWidth;
      }
    });
  }, [focusRowKey, rows.length]);
  const tableProps = (index) => ({
    scrollRef: (element) => {
      tableScrollRefs.current[index] = element;
    },
    onScroll: (event) => syncScrollPosition(event.currentTarget),
  });
  const sortedRows = [...rows].sort((left, right) => {
    const leftYear = Number(left.academicYearBe || 0);
    const rightYear = Number(right.academicYearBe || 0);
    if (leftYear !== rightYear) return leftYear - rightYear;
    const leftSemester = Number(left.semester || 0);
    const rightSemester = Number(right.semester || 0);
    if (leftSemester !== rightSemester) return leftSemester - rightSemester;
    return String(left.courseCode || "").localeCompare(
      String(right.courseCode || ""),
    );
  });
  const termGroups = useMemo(() => {
    if (editor?.mode !== "student") return [];
    const groups = new Map();
    sortedRows.forEach((row) => {
      const key = row.isNewRecord || !row.academicYearBe || !row.semester
        ? "new"
        : `${row.academicYearBe}-${row.semester}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    });
    return [...groups.entries()];
  }, [editor?.mode, sortedRows]);
  const renderTermHeading = (key) => {
    if (key === "new") {
      return label(language, "รายการใหม่", "New record");
    }
    const [year, semester] = key.split("-");
    return label(
      language,
      `ปีการศึกษา ${year} · ภาคเรียนที่ ${semester}`,
      `Academic year ${year} · Semester ${semester}`,
    );
  };
  const footer = (
    <div
      ref={bottomScrollRef}
      className="course-grade-editor-horizontal-scroll"
      onScroll={(event) => syncScrollPosition(event.currentTarget)}
      aria-label={label(
        language,
        "เลื่อนตารางเกรดในแนวนอน",
        "Scroll grade table horizontally",
      )}
    >
      <div style={{ width: `${Math.max(scrollContentWidth, 1320)}px` }} />
    </div>
  );
  return (
    <>
      <BaseModal
        open={Boolean(editor)}
        title={title}
        size="xl"
        onClose={onClose}
        closeDisabled={submitting}
        footer={footer}
      >
        <div className="course-grade-editor-toolbar">
          <div className="course-grade-editor-note">
            {label(
              language,
              "แก้ไขหรือเพิ่มผลการเรียนแล้วกดบันทึกที่แถวนั้น ระบบจะเลือกเกรดที่ดีที่สุดให้อัตโนมัติ",
              "Edit or add a grade and save it on that row. The system selects the best grade automatically.",
            )}
          </div>
          {!readOnly && (
            <button
              type="button"
              className="course-btn course-btn--primary"
              onClick={onAddRetake}
              disabled={submitting || editableRowKeys?.size > 0}
            >
              <Plus size={16} />
              {label(language, "เพิ่มผลการเรียนซ้ำ", "Add retake grade")}
            </button>
          )}
        </div>
        {editor?.mode === "course" ? (
          <GradeEditorTable
            language={language}
            editor={editor}
            rows={sortedRows}
            setRows={setRows}
            readOnly={readOnly}
            submitting={submitting}
            editableRowKeys={editableRowKeys}
            savingRowKeys={savingRowKeys}
            studentOptions={studentOptions}
            courseOptions={courseOptions}
            focusRowKey={focusRowKey}
            onDirty={onDirty}
            onEditRow={onEditRow}
            onCancelRow={onCancelRow}
            onSaveRow={onSaveRow}
            onRequestDelete={setDeleteCandidate}
            {...tableProps(0)}
          />
        ) : (
          <div className="course-grade-editor-groups">
            {termGroups.map(([key, groupRows], index) => (
              <section key={key}>
                <div className="course-grade-editor-group-heading">
                  <div>
                    <strong>{renderTermHeading(key)}</strong>
                    <span>
                      {groupRows.length} {label(language, "รายการ", "records")}
                    </span>
                  </div>
                  <b>{groupRows.length}</b>
                </div>
                <GradeEditorTable
                  language={language}
                  editor={editor}
                  rows={groupRows}
                  setRows={setRows}
                  readOnly={readOnly}
                  submitting={submitting}
                  editableRowKeys={editableRowKeys}
                  savingRowKeys={savingRowKeys}
                  studentOptions={studentOptions}
                  courseOptions={courseOptions}
                  focusRowKey={focusRowKey}
                  onDirty={onDirty}
                  onEditRow={onEditRow}
                  onCancelRow={onCancelRow}
                  onSaveRow={onSaveRow}
                  onRequestDelete={setDeleteCandidate}
                  {...tableProps(index)}
                />
              </section>
            ))}
          </div>
        )}
      </BaseModal>
      <ConfirmActionModal
        open={Boolean(deleteCandidate)}
        title={label(
          language,
          "ยืนยันการลบผลการเรียน",
          "Confirm grade deletion",
        )}
        message={label(
          language,
          "รายการนี้จะถูกลบออกจากผลการเรียนที่ใช้งาน และยังเก็บประวัติไว้ในระบบ",
          "This record will be removed from active grades while its history is retained.",
        )}
        impact={
          deleteCandidate && (
            <div className="course-grade-delete-impact">
              <strong>
                {deleteCandidate.courseCode} · {periodLabel(deleteCandidate, language)}
              </strong>
              <span>
                {deleteCandidate.studentCode || editor?.student?.studentCode || "-"}
              </span>
            </div>
          )
        }
        hint={label(
          language,
          "ระบบจะคำนวณเกรดที่ดีที่สุดใหม่หลังบันทึกการเปลี่ยนแปลง",
          "The best grade will be recalculated after saving the changes.",
        )}
        confirmLabel={label(language, "ลบผลการเรียน", "Delete grade")}
        cancelLabel={label(language, "ยกเลิก", "Cancel")}
        variant="danger"
        loading={deleting}
        onConfirm={async () => {
          setDeleting(true);
          try {
            await onDeleteRow?.(deleteCandidate);
            setDeleteCandidate(null);
          } finally {
            setDeleting(false);
          }
        }}
        onCancel={() => setDeleteCandidate(null)}
      />
    </>
  );
}

function GradeImportModal({
  language,
  open,
  cohortId,
  submitting,
  onClose,
  onSuccess,
  onError,
}) {
  const [rows, setRows] = useState([]);
  const [preview, setPreview] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const loadFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setParsing(true);
    setPreview(null);
    try {
      const importedRows = await parseCourseGradeImportFile(file);
      const nextPreview = await previewCourseGradeImport(
        cohortId,
        importedRows,
      );
      setRows(importedRows);
      setPreview(nextPreview);
    } catch (error) {
      onError(error);
    } finally {
      setParsing(false);
    }
  };
  const errors = preview?.errors || [];
  const conflicts = preview?.conflicts || [];
  const validRows = preview?.valid_rows || [];
  const canCommit =
    Boolean(preview) &&
    errors.length === 0 &&
    validRows.length > 0 &&
    !parsing &&
    !submitting;
  const toggleConflict = (rowNumber) =>
    setRows((current) =>
      current.map((row) =>
        row.rowNumber === rowNumber ? { ...row, replace: !row.replace } : row,
      ),
    );
  const commit = async () => {
    setConfirmOpen(false);
    try {
      await commitCourseGradeImport(cohortId, rows);
      onSuccess();
    } catch (error) {
      onError(error);
    }
  };
  if (!open) return null;
  return (
    <>
      <BaseModal
        open
        title={label(
          language,
          "นำเข้าผลการเรียนจาก Excel",
          "Import course grades from Excel",
        )}
        size="xl"
        onClose={onClose}
        closeDisabled={parsing || submitting || confirmOpen}
        footer={
          <>
            <button
              className="course-btn course-btn--ghost"
              onClick={onClose}
              disabled={parsing || submitting || confirmOpen}
            >
              {label(language, "ยกเลิก", "Cancel")}
            </button>
            <button
              className="course-btn course-btn--primary"
              onClick={() => setConfirmOpen(true)}
              disabled={!canCommit}
            >
              {submitting
                ? label(language, "กำลังนำเข้า...", "Importing...")
                : label(language, "ยืนยันนำเข้า", "Commit import")}
            </button>
          </>
        }
      >
        <div className="course-grade-import-toolbar">
          <label className="course-btn course-btn--primary course-grade-file-picker">
            <Upload size={16} />
            {parsing
              ? label(language, "กำลังอ่านไฟล์...", "Reading file...")
              : label(language, "เลือกไฟล์ .xlsx", "Choose .xlsx file")}
            <input
              type="file"
              accept=".xlsx"
              onChange={loadFile}
              disabled={parsing || submitting}
            />
          </label>
          <button
            className="course-btn course-btn--ghost"
            onClick={downloadCourseGradeImportTemplate}
            disabled={parsing || submitting}
          >
            <FileSpreadsheet size={16} />
            {label(language, "ดาวน์โหลดไฟล์ตัวอย่าง", "Download template")}
          </button>
          <span>
            {label(
              language,
              "ต้องมี รหัสนักศึกษา, รหัสวิชา, ปีการศึกษา, ภาคเรียน และเกรด",
              "Required: student code, course code, academic year, semester, and grade.",
            )}
          </span>
        </div>
        {!preview && (
          <div className="course-grade-import-empty">
            {label(
              language,
              "เลือกไฟล์เพื่อดู Preview ก่อนบันทึก",
              "Choose a file to preview before saving.",
            )}
          </div>
        )}
        {preview && (
          <>
            <div className="course-grade-import-summary">
              <strong>
                {validRows.length}{" "}
                {label(language, "รายการที่ตรวจผ่าน", "valid rows")}
              </strong>
              <span>
                {conflicts.length}{" "}
                {label(language, "รายการชนข้อมูลเดิม", "conflicts")}
              </span>
              <span
                className={
                  errors.length ? "course-grade-import-error-count" : ""
                }
              >
                {errors.length} {label(language, "ข้อผิดพลาด", "errors")}
              </span>
            </div>
            {conflicts.length > 0 && (
              <section className="course-grade-import-section">
                <strong>
                  {label(
                    language,
                    "เลือกแทนที่เกรดเดิม",
                    "Select conflicts to replace",
                  )}
                </strong>
                <p>
                  {label(
                    language,
                    "รายการที่ไม่เลือกจะถูกข้าม และรายการใหม่จะยังนำเข้าได้ตามปกติ",
                    "Unselected conflicts are skipped; new rows are still imported.",
                  )}
                </p>
                {conflicts.map((conflict) => (
                  <label
                    className="course-grade-import-conflict"
                    key={`${conflict.row_number}-${conflict.course_code}`}
                  >
                    <input
                      type="checkbox"
                      checked={
                        rows.find(
                          (row) => row.rowNumber === conflict.row_number,
                        )?.replace || false
                      }
                      onChange={() => toggleConflict(conflict.row_number)}
                    />
                    <span>
                      {label(language, "แถว", "Row")} {conflict.row_number} ·{" "}
                      {conflict.student_code} · {conflict.course_code}:{" "}
                      {conflict.existing_grade} → {conflict.incoming_grade}
                    </span>
                  </label>
                ))}
              </section>
            )}
            {errors.length > 0 && (
              <section className="course-grade-import-section course-grade-import-section--error">
                <strong>
                  {label(
                    language,
                    "รายการที่ต้องแก้ไข",
                    "Rows that must be fixed",
                  )}
                </strong>
                {errors.map((issue, index) => (
                  <div
                    key={`${issue.row_number}-${issue.course_code}-${index}`}
                  >
                    {issue.row_number
                      ? `${label(language, "แถว", "Row")} ${issue.row_number} · `
                      : ""}
                    {issue.student_code || ""}
                    {issue.course_code ? ` · ${issue.course_code}` : ""} —{" "}
                    {issue.message}
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </BaseModal>
      <ConfirmActionModal
        open={confirmOpen}
        title={label(
          language,
          "ยืนยันการนำเข้าผลการเรียน",
          "Confirm grade import",
        )}
        message={label(
          language,
          "ระบบจะบันทึกรายการใหม่ และแทนที่เฉพาะรายการเดิมที่คุณเลือกไว้",
          "New rows will be saved, and only selected existing records will be replaced.",
        )}
        impact={
          <div className="course-grade-import-confirm-impact">
            <span>
              {validRows.length}{" "}
              {label(language, "รายการใหม่/รายการที่ผ่านการตรวจ", "valid rows")}
            </span>
            <span>
              {
                conflicts.filter(
                  (conflict) =>
                    rows.find((row) => row.rowNumber === conflict.row_number)
                      ?.replace,
                ).length
              }{" "}
              {label(language, "รายการที่จะถูกแทนที่", "selected replacements")}
            </span>
          </div>
        }
        hint={label(
          language,
          "หลังนำเข้า ระบบจะทำเครื่องหมายว่าต้องคำนวณคะแนนใหม่ แต่จะยังไม่เปลี่ยนคะแนนบน Dashboard จนกว่าจะกดคำนวณใหม่",
          "The cohort will be marked for recalculation. Dashboard scores will not change until you explicitly recalculate.",
        )}
        confirmLabel={label(language, "นำเข้าข้อมูล", "Import grades")}
        cancelLabel={label(language, "กลับไปตรวจสอบ", "Review again")}
        variant="info"
        loading={submitting}
        onConfirm={commit}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}

export default function CourseGradeWorkspace({
  language,
  cohortId,
  readOnly,
  submitting,
  reloadToken = 0,
  onFeedback,
  onRequestRecalculate,
}) {
  const [view, setView] = useState("courses");
  const [filters, setFilters] = useState({
    search: "",
    academicYearBe: "",
    semester: "",
    status: "recorded",
  });
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editor, setEditor] = useState(null);
  const [editorRows, setEditorRows] = useState([]);
  const [editorLoading, setEditorLoading] = useState(false);
  const [editableRowKeys, setEditableRowKeys] = useState(new Set());
  const [rowSnapshots, setRowSnapshots] = useState(new Map());
  const [savingRowKeys, setSavingRowKeys] = useState(new Set());
  const [focusRowKey, setFocusRowKey] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [regOpen, setRegOpen] = useState(false);

  const loadOverview = useCallback(async () => {
    if (!cohortId) return;
    setLoading(true);
    try {
      setOverview(await fetchCourseGradeOverview(cohortId, filters));
    } catch (error) {
      notify(onFeedback, "error", gradeError(error, language));
    } finally {
      setLoading(false);
    }
  }, [cohortId, filters, language, onFeedback]);
  useEffect(() => {
    loadOverview();
  }, [loadOverview, reloadToken]);

  const resetEditorChanges = () => {
    setEditableRowKeys(new Set());
    setRowSnapshots(new Map());
    setSavingRowKeys(new Set());
    setFocusRowKey("");
  };

  const buildCourseEditorRows = (detail) =>
    detail.students.flatMap((student) => {
      const base = {
        enrollmentId: student.enrollmentId,
        studentCode: student.studentCode,
        studentNameTh: student.studentNameTh,
        courseId: detail.course.courseId,
        courseCode: detail.course.courseCode,
        courseNameTh: detail.course.courseNameTh,
        courseNameEn: detail.course.courseNameEn,
        courseType: detail.course.courseType,
        credits: detail.course.credits,
      };
      const grades = [
        ...(student.selectedGrade ? [student.selectedGrade] : []),
        ...(student.otherGrades || []),
      ];
      if (!grades.length) {
        return [
          makePlaceholderRow({
            ...base,
            editorKey: `course-${detail.course.courseId}-${student.enrollmentId}-placeholder`,
          }),
        ];
      }
      return grades.map((grade, index) => ({
        ...base,
        ...grade,
        editorKey: `course-${detail.course.courseId}-${student.enrollmentId}-${grade.courseStudentId}`,
        isPlaceholder: false,
        isNewRecord: false,
        isHistoryRecord: index > 0,
        isPrimaryRecord: index === 0,
        hasSelectedGrade: index === 0,
      }));
    });

  const buildStudentEditorRows = (detail, student) =>
    detail.grades.map((row) => ({
      ...row,
      editorKey: `student-${student.enrollmentId}-${row.courseId}-${row.courseStudentId || "placeholder"}`,
      studentCode: student.studentCode,
      studentNameTh: student.studentNameTh,
      isPlaceholder: !row.courseStudentId,
      isNewRecord: false,
      isHistoryRecord: Boolean(row.courseStudentId),
      isPrimaryRecord: false,
      hasSelectedGrade: Boolean(row.courseStudentId),
    }));

  const loadEditorData = async (currentEditor, nextFocusRowKey = "") => {
    if (!currentEditor) return;
    setEditorLoading(true);
    try {
      if (currentEditor.mode === "course") {
        const detail = await fetchCourseGradeCourseRoster(
          cohortId,
          currentEditor.course.courseId,
          { ...filters, academicYearBe: "", semester: "" },
        );
        setEditor({ mode: "course", course: detail.course });
        setEditorRows(buildCourseEditorRows(detail));
      } else {
        const detail = await fetchStudentCourseGrades(
          cohortId,
          currentEditor.student.enrollmentId,
          { ...filters, academicYearBe: "", semester: "" },
        );
        setEditorRows(buildStudentEditorRows(detail, currentEditor.student));
      }
      setFocusRowKey(nextFocusRowKey);
    } catch (error) {
      notify(onFeedback, "error", gradeError(error, language));
    } finally {
      setEditorLoading(false);
    }
  };

  const openCourseEditor = async (course) => {
    const nextEditor = { mode: "course", course };
    setEditor(nextEditor);
    setEditorRows([]);
    resetEditorChanges();
    await loadEditorData(nextEditor);
  };

  const openStudentEditor = async (student) => {
    const nextEditor = { mode: "student", student };
    setEditor(nextEditor);
    setEditorRows([]);
    resetEditorChanges();
    await loadEditorData(nextEditor);
  };

  const markRowEditable = (row) => {
    const key = rowEditorKey(row);
    setRowSnapshots((current) => {
      if (current.has(key)) return current;
      const next = new Map(current);
      next.set(key, { ...row });
      return next;
    });
    setEditableRowKeys((current) => {
      const next = new Set(current);
      next.add(key);
      return next;
    });
  };

  const markRowDirty = (key) => {
    return key;
  };

  const cancelRow = (row) => {
    const key = rowEditorKey(row);
    if (row.isNewRecord) {
      setEditorRows((current) => current.filter((item) => rowEditorKey(item) !== key));
    } else {
      const snapshot = rowSnapshots.get(key);
      if (snapshot) {
        setEditorRows((current) =>
          current.map((item) =>
            rowEditorKey(item) === key ? { ...snapshot } : item,
          ),
        );
      }
    }
    setEditableRowKeys((current) => {
      const next = new Set(current);
      next.delete(key);
      return next;
    });
    setRowSnapshots((current) => {
      const next = new Map(current);
      next.delete(key);
      return next;
    });
  };

  const addRetakeRow = () => {
    const sourceRow = editor?.mode === "course"
      ? editorRows[0] || { courseId: editor.course.courseId, courseCode: editor.course.courseCode }
      : editor?.student || {};
    const draftKey = `retake-${Date.now()}-${editorRows.length}`;
    const draft = {
      ...sourceRow,
      courseStudentId: 0,
      editorKey: draftKey,
      academicYearBe: "",
      semester: "",
      grade: "",
      gradeSource: "manual",
      sourceReference: "",
      isBestGrade: false,
      isPlaceholder: false,
      isNewRecord: true,
      isHistoryRecord: false,
      isPrimaryRecord: false,
      hasSelectedGrade: false,
    };
    if (editor?.mode === "course") {
      draft.courseId = editor.course.courseId;
      draft.courseCode = editor.course.courseCode;
      draft.courseNameTh = editor.course.courseNameTh;
      draft.courseNameEn = editor.course.courseNameEn;
      draft.courseType = editor.course.courseType;
      draft.credits = editor.course.credits;
      draft.enrollmentId = 0;
      draft.studentCode = "";
      draft.studentNameTh = "";
    } else {
      draft.enrollmentId = editor.student.enrollmentId;
      draft.studentCode = editor.student.studentCode;
      draft.studentNameTh = editor.student.studentNameTh;
      draft.courseId = 0;
      draft.courseCode = "";
      draft.courseNameTh = "";
      draft.courseNameEn = "";
    }
    setEditorRows((current) => [...current, draft]);
    setEditableRowKeys((current) => new Set(current).add(draftKey));
    setFocusRowKey(draftKey);
  };

  const saveRow = async (row) => {
    const key = rowEditorKey(row);
    if (!row.enrollmentId || !row.studentCode || !row.courseId ||
      !row.academicYearBe || !row.semester || !String(row.grade || "").trim()) {
      notify(
        onFeedback,
        "error",
        label(
          language,
          "กรุณาเลือกผู้เรียน วิชา ปีการศึกษา ภาคเรียน และเกรดให้ครบ",
          "Select a student, course, academic year, semester, and grade.",
        ),
      );
      return;
    }
    setSavingRowKeys((current) => new Set(current).add(key));
    try {
      await saveCourseGrades(cohortId, [{ ...row, rowNumber: 0 }]);
      await loadOverview();
      await loadEditorData(editor, key);
      setEditableRowKeys((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
      setRowSnapshots((current) => {
        const next = new Map(current);
        next.delete(key);
        return next;
      });
      notify(
        onFeedback,
        "success",
        label(
          language,
          "บันทึกผลการเรียนแล้ว ต้องคำนวณคะแนนใหม่เพื่ออัปเดต Dashboard",
          "Grade saved. Recalculate to update the dashboard.",
        ),
      );
    } catch (error) {
      notify(onFeedback, "error", gradeError(error, language));
    } finally {
      setSavingRowKeys((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  };

  const deleteRow = async (row) => {
    const key = rowEditorKey(row);
    if (!row.courseStudentId) return;
    setSavingRowKeys((current) => new Set(current).add(key));
    try {
      await saveCourseGrades(cohortId, [], [row.courseStudentId]);
      await loadOverview();
      await loadEditorData(editor);
      notify(
        onFeedback,
        "success",
        label(
          language,
          "ลบผลการเรียนแล้ว ต้องคำนวณคะแนนใหม่เพื่ออัปเดต Dashboard",
          "Grade deleted. Recalculate to update the dashboard.",
        ),
      );
    } catch (error) {
      notify(onFeedback, "error", gradeError(error, language));
    } finally {
      setSavingRowKeys((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  };

  const statusText = overview?.courseScoresRecalculationRequired
    ? label(
        language,
        "มีผลการเรียนที่รอคำนวณใหม่",
        "Grades changed; recalculation required",
      )
    : label(language, "ข้อมูลคะแนนเป็นปัจจุบัน", "Scores are up to date");
  const students = useMemo(() => overview?.students || [], [overview]);
  const courses = useMemo(() => overview?.courses || [], [overview]);
  const editorCourseOptions = useMemo(() => {
    if (editor?.mode !== "student") return courses;
    const uniqueCourses = new Map();
    editorRows.forEach((row) => {
      if (row.courseId) uniqueCourses.set(row.courseId, row);
    });
    return [...uniqueCourses.values()];
  }, [courses, editor?.mode, editorRows]);
  const totalGradeSlots = courses.reduce(
    (total, course) => total + course.totalStudents,
    0,
  );

  return (
    <section className="student-management-panel course-grade-workspace">
      <div className="course-grade-workspace__header">
        <div>
          <h2>{label(language, "ผลการเรียน", "Course grades")}</h2>
          <p>
            {label(
              language,
              "จัดการผลการเรียนของผู้เรียนในรุ่น และกดคำนวณคะแนนสมรรถนะใหม่เมื่อพร้อม",
              "Manage cohort course grades and explicitly recalculate competency scores when ready.",
            )}
          </p>
        </div>
        <div className="course-list-header__actions">
          <button
            className="course-btn course-btn--ghost"
            onClick={() => setRegOpen(true)}
            disabled={readOnly}
          >
            <Database size={16} />
            {label(language, "ดึงจาก REG", "Import from REG")}
          </button>
          <button
            className="course-btn course-btn--ghost"
            onClick={() => setImportOpen(true)}
            disabled={readOnly}
          >
            <Upload size={16} />
            {label(language, "นำเข้า Excel", "Import Excel")}
          </button>
          <button
            className="course-btn course-btn--primary"
            onClick={onRequestRecalculate}
            disabled={readOnly || submitting || !overview}
          >
            <RefreshCw size={16} />
            {label(language, "คำนวณใหม่", "Recalculate")}
          </button>
        </div>
      </div>
      <div
        className={`course-grade-recalc-banner ${overview?.courseScoresRecalculationRequired ? "is-stale" : "is-current"}`}
      >
        <span>{statusText}</span>
        {overview?.courseScoresRecalculatedAt && (
          <small>
            {label(language, "คำนวณล่าสุด", "Last recalculated")}:{" "}
            {new Date(overview.courseScoresRecalculatedAt).toLocaleString(
              language === "en" ? "en-US" : "th-TH",
            )}
          </small>
        )}
      </div>
      <div className="course-grade-summary">
        <div>
          <span>{label(language, "รายวิชา", "Courses")}</span>
          <strong>{overview?.totalCourses || 0}</strong>
        </div>
        <div>
          <span>{label(language, "ผู้เรียน", "Students")}</span>
          <strong>{overview?.totalStudents || 0}</strong>
        </div>
        <div>
          <span>{label(language, "รายการเกรด", "Recorded grades")}</span>
          <strong>{overview?.recordedGrades || 0}</strong>
        </div>
        <div>
          <span>{label(language, "ความครบถ้วน", "Completeness")}</span>
          <strong>
            {overview?.totalStudents
              ? `${overview?.recordedGrades || 0}/${totalGradeSlots}`
              : "0/0"}
          </strong>
        </div>
      </div>
      <div className="course-grade-toolbar">
        <div className="student-search">
          <Search size={16} />
          <input
            value={filters.search}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                search: event.target.value,
              }))
            }
            placeholder={label(
              language,
              "ค้นหารหัสวิชา หรือชื่อวิชา",
              "Search course code or name",
            )}
          />
        </div>
        <input
          className="course-input course-grade-filter-year"
          type="number"
          placeholder={label(language, "ปีการศึกษา", "Academic year")}
          value={filters.academicYearBe}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              academicYearBe: event.target.value,
            }))
          }
        />
        <select
          className="course-input course-grade-filter-term"
          value={filters.semester}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              semester: event.target.value,
            }))
          }
        >
          <option value="">
            {label(language, "ทุกภาคเรียน", "All semesters")}
          </option>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
        </select>
        <select
          className="course-input course-grade-filter-status"
          value={filters.status}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              status: event.target.value,
            }))
          }
        >
          <option value="recorded">
            {label(language, "มีข้อมูล", "Has data")}
          </option>
          <option value="missing">
            {label(language, "ไม่มีข้อมูลเลย", "No data at all")}
          </option>
        </select>
        <button
          className="course-icon-btn"
          onClick={loadOverview}
          disabled={loading}
          title={label(language, "โหลดใหม่", "Refresh")}
        >
          <RefreshCw size={16} className={loading ? "student-spin" : ""} />
        </button>
      </div>
      <div className="course-grade-view-tabs">
        <button
          className={view === "courses" ? "is-active" : ""}
          onClick={() => setView("courses")}
        >
          <BookOpen size={16} />
          {label(language, "มุมมองรายวิชา", "By course")}
        </button>
        <button
          className={view === "students" ? "is-active" : ""}
          onClick={() => setView("students")}
        >
          <Users size={16} />
          {label(language, "มุมมองรายผู้เรียน", "By student")}
        </button>
      </div>
      <div className="student-table-wrap course-grade-table-wrap">
        <table className="student-table course-grade-table">
          <thead>
            <tr>
              {view === "courses" ? (
                <>
                  <th>{label(language, "รายวิชา", "Course")}</th>
                  <th>{label(language, "ประเภทวิชา", "Type")}</th>
                  <th>{label(language, "จำนวนผู้เรียน", "Students")}</th>
                  <th>{label(language, "บันทึกเกรดแล้ว", "Recorded")}</th>
                  <th aria-label="Actions" />
                </>
              ) : (
                <>
                  <th>{label(language, "ผู้เรียน", "Student")}</th>
                  <th>
                    {label(language, "วิชาในช่วงที่เลือก", "Courses in period")}
                  </th>
                  <th>{label(language, "บันทึกแล้ว", "Recorded")}</th>
                  <th>{label(language, "สถานะข้อมูล", "Data status")}</th>
                  <th aria-label="Actions" />
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="student-empty">
                  {label(
                    language,
                    "กำลังโหลดผลการเรียน...",
                    "Loading grades...",
                  )}
                </td>
              </tr>
            ) : view === "courses" ? (
              courses.length ? (
                courses.map((course) => (
                  <tr key={course.courseId}>
                    <td>
                      <div className="student-cohort-cell">
                        <strong>{course.courseCode}</strong>
                        <span>{courseName(course, language)}</span>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`course-grade-type course-grade-type--${course.courseType}`}
                      >
                        {course.courseType === "core"
                          ? label(language, "วิชาบังคับ", "Core")
                          : label(language, "วิชาเลือก", "Elective")}
                      </span>
                    </td>
                    <td>{course.totalStudents}</td>
                    <td>
                      {course.recordedStudents} / {course.totalStudents}
                    </td>
                    <td>
                      <button
                        className="course-btn course-btn--ghost course-grade-edit-btn"
                        onClick={() => openCourseEditor(course)}
                        disabled={readOnly || editorLoading}
                      >
                        <Edit3 size={15} />
                        {label(language, "แก้เกรด", "Edit grades")}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="student-empty">
                    {label(
                      language,
                      "ไม่พบรายวิชาในตัวกรองนี้",
                      "No courses match the filters.",
                    )}
                  </td>
                </tr>
              )
            ) : students.length ? (
              students.map((student) => (
                <tr key={student.enrollmentId}>
                  <td>
                    <div className="student-cohort-cell">
                      <strong>{student.studentCode}</strong>
                      <span>{student.studentNameTh}</span>
                    </div>
                  </td>
                  <td>{student.recordedCourses || 0}</td>
                  <td>{student.recordedCourses || "-"}</td>
                  <td>
                    {student.recordedCourses ? (
                      <div className="course-grade-progress">
                        <span
                          style={{
                            width: `${student.totalCourses ? Math.min(100, (student.recordedCourses / student.totalCourses) * 100) : 0}%`,
                          }}
                        />
                      </div>
                    ) : (
                      <span className="course-grade-no-period">
                        {label(
                          language,
                          "ไม่มีผลการเรียนในช่วงนี้",
                          "No grades in this period",
                        )}
                      </span>
                    )}
                  </td>
                  <td>
                    <button
                      className="course-btn course-btn--ghost course-grade-edit-btn"
                      onClick={() => openStudentEditor(student)}
                      disabled={readOnly || editorLoading}
                    >
                      <Edit3 size={15} />
                      {label(language, "ดู/แก้ไข", "View/edit")}
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="student-empty">
                  {label(
                    language,
                    "ยังไม่มีผู้เรียนในรุ่นนี้",
                    "No students in this cohort.",
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <GradeEditorModal
        language={language}
        editor={editor}
        rows={editorLoading ? [] : editorRows}
        setRows={setEditorRows}
        submitting={submitting || editorLoading}
        readOnly={readOnly}
        editableRowKeys={editableRowKeys}
        savingRowKeys={savingRowKeys}
        studentOptions={students}
        courseOptions={editorCourseOptions}
        focusRowKey={focusRowKey}
        onDirty={markRowDirty}
        onEditRow={markRowEditable}
        onCancelRow={cancelRow}
        onSaveRow={saveRow}
        onDeleteRow={deleteRow}
        onAddRetake={addRetakeRow}
        onClose={() => {
          if (submitting || savingRowKeys.size > 0) return;
          setEditor(null);
          resetEditorChanges();
        }}
      />
      <GradeImportModal
        language={language}
        open={importOpen}
        cohortId={cohortId}
        submitting={submitting}
        onClose={() => !submitting && setImportOpen(false)}
        onError={(error) =>
          notify(onFeedback, "error", gradeError(error, language))
        }
        onSuccess={async () => {
          setImportOpen(false);
          await loadOverview();
          notify(
            onFeedback,
            "success",
            label(
              language,
              "นำเข้าผลการเรียนแล้ว ต้องคำนวณคะแนนใหม่เพื่ออัปเดต Dashboard",
              "Grades imported. Recalculate to update the dashboard.",
            ),
          );
        }}
      />
      <BaseModal
        open={regOpen}
        title={label(
          language,
          "ดึงผลการเรียนจาก REG",
          "Import grades from REG",
        )}
        size="sm"
        onClose={() => setRegOpen(false)}
        footer={
          <button
            className="course-btn course-btn--ghost"
            onClick={() => setRegOpen(false)}
          >
            {label(language, "ปิด", "Close")}
          </button>
        }
      >
        <div className="course-grade-reg-placeholder">
          <Database size={28} />
          <strong>
            {label(
              language,
              "ยังไม่ได้ตั้งค่าการเชื่อมต่อ REG",
              "REG integration is not configured",
            )}
          </strong>
          <p>
            {label(
              language,
              "ใน v1 กรุณาใช้การกรอกเกรดหรือ Import Excel ก่อน เมื่อเชื่อมต่อ REG แล้วระบบจะแสดง Preview ก่อนแทนที่ข้อมูลเดิม",
              "For v1, use manual entry or Excel import. A future REG connector will show a preview before replacing existing data.",
            )}
          </p>
        </div>
      </BaseModal>
    </section>
  );
}
