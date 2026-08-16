'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { X, Check, CheckCircle2, Circle, Info, Plus, Trash2, ArrowLeft, ArrowRight, Layers, BookOpen, Award, Upload } from 'lucide-react';
import { createCurriculumFromForm, fetchCurriculums, fetchFaculties, fetchGeneratedCurriculumCode, fetchMajors } from '../../../../lib/curriculum';
import { useLanguage } from '../../../../providers/LanguageContext';
import ConfirmActionModal from '../../../../components/ui/ConfirmActionModal';
import DuplicateCourseWarningModal from '../../../../components/ui/DuplicateCourseWarningModal';
import CurriculumCourseEditorPanel from '../components/CurriculumCourseEditorPanel';
import CurriculumStructureSidebar from '../components/CurriculumStructureSidebar';
import CurriculumStructureImportModal from '../components/CurriculumStructureImportModal';
import { applyDraftCurriculumStructureImport, previewDraftCurriculumStructureImport } from '../../../../lib/curriculum-structure-import';
import '../../../../app/Competency.css';
import '../CourseLayout.css';
import '../CourseCreate.css';
import '../CurriculumCourseEditorPanel.css';
import '../CurriculumStructureSidebar.css';

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

    if (message.includes('category nesting cannot exceed 4 levels')) {
        return language === 'en'
            ? 'Categories can be nested up to 4 levels.'
            : 'สร้างหมวดวิชาได้สูงสุด 4 ระดับ';
    }
    if (
        message.includes('courses can only be placed in leaf categories')
        || message.includes('categories with courses cannot have child categories')
    ) {
        return language === 'en'
            ? 'Courses can be placed only in leaf categories.'
            : 'เพิ่มรายวิชาได้เฉพาะหมวดปลายทาง';
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

function Step1({
    form,
    setForm,
    faculties,
    majors,
    lookupsLoading,
    lookupsError,
    generatedCode,
    generatedCodeLoading,
    generatedCodeError,
    language,
    onAddMajor,
    onClearValidation,
}) {
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
                <label className="course-form-field__label">ชื่อหลักสูตร (ภาษาอังกฤษ)</label>
                <input
                    className="course-form-field__input"
                    value={form.nameEn}
                    onChange={e => updateForm(p => ({ ...p, nameEn: e.target.value }))}
                    placeholder="เช่น Computer Science"
                />
            </div>

            <div className="course-form-row">
                <div className="course-form-field">
                    <label className="course-form-field__label">รหัสหลักสูตร</label>
                    <div className="course-form-field__generated-code" aria-live="polite">
                        {generatedCodeLoading
                            ? (language === 'en' ? 'Generating curriculum code...' : 'กำลังสร้างรหัสหลักสูตร...')
                            : generatedCode || (language === 'en'
                                ? 'Select a major and academic year first'
                                : 'เลือกสาขาและปีการศึกษาก่อน')}
                    </div>
                    <div className="course-form-field__hint">
                        {language === 'en'
                            ? 'Generated automatically from the faculty, major, academic year, and sequence.'
                            : 'ระบบสร้างอัตโนมัติจากคณะ สาขา ปีการศึกษา และลำดับ'}
                    </div>
                    {generatedCodeError && <div className="course-form-field__error">{generatedCodeError}</div>}
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

function StructureGuide({ totalCategories, totalCourses, selectedCategory, isLeafCategory, t }) {
    const steps = [
        {
            label: t('structure_guide_add_root'),
            hint: t('structure_guide_add_root_hint'),
            complete: totalCategories > 0,
        },
        {
            label: t('structure_guide_add_course'),
            hint: t('structure_guide_add_course_hint'),
            complete: totalCourses > 0,
        },
    ];

    return (
        <section className="structure-guide" aria-labelledby="structure-guide-title" aria-live="polite">
            <div className="structure-guide__header">
                <Info size={18} aria-hidden="true" />
                <div>
                    <h3 id="structure-guide-title">{t('structure_guide_title')}</h3>
                    <p>{t('structure_guide_description')}</p>
                </div>
            </div>
            <ol className="structure-guide__steps">
                {steps.map((item, index) => (
                    <li
                        key={item.label}
                        className={`structure-guide__step ${item.complete ? 'structure-guide__step--complete' : ''}`}
                    >
                        <span className="structure-guide__step-icon" aria-hidden="true">
                            {item.complete ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                        </span>
                        <span className="structure-guide__step-copy">
                            <span className="structure-guide__step-label">{index + 1}. {item.label}</span>
                            <span className="structure-guide__step-hint">{item.hint}</span>
                        </span>
                    </li>
                ))}
            </ol>
            <div className="structure-guide__constraints">
                <strong>{t('structure_guide_constraints')}</strong>
                <span>{t('structure_guide_max_depth')}</span>
                <span>{t('structure_guide_leaf_only')}</span>
            </div>
        </section>
    );
}

function Step2({ form, setForm, selectedCategory, setSelectedCategory, onClearValidation, language = 'th', t }) {
    const categories = form.categories || [];
    const coursesByCategory = form.coursesByCategory || {};
    const [selectedCourseIds, setSelectedCourseIds] = useState(new Set());
    const [courseDeleteConfirmation, setCourseDeleteConfirmation] = useState(null);
    const [editingCourseId, setEditingCourseId] = useState(null);
    const [showDeleteCategoryModal, setShowDeleteCategoryModal] = useState(false);
    const [categoryToDelete, setCategoryToDelete] = useState(null);
    const [editingCategoryName, setEditingCategoryName] = useState(false);
    const [categoryNameVal, setCategoryNameVal] = useState('');
    const [draggedCategoryId, setDraggedCategoryId] = useState(null);
    const [draggedCourseId, setDraggedCourseId] = useState(null);
    const [dropTargetCategoryId, setDropTargetCategoryId] = useState(null);
    const [courseDuplicateWarning, setCourseDuplicateWarning] = useState(null);
    const [isCourseEditorEditing, setIsCourseEditorEditing] = useState(false);
    const [showStructureImport, setShowStructureImport] = useState(false);

    const MAX_CATEGORY_LEVELS = 4;
    const MAX_CATEGORY_DEPTH = MAX_CATEGORY_LEVELS - 1;

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

    const updateCategoryCodePrefix = (category, previousCode, nextCode) => {
        const normalizedPreviousCode = String(previousCode || '').trim();
        const normalizedNextCode = String(nextCode || '').trim();
        const updateChildren = (children) => (children || []).map(child => {
            const currentChildCode = String(child.code || '').trim();
            const childCode = normalizedPreviousCode && currentChildCode.startsWith(`${normalizedPreviousCode}.`)
                ? `${normalizedNextCode}${currentChildCode.slice(normalizedPreviousCode.length)}`
                : currentChildCode;
            return {
                ...child,
                code: childCode,
                children: updateChildren(child.children),
            };
        });

        return {
            ...category,
            code: normalizedNextCode,
            children: updateChildren(category.children),
        };
    };

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
            alert(t('structure_add_child_disabled'));
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

    const handleRenameCategory = (id, updates) => {
        onClearValidation?.();
        const nextName = typeof updates === 'string' ? updates : updates?.nameTh;
        const nextCode = typeof updates === 'string' ? undefined : updates?.code;
        const uniqueName = getUniqueCategoryName(nextName, id);
        const update = (cats) => cats.map(c => {
            if (c.id === id) {
                const currentCode = c.code || '';
                const normalizedCode = String(nextCode ?? currentCode).trim();
                return updateCategoryCodePrefix(
                    { ...c, name: uniqueName, isNew: false },
                    currentCode,
                    normalizedCode,
                );
            }
            if (c.children?.length) return { ...c, children: update(c.children) };
            return c;
        });
        setForm(p => ({ ...p, categories: update(p.categories) }));
        setSelectedCategory(p => p?.id === id
            ? { ...p, name: uniqueName, code: String(nextCode ?? p.code ?? '').trim() }
            : p);
    };

    const handleApplyStructureImport = (rows) => {
        const preview = previewDraftCurriculumStructureImport(categories, coursesByCategory, rows);
        const imported = applyDraftCurriculumStructureImport(categories, coursesByCategory, preview);
        setForm(previous => ({ ...previous, ...imported }));
        setSelectedCategory(null);
        onClearValidation?.();
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

        const nextCategories = result.categories;
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

    const handleAddCourse = (courseData) => {
        if (!selectedCategory || !isLeafCategory) return;
        onClearValidation?.();
        const courseId = `course_${Date.now()}`;
        const course = {
            id: courseId,
            code: courseData?.code || '',
            nameTh: courseData?.nameTh || '',
            nameEn: courseData?.nameEn || '',
            credits: Number(courseData?.credits) || 0,
            isCoreCourse: courseData?.isCoreCourse ?? true,
        };
        setForm(p => ({
            ...p,
            coursesByCategory: {
                ...p.coursesByCategory,
                [selectedCategory.id]: [...(p.coursesByCategory[selectedCategory.id] || []), course],
            },
        }));
        return true;
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

    const handleRequestDeleteCourse = (course) => {
        if (!(course.ownerCategoryId || findCourseOwnerId(course.id))) return false;
        setCourseDeleteConfirmation({
            courses: [course],
            mode: 'single',
        });
        return false;
    };

    const handleRequestDeleteSelectedCourses = (selectedCourses = []) => {
        if (!selectedCourses.length) return false;
        setCourseDeleteConfirmation({
            courses: selectedCourses,
            mode: selectedCourses.length === 1 ? 'single' : 'bulk',
        });
        return false;
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

    const handleDeleteSelectedCourses = (selectedCourses = []) => {
        const selectedIds = selectedCourses.length > 0
            ? new Set(selectedCourses.map(course => course.id))
            : selectedCourseIds;
        if (selectedIds.size === 0) return false;
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
        setCourseDeleteConfirmation(null);
        return true;
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

        const nextCategories = insertCategoryUnder(result.categories, targetCat.id, result.removed);
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

        const nextCategories = [...result.categories, result.removed];
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

    const handleMoveCourseInEditor = ({ draggedCourseId: movingCourseId, targetCategory, beforeCourseId = null }) => {
        if (!movingCourseId || !targetCategory || targetCategory.children?.length) return;
        setForm(p => ({
            ...p,
            coursesByCategory: moveCourseInMap(p.coursesByCategory || {}, movingCourseId, targetCategory.id, beforeCourseId),
        }));
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
            <StructureGuide
                totalCategories={totalCategories}
                totalCourses={totalCourses}
                selectedCategory={selectedCategory}
                isLeafCategory={isLeafCategory}
                t={t}
            />

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
                        title={language === 'en' ? 'Category structure' : 'โครงสร้างหมวดวิชา'}
                        addLabel={t('structure_add_root')}
                        addChildDisabledReason={t('structure_add_child_disabled')}
                        emptyText={t('structure_empty')}
                        maxDepth={MAX_CATEGORY_DEPTH}
                        showInlineAddChild={false}
                        showRenameAction={false}
                        headerActions={(
                            <button
                                type="button"
                                className="course-btn course-btn--ghost course-btn--sm"
                                onClick={() => setShowStructureImport(true)}
                            >
                                <Upload size={12} /> {language === 'en' ? 'Import courses' : 'นำเข้ารายวิชา'}
                            </button>
                        )}
                        clearSelectionDisabled={isCourseEditorEditing}
                        onRequestClearSelection={() => setSelectedCategory(null)}
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

                <CurriculumCourseEditorPanel
                    category={selectedCategory}
                    courses={courses}
                    allCourses={getAllCurrentCourses()}
                    categoryTotalCredits={selectedCategory ? getCategoryTotalCredits(selectedCategory) : 0}
                    canEdit
                    allowCategoryCodeEdit
                    disabled={false}
                    isLeafCategory={Boolean(isLeafCategory)}
                    coursePlacementHint={t('structure_add_course_disabled')}
                    draggedCourseId={draggedCourseId}
                    onRenameCategory={(id, updates) => {
                        const changesIdentity = Object.prototype.hasOwnProperty.call(updates, 'nameTh')
                            || Object.prototype.hasOwnProperty.call(updates, 'name')
                            || Object.prototype.hasOwnProperty.call(updates, 'code');

                        if (changesIdentity) {
                            handleRenameCategory(id, {
                                nameTh: updates.nameTh ?? updates.name,
                                code: updates.code,
                            });
                            return;
                        }

                        if (Object.prototype.hasOwnProperty.call(updates, 'requiredCredits')) {
                            handleUpdateCategory(id, { requiredCredits: updates.requiredCredits });
                        }
                    }}
                    onDeleteCategory={handleDeleteCategory}
                    onAddCourse={handleAddCourse}
                    onUpdateCourse={handleUpdateCourse}
                    onDeleteCourse={handleRequestDeleteCourse}
                    onBulkDeleteCourses={handleRequestDeleteSelectedCourses}
                    onMoveCourse={handleMoveCourseInEditor}
                    onValidateCourse={validateCourseBeforeSave}
                    onCourseDragStart={handleCourseDragStart}
                    onCourseDragEnd={handleCourseDragEnd}
                    onEditingStateChange={setIsCourseEditorEditing}
                    showCourseTypeColumn
                />
            </div>

            <DuplicateCourseWarningModal
                open={Boolean(courseDuplicateWarning)}
                issues={courseDuplicateWarning?.issues || []}
                language={language}
                onClose={() => setCourseDuplicateWarning(null)}
            />

            <CurriculumStructureImportModal
                open={showStructureImport}
                onClose={() => setShowStructureImport(false)}
                categories={categories}
                coursesByCategory={coursesByCategory}
                language={language}
                onImport={async (rows) => handleApplyStructureImport(rows)}
            />

            {/* Delete Confirmation Modal */}
            <ConfirmActionModal
                open={Boolean(courseDeleteConfirmation)}
                title={courseDeleteConfirmation?.mode === 'bulk' ? t('confirm_delete_courses') : t('confirm_delete_course')}
                message={courseDeleteConfirmation?.mode === 'bulk'
                    ? language === 'th'
                        ? `${t('confirm_delete_courses')} (${courseDeleteConfirmation.courses.length} วิชา)?`
                        : `${t('confirm_delete_courses')} (${courseDeleteConfirmation.courses.length} courses)?`
                    : `${t('confirm_delete_course')} "${courseDeleteConfirmation?.courses?.[0]?.code || courseDeleteConfirmation?.courses?.[0]?.nameTh || ''}"?`}
                hint={t('delete_course_irreversible_hint')}
                confirmLabel={t('confirm_action')}
                variant="danger"
                onCancel={() => setCourseDeleteConfirmation(null)}
                onConfirm={() => handleDeleteSelectedCourses(courseDeleteConfirmation?.courses || [])}
            />

            {/* Delete Category Confirmation Modal */}
            <ConfirmActionModal
                open={showDeleteCategoryModal && Boolean(categoryToDelete)}
                title="ยืนยันการลบหมวดวิชา"
                message={categoryToDelete ? `คุณแน่ใจหรือไม่ที่จะลบหมวดวิชา "${categoryToDelete.code} ${categoryToDelete.name || 'ยังไม่ตั้งชื่อ'}"?` : ''}
                impact={deleteCategoryPreview && (
                    <>
                        <div>หมวดย่อยที่ได้รับผลกระทบ: {deleteCategoryPreview.affectedCategories.length} หมวด</div>
                        <div>รายวิชาที่ได้รับผลกระทบ: {deleteCategoryPreview.affectedCourses.length} วิชา</div>
                        {deleteCategoryPreview.moveTarget ? (
                            <div>รายวิชาจะถูกย้ายไปที่ "{deleteCategoryPreview.moveTarget.code} {deleteCategoryPreview.moveTarget.name || 'ยังไม่ตั้งชื่อ'}"</div>
                        ) : (
                            <div>ไม่มีหมวดปลายทาง รายวิชาจะถูกถอดออกจากโครงสร้างปัจจุบัน</div>
                        )}
                    </>
                )}
                hint="หมวดนี้และหมวดย่อยทั้งหมดจะถูกลบ ส่วนรายวิชาจะถูกย้ายไปยังหมวดที่ใกล้ที่สุดโดยอัตโนมัติ หากไม่มีหมวดรองรับ รายวิชาจะไม่แสดงในโครงสร้างหลักสูตรนี้"
                confirmLabel="ยืนยันการลบ"
                variant="danger"
                onCancel={() => setShowDeleteCategoryModal(false)}
                onConfirm={confirmDeleteCategory}
            />
        </div>
    );
}

function Step3({ form, generatedCode }) {
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
                    <div><span className="course-overview-info__label">รหัสหลักสูตร:</span> <span className="course-overview-info__value">{generatedCode || '-'}</span></div>
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
    const { language, t } = useLanguage();
    const createdMajorId = Number(searchParams.get('created_major_id') || 0);
    const [step, setStep] = useState(1);
    const [form, setForm] = useState(EMPTY_FORM);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [faculties, setFaculties] = useState([]);
    const [majors, setMajors] = useState([]);
    const [curriculums, setCurriculums] = useState([]);
    const [lookupsLoading, setLookupsLoading] = useState(true);
    const [lookupsError, setLookupsError] = useState('');
    const [generatedCode, setGeneratedCode] = useState('');
    const [generatedCodeLoading, setGeneratedCodeLoading] = useState(false);
    const [generatedCodeError, setGeneratedCodeError] = useState('');
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

    useEffect(() => {
        const majorId = Number(form.majorId || 0);
        const effectiveYearBE = Number(form.year || 0);
        if (!majorId || !effectiveYearBE) {
            setGeneratedCode('');
            setGeneratedCodeError('');
            setGeneratedCodeLoading(false);
            return undefined;
        }

        let cancelled = false;
        setGeneratedCodeLoading(true);
        setGeneratedCodeError('');
        setGeneratedCode('');

        fetchGeneratedCurriculumCode(majorId, effectiveYearBE)
            .then(code => {
                if (!cancelled) setGeneratedCode(code);
            })
            .catch(err => {
                if (!cancelled) {
                    setGeneratedCodeError(err?.message || (language === 'en'
                        ? 'Unable to generate curriculum code.'
                        : 'ไม่สามารถสร้างรหัสหลักสูตรได้'));
                }
            })
            .finally(() => {
                if (!cancelled) setGeneratedCodeLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [form.majorId, form.year, language]);

    const canNext = () => {
        if (step === 1) {
            return (
                !lookupsLoading
                && form.nameTh.trim()
                && form.facultyId
                && form.majorId
                && form.year
                && generatedCode
                && !generatedCodeLoading
                && !generatedCodeError
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
        if (!canNext()) return;
        if (duplicateNameWarning) {
            setError(duplicateNameWarning);
            return;
        }
        setError('');
        setStep(2);
    };

    const handleStep2Next = () => {
        if (!canProceedFromStep2()) return;
        setError('');
        setStep(3);
    };

    const handleSave = async () => {
        setError('');
        setSubmitting(true);

        try {
            await createCurriculumFromForm(form);
            sessionStorage.removeItem(CURRICULUM_CREATE_DRAFT_KEY);
            router.push('/curriculum-management?created=1');
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
                            generatedCode={generatedCode}
                            generatedCodeLoading={generatedCodeLoading}
                            generatedCodeError={generatedCodeError}
                            language={language}
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
                            t={t}
                        />
                    )}
                    {step === 3 && <Step3 form={form} generatedCode={generatedCode} />}

                </div>

                {step !== 2 && error && (
                    <div className="course-create-feedback course-create-feedback--error">
                        {error}
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
                <ConfirmActionModal
                    open={showCancelModal}
                    title="ยืนยันการยกเลิก"
                    message="คุณแน่ใจหรือไม่ที่จะยกเลิกการสร้างหลักสูตร?"
                    hint="ข้อมูลที่กรอกไว้ทั้งหมดจะหายไป"
                    confirmLabel="ยืนยัน"
                    variant="danger"
                    onCancel={() => setShowCancelModal(false)}
                    onConfirm={() => {
                        setShowCancelModal(false);
                        router.push('/curriculum-management');
                    }}
                />
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
