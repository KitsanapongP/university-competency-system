'use client';

import { useMemo, useState } from 'react';
import { Download, FileUp, RefreshCw, Upload } from 'lucide-react';
import BaseModal from '../../../../components/ui/BaseModal';
import { commitCareerPathImport, previewCareerPathImport } from '../../../../lib/career-paths';
import { downloadCareerPathImportJSONTemplate, downloadCareerPathImportTemplate, parseCareerPathImportFile } from '../../../../lib/career-path-import.mjs';
import { officerText } from '../../officer-labels';
import './CareerPathImportModal.css';

const CLEARABLE_FIELDS = [
    ['name_en', 'nameEn', ['ชื่อภาษาอังกฤษ', 'English name']],
    ['description_th', 'descriptionTh', ['ลักษณะงานภาษาไทย', 'Thai work description']],
    ['description_en', 'descriptionEn', ['ลักษณะงานภาษาอังกฤษ', 'English work description']],
    ['skills_description_th', 'skillsTh', ['ทักษะภาษาไทย', 'Thai skills']],
    ['skills_description_en', 'skillsEn', ['ทักษะภาษาอังกฤษ', 'English skills']],
    ['source_reference', 'sourceReference', ['แหล่งอ้างอิง', 'Source reference']],
    ['curriculum_ids', 'curriculum_ids', ['หลักสูตรที่เชื่อม', 'Linked curricula']],
    ['competency_ids', 'competency_ids', ['สมรรถนะที่เชื่อม', 'Linked competencies']],
];

const FIELD_MAP = {
    name_th: 'name_th',
    name_en: 'name_en',
    description_th: 'description_th',
    description_en: 'description_en',
    skills_description_th: 'skills_description_th',
    skills_description_en: 'skills_description_en',
    source_reference: 'source_reference',
};

function localized(item, language) {
    return language === 'en' ? item.nameEn || item.nameTh : item.nameTh || item.nameEn;
}

function choices(items, language) {
    return items.map((item) => <option key={item.id} value={item.id}>{localized(item, language)}</option>);
}

function rowSelected(row) {
    if (typeof row.selected === 'boolean') return row.selected;
    return row.action !== 'skip';
}

export default function CareerPathImportModal({
    open,
    facultyId,
    curriculums,
    competencies,
    language,
    onClose,
    onComplete,
}) {
    const [filename, setFilename] = useState('');
    const [rows, setRows] = useState([]);
    const [parserIssues, setParserIssues] = useState([]);
    const [preview, setPreview] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const previewByRow = useMemo(() => new Map((preview?.rows || []).map((item) => [item.row_number, item])), [preview]);
    const hasRowParseIssues = (row) => parserIssues.some((item) => item.career_code && item.career_code.toLocaleLowerCase() === String(row.code || '').toLocaleLowerCase());
    const fatalParserIssues = parserIssues.filter((item) => !item.career_code);
    const validSelectedCount = rows.filter((row) => rowSelected(row) && !hasRowParseIssues(row) && previewByRow.get(row.row_number)?.valid).length;

    const handleFile = async (file) => {
        if (!file) return;
        setBusy(true);
        setFilename(file.name || '');
        setError('');
        setSuccess('');
        setPreview(null);
        try {
            const parsed = await parseCareerPathImportFile(file);
            setRows(parsed.rows || []);
            setParserIssues(parsed.issues || []);
        } catch {
            setRows([]);
            setParserIssues([{ row_number: 0, field: 'file', code: 'FILE_READ_FAILED', message: 'Unable to read this file.' }]);
        } finally {
            setBusy(false);
        }
    };

    const requestPreview = async () => {
        if (!rows.length) return;
        setBusy(true);
        setError('');
        setSuccess('');
        try {
            const data = await previewCareerPathImport({
                schema_version: 1,
                ...(facultyId ? { faculty_id: Number(facultyId) } : {}),
                rows: rows.map((row) => ({ ...row, selected: rowSelected(row) })),
            });
            setPreview(data);
            const resolvedRows = new Map((data?.rows || []).map((item) => [item.row_number, item]));
            setRows((current) => current.map((row) => {
                const result = resolvedRows.get(row.row_number);
                return result ? { ...row, action: result.action, selected: rowSelected(row) && result.valid && result.action !== 'skip' } : row;
            }));
        } catch {
            setError(officerText(language, 'ตรวจสอบข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง', 'Unable to validate the import. Please try again.'));
        } finally {
            setBusy(false);
        }
    };

    const editField = (rowNumber, field, value) => {
        setPreview(null);
        setRows((current) => current.map((row) => row.row_number === rowNumber ? { ...row, [field]: value } : row));
    };

    const editRelationship = (rowNumber, field, event) => {
        const values = [...event.target.selectedOptions].map((option) => Number(option.value));
        setPreview(null);
        setRows((current) => current.map((row) => {
            if (row.row_number !== rowNumber) return row;
            return { ...row, [field]: values, clear_fields: (row.clear_fields || []).filter((item) => item !== field) };
        }));
        const row = rows.find((item) => item.row_number === rowNumber);
        const parserField = field === 'curriculum_ids' ? 'curriculum_code' : 'competency_code';
        setParserIssues((current) => current.filter((item) => !(item.career_code?.toLocaleLowerCase() === String(row?.code || '').toLocaleLowerCase() && item.field === parserField)));
    };

    const toggleClear = (rowNumber, field, value) => {
        setPreview(null);
        setRows((current) => current.map((row) => {
            if (row.row_number !== rowNumber) return row;
            const clearFields = new Set(row.clear_fields || []);
            if (clearFields.has(field)) clearFields.delete(field);
            else clearFields.add(field);
            const key = FIELD_MAP[field] || field;
            const clearedValue = field === 'curriculum_ids' || field === 'competency_ids' ? [] : '';
            return { ...row, [key]: value ? clearedValue : row[key], clear_fields: [...clearFields] };
        }));
    };

    const selectRow = (rowNumber, selected) => {
        setRows((current) => current.map((row) => row.row_number === rowNumber ? { ...row, selected } : row));
    };

    const setAction = (rowNumber, action) => {
        setPreview(null);
        setRows((current) => current.map((row) => row.row_number === rowNumber ? { ...row, action, selected: action !== 'skip' } : row));
    };

    const submitImport = async () => {
        if (!preview?.preview_token || validSelectedCount === 0) return;
        setBusy(true);
        setError('');
        try {
            await commitCareerPathImport({
                schema_version: 1,
                ...(facultyId ? { faculty_id: Number(facultyId) } : {}),
                rows: rows.map((row) => ({ ...row, selected: rowSelected(row) && !hasRowParseIssues(row) && previewByRow.get(row.row_number)?.valid })),
            }, preview.preview_token);
            setSuccess(officerText(language, 'นำเข้ารายการฉบับร่างแล้ว', 'Selected drafts have been imported.'));
            onComplete?.();
        } catch (requestError) {
            setError(requestError?.status === 409
                ? officerText(language, 'ข้อมูลเปลี่ยนแปลงหลังตรวจสอบ กรุณาตรวจสอบ Preview ใหม่', 'Data changed after preview. Validate the preview again.')
                : officerText(language, 'นำเข้าข้อมูลไม่สำเร็จ รายการที่เลือกยังไม่ถูกบันทึก', 'Import failed. No selected rows were saved.'));
        } finally {
            setBusy(false);
        }
    };

    const footer = (
        <>
            <button type="button" className="ui-button ui-button--secondary" onClick={onClose} disabled={busy}>{officerText(language, 'ปิด', 'Close')}</button>
            <button type="button" className="ui-button ui-button--secondary" onClick={requestPreview} disabled={busy || !rows.length || fatalParserIssues.length > 0}>
                <RefreshCw size={16} /> {preview ? officerText(language, 'ตรวจสอบใหม่', 'Revalidate') : officerText(language, 'ตรวจสอบ Preview', 'Validate preview')}
            </button>
            <button type="button" className="ui-button ui-button--primary" onClick={submitImport} disabled={busy || !preview || validSelectedCount === 0}>
                <Upload size={16} /> {busy ? officerText(language, 'กำลังดำเนินการ...', 'Working...') : officerText(language, `นำเข้าร่าง (${validSelectedCount})`, `Import drafts (${validSelectedCount})`)}
            </button>
        </>
    );

    return (
        <BaseModal open={open} title={officerText(language, 'นำเข้าสายงานจาก JSON/Excel', 'Import career paths from JSON/Excel')} size="xxl" onClose={onClose} closeDisabled={busy} footer={footer}>
            <div className="career-import">
                <div className="career-import__toolbar">
                    <label className="career-import__upload ui-button ui-button--secondary">
                        <FileUp size={16} /> {officerText(language, 'เลือกไฟล์', 'Choose file')}
                        <input type="file" accept=".json,.xlsx,.xls" onChange={(event) => handleFile(event.target.files?.[0])} disabled={busy} />
                    </label>
                    <button type="button" className="ui-button ui-button--secondary" onClick={() => downloadCareerPathImportTemplate(curriculums, competencies)} disabled={busy}>
                        <Download size={16} /> {officerText(language, 'ดาวน์โหลด Template พร้อมรายการอ้างอิง', 'Download template with references')}
                    </button>
                    <button type="button" className="ui-button ui-button--secondary" onClick={() => downloadCareerPathImportJSONTemplate(curriculums, competencies)} disabled={busy}>
                        <Download size={16} /> {officerText(language, 'ตัวอย่าง JSON', 'JSON example')}
                    </button>
                    <span className="career-import__filename">{filename}</span>
                </div>
                {error && <p className="career-import__message career-import__message--error" role="alert">{error}</p>}
                {success && <p className="career-import__message career-import__message--success" role="status">{success}</p>}
                {fatalParserIssues.map((item, index) => <p className="career-import__message career-import__message--error" role="alert" key={`${item.code}-${index}`}>{item.message}</p>)}
                {preview?.issues?.map((item, index) => <p className="career-import__message career-import__message--error" role="alert" key={`${item.code}-${index}`}>{item.message}</p>)}

                {rows.length === 0 && !parserIssues.length ? (
                    <div className="career-import__empty">{officerText(language, 'เลือกไฟล์ JSON หรือ Excel เพื่อเริ่มตรวจสอบ', 'Choose a JSON or Excel file to review its rows.')}</div>
                ) : (
                    <div className="career-import__rows">
                        {rows.map((row) => {
                            const checked = rowSelected(row);
                            const validation = previewByRow.get(row.row_number);
                            const field = (key) => row[key] ?? '';
                            const clearSet = new Set(row.clear_fields || []);
                            return (
                                <article className={`career-import-row ${validation?.valid === false ? 'career-import-row--invalid' : ''}`} key={`${row.row_number}-${row.code}`}>
                                    <header className="career-import-row__header">
                                        <label><input type="checkbox" checked={checked} onChange={(event) => selectRow(row.row_number, event.target.checked)} disabled={!validation?.valid || !preview || hasRowParseIssues(row)} /> {officerText(language, `นำเข้ารายการ ${row.row_number}`, `Import row ${row.row_number}`)}</label>
                                        <select value={row.action || 'create'} onChange={(event) => setAction(row.row_number, event.target.value)} disabled={busy} aria-label={officerText(language, 'วิธีจัดการแถว', 'Row action')}>
                                            <option value="create">{officerText(language, 'สร้างร่าง', 'Create draft')}</option>
                                            <option value="update">{officerText(language, 'อัปเดตร่าง', 'Update draft')}</option>
                                            <option value="skip">{officerText(language, 'ข้าม', 'Skip')}</option>
                                        </select>
                                    </header>
                                    {parserIssues.filter((item) => item.career_code?.toLocaleLowerCase() === String(row.code || '').toLocaleLowerCase()).map((item, index) => <p className="career-import-row__error" role="alert" key={`parse-${item.code}-${index}`}>{item.message}</p>)}
                                    {validation?.issues?.map((item, index) => <p className="career-import-row__error" role="alert" key={`${item.code}-${index}`}>{item.field}: {item.message}</p>)}
                                    <div className="career-import-row__fields">
                                        <label className="ui-field"><span>{officerText(language, 'รหัสสายงาน', 'Career path code')}</span><input className="ui-input" value={field('code')} onChange={(event) => editField(row.row_number, 'code', event.target.value)} disabled={busy} /></label>
                                        {[["name_th", "ชื่อภาษาไทย", "Thai name"], ["name_en", "ชื่อภาษาอังกฤษ", "English name"], ["description_th", "ลักษณะงานภาษาไทย", "Thai work description"], ["description_en", "ลักษณะงานภาษาอังกฤษ", "English work description"], ["skills_description_th", "ทักษะภาษาไทย", "Thai skills"], ["skills_description_en", "ทักษะภาษาอังกฤษ", "English skills"], ["source_reference", "แหล่งอ้างอิง", "Source reference"]].map(([key, labelTh, labelEn]) => {
                                                const formKey = FIELD_MAP[key];
                                            const clearable = CLEARABLE_FIELDS.find(([apiField]) => apiField === key);
                                            return (
                                                <label className="ui-field" key={key}>
                                                    <span>{officerText(language, labelTh, labelEn)}</span>
                                                    {key.startsWith('description') || key.startsWith('skills_')
                                                        ? <textarea className="ui-input" rows={2} value={field(formKey)} onChange={(event) => editField(row.row_number, formKey, event.target.value)} disabled={busy} />
                                                        : <input className="ui-input" value={field(formKey)} onChange={(event) => editField(row.row_number, formKey, event.target.value)} disabled={busy} />}
                                                    {clearable && <span className="career-import-row__clear"><input type="checkbox" checked={clearSet.has(key)} onChange={(event) => toggleClear(row.row_number, key, event.target.checked)} disabled={busy} /> {officerText(language, 'ล้างค่านี้อย่างชัดเจน', 'Clear this value explicitly')}</span>}
                                                </label>
                                            );
                                        })}
                                        <label className="ui-field"><span>{officerText(language, 'หลักสูตรที่เชื่อม', 'Linked curricula')}</span><select className="ui-select career-import-row__multi" multiple size={4} value={(row.curriculum_ids || []).map(String)} onChange={(event) => editRelationship(row.row_number, 'curriculum_ids', event)} disabled={busy}>{choices(curriculums, language)}</select><span className="career-import-row__hint">{officerText(language, 'เลือกจากชื่อหลักสูตรในคณะที่กำหนด', 'Select by curriculum name in the current faculty scope.')}</span><span className="career-import-row__clear"><input type="checkbox" checked={clearSet.has('curriculum_ids')} onChange={(event) => toggleClear(row.row_number, 'curriculum_ids', event.target.checked)} disabled={busy} /> {officerText(language, 'ล้างหลักสูตรที่เชื่อม', 'Clear linked curricula')}</span></label>
                                        <label className="ui-field"><span>{officerText(language, 'สมรรถนะที่เชื่อม', 'Linked competencies')}</span><select className="ui-select career-import-row__multi" multiple size={4} value={(row.competency_ids || []).map(String)} onChange={(event) => editRelationship(row.row_number, 'competency_ids', event)} disabled={busy}>{choices(competencies, language)}</select><span className="career-import-row__hint">{officerText(language, 'เลือกจากชื่อสมรรถนะ', 'Select by competency name.')}</span><span className="career-import-row__clear"><input type="checkbox" checked={clearSet.has('competency_ids')} onChange={(event) => toggleClear(row.row_number, 'competency_ids', event.target.checked)} disabled={busy} /> {officerText(language, 'ล้างสมรรถนะที่เชื่อม', 'Clear linked competencies')}</span></label>
                                    </div>
                                    {validation?.previous && validation?.action === 'update' && (
                                        <details className="career-import-row__diff">
                                            <summary>{officerText(language, 'เปรียบเทียบกับฉบับเดิม', 'Compare with current version')}</summary>
                                            <div><strong>{officerText(language, 'ฉบับเดิม', 'Current')}</strong> · {validation.previous.name_th}</div>
                                            <div><strong>{officerText(language, 'ค่าที่จะบันทึก', 'Incoming')}</strong> · {validation.payload.name_th}</div>
                                        </details>
                                    )}
                                </article>
                            );
                        })}
                    </div>
                )}
            </div>
        </BaseModal>
    );
}
