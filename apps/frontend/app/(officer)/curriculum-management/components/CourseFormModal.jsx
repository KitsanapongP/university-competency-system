'use client';

import { useState, useRef, useEffect } from 'react';
import { Check, ChevronRight, ChevronDown, Plus, Trash2, ArrowLeft, ArrowRight, Layers, BookOpen, Award, FileText, Pencil, GripVertical } from 'lucide-react';
import BaseModal from '../../../../components/ui/BaseModal';
import '../../template-management/TemplateManagement.css';

// ============================================================
// Step Indicator
// ============================================================
function StepIndicator({ step }) {
    const steps = ['ข้อมูลหลักสูตร', 'โครงสร้างหลักสูตร', 'ภาพรวม'];
    return (
        <div className="cfm-steps">
            {steps.map((label, i) => {
                const n = i + 1;
                const active = step === n;
                const done = step > n;
                return (
                    <div key={n} className={`cfm-step ${active ? 'cfm-step--active' : ''} ${done ? 'cfm-step--done' : ''}`}>
                        <span className="cfm-step__num">{done ? <Check size={11}/> : n}</span>
                        <span className="cfm-step__label">{label}</span>
                        {i < steps.length - 1 && <span className="cfm-step__line"/>}
                    </div>
                );  
            })}
        </div>
    );
}

// ============================================================
// Step 1 — Basic Info
// ============================================================
function Step1({ form, setForm }) {
    const currentYear = new Date().getFullYear() + 543;
    const years = [];
    for (let y = currentYear - 5; y <= currentYear + 2; y++) {
        years.push(y);
    }

    return (
        <div className="cfm-step1">
            <div className="cfm-field">
                <label className="cfm-label">ชื่อหลักสูตร (ภาษาไทย) <span className="cfm-required">*</span></label>
                <input 
                    className="cfm-input" 
                    value={form.nameTh}
                    onChange={e => setForm(p => ({ ...p, nameTh: e.target.value }))}
                    placeholder="เช่น หลักสูตรวิทยาการคอมพิวเตอร์"
                    autoFocus
                />
            </div>

            <div className="cfm-field">
                <label className="cfm-label">ชื่อหลักสูตร (ภาษาอังกฤษ) <span className="cfm-required">*</span></label>
                <input 
                    className="cfm-input" 
                    value={form.nameEn}
                    onChange={e => setForm(p => ({ ...p, nameEn: e.target.value }))}
                    placeholder="เช่น Computer Science"
                />
            </div>

            <div className="cfm-row">
                <div className="cfm-field">
                    <label className="cfm-label">ปีการศึกษา <span className="cfm-required">*</span></label>
                    <select 
                        className="cfm-input"
                        value={form.year || ''}
                        onChange={e => setForm(p => ({ ...p, year: parseInt(e.target.value) || null }))}
                    >
                        <option value="">เลือกปีการศึกษา</option>
                        {years.map(y => (
                            <option key={y} value={y}>ปีการศึกษา {y}</option>
                        ))}
                    </select>
                </div>
                <div className="cfm-field">
                    <label className="cfm-label">ชื่อปริญญา (ภาษาไทย) <span className="cfm-required">*</span></label>
                    <input 
                        className="cfm-input" 
                        value={form.degreeName}
                        onChange={e => setForm(p => ({ ...p, degreeName: e.target.value }))}
                        placeholder="เช่น วิทยาศาสตรบัณฑิต"
                    />
                </div>
            </div>

            <div className="cfm-field">
                <label className="cfm-label">ชื่อปริญญา (ภาษาอังกฤษ)</label>
                <input 
                    className="cfm-input" 
                    value={form.degreeNameEn}
                    onChange={e => setForm(p => ({ ...p, degreeNameEn: e.target.value }))}
                    placeholder="เช่น Bachelor of Science"
                />
            </div>

            <div className="cfm-field">
                <label className="cfm-label">ชื่อปริญญาเต็ม (ภาษาไทย) <span className="cfm-required">*</span></label>
                <input 
                    className="cfm-input" 
                    value={form.degreeFullNameTh}
                    onChange={e => setForm(p => ({ ...p, degreeFullNameTh: e.target.value }))}
                    placeholder="เช่น วิทยาศาสตรบัณฑิต (วิทยาการคอมพิวเตอร์)"
                />
            </div>

            <div className="cfm-field">
                <label className="cfm-label">ชื่อปริญญาเต็ม (ภาษาอังกฤษ)</label>
                <input 
                    className="cfm-input" 
                    value={form.degreeFullNameEn}
                    onChange={e => setForm(p => ({ ...p, degreeFullNameEn: e.target.value }))}
                    placeholder="เช่น Bachelor of Science (Computer Science)"
                />
            </div>

            <div className="cfm-row">
                <div className="cfm-field">
                    <label className="cfm-label">ชื่อย่อ (ภาษาไทย)</label>
                    <input 
                        className="cfm-input" 
                        value={form.degreeAbbrTh}
                        onChange={e => setForm(p => ({ ...p, degreeAbbrTh: e.target.value }))}
                        placeholder="เช่น วิ.บ. (วิทยาการคอมพิวเตอร์)"
                    />
                </div>
                <div className="cfm-field">
                    <label className="cfm-label">ชื่อย่อ (ภาษาอังกฤษ)</label>
                    <input 
                        className="cfm-input" 
                        value={form.degreeAbbrEn}
                        onChange={e => setForm(p => ({ ...p, degreeAbbrEn: e.target.value }))}
                        placeholder="เช่น B.Sc. (Computer Science)"
                    />
                </div>
            </div>
        </div>
    );
}

// ============================================================
// Spreadsheet Row
// ============================================================
function CourseRow({ course, onUpdate, onDelete }) {
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState({
        code: course.code || '',
        nameTh: course.nameTh || '',
        nameEn: course.nameEn || '',
        credits: course.credits || 0,
        isCoreCourse: course.isCoreCourse ?? true,
    });

    const handleSave = () => {
        if (!form.code.trim() && !form.nameTh.trim()) return;
        onUpdate({ ...course, ...form, credits: Number(form.credits) || 0 });
        setEditing(false);
    };

    const handleKey = e => {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') {
            setForm({ code: course.code || '', nameTh: course.nameTh || '', nameEn: course.nameEn || '', credits: course.credits || 0, isCoreCourse: course.isCoreCourse ?? true });
            setEditing(false);
        }
    };

    return (
        <tr className={`ss-row ${editing ? 'ss-row--editing' : ''}`}>
            <td className="ss-cell ss-cell--grip">
                <GripVertical size={13}/>
            </td>
            <td className="ss-cell" onClick={() => setEditing(true)}>
                {editing ? (
                    <input className="ss-input" value={form.code}
                        onChange={e => setForm(p => ({...p, code: e.target.value}))} onKeyDown={handleKey} placeholder="รหัสวิชา"/>
                ) : (
                    <span className="ss-code">{course.code || <span className="ss-placeholder">รหัสวิชา</span>}</span>
                )}
            </td>
            <td className="ss-cell ss-cell--wide" onClick={() => setEditing(true)}>
                {editing ? (
                    <input className="ss-input" value={form.nameTh}
                        onChange={e => setForm(p => ({...p, nameTh: e.target.value}))} onKeyDown={handleKey} placeholder="ชื่อวิชาภาษาไทย"/>
                ) : (
                    <span>{course.nameTh || <span className="ss-placeholder">ชื่อภาษาไทย</span>}</span>
                )}
            </td>
            <td className="ss-cell ss-cell--wide" onClick={() => setEditing(true)}>
                {editing ? (
                    <input className="ss-input" value={form.nameEn}
                        onChange={e => setForm(p => ({...p, nameEn: e.target.value}))} onKeyDown={handleKey} placeholder="English Name"/>
                ) : (
                    <span>{course.nameEn || <span className="ss-placeholder">English Name</span>}</span>
                )}
            </td>
            <td className="ss-cell ss-cell--num" onClick={() => setEditing(true)}>
                {editing ? (
                    <input className="ss-input ss-input--num" type="number" min={0} max={12} value={form.credits}
                        onChange={e => setForm(p => ({...p, credits: e.target.value}))} onKeyDown={handleKey} placeholder="0"/>
                ) : (
                    <span>{course.credits || <span className="ss-placeholder">0</span>}</span>
                )}
            </td>
            <td className="ss-cell ss-cell--actions" onClick={e => e.stopPropagation()}>
                {editing ? (
                    <button className="icon-btn icon-btn--edit icon-btn--xs" onClick={handleSave}><Check size={13}/></button>
                ) : (
                    <button className="icon-btn icon-btn--edit icon-btn--xs" onClick={() => setEditing(true)}><Pencil size={12}/></button>
                )}
                <button className="icon-btn icon-btn--danger icon-btn--xs" onClick={() => onDelete(course)}>
                    <Trash2 size={12}/>
                </button>
            </td>
        </tr>
    );
}

// ============================================================
// Course Table
// ============================================================
function CourseTable({ courses, onUpdateCourse, onDeleteCourse }) {
    if (courses.length === 0) {
        return (
            <div className="ss-wrapper">
                <div className="ss-scroll">
                    <table className="ss-table">
                        <tbody>
                            <tr><td colSpan={6} className="ss-empty">ยังไม่มีรายวิชา — กดปุ่ม "+ เพิ่มรายวิชา" ด้านบน</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

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
                            <th className="ss-th ss-th--actions"/>
                        </tr>
                    </thead>
                    <tbody>
                        {courses.map(course => (
                            <CourseRow key={course.id} 
                            course={course} 
                            onUpdate={onUpdateCourse} 
                            onDelete={onDeleteCourse}/>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ============================================================
// Tree Item
// ============================================================
function TreeItem({ cat, depth = 0, selectedId, onSelect, onRename, onCreateChild, onDelete }) {
    const [expanded, setExpanded] = useState(true);
    const [renaming, setRenaming] = useState(cat.isNew || false);
    const [nameVal, setNameVal] = useState(cat.name);
    const inputRef = useRef(null);
    
    useEffect(() => { if (renaming) inputRef.current?.focus(); }, [renaming]);

    const hasChildren = cat.children?.length > 0;
    const isSelected = cat.id === selectedId;

    const getDepth = (c, d = 0) => {
        if (!c.children?.length) return d;
        return Math.max(...c.children.map(ch => getDepth(ch, d + 1)));
    };

    const subTreeDepth = getDepth(cat, 0);
    const totalDepth = depth + subTreeDepth;
    const canAddChild = totalDepth < 3;

    const confirm = () => { onRename(cat.id, nameVal || 'หมวดใหม่'); setRenaming(false); };

    const totalcredits = (cat.requiredCredits || 0) + (cat.children || []).reduce((sum, ch) => sum + (ch.requiredCredits || 0), 0);
    
    return (
        <div className="tree-item-wrap">
            <div
                className={`tree-item ${isSelected ? 'tree-item--selected' : ''}`}
                style={{ paddingLeft: `${0.5 + depth * 1}rem` }}
                onClick={e => { e.stopPropagation(); onSelect(cat); if (hasChildren) setExpanded(p => !p); }}
                onDoubleClick={e => { e.stopPropagation(); setRenaming(true); setNameVal(cat.name); }}
            >
                <span className="tree-toggle">
                    {hasChildren ? (expanded ? <ChevronDown size={13}/> : <ChevronRight size={13}/>) : <span style={{width:13}}/>}
                </span>

                {renaming ? (
                    <input ref={inputRef} className="tree-name-input" value={nameVal}
                        onChange={e => setNameVal(e.target.value)} onBlur={confirm}
                        onKeyDown={e => { if (e.key === 'Enter') confirm(); if (e.key === 'Escape') setRenaming(false); e.stopPropagation(); }}
                        onClick={e => e.stopPropagation()}/>
                ) : (
                    <span className="tree-label">
                        {cat.code} {cat.name || <em style={{color: '#64748b'}}>ยังไม่ตั้งชื่อ</em>}
                    </span>
                )}

                <div className="tree-item__meta">
                    <span className="tree-credits">{cat.requiredCredits || 0} หน่วยกิต</span>
                </div>

                <div className="tree-item__actions" onClick={e => e.stopPropagation()}>
                    <button className="icon-btn icon-btn--xs" title="เพิ่มหมวดย่อย" onClick={() => canAddChild && onCreateChild(cat, depth)}
                        disabled={!canAddChild}>
                        <Plus size={12}/>
                    </button>
                    <button className="icon-btn icon-btn--danger icon-btn--xs" onClick={() => onDelete(cat)}>
                        <Trash2 size={12}/>
                    </button>
                </div>
            </div>

            {expanded && hasChildren && (
                <div className="tree-children">
                    {cat.children.map(child => (
                        <TreeItem key={child.id} cat={child} depth={depth + 1}
                            selectedId={selectedId}
                            onSelect={onSelect}
                            onRename={onRename}
                            onCreateChild={(childCat) => onCreateChild(childCat, depth)}
                            onDelete={onDelete}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// ============================================================
// Step 2 — Structure Management (Spreadsheet UI)
// ============================================================
function Step2({ form, setForm }) {
    const [selectedCategory, setSelectedCategory] = useState(null);
    
    const categories = form.categories || [];
    const coursesByCategory = form.coursesByCategory || {};
    const courses = selectedCategory ? (coursesByCategory[selectedCategory.id] || []) : [];

    console.log("selectedCategory:", selectedCategory);
    console.log("coursesByCategory:", coursesByCategory);
    console.log("courses:", courses);

    const getNextCode = (siblings) => `${siblings.length + 1}`;
    const getNextChildCode = (parentCode, siblings) => `${parentCode}.${siblings.length + 1}`;

    const getDepth = (c, d = 0) => {
        if (!c.children?.length) return d;
        return Math.max(...c.children.map(ch => getDepth(ch, d + 1)));
    };

    const getCategoryDepth = (cat, cats, currentDepth = 0) => {
        for (let i = 0; i < cats.length; i++) {
            if (cats[i].id === cat.id) return currentDepth;
            if (cats[i].children?.length) {
                const found = getCategoryDepth(cat, cats[i].children, currentDepth + 1);
                if (found !== -1) return found;
            }
        }
        return -1;
    };

    const canAddRootCategory = () => {
        return true;
    };

    const canAddChild = (parent) => {
        const parentCategoryDepth = getCategoryDepth(parent, categories);
        return parentCategoryDepth < 3;
    };

    const handleAddCategory = () => {
        if (selectedCategory && canAddChild(selectedCategory)) {
            handleAddChildCategory(selectedCategory);
            return;
        }
        
        const code = getNextCode(categories);
        const newCat = {
            id: `cat_${Date.now()}`,
            code,
            name: '',
            requiredCredits: 0,
            children: [],
            isNew: true,
        };
        setForm(p => ({
            ...p,
            categories: [...p.categories, newCat],
            coursesByCategory: { ...p.coursesByCategory, [newCat.id]: [] },
        }));
        setSelectedCategory(newCat);
    };

    const handleAddChildCategory = (parent, parentDepth = 0) => {
        const parentCategoryDepth = getCategoryDepth(parent, categories);

        if (parentCategoryDepth >= 3) {
            alert('ไม่สามารถสร้างหมวดวิชาลูกได้เกิน 4 ระดับ');
            return;
        }

        const siblings = parent.children || [];
        const code = getNextChildCode(parent.code, siblings);
        const newCat = {
            id: `cat_${Date.now()}`,
            code,
            name: '',
            requiredCredits: 0,
            children: [],
            isNew: true,
        };

        const updateCategories = (cats) => cats.map(c => {
            if (c.id === parent.id) {
                return { ...c, children: [...(c.children || []), newCat] };
            }
            if (c.children?.length) {
                return { ...c, children: updateCategories(c.children) };
            }
            return c;
        });

        setForm(p => ({
            ...p,
            categories: updateCategories(p.categories),
            coursesByCategory: { ...p.coursesByCategory, [newCat.id]: [] },
        }));
        setSelectedCategory(newCat);
    };

    const handleRenameCategory = (id, name) => {
        const update = (cats) => cats.map(c => {
            if (c.id === id) return { ...c, name, isNew: false };
            if (c.children?.length) return { ...c, children: update(c.children) };
            return c;
        });
        setForm(p => ({ ...p, categories: update(p.categories) }));
        setSelectedCategory(p => p?.id === id ? { ...p, name } : p);
    };

    const handleDeleteCategory = (cat) => {
        const deleteFromTree = (cats, id) => cats
            .filter(c => c.id !== id)
            .map(c => ({ ...c, children: c.children ? deleteFromTree(c.children, id) : [] }));

        const newCats = deleteFromTree(categories, cat.id);
        const newCourses = { ...coursesByCategory };
        const collectIds = (c) => [c.id, ...(c.children || []).flatMap(collectIds)];
        collectIds(cat).forEach(id => delete newCourses[id]);

        setForm(p => ({ ...p, categories: newCats, coursesByCategory: newCourses }));
        if (selectedCategory?.id === cat.id) setSelectedCategory(null);
    };

    const handleUpdateCategory = (id, updates) => {
        const update = (cats) => cats.map(c => {
            if (c.id === id) return { ...c, ...updates };
            if (c.children?.length) return { ...c, children: update(c.children) };
            return c;
        });
        setForm(p => ({ ...p, categories: update(p.categories) }));
        setSelectedCategory(p => p?.id === id ? { ...p, ...updates } : p);
    };

    const handleAddCourse = () => {
        if (!selectedCategory) return;
        const course = { id: `course_${Date.now()}`, code: '', nameTh: '', nameEn: '', credits: 0 };
        setForm(p => ({
            ...p,
            coursesByCategory: {
                ...p.coursesByCategory,
                [selectedCategory.id]: [...(p.coursesByCategory[selectedCategory.id] || []), course],
            },
        }));
    };

    const handleUpdateCourse = (updatedCourse) => {
        if (!selectedCategory) return;
        setForm(p => ({
            ...p,
            coursesByCategory: {
                ...p.coursesByCategory,
                [selectedCategory.id]: (p.coursesByCategory[selectedCategory.id] || []).map(c =>
                    c.id === updatedCourse.id ? updatedCourse : c
                ),
            },
        }));
    };

    const handleDeleteCourse = (course) => {
        if (!selectedCategory) return;
        setForm(p => ({
            ...p,
            coursesByCategory: {
                ...p.coursesByCategory,
                [selectedCategory.id]: (p.coursesByCategory[selectedCategory.id] || []).filter(c => c.id !== course.id),
            },
        }));
    };

    const addCredits = (cat, visited = new Set()) => {
        if (visited.has(cat.id)) return 0; // กัน loop
        visited.add(cat.id);

        return (cat.requiredCredits || 0) +
            (cat.children || []).reduce((s, ch) => s + addCredits(ch, visited), 0);
    };

    const totalCredits = categories.reduce((sum, c) => sum + addCredits(c), 0);

    const totalCourses = Object.values(coursesByCategory).flat().length;
    const totalCategories = categories.length + categories.reduce((sum, c) => sum + (c.children || []).length, 0);

    return (
        <div className="cfm-step2" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
            {/* Stats Bar */}
            <div style={{ display: 'flex', gap: '1rem', flexShrink: 0 }}>
                <div style={{ background: 'var(--tm-card-bg)', border: '1px solid var(--tm-border)', borderRadius: 8, padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Layers size={16} style={{ color: 'var(--tm-accent)' }} />
                    <span style={{ fontSize: '0.875rem' }}><strong>{totalCategories}</strong> หมวด</span>
                </div>
                <div style={{ background: 'var(--tm-card-bg)', border: '1px solid var(--tm-border)', borderRadius: 8, padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <BookOpen size={16} style={{ color: 'var(--tm-accent)' }} />
                    <span style={{ fontSize: '0.875rem' }}><strong>{totalCourses}</strong> วิชา</span>
                </div>
                <div style={{ background: 'var(--tm-card-bg)', border: '1px solid var(--tm-border)', borderRadius: 8, padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Award size={16} style={{ color: 'var(--tm-accent)' }} />
                    <span style={{ fontSize: '0.875rem' }}><strong>{totalCredits}</strong> หน่วยกิต</span>
                </div>
            </div>

            {/* Panel Layout - Side by Side */}
            <div className="tm-panel ccp-panel" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                <div className="ccp-body" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                    {/* Tree Sidebar */}
                    <div className="ccp-tree">
                        <div className="ccp-tree__header">
                            <span>โครงสร้างหมวดวิชา</span>
                            <button 
                                className="btn btn--primary btn--sm ccp-tree__add-btn" 
                                onClick={handleAddCategory}
                                disabled={selectedCategory ? getCategoryDepth(selectedCategory, categories) >= 3 : false}
                                title={selectedCategory ? (getCategoryDepth(selectedCategory, categories) >= 3 ? 'หมวดนี้อยู่ระดับสูงสุดแล้ว' : 'เพิ่มหมวดย่อย') : ''}
                            >
                                <Plus size={12}/> หมวดวิชา
                            </button>
                        </div>
                        <div className="ccp-tree__scroll" onClick={() => setSelectedCategory(null)}>
                            {categories.length === 0 ? (
                                <div className="panel-empty panel-empty--sm">กด "+ หมวดวิชา" เพื่อเริ่ม</div>
                            ) : (
                                categories.map(cat => (
                                    <TreeItem
                                        key={cat.id}
                                        cat={cat}
                                        selectedId={selectedCategory?.id}
                                        onSelect={setSelectedCategory}
                                        onRename={handleRenameCategory}
                                        onCreateChild={handleAddChildCategory}
                                        onDelete={handleDeleteCategory}
                                    />
                                ))
                            )}
                        </div>
                    </div>

                    {/* Sheet Area */}
                    <div className="ccp-sheet">
                        <div className="ccp-sheet__toolbar">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                {selectedCategory ? (
                                    <>
                                        <span className="ccp-sheet__cat">{selectedCategory.code} {selectedCategory.name || <em style={{color: '#64748b'}}>ยังไม่ตั้งชื่อ</em>}</span>
                                        <input
                                            type="number"
                                            className="cfm-input"
                                            style={{ width: 80, padding: '0.375rem 0.5rem', fontSize: '0.8125rem' }}
                                            value={selectedCategory.requiredCredits || 0}
                                            onChange={e => handleUpdateCategory(selectedCategory.id, { requiredCredits: parseInt(e.target.value) || 0 })}
                                            placeholder="หน่วยกิต"
                                        />
                                    </>
                                ) : (
                                    <span style={{ color: 'var(--tm-text-muted)', fontSize: '0.875rem' }}>เลือกหมวดวิชาเพื่อจัดการรายวิชา</span>
                                )}
                            </div>
                            <div style={{ marginLeft: 'auto' }}>
                                {selectedCategory && (
                                    <button className="btn btn--primary btn--sm" onClick={handleAddCourse}>
                                        <Plus size={13}/> เพิ่มรายวิชา
                                    </button>
                                )}
                            </div>
                        </div>

                        {selectedCategory ? (
                            <CourseTable
                                catId={selectedCategory.id}
                                courses={courses}
                                onUpdateCourse={handleUpdateCourse}
                                onDeleteCourse={handleDeleteCourse}
                            />
                        ) : (
                            <div className="panel-empty">
                                <BookOpen size={22} opacity={0.3}/>
                                <span>เลือกหมวดวิชาเพื่อดูรายวิชา</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ============================================================
// Step 3 — Overview
// ============================================================
function Step3({ form }) {
    const categories = form.categories || [];
    const coursesByCategory = form.coursesByCategory || {};

    const totalCredits = categories.reduce((sum, c) => {
        const addCredits = (cat) => sum + (cat.requiredCredits || 0) + (cat.children || []).reduce((s, ch) => s + addCredits(ch), 0);
        return sum + addCredits(c);
    }, 0);

    const totalCourses = Object.values(coursesByCategory).flat().length;
    const totalCategories = categories.length + categories.reduce((sum, c) => sum + (c.children || []).length, 0);
    const coreCourses = Object.values(coursesByCategory).flat().filter(c => c.isCoreCourse).length;
    const electiveCourses = totalCourses - coreCourses;

    return (
        <div className="cfm-step3">
            <div className="cm-overview-stats">
                <div className="cm-overview-stat">
                    <div className="cm-overview-stat__value">{totalCourses}</div>
                    <div className="cm-overview-stat__label">วิชาทั้งหมด</div>
                </div>
                <div className="cm-overview-stat">
                    <div className="cm-overview-stat__value">{totalCategories}</div>
                    <div className="cm-overview-stat__label">หมวดวิชา</div>
                </div>
                <div className="cm-overview-stat">
                    <div className="cm-overview-stat__value">{totalCredits}</div>
                    <div className="cm-overview-stat__label">หน่วยกิตรวม</div>
                </div>
                <div className="cm-overview-stat">
                    <div className="cm-overview-stat__value">{coreCourses}</div>
                    <div className="cm-overview-stat__label">วิชาบังคับ</div>
                </div>
            </div>

            <div className="cm-overview-info">
                <h4 className="cm-overview-info__title">ข้อมูลหลักสูตร</h4>
                <div className="cm-overview-info__grid">
                    <div className="cm-overview-info__item">
                        <span className="cm-overview-info__label">ชื่อหลักสูตร (ไทย)</span>
                        <span className="cm-overview-info__value">{form.nameTh || '-'}</span>
                    </div>
                    <div className="cm-overview-info__item">
                        <span className="cm-overview-info__label">ชื่อหลักสูตร (อังกฤษ)</span>
                        <span className="cm-overview-info__value">{form.nameEn || '-'}</span>
                    </div>
                    <div className="cm-overview-info__item">
                        <span className="cm-overview-info__label">ปีการศึกษา</span>
                        <span className="cm-overview-info__value">{form.year ? `ปีการศึกษา ${form.year}` : '-'}</span>
                    </div>
                    <div className="cm-overview-info__item">
                        <span className="cm-overview-info__label">ชื่อปริญญา</span>
                        <span className="cm-overview-info__value">{form.degreeName || '-'}</span>
                    </div>
                    <div className="cm-overview-info__item">
                        <span className="cm-overview-info__label">ชื่อปริญญาเต็ม (ไทย)</span>
                        <span className="cm-overview-info__value">{form.degreeFullNameTh || '-'}</span>
                    </div>
                    <div className="cm-overview-info__item">
                        <span className="cm-overview-info__label">ชื่อปริญญาเต็ม (อังกฤษ)</span>
                        <span className="cm-overview-info__value">{form.degreeFullNameEn || '-'}</span>
                    </div>
                    <div className="cm-overview-info__item">
                        <span className="cm-overview-info__label">ชื่อย่อ (ไทย)</span>
                        <span className="cm-overview-info__value">{form.degreeAbbrTh || '-'}</span>
                    </div>
                    <div className="cm-overview-info__item">
                        <span className="cm-overview-info__label">ชื่อย่อ (อังกฤษ)</span>
                        <span className="cm-overview-info__value">{form.degreeAbbrEn || '-'}</span>
                    </div>
                </div>
            </div>

            <div className="cm-overview-info">
                <h4 className="cm-overview-info__title">โครงสร้างหลักสูตร</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {categories.map(cat => {
                        const catCourses = coursesByCategory[cat.id] || [];
                        return (
                            <div key={cat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'var(--tm-hover)', borderRadius: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--tm-accent)', minWidth: 40 }}>{cat.code}</span>
                                    <span style={{ fontSize: '0.875rem', color: 'var(--tm-text)' }}>{cat.name || <em style={{color: '#64748b'}}>ยังไม่ตั้งชื่อ</em>}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.8125rem', color: 'var(--tm-text-muted)' }}>
                                    <span>{catCourses.length} วิชา</span>
                                    <span>{cat.requiredCredits || 0} หน่วยกิต</span>
                                </div>
                            </div>
                        );
                    })}
                    {categories.length === 0 && (
                        <p style={{ textAlign: 'center', color: 'var(--tm-text-muted)', padding: '1rem' }}>ยังไม่มีโครงสร้างหลักสูตร</p>
                    )}
                </div>
            </div>
        </div>
    );
}

// ============================================================
// Main Modal
// ============================================================
const EMPTY_FORM = {
    nameTh: '',
    nameEn: '',
    year: null,
    degreeName: '',
    degreeNameEn: '',
    degreeFullNameTh: '',
    degreeFullNameEn: '',
    degreeAbbrTh: '',
    degreeAbbrEn: '',
    categories: [],
    coursesByCategory: {},
};

// ============================================================
// Helper — แปลง nested cat.courses → coursesByCategory
// ============================================================
function buildCoursesByCategory(categories) {
    const result = {};
    const walk = (cats) => {
        for (const cat of cats) {
            if (cat.courses?.length) {
                result[cat.id] = cat.courses;
            }
            if (cat.children?.length) walk(cat.children);
        }
    };
    walk(categories || []);
    return result;
}

export default function CourseFormModal({ course, onClose, onSave }) {
    const [step, setStep] = useState(1);
    const [form, setForm] = useState(course ? {
        ...course,
        coursesByCategory: course.coursesByCategory && Object.keys(course.coursesByCategory).length > 0
            ? course.coursesByCategory
            : buildCoursesByCategory(course.categories),
    } : EMPTY_FORM);

    const canNext = () => {
        if (step === 1) {
            return form.nameTh.trim() && form.nameEn.trim() && form.year && form.degreeName && form.degreeFullNameTh;
        }
        return true;
    };

    const handleSave = () => {
        const stats = {
            totalCourses: Object.values(form.coursesByCategory || {}).flat().length,
            totalCategories: form.categories.length + form.categories.reduce((sum, c) => sum + (c.children || []).length, 0),
            totalCredits: form.categories.reduce((sum, c) => {
                const addCredits = (cat) => sum + (cat.requiredCredits || 0) + (cat.children || []).reduce((s, ch) => s + addCredits(ch), 0);
                return sum + addCredits(c);
            }, 0),
            coreCourses: Object.values(form.coursesByCategory || {}).flat().filter(c => c.isCoreCourse).length,
            electiveCourses: Object.values(form.coursesByCategory || {}).flat().filter(c => !c.isCoreCourse).length,
        };

        onSave({
            ...form,
            stats,
            isActive: course?.isActive ?? true,
            templateCount: course?.templateCount ?? 0,
        });
    };

    return (
        <BaseModal
            open
            title={course ? 'แก้ไขหลักสูตร' : 'สร้างหลักสูตรใหม่'}
            size="xl"
            onClose={onClose}
            footer={(
                <>
                    {step === 1 ? (
                        <>
                            <button className="btn btn--ghost" onClick={onClose}>ยกเลิก</button>
                            <button className="btn btn--primary" disabled={!canNext()} onClick={() => setStep(2)}>
                                ถัดไป <ArrowRight size={15}/>
                            </button>
                        </>
                    ) : step === 2 ? (
                        <>
                            <button className="btn btn--ghost" onClick={() => setStep(1)}>
                                <ArrowLeft size={15}/> ย้อนกลับ
                            </button>
                            <button className="btn btn--primary" onClick={() => setStep(3)}>
                                ถัดไป <ArrowRight size={15}/>
                            </button>
                        </>
                    ) : (
                        <>
                            <button className="btn btn--ghost" onClick={() => setStep(2)}>
                                <ArrowLeft size={15}/> ย้อนกลับ
                            </button>
                            <button className="btn btn--primary" onClick={handleSave}>
                                <Check size={15}/> บันทึกหลักสูตร
                            </button>
                        </>
                    )}
                </>
            )}
        >
                <div style={{ padding: '0.75rem 1.5rem 0' }}>
                    <StepIndicator step={step}/>
                </div>
                <div style={{ padding: '1rem 1.5rem', overflow: 'auto', flex: 1 }}>
                    {step === 1 && <Step1 form={form} setForm={setForm}/>}
                    {step === 2 && <Step2 form={form} setForm={setForm}/>}
                    {step === 3 && <Step3 form={form}/>}
                </div>
        </BaseModal>
    );
}
