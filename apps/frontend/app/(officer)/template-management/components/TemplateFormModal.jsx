'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Check, ChevronRight, ChevronDown, BookOpenCheck, PenLine, Search } from 'lucide-react';
import { fetchCurriculums } from '../../../../lib/curriculum';
import { fetchCompetencies } from '../../../../lib/competency';

// ============================================================
// Step indicator
// ============================================================
function StepIndicator({ step }) {
    const steps = ['ข้อมูลหลักสูตร', 'เลือก Competency'];
    return (
        <div className="tfm-steps">
            {steps.map((label, i) => {
                const n = i + 1;
                const active  = step === n;
                const done    = step > n;
                return (
                    <div key={n} className={`tfm-step ${active ? 'tfm-step--active' : ''} ${done ? 'tfm-step--done' : ''}`}>
                        <span className="tfm-step__num">{done ? <Check size={11}/> : n}</span>
                        <span className="tfm-step__label">{label}</span>
                        {i < steps.length - 1 && <span className="tfm-step__line"/>}
                    </div>
                );
            })}
        </div>
    );
}

// ============================================================
// CourseMasterTree — แสดง category/course ของ master
// ============================================================
function CourseMasterTree({ categories, depth = 0 }) {
    const [expanded, setExpanded] = useState({});
    const toggle = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }));

    return (
        <div>
            {categories.map(cat => {
                const hasChildren = cat.children?.length > 0;
                const hasCourses  = cat.courses?.length > 0;
                const isOpen      = expanded[cat.id] !== false;

                return (
                    <div key={cat.id}>
                        <div
                            className="master-cat-row"
                            style={{ paddingLeft: `${0.5 + depth * 0.875}rem` }}
                            onClick={() => toggle(cat.id)}
                        >
                            <span className="master-cat-row__toggle">
                                {(hasChildren || hasCourses)
                                    ? (isOpen ? <ChevronDown size={12}/> : <ChevronRight size={12}/>)
                                    : <span style={{width:12}}/>}
                            </span>
                            <span className="master-cat-row__code">{cat.code}</span>
                            <span className="master-cat-row__name">{cat.name}</span>
                            {hasCourses && (
                                <span className="master-cat-row__badge">{cat.courses.length} วิชา</span>
                            )}
                        </div>

                        {isOpen && (
                            <>
                                {hasCourses && cat.courses.map(course => (
                                    <div key={course.id} className="master-course-row"
                                        style={{ paddingLeft: `${1.25 + depth * 0.875}rem` }}>
                                        <span className="master-course-row__code">{course.code}</span>
                                        <span className="master-course-row__name">{course.nameTh || course.nameEn}</span>
                                        <span className="master-course-row__credits">{course.credits} น.</span>
                                    </div>
                                ))}
                                {hasChildren && (
                                    <CourseMasterTree categories={cat.children} depth={depth + 1}/>
                                )}
                            </>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ============================================================
// AcademicYearSelector — เลือก 1 ปีการศึกษา
// ============================================================
function AcademicYearSelector({ year, onChange }) {
    const currentYear = new Date().getFullYear() + 543;

    return (
        <div className="tfm-year-selector">
            <label className="cfm-label">ปีการศึกษา <span className="cfm-required">*</span></label>
            <input
                type="number"
                className="cfm-input"
                min={currentYear}
                value={year || ''}
                placeholder={`ระบุปี พ.ศ. (ตั้งแต่ ${currentYear} เป็นต้นไป)`}
                onChange={e => {
                    const val = e.target.value ? parseInt(e.target.value, 10) : '';
                    onChange(val);
                }}
                onBlur={e => {
                    const val = parseInt(e.target.value, 10);
                    if (isNaN(val) || val < currentYear) {
                        onChange(currentYear);
                    }
                }}
            />
            <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem', display: 'block' }}>
                * กรอกเป็นตัวเลขปี พ.ศ. ตั้งแต่ปีปัจจุบัน ({currentYear}) เป็นต้นไป (ห้ามกรอกปีย้อนหลัง)
            </span>
        </div>
    );
}

// ============================================================
// Step 1 — ข้อมูลหลักสูตร + เลือก Curriculum Master
// ============================================================
function Step1({ form, setForm, masters = [], loadingMasters = false }) {
    const [search, setSearch] = useState('');
    const [previewId, setPreviewId] = useState(null);

    const filtered = masters.filter(m =>
        (m.nameTh && m.nameTh.toLowerCase().includes(search.toLowerCase())) ||
        (m.nameEn && m.nameEn.toLowerCase().includes(search.toLowerCase())) ||
        String(m.year || '').includes(search) ||
        (m.code && m.code.toLowerCase().includes(search.toLowerCase()))
    );

    const preview = masters.find(m => m.id === previewId);

    const handleMasterSelect = (masterId) => {
        const master = masterId ? masters.find(m => m.id === masterId) : null;
        const currentYear = new Date().getFullYear() + 543;
        const targetYear = master && master.year && Number(master.year) >= currentYear 
            ? Number(master.year) 
            : currentYear;
        setForm(p => ({ 
            ...p, 
            masterId,
            academicYear: targetYear
        }));
        setPreviewId(masterId);
    };

    return (
        <div className="tfm-step1">
            {/* ชื่อ */}
            <div className="cfm-field">
                <label className="cfm-label">ชื่อ Template <span className="cfm-required">*</span></label>
                <input className="cfm-input" autoFocus
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="เช่น หลักสูตรวิทยาการคอมพิวเตอร์"
                />
            </div>

            {/* เลือก Curriculum Master */}
            <div className="cfm-field" style={{ marginTop: '1.25rem' }}>
                <label className="cfm-label">หลักสูตร <span className="cfm-required">*</span></label>
                <p className="tfm-hint">เลือกหลักสูตรต้นแบบ ปีการศึกษาจะถูกกำหนดอัตโนมัติตามหลักสูตรที่เลือก</p>
            </div>

            {/* Search */}
            <div className="tfm-search-wrap">
                <Search size={14} className="tfm-search-icon"/>
                <input className="tfm-search" value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="ค้นหาหลักสูตร..."/>
            </div>

            <div className="tfm-master-layout">
                {/* รายการ master */}
                <div className="tfm-master-list">
                    {/* ตัวเลือก: ไม่เลือก master */}
                    <div
                        className={`tfm-master-card ${form.masterId === null ? 'tfm-master-card--selected' : ''}`}
                        onClick={() => handleMasterSelect(null)}
                    >
                        <div className={`tfm-master-card__icon ${form.masterId === null ? 'tfm-master-card__icon--blue' : ''}`}>
                            <PenLine size={20}/>
                        </div>
                        <div>
                            <div className={`tfm-master-card__name ${form.masterId === null ? 'tfm-master-card__name--selected' : ''}`}>
                                สร้างใหม่ทั้งหมด
                            </div>
                            <div 
                                className={`tfm-master-card__meta ${form.masterId === null ? 'tfm-master-card__meta--selected' : ''}`}>
                                กรอกหมวดวิชาและรายวิชาเอง
                            </div>
                        </div>
                        {form.masterId === null && <Check size={16} className="tfm-master-card__check"/>}
                    </div>

                    {loadingMasters && (
                        <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
                            กำลังโหลดรายชื่อหลักสูตรจากระบบ...
                        </div>
                    )}
                    {!loadingMasters && filtered.map(m => (
                        <div key={m.id}
                            className={`tfm-master-card ${form.masterId === m.id ? 'tfm-master-card--selected' : ''}`}
                            onClick={() => handleMasterSelect(m.id)}
                        >
                            <div className={`tfm-master-card__icon ${form.masterId === m.id ? 'tfm-master-card__icon--blue' : ''}`}>
                                <BookOpenCheck size={20}/>
                            </div>
                            <div>
                                <div className={`tfm-master-card__name ${form.masterId === m.id ? 'tfm-master-card__name--selected' : ''}`}>
                                    {m.nameTh}
                                </div>
                                <div className={`tfm-master-card__meta ${form.masterId === m.id ? 'tfm-master-card__meta--selected' : ''}`}>
                                    {m.degreeName ? `${m.degreeName} • ` : ''}ปี {m.year}
                                </div>
                            </div>
                            {form.masterId === m.id && <Check size={16} className="tfm-master-card__check"/>}
                        </div>
                    ))}
                </div>

                {/* Preview */}
                {preview ? (
                    <div className="tfm-master-preview">
                        <div className="tfm-preview-header">
                            <span>{preview.nameTh} ({preview.year})</span>
                        </div>
                        <div className="tfm-preview-body">
                            <CourseMasterTree categories={preview.categories}/>
                        </div>
                    </div>
                ) : (
                    <div className="tfm-master-preview tfm-master-preview--empty">
                        <BookOpenCheck size={28} opacity={0.2}/>
                        <span>เลือก Curriculum Master เพื่อดูตัวอย่าง</span>
                    </div>
                )}
            </div>

            {/* แสดงปีการศึกษาที่เลือก */}
            <div className="tfm-selected-year">
                <AcademicYearSelector
                    year={form.academicYear}
                    onChange={(year) => setForm(p => ({ ...p, academicYear: year }))}
                />
            </div>
        </div>
    );
}

// ============================================================
// สีสำหรับสุ่ม
// ============================================================
const PRESET_COLORS = [
    '#ec4899','#3b82f6','#06b6d4','#f59e0b',
    '#10b981','#8b5cf6','#ef4444','#f97316',
    '#14b8a6','#a855f7','#84cc16','#0ea5e9',
];

function randomColor(excludeColors = []) {
    const pool = PRESET_COLORS.filter(c => !excludeColors.includes(c));
    return pool[Math.floor(Math.random() * pool.length)] || PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];
}

// ============================================================
// Step 2 — เลือก Competency
// ============================================================
function Step2({ form, setForm, allCompetencies, onAddCompetency }) {
    const [newName,  setNewName]  = useState('');
    const [newColor, setNewColor] = useState(() => randomColor(allCompetencies.map(c => c.color)));
    const [adding,   setAdding]   = useState(false);

    const toggle = (id) => {
        setForm(p => {
            const set = new Set(p.competencyIds);
            if (set.has(id)) set.delete(id);
            else set.add(id);
            return { ...p, competencyIds: set };
        });
    };

    const handleAdd = () => {
        if (!newName.trim()) return;
        const added = onAddCompetency(newName.trim(), newColor);
        setForm(p => {
            const set = new Set(p.competencyIds);
            set.add(added.id);
            return { ...p, competencyIds: set };
        });
        setNewName('');
        setNewColor(randomColor(allCompetencies.map(c => c.color)));
        setAdding(false);
    };

    return (
        <div className="tfm-step2">
            <div className="tfm-step2-header">
                <p className="tfm-hint" style={{margin:0}}>เลือก Competency ที่ต้องการผูกกับรายวิชาในหลักสูตรนี้ (เลือกได้หลายตัว)</p>
            </div>

            {/* Inline form เพิ่ม Competency ใหม่ */}
            {adding && (
                <div className="tfm-add-comp-form">
                    {/* Color picker + swatch */}
                    <div className="tfm-color-section">
                        <div className="tfm-color-preview" style={{ background: newColor }}/>
                        <div className="tfm-preset-colors">
                            {PRESET_COLORS.map(c => (
                                <button key={c}
                                    className={`tfm-preset-dot ${newColor === c ? 'tfm-preset-dot--active' : ''}`}
                                    style={{ background: c }}
                                    onClick={() => setNewColor(c)}
                                    title={c}
                                />
                            ))}
                        </div>
                        <label className="tfm-custom-color" title="เลือกสีเอง">
                            <input type="color" value={newColor}
                                onChange={e => setNewColor(e.target.value)}
                                style={{ opacity:0, position:'absolute', width:1, height:1 }}/>
                            <span className="tfm-custom-color__icon">🎨</span>
                        </label>
                    </div>

                    {/* ชื่อ + ปุ่ม */}
                    <div className="tfm-add-comp-row">
                        <input
                            className="cfm-input tfm-comp-name-input"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false); }}
                            placeholder="ชื่อ Competency..."
                            autoFocus
                        />
                        <button className="btn btn--primary btn--sm" onClick={handleAdd} disabled={!newName.trim()}>
                            <Check size={13}/> เพิ่ม
                        </button>
                        <button className="btn btn--ghost btn--sm" onClick={() => setAdding(false)}>
                            ยกเลิก
                        </button>
                    </div>
                </div>
            )}

            {/* Grid การ์ด */}
            <div className="tfm-comp-grid">
                {allCompetencies.map(comp => {
                    const selected = form.competencyIds.has(comp.id);
                    return (
                        <div key={comp.id}
                            className={`tfm-comp-card ${selected ? 'tfm-comp-card--selected' : ''}`}
                            style={{ '--cc': comp.color }}
                            onClick={() => toggle(comp.id)}
                        >
                            <div className="tfm-comp-card__dot" style={{ background: comp.color }}/>
                            <span className="tfm-comp-card__name">{comp.name}</span>
                            {selected && <Check size={14} className="tfm-comp-card__check"/>}
                        </div>
                    );
                })}
            </div>

            {form.competencyIds.size === 0 && (
                <p className="tfm-warn">⚠ กรุณาเลือก Competency อย่างน้อย 1 ตัว</p>
            )}
        </div>
    );
}

// ============================================================
// TemplateFormModal — main export
// ============================================================
export default function TemplateFormModal({ onClose, onSave, allCompetencies = [] }) {
    const [step, setStep] = useState(1);
    const [form, setForm] = useState({
        name:          '',
        academicYear:  new Date().getFullYear() + 543,
        masterId:      null,
        competencyIds: new Set(),
    });
    const [localComps, setLocalComps] = useState(allCompetencies);
    const localCompIdRef = useRef(9900);

    const [masters, setMasters] = useState([]);
    const [loadingMasters, setLoadingMasters] = useState(true);

    useEffect(() => {
        fetchCurriculums()
            .then(data => setMasters(data || []))
            .catch(err => {
                console.error('Failed to load curriculums:', err);
                setMasters([]);
            })
            .finally(() => setLoadingMasters(false));

        if (allCompetencies.length === 0) {
            fetchCompetencies()
                .then(comps => {
                    if (Array.isArray(comps) && comps.length > 0) {
                        const mapped = comps.map((c, idx) => ({
                            id: c.id || c.competency_id,
                            code: c.code || `comp_${idx}`,
                            name: c.name_th || c.name || '',
                            color: PRESET_COLORS[idx % PRESET_COLORS.length],
                        }));
                        setLocalComps(mapped);
                    }
                })
                .catch(err => console.error('Failed to load competencies:', err));
        } else {
            setLocalComps(allCompetencies);
        }
    }, [allCompetencies]);

    const handleAddCompetency = (name, color) => {
        const newComp = { id: ++localCompIdRef.current, code: `new_${localCompIdRef.current}`, name, color };
        setLocalComps(p => [...p, newComp]);
        return newComp;
    };

    const canNext = step === 1
        ? form.name.trim().length > 0 && form.masterId !== null
        : form.competencyIds.size > 0;

    const handleSave = () => {
        if (!canNext) return;
        const master = masters.find(m => m.id === form.masterId) ?? null;
        onSave({
            name:              form.name.trim(),
            academicYear:      form.academicYear,
            masterId:          form.masterId,
            masterData:        master,
            competencyIds:     [...form.competencyIds],
            newCompetencies:   localComps.filter(c => !allCompetencies.find(a => a.id === c.id)),
        });
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box modal-box--tfm" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>สร้าง Template ใหม่</h3>
                    <button className="modal-close" onClick={onClose}><X size={18}/></button>
                </div>
                <div style={{ padding: '0.75rem 1.5rem 0' }}>
                    <StepIndicator step={step}/>
                </div>
                <div className="modal-body tfm-body">
                    {step === 1 && <Step1 form={form} setForm={setForm} masters={masters} loadingMasters={loadingMasters}/>}
                    {step === 2 && (
                        <Step2
                            form={form}
                            setForm={setForm}
                            allCompetencies={localComps}
                            onAddCompetency={handleAddCompetency}
                        />
                    )}
                </div>
                <div className="modal-footer">
                    {step === 1
                        ? <button className="btn btn--ghost" onClick={onClose}>ยกเลิก</button>
                        : <button className="btn btn--ghost" onClick={() => setStep(1)}>← ย้อนกลับ</button>
                    }
                    {step === 1
                        ? <button className="btn btn--primary" disabled={!canNext} onClick={() => setStep(2)}>ถัดไป →</button>
                        : <button className="btn btn--primary" disabled={!canNext} onClick={handleSave}><Check size={15}/> สร้าง Template</button>
                    }
                </div>
            </div>
        </div>
    );
}
