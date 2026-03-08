'use client';

import { useState, useEffect } from 'react';
import { X, Save, Plus, Award, Check } from 'lucide-react';
import CompetencyTagInput from './CompetencyTagInput';

// ============================================================
// Validation helpers
// ============================================================
const THAI_RE    = /^[ก-๙\s\d()\-/.,]+$/;
const ENG_RE     = /^[a-zA-Z\s\d()\-/.,]+$/;

function validate(form) {
    const errors = {};
    if (!form.code.trim())
        errors.code = 'กรุณากรอกรหัสวิชา';
    if (!form.nameTh.trim())
        errors.nameTh = 'กรุณากรอกชื่อวิชาภาษาไทย';
    else if (!THAI_RE.test(form.nameTh.trim()))
        errors.nameTh = 'ชื่อวิชาภาษาไทยต้องเป็นภาษาไทยเท่านั้น';
    if (form.nameEn.trim() && !ENG_RE.test(form.nameEn.trim()))
        errors.nameEn = 'ชื่อวิชาภาษาอังกฤษต้องเป็นภาษาอังกฤษเท่านั้น';
    if (!form.credits)
        errors.credits = 'กรุณากรอกหน่วยกิต';
    else if (isNaN(Number(form.credits)) || Number(form.credits) < 1 || Number(form.credits) > 12)
        errors.credits = 'หน่วยกิตต้องเป็นตัวเลข 1–12';
    return errors;
}

// ============================================================
// CourseFormModal — ใช้ทั้งเพิ่มและแก้ไข
//
// Props:
//   mode            — 'add' | 'edit'
//   course          — course เดิม (สำหรับ edit)
//   initialWeights  — [{ competency, weight }] (สำหรับ edit)
//   competencies    — รายการ competency ทั้งหมด
//   onSave({ form, weights })
//   onCancel
//   onCreateCompetency(name) → competency
// ============================================================
export default function CourseFormModal({
    mode = 'add',
    course = null,
    initialWeights = [],
    competencies = [],
    onSave,
    onCancel,
    onCreateCompetency,
}) {
    const isEdit = mode === 'edit';

    const [form, setForm] = useState({ code: '', nameTh: '', nameEn: '', credits: '' });
    const [errors, setErrors] = useState({});
    const [touched, setTouched] = useState({});
    const [weights, setWeights] = useState([]); // [{ competency, weight }]
    const [saved, setSaved] = useState(false);  // animation บันทึกสำเร็จ

    // โหลดข้อมูลเดิมเมื่อ edit
    useEffect(() => {
        if (isEdit && course) {
            setForm({
                code:    course.code    || '',
                nameTh:  course.nameTh  || '',
                nameEn:  course.nameEn  || '',
                credits: course.credits != null ? String(course.credits) : '',
            });
            setWeights(initialWeights);
        }
    }, []);

    const totalWeight  = weights.reduce((s, w) => s + (Number(w.weight) || 0), 0);
    const isOverWeight = totalWeight > 100;
    const isExact      = totalWeight === 100;

    // ---- form helpers ----
    const set = (field) => (e) => {
        const val = e.target.value;
        setForm(p => ({ ...p, [field]: val }));
        // clear error ทันทีที่แก้
        if (touched[field]) {
            const newErrors = validate({ ...form, [field]: val });
            setErrors(p => ({ ...p, [field]: newErrors[field] }));
        }
    };

    const blur = (field) => () => {
        setTouched(p => ({ ...p, [field]: true }));
        const newErrors = validate(form);
        setErrors(p => ({ ...p, [field]: newErrors[field] }));
    };

    // ---- competency helpers ----
    const handleCompetencyChange = (newSelected) => {
        setWeights(prev => newSelected.map(comp => {
            const existing = prev.find(w => w.competency.id === comp.id);
            return existing ?? { competency: comp, weight: 0 };
        }));
    };

    const handleWeightChange = (compId, value) => {
        setWeights(prev => prev.map(w =>
            w.competency.id === compId
                ? { ...w, weight: Math.min(100, Math.max(0, Number(value) || 0)) }
                : w
        ));
    };

    // ---- submit ----
    const handleSave = () => {
        // touch all fields
        setTouched({ code: true, nameTh: true, nameEn: true, credits: true });
        const errs = validate(form);
        setErrors(errs);
        if (Object.keys(errs).length > 0) return;

        setSaved(true);
        setTimeout(() => {
            onSave({
                form: { ...form, credits: Number(form.credits) },
                weights,
            });
        }, 300);
    };

    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal-box modal-box--course" onClick={e => e.stopPropagation()}>

                {/* ── Header ── */}
                <div className="modal-header">
                    <h3>{isEdit ? 'แก้ไขรายวิชา' : 'เพิ่มรายวิชาใหม่'}</h3>
                    <button className="modal-close" onClick={onCancel}>
                        <X size={18} />
                    </button>
                </div>

                {/* ── Body ── */}
                <div className="modal-body">
                    <div className="cfm-grid">

                        {/* ─── ซ้าย: ข้อมูลวิชา ─── */}
                        <section className="cfm-section">
                            <h4 className="cfm-section__title">ข้อมูลรายวิชา</h4>

                            {/* รหัสวิชา */}
                            <div className={`cfm-field ${errors.code && touched.code ? 'cfm-field--error' : ''}`}>
                                <label className="cfm-label">
                                    รหัสวิชา <span className="cfm-required">*</span>
                                </label>
                                <input
                                    className="form-input"
                                    placeholder="เช่น CP351001"
                                    value={form.code}
                                    autoFocus={!isEdit}
                                    onChange={set('code')}
                                    onBlur={blur('code')}
                                />
                                {errors.code && touched.code && (
                                    <span className="cfm-error">{errors.code}</span>
                                )}
                            </div>

                            {/* ชื่อวิชาภาษาไทย */}
                            <div className={`cfm-field ${errors.nameTh && touched.nameTh ? 'cfm-field--error' : ''}`}>
                                <label className="cfm-label">
                                    ชื่อวิชาภาษาไทย <span className="cfm-required">*</span>
                                </label>
                                <input
                                    className="form-input"
                                    placeholder="ชื่อวิชาภาษาไทย"
                                    value={form.nameTh}
                                    onChange={set('nameTh')}
                                    onBlur={blur('nameTh')}
                                />
                                {errors.nameTh && touched.nameTh && (
                                    <span className="cfm-error">{errors.nameTh}</span>
                                )}
                            </div>

                            {/* ชื่อวิชาภาษาอังกฤษ */}
                            <div className={`cfm-field ${errors.nameEn && touched.nameEn ? 'cfm-field--error' : ''}`}>
                                <label className="cfm-label">ชื่อวิชาภาษาอังกฤษ</label>
                                <input
                                    className="form-input"
                                    placeholder="Course Name in English"
                                    value={form.nameEn}
                                    onChange={set('nameEn')}
                                    onBlur={blur('nameEn')}
                                />
                                {errors.nameEn && touched.nameEn && (
                                    <span className="cfm-error">{errors.nameEn}</span>
                                )}
                            </div>

                            {/* หน่วยกิต */}
                            <div className={`cfm-field ${errors.credits && touched.credits ? 'cfm-field--error' : ''}`}>
                                <label className="cfm-label">
                                    หน่วยกิต <span className="cfm-required">*</span>
                                </label>
                                <input
                                    className="form-input form-input--sm"
                                    type="number"
                                    min={1} max={12}
                                    placeholder="3"
                                    value={form.credits}
                                    onChange={set('credits')}
                                    onBlur={blur('credits')}
                                />
                                {errors.credits && touched.credits && (
                                    <span className="cfm-error">{errors.credits}</span>
                                )}
                            </div>
                        </section>

                        {/* ─── ขวา: Competency ─── */}
                        <section className="cfm-section">
                            <h4 className="cfm-section__title">
                                <Award size={14} /> ผูก Competency
                                <span className="cfm-section__hint">(ไม่บังคับ)</span>
                            </h4>

                            <CompetencyTagInput
                                competencies={competencies}
                                selected={weights.map(w => w.competency)}
                                onChange={handleCompetencyChange}
                                onCreateNew={onCreateCompetency}
                                placeholder="ค้นหาหรือสร้าง Competency..."
                            />

                            {weights.length > 0 && (
                                <div className="cfm-weights">
                                    <p className="cfm-weights__label">กำหนด Weight (%)</p>
                                    {weights.map(({ competency, weight }) => (
                                        <div key={competency.id} className="competency-row">
                                            <span
                                                className="competency-dot"
                                                style={{ background: competency.color || '#7dd3fc' }}
                                            />
                                            <span className="competency-name">{competency.name}</span>
                                            <div className="competency-weight">
                                                <input
                                                    className="weight-input"
                                                    type="number"
                                                    min={0} max={100}
                                                    placeholder="0"
                                                    value={weight || ''}
                                                    onChange={e => handleWeightChange(competency.id, e.target.value)}
                                                />
                                                <span className="weight-unit">%</span>
                                            </div>
                                        </div>
                                    ))}

                                    <div className={`weight-total
                                        ${isOverWeight ? 'weight-total--error' : ''}
                                        ${isExact      ? 'weight-total--ok'    : ''}`}
                                    >
                                        {isOverWeight && '⚠ เกิน 100% — '}
                                        {isExact && '✓ '}
                                        รวม {totalWeight}%
                                    </div>
                                </div>
                            )}
                        </section>
                    </div>
                </div>

                {/* ── Footer ── */}
                <div className="modal-footer">
                    <button className="btn btn--ghost" onClick={onCancel}>
                        ยกเลิก
                    </button>
                    <button
                        className={`btn btn--primary ${saved ? 'btn--saved' : ''}`}
                        onClick={handleSave}
                        disabled={saved}
                    >
                        {saved
                            ? <><Check size={15} /> บันทึกแล้ว</>
                            : <><Save size={15} /> {isEdit ? 'บันทึกการแก้ไข' : 'เพิ่มรายวิชา'}</>
                        }
                    </button>
                </div>

            </div>
        </div>
    );
}