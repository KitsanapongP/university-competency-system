'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Database, Edit3, FileSpreadsheet, RefreshCw, Save, Search, Upload, Users } from 'lucide-react';
import BaseModal from '../../../../components/ui/BaseModal';
import ConfirmActionModal from '../../../../components/ui/ConfirmActionModal';
import {
    commitCourseGradeImport,
    downloadCourseGradeImportTemplate,
    fetchCourseGradeOverview,
    fetchStudentCourseGrades,
    parseCourseGradeImportFile,
    previewCourseGradeImport,
    saveCourseGrades,
} from '../../../../lib/course-grades';

const GRADE_OPTIONS = ['', 'A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F', 'S', 'U', 'W', 'I'];

function label(language, th, en) { return language === 'en' ? en : th; }
function courseName(course, language) { return language === 'en' ? (course.courseNameEn || course.courseNameTh) : course.courseNameTh; }
function sourceLabel(source, language) {
    const labels = {
        manual: ['กรอกเอง', 'Manual'],
        excel: ['Excel', 'Excel'],
        reg: ['REG', 'REG'],
    };
    return labels[source] ? label(language, ...labels[source]) : source || label(language, 'ไม่ระบุ', 'Unknown');
}
function gradeError(error, language) {
    const message = error?.message || error?.payload?.error?.message || '';
    const messages = {
        'archived cohort is read-only': ['รุ่นที่เก็บเข้าคลังแล้วไม่สามารถแก้ไขผลการเรียนได้', 'An archived cohort is read-only.'],
        'grade import contains invalid rows': ['ไฟล์เกรดมีข้อมูลที่ต้องแก้ไข', 'The grade import contains invalid rows.'],
        'course scores can only be calculated for an active cohort': ['คำนวณคะแนนได้เฉพาะรุ่นที่ใช้งานอยู่', 'Scores can only be recalculated for an active cohort.'],
    };
    return messages[message] ? label(language, ...messages[message]) : message || label(language, 'ไม่สามารถดำเนินการกับผลการเรียนได้', 'Unable to complete the grade operation.');
}

function GradeEditorModal({ language, editor, rows, setRows, submitting, readOnly, onClose, onSave }) {
    const title = editor?.mode === 'course'
        ? label(language, `แก้เกรดวิชา ${editor.course?.courseCode || ''}`, `Edit grades for ${editor.course?.courseCode || ''}`)
        : label(language, `แก้ผลการเรียนของ ${editor?.student?.studentCode || ''}`, `Edit grades for ${editor?.student?.studentCode || ''}`);
    return <BaseModal open={Boolean(editor)} title={title} size="xl" onClose={onClose} closeDisabled={submitting} footer={<><button className="course-btn course-btn--ghost" onClick={onClose} disabled={submitting}>{label(language, 'ยกเลิก', 'Cancel')}</button><button className="course-btn course-btn--primary" onClick={onSave} disabled={submitting || readOnly || !rows.some(row => String(row.grade || '').trim())}><Save size={16} />{label(language, 'บันทึกผลการเรียน', 'Save grades')}</button></>}>
        <div className="course-grade-editor-note">{label(language, 'เกรดที่บันทึกจะทำให้สถานะต้องคำนวณคะแนนใหม่ ระบบจะเลือกเกรดที่ดีที่สุดให้อัตโนมัติ', 'Saving grades marks the cohort for recalculation. The system selects the best grade automatically.')}</div>
        <div className="student-table-wrap course-grade-modal-table"><table className="student-table"><thead><tr><th>{label(language, 'ผู้เรียน', 'Student')}</th><th>{label(language, 'รายวิชา', 'Course')}</th><th>{label(language, 'ปีการศึกษา', 'Academic year')}</th><th>{label(language, 'ภาคเรียน', 'Semester')}</th><th>{label(language, 'เกรด', 'Grade')}</th><th>{label(language, 'แหล่งข้อมูล', 'Source')}</th><th>{label(language, 'เกรดที่ดีที่สุด', 'Best')}</th></tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={`${row.enrollmentId}-${row.courseId}-${index}`}><td><div className="student-cohort-cell"><strong>{row.studentCode || editor?.student?.studentCode}</strong><span>{row.studentNameTh || editor?.student?.studentNameTh || '-'}</span></div></td><td><div className="student-cohort-cell"><strong>{row.courseCode}</strong><span>{courseName(row, language)}</span></div></td><td><input className="course-input course-grade-number" type="number" min="2000" value={row.academicYearBe || ''} disabled={readOnly || submitting} onChange={event => setRows(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, academicYearBe: event.target.value } : item))} /></td><td><select className="course-input course-grade-term" value={row.semester || ''} disabled={readOnly || submitting} onChange={event => setRows(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, semester: event.target.value } : item))}><option value="">-</option><option value="1">1</option><option value="2">2</option><option value="3">3</option></select></td><td><select className="course-input course-grade-value" value={row.grade || ''} disabled={readOnly || submitting} onChange={event => setRows(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, grade: event.target.value } : item))}>{GRADE_OPTIONS.map(grade => <option key={grade} value={grade}>{grade || label(language, 'ยังไม่บันทึก', 'Not recorded')}</option>)}</select></td><td><span className="course-grade-source">{sourceLabel(row.gradeSource || 'manual', language)}</span></td><td>{row.isBestGrade ? <span className="course-grade-best">{label(language, 'ใช่', 'Yes')}</span> : '-'}</td></tr>) : <tr><td colSpan={7} className="student-empty">{label(language, 'ไม่พบรายวิชาในหลักสูตรนี้', 'No curriculum courses found.')}</td></tr>}</tbody></table></div>
    </BaseModal>;
}

function GradeImportModal({ language, open, cohortId, submitting, onClose, onSuccess, onError }) {
    const [rows, setRows] = useState([]);
    const [preview, setPreview] = useState(null);
    const [parsing, setParsing] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const loadFile = async event => {
        const file = event.target.files?.[0];
        if (!file) return;
        setParsing(true); setPreview(null);
        try {
            const importedRows = await parseCourseGradeImportFile(file);
            const nextPreview = await previewCourseGradeImport(cohortId, importedRows);
            setRows(importedRows);
            setPreview(nextPreview);
        } catch (error) { onError(error); }
        finally { setParsing(false); }
    };
    const errors = preview?.errors || [];
    const conflicts = preview?.conflicts || [];
    const validRows = preview?.valid_rows || [];
    const canCommit = Boolean(preview) && errors.length === 0 && validRows.length > 0 && !parsing && !submitting;
    const toggleConflict = rowNumber => setRows(current => current.map(row => row.rowNumber === rowNumber ? { ...row, replace: !row.replace } : row));
    const commit = async () => {
        setConfirmOpen(false);
        try { await commitCourseGradeImport(cohortId, rows); onSuccess(); }
        catch (error) { onError(error); }
    };
    if (!open) return null;
    return <>
        <BaseModal open title={label(language, 'นำเข้าผลการเรียนจาก Excel', 'Import course grades from Excel')} size="xl" onClose={onClose} closeDisabled={parsing || submitting || confirmOpen} footer={<><button className="course-btn course-btn--ghost" onClick={onClose} disabled={parsing || submitting || confirmOpen}>{label(language, 'ยกเลิก', 'Cancel')}</button><button className="course-btn course-btn--primary" onClick={() => setConfirmOpen(true)} disabled={!canCommit}>{submitting ? label(language, 'กำลังนำเข้า...', 'Importing...') : label(language, 'ยืนยันนำเข้า', 'Commit import')}</button></>}>
        <div className="course-grade-import-toolbar"><label className="course-btn course-btn--primary course-grade-file-picker"><Upload size={16} />{parsing ? label(language, 'กำลังอ่านไฟล์...', 'Reading file...') : label(language, 'เลือกไฟล์ .xlsx', 'Choose .xlsx file')}<input type="file" accept=".xlsx" onChange={loadFile} disabled={parsing || submitting} /></label><button className="course-btn course-btn--ghost" onClick={downloadCourseGradeImportTemplate} disabled={parsing || submitting}><FileSpreadsheet size={16} />{label(language, 'ดาวน์โหลดไฟล์ตัวอย่าง', 'Download template')}</button><span>{label(language, 'ต้องมี รหัสนักศึกษา, รหัสวิชา, ปีการศึกษา, ภาคเรียน และเกรด', 'Required: student code, course code, academic year, semester, and grade.')}</span></div>
        {!preview && <div className="course-grade-import-empty">{label(language, 'เลือกไฟล์เพื่อดู Preview ก่อนบันทึก', 'Choose a file to preview before saving.')}</div>}
        {preview && <><div className="course-grade-import-summary"><strong>{validRows.length} {label(language, 'รายการที่ตรวจผ่าน', 'valid rows')}</strong><span>{conflicts.length} {label(language, 'รายการชนข้อมูลเดิม', 'conflicts')}</span><span className={errors.length ? 'course-grade-import-error-count' : ''}>{errors.length} {label(language, 'ข้อผิดพลาด', 'errors')}</span></div>{conflicts.length > 0 && <section className="course-grade-import-section"><strong>{label(language, 'เลือกแทนที่เกรดเดิม', 'Select conflicts to replace')}</strong><p>{label(language, 'รายการที่ไม่เลือกจะถูกข้าม และรายการใหม่จะยังนำเข้าได้ตามปกติ', 'Unselected conflicts are skipped; new rows are still imported.')}</p>{conflicts.map(conflict => <label className="course-grade-import-conflict" key={`${conflict.row_number}-${conflict.course_code}`}><input type="checkbox" checked={rows.find(row => row.rowNumber === conflict.row_number)?.replace || false} onChange={() => toggleConflict(conflict.row_number)} /><span>{label(language, 'แถว', 'Row')} {conflict.row_number} · {conflict.student_code} · {conflict.course_code}: {conflict.existing_grade} → {conflict.incoming_grade}</span></label>)}</section>}{errors.length > 0 && <section className="course-grade-import-section course-grade-import-section--error"><strong>{label(language, 'รายการที่ต้องแก้ไข', 'Rows that must be fixed')}</strong>{errors.map((issue, index) => <div key={`${issue.row_number}-${issue.course_code}-${index}`}>{issue.row_number ? `${label(language, 'แถว', 'Row')} ${issue.row_number} · ` : ''}{issue.student_code || ''}{issue.course_code ? ` · ${issue.course_code}` : ''} — {issue.message}</div>)}</section>}</>}
        </BaseModal>
        <ConfirmActionModal
            open={confirmOpen}
            title={label(language, 'ยืนยันการนำเข้าผลการเรียน', 'Confirm grade import')}
            message={label(language, 'ระบบจะบันทึกรายการใหม่ และแทนที่เฉพาะรายการเดิมที่คุณเลือกไว้', 'New rows will be saved, and only selected existing records will be replaced.')}
            impact={<div className="course-grade-import-confirm-impact"><span>{validRows.length} {label(language, 'รายการใหม่/รายการที่ผ่านการตรวจ', 'valid rows')}</span><span>{conflicts.filter(conflict => rows.find(row => row.rowNumber === conflict.row_number)?.replace).length} {label(language, 'รายการที่จะถูกแทนที่', 'selected replacements')}</span></div>}
            hint={label(language, 'หลังนำเข้า ระบบจะทำเครื่องหมายว่าต้องคำนวณคะแนนใหม่ แต่จะยังไม่เปลี่ยนคะแนนบน Dashboard จนกว่าจะกดคำนวณใหม่', 'The cohort will be marked for recalculation. Dashboard scores will not change until you explicitly recalculate.')}
            confirmLabel={label(language, 'นำเข้าข้อมูล', 'Import grades')}
            cancelLabel={label(language, 'กลับไปตรวจสอบ', 'Review again')}
            variant="info"
            loading={submitting}
            onConfirm={commit}
            onCancel={() => setConfirmOpen(false)}
        />
    </>;
}

export default function CourseGradeWorkspace({ language, cohort, cohortId, readOnly, submitting, reloadToken = 0, onFeedback, onRequestRecalculate }) {
    const [view, setView] = useState('courses');
    const [filters, setFilters] = useState({ search: '', academicYearBe: '', semester: '', status: '' });
    const [overview, setOverview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [editor, setEditor] = useState(null);
    const [editorRows, setEditorRows] = useState([]);
    const [editorLoading, setEditorLoading] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const [regOpen, setRegOpen] = useState(false);

    const loadOverview = useCallback(async () => {
        if (!cohortId) return;
        setLoading(true);
        try { setOverview(await fetchCourseGradeOverview(cohortId, filters)); }
        catch (error) { onFeedback?.('error', gradeError(error, language)); }
        finally { setLoading(false); }
    }, [cohortId, filters, language, onFeedback]);
    useEffect(() => { loadOverview(); }, [loadOverview, reloadToken]);

    const openCourseEditor = async course => {
        setEditor({ mode: 'course', course }); setEditorRows([]); setEditorLoading(true);
        try {
            const details = await Promise.all((overview?.students || []).map(student => fetchStudentCourseGrades(cohortId, student.enrollmentId, { ...filters, courseId: course.courseId })));
            const rows = details.map((detail, index) => {
                const existing = detail.grades.find(item => item.courseId === course.courseId);
                return existing || { enrollmentId: overview.students[index].enrollmentId, studentCode: overview.students[index].studentCode, studentNameTh: overview.students[index].studentNameTh, courseId: course.courseId, courseCode: course.courseCode, courseNameTh: course.courseNameTh, courseNameEn: course.courseNameEn, academicYearBe: filters.academicYearBe || cohort?.entryYearBe || '', semester: filters.semester || 1, grade: '', gradeSource: 'manual', isBestGrade: false };
            });
            setEditorRows(rows);
        } catch (error) { setEditor(null); onFeedback?.('error', gradeError(error, language)); }
        finally { setEditorLoading(false); }
    };

    const openStudentEditor = async student => {
        setEditor({ mode: 'student', student }); setEditorRows([]); setEditorLoading(true);
        try {
            const detail = await fetchStudentCourseGrades(cohortId, student.enrollmentId, filters);
            setEditorRows(detail.grades.map(row => ({ ...row, academicYearBe: row.academicYearBe || filters.academicYearBe || cohort?.entryYearBe || '', semester: row.semester || filters.semester || 1, studentCode: student.studentCode, studentNameTh: student.studentNameTh })));
        } catch (error) { setEditor(null); onFeedback?.('error', gradeError(error, language)); }
        finally { setEditorLoading(false); }
    };

    const saveEditor = async () => {
        const rows = editorRows.filter(row => String(row.grade || '').trim()).map(row => ({ ...row, rowNumber: 0 }));
        try {
            await saveCourseGrades(cohortId, rows);
            setEditor(null); await loadOverview();
            onFeedback?.('success', label(language, 'บันทึกผลการเรียนแล้ว ระบบจะคำนวณคะแนนเมื่อกดคำนวณใหม่', 'Grades saved. Recalculate scores when ready.'));
        } catch (error) { onFeedback?.('error', gradeError(error, language)); }
    };

    const statusText = overview?.courseScoresRecalculationRequired
        ? label(language, 'มีผลการเรียนที่รอคำนวณใหม่', 'Grades changed; recalculation required')
        : label(language, 'ข้อมูลคะแนนเป็นปัจจุบัน', 'Scores are up to date');
    const students = useMemo(() => overview?.students || [], [overview]);
    const courses = useMemo(() => overview?.courses || [], [overview]);
    const totalGradeSlots = courses.length * (overview?.totalStudents || 0);

    return <section className="student-management-panel course-grade-workspace">
        <div className="course-grade-workspace__header"><div><h2>{label(language, 'ผลการเรียน', 'Course grades')}</h2><p>{label(language, 'จัดการผลการเรียนของผู้เรียนในรุ่น และกดคำนวณคะแนนสมรรถนะใหม่เมื่อพร้อม', 'Manage cohort course grades and explicitly recalculate competency scores when ready.')}</p></div><div className="course-list-header__actions"><button className="course-btn course-btn--ghost" onClick={() => setRegOpen(true)} disabled={readOnly}><Database size={16} />{label(language, 'ดึงจาก REG', 'Import from REG')}</button><button className="course-btn course-btn--ghost" onClick={() => setImportOpen(true)} disabled={readOnly}><Upload size={16} />{label(language, 'นำเข้า Excel', 'Import Excel')}</button><button className="course-btn course-btn--primary" onClick={onRequestRecalculate} disabled={readOnly || submitting || !overview}><RefreshCw size={16} />{label(language, 'คำนวณใหม่', 'Recalculate')}</button></div></div>
        <div className={`course-grade-recalc-banner ${overview?.courseScoresRecalculationRequired ? 'is-stale' : 'is-current'}`}><span>{statusText}</span>{overview?.courseScoresRecalculatedAt && <small>{label(language, 'คำนวณล่าสุด', 'Last recalculated')}: {new Date(overview.courseScoresRecalculatedAt).toLocaleString(language === 'en' ? 'en-US' : 'th-TH')}</small>}</div>
        <div className="course-grade-summary"><div><span>{label(language, 'รายวิชา', 'Courses')}</span><strong>{overview?.totalCourses || 0}</strong></div><div><span>{label(language, 'ผู้เรียน', 'Students')}</span><strong>{overview?.totalStudents || 0}</strong></div><div><span>{label(language, 'รายการเกรด', 'Recorded grades')}</span><strong>{overview?.recordedGrades || 0}</strong></div><div><span>{label(language, 'ความครบถ้วน', 'Completeness')}</span><strong>{overview?.totalStudents ? `${overview?.recordedGrades || 0}/${totalGradeSlots}` : '0/0'}</strong></div></div>
        <div className="course-grade-toolbar"><div className="student-search"><Search size={16} /><input value={filters.search} onChange={event => setFilters(current => ({ ...current, search: event.target.value }))} placeholder={label(language, 'ค้นหารหัสวิชา หรือชื่อวิชา', 'Search course code or name')} /></div><input className="course-input course-grade-filter-year" type="number" placeholder={label(language, 'ปีการศึกษา', 'Academic year')} value={filters.academicYearBe} onChange={event => setFilters(current => ({ ...current, academicYearBe: event.target.value }))} /><select className="course-input course-grade-filter-term" value={filters.semester} onChange={event => setFilters(current => ({ ...current, semester: event.target.value }))}><option value="">{label(language, 'ทุกภาคเรียน', 'All semesters')}</option><option value="1">1</option><option value="2">2</option><option value="3">3</option></select><select className="course-input course-grade-filter-status" value={filters.status} onChange={event => setFilters(current => ({ ...current, status: event.target.value }))}><option value="">{label(language, 'ทุกสถานะ', 'All statuses')}</option><option value="recorded">{label(language, 'บันทึกแล้ว', 'Recorded')}</option><option value="missing">{label(language, 'ยังไม่บันทึก', 'Missing')}</option></select><button className="course-icon-btn" onClick={loadOverview} disabled={loading} title={label(language, 'โหลดใหม่', 'Refresh')}><RefreshCw size={16} className={loading ? 'student-spin' : ''} /></button></div>
        <div className="course-grade-view-tabs"><button className={view === 'courses' ? 'is-active' : ''} onClick={() => setView('courses')}><BookOpen size={16} />{label(language, 'มุมมองรายวิชา', 'By course')}</button><button className={view === 'students' ? 'is-active' : ''} onClick={() => setView('students')}><Users size={16} />{label(language, 'มุมมองรายผู้เรียน', 'By student')}</button></div>
        <div className="student-table-wrap course-grade-table-wrap"><table className="student-table course-grade-table"><thead><tr>{view === 'courses' ? <><th>{label(language, 'รายวิชา', 'Course')}</th><th>{label(language, 'ประเภทวิชา', 'Type')}</th><th>{label(language, 'จำนวนผู้เรียน', 'Students')}</th><th>{label(language, 'บันทึกเกรดแล้ว', 'Recorded')}</th><th aria-label="Actions" /></> : <><th>{label(language, 'ผู้เรียน', 'Student')}</th><th>{label(language, 'วิชาทั้งหมด', 'Total courses')}</th><th>{label(language, 'บันทึกแล้ว', 'Recorded')}</th><th>{label(language, 'ความครบถ้วน', 'Completeness')}</th><th aria-label="Actions" /></>}</tr></thead><tbody>{loading ? <tr><td colSpan={5} className="student-empty">{label(language, 'กำลังโหลดผลการเรียน...', 'Loading grades...')}</td></tr> : view === 'courses' ? courses.length ? courses.map(course => <tr key={course.courseId}><td><div className="student-cohort-cell"><strong>{course.courseCode}</strong><span>{courseName(course, language)}</span></div></td><td><span className={`course-grade-type course-grade-type--${course.courseType}`}>{course.courseType === 'core' ? label(language, 'วิชาบังคับ', 'Core') : label(language, 'วิชาเลือก', 'Elective')}</span></td><td>{course.totalStudents}</td><td>{course.recordedStudents} / {course.totalStudents}</td><td><button className="course-btn course-btn--ghost course-grade-edit-btn" onClick={() => openCourseEditor(course)} disabled={readOnly || editorLoading}><Edit3 size={15} />{label(language, 'แก้เกรด', 'Edit grades')}</button></td></tr>) : <tr><td colSpan={5} className="student-empty">{label(language, 'ไม่พบรายวิชาในตัวกรองนี้', 'No courses match the filters.')}</td></tr> : students.length ? students.map(student => <tr key={student.enrollmentId}><td><div className="student-cohort-cell"><strong>{student.studentCode}</strong><span>{student.studentNameTh}</span></div></td><td>{student.totalCourses}</td><td>{student.recordedCourses}</td><td><div className="course-grade-progress"><span style={{ width: `${student.totalCourses ? Math.min(100, (student.recordedCourses / student.totalCourses) * 100) : 0}%` }} /></div></td><td><button className="course-btn course-btn--ghost course-grade-edit-btn" onClick={() => openStudentEditor(student)} disabled={readOnly || editorLoading}><Edit3 size={15} />{label(language, 'ดู/แก้ไข', 'View/edit')}</button></td></tr>) : <tr><td colSpan={5} className="student-empty">{label(language, 'ยังไม่มีผู้เรียนในรุ่นนี้', 'No students in this cohort.')}</td></tr>}</tbody></table></div>
        <GradeEditorModal language={language} editor={editor} rows={editorLoading ? [] : editorRows} setRows={setEditorRows} submitting={submitting || editorLoading} readOnly={readOnly} onClose={() => !submitting && setEditor(null)} onSave={saveEditor} />
        <GradeImportModal language={language} open={importOpen} cohortId={cohortId} submitting={submitting} onClose={() => !submitting && setImportOpen(false)} onError={error => onFeedback?.('error', gradeError(error, language))} onSuccess={async () => { setImportOpen(false); await loadOverview(); onFeedback?.('success', label(language, 'นำเข้าผลการเรียนแล้ว ต้องคำนวณคะแนนใหม่เพื่ออัปเดต Dashboard', 'Grades imported. Recalculate to update the dashboard.')); }} />
        <BaseModal open={regOpen} title={label(language, 'ดึงผลการเรียนจาก REG', 'Import grades from REG')} size="sm" onClose={() => setRegOpen(false)} footer={<button className="course-btn course-btn--ghost" onClick={() => setRegOpen(false)}>{label(language, 'ปิด', 'Close')}</button>}><div className="course-grade-reg-placeholder"><Database size={28} /><strong>{label(language, 'ยังไม่ได้ตั้งค่าการเชื่อมต่อ REG', 'REG integration is not configured')}</strong><p>{label(language, 'ใน v1 กรุณาใช้การกรอกเกรดหรือ Import Excel ก่อน เมื่อเชื่อมต่อ REG แล้วระบบจะแสดง Preview ก่อนแทนที่ข้อมูลเดิม', 'For v1, use manual entry or Excel import. A future REG connector will show a preview before replacing existing data.')}</p></div></BaseModal>
    </section>;
}
