'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X, Check, ChevronRight, ChevronDown, Plus, Trash2, ArrowLeft, ArrowRight, Layers, BookOpen, Award, FileText, Pencil, GripVertical, AlertTriangle } from 'lucide-react';
import { createCurriculumFromForm } from '../../../../lib/curriculum';
import '../../../../app/Competency.css';
import '../CourseLayout.css';
import '../CourseCreate.css';
import '../../template-management/TemplateManagement.css';

function StepIndicator({ step }) {
    const steps = ['ข้อมูลหลักสูตร', 'โครงสร้างหลักสูตร', 'ภาพรวม'];
    return (
        <div className="course-steps">
            {steps.map((label, i) => {
                const n = i + 1;
                const active = step === n;
                const done = step > n;
                return (
                    <React.Fragment key={n}>
                        <div className={`course-step-item ${active ? 'course-step-item--active' : ''} ${done ? 'course-step-item--done' : ''}`}>
                            <span className="course-step-item__num">
                                {done ? <Check size={12} /> : n}
                            </span>
                            <span className="course-step-item__label">{label}</span>
                        </div>
                        {i < steps.length - 1 && (
                            <div className={`course-step-line ${step >= i + 2 ? 'course-step-line--done' : ''}`} />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
}

function Step1({ form, setForm }) {
    return (
        <div className="course-form-group">
            <div className="course-form-field">
                <label className="course-form-field__label">ชื่อหลักสูตร (ภาษาไทย)<span className="course-form-field__required">*</span></label>
                <input
                    className="course-form-field__input"
                    value={form.nameTh}
                    onChange={e => setForm(p => ({ ...p, nameTh: e.target.value }))}
                    placeholder="เช่น หลักสูตรวิทยาการคอมพิวเตอร์"
                    autoFocus
                />
            </div>

            <div className="course-form-field">
                <label className="course-form-field__label">ชื่อหลักสูตร (ภาษาอังกฤษ)<span className="course-form-field__required">*</span></label>
                <input
                    className="course-form-field__input"
                    value={form.nameEn}
                    onChange={e => setForm(p => ({ ...p, nameEn: e.target.value }))}
                    placeholder="เช่น Computer Science"
                />
            </div>

            <div className="course-form-row">
                <div className="course-form-field">
                    <label className="course-form-field__label">รหัสหลักสูตร<span className="course-form-field__required">*</span></label>
                    <input
                        className="course-form-field__input"
                        value={form.code}
                        onChange={e => setForm(p => ({ ...p, code: e.target.value }))}
                        placeholder="เช่น cp_2568_curriculum"
                    />
                </div>
                <div className="course-form-field">
                    <label className="course-form-field__label">Major ID<span className="course-form-field__required">*</span></label>
                    <input
                        type="number"
                        className="course-form-field__input"
                        value={form.majorId || ''}
                        onChange={e => setForm(p => ({ ...p, majorId: parseInt(e.target.value, 10) || '' }))}
                        placeholder="เช่น 1"
                        min={1}
                    />
                </div>
            </div>

            <div className="course-form-row">
                <div className="course-form-field">
                    <label className="course-form-field__label">ปีการศึกษา<span className="course-form-field__required">*</span></label>
                    <input
                        type="number"
                        className="course-form-field__input"
                        value={form.year || ''}
                        onChange={e => setForm(p => ({ ...p, year: parseInt(e.target.value) || null }))}
                        placeholder="เช่น 2568"
                        min={2500}
                        max={2600}
                    />
                </div>
                <div className="course-form-field">
                    <label className="course-form-field__label">ชื่อปริญญา (ภาษาไทย)<span className="course-form-field__required">*</span></label>
                    <input
                        className="course-form-field__input"
                        value={form.degreeName}
                        onChange={e => setForm(p => ({ ...p, degreeName: e.target.value }))}
                        placeholder="เช่น วิทยาศาสตรบัณฑิต"
                    />
                </div>
            </div>

            <div className="course-form-field">
                <label className="course-form-field__label">ชื่อปริญญา (ภาษาอังกฤษ)</label>
                <input
                    className="course-form-field__input"
                    value={form.degreeNameEn}
                    onChange={e => setForm(p => ({ ...p, degreeNameEn: e.target.value }))}
                    placeholder="เช่น Bachelor of Science"
                />
            </div>

            <div className="course-form-field">
                <label className="course-form-field__label">ชื่อปริญญาเต็ม (ภาษาไทย)<span className="course-form-field__required">*</span></label>
                <input
                    className="course-form-field__input"
                    value={form.degreeFullNameTh}
                    onChange={e => setForm(p => ({ ...p, degreeFullNameTh: e.target.value }))}
                    placeholder="เช่น วิทยาศาสตรบัณฑิต (วิทยาการคอมพิวเตอร์)"
                />
            </div>

            <div className="course-form-field">
                <label className="course-form-field__label">ชื่อปริญญาเต็ม (ภาษาอังกฤษ)</label>
                <input
                    className="course-form-field__input"
                    value={form.degreeFullNameEn}
                    onChange={e => setForm(p => ({ ...p, degreeFullNameEn: e.target.value }))}
                    placeholder="เช่น Bachelor of Science (Computer Science)"
                />
            </div>

            <div className="course-form-row">
                <div className="course-form-field">
                    <label className="course-form-field__label">ชื่อย่อ (ภาษาไทย)</label>
                    <input
                        className="course-form-field__input"
                        value={form.degreeAbbrTh}
                        onChange={e => setForm(p => ({ ...p, degreeAbbrTh: e.target.value }))}
                        placeholder="เช่น ว.บ. (วิทยาการคอมพิวเตอร์)"
                    />
                </div>
                <div className="course-form-field">
                    <label className="course-form-field__label">ชื่อย่อ (ภาษาอังกฤษ)</label>
                    <input
                        className="course-form-field__input"
                        value={form.degreeAbbrEn}
                        onChange={e => setForm(p => ({ ...p, degreeAbbrEn: e.target.value }))}
                        placeholder="เช่น B.Sc. (Computer Science)"
                    />
                </div>
            </div>
        </div>
    );
}

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

    return (
        <tr className="course-row">
            <td className="course-row__cell course-row__cell--grip">
                <GripVertical size={13} />
            </td>
            <td className="course-row__cell" onClick={() => setEditing(true)}>
                {editing ? (
                    <input className="course-row__input course-row__input--code" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} placeholder="รหัสวิชา" />
                ) : (
                    <span className="course-row__code">{course.code || '-'}</span>
                )}
            </td>
            <td className="course-row__cell" onClick={() => setEditing(true)}>
                {editing ? (
                    <input className="course-row__input" value={form.nameTh} onChange={e => setForm(p => ({ ...p, nameTh: e.target.value }))} placeholder="ชื่อวิชาภาษาไทย" />
                ) : (
                    <span>{course.nameTh || '-'}</span>
                )}
            </td>
            <td className="course-row__cell" onClick={() => setEditing(true)}>
                {editing ? (
                    <input className="course-row__input" value={form.nameEn} onChange={e => setForm(p => ({ ...p, nameEn: e.target.value }))} placeholder="English Name" />
                ) : (
                    <span className="course-row__text-muted">{course.nameEn || '-'}</span>
                )}
            </td>
            <td className="course-row__cell" style={{ width: 60, textAlign: 'center' }} onClick={() => setEditing(true)}>
                {editing ? (
                    <input className="course-row__input course-row__input--credits" type="number" min={0} max={12} value={form.credits} onChange={e => setForm(p => ({ ...p, credits: e.target.value }))} />
                ) : (
                    <span>{course.credits || 0}</span>
                )}
            </td>
            <td className="course-row__cell course-row__cell--actions">
                {editing ? (
                    <button className="course-row__btn course-row__btn--save" onClick={handleSave}>
                        <Check size={12} />
                    </button>
                ) : (
                    <button className="course-row__btn course-row__btn--edit" onClick={() => setEditing(true)}>
                        <Pencil size={12} />
                    </button>
                )}
                <button className="course-row__btn course-row__btn--delete" onClick={() => onDelete(course)}>
                    <Trash2 size={12} />
                </button>
            </td>
        </tr>
    );
}

function SpreadsheetRow({ course, isSelected, isEditingCourse, onToggleSelect, onUpdate, onDelete, onSetEditing }) {
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState({
        code: course.code || '',
        nameTh: course.nameTh || '',
        nameEn: course.nameEn || '',
        credits: course.credits || 0,
    });

    useEffect(() => {
        if (isEditingCourse) {
            setEditing(true);
        } else {
            setEditing(false);
        }
    }, [isEditingCourse]);

    useEffect(() => {
        if (editing) {
            setForm({
                code: course.code || '',
                nameTh: course.nameTh || '',
                nameEn: course.nameEn || '',
                credits: course.credits || 0,
            });
        }
    }, [course.code, course.nameTh, course.nameEn, course.credits, editing]);

    const handleSave = () => {
        if (!form.code.trim() && !form.nameTh.trim()) return;
        onUpdate({ ...course, ...form, credits: Number(form.credits) || 0 });
        setEditing(false);
        if (onSetEditing) onSetEditing(null);
    };

    const handleKey = (e) => {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') {
            setForm({ code: course.code || '', nameTh: course.nameTh || '', nameEn: course.nameEn || '', credits: course.credits || 0 });
            setEditing(false);
            if (onSetEditing) onSetEditing(null);
        }
    };

    const handleCellClick = () => setEditing(true);

    return (
        <tr className={`ss-row ${editing ? 'ss-row--editing' : ''} ${isSelected ? 'ss-row--selected' : ''}`}>
            <td className="ss-cell ss-cell--checkbox">
                <input
                    type="checkbox"
                    checked={isSelected || false}
                    onChange={() => onToggleSelect(course.id)}
                />
            </td>
            <td className="ss-cell ss-cell--grip">
                <GripVertical size={13} />
            </td>
            <td className="ss-cell" onClick={handleCellClick}>
                {editing ? (
                    <input
                        className="ss-input"
                        value={form.code}
                        onChange={e => setForm(p => ({ ...p, code: e.target.value }))}
                        onKeyDown={handleKey}
                        placeholder="รหัสวิชา"
                    />
                ) : (
                    <span className="ss-code">{course.code || <span className="ss-placeholder">รหัสวิชา</span>}</span>
                )}
            </td>
            <td className="ss-cell ss-cell--wide" onClick={handleCellClick}>
                {editing ? (
                    <input
                        className="ss-input"
                        value={form.nameTh}
                        onChange={e => setForm(p => ({ ...p, nameTh: e.target.value }))}
                        onKeyDown={handleKey}
                        placeholder="ชื่อวิชาภาษาไทย"
                    />
                ) : (
                    <span>{course.nameTh || <span className="ss-placeholder">ชื่อภาษาไทย</span>}</span>
                )}
            </td>
            <td className="ss-cell ss-cell--wide" onClick={handleCellClick}>
                {editing ? (
                    <input
                        className="ss-input"
                        value={form.nameEn}
                        onChange={e => setForm(p => ({ ...p, nameEn: e.target.value }))}
                        onKeyDown={handleKey}
                        placeholder="English Name"
                    />
                ) : (
                    <span>{course.nameEn || <span className="ss-placeholder">English Name</span>}</span>
                )}
            </td>
            <td className="ss-cell ss-cell--num" onClick={handleCellClick}>
                {editing ? (
                    <input
                        className="ss-input ss-input--num"
                        type="text"
                        inputMode="numeric"
                        value={form.credits}
                        onChange={e => {
                            const val = e.target.value.replace(/[^0-9]/g, '');
                            setForm(p => ({ ...p, credits: val }));
                        }}
                        onKeyDown={handleKey}
                        placeholder="0"
                        autoFocus
                    />
                ) : (
                    <span>{course.credits || <span className="ss-placeholder">0</span>}</span>
                )}
            </td>
            <td className="ss-cell ss-cell--actions" onClick={e => e.stopPropagation()}>
                {editing ? (
                    <button className="icon-course-btn icon-course-btn--edit icon-course-btn--xs" onClick={handleSave}>
                        <Check size={13} />
                    </button>
                ) : null}
            </td>
        </tr>
    );
}

function TreeItem({ cat, depth = 0, selectedId, onSelect, onRename, onCreateChild, onDelete, handleUpdateCategory, getTotalCredits, coursesByCategory }) {
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

    const totalCredits = getTotalCredits ? getTotalCredits(cat) : (cat.requiredCredits || 0);

    const confirm = () => { onRename(cat.id, nameVal || 'หมวดใหม่'); setRenaming(false); };

    return (
        <div>
            <div
                className={`course-tree-item ${isSelected ? 'course-tree-item--selected' : ''}`}
                style={{ paddingLeft: `${0.5 + depth * 1}rem` }}
                onClick={e => { e.stopPropagation(); onSelect(cat); if (hasChildren) setExpanded(p => !p); }}
            >
                <span style={{ width: 14, display: 'flex', justifyContent: 'center' }}>
                    {hasChildren ? (expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />) : null}
                </span>

                {renaming ? (
                    <input
                        ref={inputRef}
                        style={{
                            flex: 1,
                            padding: '0.25rem 0.5rem',
                            border: '1px solid var(--border)',
                            borderRadius: 4,
                            fontSize: '0.8125rem',
                            background: 'var(--background)',
                            color: 'var(--foreground)',
                        }}
                        value={nameVal}
                        onChange={e => setNameVal(e.target.value)}
                        onBlur={confirm}
                        onKeyDown={e => { if (e.key === 'Enter') confirm(); if (e.key === 'Escape') setRenaming(false); }}
                        onClick={e => e.stopPropagation()}
                    />
                ) : (
                    <span style={{ flex: 1, fontSize: '0.8125rem', fontWeight: 500 }}>
                        {cat.code} {cat.name || <em style={{ opacity: 0.6 }}>ยังไม่ตั้งชื่อ</em>}
                    </span>
                )}

                <span style={{ fontSize: '0.75rem', color: isSelected ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' }}>
                    {totalCredits} หน่วยกิต
                </span>
            </div>

            {expanded && hasChildren && (
                <div>
                    {cat.children.map(child => (
                        <TreeItem
                            key={child.id}
                            cat={child}
                            depth={depth + 1}
                            selectedId={selectedId}
                            onSelect={onSelect}
                            onRename={onRename}
                            onCreateChild={onCreateChild}
                            onDelete={onDelete}
                            handleUpdateCategory={handleUpdateCategory}
                            getTotalCredits={getTotalCredits}
                            coursesByCategory={coursesByCategory}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function Step2({ form, setForm, selectedCategory, setSelectedCategory }) {
    const categories = form.categories || [];
    const coursesByCategory = form.coursesByCategory || {};
    const [selectedCourseIds, setSelectedCourseIds] = useState(new Set());
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [editingCourseId, setEditingCourseId] = useState(null);
    const [showDeleteCategoryModal, setShowDeleteCategoryModal] = useState(false);
    const [categoryToDelete, setCategoryToDelete] = useState(null);
    const [editingCategoryName, setEditingCategoryName] = useState(false);
    const [categoryNameVal, setCategoryNameVal] = useState('');

    const getDepth = (cat, depth = 0) => {
        if (!cat.children?.length) return depth;
        return Math.max(...cat.children.map(c => getDepth(c, depth + 1)));
    };

    const getMaxDepth = (cats, depth = 0) => {
        if (!cats?.length) return depth - 1;
        return Math.max(...cats.map(c => getDepth(c, depth)));
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

    const maxDepthReached = false;

    const getAllCoursesInCategory = (cat) => {
        const courses = coursesByCategory[cat.id] || [];
        const childCourses = (cat.children || []).flatMap(c => getAllCoursesInCategory(c));
        return [...courses, ...childCourses];
    };

    const courses = selectedCategory ? getAllCoursesInCategory(selectedCategory) : [];

    const isLeafCategory = selectedCategory && !(selectedCategory.children?.length > 0);

    const getNextCode = (siblings) => `${siblings.length + 1}`;
    const getNextChildCode = (parentCode, siblings) => `${parentCode}.${siblings.length + 1}`;

    const handleAddCategory = () => {
        if (selectedCategory) {
            handleAddChildCategory(selectedCategory);
            return;
        }

        if (maxDepthReached) return;
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

    const handleAddChildCategory = (parent) => {
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

        const parentCourses = coursesByCategory[parent.id] || [];

        const updateCategories = (cats) => cats.map(c => {
            if (c.id === parent.id) {
                return { ...c, children: [...(c.children || []), newCat] };
            }
            if (c.children?.length) {
                return { ...c, children: updateCategories(c.children) };
            }
            return c;
        });

        const newCoursesByCategory = { ...coursesByCategory };
        delete newCoursesByCategory[parent.id];
        newCoursesByCategory[newCat.id] = parentCourses;

        setForm(p => ({
            ...p,
            categories: updateCategories(p.categories),
            coursesByCategory: newCoursesByCategory,
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
        setCategoryToDelete(cat);
        setShowDeleteCategoryModal(true);
    };

    const confirmDeleteCategory = () => {
        if (!categoryToDelete) return;

        const cat = categoryToDelete;
        const deleteFromTree = (cats, id) => cats
            .filter(c => c.id !== id)
            .map(c => ({ ...c, children: c.children ? deleteFromTree(c.children, id) : [] }));

        const newCats = deleteFromTree(categories, cat.id);
        const newCourses = { ...coursesByCategory };
        const collectIds = (c) => [c.id, ...(c.children || []).flatMap(collectIds)];
        collectIds(cat).forEach(id => delete newCourses[id]);

        setForm(p => ({ ...p, categories: newCats, coursesByCategory: newCourses }));
        if (selectedCategory?.id === cat.id) setSelectedCategory(null);

        setShowDeleteCategoryModal(false);
        setCategoryToDelete(null);
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
        if (!selectedCategory || !isLeafCategory) return;
        const courseId = `course_${Date.now()}`;
        const course = { id: courseId, code: '', nameTh: '', nameEn: '', credits: 0 };
        setForm(p => ({
            ...p,
            coursesByCategory: {
                ...p.coursesByCategory,
                [selectedCategory.id]: [...(p.coursesByCategory[selectedCategory.id] || []), course],
            },
        }));
        setEditingCourseId(courseId);
    };

    const handleUpdateCourse = (updatedCourse) => {
        if (!selectedCategory) return;

        const findAndUpdateCourse = (cats, courseId, updated) => {
            return cats.map(c => {
                const catCourses = coursesByCategory[c.id] || [];
                const updatedCourses = catCourses.map(cour =>
                    cour.id === courseId ? updated : cour
                );
                if (updatedCourses !== catCourses) {
                    const newCourses = { ...coursesByCategory, [c.id]: updatedCourses };
                    return { ...c };
                }
                if (c.children?.length) {
                    return { ...c, children: findAndUpdateCourse(c.children, courseId, updated) };
                }
                return c;
            });
        };

        const newCoursesByCategory = { ...coursesByCategory };
        newCoursesByCategory[selectedCategory.id] = (coursesByCategory[selectedCategory.id] || []).map(c =>
            c.id === updatedCourse.id ? updatedCourse : c
        );

        setForm(p => ({
            ...p,
            coursesByCategory: newCoursesByCategory,
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

    const handleToggleCourseSelection = (courseId) => {
        setSelectedCourseIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(courseId)) {
                newSet.delete(courseId);
            } else {
                newSet.add(courseId);
            }
            return newSet;
        });
    };

    const handleSelectAllCourses = () => {
        if (selectedCourseIds.size === courses.length) {
            setSelectedCourseIds(new Set());
        } else {
            setSelectedCourseIds(new Set(courses.map(c => c.id)));
        }
    };

    const handleDeleteSelectedCourses = () => {
        if (selectedCourseIds.size === 0) return;
        setForm(p => ({
            ...p,
            coursesByCategory: {
                ...p.coursesByCategory,
                [selectedCategory.id]: (p.coursesByCategory[selectedCategory.id] || []).filter(c => !selectedCourseIds.has(c.id)),
            },
        }));
        setSelectedCourseIds(new Set());
        setShowDeleteModal(false);
    };

    const addCredits = (cat, visited = new Set()) => {
        if (visited.has(cat.id)) return 0;
        visited.add(cat.id);
        return (cat.requiredCredits || 0) +
            (cat.children || []).reduce((s, ch) => s + addCredits(ch, visited), 0);
    };

    const getCategoryTotalCredits = (cat) => {
        const catCredits = addCredits(cat);
        const courses = coursesByCategory[cat.id] || [];
        const courseCredits = courses.reduce((sum, c) => sum + (c.credits || 0), 0);
        return catCredits + courseCredits;
    };

    const totalCredits = categories.reduce((sum, c) => sum + getCategoryTotalCredits(c), 0);
    const totalCourses = Object.values(coursesByCategory).flat().length;
    const totalCategories = categories.length + categories.reduce((sum, c) => sum + (c.children || []).length, 0);

    return (
        <div className="course-structure-panel">
            {/* Stats Bar */}
            <div className="course-stats-bar">
                <div className="course-stats-bar__item">
                    <Layers size={16} className="course-stats-bar__icon" />
                    <span className="course-stats-bar__text"><strong>{totalCategories}</strong> หมวด</span>
                </div>
                <div className="course-stats-bar__item">
                    <BookOpen size={16} className="course-stats-bar__icon" />
                    <span className="course-stats-bar__text"><strong>{totalCourses}</strong> วิชา</span>
                </div>
                <div className="course-stats-bar__item">
                    <Award size={16} className="course-stats-bar__icon" />
                    <span className="course-stats-bar__text"><strong>{totalCredits}</strong> หน่วยกิต</span>
                </div>
            </div>

            {/* Panel Layout */}
            <div className="course-two-panel">
                {/* Tree Sidebar */}
                <div className="course-two-panel__sidebar">
                    <div className="course-two-panel__header">
                        <span className="course-two-panel__title">โครงสร้างหมวดวิชา</span>
                        <button
                            className="course-btn course-btn--primary course-btn--sm"
                            onClick={handleAddCategory}
                            disabled={selectedCategory ? getCategoryDepth(selectedCategory, categories) >= 3 : false}
                        >
                            <Plus size={12} /> หมวดวิชา
                        </button>
                    </div>
                    <div className="course-tree-list" onClick={() => setSelectedCategory(null)}>
                        {categories.length === 0 ? (
                            <div className="course-tree-empty">
                                กด "+ หมวดวิชา" เพื่อเริ่ม
                            </div>
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
                                    handleUpdateCategory={handleUpdateCategory}
                                    getTotalCredits={getCategoryTotalCredits}
                                    coursesByCategory={coursesByCategory}
                                />
                            ))
                        )}
                    </div>
                </div>

                {/* Sheet Area */}
                <div className="course-two-panel__content">
                    {/* Row 1: Category Name - Credits - Delete Button */}
                    <div className="course-detail-toolbar">
                        <div className="course-detail-toolbar__left">
                            <span className="course-detail-toolbar__label">ชื่อหมวดวิชา</span>
                            {selectedCategory ? (
                                <div className="course-detail-toolbar__name">
                                    {editingCategoryName ? (
                                        <input
                                            autoFocus
                                            className="course-detail-toolbar__name-input"
                                            value={categoryNameVal}
                                            onChange={e => setCategoryNameVal(e.target.value)}
                                            onBlur={() => {
                                                handleUpdateCategory(selectedCategory.id, { name: categoryNameVal || 'หมวดใหม่' });
                                                setEditingCategoryName(false);
                                            }}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') {
                                                    handleUpdateCategory(selectedCategory.id, { name: categoryNameVal || 'หมวดใหม่' });
                                                    setEditingCategoryName(false);
                                                }
                                                if (e.key === 'Escape') setEditingCategoryName(false);
                                            }}
                                        />
                                    ) : (
                                        <>
                                            <span className="course-detail-toolbar__name-text">
                                                {selectedCategory.code} {selectedCategory.name || <em>ยังไม่ตั้งชื่อ</em>}
                                            </span>
                                            <button
                                                className="course-detail-toolbar__edit-btn"
                                                onClick={() => {
                                                    setCategoryNameVal(selectedCategory.name || '');
                                                    setEditingCategoryName(true);
                                                }}
                                                title="แก้ไขชื่อหมวดวิชา"
                                            >
                                                <Pencil size={14} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            ) : (
                                <span className="course-detail-toolbar__placeholder">เลือกหมวดวิชาเพื่อจัดการรายวิชา</span>
                            )}
                        </div>
                        {selectedCategory && (
                            <div className="course-detail-toolbar__right">
                                <div className="course-detail-toolbar__credits">
                                    <span className="course-detail-toolbar__credits-label">หน่วยกิต</span>
                                    <span className="course-detail-toolbar__credits-value">{getCategoryTotalCredits(selectedCategory)}</span>
                                </div>
                                <button className="course-detail-toolbar__delete-btn" onClick={() => onDelete(selectedCategory)}>
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Row 2: Add Course Button */}
                    <div className="course-detail-courses">
                        {selectedCategory && (
                            selectedCourseIds.size > 0 ? (
                                <button
                                    className="course-btn course-btn--danger course-btn--sm"
                                    onClick={() => setShowDeleteModal(true)}
                                >
                                    <Trash2 size={13} /> ลบ ({selectedCourseIds.size})
                                </button>
                            ) : (
                                <button
                                    className="course-btn course-btn--primary course-btn--sm"
                                    onClick={handleAddCourse}
                                    disabled={!isLeafCategory}
                                    title={!isLeafCategory ? 'เพิ่มได้เฉพาะหมวดที่อยู่ระดับลึกที่สุด' : ''}
                                >
                                    <Plus size={13} /> เพิ่มรายวิชา
                                </button>
                            )
                        )}
                    </div>

                    {selectedCategory ? (
                        <div className="course-two-panel__body">
                            <div className="course-spreadsheet-scroll">
                                <table className="course-spreadsheet-table">
                                    <thead>
                                        <tr>
                                            <th className="course-spreadsheet-th course-spreadsheet-th--checkbox">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedCourseIds.size === courses.length && courses.length > 0}
                                                    onChange={handleSelectAllCourses}
                                                    title="เลือกทั้งหมด"
                                                />
                                            </th>
                                            <th className="course-spreadsheet-th course-spreadsheet-th--grip"></th>
                                            <th className="course-spreadsheet-th">รหัสวิชา</th>
                                            <th className="course-spreadsheet-th course-spreadsheet-th--wide">ชื่อวิชา (ไทย)</th>
                                            <th className="course-spreadsheet-th course-spreadsheet-th--wide">ชื่อวิชา (Eng)</th>
                                            <th className="course-spreadsheet-th course-spreadsheet-th--num">หน่วยกิต</th>
                                            <th className="course-spreadsheet-th course-spreadsheet-th--actions"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {courses.map(course => (
                                            <SpreadsheetRow
                                                key={course.id}
                                                course={course}
                                                isSelected={selectedCourseIds.has(course.id)}
                                                isEditingCourse={editingCourseId === course.id}
                                                onToggleSelect={handleToggleCourseSelection}
                                                onUpdate={handleUpdateCourse}
                                                onDelete={handleDeleteCourse}
                                                onSetEditing={setEditingCourseId}
                                            />
                                        ))}
                                    </tbody>
                                </table>
                                {courses.length === 0 && (
                                    <div className="course-spreadsheet-empty">
                                        ยังไม่มีรายวิชา — กดปุ่ม "เพิ่มรายวิชา"
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="course-two-panel__empty">
                            <BookOpen size={24} style={{ opacity: 0.3 }} />
                            <div>เลือกหมวดวิชาเพื่อดูรายวิชา</div>
                        </div>
                    )}
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <AlertTriangle size={24} className="modal-icon--warning" />
                            <h3>ยืนยันการลบวิชา</h3>
                        </div>
                        <div className="modal-body">
                            <p>คุณแน่ใจหรือไม่ที่จะลบวิชาที่เลือก ({selectedCourseIds.size} วิชา)?</p>
                            <p className="modal-body__hint">การลบวิชาจะไม่สามารถกู้คืนได้</p>
                        </div>
                        <div className="modal-footer">
                            <button
                                className='course-form-nav__btn course-form-nav__btn--secondary'
                                onClick={() => setShowDeleteModal(false)}
                            >
                                ยกเลิก
                            </button>
                            <button
                                className='course-form-nav__btn course-form-nav__btn--danger'
                                onClick={handleDeleteSelectedCourses}
                            >
                                <Trash2 size={15} /> ยืนยันการลบ
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Category Confirmation Modal */}
            {showDeleteCategoryModal && categoryToDelete && (
                <div className="modal-overlay" onClick={() => setShowDeleteCategoryModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <AlertTriangle size={24} className="modal-icon--warning" />
                            <h3>ยืนยันการลบหมวดวิชา</h3>
                        </div>
                        <div className="modal-body">
                            <p>คุณแน่ใจหรือไม่ที่จะลบหมวดวิชา "{categoryToDelete.code} {categoryToDelete.name || 'ยังไม่ตั้งชื่อ'}"?</p>
                            <p className="modal-body__hint">วิชาทั้งหมดในหมวดนี้จะถูกลบด้วย</p>
                        </div>
                        <div className="modal-footer">
                            <button
                                className='course-form-nav__btn course-form-nav__btn--secondary'
                                onClick={() => setShowDeleteCategoryModal(false)}
                            >
                                ยกเลิก
                            </button>
                            <button
                                className='course-form-nav__btn course-form-nav__btn--danger'
                                onClick={confirmDeleteCategory}
                            >
                                <Trash2 size={15} /> ยืนยันการลบ
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function Step3({ form }) {
    const categories = form.categories || [];
    const coursesByCategory = form.coursesByCategory || {};

    const addCredits = (cat, sum = 0) => sum + (cat.requiredCredits || 0) + (cat.children || []).reduce((s, ch) => addCredits(ch, s), 0);
    const totalCredits = categories.reduce((sum, c) => sum + addCredits(c), 0);

    const totalCourses = Object.values(coursesByCategory).flat().length;
    const totalCategories = categories.length + categories.reduce((sum, c) => sum + (c.children || []).length, 0);
    const coreCourses = Object.values(coursesByCategory).flat().filter(c => c.isCoreCourse).length;
    const electiveCourses = totalCourses - coreCourses;

    const statStyle = {
        padding: '1.5rem',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        textAlign: 'center',
    };

    return (
        <div className="course-overview">
            {/* Stats */}
            <div className="course-overview-grid">
                <div className="course-overview-grid__stat">
                    <div className="course-overview-grid__value">{totalCourses}</div>
                    <div className="course-overview-grid__label">วิชาทั้งหมด</div>
                </div>
                <div className="course-overview-grid__stat">
                    <div className="course-overview-grid__value">{totalCategories}</div>
                    <div className="course-overview-grid__label">หมวดวิชา</div>
                </div>
                <div className="course-overview-grid__stat">
                    <div className="course-overview-grid__value">{totalCredits}</div>
                    <div className="course-overview-grid__label">หน่วยกิตรวม</div>
                </div>
                <div className="course-overview-grid__stat">
                    <div className="course-overview-grid__value">{coreCourses}</div>
                    <div className="course-overview-grid__label">วิชาบังคับ</div>
                </div>
            </div>

            {/* Course Info */}
            <div className="course-overview-info">
                <h4 className="course-overview-info__title">ข้อมูลหลักสูตร</h4>
                <div className="course-overview-info__grid">
                    <div><span className="course-overview-info__label">ชื่อหลักสูตร (ไทย):</span> <span className="course-overview-info__value">{form.nameTh || '-'}</span></div>
                    <div><span className="course-overview-info__label">ชื่อหลักสูตร (อังกฤษ):</span> <span className="course-overview-info__value">{form.nameEn || '-'}</span></div>
                    <div><span className="course-overview-info__label">ปีการศึกษา:</span> <span className="course-overview-info__value">{form.year ? `ปีการศึกษา ${form.year}` : '-'}</span></div>
                    <div><span className="course-overview-info__label">ชื่อปริญญา:</span> <span className="course-overview-info__value">{form.degreeName || '-'}</span></div>
                    <div><span className="course-overview-info__label">ชื่อปริญญาเต็ม (ไทย):</span> <span className="course-overview-info__value">{form.degreeFullNameTh || '-'}</span></div>
                    <div><span className="course-overview-info__label">ชื่อปริญญาเต็ม (อังกฤษ):</span> <span className="course-overview-info__value">{form.degreeFullNameEn || '-'}</span></div>
                </div>
            </div>

            {/* Structure */}
            <div className="course-overview-info">
                <h4 className="course-overview-info__title">โครงสร้างหลักสูตร</h4>
                <div className="course-overview-structure">
                    {categories.map(cat => {
                        const catCourses = coursesByCategory[cat.id] || [];
                        return (
                            <div key={cat.id} className="course-overview-structure__item">
                                <div>
                                    <span className="course-overview-structure__code">{cat.code}</span>
                                    <span className="course-overview-structure__name">{cat.name || <em>ยังไม่ตั้งชื่อ</em>}</span>
                                </div>
                                <div className="course-overview-structure__stats">
                                    <span>{catCourses.length} วิชา</span>
                                    <span>{cat.requiredCredits || 0} หน่วยกิต</span>
                                </div>
                            </div>
                        );
                    })}
                    {categories.length === 0 && (
                        <p className="course-overview-empty">ยังไม่มีโครงสร้างหลักสูตร</p>
                    )}
                </div>
            </div>
        </div>
    );
}

const EMPTY_FORM = {
    code: '',
    majorId: Number(process.env.NEXT_PUBLIC_DEFAULT_MAJOR_ID || '') || '',
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

export default function CreateCoursePage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [form, setForm] = useState(EMPTY_FORM);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const canNext = () => {
        if (step === 1) {
            return form.nameTh.trim() && form.nameEn.trim() && form.code.trim() && form.majorId && form.year && form.degreeName && form.degreeFullNameTh;
        }
        return true;
    };

    const handleSave = async () => {
        setError('');
        setSuccess('');
        setSubmitting(true);

        try {
            await createCurriculumFromForm(form);
            setSuccess('สร้างหลักสูตรสำเร็จ');
            setTimeout(() => {
                router.push('/curriculum-management?created=1');
            }, 600);
        } catch (err) {
            setError(err?.message || 'ไม่สามารถสร้างหลักสูตรได้');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className='course-create-page'>
            <div className={`course-create-container ${step === 2 ? 'course-create-container--wide' : ''}`}>
                <div className={`course-form-container ${step === 2 ? 'course-form-container--wide' : ''}`}>
                    {/* Header */}
                    <div className='course-create-header'>
                        <div className='course-create-header__center'>
                            <div className='course-create-header__title'>
                                สร้างหลักสูตรใหม่
                            </div>
                            <div className='course-create-header__subtitle'>
                                กรอกข้อมูลและจัดโครงสร้างหลักสูตรของคุณ
                            </div>
                        </div>
                    </div>

                    {/* Step Indicator */}
                    <StepIndicator step={step} />

                    {/* Form Steps */}
                    {step === 1 && <Step1 form={form} setForm={setForm} />}
                    {step === 2 && <Step2 form={form} setForm={setForm} selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} />}
                    {step === 3 && <Step3 form={form} />}

                </div>

                {(error || success) && (
                    <div className={`course-create-feedback ${error ? 'course-create-feedback--error' : 'course-create-feedback--success'}`}>
                        {error || success}
                    </div>
                )}

                {/* Navigation Buttons */}
                <div className='course-form-nav'>
                    <div className='course-form-nav__left'>
                        <button
                            className='course-form-nav__btn course-form-nav__btn--danger'
                            onClick={() => setShowCancelModal(true)}
                            disabled={submitting}
                        >
                            <X size={15} /> ยกเลิก
                        </button>
                    </div>
                    <div className='course-form-nav__right'>
                        {step > 1 && (
                            <button
                                className='course-form-nav__btn course-form-nav__btn--secondary'
                                onClick={() => setStep(s => s - 1)}
                                disabled={submitting}
                            >
                                <ArrowLeft size={15} /> ย้อนกลับ
                            </button>
                        )}
                        {step === 1 && (
                            <button
                                className='course-form-nav__btn course-form-nav__btn--primary'
                                onClick={() => setStep(2)}
                                disabled={!canNext() || submitting}
                            >
                                ถัดไป <ArrowRight size={15} />
                            </button>
                        )}
                        {step === 2 && (
                            <button
                                className='course-form-nav__btn course-form-nav__btn--primary'
                                onClick={() => setStep(3)}
                                disabled={submitting}
                            >
                                ถัดไป <ArrowRight size={15} />
                            </button>
                        )}
                        {step === 3 && (
                            <button
                                className='course-form-nav__btn course-form-nav__btn--primary'
                                onClick={handleSave}
                                disabled={submitting}
                            >
                                <Check size={15} /> {submitting ? 'กำลังบันทึก...' : 'บันทึกหลักสูตร'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Cancel Confirmation Modal */}
                {showCancelModal && (
                    <div className="modal-overlay" onClick={() => setShowCancelModal(false)}>
                        <div className="modal-content" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <AlertTriangle size={24} className="modal-icon--warning" />
                                <h3>ยืนยันการยกเลิก</h3>
                            </div>
                            <div className="modal-body">
                                <p>คุณแน่ใจหรือไม่ที่จะยกเลิกการสร้างหลักสูตร?</p>
                                <p className="modal-body__hint">ข้อมูลที่กรอกไว้ทั้งหมดจะหายไป</p>
                            </div>
                            <div className="modal-footer">
                                <button
                                    className='course-form-nav__btn course-form-nav__btn--secondary'
                                    onClick={() => setShowCancelModal(false)}
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    className='course-form-nav__btn course-form-nav__btn--danger'
                                    onClick={() => {
                                        setShowCancelModal(false);
                                        router.push('/curriculum-management');
                                    }}
                                >
                                    ยืนยัน
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
