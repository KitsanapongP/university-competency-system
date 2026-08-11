'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Edit3, FileSpreadsheet, Plus, RefreshCw, Search, Trash2, Upload, Users } from 'lucide-react';
import { useLanguage } from '../../../../providers/LanguageContext';
import {
    addCohortStudent,
    commitCohortImport,
    fetchCohortStudents,
    fetchStudentCohort,
    previewCohortImport,
    removeCohortStudent,
    updateCohortStudent,
} from '../../../../lib/student-management';
import { downloadStudentImportTemplate, parseStudentImportFile } from '../../../../lib/student-import';
import BaseModal from '../../../../components/ui/BaseModal';
import ConfirmActionModal from '../../../../components/ui/ConfirmActionModal';
import ToastNotifications from '../../../../components/ui/ToastNotifications';
import '../../curriculum-management/CourseLayout.css';
import '../../curriculum-management/CourseList.css';
import '../StudentManagement.css';
import './CohortRoster.css';

const EMPTY_STUDENT = {
    studentCode: '', prefixTh: '', firstNameTh: '', lastNameTh: '', firstNameEn: '', lastNameEn: '', email: '', phone: '', enrollmentStatus: 'student',
};
const STATUS_OPTIONS = ['student', 'suspended', 'alumni', 'inactive'];

function label(language, th, en) { return language === 'en' ? en : th; }
function personName(student) { return `${student.prefixTh ? `${student.prefixTh} ` : ''}${student.firstNameTh} ${student.lastNameTh}`.trim(); }

function rosterError(error, language) {
    const message = error?.message || error?.payload?.error?.message || '';
    const messages = {
        'student code already exists': ['มีรหัสนักศึกษานี้ในระบบแล้ว', 'Student code already exists.'],
        'student code cannot be changed': ['ไม่สามารถแก้ไขรหัสนักศึกษาได้', 'Student code cannot be changed.'],
        'student_code, first_name_th, and last_name_th are required': ['กรุณากรอกรหัสนักศึกษา ชื่อ และนามสกุลภาษาไทย', 'Student code and Thai name are required.'],
        'student cannot be removed after academic, attendance, or score usage exists': ['ถอดรายชื่อนี้ไม่ได้ เพราะมีข้อมูลเรียน เข้าร่วมกิจกรรม หรือคะแนนแล้ว', 'This student has academic, attendance, or score usage.'],
        'archived cohort is read-only': ['รุ่นที่เก็บเข้าคลังแล้วไม่สามารถแก้ไขได้', 'An archived cohort is read-only.'],
        'import contains invalid or conflicting rows': ['ไฟล์มีข้อมูลไม่ถูกต้องหรือชนกับข้อมูลเดิม', 'The import contains invalid or conflicting rows.'],
        'student cohort operation failed': ['ไม่สามารถดำเนินการกับข้อมูลนักศึกษาได้', 'Unable to complete the student operation.'],
    };
    return messages[message] ? label(language, ...messages[message]) : message || label(language, 'ไม่สามารถดำเนินการได้', 'Unable to complete the operation.');
}

function StudentFormModal({ language, form, setForm, mode, submitting, readOnly, onClose, onSubmit }) {
    const canSave = form.studentCode.trim() && form.firstNameTh.trim() && form.lastNameTh.trim() && !submitting && !readOnly;
    return <BaseModal open title={mode === 'edit' ? label(language, 'แก้ไขข้อมูลนักศึกษา', 'Edit student') : label(language, 'เพิ่มนักศึกษา', 'Add student')} size="lg" onClose={onClose} closeDisabled={submitting} footer={<><button className="course-btn course-btn--ghost" onClick={onClose} disabled={submitting}>{label(language, 'ยกเลิก', 'Cancel')}</button><button className="course-btn course-btn--primary" onClick={onSubmit} disabled={!canSave}>{label(language, 'บันทึก', 'Save')}</button></>}>
        <div className="course-row">
            <label className="course-field"><span className="course-label">{label(language, 'รหัสนักศึกษา', 'Student code')}<span className="course-required">*</span></span><input className="course-input" value={form.studentCode} disabled={mode === 'edit'} onChange={event => setForm(prev => ({ ...prev, studentCode: event.target.value }))} /></label>
            <label className="course-field"><span className="course-label">{label(language, 'สถานะ', 'Status')}</span><select className="course-input" value={form.enrollmentStatus} onChange={event => setForm(prev => ({ ...prev, enrollmentStatus: event.target.value }))}>{STATUS_OPTIONS.map(status => <option key={status} value={status}>{status}</option>)}</select></label>
        </div>
        <div className="course-row">
            <label className="course-field"><span className="course-label">{label(language, 'คำนำหน้า', 'Prefix')}</span><input className="course-input" value={form.prefixTh} onChange={event => setForm(prev => ({ ...prev, prefixTh: event.target.value }))} /></label>
            <label className="course-field"><span className="course-label">{label(language, 'ชื่อ (ภาษาไทย)', 'First name (Thai)')}<span className="course-required">*</span></span><input className="course-input" value={form.firstNameTh} onChange={event => setForm(prev => ({ ...prev, firstNameTh: event.target.value }))} /></label>
            <label className="course-field"><span className="course-label">{label(language, 'นามสกุล (ภาษาไทย)', 'Last name (Thai)')}<span className="course-required">*</span></span><input className="course-input" value={form.lastNameTh} onChange={event => setForm(prev => ({ ...prev, lastNameTh: event.target.value }))} /></label>
        </div>
        <div className="course-row">
            <label className="course-field"><span className="course-label">{label(language, 'ชื่อ (ภาษาอังกฤษ)', 'First name (English)')}</span><input className="course-input" value={form.firstNameEn} onChange={event => setForm(prev => ({ ...prev, firstNameEn: event.target.value }))} /></label>
            <label className="course-field"><span className="course-label">{label(language, 'นามสกุล (ภาษาอังกฤษ)', 'Last name (English)')}</span><input className="course-input" value={form.lastNameEn} onChange={event => setForm(prev => ({ ...prev, lastNameEn: event.target.value }))} /></label>
        </div>
        <div className="course-row">
            <label className="course-field"><span className="course-label">Email</span><input className="course-input" type="email" value={form.email} onChange={event => setForm(prev => ({ ...prev, email: event.target.value }))} /></label>
            <label className="course-field"><span className="course-label">{label(language, 'โทรศัพท์', 'Phone')}</span><input className="course-input" value={form.phone} onChange={event => setForm(prev => ({ ...prev, phone: event.target.value }))} /></label>
        </div>
    </BaseModal>;
}

function ImportModal({ language, cohortId, submitting, onClose, onSuccess, onError }) {
    const [rows, setRows] = useState([]);
    const [preview, setPreview] = useState(null);
    const [parsing, setParsing] = useState(false);

    const loadFile = async event => {
        const file = event.target.files?.[0];
        if (!file) return;
        setParsing(true); setPreview(null);
        try {
            const importedRows = await parseStudentImportFile(file);
            const nextPreview = await previewCohortImport(cohortId, importedRows);
            const candidateCodes = new Set((nextPreview.update_candidates || []).map(item => item.student_code));
            setRows(importedRows.map(row => ({ ...row, applyUpdate: candidateCodes.has(row.studentCode) ? false : row.applyUpdate })));
            setPreview(nextPreview);
        } catch (error) { onError(error); }
        finally { setParsing(false); }
    };

    const updateCandidates = preview?.update_candidates || [];
    const errors = preview?.errors || [];
    const skipped = preview?.skipped_rows || [];
    const validRows = preview?.valid_rows || [];
    const canCommit = preview && errors.length === 0 && validRows.length > 0 && !submitting && !parsing;

    const commit = async () => {
        try {
            await commitCohortImport(cohortId, rows);
            onSuccess();
        } catch (error) { onError(error); }
    };

    return <BaseModal open title={label(language, 'นำเข้ารายชื่อนักศึกษา', 'Import student roster')} size="xl" onClose={onClose} closeDisabled={submitting || parsing} footer={<><button className="course-btn course-btn--ghost" onClick={onClose} disabled={submitting || parsing}>{label(language, 'ยกเลิก', 'Cancel')}</button><button className="course-btn course-btn--primary" onClick={commit} disabled={!canCommit}>{submitting ? label(language, 'กำลังนำเข้า...', 'Importing...') : label(language, 'ยืนยันนำเข้า', 'Commit import')}</button></>}>
        <div className="student-import-toolbar">
            <label className="course-btn course-btn--primary student-file-picker"><Upload size={16} />{parsing ? label(language, 'กำลังอ่านไฟล์...', 'Reading file...') : label(language, 'เลือกไฟล์ CSV/XLSX', 'Choose CSV/XLSX')}<input type="file" accept=".csv,.xlsx,.xls" onChange={loadFile} disabled={parsing || submitting} /></label>
            <button className="course-btn course-btn--ghost" onClick={downloadStudentImportTemplate} disabled={parsing || submitting}><FileSpreadsheet size={16} />{label(language, 'ดาวน์โหลดไฟล์ตัวอย่าง', 'Download template')}</button>
            <span>{label(language, 'สูงสุด 5 MB, 1,000 แถว, อ่านจาก Sheet 1', 'Maximum 5 MB, 1,000 rows, reads Sheet 1.')}</span>
        </div>
        {!preview && <div className="student-import-empty">{label(language, 'เลือกไฟล์เพื่อดูผลการตรวจสอบก่อนบันทึก', 'Choose a file to validate before saving.')}</div>}
        {preview && <>
            <div className="student-import-summary"><strong>{validRows.length} {label(language, 'พร้อมนำเข้า', 'ready')}</strong><span>{updateCandidates.length} {label(language, 'รายการต้องยืนยันการอัปเดต', 'update candidates')}</span><span>{skipped.length} {label(language, 'ข้าม', 'skipped')}</span><span className={errors.length ? 'student-import-summary__error' : ''}>{errors.length} {label(language, 'ข้อผิดพลาด', 'errors')}</span></div>
            {updateCandidates.length > 0 && <section className="student-import-section"><strong>{label(language, 'ข้อมูลที่มีอยู่แล้วและต่างจากไฟล์', 'Existing students with changed data')}</strong><p>{label(language, 'เลือกเฉพาะรายการที่ต้องการอัปเดตข้อมูลส่วนตัว รหัสนักศึกษาจะไม่เปลี่ยน', 'Select only records whose personal data should be updated. Student codes never change.')}</p>{updateCandidates.map(student => <label className="student-import-candidate" key={student.student_code}><input type="checkbox" checked={rows.find(row => row.studentCode === student.student_code)?.applyUpdate || false} onChange={event => setRows(current => current.map(row => row.studentCode === student.student_code ? { ...row, applyUpdate: event.target.checked } : row))} /><span>{student.student_code} · {student.first_name_th} {student.last_name_th}</span></label>)}</section>}
            {errors.length > 0 && <section className="student-import-section student-import-section--error"><strong>{label(language, 'รายการที่ต้องแก้ไข', 'Rows that must be fixed')}</strong>{errors.map(issue => <div key={`${issue.row_number}-${issue.student_code}`}><b>{label(language, 'แถว', 'Row')} {issue.row_number}</b> {issue.student_code && `· ${issue.student_code}`} — {issue.message}</div>)}</section>}
            {skipped.length > 0 && <section className="student-import-section"><strong>{label(language, 'รายการที่ข้าม', 'Skipped rows')}</strong>{skipped.map(issue => <div key={`${issue.row_number}-${issue.student_code}`}>{label(language, 'แถว', 'Row')} {issue.row_number} · {issue.student_code} — {issue.message}</div>)}</section>}
        </>}
    </BaseModal>;
}

export default function CohortRosterPage() {
    const { cohortId } = useParams();
    const { language } = useLanguage();
    const [cohort, setCohort] = useState(null);
    const [students, setStudents] = useState([]);
    const [filters, setFilters] = useState({ search: '', status: '' });
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [feedback, setFeedback] = useState({ type: '', message: '' });
    const [formMode, setFormMode] = useState('');
    const [form, setForm] = useState(EMPTY_STUDENT);
    const [editingStudent, setEditingStudent] = useState(null);
    const [removingStudent, setRemovingStudent] = useState(null);
    const [importOpen, setImportOpen] = useState(false);

    const loadWorkspace = useCallback(async () => {
        if (!cohortId) return;
        setLoading(true);
        try {
            const [nextCohort, nextStudents] = await Promise.all([fetchStudentCohort(cohortId), fetchCohortStudents(cohortId, filters)]);
            setCohort(nextCohort); setStudents(nextStudents);
        } catch (error) { setFeedback({ type: 'error', message: rosterError(error, language) }); }
        finally { setLoading(false); }
    }, [cohortId, filters, language]);

    useEffect(() => { loadWorkspace(); }, [loadWorkspace]);
    useEffect(() => { if (feedback.type !== 'success') return undefined; const timer = window.setTimeout(() => setFeedback(current => current.type === 'success' ? { type: '', message: '' } : current), 4500); return () => window.clearTimeout(timer); }, [feedback]);

    const readOnly = cohort?.status === 'archived';
    const openAdd = () => { setEditingStudent(null); setForm(EMPTY_STUDENT); setFormMode('add'); };
    const openEdit = student => { setEditingStudent(student); setForm({ studentCode: student.studentCode, prefixTh: student.prefixTh, firstNameTh: student.firstNameTh, lastNameTh: student.lastNameTh, firstNameEn: student.firstNameEn, lastNameEn: student.lastNameEn, email: student.email, phone: student.phone, enrollmentStatus: student.enrollmentStatus }); setFormMode('edit'); };

    const saveStudent = async () => {
        if (!cohort) return;
        setSubmitting(true); setFeedback({ type: '', message: '' });
        try {
            if (formMode === 'add') await addCohortStudent(cohort.cohortId, form);
            else await updateCohortStudent(cohort.cohortId, editingStudent.enrollmentId, form);
            setFormMode(''); setFeedback({ type: 'success', message: formMode === 'add' ? label(language, 'เพิ่มนักศึกษาแล้ว', 'Student added.') : label(language, 'บันทึกข้อมูลนักศึกษาแล้ว', 'Student saved.') });
            await loadWorkspace();
        } catch (error) { setFeedback({ type: 'error', message: rosterError(error, language) }); }
        finally { setSubmitting(false); }
    };

    const removeStudent = async () => {
        if (!cohort || !removingStudent) return;
        setSubmitting(true); setFeedback({ type: '', message: '' });
        try {
            await removeCohortStudent(cohort.cohortId, removingStudent.enrollmentId);
            setRemovingStudent(null); setFeedback({ type: 'success', message: label(language, 'ถอดรายชื่อนักศึกษาแล้ว', 'Student removed from cohort.') });
            await loadWorkspace();
        } catch (error) { setFeedback({ type: 'error', message: rosterError(error, language) }); }
        finally { setSubmitting(false); }
    };

    return <div className="student-management-page cohort-roster-page">
        <div className="cohort-roster-header"><div><Link className="course-btn course-btn--ghost cohort-back" href="/student-management"><ArrowLeft size={16} />{label(language, 'รุ่นนักศึกษาทั้งหมด', 'All cohorts')}</Link>{cohort ? <><h1>{cohort.curriculumCode} · {label(language, `รุ่น ${cohort.entryYearBe}`, `Entry ${cohort.entryYearBe}`)}</h1><p>{cohort.curriculumNameTh} · {cohort.majorNameTh}</p></> : <h1>{label(language, 'กำลังโหลดรุ่นนักศึกษา...', 'Loading cohort...')}</h1>}</div><div className="course-list-header__actions"><button className="course-btn course-btn--ghost" onClick={loadWorkspace} disabled={loading}><RefreshCw size={16} className={loading ? 'student-spin' : ''} />{label(language, 'โหลดใหม่', 'Refresh')}</button><button className="course-btn course-btn--ghost" onClick={() => setImportOpen(true)} disabled={!cohort || readOnly}><Upload size={16} />{label(language, 'นำเข้ารายชื่อ', 'Import roster')}</button><button className="course-btn course-btn--primary" onClick={openAdd} disabled={!cohort || readOnly}><Plus size={16} />{label(language, 'เพิ่มนักศึกษา', 'Add student')}</button></div></div>
        <ToastNotifications success={feedback.type === 'success' ? feedback.message : ''} error={feedback.type === 'error' ? feedback.message : ''} onCloseSuccess={() => setFeedback({ type: '', message: '' })} onCloseError={() => setFeedback({ type: '', message: '' })} />
        {cohort && <div className="cohort-summary"><div><span>{label(language, 'สถานะรุ่น', 'Cohort status')}</span><strong>{cohort.status}</strong></div><div><span>{label(language, 'จำนวนรายชื่อ', 'Roster')}</span><strong>{cohort.rosterCount}</strong></div><div><span>{label(language, 'นักศึกษาปัจจุบัน', 'Current students')}</span><strong>{cohort.studentCount}</strong></div><div><span>{label(language, 'ผู้พักการศึกษา', 'Suspended')}</span><strong>{cohort.suspendedCount}</strong></div>{readOnly && <p>{label(language, 'รุ่นนี้เก็บเข้าคลังแล้ว จึงดูข้อมูลได้อย่างเดียว', 'This cohort is archived and read-only.')}</p>}</div>}
        <section className="student-management-panel"><div className="cohort-roster-toolbar"><div className="student-search"><Search size={16} /><input value={filters.search} onChange={event => setFilters(prev => ({ ...prev, search: event.target.value }))} placeholder={label(language, 'ค้นหารหัสหรือชื่อนักศึกษา', 'Search student code or name')} /></div><select className="course-input" value={filters.status} onChange={event => setFilters(prev => ({ ...prev, status: event.target.value }))}><option value="">{label(language, 'ทุกสถานะ', 'All statuses')}</option>{STATUS_OPTIONS.map(status => <option key={status} value={status}>{status}</option>)}</select><span><Users size={16} /> {students.length} {label(language, 'รายการ', 'items')}</span></div><div className="student-table-wrap"><table className="student-table cohort-roster-table"><thead><tr><th>{label(language, 'นักศึกษา', 'Student')}</th><th>{label(language, 'ชื่อภาษาอังกฤษ', 'English name')}</th><th>{label(language, 'ติดต่อ', 'Contact')}</th><th>{label(language, 'สถานะ', 'Status')}</th><th aria-label="Actions" /></tr></thead><tbody>{loading ? <tr><td className="student-empty" colSpan={5}>{label(language, 'กำลังโหลดรายชื่อนักศึกษา...', 'Loading student roster...')}</td></tr> : students.length ? students.map(student => <tr key={student.enrollmentId}><td><div className="student-cohort-cell"><strong>{student.studentCode}</strong><span>{personName(student)}</span></div></td><td>{student.firstNameEn || student.lastNameEn ? `${student.firstNameEn} ${student.lastNameEn}`.trim() : '-'}</td><td><div className="student-cohort-cell"><span>{student.email || '-'}</span><span>{student.phone || '-'}</span></div></td><td><span className={`student-enrollment-status student-enrollment-status--${student.enrollmentStatus}`}>{student.enrollmentStatus}</span></td><td><div className="student-row-actions"><button className="course-icon-btn" onClick={() => openEdit(student)} disabled={readOnly} title={label(language, 'แก้ไข', 'Edit')}><Edit3 size={16} /></button><button className="course-icon-btn course-icon-btn--danger" onClick={() => setRemovingStudent(student)} disabled={readOnly} title={label(language, 'ถอดจากรุ่น', 'Remove from cohort')}><Trash2 size={16} /></button></div></td></tr>) : <tr><td className="student-empty" colSpan={5}>{label(language, 'ยังไม่มีรายชื่อนักศึกษา', 'No students in this cohort yet.')}</td></tr>}</tbody></table></div></section>
        {formMode && <StudentFormModal language={language} form={form} setForm={setForm} mode={formMode} submitting={submitting} readOnly={readOnly} onClose={() => !submitting && setFormMode('')} onSubmit={saveStudent} />}
        {importOpen && cohort && <ImportModal language={language} cohortId={cohort.cohortId} submitting={submitting} onClose={() => !submitting && setImportOpen(false)} onError={error => setFeedback({ type: 'error', message: rosterError(error, language) })} onSuccess={async () => { setImportOpen(false); setFeedback({ type: 'success', message: label(language, 'นำเข้ารายชื่อนักศึกษาสำเร็จ', 'Student roster imported.') }); await loadWorkspace(); }} />}
        <ConfirmActionModal open={Boolean(removingStudent)} title={label(language, 'ถอดนักศึกษาออกจากรุ่น', 'Remove student from cohort')} message={label(language, `ถอด ${removingStudent ? personName(removingStudent) : ''} ออกจากรุ่นนี้หรือไม่`, `Remove ${removingStudent ? personName(removingStudent) : ''} from this cohort?`)} hint={label(language, 'ข้อมูลบุคคลและบัญชีผู้ใช้จะไม่ถูกลบ', 'Person data and login accounts are never deleted.')} confirmLabel={label(language, 'ถอดออก', 'Remove')} variant="danger" loading={submitting} onCancel={() => !submitting && setRemovingStudent(null)} onConfirm={removeStudent} />
    </div>;
}
