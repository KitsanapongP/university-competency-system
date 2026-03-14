'use client';

import { useState, useRef, useEffect } from 'react';
import {
    Plus, Trash2, GripVertical, ChevronRight, ChevronDown,
    BookOpen, AlertCircle, Check, X, Pencil, SlidersHorizontal
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
// WeightSidePanel
// weightMap: { [compId]: number }  — 0 = ไม่ได้เลือก
// ============================================================
function WeightSidePanel({ course, competencies, weightMap, onToggle, onSetWeight, onClose }) {
    const checkedIds = competencies.filter(c => (weightMap?.[c.id] || 0) > 0).map(c => c.id);
    const total = checkedIds.reduce((s, id) => s + (weightMap[id] || 0), 0);
    const isOver = total > 100;
    const isOk   = total === 100 && checkedIds.length > 0;
 
    return (
        <div className="wp-panel">
            <div className="wp-header">
                <SlidersHorizontal size={14}/>
                <span>Competency Weight</span>
                <button className="modal-close" style={{ marginLeft:'auto' }} onClick={onClose}><X size={15}/></button>
            </div>
 
            <div className="wp-course-name">
                <span className="ss-code">{course.code}</span>
                <span className="wp-course-th">{course.nameTh}</span>
            </div>
            <p className="wp-hint">ติ๊กเลือก Competency แล้วใส่ % ที่วิชานี้มีส่วนพัฒนา</p>
 
            <div className="wp-list">
                {competencies.map(comp => {
                    const checked = (weightMap?.[comp.id] || 0) > 0;
                    const w       = weightMap?.[comp.id] ?? 0;
                    return (
                        <div key={comp.id} className={`wp-row ${checked ? 'wp-row--active' : ''}`}>
                            <button
                                className={`ss-checkbox ${checked ? 'ss-checkbox--checked' : ''}`}
                                style={checked ? { '--cb-color': comp.color } : {}}
                                onClick={() => onToggle(course.id, comp.id)}
                            >
                                {checked && <Check size={10}/>}
                            </button>
                            <span className="wp-dot" style={{ background: comp.color }}/>
                            <span className="wp-comp-name">{comp.name}</span>
                            {checked && (
                                <div className="wp-weight-input-wrap">
                                    <input
                                        className="wp-weight-input"
                                        type="number" min={0} max={100}
                                        value={w || ''}
                                        placeholder="0"
                                        onChange={e => {
                                            const val = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                                            onSetWeight(course.id, comp.id, val);
                                        }}
                                    />
                                    <span className="wp-pct">%</span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
 
            <div className={`wp-total ${isOver ? 'wp-total--over' : isOk ? 'wp-total--ok' : ''}`}>
                <span>รวม</span>
                <span className="wp-total__num">{total}%</span>
                {isOver && <span className="wp-total__warn">เกิน 100%</span>}
                {isOk   && <Check size={12}/>}
            </div>
        </div>
    );
}

// ============================================================
// SpreadsheetRow
// ============================================================
function SpreadsheetRow({
    course, catId, competencies, weightMap,
    onUpdate, onDelete, onSetWeight, isNew,
}) {
    const codeRef = useRef(null);
    useEffect(() => { if (isNew) codeRef.current?.focus(); }, [isNew]);
 
    const [editing, setEditing] = useState(!!isNew);
    const [form, setForm] = useState({
        code: course.code||'', nameTh: course.nameTh||'',
        nameEn: course.nameEn||'', credits: course.credits||'',
    });
 
    const hasData = !!(course.code?.trim() || course.nameTh?.trim());
 
    // Total weight ของวิชานี้
    const rowTotal = competencies.reduce((s, c) => s + (Number(weightMap?.[c.id]) || 0), 0);
    const totalStatus = rowTotal === 0 ? 'empty'
        : rowTotal === 100 ? 'ok'
        : rowTotal > 100   ? 'over'
        : 'partial';
 
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
 
    return (
        <tr className={`ss-row ${editing ? 'ss-row--editing' : ''}`}>
            <td className="ss-cell ss-cell--grip"><GripVertical size={13}/></td>
 
            <td className="ss-cell" onClick={() => setEditing(true)}>
                {editing
                    ? <input ref={codeRef} className="ss-input" value={form.code}
                        onChange={e => setForm(p=>({...p,code:e.target.value}))} onKeyDown={handleKey} placeholder="รหัสวิชา"/>
                    : <span className="ss-code">{course.code || <span className="ss-placeholder">รหัสวิชา</span>}</span>}
            </td>
 
            <td className="ss-cell ss-cell--wide" onClick={() => setEditing(true)}>
                {editing
                    ? <input className="ss-input" value={form.nameTh}
                        onChange={e => setForm(p=>({...p,nameTh:e.target.value}))} onKeyDown={handleKey} placeholder="ชื่อวิชาภาษาไทย"/>
                    : <span>{course.nameTh || <span className="ss-placeholder">ชื่อภาษาไทย</span>}</span>}
            </td>
 
            <td className="ss-cell ss-cell--wide" onClick={() => setEditing(true)}>
                {editing
                    ? <input className="ss-input" value={form.nameEn}
                        onChange={e => setForm(p=>({...p,nameEn:e.target.value}))} onKeyDown={handleKey} placeholder="English Name"/>
                    : <span>{course.nameEn || <span className="ss-placeholder">English Name</span>}</span>}
            </td>
 
            <td className="ss-cell ss-cell--num" onClick={() => setEditing(true)}>
                {editing
                    ? <input className="ss-input ss-input--num" type="number" min={0} max={12} value={form.credits}
                        onChange={e => setForm(p=>({...p,credits:e.target.value}))} onKeyDown={handleKey} placeholder="0"/>
                    : <span>{course.credits || <span className="ss-placeholder">0</span>}</span>}
            </td>
 
            {competencies.map(comp => {
                const w = weightMap?.[comp.id] ?? '';
                const active = w !== '' && Number(w) > 0;
                return (
                    <td key={comp.id} className="ss-cell ss-cell--weight">
                        <div className={`ss-weight-wrap ${active ? 'ss-weight-wrap--active' : ''} ${!hasData ? 'ss-weight-wrap--locked' : ''}`}
                            style={active ? { '--wc': comp.color } : {}}>
                            <input
                                className="ss-weight-input"
                                type="number" min={0} max={100}
                                value={w}
                                placeholder="—"
                                disabled={!hasData}
                                title={!hasData ? 'กรอกข้อมูลวิชาก่อน' : `${comp.name} weight`}
                                onChange={e => {
                                    const val = e.target.value === '' ? 0
                                        : Math.min(100, Math.max(0, Number(e.target.value) || 0));
                                    onSetWeight(course.id, comp.id, val);
                                }}
                            />
                            {active && <span className="ss-weight-pct">%</span>}
                        </div>
                    </td>
                );
            })}
 
            {/* Total per row */}
            <td className="ss-cell ss-cell--total">
                {hasData && rowTotal > 0
                    ? <span className={`ss-row-total ss-row-total--${totalStatus}`}>{rowTotal}%</span>
                    : <span className="ss-placeholder">—</span>
                }
            </td>
 
            <td className="ss-cell ss-cell--actions" onClick={e => e.stopPropagation()}>
                {editing
                    ? <button className="icon-btn icon-btn--edit icon-btn--xs" onClick={handleSave}><Check size={13}/></button>
                    : <button className="icon-btn icon-btn--edit icon-btn--xs" onClick={() => setEditing(true)}><Pencil size={12}/></button>
                }
                <button className="icon-btn icon-btn--danger icon-btn--xs" onClick={() => onDelete(catId, course)}>
                    <Trash2 size={12}/>
                </button>
            </td>
        </tr>
    );
}

// ============================================================
// CourseSpreadsheet
// ============================================================
function CourseSpreadsheet({
    catId, courses, competencies, weightsByCourseId,
    onAddCourse, onUpdateCourse, onDeleteCourse, onSetWeight,
}) {
    // Total per competency (รวมทุกวิชา)
    const compTotals = competencies.map(comp => ({
        comp,
        total: courses.reduce((sum, c) => sum + (Number(weightsByCourseId[c.id]?.[comp.id]) || 0), 0),
    }));
 
    const colCount = 1 + 1 + 2 + 1 + competencies.length + 1 + 1; // grip+code+names+credits+comps+total+actions

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
                            {competencies.map(c => (
                                <th key={c.id} className="ss-th ss-th--weight" style={{'--comp-color': c.color}} title={c.name}>
                                    <span className="ss-comp-dot" style={{ background: c.color }}/>
                                    <span className="ss-comp-name">{c.name}</span>
                                </th>
                            ))}
                            <th className="ss-th ss-th--total">รวม</th>
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
                            />
                        ))}
                    </tbody>
 
                    {/* tfoot — Total per competency */}
                    {courses.length > 0 && (
                        <tfoot>
                            <tr className="ss-tfoot-row">
                                <td className="ss-tfoot-cell" colSpan={5}>
                                    <span className="ss-tfoot-label">รวม Competency</span>
                                </td>
                                {compTotals.map(({ comp, total }) => (
                                    <td key={comp.id} className="ss-tfoot-cell ss-tfoot-cell--comp"
                                        style={{ '--tc': comp.color }}>
                                        {total > 0
                                            ? <span className="ss-tfoot-total">{total}</span>
                                            : <span className="ss-placeholder">—</span>
                                        }
                                    </td>
                                ))}
                                <td className="ss-tfoot-cell"/>
                                <td className="ss-tfoot-cell"/>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        </div>
    );
}

// ============================================================
// TreeItem
// ============================================================
function TreeItem({ cat, depth=0, selectedId, coursesByCategoryId, creditMap, onSelect, onRename, onCreateChild, onDelete }) {
    const [expanded, setExpanded] = useState(true);
    const [renaming, setRenaming] = useState(cat.isNew || false);
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
            <div className={`tree-item ${selectedId === cat.id ? 'tree-item--selected' : ''}`}
                style={{ paddingLeft: `${0.5 + depth * 1}rem` }}
                onClick={() => { onSelect(cat); if (hasChildren) setExpanded(p=>!p); }}
                onDoubleClick={e => { e.stopPropagation(); setRenaming(true); setNameVal(cat.name); }}>
                <span className="tree-toggle">
                    {hasChildren ? (expanded ? <ChevronDown size={13}/> : <ChevronRight size={13}/>) : <span style={{width:13}}/>}
                </span>
                {renaming
                    ? <input ref={inputRef} className="tree-name-input" value={nameVal}
                        onChange={e => setNameVal(e.target.value)} onBlur={confirm}
                        onKeyDown={e => { if (e.key==='Enter') confirm(); if (e.key==='Escape') setRenaming(false); e.stopPropagation(); }}
                        onClick={e => e.stopPropagation()}/>
                    : <span className="tree-label">{cat.code} {cat.name || <em style={{color:'#64748b'}}>ยังไม่ตั้งชื่อ</em>}</span>
                }
                <div className="tree-item__meta">
                    {leaf && courseCount > 0 && <span className="tree-course-badge">{courseCount} วิชา</span>}
                    {credits > 0 && <span className="tree-credits tree-credits--live">{credits} หน่วยกิต</span>}
                </div>
                <div className="tree-item__actions" onClick={e => e.stopPropagation()}>
                    <button className="icon-btn icon-btn--danger icon-btn--xs" onClick={() => onDelete(cat)}>
                        <Trash2 size={12}/>
                    </button>
                </div>
            </div>
            {expanded && hasChildren && (
                <div className="tree-children">
                    {cat.children.map(child => (
                        <TreeItem key={child.id} cat={child} depth={depth+1}
                            selectedId={selectedId} coursesByCategoryId={coursesByCategoryId} creditMap={creditMap}
                            onSelect={onSelect} onRename={onRename} onCreateChild={onCreateChild} onDelete={onDelete}/>
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
}) {
    const [showAddComp,      setShowAddComp]      = useState(false);
    const [selectedCourseId, setSelectedCourseId] = useState(null);

    const leaf    = selectedCategory && isLeaf(selectedCategory);
    const courses = selectedCategory ? (coursesByCategoryId[selectedCategory.id] || []) : [];
    const selectedCourse = courses.find(c => c.id === selectedCourseId) ?? null;
    const showWeightPanel = !!(selectedCourse && (selectedCourse.code?.trim() || selectedCourse.nameTh?.trim()));

    return (
        <div className="tm-panel ccp-panel">
            {!template ? (
                <div className="panel-empty">เลือก Template ก่อน</div>
            ) : (
                <div className="ccp-body">
                    {/* ── Tree sidebar ── */}
                    <div className="ccp-tree">
                        {/* tree header + ปุ่มเพิ่มหมวดวิชา */}
                        <div className="ccp-tree__header">
                            <span>โครงสร้างหมวดวิชา</span>
                            <button className="btn btn--primary btn--sm ccp-tree__add-btn"
                                onClick={onCreateCategory} title="เพิ่มหมวดวิชา">
                                <Plus size={12}/> หมวดวิชา
                            </button>
                        </div>
                        <div className="ccp-tree__scroll">
                            {categories.length === 0
                                ? <div className="panel-empty panel-empty--sm">กด "+ หมวดวิชา" เพื่อเริ่ม</div>
                                : categories.map(cat => (
                                    <TreeItem key={cat.id} cat={cat}
                                        selectedId={selectedCategory?.id}
                                        coursesByCategoryId={coursesByCategoryId}
                                        creditMap={creditMap}
                                        onSelect={c => { onSelectCategory(c); setSelectedCourseId(null); }}
                                        onRename={onRenameCategory}
                                        onCreateChild={parent => { onSelectCategory(parent); onCreateCategory(); }}
                                        onDelete={onDeleteCategory}/>
                                ))
                            }
                        </div>
                    </div>

                    {/* ── Sheet area ── */}
                    <div className="ccp-sheet">
                        {!selectedCategory ? (
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
                                {/* sheet header: ชื่อหมวด + hint + ปุ่มเพิ่มวิชา */}
                                <div className="ccp-sheet__header">
                                    <div className="ccp-sheet__header-left">
                                        <span className="ccp-sheet__cat">
                                            {selectedCategory.code} {selectedCategory.name}
                                        </span>
                                        <span className="ccp-sheet__hint">
                                            คลิก cell เพื่อแก้ไข · กรอกข้อมูลวิชาก่อนถึงจะใส่ Weight ได้
                                        </span>
                                    </div>
                                    <div style={{ marginLeft:'auto', display:'flex', gap:'0.4rem' }}>
                                        <button className="btn btn--ghost btn--sm" onClick={() => setShowAddComp(true)} disabled={!template}>
                                            <Plus size={13}/> Competency
                                        </button>
                                    </div>
                                    <button className="btn btn--primary btn--sm"
                                        onClick={() => onAddCourse(selectedCategory.id, { code:'', nameTh:'', nameEn:'', credits:0 })}>
                                        <Plus size={13}/> เพิ่มรายวิชา
                                    </button>

                                    
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
                                />
                            </div>
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