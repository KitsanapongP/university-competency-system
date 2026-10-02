'use client';

import { ArrowLeft, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { officerText } from '../../officer-labels';

const TEXT_FIELDS = [
    ['code', 'รหัสสายงาน', 'Career path code', 'required'],
    ['name_th', 'ชื่อภาษาไทย', 'Thai name', 'required'],
    ['name_en', 'ชื่อภาษาอังกฤษ', 'English name', 'clearable'],
    ['description_th', 'ลักษณะงานภาษาไทย', 'Thai work description', 'clearable'],
    ['description_en', 'ลักษณะงานภาษาอังกฤษ', 'English work description', 'clearable'],
    ['skills_description_th', 'ทักษะภาษาไทย', 'Thai skills', 'clearable'],
    ['skills_description_en', 'ทักษะภาษาอังกฤษ', 'English skills', 'clearable'],
    ['source_reference', 'แหล่งอ้างอิง', 'Source reference', 'clearable'],
];

function referenceName(item, language) {
    return language === 'en' ? item.nameEn || item.nameTh : item.nameTh || item.nameEn;
}

function RelationshipPicker({ title, items, selectedIds, language, disabled, clearable, cleared, onChange, onClear }) {
    const [query, setQuery] = useState('');
    const selected = new Set((selectedIds || []).map(Number));
    const filtered = useMemo(() => items.filter((item) => {
        const searchText = `${item.nameTh || ''} ${item.nameEn || ''}`.toLocaleLowerCase();
        return searchText.includes(query.trim().toLocaleLowerCase());
    }), [items, query]);
    const selectedNames = items.filter((item) => selected.has(Number(item.id))).map((item) => referenceName(item, language));

    return (
        <section className="career-import-editor__relation">
            <div className="career-import-editor__relation-heading">
                <div>
                    <h4>{title}</h4>
                    <p>{selectedNames.length ? selectedNames.join(' · ') : officerText(language, 'ยังไม่ได้เลือก', 'None selected')}</p>
                </div>
                <span>{officerText(language, `${selected.size} รายการ`, `${selected.size} selected`)}</span>
            </div>
            <label className="career-import-editor__search">
                <span className="sr-only">{officerText(language, `ค้นหา${title}`, `Search ${title}`)}</span>
                <input className="ui-input" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={officerText(language, 'ค้นหาจากชื่อ', 'Search by name')} disabled={disabled} />
            </label>
            <div className="career-import-editor__options">
                {filtered.length ? filtered.map((item) => (
                    <label className="career-import-editor__option" key={item.id}>
                        <input
                            type="checkbox"
                            checked={selected.has(Number(item.id))}
                            disabled={disabled}
                            onChange={(event) => {
                                const next = new Set(selected);
                                if (event.target.checked) next.add(Number(item.id));
                                else next.delete(Number(item.id));
                                onChange([...next]);
                            }}
                        />
                        <span>{referenceName(item, language)}</span>
                    </label>
                )) : <p className="career-import-editor__no-options">{officerText(language, 'ไม่พบรายการ', 'No matches')}</p>}
            </div>
            {clearable && (
                <label className="career-import-editor__clear">
                    <input type="checkbox" checked={cleared} disabled={disabled} onChange={(event) => onClear(event.target.checked)} />
                    {officerText(language, 'ล้างค่าที่มีอยู่เดิมอย่างชัดเจน', 'Clear existing values explicitly')}
                </label>
            )}
        </section>
    );
}

function fieldIssue(field, issues) {
    const mappedFields = field === 'code' ? ['code'] : [];
    return issues.filter((item) => mappedFields.includes(item.field));
}

export default function CareerPathImportEditor({
    item,
    language,
    curriculums,
    competencies,
    busy,
    mobile,
    onBack,
    onClose,
    onEditField,
    onEditRelationships,
    onClearField,
    onNavigateIssue,
    canNavigatePrevious,
    canNavigateNext,
    issueMessages,
}) {
    if (!item) {
        return (
            <div className="career-import-editor__empty">
                {officerText(language, 'เลือกรายการจากตารางเพื่อดูหรือแก้ไขรายละเอียด', 'Select a row to review or edit its details.')}
            </div>
        );
    }

    const { row, validation, issues } = item;
    const updateMode = row.actionIntent === 'update';
    const clearSet = new Set(row.clear_fields || []);
    const valueFor = (field) => {
        if (clearSet.has(field)) return '';
        if (Object.prototype.hasOwnProperty.call(row, field)) return row[field] ?? '';
        if (updateMode) return validation?.payload?.[field] ?? '';
        return '';
    };
    const relationshipFor = (field) => {
        if (clearSet.has(field)) return [];
        if (Object.prototype.hasOwnProperty.call(row, field)) return row[field] || [];
        if (updateMode) return validation?.payload?.[field] || [];
        return [];
    };

    return (
        <div className="career-import-editor">
            <header className="career-import-editor__header">
                <div className="career-import-editor__heading">
                    {mobile && <button type="button" className="ui-icon-button" onClick={onBack} aria-label={officerText(language, 'กลับไปรายการ', 'Back to rows')}><ArrowLeft size={18} /></button>}
                    <div>
                        <span>{officerText(language, `รายการ ${row.row_number}`, `Row ${row.row_number}`)}</span>
                        <h3>{row.name_th || row.code || officerText(language, 'รายการไม่มีชื่อ', 'Unnamed career path')}</h3>
                        {row.name_en && <p>{row.name_en}</p>}
                    </div>
                </div>
                <div className="career-import-editor__nav">
                    <button type="button" className="ui-icon-button" onClick={() => onNavigateIssue(-1)} disabled={!canNavigatePrevious} aria-label={officerText(language, 'รายการผิดพลาดก่อนหน้า', 'Previous issue')}><ChevronLeft size={18} /></button>
                    <button type="button" className="ui-icon-button" onClick={() => onNavigateIssue(1)} disabled={!canNavigateNext} aria-label={officerText(language, 'รายการผิดพลาดถัดไป', 'Next issue')}><ChevronRight size={18} /></button>
                    {!mobile && <button type="button" className="ui-icon-button" onClick={onClose} aria-label={officerText(language, 'ปิดรายละเอียด', 'Close details')}><X size={17} /></button>}
                </div>
            </header>

            {issues.length > 0 && (
                <div className="career-import-editor__errors" role="alert">
                    {issues.map((issue, index) => <p key={`${issue.code}-${issue.field}-${index}`}>{issueMessages(issue)}</p>)}
                </div>
            )}

            <div className="career-import-editor__content">
                <section className="career-import-editor__section">
                    <h4>{officerText(language, 'ข้อมูลสายงาน', 'Career path details')}</h4>
                    <div className="career-import-editor__fields">
                        {TEXT_FIELDS.map(([field, labelTh, labelEn, clearPolicy]) => {
                            const isLongText = field.startsWith('description_') || field.startsWith('skills_description_');
                            const clearable = updateMode && clearPolicy === 'clearable';
                            const fieldIssues = fieldIssue(field, issues);
                            return (
                                <label className={`ui-field career-import-editor__field ${isLongText ? 'career-import-editor__field--wide' : ''}`} key={field}>
                                    <span>{officerText(language, labelTh, labelEn)}{clearPolicy === 'required' && <b aria-hidden="true"> *</b>}</span>
                                    {isLongText
                                        ? <textarea className="ui-input" rows={3} value={valueFor(field)} onChange={(event) => onEditField(row.clientKey, field, event.target.value)} disabled={busy} aria-invalid={fieldIssues.length > 0} />
                                        : <input className="ui-input" value={valueFor(field)} onChange={(event) => onEditField(row.clientKey, field, event.target.value)} disabled={busy} aria-invalid={fieldIssues.length > 0} />}
                                    {fieldIssues.map((issue, index) => <span className="career-import-editor__field-error" key={`${issue.code}-${index}`}>{issueMessages(issue)}</span>)}
                                    {clearable && (
                                        <span className="career-import-editor__clear">
                                            <input type="checkbox" checked={clearSet.has(field)} disabled={busy} onChange={(event) => onClearField(row.clientKey, field, event.target.checked)} />
                                            {officerText(language, 'ล้างค่าที่มีอยู่เดิม', 'Clear existing value')}
                                        </span>
                                    )}
                                </label>
                            );
                        })}
                    </div>
                </section>

                <section className="career-import-editor__section">
                    <h4>{officerText(language, 'ความสัมพันธ์', 'Relationships')}</h4>
                    <RelationshipPicker
                        title={officerText(language, 'หลักสูตรที่ใช้สายงานนี้', 'Applicable curricula')}
                        items={curriculums}
                        selectedIds={relationshipFor('curriculum_ids')}
                        language={language}
                        disabled={busy}
                        clearable={updateMode}
                        cleared={clearSet.has('curriculum_ids')}
                        onChange={(ids) => onEditRelationships(row.clientKey, 'curriculum_ids', ids)}
                        onClear={(checked) => onClearField(row.clientKey, 'curriculum_ids', checked)}
                    />
                    <RelationshipPicker
                        title={officerText(language, 'สมรรถนะที่เกี่ยวข้อง', 'Relevant competencies')}
                        items={competencies}
                        selectedIds={relationshipFor('competency_ids')}
                        language={language}
                        disabled={busy}
                        clearable={updateMode}
                        cleared={clearSet.has('competency_ids')}
                        onChange={(ids) => onEditRelationships(row.clientKey, 'competency_ids', ids)}
                        onClear={(checked) => onClearField(row.clientKey, 'competency_ids', checked)}
                    />
                </section>

                {updateMode && validation?.previous && (
                    <section className="career-import-editor__section">
                        <h4>{officerText(language, 'เปรียบเทียบกับข้อมูลเดิม', 'Changes from current data')}</h4>
                        <div className="career-import-editor__diff">
                            {TEXT_FIELDS.filter(([field]) => field !== 'code').map(([field, labelTh, labelEn]) => {
                                const previous = validation.previous[field] || '';
                                const incoming = validation.payload?.[field] || '';
                                if (previous === incoming) return null;
                                return <div key={field}><strong>{officerText(language, labelTh, labelEn)}</strong><span>{previous || '-'}</span><b aria-hidden="true">→</b><span>{incoming || '-'}</span></div>;
                            })}
                            {[
                                ['curriculum_ids', curriculums, 'หลักสูตรที่ใช้สายงานนี้', 'Applicable curricula'],
                                ['competency_ids', competencies, 'สมรรถนะที่เกี่ยวข้อง', 'Relevant competencies'],
                            ].map(([field, options, titleTh, titleEn]) => {
                                const previousIds = validation.previous[field] || [];
                                const incomingIds = validation.payload?.[field] || [];
                                const names = (ids) => options.filter((option) => ids.map(Number).includes(Number(option.id))).map((option) => referenceName(option, language)).join(', ') || '-';
                                const previous = names(previousIds);
                                const incoming = names(incomingIds);
                                if (previous === incoming) return null;
                                return <div key={field}><strong>{officerText(language, titleTh, titleEn)}</strong><span>{previous}</span><b aria-hidden="true">→</b><span>{incoming}</span></div>;
                            })}
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
}
