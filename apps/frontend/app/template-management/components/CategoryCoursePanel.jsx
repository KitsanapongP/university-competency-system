'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
    Plus, Trash2, GripVertical, ChevronRight, ChevronDown,
    BookOpen, AlertCircle, Check, X, Pencil, SlidersHorizontal, LockKeyhole
} from 'lucide-react';

function isLeaf(cat) { return !cat.children?.length; }

// ============================================================
// AddCompetencyModal
// ============================================================
function AddCompetencyModal({ onAdd, onClose }) {
    const [name, setName]   = useState('');
    const [color, setColor] = useState('#7dd3fc');
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box modal-box--sm" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>เพิ่ม Competency ใหม่</h3>
                    <button className="modal-close" onClick={onClose}><X size={18}/></button>
                </div>
                <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
                    <div className="cfm-field">
                        <label className="cfm-label">ชื่อ Competency <span className="cfm-required">*</span></label>
                        <input className="cfm-input" value={name} autoFocus
                            onChange={e => setName(e.target.value)} placeholder="เช่น ความคิดสร้างสรรค์"/>
                    </div>
                    <div className="cfm-field">
                        <label className="cfm-label">สี</label>
                        <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                            <input type="color" value={color} onChange={e => setColor(e.target.value)}
                                style={{ width:36, height:36, border:'none', borderRadius:6, cursor:'pointer' }}/>
                            <span style={{ fontSize:'0.8rem', color:'#94a3b8' }}>{color}</span>
                        </div>
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn--ghost" onClick={onClose}>ยกเลิก</button>
                    <button className="btn btn--primary" disabled={!name.trim()}
                        onClick={() => { if (name.trim()) { onAdd(name.trim(), color); onClose(); } }}>
                        เพิ่ม
                    </button>
                </div>
            </div>
        </div>
    );
}

// ============================================================
// SpreadsheetRow
// ============================================================
function SpreadsheetRow({
    course, catId, competencies, weightMap,
    onUpdate, onDelete, onSetWeight, isNew, hideEditActions=false, isSetupMode=false,
}) {
    const codeRef = useRef(null);
    useEffect(() => { if (isNew) codeRef.current?.focus(); }, [isNew]);

    const fromMaster = !!course.fromMaster;
    const locked     = fromMaster || hideEditActions; // master ล็อคทุกอย่าง

    const [editing, setEditing] = useState(!fromMaster && !!isNew);
    const [form, setForm] = useState({
        code: course.code||'', nameTh: course.nameTh||'',
        nameEn: course.nameEn||'', credits: course.credits||'',
    });

    const hasData       = !!(course.code?.trim() || course.nameTh?.trim());
    const hasCompetency = hasData && competencies.some(c => (Number(weightMap?.[c.id]) || 0) > 0);
    const showNoCompWarn = !isSetupMode && hasData && !hasCompetency;

    const handleSave = () => {
        if (!form.code.trim() && !form.nameTh.trim()) return;
        onUpdate(catId, { ...course, ...form, credits: Number(form.credits) || 0 });
        setEditing(false);
    };
    const handleKey = e => {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') {
            setForm({ code:course.code||'', nameTh:course.nameTh||'', nameEn:course.nameEn||'', credits:course.credits||'' });
            setEditing(false);
        }
    };

    // cell click — master ไม่ให้ edit
    const handleCellClick = () => { if (!locked) setEditing(true); };

    return (
        <React.Fragment>
            <tr className={`ss-row ${editing ? 'ss-row--editing' : ''} ${fromMaster ? 'ss-row--master' : ''}`}>
                <td className="ss-cell ss-cell--grip">
                    {fromMaster
                        ? <span className="ss-master-badge" title="วิชาจาก Course Master — ไม่สามารถแก้ไขได้">M</span>
                        : <GripVertical size={13}/>}
                </td>

                {/* รหัสวิชา */}
                <td className="ss-cell" onClick={handleCellClick}>
                    {editing && !locked
                        ? <input ref={codeRef} className="ss-input" value={form.code}
                            onChange={e => setForm(p=>({...p,code:e.target.value}))} onKeyDown={handleKey} placeholder="รหัสวิชา"/>
                        : <span className="ss-code-wrap">
                            <span className="ss-code">{course.code || <span className="ss-placeholder">รหัสวิชา</span>}</span>
                            {showNoCompWarn && (
                                <span className="ss-no-comp-warn" title="ยังไม่ได้ผูก Competency">
                                    <AlertCircle size={12}/>
                                </span>
                            )}
                          </span>
                    }
                </td>

                {/* ชื่อไทย */}
                <td className="ss-cell ss-cell--wide" onClick={handleCellClick}>
                    {editing && !locked
                        ? <input className="ss-input" value={form.nameTh}
                            onChange={e => setForm(p=>({...p,nameTh:e.target.value}))} onKeyDown={handleKey} placeholder="ชื่อวิชาภาษาไทย"/>
                        : <span>{course.nameTh || <span className="ss-placeholder">ชื่อภาษาไทย</span>}</span>}
                </td>

                {/* ชื่ออังกฤษ */}
                <td className="ss-cell ss-cell--wide" onClick={handleCellClick}>
                    {editing && !locked
                        ? <input className="ss-input" value={form.nameEn}
                            onChange={e => setForm(p=>({...p,nameEn:e.target.value}))} onKeyDown={handleKey} placeholder="English Name"/>
                        : <span>{course.nameEn || <span className="ss-placeholder">English Name</span>}</span>}
                </td>

                {/* หน่วยกิต */}
                <td className="ss-cell ss-cell--num" onClick={handleCellClick}>
                    {editing && !locked
                        ? <input className="ss-input ss-input--num" type="number" min={0} max={12} value={form.credits}
                            onChange={e => setForm(p=>({...p,credits:e.target.value}))} onKeyDown={handleKey} placeholder="0"/>
                        : <span>{course.credits || <span className="ss-placeholder">0</span>}</span>}
                </td>

                {/* Weight columns — ซ่อนใน setup mode */}
                {!isSetupMode && competencies.map(comp => {
                    const stored = weightMap?.[comp.id] ?? 0;
                    const active = Number(stored) > 0;
                    return (
                        <td key={comp.id} className="ss-cell ss-cell--weight">
                            <div className={`ss-weight-wrap ${active ? 'ss-weight-wrap--active' : ''} ${!hasData ? 'ss-weight-wrap--locked' : ''}`}
                                style={active ? { '--wc': comp.color } : {}}>
                                <input
                                    className="ss-weight-input"
                                    type="number" min={0} max={100}
                                    value={Number(stored)}
                                    disabled={!hasData}
                                    title={!hasData ? 'กรอกข้อมูลวิชาก่อน' : `${comp.name} weight`}
                                    onFocus={e => e.target.select()}
                                    onChange={e => {
                                        const raw = e.target.value;
                                        const val = raw === '' ? 0 : Math.min(100, Math.max(0, parseInt(raw, 10) || 0));
                                        onSetWeight(course.id, comp.id, val);
                                    }}
                                />
                                {active && <span className="ss-weight-pct">%</span>}
                            </div>
                        </td>
                    );
                })}

                {/* Actions */}
                <td className="ss-cell ss-cell--actions" onClick={e => e.stopPropagation()}>
                    {fromMaster ? (
                        /* Master: ล็อค icon แทนปุ่ม */
                        <span className="ss-locked-icon" title="วิชาจาก Course Master">🔒</span>
                    ) : !hideEditActions && (
                        <>
                            {editing
                                ? <button className="icon-btn icon-btn--edit icon-btn--xs" onClick={handleSave}><Check size={13}/></button>
                                : <button className="icon-btn icon-btn--edit icon-btn--xs" onClick={() => setEditing(true)}><Pencil size={12}/></button>
                            }
                            <button className="icon-btn icon-btn--danger icon-btn--xs" onClick={() => onDelete(catId, course)}>
                                <Trash2 size={12}/>
                            </button>
                        </>
                    )}
                </td>
            </tr>
        </React.Fragment>
    );
}

// ============================================================
// CourseSpreadsheet
// ============================================================
function CourseSpreadsheet({
    catId, courses, competencies, weightsByCourseId,
    onUpdateCourse, onDeleteCourse, onSetWeight,
    hideEditActions=false, isSetupMode=false,
}) {
    const colCount = 1 + 1 + 2 + 1 + (isSetupMode ? 0 : competencies.length) + 1;

    return (
        <div className="ss-wrapper">
            <div className="ss-scroll">
                <table className="ss-table">
                    <thead>
                        <tr>
                            <th className="ss-th ss-th--grip"/>
                            <th className="ss-th">รหัสวิชา</th>
                            <th className="ss-th ss-th--wide">ชื่อวิชา (ไทย)</th>
                            <th className="ss-th ss-th--wide">ชื่อวิชา (Eng)</th>
                            <th className="ss-th ss-th--num">หน่วยกิต</th>
                            {/* Weight columns — ซ่อนใน setup mode */}
                            {!isSetupMode && competencies.map(c => (
                                <th key={c.id} className="ss-th ss-th--weight" style={{'--comp-color': c.color}}>
                                    <span className="ss-comp-dot" style={{ background: c.color }}/>
                                    <span className="ss-comp-name">{c.name}</span>
                                </th>
                            ))}
                            <th className="ss-th ss-th--actions"/>
                        </tr>
                    </thead>
                    <tbody>
                        {courses.length === 0 && (
                            <tr><td colSpan={colCount} className="ss-empty">
                                ยังไม่มีรายวิชา — กดปุ่ม "+ เพิ่มรายวิชา" ด้านบน
                            </td></tr>
                        )}
                        {courses.map((course, i) => (
                            <SpreadsheetRow
                                key={course.id}
                                course={course}
                                catId={catId}
                                competencies={competencies}
                                weightMap={weightsByCourseId[course.id] || {}}
                                onUpdate={onUpdateCourse}
                                onDelete={onDeleteCourse}
                                onSetWeight={onSetWeight}
                                isNew={i === courses.length - 1 && !course.code && !course.nameTh}
                                hideEditActions={hideEditActions}
                                isSetupMode={isSetupMode}
                            />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ============================================================
// Helper — เก็บ leaf categories ทั้งหมดพร้อม path
// ============================================================
function CollectLeafSections(cats, coursesByCategoryId, parentPath = '') {
    const result = [];
    for (const cat of cats) {
        const path = parentPath ? `${parentPath} › ${cat.name}` : cat.name;
        if (!cat.children?.length) {
            result.push({ cat, path, courses: coursesByCategoryId[cat.id] || [] });
        } else {
            result.push(...CollectLeafSections(cat.children, coursesByCategoryId, path));
        }
    }
    return result;
}

// ============================================================
// AllCategoriesView — แสดงทุกหมวดในครั้งเดียว
// ============================================================
// ============================================================
// GlobalCompSummary — แถบสรุป competency รวมทุกวิชาทั้งหลักสูตร
// ============================================================
function GlobalCompSummary({ categories, coursesByCategoryId, weightsByCourseId, competencies }) {
    const totals = competencies.map(comp => {
        let total = 0;
        Object.values(coursesByCategoryId).forEach(courses => {
            courses.forEach(course => {
                total += Number(weightsByCourseId[course.id]?.[comp.id]) || 0;
            });
        });
        return { comp, total };
    });

    const hasAny = totals.some(t => t.total > 0);
    if (!hasAny) return null;

    return (
        <div className="global-comp-summary">
            <span className="global-comp-summary__label">ภาพรวม</span>
            {totals.map(({ comp, total }) => {
                const isOver = total > 100;
                return (
                    <div key={comp.id}
                        className={`global-comp-chip ${isOver ? 'global-comp-chip--over' : ''}`}
                        style={{ '--cc': isOver ? '#f87171' : comp.color }}
                        title={isOver ? `${comp.name}: ${total} — เกิน 100%!` : `${comp.name}: ${total}`}>
                        {isOver
                            ? <AlertCircle size={11} style={{ color:'#f87171', flexShrink:0 }}/>
                            : <span className="global-comp-chip__dot" style={{ background: comp.color }}/>
                        }
                        <span className="global-comp-chip__name">{comp.name}</span>
                        <span className="global-comp-chip__val">{total > 0 ? total : '—'}</span>
                        {isOver && <span className="global-comp-chip__warn">เกิน</span>}
                    </div>
                );
            })}
        </div>
    );
}

function AllCategoriesView({
    categories, coursesByCategoryId, competencies, weightsByCourseId,
    onAddCourse, onUpdateCourse, onDeleteCourse, onSetWeight,
    scrollToCatId, hideEditActions=false, isSetupMode=false,
}) {
    const sectionRefs = useRef({});
    const sections = CollectLeafSections(categories, coursesByCategoryId);
    const colCount = 1 + 1 + 2 + 1 + (isSetupMode ? 0 : competencies.length) + 1;

    useEffect(() => {
        if (scrollToCatId && sectionRefs.current[scrollToCatId]) {
            sectionRefs.current[scrollToCatId].scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [scrollToCatId]);

    if (sections.length === 0) {
        return (
            <div className="panel-empty" style={{padding:'3rem'}}>
                <BookOpen size={24} opacity={0.3}/>
                <span>ยังไม่มีหมวดวิชา — กด "+ หมวดวิชา" เพื่อเริ่ม</span>
            </div>
        );
    }

    return (
        <div className="all-cat-view">
            <div className="all-cat-view__scroll">
                <table className="ss-table all-cat-table">
                    <thead>
                        <tr>
                            <th className="ss-th ss-th--grip"/>
                            <th className="ss-th">รหัสวิชา</th>
                            <th className="ss-th ss-th--wide">ชื่อวิชา (ไทย)</th>
                            <th className="ss-th ss-th--wide">ชื่อวิชา (Eng)</th>
                            <th className="ss-th ss-th--num">หน่วยกิต</th>
                            {!isSetupMode && competencies.map(c => (
                                <th key={c.id} className="ss-th ss-th--weight" style={{'--comp-color': c.color}}>
                                    <span className="ss-comp-dot" style={{ background: c.color }}/>
                                    <span className="ss-comp-name">{c.name}</span>
                                </th>
                            ))}
                            <th className="ss-th ss-th--actions"/>
                        </tr>
                    </thead>
                    <tbody>
                        {sections.map(({ cat, path, courses }) => (
                            <React.Fragment key={cat.id}>
                                <tr ref={el => { sectionRefs.current[cat.id] = el; }}
                                    className="all-cat-section-hdr"
                                    id={`cat-section-${cat.id}`}>
                                    <td colSpan={colCount} className="all-cat-section-hdr__cell">
                                        <div className="all-cat-section-hdr__inner">
                                            <span className="cat-section__code">{cat.code}</span>
                                            <span className="cat-section__name">{cat.name || <em style={{color:'#475569'}}>ยังไม่ตั้งชื่อ</em>}</span>
                                            <span className="cat-section__path">{path}</span>
                                            {/* เพิ่มวิชาใหม่ได้เสมอ (ไม่ใช่ master course) */}
                                            {!hideEditActions && (
                                                <button className="btn btn--ghost btn--sm cat-section__add-btn"
                                                    onClick={() => onAddCourse(cat.id, { code:'', nameTh:'', nameEn:'', credits:0 })}>
                                                    <Plus size={12}/> เพิ่มวิชา
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>

                                {courses.length === 0 ? (
                                    <tr key={`empty-${cat.id}`}>
                                        <td colSpan={colCount} className="ss-empty cat-section__empty">
                                            ยังไม่มีรายวิชา
                                        </td>
                                    </tr>
                                ) : (
                                    courses.map((course, i) => (
                                        <SpreadsheetRow
                                            key={course.id}
                                            course={course}
                                            catId={cat.id}
                                            competencies={competencies}
                                            weightMap={weightsByCourseId[course.id] || {}}
                                            onUpdate={onUpdateCourse}
                                            onDelete={onDeleteCourse}
                                            onSetWeight={onSetWeight}
                                            isNew={i === courses.length - 1 && !course.code && !course.nameTh}
                                            hideEditActions={hideEditActions}
                                            isSetupMode={isSetupMode}
                                        />
                                    ))
                                )}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}


function TreeItem({ cat, depth=0, selectedId, coursesByCategoryId, creditMap, onSelect, onRename, onCreateChild, onDelete, hideActions=false }) {
    const [expanded, setExpanded] = useState(true);
    const fromMaster = !!cat.fromMaster;

    const [renaming, setRenaming] = useState(!fromMaster && (cat.isNew || false));
    const [nameVal,  setNameVal]  = useState(cat.name);
    const inputRef = useRef(null);
    useEffect(() => { if (renaming) inputRef.current?.focus(); }, [renaming]);

    const courseCount = (coursesByCategoryId[cat.id] || []).length;
    const credits     = creditMap?.[cat.id] ?? 0;
    const leaf        = isLeaf(cat);
    const hasChildren = !!(cat.children?.length);

    const confirm = () => { onRename(cat.id, nameVal || 'หมวดใหม่'); setRenaming(false); };

    return (
        <div className="tree-item-wrap">
            <div
                className={`tree-item ${selectedId === cat.id ? 'tree-item--selected' : ''} ${fromMaster ? 'tree-item--master' : ''}`}
                style={{ paddingLeft: `${0.5 + depth * 1}rem` }}
                onClick={() => { onSelect(cat); if (hasChildren) setExpanded(p=>!p); }}
                onDoubleClick={e => {
                    e.stopPropagation();
                    // master ห้าม rename
                    if (!fromMaster && !hideActions) { setRenaming(true); setNameVal(cat.name); }
                }}
            >
                <span className="tree-toggle">
                    {hasChildren
                        ? (expanded ? <ChevronDown size={13}/> : <ChevronRight size={13}/>)
                        : <span style={{width:13}}/>}
                </span>

                {renaming
                    ? <input ref={inputRef} className="tree-name-input" value={nameVal}
                        onChange={e => setNameVal(e.target.value)} onBlur={confirm}
                        onKeyDown={e => { if (e.key==='Enter') confirm(); if (e.key==='Escape') setRenaming(false); e.stopPropagation(); }}
                        onClick={e => e.stopPropagation()}/>
                    : <span className={`tree-label ${fromMaster ? 'tree-label--master' : ''}`}>
                        {cat.code} {cat.name || <em style={{color:'#64748b'}}>ยังไม่ตั้งชื่อ</em>}
                      </span>
                }

                <div className="tree-item__meta">
                    {leaf && courseCount > 0 && <span className="tree-course-badge">{courseCount} วิชา</span>}
                    {credits > 0 && <span className="tree-credits tree-credits--live">{credits} หน่วยกิต</span>}
                </div>

                <div className="tree-item__actions" onClick={e => e.stopPropagation()}>
                    {fromMaster ? (
                        /* Master: ล็อค icon + ยังอนุญาตให้เพิ่มหมวดย่อยใหม่ได้ */
                        <>
                            {/* <LockKeyhole size={12}/> */}
                            {depth < 2 && !hideActions && (
                                <button className="icon-btn icon-btn--xs"
                                    title="เพิ่มหมวดย่อยใหม่ (ไม่ใช่ Master)"
                                    onClick={() => onCreateChild(cat)}>
                                    <Plus size={12}/>
                                </button>
                            )}

                        </>
                    ) : !hideActions && (
                        /* Non-master: ปุ่มเพิ่มหมวดย่อย + ปุ่มลบ */
                        <>
                            {depth < 2 && (
                                <button className="icon-btn icon-btn--xs"
                                    title="เพิ่มหมวดย่อย"
                                    onClick={() => onCreateChild(cat)}>
                                    <Plus size={12}/>
                                </button>
                            )}
                            <button className="icon-btn icon-btn--danger icon-btn--xs"
                                onClick={() => onDelete(cat)}>
                                <Trash2 size={12}/>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {expanded && hasChildren && (
                <div className="tree-children">
                    {cat.children.map(child => (
                        <TreeItem key={child.id} cat={child} depth={depth+1}
                            selectedId={selectedId} coursesByCategoryId={coursesByCategoryId} creditMap={creditMap}
                            onSelect={onSelect} onRename={onRename} onCreateChild={onCreateChild} onDelete={onDelete}
                            hideActions={hideActions}/>
                    ))}
                </div>
            )}
        </div>
    );
}

// ============================================================
// CategoryCoursePanel — Panel 2
// ============================================================
export default function CategoryCoursePanel({
    template, categories=[], selectedCategory,
    coursesByCategoryId={}, weightsByCourseId={}, competencies=[], creditMap={},
    onSelectCategory, onCreateCategory, onRenameCategory, onDeleteCategory,
    onAddCourse, onUpdateCourse, onDeleteCourse,
    onToggleCompetency, onSetWeight, onAddCompetency,
    mode = 'setup', // 'setup' | 'weight'
}) {
    const [showAddComp,  setShowAddComp]  = useState(false);
    const [viewMode,     setViewMode]     = useState('single');
    const [scrollToCatId, setScrollToCatId] = useState(null);

    const isWeightMode = mode === 'weight';

    const leaf    = selectedCategory && isLeaf(selectedCategory);
    const courses = selectedCategory ? (coursesByCategoryId[selectedCategory.id] || []) : [];

    const handleSelectInAll = (cat) => {
        onSelectCategory(cat);
        setScrollToCatId(cat.id);
        setTimeout(() => setScrollToCatId(null), 800);
    };

    return (
        <div className="tm-panel ccp-panel">
            {!template ? (
                <div className="panel-empty">เลือก Template ก่อน</div>
            ) : (
                <div className="ccp-body">
                    {/* ── Tree sidebar ── */}
                    <div className="ccp-tree">
                        <div className="ccp-tree__header">
                            <span>โครงสร้างหมวดวิชา</span>
                            {/* ซ่อนปุ่ม + หมวดวิชาใน weight mode */}
                            {!isWeightMode && (
                                <button className="btn btn--primary btn--sm ccp-tree__add-btn"
                                    onClick={onCreateCategory} title="เพิ่มหมวดวิชา">
                                    <Plus size={12}/> หมวดวิชา
                                </button>
                            )}
                        </div>
                        <div className="ccp-tree__scroll">
                            {categories.length === 0
                                ? <div className="panel-empty panel-empty--sm">กด "+ หมวดวิชา" เพื่อเริ่ม</div>
                                : categories.map(cat => (
                                    <TreeItem key={cat.id} cat={cat}
                                        selectedId={selectedCategory?.id}
                                        coursesByCategoryId={coursesByCategoryId}
                                        creditMap={creditMap}
                                        onSelect={c => {
                                            if (viewMode === 'all') handleSelectInAll(c);
                                            else onSelectCategory(c);
                                        }}
                                        onRename={onRenameCategory}
                                        onCreateChild={parent => { onSelectCategory(parent); onCreateCategory(); }}
                                        onDelete={onDeleteCategory}
                                        hideActions={isWeightMode}/>
                                ))
                            }
                        </div>
                    </div>

                    {/* ── Sheet area ── */}
                    <div className="ccp-sheet">
                        {/* Sheet toolbar */}
                        <div className="ccp-sheet__toolbar">
                            <div className="view-toggle">
                                <button className={`view-toggle__btn ${viewMode === 'single' ? 'view-toggle__btn--active' : ''}`}
                                    onClick={() => setViewMode('single')}>หมวดที่เลือก</button>
                                <button className={`view-toggle__btn ${viewMode === 'all' ? 'view-toggle__btn--active' : ''}`}
                                    onClick={() => setViewMode('all')}>ดูทั้งหมด</button>
                            </div>

                            <GlobalCompSummary
                                categories={categories}
                                coursesByCategoryId={coursesByCategoryId}
                                weightsByCourseId={weightsByCourseId}
                                competencies={competencies}
                            />
                        </div>

                        {/* ── All-view ── */}
                        {viewMode === 'all' ? (
                            <AllCategoriesView
                                categories={categories}
                                coursesByCategoryId={coursesByCategoryId}
                                competencies={competencies}
                                weightsByCourseId={weightsByCourseId}
                                onAddCourse={onAddCourse}
                                onUpdateCourse={onUpdateCourse}
                                onDeleteCourse={onDeleteCourse}
                                onSetWeight={onSetWeight}
                                scrollToCatId={scrollToCatId}
                                hideEditActions={isWeightMode}
                                isSetupMode={!isWeightMode}
                            />
                        ) : (
                            !selectedCategory ? (
                                <div className="panel-empty">
                                    <BookOpen size={22} opacity={0.3}/>
                                    <span>เลือกหมวดวิชาเพื่อดูรายวิชา</span>
                                </div>
                            ) : !leaf ? (
                                <div className="panel-empty">
                                    <AlertCircle size={20} opacity={0.35}/>
                                    <span>เพิ่มรายวิชาได้เฉพาะหมวดวิชาที่ไม่มีหมวดย่อย</span>
                                </div>
                            ) : (
                                <div className="ccp-sheet__inner">
                                    <div className="ccp-sheet__header">
                                        <div className="ccp-sheet__header-left">
                                            <span className="ccp-sheet__cat">{selectedCategory.code} {selectedCategory.name}</span>
                                            <span className="ccp-sheet__hint">
                                                {isWeightMode
                                                    ? 'ใส่ค่า Weight ของแต่ละ Competency ในวิชา'
                                                    : 'คลิก cell เพื่อแก้ไข · กรอกข้อมูลวิชาก่อนถึงจะใส่ Weight ได้'}
                                            </span>
                                        </div>
                                        {/* + เพิ่มรายวิชา ใน single view setup mode */}
                                        {!isWeightMode && (
                                            <button className="btn btn--primary btn--sm"
                                                onClick={() => onAddCourse(selectedCategory.id, { code:'', nameTh:'', nameEn:'', credits:0 })}>
                                                <Plus size={13}/> เพิ่มรายวิชา
                                            </button>
                                        )}
                                    </div>
                                    <CourseSpreadsheet
                                        catId={selectedCategory.id}
                                        courses={courses}
                                        competencies={competencies}
                                        weightsByCourseId={weightsByCourseId}
                                        onAddCourse={onAddCourse}
                                        onUpdateCourse={onUpdateCourse}
                                        onDeleteCourse={onDeleteCourse}
                                        onSetWeight={onSetWeight}
                                        hideEditActions={isWeightMode}
                                        isSetupMode={isWeightMode ? false : true}
                                    />
                                </div>
                            )
                        )}
                    </div>
                </div>
            )}

            {showAddComp && (
                <AddCompetencyModal onAdd={onAddCompetency} onClose={() => setShowAddComp(false)}/>
            )}
        </div>
    );
}