'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Check, ChevronRight, ChevronDown, BookOpenCheck, PenLine, Search, ExternalLink, RefreshCw } from 'lucide-react';
import { fetchCurriculums, fetchCurriculumDetail } from '../../../../lib/curriculum';
import { useLanguage } from '../../../../providers/LanguageContext';

// ============================================================
// Step indicator
// ============================================================
function StepIndicator({ step, labels }) {
    const steps = labels;
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
// Step 1 — ข้อมูลหลักสูตร + เลือก Curriculum Master
// ============================================================
function Step1({ form, setForm, masters = [], setMasters, loadingMasters = false }) {
    const [search, setSearch] = useState('');
    const [previewId, setPreviewId] = useState(null);

    const filtered = masters.filter(m =>
        (m.nameTh && m.nameTh.toLowerCase().includes(search.toLowerCase())) ||
        (m.nameEn && m.nameEn.toLowerCase().includes(search.toLowerCase())) ||
        String(m.year || '').includes(search) ||
        (m.code && m.code.toLowerCase().includes(search.toLowerCase()))
    );

    const preview = masters.find(m => m.id === previewId);

    const handleMasterSelect = async (masterId) => {
        let master = masterId ? masters.find(m => m.id === masterId) : null;
        if (master && (!master.categories || master.categories.length === 0)) {
            try {
                const detail = await fetchCurriculumDetail(masterId);
                if (detail) {
                    master = { ...master, ...detail, name: detail.nameTh || detail.name || master.nameTh };
                    if (setMasters) setMasters(prev => prev.map(m => m.id === masterId ? master : m));
                }
            } catch (err) {
                console.error('Failed to fetch curriculum detail:', err);
            }
        } else if (master && !master.name) {
            master.name = master.nameTh || master.name;
        }
        setForm(p => ({ 
            ...p, 
            masterId
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
                <p className="tfm-hint">Template จะเป็นของหลักสูตรที่เลือก และเชื่อมกับรุ่นนักศึกษาในภายหลัง</p>
            </div>

            {/* Search */}
            <div className="tfm-search-wrap">
                <Search size={14} className="tfm-search-icon"/>
                <input className="tfm-search" value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="ค้นหาหลักสูตร..."/>
            </div>

            <div className="tfm-master-layout">
                <div className="tfm-master-picker">
                    {/* ตัวเลือก: ไม่เลือก master */}
                    <div
                        className={`tfm-master-card ${form.masterId === null ? 'tfm-master-card--selected' : ''}`}
                        onClick={() => handleMasterSelect(null)}
                        style={{ display: 'none' }}
                        aria-hidden="true"
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

                    <div className="tfm-master-list" aria-label="รายการหลักสูตร">
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
                        {!loadingMasters && filtered.length === 0 && (
                            <div className="tfm-master-list__empty">
                                ไม่พบหลักสูตรที่ตรงกับการค้นหา
                            </div>
                        )}
                    </div>
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

        </div>
    );
}

// ============================================================
// Step 2 — เลือก Competency
// ============================================================
function Step2({ form, setForm, allCompetencies, onRefreshCompetencies }) {
    const { t } = useLanguage();
    const [search, setSearch] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [refreshError, setRefreshError] = useState('');
    const refreshInFlightRef = useRef(false);

    const toggle = (id) => {
        setForm(previous => {
            const competencyIds = new Set(previous.competencyIds);
            if (competencyIds.has(id)) competencyIds.delete(id);
            else competencyIds.add(id);
            return { ...previous, competencyIds };
        });
    };

    const sortedCompetencies = useMemo(() => [...allCompetencies].sort((left, right) => {
        const nameComparison = String(left.nameTh || left.name || '').localeCompare(
            String(right.nameTh || right.name || ''),
            'th',
        );
        return nameComparison || String(left.code || '').localeCompare(String(right.code || ''), 'en');
    }), [allCompetencies]);

    const filteredCompetencies = useMemo(() => {
        const keyword = search.trim().toLowerCase();
        if (!keyword) return sortedCompetencies;

        return sortedCompetencies.filter(comp => [
            comp.code,
            comp.nameTh || comp.name,
            comp.nameEn,
        ].some(value => String(value || '').toLowerCase().includes(keyword)));
    }, [search, sortedCompetencies]);

    const selectedCompetencies = useMemo(() => sortedCompetencies.filter(comp => (
        form.competencyIds.has(comp.id)
    )), [form.competencyIds, sortedCompetencies]);

    const refreshCompetencies = useCallback(async () => {
        if (refreshInFlightRef.current || !onRefreshCompetencies) return;

        refreshInFlightRef.current = true;
        setRefreshing(true);
        setRefreshError('');
        try {
            await onRefreshCompetencies();
        } catch (error) {
            console.error('Failed to refresh competencies:', error);
            setRefreshError(t('template_competencies_load_failed'));
        } finally {
            refreshInFlightRef.current = false;
            setRefreshing(false);
        }
    }, [onRefreshCompetencies, t]);

    useEffect(() => {
        refreshCompetencies();
    }, [refreshCompetencies]);

    useEffect(() => {
        const handleFocus = () => refreshCompetencies();
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [refreshCompetencies]);

    const openCompetencyManagement = () => {
        window.open('/competency-management', '_blank', 'noopener,noreferrer');
    };

    return (
        <div className="tfm-step2">
            <div className="tfm-step2-header">
                <p className="tfm-hint" style={{ margin: 0 }}>{t('template_competency_picker_hint')}</p>
            </div>

            <div className="tfm-competency-toolbar">
                <div className="tfm-competency-search-wrap">
                    <Search size={15} className="tfm-search-icon" />
                    <input
                        className="tfm-search"
                        value={search}
                        onChange={event => setSearch(event.target.value)}
                        placeholder={t('template_competency_search')}
                    />
                </div>
                <button
                    type="button"
                    className="btn btn--ghost btn--sm tfm-competency-toolbar__button"
                    onClick={refreshCompetencies}
                    disabled={refreshing}
                    title={t('template_reload_competencies')}
                >
                    <RefreshCw size={14} className={refreshing ? 'tfm-competency-toolbar__refreshing' : ''} />
                    <span>{t('template_reload_competencies')}</span>
                </button>
                <button
                    type="button"
                    className="btn btn--ghost btn--sm tfm-competency-toolbar__button"
                    onClick={openCompetencyManagement}
                >
                    <ExternalLink size={14} />
                    <span>{t('template_manage_competencies')}</span>
                </button>
            </div>

            <div className="tfm-selected-competencies" aria-live="polite">
                <span className="tfm-selected-competencies__count">
                    {t('template_selected_competencies')} {selectedCompetencies.length}
                </span>
                {selectedCompetencies.length > 0 && (
                    <div className="tfm-selected-competencies__chips">
                        {selectedCompetencies.map(comp => (
                            <button
                                key={comp.id}
                                type="button"
                                className="tfm-selected-competencies__chip"
                                onClick={() => toggle(comp.id)}
                                title={t('template_remove_selected_competency')}
                            >
                                <span className="tfm-comp-dot" style={{ background: comp.color }} />
                                <span>{comp.nameTh || comp.name}</span>
                                <X size={13} />
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {refreshError && (
                <div className="tfm-competency-feedback" role="alert">
                    <span>{refreshError}</span>
                    <button type="button" className="tfm-competency-feedback__retry" onClick={refreshCompetencies}>
                        {t('template_retry')}
                    </button>
                </div>
            )}

            <div className="tfm-competency-list" aria-busy={refreshing}>
                {refreshing && filteredCompetencies.length === 0 && (
                    <div className="tfm-competency-empty">{t('loading')}</div>
                )}
                {filteredCompetencies.map(comp => {
                    const selected = form.competencyIds.has(comp.id);
                    return (
                        <label key={comp.id}
                            className={`tfm-competency-option ${selected ? 'tfm-competency-option--selected' : ''}`}
                            style={{ '--cc': comp.color }}
                        >
                            <input
                                type="checkbox"
                                className="tfm-competency-option__checkbox"
                                checked={selected}
                                onChange={() => toggle(comp.id)}
                            />
                            <span className="tfm-competency-option__indicator">
                                {selected && <Check size={13} />}
                            </span>
                            <span className="tfm-comp-dot" style={{ background: comp.color }} />
                            <span className="tfm-competency-option__content">
                                <span className="tfm-competency-option__name">{comp.nameTh || comp.name}</span>
                                <span className="tfm-competency-option__meta">{comp.code}{comp.nameEn ? ` • ${comp.nameEn}` : ''}</span>
                            </span>
                        </label>
                    );
                })}

                {!refreshing && filteredCompetencies.length === 0 && (
                    <div className="tfm-competency-empty">
                        <p>{t('template_competency_empty')}</p>
                        <button type="button" className="btn btn--ghost btn--sm" onClick={openCompetencyManagement}>
                            <ExternalLink size={14} />
                            {t('template_manage_competencies')}
                        </button>
                    </div>
                )}
            </div>

            {form.competencyIds.size === 0 && (
                <p className="tfm-warn">{t('template_competency_required')}</p>
            )}
        </div>
    );
}

// ============================================================
// TemplateFormModal — main export
// ============================================================
export default function TemplateFormModal({ onClose, onSave, allCompetencies = [], onRefreshCompetencies }) {
    const { t } = useLanguage();
    const [step, setStep] = useState(1);
    const [form, setForm] = useState({
        name:          '',
        masterId:      null,
        competencyIds: new Set(),
    });
    const [masters, setMasters] = useState([]);
    const [loadingMasters, setLoadingMasters] = useState(true);

    useEffect(() => {
        fetchCurriculums()
            .then(data => setMasters((data || []).map(m => ({ ...m, name: m.name || m.nameTh }))))
            .catch(err => {
                console.error('Failed to load curriculums:', err);
                setMasters([]);
            })
            .finally(() => setLoadingMasters(false));

    }, []);

    const canNext = step === 1
        ? form.name.trim().length > 0 && form.masterId !== null
        : form.competencyIds.size > 0;

    const handleSave = () => {
        if (!canNext) return;
        const master = masters.find(m => m.id === form.masterId) ?? null;
        onSave({
            name:              form.name.trim(),
            masterId:          form.masterId,
            masterData:        master,
            competencyIds:     [...form.competencyIds],
        });
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box modal-box--tfm" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{t('template_create_title')}</h3>
                    <button className="modal-close" onClick={onClose}><X size={18}/></button>
                </div>
                <div style={{ padding: '0.75rem 1.5rem 0' }}>
                    <StepIndicator step={step} labels={[t('template_step_curriculum'), t('template_step_competency')]}/>
                </div>
                <div className="modal-body tfm-body">
                    {step === 1 && <Step1 form={form} setForm={setForm} masters={masters} setMasters={setMasters} loadingMasters={loadingMasters}/>}
                    {step === 2 && (
                        <Step2
                            form={form}
                            setForm={setForm}
                            allCompetencies={allCompetencies}
                            onRefreshCompetencies={onRefreshCompetencies}
                        />
                    )}
                </div>
                <div className="modal-footer">
                    {step === 1
                        ? <button className="btn btn--ghost" onClick={onClose}>{t('template_cancel')}</button>
                        : <button className="btn btn--ghost" onClick={() => setStep(1)}>← {t('template_back')}</button>
                    }
                    {step === 1
                        ? <button className="btn btn--primary" disabled={!canNext} onClick={() => setStep(2)}>{t('template_next')} →</button>
                        : <button className="btn btn--primary" disabled={!canNext} onClick={handleSave}><Check size={15}/> {t('template_create_action')}</button>
                    }
                </div>
            </div>
        </div>
    );
}
