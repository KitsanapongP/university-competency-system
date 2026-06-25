'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { X, Check, Plus, Trash2, ArrowLeft, ArrowRight, Layers, BookOpen, Award, Pencil, GripVertical, AlertTriangle } from 'lucide-react';
import { createCurriculumFromForm, fetchCurriculums, fetchFaculties, fetchMajors } from '../../../../lib/curriculum';
import { useLanguage } from '../../../../providers/LanguageContext';
import CurriculumStructureSidebar from '../components/CurriculumStructureSidebar';
import '../../../../app/Competency.css';
import '../CourseLayout.css';
import '../CourseCreate.css';
import '../CurriculumStructureSidebar.css';
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

const CURRICULUM_CREATE_DRAFT_KEY = 'curriculum-create-draft';

function selectedMajorName(form, majors, fallback, language = 'th') {
    const selectedMajor = majors.find(major => String(major.majorId) === String(form.majorId));
    if (language === 'en') {
        return selectedMajor?.nameEn || selectedMajor?.nameTh || fallback || 'selected major';
    }
    return selectedMajor?.nameTh || selectedMajor?.nameEn || fallback || 'สาขาที่เลือก';
}

function duplicateCurriculumNameText(year, majorName, language = 'th') {
    if (language === 'en') {
        return `This curriculum name already exists in academic year ${year} for ${majorName}. Please review the information again.`;
    }
    return `มีชื่อหลักสูตรนี้อยู่แล้ว ในปีการศึกษา${year} ของสาขา${majorName} กรุณาตรวจสอบข้อมูลอีกครั้ง`;
}

function formatCreateCurriculumError(err, form, majors, language = 'th') {
    const message = err?.message || (language === 'en' ? 'Unable to create curriculum.' : 'ไม่สามารถสร้างหลักสูตรได้');
    const majorName = selectedMajorName(form, majors, undefined, language);
    const year = form.year || (language === 'en' ? 'selected' : 'ที่เลือก');

    if (err?.code === 'DUPLICATE') {
        if (message.includes('curriculum code already exists')) {
            if (language === 'en') {
                return 'This curriculum code already exists in the selected major. Please review the information again.';
            }
            return 'รหัสหลักสูตรนี้มีอยู่แล้วในสาขาที่เลือก กรุณาตรวจสอบข้อมูลอีกครั้ง';
        }
        if (
            message.includes('curriculum name already exists')
            || message.includes('curriculum already exists')
        ) {
            return duplicateCurriculumNameText(year, majorName, language);
        }
    }

    return message;
}

function buildDuplicateCurriculumNameWarning(form, majors, curriculums, language = 'th') {
    const nameTh = String(form.nameTh || '').trim();
    const majorId = Number(form.majorId || 0);
    const year = Number(form.year || 0);

    if (!nameTh || !majorId || !year) {
        return '';
    }

    const duplicate = curriculums.find(curriculum => (
        Number(curriculum.majorId) === majorId
        && Number(curriculum.year) === year
        && String(curriculum.nameTh || '').trim() === nameTh
    ));

    if (!duplicate) {
        return '';
    }

    const selectedMajor = majors.find(major => Number(major.majorId) === majorId);
    const majorName = language === 'en'
        ? selectedMajor?.nameEn || selectedMajor?.nameTh || duplicate.degreeNameEn || duplicate.degreeName || 'selected major'
        : selectedMajor?.nameTh || selectedMajor?.nameEn || duplicate.degreeName || 'สาขาที่เลือก';
    return duplicateCurriculumNameText(year, majorName, language);
}

function Step1({ form, setForm, faculties, majors, lookupsLoading, lookupsError, onAddMajor, onClearValidation }) {
    const filteredMajors = form.facultyId
        ? majors.filter(major => String(major.facultyId) === String(form.facultyId))
        : [];
    const selectedMajor = majors.find(major => String(major.majorId) === String(form.majorId));
    const facultyLocked = faculties.length <= 1;
    const updateForm = (updater) => {
        onClearValidation?.();
        setForm(updater);
    };

    return (
        <div className="course-form-group">
            <div className="course-form-field">
                <label className="course-form-field__label">ชื่อหลักสูตร (ภาษาไทย)<span className="course-form-field__required">*</span></label>
                <input
                    className="course-form-field__input"
                    value={form.nameTh}
                    onChange={e => updateForm(p => ({ ...p, nameTh: e.target.value }))}
                    placeholder="เช่น หลักสูตรวิทยาการคอมพิวเตอร์"
                    autoFocus
                />
            </div>

            <div className="course-form-field">
                <label className="course-form-field__label">ชื่อหลักสูตร (ภาษาอังกฤษ)<span className="course-form-field__required">*</span></label>
                <input
                    className="course-form-field__input"
                    value={form.nameEn}
                    onChange={e => updateForm(p => ({ ...p, nameEn: e.target.value }))}
                    placeholder="เช่น Computer Science"
                />
            </div>

            <div className="course-form-row">
                <div className="course-form-field">
                    <label className="course-form-field__label">รหัสหลักสูตร<span className="course-form-field__required">*</span></label>
                    <input
                        className="course-form-field__input"
                        value={form.code}
                        onChange={e => updateForm(p => ({ ...p, code: e.target.value }))}
                        placeholder="เช่น cp_2568_curriculum"
                    />
                </div>
                <div className="course-form-field">
                    <label className="course-form-field__label">คณะ<span className="course-form-field__required">*</span></label>
                    <select
                        className="course-form-field__input"
                        value={form.facultyId || ''}
                        onChange={e => updateForm(p => ({
                            ...p,
                            facultyId: parseInt(e.target.value, 10) || '',
                            majorId: '',
                        }))}
                        disabled={lookupsLoading || facultyLocked}
                    >
                        <option value="">{lookupsLoading ? 'กำลังโหลดคณะ...' : 'เลือกคณะ'}</option>
                        {faculties.map(faculty => (
                            <option key={faculty.facultyId} value={faculty.facultyId}>
                                {faculty.nameTh}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="course-form-row">
                <div className="course-form-field">
                    <div className="course-form-field__label-row">
                        <label className="course-form-field__label">สาขา<span className="course-form-field__required">*</span></label>
                        <button type="button" className="course-form-field__link" onClick={onAddMajor}>
                            <Plus size={13} />
                            เพิ่มสาขาใหม่
                        </button>
                    </div>
                    <select
                        className="course-form-field__input"
                        value={form.majorId || ''}
                        onChange={e => updateForm(p => ({ ...p, majorId: parseInt(e.target.value, 10) || '' }))}
                        disabled={lookupsLoading || !form.facultyId}
                    >
                        <option value="">{lookupsLoading ? 'กำลังโหลดสาขา...' : 'เลือกสาขา'}</option>
                        {filteredMajors.map(major => (
                            <option key={major.majorId} value={major.majorId}>
                                {major.nameTh}
                            </option>
                        ))}
                    </select>
                    {lookupsError && (
                        <div className="course-form-field__error">{lookupsError}</div>
                    )}
                </div>
                <div className="course-form-field">
                    <label className="course-form-field__label">ปีการศึกษา<span className="course-form-field__required">*</span></label>
                    <input
                        type="number"
                        className="course-form-field__input"
                        value={form.year || ''}
                        onChange={e => updateForm(p => ({ ...p, year: parseInt(e.target.value) || null }))}
                        placeholder="เช่น 2568"
                        min={2500}
                        max={2600}
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

function SpreadsheetRow({
    course,
    isSelected,
    isEditingCourse,
    isDragging,
    onToggleSelect,
    onValidate,
    onUpdate,
    onDelete,
    onSetEditing,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
}) {
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
        const nextCourse = { ...course, ...form, credits: Number(form.credits) || 0 };
        if (onValidate && !onValidate(nextCourse)) return;
        onUpdate(nextCourse);
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
        <tr
            className={`ss-row ${editing ? 'ss-row--editing' : ''} ${isSelected ? 'ss-row--selected' : ''} ${isDragging ? 'ss-row--dragging' : ''}`}
            draggable={!editing}
            onDragStart={e => onDragStart?.(e, course)}
            onDragOver={e => onDragOver?.(e, course)}
            onDrop={e => onDrop?.(e, course)}
            onDragEnd={onDragEnd}
        >
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
                ) : (
                    <button className="course-row__btn course-row__btn--delete" onClick={() => onDelete(course)} title="ลบรายวิชา">
                        <Trash2 size={12} />
                    </button>
                )}
            </td>
        </tr>
    );
}

function Step2({ form, setForm, selectedCategory, setSelectedCategory, onClearValidation, language = 'th' }) {
    const categories = form.categories || [];
    const coursesByCategory = form.coursesByCategory || {};
    const [selectedCourseIds, setSelectedCourseIds] = useState(new Set());
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [editingCourseId, setEditingCourseId] = useState(null);
    const [showDeleteCategoryModal, setShowDeleteCategoryModal] = useState(false);
    const [categoryToDelete, setCategoryToDelete] = useState(null);
    const [editingCategoryName, setEditingCategoryName] = useState(false);
    const [categoryNameVal, setCategoryNameVal] = useState('');
    const [draggedCategoryId, setDraggedCategoryId] = useState(null);
    const [draggedCourseId, setDraggedCourseId] = useState(null);
    const [dropTargetCategoryId, setDropTargetCategoryId] = useState(null);
    const [courseDuplicateWarning, setCourseDuplicateWarning] = useState(null);

    const MAX_CATEGORY_DEPTH = 3;

    const stripCourseMeta = (course) => {
        const { ownerCategoryId, ...cleanCourse } = course;
        return cleanCourse;
    };

    const collectCategoryIds = (cat) => [cat.id, ...(cat.children || []).flatMap(collectCategoryIds)];

    const flattenCategories = (cats) => cats.flatMap(cat => [cat, ...flattenCategories(cat.children || [])]);

    const countCategories = (cats) => cats.reduce((sum, cat) => sum + 1 + countCategories(cat.children || []), 0);

    const normalizeName = (value) => String(value || '').trim();
    const normalizeInsensitive = (value) => normalizeName(value).toLowerCase();

    const duplicateFieldLabels = language === 'en'
        ? {
            code: 'Course code',
            nameTh: 'Thai course name',
            nameEn: 'English course name',
        }
        : {
            code: 'รหัสวิชา',
            nameTh: 'ชื่อวิชาภาษาไทย',
            nameEn: 'ชื่อวิชาภาษาอังกฤษ',
        };

    const getUniqueCategoryName = (baseName, excludeCategoryId = null, cats = categories) => {
        const normalizedBase = normalizeName(baseName) || 'หมวดใหม่';
        const existingNames = new Set(
            flattenCategories(cats)
                .filter(cat => cat.id !== excludeCategoryId)
                .map(cat => normalizeName(cat.name))
                .filter(Boolean)
        );

        if (!existingNames.has(normalizedBase)) {
            return normalizedBase;
        }

        let index = 1;
        let candidate = `${normalizedBase} (${index})`;
        while (existingNames.has(candidate)) {
            index += 1;
            candidate = `${normalizedBase} (${index})`;
        }
        return candidate;
    };

    const findCategoryInfo = (cats, id, parent = null, siblings = cats, depth = 0) => {
        for (let index = 0; index < cats.length; index += 1) {
            const cat = cats[index];
            if (cat.id === id) {
                return { category: cat, parent, siblings, index, depth };
            }
            const childInfo = findCategoryInfo(cat.children || [], id, cat, cat.children || [], depth + 1);
            if (childInfo) return childInfo;
        }
        return null;
    };

    const renumberCategoryCodes = (cats, parentCode = '') => cats.map((cat, index) => {
        const code = parentCode ? `${parentCode}.${index + 1}` : `${index + 1}`;
        return {
            ...cat,
            code,
            children: renumberCategoryCodes(cat.children || [], code),
        };
    });

    const removeCategoryFromTree = (cats, id) => {
        let removed = null;
        const nextCategories = cats.flatMap(cat => {
            if (cat.id === id) {
                removed = cat;
                return [];
            }
            const result = removeCategoryFromTree(cat.children || [], id);
            if (result.removed) removed = result.removed;
            return [{ ...cat, children: result.categories }];
        });
        return { categories: nextCategories, removed };
    };

    const insertCategoryUnder = (cats, targetId, movedCategory) => cats.map(cat => {
        if (cat.id === targetId) {
            return { ...cat, children: [...(cat.children || []), movedCategory] };
        }
        return { ...cat, children: insertCategoryUnder(cat.children || [], targetId, movedCategory) };
    });

    const categoryContains = (cat, targetId) => (cat.children || []).some(child => (
        child.id === targetId || categoryContains(child, targetId)
    ));

    const getCategorySubtreeDepth = (cat) => {
        if (!cat.children?.length) return 0;
        return Math.max(...cat.children.map(child => 1 + getCategorySubtreeDepth(child)));
    };

    const getDeleteCategoryPreview = (cat) => {
        const info = findCategoryInfo(categories, cat.id);
        if (!info) return null;

        const previousSibling = info.siblings[info.index - 1] || null;
        const nextSibling = info.siblings[info.index + 1] || null;
        const moveTarget = previousSibling || nextSibling || info.parent || null;
        const categoryIds = collectCategoryIds(cat);
        const affectedCategories = flattenCategories(cat.children || []);
        const affectedCourses = categoryIds.flatMap(categoryId => (
            (coursesByCategory[categoryId] || []).map(course => ({ ...course, ownerCategoryId: categoryId }))
        ));

        return {
            moveTarget,
            affectedCategories,
            affectedCourses,
        };
    };

    const findCourseOwnerId = (courseId, courseMap = coursesByCategory) => {
        const entry = Object.entries(courseMap).find(([, list]) => (
            (list || []).some(course => course.id === courseId)
        ));
        return entry?.[0] || null;
    };

    const getAllCurrentCourses = (courseMap = coursesByCategory) => (
        Object.entries(courseMap).flatMap(([categoryId, list]) => (
            (list || []).map(course => ({ ...course, ownerCategoryId: categoryId }))
        ))
    );

    const getDuplicateCourseIssues = (nextCourse) => {
        const otherCourses = getAllCurrentCourses().filter(course => course.id !== nextCourse.id);
        const issues = [];
        const nextCode = normalizeInsensitive(nextCourse.code);
        const nextNameTh = normalizeName(nextCourse.nameTh);
        const nextNameEn = normalizeInsensitive(nextCourse.nameEn);

        if (nextCode && otherCourses.some(course => normalizeInsensitive(course.code) === nextCode)) {
            issues.push(duplicateFieldLabels.code);
        }
        if (nextNameTh && otherCourses.some(course => normalizeName(course.nameTh) === nextNameTh)) {
            issues.push(duplicateFieldLabels.nameTh);
        }
        if (nextNameEn && otherCourses.some(course => normalizeInsensitive(course.nameEn) === nextNameEn)) {
            issues.push(duplicateFieldLabels.nameEn);
        }

        return issues;
    };

    const validateCourseBeforeSave = (nextCourse) => {
        const duplicateIssues = getDuplicateCourseIssues(nextCourse);
        if (duplicateIssues.length > 0) {
            setCourseDuplicateWarning({
                issues: duplicateIssues,
                course: nextCourse,
            });
            return false;
        }
        setCourseDuplicateWarning(null);
        return true;
    };

    const moveCourseInMap = (courseMap, courseId, targetCategoryId, beforeCourseId = null) => {
        const sourceCategoryId = findCourseOwnerId(courseId, courseMap);
        if (!sourceCategoryId || !targetCategoryId) return courseMap;

        const sourceList = courseMap[sourceCategoryId] || [];
        const movingCourse = sourceList.find(course => course.id === courseId);
        if (!movingCourse) return courseMap;

        const nextMap = {
            ...courseMap,
            [sourceCategoryId]: sourceList.filter(course => course.id !== courseId),
        };

        const targetList = sourceCategoryId === targetCategoryId
            ? nextMap[targetCategoryId] || []
            : courseMap[targetCategoryId] || [];
        const cleanMovingCourse = stripCourseMeta(movingCourse);
        const insertIndex = beforeCourseId
            ? targetList.findIndex(course => course.id === beforeCourseId)
            : -1;

        const nextTargetList = [...targetList];
        if (insertIndex >= 0) {
            nextTargetList.splice(insertIndex, 0, cleanMovingCourse);
        } else {
            nextTargetList.push(cleanMovingCourse);
        }

        nextMap[targetCategoryId] = nextTargetList;
        return nextMap;
    };

    const getDepth = (cat, depth = 0) => {
        if (!cat.children?.length) return depth;
        return Math.max(...cat.children.map(c => getDepth(c, depth + 1)));
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

    const getAllCoursesInCategory = (cat) => {
        const courses = (coursesByCategory[cat.id] || []).map(course => ({
            ...course,
            ownerCategoryId: cat.id,
        }));
        const childCourses = (cat.children || []).flatMap(c => getAllCoursesInCategory(c));
        return [...courses, ...childCourses];
    };

    const courses = selectedCategory ? getAllCoursesInCategory(selectedCategory) : [];

    const isLeafCategory = selectedCategory && !(selectedCategory.children?.length > 0);

    const getNextCode = (siblings) => {
        const maxSiblingNumber = siblings.reduce((max, sibling) => {
            const parts = String(sibling.code || '').split('.');
            const current = Number(parts[parts.length - 1]) || 0;
            return Math.max(max, current);
        }, 0);
        return `${maxSiblingNumber + 1}`;
    };
    const getNextChildCode = (parentCode, siblings) => `${parentCode}.${getNextCode(siblings)}`;

    const handleAddCategory = () => {
        onClearValidation?.();
        if (selectedCategory) {
            handleAddChildCategory(selectedCategory);
            return;
        }

        const code = getNextCode(categories);
        const newCat = {
            id: `cat_${Date.now()}`,
            code,
            name: getUniqueCategoryName('หมวดใหม่'),
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
        onClearValidation?.();
        const parentCategoryDepth = getCategoryDepth(parent, categories);

        if (parentCategoryDepth >= MAX_CATEGORY_DEPTH) {
            alert('ไม่สามารถสร้างหมวดวิชาลูกได้เกิน 4 ระดับ');
            return;
        }

        const siblings = parent.children || [];
        const code = getNextChildCode(parent.code, siblings);
        const newCat = {
            id: `cat_${Date.now()}`,
            code,
            name: getUniqueCategoryName('หมวดใหม่'),
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
        onClearValidation?.();
        const uniqueName = getUniqueCategoryName(name, id);
        const update = (cats) => cats.map(c => {
            if (c.id === id) return { ...c, name: uniqueName, isNew: false };
            if (c.children?.length) return { ...c, children: update(c.children) };
            return c;
        });
        setForm(p => ({ ...p, categories: update(p.categories) }));
        setSelectedCategory(p => p?.id === id ? { ...p, name: uniqueName } : p);
    };

    const handleDeleteCategory = (cat) => {
        setCategoryToDelete(cat);
        setShowDeleteCategoryModal(true);
    };

    const confirmDeleteCategory = () => {
        if (!categoryToDelete) return;
        onClearValidation?.();

        const cat = categoryToDelete;
        const preview = getDeleteCategoryPreview(cat);
        const categoryIds = collectCategoryIds(cat);
        const result = removeCategoryFromTree(categories, cat.id);
        const newCourses = Object.fromEntries(
            Object.entries(coursesByCategory).filter(([categoryId]) => !categoryIds.includes(categoryId))
        );

        if (preview?.moveTarget) {
            newCourses[preview.moveTarget.id] = [
                ...(newCourses[preview.moveTarget.id] || []),
                ...preview.affectedCourses.map(stripCourseMeta),
            ];
        }

        const nextCategories = renumberCategoryCodes(result.categories);
        const nextSelectedCategory = preview?.moveTarget
            ? findCategoryInfo(nextCategories, preview.moveTarget.id)?.category || preview.moveTarget
            : null;

        setForm(p => ({ ...p, categories: nextCategories, coursesByCategory: newCourses }));

        if (selectedCategory) {
            if (categoryIds.includes(selectedCategory.id)) {
                setSelectedCategory(nextSelectedCategory);
            } else {
                setSelectedCategory(findCategoryInfo(nextCategories, selectedCategory.id)?.category || selectedCategory);
            }
        }

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
        onClearValidation?.();
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
        const ownerCategoryId = updatedCourse.ownerCategoryId || findCourseOwnerId(updatedCourse.id);
        if (!ownerCategoryId) return;
        onClearValidation?.();

        setForm(p => ({
            ...p,
            coursesByCategory: {
                ...p.coursesByCategory,
                [ownerCategoryId]: (p.coursesByCategory[ownerCategoryId] || []).map(course =>
                    course.id === updatedCourse.id ? stripCourseMeta(updatedCourse) : course
                ),
            },
        }));
    };

    const handleDeleteCourse = (course) => {
        const ownerCategoryId = course.ownerCategoryId || findCourseOwnerId(course.id);
        if (!ownerCategoryId) return;
        onClearValidation?.();

        setForm(p => ({
            ...p,
            coursesByCategory: {
                ...p.coursesByCategory,
                [ownerCategoryId]: (p.coursesByCategory[ownerCategoryId] || []).filter(c => c.id !== course.id),
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
        const selectedIds = selectedCourseIds;
        setForm(p => ({
            ...p,
            coursesByCategory: Object.fromEntries(
                Object.entries(p.coursesByCategory).map(([categoryId, list]) => [
                    categoryId,
                    (list || []).filter(course => !selectedIds.has(course.id)),
                ])
            ),
        }));
        setSelectedCourseIds(new Set());
        setShowDeleteModal(false);
    };

    const handleCategoryDragStart = (event, cat) => {
        event.stopPropagation();
        setDraggedCategoryId(cat.id);
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', cat.id);
    };

    const handleCategoryDragOver = (event, targetCat) => {
        const draggedInfo = draggedCategoryId ? findCategoryInfo(categories, draggedCategoryId) : null;
        const draggedCat = draggedInfo?.category;
        if (!draggedCat) return;

        if (draggedCat.id === targetCat.id || categoryContains(draggedCat, targetCat.id)) {
            event.stopPropagation();
            setDropTargetCategoryId(current => current === targetCat.id ? null : current);
            return;
        }

        const targetInfo = findCategoryInfo(categories, targetCat.id);
        const nextDepth = (targetInfo?.depth ?? 0) + 1 + getCategorySubtreeDepth(draggedCat);
        if (nextDepth > MAX_CATEGORY_DEPTH) {
            event.stopPropagation();
            setDropTargetCategoryId(current => current === targetCat.id ? null : current);
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'move';
        setDropTargetCategoryId(targetCat.id);
    };

    const handleCategoryDrop = (event, targetCat) => {
        event.preventDefault();
        event.stopPropagation();
        if (!draggedCategoryId || draggedCategoryId === targetCat.id) return;

        const draggedInfo = findCategoryInfo(categories, draggedCategoryId);
        const draggedCat = draggedInfo?.category;
        if (!draggedCat || categoryContains(draggedCat, targetCat.id)) return;

        const targetInfo = findCategoryInfo(categories, targetCat.id);
        const nextDepth = (targetInfo?.depth ?? 0) + 1 + getCategorySubtreeDepth(draggedCat);
        if (nextDepth > MAX_CATEGORY_DEPTH) return;

        const result = removeCategoryFromTree(categories, draggedCategoryId);
        if (!result.removed) return;

        const nextCategories = renumberCategoryCodes(insertCategoryUnder(result.categories, targetCat.id, result.removed));
        const nextSelectedCategory = findCategoryInfo(nextCategories, result.removed.id)?.category || result.removed;
        setForm(p => ({ ...p, categories: nextCategories }));
        setSelectedCategory(nextSelectedCategory);
        setDraggedCategoryId(null);
        setDropTargetCategoryId(null);
    };

    const handleCategoryRootDragOver = (event) => {
        const draggedInfo = draggedCategoryId ? findCategoryInfo(categories, draggedCategoryId) : null;
        if (!draggedInfo?.category) return;
        if (getCategorySubtreeDepth(draggedInfo.category) > MAX_CATEGORY_DEPTH) return;

        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setDropTargetCategoryId('root');
    };

    const handleCategoryRootDrop = (event) => {
        event.preventDefault();
        if (!draggedCategoryId) return;

        const result = removeCategoryFromTree(categories, draggedCategoryId);
        if (!result.removed) return;

        const nextCategories = renumberCategoryCodes([...result.categories, result.removed]);
        const nextSelectedCategory = findCategoryInfo(nextCategories, result.removed.id)?.category || result.removed;
        setForm(p => ({ ...p, categories: nextCategories }));
        setSelectedCategory(nextSelectedCategory);
        setDraggedCategoryId(null);
        setDropTargetCategoryId(null);
    };

    const handleCategoryDragEnd = () => {
        setDraggedCategoryId(null);
        setDropTargetCategoryId(null);
    };

    const handleCategoryDragLeave = (event, cat) => {
        const nextTarget = event.relatedTarget;
        if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
        setDropTargetCategoryId(current => current === cat.id ? null : current);
    };

    const handleCourseDragStart = (event, course) => {
        event.stopPropagation();
        setDraggedCourseId(course.id);
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', course.id);
    };

    const handleCourseDragOver = (event, targetCourse) => {
        if (!draggedCourseId || draggedCourseId === targetCourse.id) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'move';
    };

    const handleCourseDrop = (event, targetCourse) => {
        event.preventDefault();
        event.stopPropagation();
        if (!draggedCourseId || draggedCourseId === targetCourse.id) {
            setDraggedCourseId(null);
            return;
        }

        const targetCategoryId = targetCourse.ownerCategoryId || findCourseOwnerId(targetCourse.id);
        setForm(p => ({
            ...p,
            coursesByCategory: moveCourseInMap(p.coursesByCategory || {}, draggedCourseId, targetCategoryId, targetCourse.id),
        }));
        setDraggedCourseId(null);
        setDropTargetCategoryId(null);
    };

    const handleCourseDropToSelectedCategory = (event) => {
        if (!draggedCourseId || !selectedCategory || !isLeafCategory) return;
        event.preventDefault();
        setForm(p => ({
            ...p,
            coursesByCategory: moveCourseInMap(p.coursesByCategory || {}, draggedCourseId, selectedCategory.id),
        }));
        setDraggedCourseId(null);
        setDropTargetCategoryId(null);
    };

    const handleCourseDragEnd = () => {
        setDraggedCourseId(null);
        setDropTargetCategoryId(null);
    };

    const handleCourseCategoryDragOver = (event, targetCat) => {
        if (!draggedCourseId) return;
        if (targetCat.children?.length) {
            event.stopPropagation();
            setDropTargetCategoryId(current => current === targetCat.id ? null : current);
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'move';
        setDropTargetCategoryId(targetCat.id);
    };

    const handleCourseCategoryDrop = (event, targetCat) => {
        if (!draggedCourseId || targetCat.children?.length) return;
        event.preventDefault();
        event.stopPropagation();

        setForm(p => ({
            ...p,
            coursesByCategory: moveCourseInMap(p.coursesByCategory || {}, draggedCourseId, targetCat.id),
        }));
        setSelectedCategory(targetCat);
        setDraggedCourseId(null);
        setDropTargetCategoryId(null);
    };

    const addCredits = (cat, visited = new Set()) => {
        if (visited.has(cat.id)) return 0;
        visited.add(cat.id);
        const ownCourseCredits = (coursesByCategory[cat.id] || []).reduce((sum, course) => (
            sum + (Number(course.credits) || 0)
        ), 0);
        return ownCourseCredits + (cat.children || []).reduce((sum, child) => sum + addCredits(child, visited), 0);
    };

    const getCategoryTotalCredits = (cat) => {
        return addCredits(cat);
    };

    const totalCredits = categories.reduce((sum, c) => sum + getCategoryTotalCredits(c), 0);
    const totalCourses = Object.values(coursesByCategory).flat().length;
    const totalCategories = countCategories(categories);
    const deleteCategoryPreview = categoryToDelete ? getDeleteCategoryPreview(categoryToDelete) : null;

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
                    <CurriculumStructureSidebar
                        categories={categories}
                        coursesByCategory={coursesByCategory}
                        selectedCategoryId={selectedCategory?.id}
                        title="โครงสร้างหมวดวิชา"
                        addLabel="หมวดวิชา"
                        emptyText={'กด "+ หมวดวิชา" เพื่อเริ่ม'}
                        maxDepth={MAX_CATEGORY_DEPTH}
                        addDisabled={selectedCategory ? getCategoryDepth(selectedCategory, categories) >= MAX_CATEGORY_DEPTH : false}
                        draggingCategoryId={draggedCategoryId}
                        draggedCourseId={draggedCourseId}
                        dropTargetCategoryId={dropTargetCategoryId}
                        onSelectCategory={setSelectedCategory}
                        onAddCategory={handleAddCategory}
                        onAddChildCategory={handleAddChildCategory}
                        onRenameCategory={handleRenameCategory}
                        onDeleteCategory={handleDeleteCategory}
                        onCategoryRootDragOver={handleCategoryRootDragOver}
                        onCategoryRootDrop={handleCategoryRootDrop}
                        onCategoryDragStart={handleCategoryDragStart}
                        onCategoryDragOver={handleCategoryDragOver}
                        onCategoryDrop={handleCategoryDrop}
                        onCategoryDragEnd={handleCategoryDragEnd}
                        onCategoryDragLeave={handleCategoryDragLeave}
                        onCourseCategoryDragOver={handleCourseCategoryDragOver}
                        onCourseCategoryDrop={handleCourseCategoryDrop}
                        onCourseDragStart={handleCourseDragStart}
                        onCourseDragEnd={handleCourseDragEnd}
                    />
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
                                <button className="course-detail-toolbar__delete-btn" onClick={() => handleDeleteCategory(selectedCategory)}>
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
                                    <tbody
                                        onDragOver={handleCourseDropToSelectedCategory}
                                        onDrop={handleCourseDropToSelectedCategory}
                                    >
                                        {courses.map(course => (
                                            <SpreadsheetRow
                                                key={course.id}
                                                course={course}
                                                isSelected={selectedCourseIds.has(course.id)}
                                                isEditingCourse={editingCourseId === course.id}
                                                isDragging={draggedCourseId === course.id}
                                                onToggleSelect={handleToggleCourseSelection}
                                                onValidate={validateCourseBeforeSave}
                                                onUpdate={handleUpdateCourse}
                                                onDelete={handleDeleteCourse}
                                                onSetEditing={setEditingCourseId}
                                                onDragStart={handleCourseDragStart}
                                                onDragOver={handleCourseDragOver}
                                                onDrop={handleCourseDrop}
                                                onDragEnd={handleCourseDragEnd}
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

            {courseDuplicateWarning && (
                <div className="modal-overlay" onClick={() => setCourseDuplicateWarning(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <AlertTriangle size={24} className="modal-icon--warning" />
                            <h3>{language === 'en' ? 'Duplicate Course Information' : 'ข้อมูลรายวิชาซ้ำ'}</h3>
                        </div>
                        <div className="modal-body">
                            <p>
                                {language === 'en'
                                    ? 'This course has duplicate information. Please edit the duplicated fields before saving.'
                                    : 'รายวิชานี้มีข้อมูลซ้ำ กรุณาแก้ไขข้อมูลที่ซ้ำก่อนบันทึก'}
                            </p>
                            <div className="modal-body__hint">
                                {language === 'en' ? 'Duplicated fields: ' : 'ข้อมูลที่ซ้ำ: '}
                                {courseDuplicateWarning.issues.join(', ')}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button
                                className='course-form-nav__btn course-form-nav__btn--primary'
                                onClick={() => setCourseDuplicateWarning(null)}
                            >
                                {language === 'en' ? 'OK' : 'รับทราบ'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                            {deleteCategoryPreview && (
                                <div className="modal-body__impact">
                                    <div>หมวดย่อยที่ได้รับผลกระทบ: {deleteCategoryPreview.affectedCategories.length} หมวด</div>
                                    <div>รายวิชาที่ได้รับผลกระทบ: {deleteCategoryPreview.affectedCourses.length} วิชา</div>
                                    {deleteCategoryPreview.moveTarget ? (
                                        <div>รายวิชาจะถูกย้ายไปที่ "{deleteCategoryPreview.moveTarget.code} {deleteCategoryPreview.moveTarget.name || 'ยังไม่ตั้งชื่อ'}"</div>
                                    ) : (
                                        <div>ไม่มีหมวดปลายทาง รายวิชาจะถูกถอดออกจากโครงสร้างปัจจุบัน</div>
                                    )}
                                </div>
                            )}
                            <p className="modal-body__hint">หมวดนี้และหมวดย่อยทั้งหมดจะถูกลบ ส่วนรายวิชาจะถูกย้ายไปยังหมวดที่ใกล้ที่สุดโดยอัตโนมัติ หากไม่มีหมวดรองรับ รายวิชาจะไม่แสดงในโครงสร้างหลักสูตรนี้</p>
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

    const countCategories = (cats) => cats.reduce((sum, cat) => sum + 1 + countCategories(cat.children || []), 0);
    const getAllCoursesInCategory = (cat) => [
        ...(coursesByCategory[cat.id] || []),
        ...(cat.children || []).flatMap(child => getAllCoursesInCategory(child)),
    ];
    const getCategoryTotalCredits = (cat) => getAllCoursesInCategory(cat).reduce((sum, course) => (
        sum + (Number(course.credits) || 0)
    ), 0);
    const totalCredits = categories.reduce((sum, c) => sum + getCategoryTotalCredits(c), 0);

    const totalCourses = Object.values(coursesByCategory).flat().length;
    const totalCategories = countCategories(categories);
    const coreCourses = Object.values(coursesByCategory).flat().filter(c => c.isCoreCourse).length;

    const renderCategoryOverview = (cat, depth = 0) => {
        const directCourses = coursesByCategory[cat.id] || [];
        const categoryCourses = getAllCoursesInCategory(cat);
        return (
            <div key={cat.id} className="course-overview-tree-node">
                <div
                    className="course-overview-tree-category"
                    style={{ paddingLeft: `${0.75 + depth * 1.25}rem` }}
                >
                    <div className="course-overview-tree-category__main">
                        <span className="course-overview-tree-category__code">{cat.code}</span>
                        <span className="course-overview-tree-category__name">{cat.name || <em>ยังไม่ตั้งชื่อ</em>}</span>
                    </div>
                    <div className="course-overview-tree-category__stats">
                        <span>{categoryCourses.length} วิชา</span>
                        <span>{getCategoryTotalCredits(cat)} หน่วยกิต</span>
                    </div>
                </div>

                {directCourses.length > 0 && (
                    <div
                        className="course-overview-tree-courses"
                        style={{ paddingLeft: `${2.25 + depth * 1.25}rem` }}
                    >
                        {directCourses.map(course => (
                            <div key={course.id} className="course-overview-tree-course">
                                <span className="course-overview-tree-course__code">{course.code || '-'}</span>
                                <span className="course-overview-tree-course__name">{course.nameTh || course.nameEn || 'ยังไม่มีชื่อวิชา'}</span>
                                <span className="course-overview-tree-course__credits">{Number(course.credits) || 0} หน่วยกิต</span>
                            </div>
                        ))}
                    </div>
                )}

                {(cat.children || []).map(child => renderCategoryOverview(child, depth + 1))}
            </div>
        );
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
                </div>
            </div>

            {/* Structure */}
            <div className="course-overview-info">
                <h4 className="course-overview-info__title">โครงสร้างหลักสูตร</h4>
                <div className="course-overview-structure">
                    {categories.map(cat => renderCategoryOverview(cat))}
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
    facultyId: '',
    majorId: '',
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

function CreateCoursePageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { language } = useLanguage();
    const createdMajorId = Number(searchParams.get('created_major_id') || 0);
    const [step, setStep] = useState(1);
    const [form, setForm] = useState(EMPTY_FORM);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [faculties, setFaculties] = useState([]);
    const [majors, setMajors] = useState([]);
    const [curriculums, setCurriculums] = useState([]);
    const [lookupsLoading, setLookupsLoading] = useState(true);
    const [lookupsError, setLookupsError] = useState('');
    const duplicateNameWarning = buildDuplicateCurriculumNameWarning(form, majors, curriculums, language);

    useEffect(() => {
        const rawDraft = sessionStorage.getItem(CURRICULUM_CREATE_DRAFT_KEY);
        if (!rawDraft) return;

        try {
            const draft = JSON.parse(rawDraft);
            setForm(prev => ({
                ...prev,
                ...draft,
            }));
        } catch {
            sessionStorage.removeItem(CURRICULUM_CREATE_DRAFT_KEY);
        }
    }, []);

    useEffect(() => {
        let mounted = true;

        async function loadLookups() {
            setLookupsLoading(true);
            setLookupsError('');

            try {
                const [nextFaculties, nextMajors, nextCurriculums] = await Promise.all([
                    fetchFaculties(),
                    fetchMajors(),
                    fetchCurriculums(),
                ]);
                if (!mounted) return;

                setFaculties(nextFaculties);
                setMajors(nextMajors);
                setCurriculums(nextCurriculums);
                if (nextFaculties.length === 0) {
                    setLookupsError('ไม่พบคณะที่คุณมีสิทธิ์เลือก');
                }

                const createdMajor = createdMajorId
                    ? nextMajors.find(major => Number(major.majorId) === createdMajorId)
                    : null;
                if (createdMajor) {
                    setForm(prev => ({
                        ...prev,
                        facultyId: createdMajor.facultyId,
                        majorId: createdMajor.majorId,
                    }));
                    sessionStorage.removeItem(CURRICULUM_CREATE_DRAFT_KEY);
                    return;
                }

                if (nextFaculties.length === 1) {
                    const facultyId = nextFaculties[0].facultyId;
                    const scopedMajors = nextMajors.filter(major => major.facultyId === facultyId);
                    setForm(prev => {
                        if (prev.facultyId) return prev;
                        return {
                            ...prev,
                            facultyId,
                            majorId: scopedMajors.length === 1 ? scopedMajors[0].majorId : '',
                        };
                    });
                }
            } catch (err) {
                if (!mounted) return;
                setLookupsError(err?.message || 'ไม่สามารถโหลดรายการคณะและสาขาได้');
            } finally {
                if (mounted) setLookupsLoading(false);
            }
        }

        loadLookups();

        return () => {
            mounted = false;
        };
    }, [createdMajorId]);

    const canNext = () => {
        if (step === 1) {
            return (
                !lookupsLoading
                && form.nameTh.trim()
                && form.nameEn.trim()
                && form.code.trim()
                && form.facultyId
                && form.majorId
                && form.year
            );
        }
        return true;
    };

    const countAllCategories = (categories = []) => (
        categories.reduce((sum, category) => sum + 1 + countAllCategories(category.children || []), 0)
    );

    const countAllCourses = (coursesByCategory = {}) => (
        Object.values(coursesByCategory).reduce((sum, list) => sum + (list || []).length, 0)
    );

    const canProceedFromStep2 = () => (
        countAllCategories(form.categories || []) > 0
        && countAllCourses(form.coursesByCategory || {}) > 0
    );

    const handleStep1Next = () => {
        setSuccess('');
        if (!canNext()) return;
        if (duplicateNameWarning) {
            setError(duplicateNameWarning);
            return;
        }
        setError('');
        setStep(2);
    };

    const handleStep2Next = () => {
        setSuccess('');
        if (!canProceedFromStep2()) return;
        setError('');
        setStep(3);
    };

    const handleSave = async () => {
        setError('');
        setSuccess('');
        setSubmitting(true);

        try {
            await createCurriculumFromForm(form);
            sessionStorage.removeItem(CURRICULUM_CREATE_DRAFT_KEY);
            setSuccess('สร้างหลักสูตรสำเร็จ');
            setTimeout(() => {
                router.push('/curriculum-management?created=1');
            }, 600);
        } catch (err) {
            setError(formatCreateCurriculumError(err, form, majors, language));
        } finally {
            setSubmitting(false);
        }
    };

    const handleAddMajor = () => {
        sessionStorage.setItem(CURRICULUM_CREATE_DRAFT_KEY, JSON.stringify(form));
        const params = new URLSearchParams({
            return_to: '/curriculum-management/create',
        });
        if (form.facultyId) {
            params.set('faculty_id', String(form.facultyId));
        }
        router.push(`/major-management?${params.toString()}`);
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
                    {step === 1 && (
                        <Step1
                            form={form}
                            setForm={setForm}
                            faculties={faculties}
                            majors={majors}
                            lookupsLoading={lookupsLoading}
                            lookupsError={lookupsError}
                            onAddMajor={handleAddMajor}
                            onClearValidation={() => setError('')}
                        />
                    )}
                    {step === 2 && (
                        <Step2
                            form={form}
                            setForm={setForm}
                            selectedCategory={selectedCategory}
                            setSelectedCategory={setSelectedCategory}
                            onClearValidation={() => setError('')}
                            language={language}
                        />
                    )}
                    {step === 3 && <Step3 form={form} />}

                </div>

                {step !== 2 && (error || success) && (
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
                                onClick={handleStep1Next}
                                disabled={!canNext() || submitting}
                            >
                                ถัดไป <ArrowRight size={15} />
                            </button>
                        )}
                        {step === 2 && (
                            <button
                                className='course-form-nav__btn course-form-nav__btn--primary'
                                onClick={handleStep2Next}
                                disabled={!canProceedFromStep2() || submitting}
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

export default function CreateCoursePage() {
    return (
        <Suspense fallback={<div className="course-create-page">กำลังโหลด...</div>}>
            <CreateCoursePageContent />
        </Suspense>
    );
}
