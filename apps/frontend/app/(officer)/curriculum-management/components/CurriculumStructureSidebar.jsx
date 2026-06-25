'use client';

import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, ChevronDown, ChevronRight, Layers, Pencil, Plus, Trash2 } from 'lucide-react';

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
}) {
    const [expanded, setExpanded] = useState(true);
    const [renaming, setRenaming] = useState(category.isNew || false);
    const [nameValue, setNameValue] = useState(category.name || '');
    const inputRef = useRef(null);

    useEffect(() => {
        if (renaming) inputRef.current?.focus();
    }, [renaming]);

    useEffect(() => {
        if (!renaming) setNameValue(category.name || '');
    }, [category.name, renaming]);

    const hasChildren = (category.children || []).length > 0;
    const directCourses = coursesByCategory[category.id] || [];
    const isSelected = category.id === selectedCategoryId;
    const isDropTarget = dropTargetCategoryId === category.id;
    const isDragging = draggingCategoryId === category.id;
    const totalCredits = sumCredits(category, coursesByCategory);
    const totalCourses = countCourses(category, coursesByCategory);
    const canAddChild = canEdit && !disabled && depth + getSubtreeDepth(category) < maxDepth;
    const canModify = canEdit && !disabled;

    const confirmRename = () => {
        const nextName = nameValue.trim() || 'หมวดวิชาใหม่';
        onRenameCategory?.(category.id, nextName);
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
                draggable={canModify && !renaming}
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
                    <input
                        ref={inputRef}
                        className="curriculum-structure-row__input"
                        value={nameValue}
                        onChange={event => setNameValue(event.target.value)}
                        onBlur={confirmRename}
                        onClick={event => event.stopPropagation()}
                        onKeyDown={event => {
                            if (event.key === 'Enter') confirmRename();
                            if (event.key === 'Escape') setRenaming(false);
                        }}
                    />
                ) : (
                    <div className="curriculum-structure-row__main">
                        <span className="curriculum-structure-row__name">
                            {category.code ? `${category.code} ` : ''}
                            {category.name || <em>ยังไม่ตั้งชื่อ</em>}
                        </span>
                        <span className="curriculum-structure-row__meta">
                            {totalCourses} วิชา · {totalCredits} หน่วยกิต
                        </span>
                    </div>
                )}

                {canModify && !renaming && (
                    <div className="curriculum-structure-row__actions" onClick={event => event.stopPropagation()}>
                        <button
                            type="button"
                            className="curriculum-structure-icon-btn"
                            onClick={() => setRenaming(true)}
                            title="แก้ไขชื่อหมวดวิชา"
                        >
                            <Pencil size={12} />
                        </button>
                        <button
                            type="button"
                            className="curriculum-structure-icon-btn"
                            onClick={() => onAddChildCategory?.(category)}
                            disabled={!canAddChild}
                            title="เพิ่มหมวดย่อย"
                        >
                            <Plus size={12} />
                        </button>
                        <button
                            type="button"
                            className="curriculum-structure-icon-btn curriculum-structure-icon-btn--danger"
                            onClick={() => onDeleteCategory?.(category)}
                            title="ลบหมวดวิชา"
                        >
                            <Trash2 size={12} />
                        </button>
                    </div>
                )}
            </div>

            {expanded && directCourses.length > 0 && (
                <div className="curriculum-structure-courses" style={{ '--depth': depth }}>
                    {directCourses.map(course => (
                        <div
                            key={course.id}
                            className={[
                                'curriculum-structure-course',
                                draggedCourseId === course.id ? 'curriculum-structure-course--dragging' : '',
                            ].filter(Boolean).join(' ')}
                            draggable={canModify}
                            onClick={event => {
                                event.stopPropagation();
                                onSelectCategory?.(category);
                            }}
                            onDragStart={event => onCourseDragStart?.(event, { ...course, ownerCategoryId: category.id })}
                            onDragEnd={onCourseDragEnd}
                            title={`${course.code || '-'} ${course.nameTh || course.nameEn || 'ยังไม่มีชื่อวิชา'}`}
                        >
                            <span className="curriculum-structure-course__code">{course.code || '-'}</span>
                            <span className="curriculum-structure-course__name">{course.nameTh || course.nameEn || 'ยังไม่มีชื่อวิชา'}</span>
                            <span className="curriculum-structure-course__credits">{Number(course.credits) || 0}</span>
                        </div>
                    ))}
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
    canEdit = true,
    addDisabled = false,
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
}) {
    const allCourses = Object.values(coursesByCategory).flat();
    const allCredits = allCourses.reduce((sum, course) => sum + (Number(course.credits) || 0), 0);

    return (
        <div className="curriculum-structure-sidebar">
            <div className="curriculum-structure-sidebar__header">
                <span className="curriculum-structure-sidebar__title">{title}</span>
                {canEdit && (
                    <button
                        type="button"
                        className="course-btn course-btn--primary course-btn--sm"
                        onClick={onAddCategory}
                        disabled={disabled || addDisabled}
                    >
                        <Plus size={12} /> {addLabel}
                    </button>
                )}
            </div>

            <div
                className={[
                    'curriculum-structure-list',
                    dropTargetCategoryId === 'root' ? 'curriculum-structure-list--drop-target' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => {
                    if (!showAllOption) onSelectCategory?.(null);
                }}
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
                        />
                    ))
                )}
            </div>
        </div>
    );
}
