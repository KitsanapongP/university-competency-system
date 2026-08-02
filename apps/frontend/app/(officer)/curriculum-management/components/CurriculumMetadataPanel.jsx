'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Pencil, Save, X } from 'lucide-react';
import './CurriculumMetadataPanel.css';

const DEGREE_LEVEL_LABELS = {
    bachelor: 'ปริญญาตรี',
    master: 'ปริญญาโท',
    phd: 'ปริญญาเอก',
    other: 'อื่น ๆ',
};

function createForm(curriculum, major) {
    return {
        facultyId: String(major?.facultyId || ''),
        majorId: String(curriculum?.majorId || ''),
        code: curriculum?.code || '',
        nameTh: curriculum?.nameTh || '',
        nameEn: curriculum?.nameEn || '',
        year: String(curriculum?.year || ''),
    };
}

function normalizeForm(form) {
    return {
        majorId: String(form.majorId || ''),
        code: String(form.code || '').trim(),
        nameTh: String(form.nameTh || '').trim(),
        nameEn: String(form.nameEn || '').trim(),
        year: String(form.year || '').trim(),
    };
}

function sameForm(left, right) {
    const normalizedLeft = normalizeForm(left);
    const normalizedRight = normalizeForm(right);
    return Object.keys(normalizedLeft).every(key => normalizedLeft[key] === normalizedRight[key]);
}

function FieldError({ message }) {
    return message ? <p className="curriculum-metadata-field-error">{message}</p> : null;
}

export default function CurriculumMetadataPanel({
    curriculum,
    majors = [],
    faculties = [],
    isAdmin = false,
    disabled = false,
    locked = false,
    activeTemplateCount = 0,
    fieldErrors = {},
    resetVersion = 0,
    onSave,
    onFieldChange,
    onEditingStateChange,
}) {
    const currentMajor = useMemo(
        () => majors.find(major => String(major.majorId) === String(curriculum?.majorId)),
        [curriculum?.majorId, majors],
    );
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState(() => createForm(curriculum, currentMajor));
    const resetVersionRef = useRef(resetVersion);

    useEffect(() => {
        if (!editing) {
            setForm(createForm(curriculum, currentMajor));
        }
    }, [curriculum, currentMajor, editing]);

    useEffect(() => {
        if (resetVersionRef.current === resetVersion) return;
        resetVersionRef.current = resetVersion;
        setForm(createForm(curriculum, currentMajor));
        setEditing(false);
    }, [currentMajor, curriculum, resetVersion]);

    const originalForm = useMemo(() => createForm(curriculum, currentMajor), [curriculum, currentMajor]);
    const dirty = !sameForm(form, originalForm);
    const canChangeMajor = curriculum?.status === 'draft';
    const selectedMajor = majors.find(major => String(major.majorId) === String(form.majorId)) || currentMajor;
    const selectedFaculty = faculties.find(faculty => String(faculty.facultyId) === String(form.facultyId));
    const majorOptions = majors.filter(major => {
        const isCurrentMajor = String(major.majorId) === String(curriculum?.majorId);
        const matchesFaculty = !form.facultyId || String(major.facultyId) === String(form.facultyId);
        return matchesFaculty && (major.isActive || isCurrentMajor);
    });
    const valid = Boolean(
        String(form.majorId || '').trim() &&
        String(form.code || '').trim() &&
        String(form.nameTh || '').trim() &&
        Number(form.year) > 0,
    );

    useEffect(() => {
        onEditingStateChange?.({ editing, dirty });
    }, [dirty, editing, onEditingStateChange]);

    useEffect(() => () => onEditingStateChange?.({ editing: false, dirty: false }), [onEditingStateChange]);

    const startEditing = () => {
        if (disabled || locked) return;
        setForm(createForm(curriculum, currentMajor));
        setEditing(true);
    };

    const cancelEditing = () => {
        setForm(createForm(curriculum, currentMajor));
        setEditing(false);
    };

    const updateField = (field, value) => {
        onFieldChange?.(field);
        setForm(current => ({ ...current, [field]: value }));
    };

    const updateFaculty = (facultyId) => {
        onFieldChange?.('majorId');
        setForm(current => ({
            ...current,
            facultyId,
            majorId: '',
        }));
    };

    const save = async () => {
        if (!valid || !dirty || disabled || locked) return;
        const saved = await onSave?.(normalizeForm(form));
        if (saved) {
            setEditing(false);
        }
    };

    const majorStatus = currentMajor && !currentMajor.isActive ? 'ปิดใช้งาน' : '';
    const degreeLabel = DEGREE_LEVEL_LABELS[currentMajor?.degreeLevel] || currentMajor?.degreeLevel || '-';

    return (
        <section className="curriculum-metadata-panel" aria-label="ข้อมูลหลักสูตร">
            <div className="curriculum-metadata-panel__header">
                <div>
                    <h2>ข้อมูลหลักสูตร</h2>
                    <p>ข้อมูลพื้นฐานและสาขาที่เชื่อมกับหลักสูตรนี้</p>
                </div>
                {!editing ? (
                    <button
                        type="button"
                        className="course-btn course-btn--primary"
                        onClick={startEditing}
                        disabled={disabled || locked}
                        title={locked ? `มี Active Template เชื่อมอยู่ ${activeTemplateCount} รายการ` : undefined}
                    >
                        <Pencil size={16} /> แก้ไขข้อมูล
                    </button>
                ) : (
                    <div className="curriculum-metadata-panel__actions">
                        <button type="button" className="course-btn course-btn--ghost" onClick={cancelEditing} disabled={disabled}>
                            <X size={16} /> ยกเลิก
                        </button>
                        <button type="button" className="course-btn course-btn--primary" onClick={save} disabled={disabled || !dirty || !valid}>
                            <Save size={16} /> บันทึก
                        </button>
                    </div>
                )}
            </div>

            {locked && (
                <div className="curriculum-metadata-lock" role="status">
                    ไม่สามารถแก้ไขข้อมูลหลักสูตรได้ เพราะมี Active Template เชื่อมอยู่ {activeTemplateCount} รายการ
                </div>
            )}

            {!editing ? (
                <dl className="curriculum-metadata-grid">
                    <div><dt>รหัสหลักสูตร</dt><dd>{curriculum?.code || '-'}</dd></div>
                    <div><dt>ปีการศึกษา</dt><dd>{curriculum?.year || '-'}</dd></div>
                    <div><dt>ชื่อหลักสูตร (ภาษาไทย)</dt><dd>{curriculum?.nameTh || '-'}</dd></div>
                    <div><dt>ชื่อหลักสูตร (ภาษาอังกฤษ)</dt><dd>{curriculum?.nameEn || '-'}</dd></div>
                    <div><dt>คณะ</dt><dd>{currentMajor?.facultyNameTh || '-'}</dd></div>
                    <div>
                        <dt>สาขา</dt>
                        <dd>
                            {currentMajor?.nameTh || curriculum?.degreeName || '-'}
                            {majorStatus && <span className="curriculum-metadata-status">{majorStatus}</span>}
                        </dd>
                    </div>
                    <div><dt>ระดับปริญญา</dt><dd>{degreeLabel}</dd></div>
                    <div>
                        <dt>จัดการข้อมูลสาขา</dt>
                        <dd>
                            <Link className="curriculum-metadata-link" href="/major-management">
                                ไปหน้าจัดการสาขา <ExternalLink size={14} />
                            </Link>
                        </dd>
                    </div>
                </dl>
            ) : (
                <div className="curriculum-metadata-form">
                    <label className="course-field">
                        <span className="course-label">รหัสหลักสูตร <span className="course-required">*</span></span>
                        <input className="course-input" value={form.code} onChange={event => updateField('code', event.target.value)} disabled={disabled} />
                        <FieldError message={fieldErrors.code} />
                    </label>
                    <label className="course-field">
                        <span className="course-label">ปีการศึกษา <span className="course-required">*</span></span>
                        <input className="course-input" type="number" min="1" value={form.year} onChange={event => updateField('year', event.target.value)} disabled={disabled} />
                        <FieldError message={fieldErrors.year} />
                    </label>
                    <label className="course-field curriculum-metadata-form__wide">
                        <span className="course-label">ชื่อหลักสูตร (ภาษาไทย) <span className="course-required">*</span></span>
                        <input className="course-input" value={form.nameTh} onChange={event => updateField('nameTh', event.target.value)} disabled={disabled} />
                        <FieldError message={fieldErrors.nameTh} />
                    </label>
                    <label className="course-field curriculum-metadata-form__wide">
                        <span className="course-label">ชื่อหลักสูตร (ภาษาอังกฤษ)</span>
                        <input className="course-input" value={form.nameEn} onChange={event => updateField('nameEn', event.target.value)} disabled={disabled} />
                    </label>

                    <label className="course-field">
                        <span className="course-label">คณะ</span>
                        <select
                            className="course-input"
                            value={form.facultyId}
                            onChange={event => updateFaculty(event.target.value)}
                            disabled={disabled || !canChangeMajor || !isAdmin}
                        >
                            <option value="">เลือกคณะ</option>
                            {faculties.map(faculty => <option key={faculty.facultyId} value={faculty.facultyId}>{faculty.nameTh}</option>)}
                        </select>
                        {!isAdmin && selectedFaculty && <span className="curriculum-metadata-field-hint">กำหนดตามสิทธิ์ผู้ใช้งาน</span>}
                    </label>
                    <label className="course-field">
                        <span className="course-label">สาขา <span className="course-required">*</span></span>
                        <select
                            className="course-input"
                            value={form.majorId}
                            onChange={event => updateField('majorId', event.target.value)}
                            disabled={disabled || !canChangeMajor}
                        >
                            <option value="">เลือกสาขา</option>
                            {majorOptions.map(major => (
                                <option key={major.majorId} value={major.majorId}>
                                    {major.nameTh}{!major.isActive ? ' (ปิดใช้งาน)' : ''}
                                </option>
                            ))}
                        </select>
                        {canChangeMajor ? <FieldError message={fieldErrors.majorId} /> : <span className="curriculum-metadata-field-hint">เปลี่ยนสาขาได้เฉพาะหลักสูตร Draft</span>}
                    </label>
                    <div className="curriculum-metadata-readonly">
                        <span>ระดับปริญญา</span>
                        <strong>{DEGREE_LEVEL_LABELS[selectedMajor?.degreeLevel] || selectedMajor?.degreeLevel || '-'}</strong>
                        <small>จัดการจากหน้าสาขา</small>
                    </div>
                </div>
            )}
        </section>
    );
}
