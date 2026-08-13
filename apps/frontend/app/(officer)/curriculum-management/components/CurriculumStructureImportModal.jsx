'use client';

import { useRef, useState } from 'react';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import BaseModal from '../../../../components/ui/BaseModal';
import {
    downloadCurriculumStructureTemplate,
    parseCurriculumStructureWorkbook,
    previewDraftCurriculumStructureImport,
} from '../../../../lib/curriculum-structure-import';
import './CurriculumStructureImportModal.css';

const copy = {
    th: {
        title: 'นำเข้ารายวิชาจาก Excel',
        download: 'ดาวน์โหลดไฟล์ตัวอย่าง',
        choose: 'เลือกไฟล์ .xlsx',
        selected: 'ไฟล์ที่เลือก',
        empty: 'เลือกไฟล์ Excel เพื่อดูตัวอย่างข้อมูลก่อนนำเข้า',
        newCategories: 'หมวดใหม่',
        existingCategories: 'หมวดเดิม',
        courses: 'รายวิชาที่จะเพิ่ม',
        issues: 'รายการที่ต้องแก้ไข',
        ready: 'ข้อมูลพร้อมนำเข้า',
        cancel: 'ยกเลิก',
        import: 'นำเข้าข้อมูล',
        confirm: 'ยืนยันการนำเข้า',
        impact: 'ยืนยันการนำเข้ากับหลักสูตรที่มี Template เชื่อมอยู่',
        loading: 'กำลังตรวจสอบ...',
        committing: 'กำลังนำเข้า...',
    },
    en: {
        title: 'Import courses from Excel',
        download: 'Download template',
        choose: 'Choose .xlsx file',
        selected: 'Selected file',
        empty: 'Choose an Excel file to preview the import.',
        newCategories: 'New categories',
        existingCategories: 'Existing categories',
        courses: 'Courses to add',
        issues: 'Items to fix',
        ready: 'Ready to import',
        cancel: 'Cancel',
        import: 'Import data',
        confirm: 'Confirm import',
        impact: 'Confirm import for a curriculum with connected templates.',
        loading: 'Checking...',
        committing: 'Importing...',
    },
};

function issueLabel(issue, language) {
    const row = Number(issue?.row_number || 0);
    const prefix = row > 0 ? (language === 'en' ? `Row ${row}` : `แถว ${row}`) : (language === 'en' ? 'File' : 'ไฟล์');
    return `${prefix}: ${issue?.message || ''}`;
}

export default function CurriculumStructureImportModal({
    open,
    onClose,
    mode = 'draft',
    curriculumId,
    categories = [],
    coursesByCategory = {},
    language = 'th',
    disabled = false,
    onPreview,
    onImport,
}) {
    const labels = copy[language] || copy.th;
    const inputRef = useRef(null);
    const [fileName, setFileName] = useState('');
    const [rows, setRows] = useState([]);
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [committing, setCommitting] = useState(false);
    const [error, setError] = useState('');
    const [confirmImpact, setConfirmImpact] = useState(false);

    const reset = () => {
        setFileName('');
        setRows([]);
        setPreview(null);
        setLoading(false);
        setCommitting(false);
        setError('');
        setConfirmImpact(false);
        if (inputRef.current) inputRef.current.value = '';
    };

    const close = () => {
        if (loading || committing) return;
        reset();
        onClose?.();
    };

    const handleFile = async event => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!file.name.toLowerCase().endsWith('.xlsx')) {
            setError(language === 'en' ? 'Please choose an .xlsx file.' : 'กรุณาเลือกไฟล์ .xlsx');
            return;
        }

        setLoading(true);
        setError('');
        setPreview(null);
        setConfirmImpact(false);
        try {
            const parsed = await parseCurriculumStructureWorkbook(file);
            setFileName(file.name);
            setRows(parsed.rows);
            if (mode === 'draft') {
                setPreview(previewDraftCurriculumStructureImport(categories, coursesByCategory, parsed.rows, parsed.issues));
            } else if (parsed.issues.length > 0) {
                setPreview({ valid: false, issues: parsed.issues, new_category_count: 0, existing_category_count: 0, course_count: 0 });
            } else {
                const nextPreview = await onPreview?.(curriculumId, parsed.rows);
                setPreview(nextPreview || null);
            }
        } catch (nextError) {
            setError(nextError?.message || (language === 'en' ? 'Unable to read the Excel file.' : 'ไม่สามารถอ่านไฟล์ Excel ได้'));
        } finally {
            setLoading(false);
        }
    };

    const handleImport = async () => {
        if (!preview?.valid || committing || disabled) return;
        setCommitting(true);
        setError('');
        try {
            await onImport?.(rows, confirmImpact);
            close();
        } catch (nextError) {
            if (nextError?.code === 'CONFIRMATION_REQUIRED' && !confirmImpact) {
                setConfirmImpact(true);
            } else {
                setError(nextError?.message || (language === 'en' ? 'Unable to import the structure.' : 'ไม่สามารถนำเข้าข้อมูลได้'));
            }
        } finally {
            setCommitting(false);
        }
    };

    const issues = preview?.issues || [];
    return (
        <BaseModal
            open={open}
            title={labels.title}
            size="lg"
            onClose={close}
            closeDisabled={loading || committing}
            footer={(
                <>
                    <button type="button" className="course-btn course-btn--ghost" onClick={close} disabled={loading || committing}>
                        {labels.cancel}
                    </button>
                    <button
                        type="button"
                        className="course-btn course-btn--primary"
                        onClick={handleImport}
                        disabled={!preview?.valid || disabled || loading || committing}
                    >
                        <Upload size={15} /> {committing ? labels.committing : confirmImpact ? labels.confirm : labels.import}
                    </button>
                </>
            )}
        >
            <div className="curriculum-import-modal">
                <div className="curriculum-import-modal__intro">
                    <p>{language === 'en'
                        ? 'Import adds new categories and courses only. Existing curriculum data is never changed.'
                        : 'การนำเข้าจะเพิ่มเฉพาะหมวดและรายวิชาใหม่ โดยจะไม่แก้ไขหรือลบข้อมูลเดิม'}</p>
                    <button type="button" className="course-btn course-btn--ghost course-btn--sm" onClick={() => downloadCurriculumStructureTemplate()}>
                        <Download size={14} /> {labels.download}
                    </button>
                </div>

                <input ref={inputRef} className="curriculum-import-modal__file-input" type="file" accept=".xlsx" onChange={handleFile} />
                <button
                    type="button"
                    className="curriculum-import-modal__file-picker"
                    onClick={() => inputRef.current?.click()}
                    disabled={loading || committing || disabled}
                >
                    <FileSpreadsheet size={24} />
                    <span>{loading ? labels.loading : labels.choose}</span>
                    {fileName && <small>{labels.selected}: {fileName}</small>}
                </button>

                {!preview && !error && <p className="curriculum-import-modal__empty">{labels.empty}</p>}
                {error && <p className="curriculum-import-modal__error">{error}</p>}

                {preview && (
                    <>
                        <div className="curriculum-import-modal__summary">
                            <div><span>{labels.newCategories}</span><strong>{preview.new_category_count || 0}</strong></div>
                            <div><span>{labels.existingCategories}</span><strong>{preview.existing_category_count || 0}</strong></div>
                            <div><span>{labels.courses}</span><strong>{preview.course_count || 0}</strong></div>
                        </div>
                        {preview.valid ? (
                            <p className="curriculum-import-modal__ready">{labels.ready}</p>
                        ) : (
                            <div className="curriculum-import-modal__issues">
                                <strong>{labels.issues}</strong>
                                <ul>{issues.map((entry, index) => <li key={`${entry.row_number}-${entry.field}-${index}`}>{issueLabel(entry, language)}</li>)}</ul>
                            </div>
                        )}
                        {confirmImpact && <p className="curriculum-import-modal__impact">{labels.impact}</p>}
                    </>
                )}
            </div>
        </BaseModal>
    );
}
