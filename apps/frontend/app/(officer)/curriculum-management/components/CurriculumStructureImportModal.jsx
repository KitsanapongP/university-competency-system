"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Download,
  FileSpreadsheet,
  FolderTree,
  Upload,
} from "lucide-react";
import BaseModal from "../../../../components/ui/BaseModal";
import {
  buildCurriculumStructureImportTree,
  downloadCurriculumStructureTemplate,
  parseCurriculumStructureWorkbook,
  previewDraftCurriculumStructureImport,
} from "../../../../lib/curriculum-structure-import";
import "./CurriculumStructureImportModal.css";

const copy = {
  th: {
    title: "นำเข้ารายวิชาจาก Excel",
    download: "ดาวน์โหลดไฟล์ตัวอย่าง",
    choose: "เลือกไฟล์ .xlsx",
    selected: "ไฟล์ที่เลือก",
    empty: "เลือกไฟล์ Excel เพื่อดูตัวอย่างข้อมูลก่อนนำเข้า",
    newCategories: "หมวดใหม่",
    existingCategories: "หมวดเดิม",
    courses: "รายวิชาที่จะเพิ่ม",
    skippedCourses: "รายวิชาที่ข้าม",
    structurePreview: "ตัวอย่างโครงสร้างที่จะนำเข้า",
    structurePreviewHint: "แสดงหมวดวิชาและรายวิชาจากไฟล์ก่อนบันทึกลงหลักสูตร",
    invalidStructurePreview: "ตัวอย่างโครงสร้างที่ตรวจพบปัญหา",
    invalidStructurePreviewHint: "รายการสีแดงต้องแก้ไขก่อนจึงจะนำเข้าข้อมูลได้",
    structureWarnings: "ปัญหาของโครงสร้าง",
    courseUnit: "วิชา",
    creditUnit: "หน่วยกิต",
    requiredCourse: "วิชาบังคับ",
    electiveCourse: "วิชาเลือก",
    issues: "รายการที่ต้องแก้ไข",
    warnings: "รายการที่จะไม่ถูกนำเข้า",
    warningHint: "รายวิชาที่มีรหัสซ้ำจะถูกข้าม และรายวิชาอื่นจะยังนำเข้าได้",
    nothingToImport:
      "ไม่มีรายวิชาใหม่ให้นำเข้า กรุณาแก้ไขรหัสวิชาที่ซ้ำหรือเลือกไฟล์อื่น",
    ready: "ข้อมูลพร้อมนำเข้า",
    cancel: "ยกเลิก",
    import: "นำเข้าข้อมูล",
    confirm: "ยืนยันการนำเข้า",
    impact: "ยืนยันการนำเข้ากับหลักสูตรที่มี Template เชื่อมอยู่",
    loading: "กำลังตรวจสอบ...",
    committing: "กำลังนำเข้า...",
  },
  en: {
    title: "Import courses from Excel",
    download: "Download template",
    choose: "Choose .xlsx file",
    selected: "Selected file",
    empty: "Choose an Excel file to preview the import.",
    newCategories: "New categories",
    existingCategories: "Existing categories",
    courses: "Courses to add",
    skippedCourses: "Skipped courses",
    structurePreview: "Import structure preview",
    structurePreviewHint:
      "Categories and courses from the file before they are added to the curriculum.",
    invalidStructurePreview: "Structure preview with issues",
    invalidStructurePreviewHint:
      "Items in red must be fixed before the data can be imported.",
    structureWarnings: "Structure issues",
    courseUnit: "courses",
    creditUnit: "credits",
    requiredCourse: "Required",
    electiveCourse: "Elective",
    issues: "Items to fix",
    warnings: "Items that will be skipped",
    warningHint:
      "Courses with duplicate codes will be skipped; other courses can still be imported.",
    nothingToImport:
      "There are no new courses to import. Update duplicate course codes or choose another file.",
    ready: "Ready to import",
    cancel: "Cancel",
    import: "Import data",
    confirm: "Confirm import",
    impact: "Confirm import for a curriculum with connected templates.",
    loading: "Checking...",
    committing: "Importing...",
  },
};

const importIssueMessages = {
  th: {
    "import file has no course rows": "ไฟล์นำเข้าไม่มีรายวิชา",
    "category levels must be continuous from level 1":
      "หมวดวิชาต้องระบุเรียงต่อเนื่องจากระดับ 1",
    "at least one category level is required":
      "ต้องระบุหมวดวิชาอย่างน้อย 1 ระดับ",
    "category nesting cannot exceed 4 levels":
      "หมวดวิชาซ้อนกันได้สูงสุด 4 ระดับ",
    "category code is required": "ต้องระบุรหัสหมวดวิชา",
    "category code must contain up to 4 numeric levels":
      "รหัสหมวดต้องเป็นตัวเลขคั่นด้วยจุด สูงสุด 4 ระดับ",
    "category name_th is required": "ต้องระบุชื่อหมวดวิชาภาษาไทย",
    "category code must extend its parent code":
      "รหัสหมวดย่อยต้องต่อจากรหัสหมวดแม่",
    "category code must match its category level":
      "รหัสหมวดต้องตรงกับระดับหมวดวิชา",
    "category code conflicts with another imported category":
      "รหัสหมวดขัดแย้งกับข้อมูลในไฟล์",
    "category code conflicts with the current curriculum structure":
      "รหัสหมวดขัดแย้งกับโครงสร้างหลักสูตรเดิม",
    "course code is required": "ต้องระบุรหัสวิชา",
    "course name_th is required": "ต้องระบุชื่อวิชาภาษาไทย",
    "course credits must be zero or greater":
      "หน่วยกิตต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป",
    "course type is required": "ต้องระบุประเภทวิชา",
    "course type must be required or elective":
      "ประเภทวิชาต้องเป็นวิชาบังคับหรือวิชาเลือก",
    "course code already exists in this curriculum":
      "รหัสวิชานี้มีอยู่แล้วในหลักสูตร",
    "courses can only be placed in leaf categories":
      "เพิ่มรายวิชาได้เฉพาะหมวดวิชาที่ย่อยที่สุด",
    "หมวดวิชาต้องระบุเรียงต่อเนื่องจากระดับ 1":
      "หมวดวิชาต้องระบุเรียงต่อเนื่องจากระดับ 1",
    "ต้องระบุหมวดวิชาอย่างน้อย 1 ระดับ": "ต้องระบุหมวดวิชาอย่างน้อย 1 ระดับ",
    "รหัสหมวดต้องเป็นตัวเลขคั่นด้วยจุด สูงสุด 4 ระดับ":
      "รหัสหมวดต้องเป็นตัวเลขคั่นด้วยจุด สูงสุด 4 ระดับ",
    ต้องระบุชื่อหมวดวิชาภาษาไทย: "ต้องระบุชื่อหมวดวิชาภาษาไทย",
    รหัสหมวดย่อยต้องต่อจากรหัสหมวดแม่: "รหัสหมวดย่อยต้องต่อจากรหัสหมวดแม่",
    รหัสหมวดต้องตรงกับระดับหมวดวิชา: "รหัสหมวดต้องตรงกับระดับหมวดวิชา",
    รหัสหมวดขัดแย้งกับข้อมูลในไฟล์: "รหัสหมวดขัดแย้งกับข้อมูลในไฟล์",
    รหัสหมวดขัดแย้งกับโครงสร้างหลักสูตรเดิม:
      "รหัสหมวดขัดแย้งกับโครงสร้างหลักสูตรเดิม",
    ต้องระบุรหัสวิชา: "ต้องระบุรหัสวิชา",
    ต้องระบุชื่อวิชาภาษาไทย: "ต้องระบุชื่อวิชาภาษาไทย",
    "หน่วยกิตต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป":
      "หน่วยกิตต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป",
    ประเภทวิชาต้องเป็นวิชาบังคับหรือวิชาเลือก:
      "ประเภทวิชาต้องเป็นวิชาบังคับหรือวิชาเลือก",
    รหัสวิชานี้มีอยู่แล้วในหลักสูตร: "รหัสวิชานี้มีอยู่แล้วในหลักสูตร",
    เพิ่มรายวิชาได้เฉพาะหมวดวิชาที่ย่อยที่สุด:
      "เพิ่มรายวิชาได้เฉพาะหมวดวิชาที่ย่อยที่สุด",
  },
  en: {
    "ไม่พบแผ่นงานในไฟล์ Excel": "No worksheet was found in the Excel file",
    "ไม่พบหัวตาราง:": "Missing headers:",
    ไฟล์นำเข้าไม่มีรายวิชา: "The import file has no course rows",
    "หมวดวิชาต้องระบุเรียงต่อเนื่องจากระดับ 1":
      "Category levels must be continuous from level 1",
    "ต้องระบุหมวดวิชาอย่างน้อย 1 ระดับ":
      "At least one category level is required",
    "รหัสหมวดต้องเป็นตัวเลขคั่นด้วยจุด สูงสุด 4 ระดับ":
      "Category code must contain up to 4 numeric levels",
    ต้องระบุชื่อหมวดวิชาภาษาไทย: "Category Thai name is required",
    รหัสหมวดย่อยต้องต่อจากรหัสหมวดแม่:
      "Category code must extend its parent code",
    รหัสหมวดต้องตรงกับระดับหมวดวิชา:
      "Category code must match its category level",
    รหัสหมวดขัดแย้งกับข้อมูลในไฟล์:
      "Category code conflicts with another imported category",
    รหัสหมวดขัดแย้งกับโครงสร้างหลักสูตรเดิม:
      "Category code conflicts with the current curriculum structure",
    ต้องระบุรหัสวิชา: "Course code is required",
    ต้องระบุชื่อวิชาภาษาไทย: "Course Thai name is required",
    "หน่วยกิตต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป":
      "Course credits must be a non-negative integer",
    "course type is required": "Course type is required",
    "course type must be required or elective":
      "Course type must be Required or Elective",
    ประเภทวิชาต้องเป็นวิชาบังคับหรือวิชาเลือก:
      "Course type must be Required or Elective",
    รหัสวิชานี้มีอยู่แล้วในหลักสูตร:
      "Course code already exists in this curriculum",
    เพิ่มรายวิชาได้เฉพาะหมวดวิชาที่ย่อยที่สุด:
      "Courses can only be placed in leaf categories",
  },
};

function localizeImportIssueMessage(message, language) {
  const value = String(message || "");
  const messages = importIssueMessages[language] || importIssueMessages.th;
  if (language === "en" && value.startsWith("ไม่พบหัวตาราง:")) {
    return `${messages["ไม่พบหัวตาราง:"]} ${value.slice("ไม่พบหัวตาราง:".length).trim()}`;
  }
  return messages[value] || value;
}

function issueLabel(issue, language) {
  const row = Number(issue?.row_number || 0);
  const prefix =
    row > 0
      ? language === "en"
        ? `Row ${row}`
        : `แถว ${row}`
      : language === "en"
        ? "File"
        : "ไฟล์";
  return `${prefix}: ${localizeImportIssueMessage(issue?.message, language)}`;
}

function countPreviewCourses(category) {
  return (
    (category.courses || []).length +
    (category.children || []).reduce(
      (total, child) => total + countPreviewCourses(child),
      0,
    )
  );
}

function sumPreviewCredits(category) {
  const directCredits = (category.courses || []).reduce(
    (total, course) => total + (Number(course.credits) || 0),
    0,
  );
  return (
    directCredits +
    (category.children || []).reduce(
      (total, child) => total + sumPreviewCredits(child),
      0,
    )
  );
}

function getPreviewIssues(issuesByRow, rowNumbers, fields) {
  const seen = new Set();
  return (rowNumbers || [])
    .flatMap((rowNumber) => issuesByRow.get(rowNumber) || [])
    .filter((issue) => fields.includes(issue.field))
    .filter((issue) => {
      const key = `${issue.field}-${issue.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function PreviewIssueList({ issues, language }) {
  if (issues.length === 0) return null;
  return (
    <ul className="curriculum-import-preview__issue-list">
      {issues.map((issue, index) => (
        <li
          key={`${issue.field}-${index}`}
          className={
            issue.severity === "warning"
              ? "curriculum-import-preview__issue--warning"
              : ""
          }
        >
          {localizeImportIssueMessage(issue.message, language)}
        </li>
      ))}
    </ul>
  );
}

function ImportPreviewNode({ category, depth, labels, issuesByRow, language }) {
  const courseCount = countPreviewCourses(category);
  const credits = sumPreviewCredits(category);
  const categoryIssues = getPreviewIssues(issuesByRow, category.rowNumbers, [
    "categories",
    `category_level_${depth + 1}`,
    `category_name_level_${depth + 1}`,
  ]);
  const categoryHasErrors = categoryIssues.some(
    (issue) => issue.severity !== "warning",
  );
  const categoryHasWarnings = categoryIssues.some(
    (issue) => issue.severity === "warning",
  );
  return (
    <li
      className="curriculum-import-preview__node"
      style={{ "--import-depth": depth }}
    >
      <div
        className={`curriculum-import-preview__category${categoryHasErrors ? " curriculum-import-preview__category--invalid" : ""}${!categoryHasErrors && categoryHasWarnings ? " curriculum-import-preview__category--warning" : ""}`}
      >
        <FolderTree size={15} aria-hidden="true" />
        <span className="curriculum-import-preview__category-name">
          {category.code && <strong>{category.code}</strong>}{" "}
          {category.nameTh || "-"}
        </span>
        <span className="curriculum-import-preview__category-meta">
          {courseCount} {labels.courseUnit} · {credits} {labels.creditUnit}
        </span>
        {categoryIssues.length > 0 && (
          <AlertTriangle
            size={14}
            className={`curriculum-import-preview__warning-icon${!categoryHasErrors && categoryHasWarnings ? " curriculum-import-preview__warning-icon--warning" : ""}`}
            aria-hidden="true"
          />
        )}
      </div>
      <PreviewIssueList issues={categoryIssues} language={language} />
      {category.children?.length > 0 && (
        <ul className="curriculum-import-preview__children">
          {category.children.map((child) => (
            <ImportPreviewNode
              key={`${child.code}-${child.nameTh}`}
              category={child}
              depth={depth + 1}
              labels={labels}
              issuesByRow={issuesByRow}
              language={language}
            />
          ))}
        </ul>
      )}
      {category.courses?.length > 0 && (
        <ul className="curriculum-import-preview__courses">
          {category.courses.map((course, index) => {
            const courseIssues = getPreviewIssues(
              issuesByRow,
              [course.rowNumber],
              ["course_code", "course_name_th", "credits", "course_type"],
            );
            const courseHasErrors = courseIssues.some(
              (issue) => issue.severity !== "warning",
            );
            const courseHasWarnings = courseIssues.some(
              (issue) => issue.severity === "warning",
            );
            return (
              <li
                key={`${course.code}-${index}`}
                className={`curriculum-import-preview__course${courseHasErrors ? " curriculum-import-preview__course--invalid" : ""}${!courseHasErrors && courseHasWarnings ? " curriculum-import-preview__course--warning" : ""}`}
              >
                <BookOpen size={13} aria-hidden="true" />
                <strong>{course.code || "-"}</strong>
                <span>{course.nameTh || "-"}</span>
                <span
                  className={`curriculum-import-preview__course-type${course.isRequired ? " curriculum-import-preview__course-type--required" : " curriculum-import-preview__course-type--elective"}`}
                >
                  {course.isRequired
                    ? labels.requiredCourse
                    : labels.electiveCourse}
                </span>
                <span>
                  {course.credits} {labels.creditUnit}
                </span>
                {courseIssues.length > 0 && (
                  <AlertTriangle
                    size={14}
                    className={`curriculum-import-preview__warning-icon${!courseHasErrors && courseHasWarnings ? " curriculum-import-preview__warning-icon--warning" : ""}`}
                    aria-hidden="true"
                  />
                )}
                <PreviewIssueList issues={courseIssues} language={language} />
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

export default function CurriculumStructureImportModal({
  open,
  onClose,
  mode = "draft",
  curriculumId,
  categories = [],
  coursesByCategory = {},
  language = "th",
  disabled = false,
  onPreview,
  onImport,
}) {
  const labels = copy[language] || copy.th;
  const inputRef = useRef(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState([]);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmImpact, setConfirmImpact] = useState(false);
  const importTree = useMemo(
    () => buildCurriculumStructureImportTree(rows),
    [rows],
  );
  const issues = preview?.issues || [];
  const blockingIssues = issues.filter((issue) => issue.severity !== "warning");
  const warningIssues = issues.filter((issue) => issue.severity === "warning");
  const issuesByRow = useMemo(() => {
    const next = new Map();
    issues.forEach((issue) => {
      const rowNumber = Number(issue?.row_number || 0);
      if (rowNumber <= 0) return;
      const rowIssues = next.get(rowNumber) || [];
      rowIssues.push(issue);
      next.set(rowNumber, rowIssues);
    });
    return next;
  }, [issues]);
  const globalIssues = useMemo(
    () => issues.filter((issue) => Number(issue?.row_number || 0) <= 0),
    [issues],
  );

  const reset = () => {
    setFileName("");
    setRows([]);
    setPreview(null);
    setLoading(false);
    setCommitting(false);
    setError("");
    setConfirmImpact(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const close = () => {
    if (loading || committing) return;
    reset();
    onClose?.();
  };

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setError(
        language === "en"
          ? "Please choose an .xlsx file."
          : "กรุณาเลือกไฟล์ .xlsx",
      );
      return;
    }

    setLoading(true);
    setError("");
    setPreview(null);
    setConfirmImpact(false);
    try {
      const parsed = await parseCurriculumStructureWorkbook(file);
      setFileName(file.name);
      setRows(parsed.rows);
      if (mode === "draft") {
        setPreview(
          previewDraftCurriculumStructureImport(
            categories,
            coursesByCategory,
            parsed.rows,
            parsed.issues,
          ),
        );
      } else if (parsed.issues.length > 0) {
        setPreview({
          valid: false,
          can_import: false,
          issues: parsed.issues,
          new_category_count: 0,
          existing_category_count: 0,
          course_count: 0,
          skipped_course_count: 0,
        });
      } else {
        const nextPreview = await onPreview?.(curriculumId, parsed.rows);
        setPreview(nextPreview || null);
      }
    } catch (nextError) {
      setError(
        nextError?.message ||
          (language === "en"
            ? "Unable to read the Excel file."
            : "ไม่สามารถอ่านไฟล์ Excel ได้"),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!preview?.can_import || committing || disabled) return;
    setCommitting(true);
    setError("");
    try {
      await onImport?.(rows, confirmImpact);
      close();
    } catch (nextError) {
      if (nextError?.code === "CONFIRMATION_REQUIRED" && !confirmImpact) {
        setConfirmImpact(true);
      } else {
        setError(
          nextError?.message ||
            (language === "en"
              ? "Unable to import the structure."
              : "ไม่สามารถนำเข้าข้อมูลได้"),
        );
      }
    } finally {
      setCommitting(false);
    }
  };

  return (
    <BaseModal
      open={open}
      title={labels.title}
      size="lg"
      onClose={close}
      closeDisabled={loading || committing}
      footer={
        <>
          <button
            type="button"
            className="course-btn course-btn--ghost"
            onClick={close}
            disabled={loading || committing}
          >
            {labels.cancel}
          </button>
          <button
            type="button"
            className="course-btn course-btn--primary"
            onClick={handleImport}
            disabled={!preview?.can_import || disabled || loading || committing}
          >
            <Upload size={15} />{" "}
            {committing
              ? labels.committing
              : confirmImpact
                ? labels.confirm
                : labels.import}
          </button>
        </>
      }
    >
      <div className="curriculum-import-modal">
        <div className="curriculum-import-modal__intro">
          <p>
            {language === "en"
              ? "Import adds new categories and courses only. Existing curriculum data is never changed."
              : "การนำเข้าจะเพิ่มเฉพาะหมวดและรายวิชาใหม่ โดยจะไม่แก้ไขหรือลบข้อมูลเดิม"}
          </p>
          <button
            type="button"
            className="course-btn course-btn--ghost course-btn--sm"
            onClick={() => downloadCurriculumStructureTemplate()}
          >
            <Download size={14} /> {labels.download}
          </button>
        </div>

        <input
          ref={inputRef}
          className="curriculum-import-modal__file-input"
          type="file"
          accept=".xlsx"
          onChange={handleFile}
        />
        <button
          type="button"
          className="curriculum-import-modal__file-picker"
          onClick={() => inputRef.current?.click()}
          disabled={loading || committing || disabled}
        >
          <FileSpreadsheet size={24} />
          <span>{loading ? labels.loading : labels.choose}</span>
          {fileName && (
            <small>
              {labels.selected}: {fileName}
            </small>
          )}
        </button>

        {!preview && !error && (
          <p className="curriculum-import-modal__empty">{labels.empty}</p>
        )}
        {error && <p className="curriculum-import-modal__error">{error}</p>}

        {preview && (
          <>
            <div className="curriculum-import-modal__summary">
              <div>
                <span>{labels.newCategories}</span>
                <strong>{preview.new_category_count || 0}</strong>
              </div>
              <div>
                <span>{labels.existingCategories}</span>
                <strong>{preview.existing_category_count || 0}</strong>
              </div>
              <div>
                <span>{labels.courses}</span>
                <strong>{preview.course_count || 0}</strong>
              </div>
              <div>
                <span>{labels.skippedCourses}</span>
                <strong>{preview.skipped_course_count || 0}</strong>
              </div>
            </div>
            {blockingIssues.length > 0 && (
              <div className="curriculum-import-modal__issues">
                <strong>{labels.issues}</strong>
                <ul>
                  {blockingIssues.map((entry, index) => (
                    <li key={`${entry.row_number}-${entry.field}-${index}`}>
                      {issueLabel(entry, language)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {warningIssues.length > 0 && (
              <div className="curriculum-import-modal__warnings">
                <strong>{labels.warnings}</strong>
                <p>{labels.warningHint}</p>
                <ul>
                  {warningIssues.map((entry, index) => (
                    <li key={`${entry.row_number}-${entry.field}-${index}`}>
                      {issueLabel(entry, language)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {importTree.length > 0 && (
              <section
                className={`curriculum-import-preview${preview.valid ? "" : " curriculum-import-preview--invalid"}`}
                aria-label={labels.structurePreview}
              >
                <div className="curriculum-import-preview__heading">
                  <strong>
                    {preview.valid
                      ? labels.structurePreview
                      : labels.invalidStructurePreview}
                  </strong>
                  <p>
                    {preview.valid
                      ? labels.structurePreviewHint
                      : labels.invalidStructurePreviewHint}
                  </p>
                </div>
                {globalIssues.length > 0 && (
                  <div className="curriculum-import-preview__global-issues">
                    <AlertTriangle size={15} aria-hidden="true" />
                    <div>
                      <strong>{labels.structureWarnings}</strong>
                      <PreviewIssueList
                        issues={globalIssues}
                        language={language}
                      />
                    </div>
                  </div>
                )}
                <ul className="curriculum-import-preview__tree">
                  {importTree.map((category) => (
                    <ImportPreviewNode
                      key={`${category.code}-${category.nameTh}`}
                      category={category}
                      depth={0}
                      labels={labels}
                      issuesByRow={issuesByRow}
                      language={language}
                    />
                  ))}
                </ul>
              </section>
            )}
            {preview.valid && preview.can_import ? (
              <p className="curriculum-import-modal__ready">{labels.ready}</p>
            ) : null}
            {preview.valid && !preview.can_import ? (
              <p className="curriculum-import-modal__warning-text">
                {labels.nothingToImport}
              </p>
            ) : null}
            {confirmImpact && (
              <p className="curriculum-import-modal__impact">{labels.impact}</p>
            )}
          </>
        )}
      </div>
    </BaseModal>
  );
}
