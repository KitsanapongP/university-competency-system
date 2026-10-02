'use client';

import { useCallback, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, FileUp, RefreshCw, Search, Upload } from 'lucide-react';
import BaseModal from '../../../../components/ui/BaseModal';
import { commitCareerPathImport, previewCareerPathImport } from '../../../../lib/career-paths';
import { downloadCareerPathImportJSONTemplate, downloadCareerPathImportTemplate, parseCareerPathImportFile } from '../../../../lib/career-path-import.mjs';
import {
    CAREER_PATH_IMPORT_PAGE_SIZE,
    getCareerPathImportRowStatus,
    getCareerPathImportSelectionState,
    normalizeCareerPathImportRows,
    summarizeCareerPathImport,
    toCareerPathImportPayloadRow,
} from '../../../../lib/career-path-import-state.mjs';
import { officerText } from '../../officer-labels';
import CareerPathImportEditor from './CareerPathImportEditor';
import CareerPathImportTable from './CareerPathImportTable';
import './CareerPathImportModal.css';

const STATUS_FILTERS = [
    ['all', 'ทั้งหมด', 'All statuses'],
    ['ready', 'พร้อมนำเข้า', 'Ready'],
    ['duplicate', 'รายการซ้ำ', 'Duplicates'],
    ['error', 'ต้องแก้ไข', 'Needs correction'],
    ['skipped', 'ข้ามรายการ', 'Skipped'],
    ['stale', 'ต้องตรวจใหม่', 'Revalidate'],
];

const ACTION_FILTERS = [
    ['all', 'ทุกการดำเนินการ', 'All actions'],
    ['create', 'เพิ่มสายงานใหม่', 'Add new'],
    ['update', 'อัปเดตข้อมูลเดิม', 'Update existing'],
    ['skip', 'ข้ามรายการ', 'Skip'],
];

const ISSUE_FIELDS = {
    schema_version: ['เวอร์ชันรูปแบบไฟล์', 'File schema version'],
    rows: ['รายการ', 'Rows'],
    code: ['รหัสสายงาน', 'Career path code'],
    name_th: ['ชื่อภาษาไทย', 'Thai name'],
    fields: ['ข้อมูลสายงาน', 'Career path details'],
    relationships: ['หลักสูตรหรือสมรรถนะ', 'Curricula or competencies'],
    curriculum_code: ['รหัสหลักสูตร', 'Curriculum code'],
    competency_code: ['รหัสสมรรถนะ', 'Competency code'],
    clear_fields: ['การล้างค่า', 'Clear fields'],
    action: ['การดำเนินการ', 'Action'],
    file: ['ไฟล์', 'File'],
    header: ['หัวคอลัมน์', 'Headers'],
    CareerPaths: ['ชีต CareerPaths', 'CareerPaths sheet'],
    Mappings: ['ชีต Mappings', 'Mappings sheet'],
};

function issueMessage(issue, language) {
    const field = ISSUE_FIELDS[issue.field];
    const fieldLabel = field ? officerText(language, field[0], field[1]) : issue.field;
    const messages = {
        CODE_REQUIRED: ['กรุณาระบุรหัสสายงาน', 'Enter a career path code.'],
        DUPLICATE_FILE_CODE: ['รหัสนี้ซ้ำอยู่ในไฟล์นำเข้า', 'This code appears more than once in the import file.'],
        DUPLICATE_ROW_NUMBER: ['เลขแถวในไฟล์ซ้ำกัน', 'The file contains duplicate row numbers.'],
        CAREER_PATH_EXISTS: ['รหัสนี้มีอยู่แล้ว เลือกอัปเดตหรือข้ามรายการ', 'This code already exists. Choose update or skip.'],
        CAREER_PATH_NOT_FOUND: ['ไม่พบสายงานเดิมสำหรับรหัสนี้', 'No existing career path was found for this code.'],
        REFERENCE_OUT_OF_SCOPE: ['หลักสูตรหรือสมรรถนะที่เลือกไม่มีอยู่ ใช้งานไม่ได้ หรืออยู่นอกขอบเขตคณะ', 'A selected curriculum or competency is missing, inactive, or outside the faculty scope.'],
        DRAFT_INVALID: ['ตรวจสอบรหัส ชื่อภาษาไทย และหลักสูตรหรือสมรรถนะที่เชื่อม', 'Check the code, Thai name, and linked curricula or competencies.'],
        TOO_MANY_RELATIONSHIPS: ['จำนวนหลักสูตรหรือสมรรถนะเกินกว่าที่ระบบรองรับ', 'Too many curricula or competencies are linked.'],
        INVALID_CLEAR_FIELD: ['ไม่สามารถล้างข้อมูลช่องนี้ได้', 'This field cannot be cleared.'],
        INVALID_ACTION: ['เลือกการดำเนินการที่รองรับ', 'Choose a supported action.'],
        CURRICULUM_CODE_UNKNOWN: ['ไม่พบรหัสหลักสูตรในชีตอ้างอิง', 'Curriculum code is missing or ambiguous in the reference sheet.'],
        COMPETENCY_CODE_UNKNOWN: ['ไม่พบรหัสสมรรถนะในชีตอ้างอิง', 'Competency code is missing or ambiguous in the reference sheet.'],
        DUPLICATE_REFERENCE_CODE: ['รหัสในชีตอ้างอิงซ้ำกัน', 'A reference code is duplicated.'],
        MAPPING_HEADERS_MISSING: ['หัวคอลัมน์ในชีต Mappings ไม่ครบ', 'The Mappings sheet is missing required headers.'],
        REFERENCE_HEADERS_MISSING: ['หัวคอลัมน์ในชีตอ้างอิงไม่ครบ', 'A reference sheet is missing required headers.'],
        SHEET_MISSING: ['ไม่พบชีตที่จำเป็นในไฟล์', 'A required sheet is missing from the workbook.'],
        INVALID_ROW_COUNT: ['ไฟล์ต้องมีรายการระหว่าง 1 ถึง 500 รายการ', 'The file must contain between 1 and 500 rows.'],
        INVALID_SCHEMA: ['รูปแบบไฟล์ไม่ถูกต้อง', 'The file structure is invalid.'],
        UNSUPPORTED_SCHEMA: ['เวอร์ชันรูปแบบไฟล์นี้ไม่รองรับ', 'This file schema version is not supported.'],
        FILE_TOO_LARGE: ['ไฟล์มีขนาดเกิน 5 MB', 'The file exceeds the 5 MB limit.'],
        INVALID_WORKBOOK: ['อ่านไฟล์ Excel ไม่สำเร็จ', 'The Excel workbook could not be read.'],
        INVALID_JSON: ['อ่านไฟล์ JSON ไม่สำเร็จ', 'The JSON file could not be read.'],
        FILE_READ_FAILED: ['อ่านไฟล์ไม่สำเร็จ', 'The file could not be read.'],
    };
    const message = messages[issue.code];
    const detail = message ? officerText(language, message[0], message[1]) : issue.message;
    return fieldLabel ? `${fieldLabel}: ${detail}` : detail;
}

function relationIds(row, validation, field) {
    if (Object.prototype.hasOwnProperty.call(row, field)) return row[field] || [];
    return validation?.payload?.[field] || [];
}

function filterMatchesAction(row, validation, filter) {
    if (filter === 'all') return true;
    if (filter === 'update') return row.actionIntent === 'update' || validation?.action === 'update';
    if (filter === 'skip') return row.actionIntent === 'skip' || validation?.action === 'skip';
    if (filter === 'create') return validation?.action === 'create';
    return true;
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
    const [previewStale, setPreviewStale] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [actionFilter, setActionFilter] = useState('all');
    const [page, setPage] = useState(1);
    const [activeRowKey, setActiveRowKey] = useState(null);
    const [mobileView, setMobileView] = useState('list');
    const previewByRow = useMemo(() => new Map((preview?.rows || []).map((item) => [item.row_number, item])), [preview]);
    const hasRowParseIssues = useCallback(
        (row) => parserIssues.some((item) => item.career_code?.toLocaleLowerCase() === String(row.code || '').toLocaleLowerCase()),
        [parserIssues],
    );
    const fatalParserIssues = parserIssues.filter((item) => !item.career_code);
    const summary = useMemo(
        () => summarizeCareerPathImport(rows, previewByRow, hasRowParseIssues, previewStale),
        [rows, previewByRow, hasRowParseIssues, previewStale],
    );
    const validSelectedCount = previewStale ? 0 : summary.selected;

    const buildApiRows = (sourceRows, selectedFromPreview = false) => sourceRows.map((row) => {
        const parseIssue = hasRowParseIssues(row);
        const selected = selectedFromPreview && !parseIssue
            ? getCareerPathImportSelectionState(row, previewByRow.get(row.row_number), parseIssue, false)
            : false;
        return toCareerPathImportPayloadRow(row, selected);
    });

    const fetchPreview = async (sourceRows) => previewCareerPathImport({
        schema_version: 1,
        ...(facultyId ? { faculty_id: Number(facultyId) } : {}),
        rows: buildApiRows(sourceRows),
    });

    const handleFile = async (file) => {
        if (!file) return;
        setBusy(true);
        setFilename(file.name || '');
        setError('');
        setRows([]);
        setParserIssues([]);
        setPreview(null);
        setPreviewStale(false);
        setActiveRowKey(null);
        setMobileView('list');
        setPage(1);
        try {
            const parsed = await parseCareerPathImportFile(file);
            const normalizedRows = normalizeCareerPathImportRows(parsed.rows || []);
            const issues = parsed.issues || [];
            setRows(normalizedRows);
            setParserIssues(issues);
            if (normalizedRows.length && !issues.some((item) => !item.career_code)) {
                const result = await fetchPreview(normalizedRows);
                setPreview(result);
            }
        } catch {
            setRows([]);
            setParserIssues([{ row_number: 0, field: 'file', code: 'FILE_READ_FAILED', message: 'Unable to read this file.' }]);
        } finally {
            setBusy(false);
        }
    };

    const requestPreview = async () => {
        if (!rows.length || fatalParserIssues.length > 0) return;
        setBusy(true);
        setError('');
        try {
            const result = await fetchPreview(rows);
            setPreview(result);
            setPreviewStale(false);
        } catch {
            setError(officerText(language, 'ตรวจสอบข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง', 'Unable to validate the import. Please try again.'));
        } finally {
            setBusy(false);
        }
    };

    const invalidatePreview = () => {
        setPreviewStale(true);
        setError('');
    };

    const editField = (rowKey, field, value) => {
        invalidatePreview();
        setRows((current) => current.map((row) => row.clientKey === rowKey
            ? { ...row, [field]: value, clear_fields: (row.clear_fields || []).filter((item) => item !== field) }
            : row));
    };

    const editRelationships = (rowKey, field, values) => {
        invalidatePreview();
        setRows((current) => current.map((row) => row.clientKey === rowKey
            ? { ...row, [field]: values, clear_fields: (row.clear_fields || []).filter((item) => item !== field) }
            : row));
        const row = rows.find((item) => item.clientKey === rowKey);
        const parserField = field === 'curriculum_ids' ? 'curriculum_code' : 'competency_code';
        setParserIssues((current) => current.filter((item) => !(item.career_code?.toLocaleLowerCase() === String(row?.code || '').toLocaleLowerCase() && item.field === parserField)));
    };

    const clearField = (rowKey, field, shouldClear) => {
        invalidatePreview();
        setRows((current) => current.map((row) => {
            if (row.clientKey !== rowKey) return row;
            const clearFields = new Set(row.clear_fields || []);
            if (shouldClear) clearFields.add(field);
            else clearFields.delete(field);
            return {
                ...row,
                clear_fields: [...clearFields],
            };
        }));
    };

    const setRowSelection = (rowKey, selected) => {
        setRows((current) => current.map((row) => row.clientKey === rowKey
            ? { ...row, selectionIntent: selected ? 'include' : 'exclude' }
            : row));
    };

    const setAllFilteredSelection = (selected) => {
        const eligibleKeys = new Set(filteredRows.filter((item) => item.canSelect).map((item) => item.row.clientKey));
        setRows((current) => current.map((row) => eligibleKeys.has(row.clientKey)
            ? { ...row, selectionIntent: selected ? 'include' : 'exclude' }
            : row));
    };

    const setAction = (rowKey, actionIntent) => {
        invalidatePreview();
        setRows((current) => current.map((row) => {
            if (row.clientKey !== rowKey) return row;
            return {
                ...row,
                actionIntent,
                action: actionIntent === 'auto' ? '' : actionIntent,
                selectionIntent: actionIntent === 'update' ? 'include' : actionIntent === 'skip' ? 'exclude' : 'auto',
            };
        }));
    };

    const submitImport = async () => {
        if (!preview?.preview_token || previewStale || validSelectedCount === 0) return;
        setBusy(true);
        setError('');
        try {
            await commitCareerPathImport({
                schema_version: 1,
                ...(facultyId ? { faculty_id: Number(facultyId) } : {}),
                rows: buildApiRows(rows, true),
            }, preview.preview_token);
            onComplete?.();
        } catch (requestError) {
            setError(requestError?.status === 409
                ? officerText(language, 'ข้อมูลเปลี่ยนแปลงหลังตรวจสอบ Preview กรุณาตรวจสอบใหม่', 'Data changed after preview. Validate it again.')
                : officerText(language, 'นำเข้าข้อมูลไม่สำเร็จ รายการที่เลือกยังไม่ถูกบันทึก', 'Import failed. No selected rows were saved.'));
        } finally {
            setBusy(false);
        }
    };

    const allRows = useMemo(() => rows.map((row) => {
        const validation = previewByRow.get(row.row_number);
        const parseIssues = parserIssues.filter((item) => item.career_code?.toLocaleLowerCase() === String(row.code || '').toLocaleLowerCase());
        const rowIssues = [...parseIssues, ...(!previewStale ? validation?.issues || [] : [])];
        const status = getCareerPathImportRowStatus(row, validation, parseIssues.length > 0, previewStale);
        const selected = getCareerPathImportSelectionState(row, validation, parseIssues.length > 0, previewStale);
        return {
            row,
            validation,
            issues: rowIssues,
            status,
            selected,
            canSelect: Boolean(validation?.valid && validation.action !== 'skip' && parseIssues.length === 0 && !previewStale),
            curriculumCount: relationIds(row, validation, 'curriculum_ids').length,
            competencyCount: relationIds(row, validation, 'competency_ids').length,
        };
    }), [rows, previewByRow, parserIssues, previewStale]);

    const filteredRows = useMemo(() => allRows.filter((item) => {
        const needle = search.trim().toLocaleLowerCase();
        const searchMatch = !needle || [item.row.code, item.row.name_th, item.row.name_en]
            .some((value) => String(value || '').toLocaleLowerCase().includes(needle));
        const status = item.status === 'update' ? 'ready' : item.status;
        const statusMatch = statusFilter === 'all' || status === statusFilter;
        return searchMatch && statusMatch && filterMatchesAction(item.row, item.validation, actionFilter);
    }), [allRows, search, statusFilter, actionFilter]);

    const pageCount = Math.max(1, Math.ceil(filteredRows.length / CAREER_PATH_IMPORT_PAGE_SIZE));
    const currentPage = Math.min(page, pageCount);
    const visibleRows = filteredRows.slice((currentPage - 1) * CAREER_PATH_IMPORT_PAGE_SIZE, currentPage * CAREER_PATH_IMPORT_PAGE_SIZE);
    const activeItem = allRows.find((item) => item.row.clientKey === activeRowKey) || null;
    const issueRows = allRows.filter((item) => item.status === 'error');
    const activeIssueIndex = issueRows.findIndex((item) => item.row.clientKey === activeRowKey);
    const canNavigatePrevious = activeIssueIndex > 0;
    const canNavigateNext = activeIssueIndex >= 0 && activeIssueIndex < issueRows.length - 1;

    const openRow = (rowKey) => {
        setActiveRowKey(rowKey);
        setMobileView('editor');
    };

    const closeEditor = () => {
        const currentKey = activeRowKey;
        setActiveRowKey(null);
        setMobileView('list');
        requestAnimationFrame(() => document.querySelector(`[data-career-import-edit="${currentKey}"]`)?.focus());
    };

    const navigateIssue = (direction) => {
        const next = issueRows[activeIssueIndex + direction];
        if (next) setActiveRowKey(next.row.clientKey);
    };

    const footer = (
        <>
            <span className="career-import__footer-count" aria-live="polite">
                {officerText(language, `เลือกแล้ว ${validSelectedCount} รายการ`, `${validSelectedCount} selected`)}
            </span>
            <button type="button" className="ui-button ui-button--secondary" onClick={onClose} disabled={busy}>
                {officerText(language, 'ปิด', 'Close')}
            </button>
            <button type="button" className="ui-button ui-button--secondary" onClick={requestPreview} disabled={busy || !rows.length || fatalParserIssues.length > 0}>
                <RefreshCw size={16} /> {officerText(language, preview ? 'ตรวจสอบใหม่' : 'ตรวจสอบ Preview', preview ? 'Revalidate' : 'Validate preview')}
            </button>
            <button type="button" className="ui-button ui-button--primary" onClick={submitImport} disabled={busy || previewStale || !preview || validSelectedCount === 0}>
                <Upload size={16} /> {busy ? officerText(language, 'กำลังดำเนินการ...', 'Working...') : officerText(language, `นำเข้า ${validSelectedCount} รายการ`, `Import ${validSelectedCount} items`)}
            </button>
        </>
    );

    const uploadControl = (
        <label className="career-import__upload ui-button ui-button--secondary">
            <FileUp size={16} /> {officerText(language, filename ? 'เปลี่ยนไฟล์' : 'เลือกไฟล์', filename ? 'Change file' : 'Choose file')}
            <input type="file" accept=".json,.xlsx,.xls" onChange={(event) => {
                const file = event.target.files?.[0];
                event.currentTarget.value = '';
                handleFile(file);
            }} disabled={busy} />
        </label>
    );

    const downloadMenu = (
        <details className="career-import__download-menu">
            <summary className="ui-button ui-button--secondary"><Download size={16} /> {officerText(language, 'ดาวน์โหลดตัวอย่าง', 'Download examples')}</summary>
            <div className="career-import__download-options">
                <button type="button" onClick={() => downloadCareerPathImportTemplate(curriculums, competencies)} disabled={busy}>
                    {officerText(language, 'Template Excel พร้อมรายการอ้างอิง', 'Excel template with references')}
                </button>
                <button type="button" onClick={() => downloadCareerPathImportJSONTemplate(curriculums, competencies)} disabled={busy}>
                    {officerText(language, 'ตัวอย่าง JSON', 'JSON example')}
                </button>
            </div>
        </details>
    );

    return (
        <BaseModal open={open} title={officerText(language, 'นำเข้าสายงานจาก JSON/Excel', 'Import career paths from JSON/Excel')} size="xxl" onClose={onClose} closeDisabled={busy} footer={footer}>
            <div className="career-import">
                <div className="career-import__toolbar">
                    {uploadControl}
                    {downloadMenu}
                    <span className="career-import__filename">{filename || officerText(language, 'ยังไม่ได้เลือกไฟล์', 'No file selected')}</span>
                </div>

                <div className="career-import__summary" aria-live="polite">
                    <span className="career-import__draft-note">{officerText(language, 'รายการที่นำเข้าจะบันทึกเป็นฉบับร่าง และต้องเปิดใช้งานแยกต่างหาก', 'Imported rows are saved as drafts and must be activated separately.')}</span>
                    <div className="career-import__summary-counts">
                        <span>{officerText(language, `ทั้งหมด ${summary.total}`, `${summary.total} total`)}</span>
                        {previewStale ? (
                            <button type="button" className="career-import-count career-import-count--duplicate" onClick={() => setStatusFilter('stale')}>
                                {officerText(language, `ต้องตรวจใหม่ ${summary.stale}`, `Revalidate ${summary.stale}`)}
                            </button>
                        ) : summary.pending > 0 ? (
                            <span className="career-import-count">{officerText(language, `รอตรวจสอบ ${summary.pending}`, `Pending ${summary.pending}`)}</span>
                        ) : (
                            <>
                                <button type="button" className="career-import-count career-import-count--ready" onClick={() => setStatusFilter('ready')}>
                                    {officerText(language, `พร้อมนำเข้า ${summary.ready}`, `Ready ${summary.ready}`)}
                                </button>
                                <button type="button" className="career-import-count career-import-count--error" onClick={() => setStatusFilter('error')}>
                                    {officerText(language, `ต้องแก้ไข ${summary.errors}`, `Needs correction ${summary.errors}`)}
                                </button>
                                <button type="button" className="career-import-count career-import-count--duplicate" onClick={() => setStatusFilter('duplicate')}>
                                    {officerText(language, `รายการซ้ำ ${summary.duplicates}`, `Duplicates ${summary.duplicates}`)}
                                </button>
                                {summary.skipped > 0 && <button type="button" className="career-import-count" onClick={() => setStatusFilter('skipped')}>
                                    {officerText(language, `ข้าม ${summary.skipped}`, `Skipped ${summary.skipped}`)}
                                </button>}
                            </>
                        )}
                    </div>
                </div>

                {error && <p className="career-import__message career-import__message--error" role="alert">{error}</p>}
                {fatalParserIssues.map((item, index) => <p className="career-import__message career-import__message--error" role="alert" key={`${item.code}-${index}`}>{issueMessage(item, language)}</p>)}
                {!previewStale && preview?.issues?.map((item, index) => <p className="career-import__message career-import__message--error" role="alert" key={`${item.code}-${index}`}>{issueMessage(item, language)}</p>)}
                {previewStale && <p className="career-import__message career-import__message--stale" role="status">{officerText(language, 'ข้อมูลถูกแก้ไขแล้ว กรุณาตรวจสอบใหม่ก่อนนำเข้า', 'Rows changed. Revalidate the preview before importing.')}</p>}

                <section className="career-import__filters" aria-label={officerText(language, 'ค้นหาและกรองรายการ', 'Search and filter rows')}>
                    <label className="career-import__search">
                        <Search size={17} aria-hidden="true" />
                        <span className="sr-only">{officerText(language, 'ค้นหารหัสหรือชื่อสายงาน', 'Search code or career path name')}</span>
                        <input className="ui-input" type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder={officerText(language, 'ค้นหารหัสหรือชื่อสายงาน', 'Search code or career path name')} disabled={busy} />
                    </label>
                    <label className="career-import__filter">
                        <span>{officerText(language, 'สถานะ', 'Status')}</span>
                        <select className="ui-select" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} disabled={busy}>
                            {STATUS_FILTERS.map(([value, th, en]) => <option value={value} key={value}>{officerText(language, th, en)}</option>)}
                        </select>
                    </label>
                    <label className="career-import__filter">
                        <span>{officerText(language, 'การดำเนินการ', 'Action')}</span>
                        <select className="ui-select" value={actionFilter} onChange={(event) => { setActionFilter(event.target.value); setPage(1); }} disabled={busy}>
                            {ACTION_FILTERS.map(([value, th, en]) => <option value={value} key={value}>{officerText(language, th, en)}</option>)}
                        </select>
                    </label>
                    <div className="career-import__bulk-actions">
                        <button type="button" className="ui-button ui-button--secondary" onClick={() => setAllFilteredSelection(true)} disabled={busy || previewStale || !filteredRows.some((item) => item.canSelect)}>
                            {officerText(language, 'เลือกที่พร้อมทั้งหมด', 'Select all ready')}
                        </button>
                        <button type="button" className="ui-button ui-button--secondary" onClick={() => setAllFilteredSelection(false)} disabled={busy || !rows.some((row) => row.selectionIntent !== 'exclude')}>
                            {officerText(language, 'ล้างการเลือก', 'Clear selection')}
                        </button>
                    </div>
                </section>

                {rows.length === 0 && !fatalParserIssues.length ? (
                    <div className="career-import__empty">
                        {busy
                            ? officerText(language, 'กำลังอ่านและตรวจสอบไฟล์...', 'Reading and validating the file...')
                            : officerText(language, 'เลือกไฟล์ JSON หรือ Excel เพื่อเริ่มตรวจสอบ', 'Choose a JSON or Excel file to review its rows.')}
                    </div>
                ) : rows.length > 0 ? (
                    <div className={`career-import__workspace ${mobileView === 'editor' ? 'career-import__workspace--editor' : ''}`}>
                        <section className="career-import__list-pane" aria-label={officerText(language, 'รายการสายงาน', 'Career path rows')}>
                            <div className="career-import__list-heading">
                                <span>{officerText(language, `แสดง ${filteredRows.length ? (currentPage - 1) * CAREER_PATH_IMPORT_PAGE_SIZE + 1 : 0}–${Math.min(currentPage * CAREER_PATH_IMPORT_PAGE_SIZE, filteredRows.length)} จาก ${filteredRows.length}`, `Showing ${filteredRows.length ? (currentPage - 1) * CAREER_PATH_IMPORT_PAGE_SIZE + 1 : 0}–${Math.min(currentPage * CAREER_PATH_IMPORT_PAGE_SIZE, filteredRows.length)} of ${filteredRows.length}`)}</span>
                                <span>{officerText(language, `เลือกแล้ว ${validSelectedCount}`, `${validSelectedCount} selected`)}</span>
                            </div>
                            <CareerPathImportTable
                                items={visibleRows}
                                language={language}
                                busy={busy}
                                previewStale={previewStale}
                                onSelectionChange={setRowSelection}
                                onActionChange={setAction}
                                onOpenRow={openRow}
                            />
                            <div className="career-import__pagination">
                                <span>{officerText(language, `หน้า ${currentPage} จาก ${pageCount}`, `Page ${currentPage} of ${pageCount}`)}</span>
                                <div>
                                    <button type="button" className="ui-icon-button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage <= 1} aria-label={officerText(language, 'หน้าก่อนหน้า', 'Previous page')}><ChevronLeft size={18} /></button>
                                    <button type="button" className="ui-icon-button" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={currentPage >= pageCount} aria-label={officerText(language, 'หน้าถัดไป', 'Next page')}><ChevronRight size={18} /></button>
                                </div>
                            </div>
                        </section>

                        <CareerPathImportEditor
                            item={activeItem ? { ...activeItem, issues: activeItem.issues } : null}
                            language={language}
                            curriculums={curriculums}
                            competencies={competencies}
                            busy={busy}
                            mobile={mobileView === 'editor'}
                            onBack={() => setMobileView('list')}
                            onClose={closeEditor}
                            onEditField={editField}
                            onEditRelationships={editRelationships}
                            onClearField={clearField}
                            onNavigateIssue={navigateIssue}
                            canNavigatePrevious={canNavigatePrevious}
                            canNavigateNext={canNavigateNext}
                            issueMessages={(item) => issueMessage(item, language)}
                        />
                    </div>
                ) : null}
            </div>
        </BaseModal>
    );
}
