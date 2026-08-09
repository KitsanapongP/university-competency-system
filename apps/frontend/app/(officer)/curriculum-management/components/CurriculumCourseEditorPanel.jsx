'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    BookOpen,
    Check,
    ChevronFirst,
    ChevronLast,
    ChevronLeft,
    ChevronRight,
    GripVertical,
    LockKeyhole,
    MoreHorizontal,
    Pencil,
    Plus,
    Trash2,
    X,
} from 'lucide-react';
import { useLanguage } from '../../../../providers/LanguageContext';

const NEW_COURSE_ID = '__new_course__';

function normalizeCourseId(course) {
    return String(course?.id ?? course?.curriculumCourseId ?? course?.courseId ?? '');
}

function CurriculumCourseRow({
    course,
    disabled = false,
    isSelected = false,
    isEditing = false,
    isDragging = false,
    isDropTarget = false,
    isNew = false,
    isLocked = false,
    originBadge = '',
    canDrag = true,
    canSelect = true,
    renderExtraCells,
    onToggleSelect,
    onStartEdit,
    onCancelEdit,
    onSave,
    onDelete,
    onDragStart,
    onDragOver,
    onDragLeave,
    onDrop,
    onDragEnd,
}) {
    const { t } = useLanguage();
    const [form, setForm] = useState({
        code: course.code || '',
        nameTh: course.nameTh || '',
        nameEn: course.nameEn || '',
        credits: course.credits || 0,
    });
    const [actionMenuPosition, setActionMenuPosition] = useState(null);
    const actionMenuRef = useRef(null);
    const isActionMenuOpen = Boolean(actionMenuPosition);

    useEffect(() => {
        if (!isEditing) return;
        setForm({
            code: course.code || '',
            nameTh: course.nameTh || '',
            nameEn: course.nameEn || '',
            credits: course.credits || 0,
        });
    }, [course.code, course.nameTh, course.nameEn, course.credits, isEditing]);

    const rowDisabled = disabled || isLocked;

    const handleSave = async () => {
        if (rowDisabled || !String(form.code || '').trim() || !String(form.nameTh || '').trim()) return;
        const result = await onSave?.({
            ...course,
            code: String(form.code || '').trim(),
            nameTh: String(form.nameTh || '').trim(),
            nameEn: String(form.nameEn || '').trim(),
            credits: Number(form.credits) || 0,
        });
        if (result !== false) {
            onCancelEdit?.();
        }
    };

    const handleCancel = () => {
        setForm({
            code: course.code || '',
            nameTh: course.nameTh || '',
            nameEn: course.nameEn || '',
            credits: course.credits || 0,
        });
        onCancelEdit?.();
    };

    const handleKey = (event) => {
        if (event.key === 'Enter') handleSave();
        if (event.key === 'Escape') handleCancel();
    };

    useEffect(() => {
        if (!isActionMenuOpen) return undefined;

        const handlePointerDown = (event) => {
            if (!actionMenuRef.current?.contains(event.target)) {
                setActionMenuPosition(null);
            }
        };
        const closeActionMenu = () => setActionMenuPosition(null);

        window.addEventListener('pointerdown', handlePointerDown);
        window.addEventListener('scroll', closeActionMenu, true);
        window.addEventListener('resize', closeActionMenu);
        return () => {
            window.removeEventListener('pointerdown', handlePointerDown);
            window.removeEventListener('scroll', closeActionMenu, true);
            window.removeEventListener('resize', closeActionMenu);
        };
    }, [isActionMenuOpen]);

    const handleStartEdit = () => {
        setActionMenuPosition(null);
        onStartEdit?.(course);
    };

    const handleDelete = () => {
        setActionMenuPosition(null);
        onDelete?.(course);
    };

    const toggleActionMenu = (event) => {
        event.stopPropagation();
        if (isActionMenuOpen) {
            setActionMenuPosition(null);
            return;
        }

        const rect = event.currentTarget.getBoundingClientRect();
        const menuWidth = 154;
        const menuHeight = 82;
        const preferredTop = rect.bottom + 4;
        const top = preferredTop + menuHeight > window.innerHeight
            ? Math.max(8, rect.top - menuHeight - 4)
            : preferredTop;

        setActionMenuPosition({
            top,
            left: Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8)),
        });
    };

    return (
        <tr
            className={`ss-row ${isEditing ? 'ss-row--editing' : ''} ${isSelected ? 'ss-row--selected' : ''} ${isDragging ? 'ss-row--dragging' : ''} ${isDropTarget ? 'ss-row--drop-target' : ''}`}
            draggable={!rowDisabled && canDrag && !isEditing && !isNew}
            onDragStart={event => onDragStart?.(event, course)}
            onDragOver={event => onDragOver?.(event, course)}
            onDragLeave={event => onDragLeave?.(event, course)}
            onDrop={event => onDrop?.(event, course)}
            onDragEnd={onDragEnd}
        >
            <td className="ss-cell ss-cell--grip">
                {!isLocked && canDrag && <GripVertical size={13} />}
                {isLocked && <LockKeyhole size={12} />}
            </td>
            <td className="ss-cell ss-cell--checkbox">
                {!isNew && !isLocked && canSelect && (
                    <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={rowDisabled}
                        onChange={() => onToggleSelect?.(course)}
                        aria-label="เลือกวิชา"
                    />
                )}
            </td>
            <td className="ss-cell ss-cell--text">
                {isEditing ? (
                    <input
                        className="ss-input"
                        value={form.code}
                        onChange={event => setForm(current => ({ ...current, code: event.target.value }))}
                        onKeyDown={handleKey}
                        placeholder="รหัสวิชา"
                        disabled={rowDisabled}
                        autoFocus={isNew}
                    />
                ) : (
                    <span className="ss-code">
                        {course.code || <span className="ss-placeholder">รหัสวิชา</span>}
                        {originBadge && <span className="curriculum-course-origin-badge">{originBadge}</span>}
                    </span>
                )}
            </td>
            <td className="ss-cell ss-cell--text">
                {isEditing ? (
                    <input
                        className="ss-input"
                        value={form.nameTh}
                        onChange={event => setForm(current => ({ ...current, nameTh: event.target.value }))}
                        onKeyDown={handleKey}
                        placeholder="ชื่อวิชาภาษาไทย"
                        disabled={rowDisabled}
                    />
                ) : (
                    <span>{course.nameTh || <span className="ss-placeholder">ชื่อภาษาไทย</span>}</span>
                )}
            </td>
            <td className="ss-cell ss-cell--text">
                {isEditing ? (
                    <input
                        className="ss-input"
                        value={form.nameEn}
                        onChange={event => setForm(current => ({ ...current, nameEn: event.target.value }))}
                        onKeyDown={handleKey}
                        placeholder="English Name"
                        disabled={rowDisabled}
                    />
                ) : (
                    <span>{course.nameEn || <span className="ss-placeholder">English Name</span>}</span>
                )}
            </td>
            <td className="ss-cell ss-cell--num">
                {isEditing ? (
                    <input
                        className="ss-input ss-input--num"
                        type="text"
                        inputMode="numeric"
                        value={form.credits}
                        onChange={event => {
                            const value = event.target.value.replace(/[^0-9]/g, '');
                            setForm(current => ({ ...current, credits: value }));
                        }}
                        onKeyDown={handleKey}
                        placeholder="0"
                        disabled={rowDisabled}
                    />
                ) : (
                    <span>{course.credits || <span className="ss-placeholder">0</span>}</span>
                )}
            </td>
            {renderExtraCells?.(course)}
            <td className="ss-cell ss-cell--actions">
                {isEditing ? (
                    <>
                        <button
                            type="button"
                            className="icon-course-btn icon-course-btn--edit icon-course-btn--xs"
                            onClick={handleSave}
                            disabled={disabled || !String(form.code || '').trim() || !String(form.nameTh || '').trim()}
                            title="บันทึก"
                        >
                            <Check size={13} />
                        </button>
                        <button
                            type="button"
                            className="icon-course-btn icon-course-btn--danger icon-course-btn--xs"
                            onClick={handleCancel}
                            disabled={disabled}
                            title="ยกเลิก"
                        >
                            <X size={12} />
                        </button>
                    </>
                ) : !rowDisabled && !isNew ? (
                    <div className="curriculum-course-row-actions" ref={actionMenuRef}>
                        <button
                            type="button"
                            className="curriculum-course-row-actions__trigger"
                            onClick={toggleActionMenu}
                            onPointerDown={event => event.stopPropagation()}
                            aria-label={t('course_actions')}
                            aria-haspopup="menu"
                            aria-expanded={isActionMenuOpen}
                            title={t('course_actions')}
                        >
                            <MoreHorizontal size={17} />
                        </button>
                    </div>
                ) : null}
                {isActionMenuOpen && createPortal(
                    <div
                        className="curriculum-course-row-actions__menu"
                        ref={actionMenuRef}
                        role="menu"
                        style={{ top: actionMenuPosition.top, left: actionMenuPosition.left }}
                    >
                                <button
                                    type="button"
                                    className="curriculum-course-row-actions__item"
                                    onClick={handleStartEdit}
                                    role="menuitem"
                                >
                                    <Pencil size={15} />
                                    {t('edit_course')}
                                </button>
                                <button
                                    type="button"
                                    className="curriculum-course-row-actions__item curriculum-course-row-actions__item--danger"
                                    onClick={handleDelete}
                                    role="menuitem"
                                >
                                    <Trash2 size={15} />
                                    {t('delete_course')}
                                </button>
                    </div>,
                    document.body,
                )}
            </td>
        </tr>
    );
}

export default function CurriculumCourseEditorPanel({
    category,
    courses = [],
    allCourses = [],
    categoryTotalCredits = 0,
    canEdit = false,
    disabled = false,
    isLeafCategory = false,
    coursePlacementHint = '',
    isAllCoursesView = false,
    pageSize = 10,
    draggedCourseId = null,
    onRenameCategory,
    onDeleteCategory,
    onAddCourse,
    onUpdateCourse,
    onDeleteCourse,
    onBulkDeleteCourses,
    onMoveCourse,
    onValidateCourse,
    onCourseDragStart,
    onCourseDragEnd,
    onEditingStateChange,
    canEditCategoryMetadata = canEdit,
    canManageCourses = canEdit,
    getCourseCapabilities,
    allowExtraEditing = false,
    allowSelection = true,
    showCategoryToolbar = true,
    showCourseActions = true,
    extraColumnHeaders = [],
    renderExtraCells,
}) {
    const [editingCategoryName, setEditingCategoryName] = useState(false);
    const [categoryNameValue, setCategoryNameValue] = useState(category?.name || '');
    const [categoryCreditsValue, setCategoryCreditsValue] = useState(category?.requiredCredits || 0);
    const [editingCourseId, setEditingCourseId] = useState(null);
    const [showAddCourse, setShowAddCourse] = useState(false);
    const [selectedCourseIds, setSelectedCourseIds] = useState(new Set());
    const [currentPage, setCurrentPage] = useState(1);
    const [dropTargetCourseId, setDropTargetCourseId] = useState(null);
    const [isDropZoneActive, setIsDropZoneActive] = useState(false);

    const categoryId = category?.id ?? null;
    const isReadOnly = disabled || !category || isAllCoursesView || (!canEdit && !allowExtraEditing);
    const canEditCategory = !isReadOnly && canEditCategoryMetadata;
    const canMutateCourses = !isReadOnly && isLeafCategory && canManageCourses;
    const hasActiveEdit = editingCategoryName || editingCourseId !== null || showAddCourse;

    useEffect(() => {
        setEditingCategoryName(false);
        setCategoryNameValue(category?.name || '');
        setCategoryCreditsValue(category?.requiredCredits || 0);
        setEditingCourseId(null);
        setShowAddCourse(false);
        setSelectedCourseIds(new Set());
        setCurrentPage(1);
        setDropTargetCourseId(null);
        setIsDropZoneActive(false);
    }, [categoryId, category?.name, category?.requiredCredits]);

    const resolveCourseCapabilities = (course) => getCourseCapabilities?.(course) || {};
    const canSelectCourse = (course) => !isReadOnly && allowSelection && resolveCourseCapabilities(course).canSelect !== false;

    useEffect(() => {
        setSelectedCourseIds(current => {
            const validIds = new Set(courses.filter(canSelectCourse).map(normalizeCourseId));
            const next = new Set([...current].filter(id => validIds.has(id)));
            return next.size === current.size ? current : next;
        });
    }, [courses, getCourseCapabilities, isReadOnly]);

    useEffect(() => {
        onEditingStateChange?.(hasActiveEdit);
    }, [hasActiveEdit, onEditingStateChange]);

    useEffect(() => () => onEditingStateChange?.(false), [onEditingStateChange]);

    const totalPages = Math.max(1, Math.ceil(courses.length / pageSize));
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const startIndex = (safeCurrentPage - 1) * pageSize;
    const paginatedCourses = courses.slice(startIndex, startIndex + pageSize);
    const visibleCourseIds = useMemo(() => paginatedCourses
        .filter(canSelectCourse)
        .map(normalizeCourseId), [paginatedCourses, getCourseCapabilities, isReadOnly]);
    const isCurrentPageSelected = visibleCourseIds.length > 0 && visibleCourseIds.every(id => selectedCourseIds.has(id));
    const selectedCourses = courses.filter(course => canSelectCourse(course) && selectedCourseIds.has(normalizeCourseId(course)));
    const hasSelectedCourses = selectedCourseIds.size > 0;

    const saveCategoryName = () => {
        if (!canEditCategory || !category?.id) return;
        const nextName = categoryNameValue.trim() || 'หมวดวิชาใหม่';
        if (nextName === category.name) {
            setEditingCategoryName(false);
            return;
        }
        onRenameCategory?.(category.id, { nameTh: nextName });
        setEditingCategoryName(false);
    };

    const saveCategoryCredits = () => {
        if (!canEditCategory || !category?.id) return;
        const nextCredits = Number(categoryCreditsValue);
        if (!Number.isFinite(nextCredits) || nextCredits < 0) {
            setCategoryCreditsValue(category?.requiredCredits || 0);
            return;
        }
        if (nextCredits === (category.requiredCredits || 0)) return;
        onRenameCategory?.(category.id, { requiredCredits: nextCredits });
    };

    const toggleCurrentPageSelection = () => {
        if (isReadOnly) return;
        setSelectedCourseIds(current => {
            const next = new Set(current);
            if (isCurrentPageSelected) {
                visibleCourseIds.forEach(id => next.delete(id));
            } else {
                visibleCourseIds.forEach(id => next.add(id));
            }
            return next;
        });
    };

    const toggleCourseSelection = (course) => {
        if (isReadOnly) return;
        const id = normalizeCourseId(course);
        setSelectedCourseIds(current => {
            const next = new Set(current);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleSaveCourse = async (course) => {
        if (onValidateCourse && !onValidateCourse(course, allCourses)) {
            return false;
        }
        const result = course.id === NEW_COURSE_ID
            ? await onAddCourse?.(course)
            : await onUpdateCourse?.(course);
        if (result !== false) {
            setShowAddCourse(false);
            setEditingCourseId(null);
        }
        return result;
    };

    const handleBulkDelete = async () => {
        if (!selectedCourses.length || isReadOnly) return;
        const ok = window.confirm(`ยืนยันการลบรายวิชาที่เลือก ${selectedCourses.length} วิชาหรือไม่?`);
        if (!ok) return;
        const result = await onBulkDeleteCourses?.(selectedCourses);
        if (result !== false) {
            setSelectedCourseIds(new Set());
        }
    };

    const handleCourseDragOver = (event, targetCourse) => {
        if (!draggedCourseId || isReadOnly || !isLeafCategory) return;
        const targetCourseId = normalizeCourseId(targetCourse);
        if (String(draggedCourseId) === targetCourseId) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'move';
        setDropTargetCourseId(targetCourseId);
        setIsDropZoneActive(false);
    };

    const handleCourseDragLeave = (event, targetCourse) => {
        const targetCourseId = normalizeCourseId(targetCourse);
        if (!targetCourseId || dropTargetCourseId !== targetCourseId) return;
        const nextElement = event.relatedTarget;
        if (nextElement instanceof Node && event.currentTarget.contains(nextElement)) return;
        setDropTargetCourseId(null);
    };

    const handleCourseDrop = (event, targetCourse) => {
        if (!draggedCourseId || isReadOnly || !isLeafCategory) return;
        event.preventDefault();
        event.stopPropagation();
        setDropTargetCourseId(null);
        setIsDropZoneActive(false);
        onMoveCourse?.({
            draggedCourseId,
            targetCourse,
            targetCategory: category,
            beforeCourseId: normalizeCourseId(targetCourse),
        });
    };

    const handleDropZoneDragOver = (event) => {
        if (!draggedCourseId || isReadOnly || !isLeafCategory || !category) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'move';
        setDropTargetCourseId(null);
        setIsDropZoneActive(true);
    };

    const handleDropToCategoryEnd = (event) => {
        if (!draggedCourseId || isReadOnly || !isLeafCategory || !category) return;
        event.preventDefault();
        event.stopPropagation();
        setDropTargetCourseId(null);
        setIsDropZoneActive(false);
        onMoveCourse?.({
            draggedCourseId,
            targetCourse: null,
            targetCategory: category,
            beforeCourseId: null,
        });
    };

    const handleCourseDragEnd = () => {
        setDropTargetCourseId(null);
        setIsDropZoneActive(false);
        onCourseDragEnd?.();
    };

    const changePage = (page) => {
        setCurrentPage(Math.min(Math.max(page, 1), totalPages));
    };

    const newCourse = {
        id: NEW_COURSE_ID,
        code: '',
        nameTh: '',
        nameEn: '',
        credits: 0,
        isCoreCourse: true,
    };

    return (
        <div className="course-two-panel__content curriculum-course-editor">
            {showCategoryToolbar && (
            <div className="course-detail-toolbar curriculum-course-editor__toolbar">
                <div className="course-detail-toolbar__left">
                    <span className="course-detail-toolbar__label">ชื่อหมวดวิชา</span>
                    {category ? (
                        <div className="course-detail-toolbar__name">
                            {editingCategoryName ? (
                                <input
                                    autoFocus
                                    className="course-detail-toolbar__name-input"
                                    value={categoryNameValue}
                                    onChange={event => setCategoryNameValue(event.target.value)}
                                    onBlur={saveCategoryName}
                                    onKeyDown={event => {
                                        if (event.key === 'Enter') saveCategoryName();
                                        if (event.key === 'Escape') {
                                            setCategoryNameValue(category?.name || '');
                                            setEditingCategoryName(false);
                                        }
                                    }}
                                    disabled={isReadOnly}
                                />
                            ) : (
                                <>
                                    <span className="course-detail-toolbar__name-text">
                                        {category.code ? `${category.code} ` : ''}{category.name || <em>ยังไม่ตั้งชื่อ</em>}
                                    </span>
                                    {canEditCategory && (
                                        <button
                                            type="button"
                                            className="course-detail-toolbar__edit-btn"
                                            onClick={() => {
                                                setCategoryNameValue(category.name || '');
                                                setEditingCategoryName(true);
                                            }}
                                            title="แก้ไขชื่อหมวดวิชา"
                                        >
                                            <Pencil size={14} />
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    ) : (
                        <span className="course-detail-toolbar__placeholder">เลือกหมวดวิชาเพื่อจัดการรายวิชา</span>
                    )}
                </div>
                {category && (
                    <div className="course-detail-toolbar__right">
                        <div className="course-detail-toolbar__credits">
                            <span className="course-detail-toolbar__credits-label">หน่วยกิตรวม</span>
                            <span className="course-detail-toolbar__credits-value">{categoryTotalCredits}</span>
                        </div>
                        {canEditCategory && (
                            <button
                                type="button"
                                className="course-detail-toolbar__delete-btn"
                                onClick={() => onDeleteCategory?.(category)}
                                title="ลบหมวดวิชา"
                            >
                                <Trash2 size={14} />
                            </button>
                        )}
                    </div>
                )}
            </div>
            )}

            {category ? (
                <>
                    {showCourseActions && (
                    <div className="course-detail-courses curriculum-course-editor__actions">
                        <div className="curriculum-course-editor__summary">
                            <BookOpen size={14} />
                            <span>รายวิชา {courses.length} วิชา</span>
                            {hasSelectedCourses && <span className="curriculum-course-editor__selected">เลือกแล้ว {selectedCourseIds.size}</span>}
                        </div>
                        <div className="curriculum-course-editor__action-buttons">
                            {hasSelectedCourses ? (
                                <>
                                    <button
                                        type="button"
                                        className="course-btn course-btn--ghost course-btn--sm"
                                        onClick={() => setSelectedCourseIds(new Set())}
                                        disabled={disabled}
                                    >
                                        ล้างการเลือก
                                    </button>
                                    <button
                                        type="button"
                                        className="course-btn course-btn--danger course-btn--sm"
                                        onClick={handleBulkDelete}
                                        disabled={isReadOnly}
                                    >
                                        <Trash2 size={13} /> ลบ ({selectedCourseIds.size})
                                    </button>
                                </>
                            ) : (
                                <button
                                    type="button"
                                    className="course-btn course-btn--primary course-btn--sm"
                                    onClick={() => {
                                        setShowAddCourse(true);
                                        setEditingCourseId(NEW_COURSE_ID);
                                    }}
                                    disabled={!canMutateCourses || showAddCourse}
                                    title={!isLeafCategory ? coursePlacementHint : ''}
                                >
                                    <Plus size={13} /> เพิ่มรายวิชา
                                </button>
                            )}
                        </div>
                    </div>
                    )}

                    {!isLeafCategory && !isReadOnly && coursePlacementHint && (
                        <p className="curriculum-course-editor__placement-hint" role="status">
                            {coursePlacementHint}
                        </p>
                    )}

                    <div className="course-two-panel__body curriculum-course-editor__body">
                        <div className={`course-spreadsheet-scroll ss-wrapper ${isDropZoneActive ? 'ss-wrapper--drop-zone-active' : ''}`}>
                            <div className="ss-scroll">
                                <table className="course-spreadsheet-table ss-table">
                                    <colgroup>
                                        <col className="curriculum-course-editor__col--grip" />
                                        <col className="curriculum-course-editor__col--checkbox" />
                                        <col className="curriculum-course-editor__col--text" />
                                        <col className="curriculum-course-editor__col--text" />
                                        <col className="curriculum-course-editor__col--text" />
                                        <col className="curriculum-course-editor__col--credits" />
                                        {extraColumnHeaders.map((column, index) => (
                                            <col key={column.key || index} className={column.colClassName || 'curriculum-course-editor__col--extra'} />
                                        ))}
                                        <col className="curriculum-course-editor__col--actions" />
                                    </colgroup>
                                    <thead>
                                        <tr>
                                            <th className="course-spreadsheet-th ss-th course-spreadsheet-th--grip ss-th--grip"></th>
                                            <th className="course-spreadsheet-th ss-th course-spreadsheet-th--checkbox ss-th--checkbox">
                                                <input
                                                    type="checkbox"
                                                    checked={isCurrentPageSelected}
                                                    disabled={!visibleCourseIds.length || disabled || isReadOnly}
                                                    onChange={toggleCurrentPageSelection}
                                                    title="เลือกวิชาหน้านี้"
                                                />
                                            </th>
                                            <th className="course-spreadsheet-th ss-th ss-th--text">รหัสวิชา</th>
                                            <th className="course-spreadsheet-th ss-th ss-th--text">ชื่อวิชา (ไทย)</th>
                                            <th className="course-spreadsheet-th ss-th ss-th--text">ชื่อวิชา (Eng)</th>
                                            <th className="course-spreadsheet-th ss-th course-spreadsheet-th--num ss-th--num">หน่วยกิต</th>
                                            {extraColumnHeaders.map((column, index) => (
                                                <th
                                                    key={column.key || index}
                                                    className={`course-spreadsheet-th ss-th ${column.className || 'ss-th--text'}`}
                                                >
                                                    {column.label ?? column}
                                                </th>
                                            ))}
                                            <th className="course-spreadsheet-th ss-th course-spreadsheet-th--actions ss-th--actions"></th>
                                        </tr>
                                    </thead>
                                    <tbody
                                        className={isDropZoneActive ? 'ss-tbody--drop-zone-active' : ''}
                                        onDragOver={handleDropZoneDragOver}
                                        onDrop={handleDropToCategoryEnd}
                                        onDragLeave={event => {
                                            const nextElement = event.relatedTarget;
                                            if (nextElement instanceof Node && event.currentTarget.contains(nextElement)) return;
                                            setIsDropZoneActive(false);
                                        }}
                                    >
                                        {showAddCourse && (
                                            <CurriculumCourseRow
                                                course={newCourse}
                                                isNew
                                                isEditing
                                                disabled={disabled}
                                                renderExtraCells={renderExtraCells}
                                                onSave={handleSaveCourse}
                                                onCancelEdit={() => {
                                                    setShowAddCourse(false);
                                                    setEditingCourseId(null);
                                                }}
                                            />
                                        )}
                                        {paginatedCourses.map(course => {
                                            const courseId = normalizeCourseId(course);
                                            const courseCapabilities = resolveCourseCapabilities(course);
                                            const rowDisabled = disabled || isReadOnly || courseCapabilities.canEdit === false;
                                            return (
                                                <CurriculumCourseRow
                                                    key={`${courseId}:${course.code}:${course.nameTh}:${course.nameEn}:${course.credits}`}
                                                    course={course}
                                                    disabled={rowDisabled}
                                                    isLocked={Boolean(courseCapabilities.locked)}
                                                    originBadge={courseCapabilities.badge || ''}
                                                    canDrag={courseCapabilities.canDrag !== false}
                                                    canSelect={courseCapabilities.canSelect !== false}
                                                    isSelected={courseCapabilities.canSelect !== false && selectedCourseIds.has(courseId)}
                                                    isEditing={editingCourseId === courseId}
                                                    isDragging={String(draggedCourseId) === courseId}
                                                    isDropTarget={dropTargetCourseId === courseId}
                                                    onToggleSelect={toggleCourseSelection}
                                                    onStartEdit={() => setEditingCourseId(courseId)}
                                                    onCancelEdit={() => setEditingCourseId(null)}
                                                    onSave={handleSaveCourse}
                                                    onDelete={onDeleteCourse}
                                                    onDragStart={onCourseDragStart}
                                                    onDragOver={handleCourseDragOver}
                                                    onDragLeave={handleCourseDragLeave}
                                                    onDrop={handleCourseDrop}
                                                    onDragEnd={handleCourseDragEnd}
                                                    renderExtraCells={renderExtraCells}
                                                />
                                            );
                                        })}
                                    </tbody>
                                </table>
                                {draggedCourseId && canMutateCourses && (
                                    <div
                                        className={`ss-drop-end-zone ${isDropZoneActive ? 'ss-drop-end-zone--active' : ''}`}
                                        onDragOver={handleDropZoneDragOver}
                                        onDrop={handleDropToCategoryEnd}
                                        onDragLeave={event => {
                                            const nextElement = event.relatedTarget;
                                            if (nextElement instanceof Node && event.currentTarget.contains(nextElement)) return;
                                            setIsDropZoneActive(false);
                                        }}
                                    >
                                        วางที่นี่เพื่อย้ายไปท้ายหมวดนี้
                                    </div>
                                )}
                            </div>
                            {courses.length === 0 && !showAddCourse && (
                                <div className="course-spreadsheet-empty">
                                    ยังไม่มีรายวิชา - กดปุ่ม "เพิ่มรายวิชา"
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="course-pagination curriculum-course-editor__pagination">
                        <span className="course-pagination__info">
                            หน้า {safeCurrentPage} / {totalPages}
                        </span>
                        <div className="course-pagination__buttons">
                            <button type="button" className="course-btn course-btn--ghost course-btn--sm" onClick={() => changePage(1)} disabled={safeCurrentPage === 1}>
                                <ChevronFirst size={14} />
                            </button>
                            <button type="button" className="course-btn course-btn--ghost course-btn--sm" onClick={() => changePage(safeCurrentPage - 1)} disabled={safeCurrentPage === 1}>
                                <ChevronLeft size={14} /> ย้อนกลับ
                            </button>
                            <button type="button" className="course-btn course-btn--ghost course-btn--sm" onClick={() => changePage(safeCurrentPage + 1)} disabled={safeCurrentPage === totalPages}>
                                ถัดไป <ChevronRight size={14} />
                            </button>
                            <button type="button" className="course-btn course-btn--ghost course-btn--sm" onClick={() => changePage(totalPages)} disabled={safeCurrentPage === totalPages}>
                                <ChevronLast size={14} />
                            </button>
                        </div>
                    </div>
                </>
            ) : (
                <div className="course-two-panel__empty">
                    <BookOpen size={24} style={{ opacity: 0.3 }} />
                    <div>เลือกหมวดวิชาเพื่อดูรายวิชา</div>
                </div>
            )}
        </div>
    );
}
