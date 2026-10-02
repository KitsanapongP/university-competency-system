'use client';

import { useMemo, useState } from 'react';
import { Save, Search } from 'lucide-react';
import BaseModal from '../../../../components/ui/BaseModal';
import { officerText } from '../../officer-labels';
import './CareerPathFormModal.css';

const EMPTY_FORM = {
    facultyId: '',
    code: '',
    nameTh: '',
    nameEn: '',
    descriptionTh: '',
    descriptionEn: '',
    skillsTh: '',
    skillsEn: '',
    sourceReference: '',
    curriculumIds: [],
    competencyIds: [],
};

function fromVersion(careerPath, facultyId) {
    const version = careerPath?.draftVersion || careerPath?.publishedVersion;
    return {
        ...EMPTY_FORM,
        facultyId: String(careerPath?.facultyId || facultyId || ''),
        code: careerPath?.code || '',
        nameTh: version?.nameTh || '',
        nameEn: version?.nameEn || '',
        descriptionTh: version?.descriptionTh || '',
        descriptionEn: version?.descriptionEn || '',
        skillsTh: version?.skillsTh || '',
        skillsEn: version?.skillsEn || '',
        sourceReference: version?.sourceReference || '',
        curriculumIds: (version?.curricula || []).map((item) => Number(item.id)),
        competencyIds: (version?.competencies || []).map((item) => Number(item.id)),
    };
}

function searchableLabel(item, language) {
    const name = language === 'en' ? item.nameEn || item.nameTh : item.nameTh || item.nameEn;
    return [name, item.code].filter(Boolean).join(' · ');
}

function OptionPicker({ title, items, selectedIds, onChange, language, emptyLabel }) {
    const [search, setSearch] = useState('');
    const visibleItems = useMemo(() => {
        const normalized = search.trim().toLocaleLowerCase();
        if (!normalized) return items;
        return items.filter((item) => searchableLabel(item, language).toLocaleLowerCase().includes(normalized));
    }, [items, language, search]);

    const toggle = (id) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        onChange([...next]);
    };

    return (
        <section className="career-picker" aria-label={title}>
            <div className="career-picker__header">
                <strong>{title}</strong>
                <span>{selectedIds.length}</span>
            </div>
            <label className="career-picker__search">
                <Search size={16} aria-hidden="true" />
                <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={officerText(language, 'ค้นหาจากชื่อ', 'Search by name')}
                    aria-label={officerText(language, 'ค้นหา', 'Search')}
                />
            </label>
            <div className="career-picker__actions">
                <button type="button" onClick={() => onChange(items.map((item) => Number(item.id)))}>
                    {officerText(language, 'เลือกทั้งหมด', 'Select all')}
                </button>
                <button type="button" onClick={() => onChange([])}>
                    {officerText(language, 'ล้าง', 'Clear')}
                </button>
            </div>
            <div className="career-picker__options">
                {visibleItems.length ? visibleItems.map((item) => {
                    const id = Number(item.id);
                    return (
                        <label className="career-picker__option" key={id}>
                            <input
                                type="checkbox"
                                checked={selectedIds.includes(id)}
                                onChange={() => toggle(id)}
                            />
                            <span>{searchableLabel(item, language)}</span>
                        </label>
                    );
                }) : <p className="career-picker__empty">{emptyLabel}</p>}
            </div>
        </section>
    );
}

export default function CareerPathFormModal({
    open,
    careerPath,
    faculties,
    curriculums,
    competencies,
    facultyId,
    isAdmin,
    language,
    submitting,
    onClose,
    onSave,
}) {
    const [form, setForm] = useState(() => fromVersion(careerPath, facultyId));
    const [errors, setErrors] = useState({});
    const [submitError, setSubmitError] = useState('');

    const scopedCurriculums = useMemo(
        () => curriculums.filter((item) => String(item.facultyId) === String(form.facultyId)),
        [curriculums, form.facultyId],
    );

    const setField = (field, value) => {
        setForm((current) => ({ ...current, [field]: value }));
        setErrors((current) => ({ ...current, [field]: '' }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        const nextErrors = {};
        if (!form.facultyId) nextErrors.facultyId = officerText(language, 'กรุณาเลือกคณะ', 'Select a faculty.');
        if (!form.code.trim()) nextErrors.code = officerText(language, 'กรุณากรอกรหัสสายงาน', 'Enter a career path code.');
        if (!form.nameTh.trim()) nextErrors.nameTh = officerText(language, 'กรุณากรอกชื่อภาษาไทย', 'Enter the Thai name.');
        if (Object.keys(nextErrors).length) {
            setErrors(nextErrors);
            return;
        }
        try {
            setSubmitError('');
            await onSave(form);
        } catch (error) {
            setSubmitError(error?.status === 409
                ? officerText(language, 'ข้อมูลฉบับร่างเปลี่ยนไปแล้ว กรุณาปิดหน้าต่างและโหลดข้อมูลล่าสุดก่อนแก้ไขต่อ', 'This draft changed elsewhere. Close this form and reload the latest version before continuing.')
                : officerText(language, 'บันทึกร่างไม่สำเร็จ กรุณาตรวจสอบข้อมูลแล้วลองอีกครั้ง', 'Unable to save the draft. Check the information and try again.'));
        }
    };

    const title = careerPath
        ? officerText(language, 'แก้ไขร่างสายงาน', 'Edit career path draft')
        : officerText(language, 'เพิ่มสายงาน', 'Add career path');

    return (
        <BaseModal
            open={open}
            title={title}
            size="xxl"
            onClose={onClose}
            closeDisabled={submitting}
            footer={(
                <>
                    <button type="button" className="ui-button ui-button--secondary" onClick={onClose} disabled={submitting}>
                        {officerText(language, 'ยกเลิก', 'Cancel')}
                    </button>
                    <button type="submit" form="career-path-form" className="ui-button ui-button--primary" disabled={submitting}>
                        <Save size={16} />
                        {submitting ? officerText(language, 'กำลังบันทึก...', 'Saving...') : officerText(language, 'บันทึกร่าง', 'Save draft')}
                    </button>
                </>
            )}
        >
            <form id="career-path-form" className="career-form" onSubmit={handleSubmit} noValidate>
                {submitError && <p className="career-form__error" role="alert">{submitError}</p>}
                {careerPath?.status === 'active' && (
                    <p className="career-form__notice">
                        {officerText(language, 'การแก้ไขจะสร้างฉบับร่างใหม่ สายงานฉบับที่เปิดใช้งานอยู่จะยังใช้ต่อจนกว่าจะเปิดฉบับใหม่', 'Changes create a new draft. The published version remains in use until the new draft is published.')}
                    </p>
                )}
                <div className="career-form__grid">
                    <label className="ui-field">
                        <span>{officerText(language, 'คณะ', 'Faculty')} <b>*</b></span>
                        {isAdmin ? (
                            <select className="ui-select" value={form.facultyId} onChange={(event) => setField('facultyId', event.target.value)}>
                                <option value="">{officerText(language, 'เลือกคณะ', 'Select a faculty')}</option>
                                {faculties.map((item) => (
                                    <option key={item.facultyId} value={item.facultyId}>
                                        {language === 'en' ? item.nameEn || item.nameTh : item.nameTh || item.nameEn}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <input className="ui-input" value={faculties.find((item) => String(item.facultyId) === String(form.facultyId))?.nameTh || ''} readOnly />
                        )}
                        {errors.facultyId && <small className="career-form__field-error">{errors.facultyId}</small>}
                    </label>
                    <label className="ui-field">
                        <span>{officerText(language, 'รหัสสายงาน', 'Career path code')} <b>*</b></span>
                        <input className="ui-input" value={form.code} onChange={(event) => setField('code', event.target.value)} maxLength={80} aria-invalid={Boolean(errors.code)} />
                        {errors.code && <small className="career-form__field-error">{errors.code}</small>}
                    </label>
                    <label className="ui-field">
                        <span>{officerText(language, 'ชื่อภาษาไทย', 'Thai name')} <b>*</b></span>
                        <input className="ui-input" value={form.nameTh} onChange={(event) => setField('nameTh', event.target.value)} aria-invalid={Boolean(errors.nameTh)} />
                        {errors.nameTh && <small className="career-form__field-error">{errors.nameTh}</small>}
                    </label>
                    <label className="ui-field">
                        <span>{officerText(language, 'ชื่อภาษาอังกฤษ', 'English name')}</span>
                        <input className="ui-input" value={form.nameEn} onChange={(event) => setField('nameEn', event.target.value)} />
                    </label>
                    <label className="ui-field">
                        <span>{officerText(language, 'ลักษณะงาน (ภาษาไทย)', 'Work description (Thai)')}</span>
                        <textarea className="ui-input" value={form.descriptionTh} onChange={(event) => setField('descriptionTh', event.target.value)} rows={3} />
                    </label>
                    <label className="ui-field">
                        <span>{officerText(language, 'ลักษณะงาน (ภาษาอังกฤษ)', 'Work description (English)')}</span>
                        <textarea className="ui-input" value={form.descriptionEn} onChange={(event) => setField('descriptionEn', event.target.value)} rows={3} />
                    </label>
                    <label className="ui-field">
                        <span>{officerText(language, 'ทักษะที่เกี่ยวข้อง (ภาษาไทย)', 'Related skills (Thai)')}</span>
                        <textarea className="ui-input" value={form.skillsTh} onChange={(event) => setField('skillsTh', event.target.value)} rows={3} />
                    </label>
                    <label className="ui-field">
                        <span>{officerText(language, 'ทักษะที่เกี่ยวข้อง (ภาษาอังกฤษ)', 'Related skills (English)')}</span>
                        <textarea className="ui-input" value={form.skillsEn} onChange={(event) => setField('skillsEn', event.target.value)} rows={3} />
                    </label>
                    <label className="ui-field career-form__source">
                        <span>{officerText(language, 'แหล่งอ้างอิง/หมายเหตุ', 'Source / notes')}</span>
                        <input className="ui-input" value={form.sourceReference} onChange={(event) => setField('sourceReference', event.target.value)} />
                    </label>
                </div>
                <div className="career-form__pickers">
                    <OptionPicker
                        title={officerText(language, 'หลักสูตรที่เกี่ยวข้อง', 'Applicable curricula')}
                        items={scopedCurriculums.map((item) => ({
                            id: item.id,
                            code: item.code,
                            nameTh: [item.nameTh, item.degreeName].filter(Boolean).join(' · '),
                            nameEn: [item.nameEn || item.nameTh, item.degreeNameEn || item.degreeName].filter(Boolean).join(' · '),
                        }))}
                        selectedIds={form.curriculumIds}
                        onChange={(value) => setField('curriculumIds', value)}
                        language={language}
                        emptyLabel={officerText(language, 'ไม่พบหลักสูตรในคณะที่เลือก', 'No curricula found for this faculty.')}
                    />
                    <OptionPicker
                        title={officerText(language, 'สมรรถนะที่ใช้ประกอบคำแนะนำ (ไม่บังคับ)', 'Supporting competencies (optional)')}
                        items={competencies}
                        selectedIds={form.competencyIds}
                        onChange={(value) => setField('competencyIds', value)}
                        language={language}
                        emptyLabel={officerText(language, 'ไม่พบสมรรถนะ', 'No competencies found.')}
                    />
                </div>
            </form>
        </BaseModal>
    );
}
