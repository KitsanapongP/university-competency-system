'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, ChevronDown, ChevronRight, Layers, LockKeyhole, Pencil, Plus, Trash2 } from 'lucide-react';

function collectCategoryIds(category) {
    return [category.id, ...(category.children || []).flatMap(collectCategoryIds)];
}

function countCourses(category, coursesByCategory) {
    return collectCategoryIds(category).reduce((sum, categoryId) => {
        return sum + ((coursesByCategory[categoryId] || []).length);
    }, 0);
}

function sumCredits(category, coursesByCategory, visited = new Set()) {
    if (!category || visited.has(category.id)) return 0;
    visited.add(category.id);
    const ownCredits = (coursesByCategory[category.id] || []).reduce((sum, course) => {
        return sum + (Number(course.credits) || 0);
    }, 0);
    return ownCredits + (category.children || []).reduce((sum, child) => {
        return sum + sumCredits(child, coursesByCategory, visited);
    }, 0);
}

function getSubtreeDepth(category) {
    if (!category?.children?.length) return 0;
    return Math.max(...category.children.map(child => 1 + getSubtreeDepth(child)));
}

function isTreeInteractionTarget(target) {
    if (!(target instanceof Element)) return true;
    return Boolean(target.closest([
        'button',
        'input',
        'select',
        'textarea',
        'a',
        '.curriculum-structure-row',
        '.curriculum-structure-course',
    ].join(', ')));
}

function CategoryTreeNode({
    category,
    depth = 0,
    maxDepth,
    selectedCategoryId,
    coursesByCategory,
    disabled,
    canEdit,
    draggingCategoryId,
    draggedCourseId,
    dropTargetCategoryId,
    onSelectCategory,
    onAddChildCategory,
    onRenameCategory,
    onDeleteCategory,
    onCategoryDragStart,
    onCategoryDragOver,
    onCategoryDrop,
    onCategoryDragEnd,
    onCategoryDragLeave,
    onCourseCategoryDragOver,
    onCourseCategoryDrop,
    onCourseDragStart,
    onCourseDragEnd,
    onRenameStateChange,
    getCategoryCapabilities,
    getCourseCapabilities,
    getCategoryBadge,
    getCourseBadge,
    showInlineAddChild = true,
    allowCategoryCodeEdit = false,
    showRenameAction = true,
    addChildLabel,
    addChildDisabledReason,
}) {
    const [expanded, setExpanded] = useState(true);
    const [renaming, setRenaming] = useState(category.isNew || false);
    const [nameValue, setNameValue] = useState(category.name || '');
    const [codeValue, setCodeValue] = useState(category.code || '');
    const codeInputRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        if (renaming) {
            if (allowCategoryCodeEdit) {
                codeInputRef.current?.focus();
                codeInputRef.current?.select();
            } else {
                inputRef.current?.focus();
                inputRef.current?.select();
            }
        }
    }, [allowCategoryCodeEdit, renaming]);

    useEffect(() => {
        if (!renaming) {
            setNameValue(category.name || '');
            setCodeValue(category.code || '');
        }
    }, [category.code, category.name, renaming]);

    useEffect(() => {
        onRenameStateChange?.(category.id, renaming);
        return () => onRenameStateChange?.(category.id, false);
    }, [category.id, onRenameStateChange, renaming]);

    const hasChildren = (category.children || []).length > 0;
    const directCourses = coursesByCategory[category.id] || [];
    const isSelected = category.id === selectedCategoryId;
    const isDropTarget = dropTargetCategoryId === category.id;
    const isDragging = draggingCategoryId === category.id;
    const totalCredits = sumCredits(category, coursesByCategory);
    const totalCourses = countCourses(category, coursesByCategory);
    const categoryCapabilities = getCategoryCapabilities?.(category, {
        depth,
        directCourses,
        hasChildren,
    }) || {};
    const canModify = canEdit && !disabled && categoryCapabilities.canEdit !== false;
    const canRename = showRenameAction && canModify && categoryCapabilities.canRename !== false;
    const canDelete = canModify && categoryCapabilities.canDelete !== false;
    const canDrag = canModify && categoryCapabilities.canDrag !== false;
    const canAddChild = !disabled && (categoryCapabilities.canAddChild ?? (
        canModify && depth + getSubtreeDepth(category) < maxDepth
    ));
    const categoryBadge = getCategoryBadge?.(category);
    const categoryLocked = Boolean(categoryCapabilities.locked);

    const confirmRename = () => {
        const nextName = nameValue.trim() || 'หมวดวิชาใหม่';
        const nextCode = codeValue.trim();
        onRenameCategory?.(category.id, allowCategoryCodeEdit
            ? { nameTh: nextName, code: nextCode }
            : nextName);
        setRenaming(false);
    };

    const cancelRename = () => {
        setNameValue(category.name || '');
        setCodeValue(category.code || '');
        setRenaming(false);
    };

    const handleRowClick = (event) => {
        event.stopPropagation();
        onSelectCategory?.(category);
    };

    const handleExpandClick = (event) => {
        event.stopPropagation();
        setExpanded(value => !value);
    };

    return (
        <div className="curriculum-structure-node">
            <div
                className={[
                    'curriculum-structure-row',
                    isSelected ? 'curriculum-structure-row--selected' : '',
                    isDragging ? 'curriculum-structure-row--dragging' : '',
                    isDropTarget ? 'curriculum-structure-row--drop-target' : '',
                ].filter(Boolean).join(' ')}
                style={{ '--depth': depth }}
                onClick={handleRowClick}
                draggable={canDrag && !renaming}
                onDragStart={event => onCategoryDragStart?.(event, category)}
                onDragOver={event => {
                    onCategoryDragOver?.(event, category);
                    onCourseCategoryDragOver?.(event, category);
                }}
                onDrop={event => {
                    onCategoryDrop?.(event, category);
                    onCourseCategoryDrop?.(event, category);
                }}
                onDragLeave={event => onCategoryDragLeave?.(event, category)}
                onDragEnd={onCategoryDragEnd}
            >
                <button
                    type="button"
                    className="curriculum-structure-row__expand"
                    onClick={handleExpandClick}
                    disabled={!hasChildren}
                    aria-label={expanded ? 'ย่อหมวดวิชา' : 'ขยายหมวดวิชา'}
                >
                    {hasChildren ? (expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />) : null}
                </button>

                {renaming ? (
                    <form
                        className="curriculum-structure-row__edit-fields"
                        onSubmit={event => {
                            event.preventDefault();
                            confirmRename();
                        }}
                        onPointerDown={event => event.stopPropagation()}
                        onClick={event => event.stopPropagation()}
                    >
                        {allowCategoryCodeEdit && (
                            <input
                                ref={codeInputRef}
                                className="curriculum-structure-row__code-input"
                                value={codeValue}
                                onChange={event => setCodeValue(event.target.value)}
                                aria-label="Category code"
                                placeholder="1.1"
                                onKeyDown={event => {
                                    if (event.key === 'Escape') {
                                        event.preventDefault();
                                        cancelRename();
                                    }
                                }}
                            />
                        )}
                        <input
                            ref={inputRef}
                            className="curriculum-structure-row__input"
                            value={nameValue}
                            onChange={event => setNameValue(event.target.value)}
                            onKeyDown={event => {
                                if (event.key === 'Escape') {
                                    event.preventDefault();
                                    cancelRename();
                                }
                            }}
                        />
                    </form>
                ) : (
                    <div className="curriculum-structure-row__main">
                        <span className="curriculum-structure-row__name">
                            {category.code ? `${category.code} ` : ''}
                            {category.name || <em>ยังไม่ตั้งชื่อ</em>}
                        </span>
                        {categoryBadge && (
                            <span className="curriculum-structure-origin-badge">{categoryBadge}</span>
                        )}
                        <span className="curriculum-structure-row__meta">
                            {totalCourses} วิชา · {totalCredits} หน่วยกิต
                        </span>
                    </div>
                )}

                {(canRename || canAddChild || canDelete || categoryLocked) && !renaming && (
                    <div
                        className="curriculum-structure-row__actions"
                        onPointerDown={event => event.stopPropagation()}
                        onClick={event => event.stopPropagation()}
                    >
                        {canRename && (
                        <button
                            type="button"
                            className="curriculum-structure-icon-btn"
                            onClick={() => setRenaming(true)}
                            title="แก้ไขชื่อหมวดวิชา"
                        >
                            <Pencil size={12} />
                        </button>
                        )}
                        {showInlineAddChild && canAddChild && (
                            <button
                                type="button"
                                className="curriculum-structure-icon-btn"
                                onClick={() => onAddChildCategory?.(category)}
                                disabled={!canAddChild}
                                title={!canAddChild ? addChildDisabledReason : addChildLabel}
                                aria-label={addChildLabel}
                            >
                                <Plus size={12} />
                            </button>
                        )}
                        {canDelete && (
                        <button
                            type="button"
                            className="curriculum-structure-icon-btn curriculum-structure-icon-btn--danger"
                            onClick={() => onDeleteCategory?.(category)}
                            title="ลบหมวดวิชา"
                        >
                            <Trash2 size={12} />
                        </button>
                        )}
                        {categoryLocked && (
                            <span className="curriculum-structure-row__lock" title="This category comes from the curriculum and is read-only">
                                <LockKeyhole size={12} />
                            </span>
                        )}
                    </div>
                )}
            </div>

            {expanded && directCourses.length > 0 && (
                <div className="curriculum-structure-courses" style={{ '--depth': depth }}>
                    {directCourses.map(course => {
                        const courseCapabilities = getCourseCapabilities?.(course, category) || {};
                        const canDragCourse = canEdit && !disabled && courseCapabilities.canDrag !== false;
                        const courseBadge = getCourseBadge?.(course, category);
                        const courseLocked = Boolean(courseCapabilities.locked);

                        return (
                        <div
                            key={course.id}
                            className={[
                                'curriculum-structure-course',
                                courseLocked ? 'curriculum-structure-course--locked' : '',
                                draggedCourseId === course.id ? 'curriculum-structure-course--dragging' : '',
                            ].filter(Boolean).join(' ')}
                            draggable={canDragCourse}
                            onClick={event => {
                                event.stopPropagation();
                                onSelectCategory?.(category);
                            }}
                            onDragStart={event => onCourseDragStart?.(event, { ...course, ownerCategoryId: category.id })}
                            onDragEnd={onCourseDragEnd}
                            title={`${course.code || '-'} ${course.nameTh || course.nameEn || 'ยังไม่มีชื่อวิชา'}`}
                        >
                            <span className="curriculum-structure-course__code">
                                {course.code || '-'}
                                {courseBadge && <span className="curriculum-structure-origin-badge">{courseBadge}</span>}
                                {courseLocked && <LockKeyhole className="curriculum-structure-course__lock" size={11} />}
                            </span>
                            <span className="curriculum-structure-course__name">{course.nameTh || course.nameEn || 'ยังไม่มีชื่อวิชา'}</span>
                            <span className="curriculum-structure-course__credits">{Number(course.credits) || 0}</span>
                        </div>
                        );
                    })}
                </div>
            )}

            {expanded && hasChildren && (
                <div className="curriculum-structure-children">
                    {category.children.map(child => (
                        <CategoryTreeNode
                            key={child.id}
                            category={child}
                            depth={depth + 1}
                            maxDepth={maxDepth}
                            selectedCategoryId={selectedCategoryId}
                            coursesByCategory={coursesByCategory}
                            disabled={disabled}
                            canEdit={canEdit}
                            draggingCategoryId={draggingCategoryId}
                            draggedCourseId={draggedCourseId}
                            dropTargetCategoryId={dropTargetCategoryId}
                            onSelectCategory={onSelectCategory}
                            onAddChildCategory={onAddChildCategory}
                            onRenameCategory={onRenameCategory}
                            onDeleteCategory={onDeleteCategory}
                            onCategoryDragStart={onCategoryDragStart}
                            onCategoryDragOver={onCategoryDragOver}
                            onCategoryDrop={onCategoryDrop}
                            onCategoryDragEnd={onCategoryDragEnd}
                            onCategoryDragLeave={onCategoryDragLeave}
                            onCourseCategoryDragOver={onCourseCategoryDragOver}
                            onCourseCategoryDrop={onCourseCategoryDrop}
                            onCourseDragStart={onCourseDragStart}
                            onCourseDragEnd={onCourseDragEnd}
                            onRenameStateChange={onRenameStateChange}
                            getCategoryCapabilities={getCategoryCapabilities}
                            getCourseCapabilities={getCourseCapabilities}
                            getCategoryBadge={getCategoryBadge}
                            getCourseBadge={getCourseBadge}
                            showInlineAddChild={showInlineAddChild}
                            allowCategoryCodeEdit={allowCategoryCodeEdit}
                            showRenameAction={showRenameAction}
                            addChildLabel={addChildLabel}
                            addChildDisabledReason={addChildDisabledReason}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export default function CurriculumStructureSidebar({
    categories = [],
    coursesByCategory = {},
    selectedCategoryId,
    showAllCourses = false,
    title = 'โครงสร้างหมวดวิชา',
    addLabel = 'หมวดวิชา',
    emptyText = 'กด "+ หมวดวิชา" เพื่อเริ่ม',
    showAllOption = false,
    disabled = false,
    clearSelectionDisabled = false,
    canEdit = true,
    addDisabled = false,
    showInlineAddChild = true,
    showRenameAction = true,
    addChildLabel = 'เพิ่มหมวดย่อย',
    addChildDisabledReason = 'สร้างหมวดย่อยได้สูงสุด 4 ระดับ',
    maxDepth = 3,
    draggingCategoryId = null,
    draggedCourseId = null,
    dropTargetCategoryId = null,
    onSelectCategory,
    onSelectAllCourses,
    onAddCategory,
    onAddChildCategory,
    onRenameCategory,
    onDeleteCategory,
    onCategoryRootDragOver,
    onCategoryRootDrop,
    onCategoryDragStart,
    onCategoryDragOver,
    onCategoryDrop,
    onCategoryDragEnd,
    onCategoryDragLeave,
    onCourseCategoryDragOver,
    onCourseCategoryDrop,
    onCourseDragStart,
    onCourseDragEnd,
    onRequestClearSelection,
    getCategoryCapabilities,
    getCourseCapabilities,
    getCategoryBadge,
    getCourseBadge,
    allowCategoryCodeEdit = false,
    headerActions = null,
}) {
    const allCourses = Object.values(coursesByCategory).flat();
    const allCredits = allCourses.reduce((sum, course) => sum + (Number(course.credits) || 0), 0);
    const renamingCategoryIdsRef = useRef(new Set());
    const skipClearSelectionRef = useRef(false);

    const handleRenameStateChange = useCallback((categoryId, isRenaming) => {
        const next = new Set(renamingCategoryIdsRef.current);
        if (isRenaming) {
            next.add(categoryId);
        } else {
            next.delete(categoryId);
        }
        renamingCategoryIdsRef.current = next;
    }, []);

    const handleTreePointerDown = useCallback((event) => {
        if (isTreeInteractionTarget(event.target)) {
            skipClearSelectionRef.current = false;
            return;
        }
        skipClearSelectionRef.current = clearSelectionDisabled || renamingCategoryIdsRef.current.size > 0;
    }, [clearSelectionDisabled]);

    const handleTreeClick = useCallback((event) => {
        if (isTreeInteractionTarget(event.target)) return;
        if (skipClearSelectionRef.current) {
            skipClearSelectionRef.current = false;
            return;
        }
        if (disabled || clearSelectionDisabled || renamingCategoryIdsRef.current.size > 0) return;
        onRequestClearSelection?.();
    }, [clearSelectionDisabled, disabled, onRequestClearSelection]);

    return (
        <div className="curriculum-structure-sidebar">
            <div className="curriculum-structure-sidebar__header">
                <span className="curriculum-structure-sidebar__title">{title}</span>
                {canEdit && (
                    <div className="curriculum-structure-sidebar__header-actions">
                        {headerActions}
                        <button
                            type="button"
                            className="course-btn course-btn--primary course-btn--sm"
                            onClick={onAddCategory}
                            disabled={disabled || addDisabled}
                        >
                            <Plus size={12} /> {addLabel}
                        </button>
                    </div>
                )}
            </div>

            <div
                className={[
                    'curriculum-structure-list',
                    dropTargetCategoryId === 'root' ? 'curriculum-structure-list--drop-target' : '',
                ].filter(Boolean).join(' ')}
                onPointerDown={handleTreePointerDown}
                onClick={handleTreeClick}
                onDragOver={onCategoryRootDragOver}
                onDrop={onCategoryRootDrop}
            >
                {showAllOption && (
                    <div
                        className={[
                            'curriculum-structure-row',
                            'curriculum-structure-row--all',
                            showAllCourses ? 'curriculum-structure-row--selected' : '',
                        ].filter(Boolean).join(' ')}
                        style={{ '--depth': 0 }}
                        onClick={event => {
                            event.stopPropagation();
                            onSelectAllCourses?.();
                        }}
                    >
                        <span className="curriculum-structure-row__expand">
                            <Layers size={14} />
                        </span>
                        <div className="curriculum-structure-row__main">
                            <span className="curriculum-structure-row__name">วิชาทั้งหมด</span>
                            <span className="curriculum-structure-row__meta">{allCourses.length} วิชา · {allCredits} หน่วยกิต</span>
                        </div>
                    </div>
                )}

                {categories.length === 0 ? (
                    <div className="curriculum-structure-empty">
                        <BookOpen size={20} />
                        <span>{emptyText}</span>
                        {canEdit && (
                            <button
                                type="button"
                                className="course-btn course-btn--primary course-btn--sm"
                                onClick={event => {
                                    event.stopPropagation();
                                    onAddCategory?.();
                                }}
                                disabled={disabled || addDisabled}
                            >
                                <Plus size={12} /> {addLabel}
                            </button>
                        )}
                    </div>
                ) : (
                    categories.map(category => (
                        <CategoryTreeNode
                            key={category.id}
                            category={category}
                            maxDepth={maxDepth}
                            selectedCategoryId={selectedCategoryId}
                            coursesByCategory={coursesByCategory}
                            disabled={disabled}
                            canEdit={canEdit}
                            draggingCategoryId={draggingCategoryId}
                            draggedCourseId={draggedCourseId}
                            dropTargetCategoryId={dropTargetCategoryId}
                            onSelectCategory={onSelectCategory}
                            onAddChildCategory={onAddChildCategory}
                            onRenameCategory={onRenameCategory}
                            onDeleteCategory={onDeleteCategory}
                            onCategoryDragStart={onCategoryDragStart}
                            onCategoryDragOver={onCategoryDragOver}
                            onCategoryDrop={onCategoryDrop}
                            onCategoryDragEnd={onCategoryDragEnd}
                            onCategoryDragLeave={onCategoryDragLeave}
                            onCourseCategoryDragOver={onCourseCategoryDragOver}
                            onCourseCategoryDrop={onCourseCategoryDrop}
                            onCourseDragStart={onCourseDragStart}
                            onCourseDragEnd={onCourseDragEnd}
                            onRenameStateChange={handleRenameStateChange}
                            getCategoryCapabilities={getCategoryCapabilities}
                            getCourseCapabilities={getCourseCapabilities}
                            getCategoryBadge={getCategoryBadge}
                            getCourseBadge={getCourseBadge}
                            showInlineAddChild={showInlineAddChild}
                            allowCategoryCodeEdit={allowCategoryCodeEdit}
                            showRenameAction={showRenameAction}
                            addChildLabel={addChildLabel}
                            addChildDisabledReason={addChildDisabledReason}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
