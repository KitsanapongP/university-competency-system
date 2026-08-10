'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { BookOpen, Plus, Settings2, TriangleAlert } from 'lucide-react';
import CurriculumCourseEditorPanel from '../../curriculum-management/components/CurriculumCourseEditorPanel';
import CurriculumStructureSidebar from '../../curriculum-management/components/CurriculumStructureSidebar';
import { getDisplayCourses } from '../../../../lib/curriculum-structure';
import { TemplateWeightSummary } from './CategoryCoursePanel';

function isLeafCategory(category) {
    return !category?.children?.length;
}

function allCourseCredits(courses) {
    return courses.reduce((total, course) => total + (Number(course.credits) || 0), 0);
}

function TemplateWorkspacePanel({
    title,
    hint,
    courseCount,
    totalCredits,
    summary = null,
    action = null,
    children,
}) {
    const ActionIcon = action?.icon;

    return (
        <div className="template-weight-editor">
            <div className="template-weight-editor__toolbar">
                <div>
                    <span className="template-weight-editor__category">{title}</span>
                    {hint && <span className="template-weight-editor__hint">{hint}</span>}
                </div>
                <div className="template-weight-editor__actions">
                    <div className="template-weight-editor__course-summary" aria-label={`รายการวิชา ${courseCount} วิชา หน่วยกิตรวม ${totalCredits}`}>
                        <span><BookOpen size={14} /> รายวิชา {courseCount} วิชา</span>
                        <span>หน่วยกิตรวม <strong>{totalCredits}</strong></span>
                    </div>
                    {summary}
                    {action && (
                        <button
                            type="button"
                            className="btn btn--primary btn--sm"
                            onClick={action.onClick}
                            disabled={action.disabled}
                            title={action.title}
                        >
                            {ActionIcon && <ActionIcon size={13} />} {action.label}
                        </button>
                    )}
                </div>
            </div>
            <div className="template-weight-editor__body">{children}</div>
        </div>
    );
}

function TemplateWeightToolbar({
    title,
    courseCount,
    totalCredits,
    categories,
    coursesByCategoryId,
    weightsByCourseId,
    competencies,
    onManageCompetencies,
}) {
    return (
        <div className="template-weight-editor__toolbar">
            <div>
                <span className="template-weight-editor__category">{title}</span>
                <span className="template-weight-editor__hint">
                    กำหนด Competency และน้ำหนักของแต่ละรายวิชา
                </span>
            </div>
            <div className="template-weight-editor__actions">
                <div className="template-weight-editor__course-summary" aria-label={`รายการวิชา ${courseCount} วิชา หน่วยกิตรวม ${totalCredits}`}>
                    <span><BookOpen size={14} /> รายวิชา {courseCount} วิชา</span>
                    <span>หน่วยกิตรวม <strong>{totalCredits}</strong></span>
                </div>
                <TemplateWeightSummary
                    categories={categories}
                    coursesByCategoryId={coursesByCategoryId}
                    weightsByCourseId={weightsByCourseId}
                    competencies={competencies}
                />
                <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    onClick={onManageCompetencies}
                >
                    <Settings2 size={13} /> จัดการสมรรถนะ
                </button>
            </div>
        </div>
    );
}

function TemplateWeightEditor({
    template,
    categories,
    selectedCategory,
    showAllCourses,
    coursesByCategoryId,
    weightsByCourseId,
    competencies,
    allCourses,
    onSetWeight,
    onManageCompetencies,
}) {
    const getCoursesForCategory = useCallback(
        category => coursesByCategoryId[category.id] || [],
        [coursesByCategoryId],
    );
    const selectedCourses = getDisplayCourses(
        categories,
        selectedCategory,
        false,
        getCoursesForCategory,
    );
    const selectedIsLeaf = isLeafCategory(selectedCategory);
    const weightColumnHeaders = competencies.map(competency => ({
        key: competency.id,
        label: `${competency.code || competency.name} 100%`,
        className: 'ss-th--weight',
        colClassName: 'curriculum-course-editor__col--extra',
    }));

    const renderWeightCells = (course) => competencies.map(competency => {
        const stored = weightsByCourseId?.[course.id]?.[competency.id] ?? 0;
        const isMapped = Number(stored) > 0;
        const isLocked = Boolean(template?.isActive) || !course.code || !course.nameTh;

        return (
            <td key={competency.id} className="ss-cell ss-cell--weight" style={{ '--wc': competency.color }}>
                <div className={`ss-weight-wrap ${isMapped ? 'ss-weight-wrap--active' : ''} ${isLocked ? 'ss-weight-wrap--locked' : ''}`}>
                    <input
                        className="ss-weight-input"
                        type="number"
                        min={0}
                        max={100}
                        value={Number(stored)}
                        disabled={isLocked}
                        title={isLocked ? 'Complete the course information before setting a weight' : `${competency.name} weight`}
                        onFocus={event => event.target.select()}
                        onChange={event => {
                            const raw = event.target.value;
                            const value = raw === '' ? 0 : Math.min(100, Math.max(0, parseInt(raw, 10) || 0));
                            onSetWeight?.(course.id, competency.id, value);
                        }}
                    />
                    {isMapped && <span className="ss-weight-pct">%</span>}
                </div>
            </td>
        );
    });

    if (showAllCourses) {
        return (
            <TemplateWorkspacePanel
                    title="วิชาทั้งหมด"
                    courseCount={allCourses.length}
                    totalCredits={allCourseCredits(allCourses)}
                    categories={categories}
                    coursesByCategoryId={coursesByCategoryId}
                    weightsByCourseId={weightsByCourseId}
                    competencies={competencies}
                    onManageCompetencies={onManageCompetencies}
                    summary={(
                        <TemplateWeightSummary
                            categories={categories}
                            coursesByCategoryId={coursesByCategoryId}
                            weightsByCourseId={weightsByCourseId}
                            competencies={competencies}
                        />
                    )}
                    action={{
                        label: 'จัดการสมรรถนะ',
                        icon: Settings2,
                        onClick: onManageCompetencies,
                    }}
                >
                    <CurriculumCourseEditorPanel
                        category={{ id: '__template_all_courses__', name: 'วิชาทั้งหมด' }}
                        courses={allCourses}
                        allCourses={allCourses}
                        categoryTotalCredits={allCourseCredits(allCourses)}
                        canEdit={false}
                        disabled={Boolean(template?.isActive)}
                        isLeafCategory={false}
                        isAllCoursesView
                        showCategoryToolbar={false}
                        showCourseActions={false}
                        allowSelection={false}
                        extraColumnHeaders={weightColumnHeaders}
                        renderExtraCells={renderWeightCells}
                    />
            </TemplateWorkspacePanel>
        );
    }

    if (!selectedCategory) {
        return (
            <div className="template-structure-empty">
                <BookOpen size={24} />
                <span>เลือกหมวดวิชาเพื่อกำหนด Competency และน้ำหนัก</span>
            </div>
        );
    }

    return (
        <TemplateWorkspacePanel
                title={`${selectedCategory.code ? `${selectedCategory.code} ` : ''}${selectedCategory.name}`}
                courseCount={selectedCourses.length}
                totalCredits={allCourseCredits(selectedCourses)}
                categories={categories}
                coursesByCategoryId={coursesByCategoryId}
                weightsByCourseId={weightsByCourseId}
                competencies={competencies}
                onManageCompetencies={onManageCompetencies}
                summary={(
                    <TemplateWeightSummary
                        categories={categories}
                        coursesByCategoryId={coursesByCategoryId}
                        weightsByCourseId={weightsByCourseId}
                        competencies={competencies}
                    />
                )}
                action={{
                    label: 'จัดการสมรรถนะ',
                    icon: Settings2,
                    onClick: onManageCompetencies,
                }}
            >
                <CurriculumCourseEditorPanel
                    category={selectedCategory}
                    courses={selectedCourses}
                    allCourses={allCourses}
                    categoryTotalCredits={allCourseCredits(selectedCourses)}
                    canEdit={false}
                    canEditCategoryMetadata={false}
                    canManageCourses={false}
                    allowExtraEditing={!template?.isActive}
                    allowSelection={false}
                    disabled={Boolean(template?.isActive)}
                    isLeafCategory={selectedIsLeaf}
                    getCourseCapabilities={() => ({
                        canEdit: false,
                        canSelect: false,
                        canDrag: false,
                    })}
                    showCategoryToolbar={false}
                    showCourseActions={false}
                    extraColumnHeaders={weightColumnHeaders}
                    renderExtraCells={renderWeightCells}
                />
        </TemplateWorkspacePanel>
    );
}

export default function TemplateStructureWorkspace({
    template,
    categories = [],
    selectedCategory,
    showAllCourses = false,
    coursesByCategoryId = {},
    weightsByCourseId = {},
    competencies = [],
    mode = 'setup',
    draggingCategoryId = null,
    draggedCourseId = null,
    dropTargetCategoryId = null,
    onSelectCategory,
    onDeselectCategory,
    onSelectAllCourses,
    onCreateCategory,
    onRenameCategory,
    onDeleteCategory,
    onAddCourse,
    onUpdateCourse,
    onDeleteCourse,
    onBulkDeleteCourses,
    onMoveCourse,
    onValidateCourse,
    onSetWeight,
    onManageCompetencies,
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
    const isSetupMode = mode === 'setup';
    const [addCourseRequestId, setAddCourseRequestId] = useState(0);
    const getCoursesForCategory = useCallback(
        category => coursesByCategoryId[category.id] || [],
        [coursesByCategoryId],
    );
    const allCourses = useMemo(
        () => getDisplayCourses(categories, null, true, getCoursesForCategory),
        [categories, getCoursesForCategory],
    );
    const editorCategory = showAllCourses
        ? { id: '__template_all_courses__', name: 'วิชาทั้งหมด' }
        : selectedCategory;
    const isAggregateCategoryView = Boolean(
        !showAllCourses && selectedCategory && !isLeafCategory(selectedCategory),
    );
    const editorCourses = useMemo(
        () => getDisplayCourses(categories, selectedCategory, showAllCourses, getCoursesForCategory),
        [categories, selectedCategory, showAllCourses, getCoursesForCategory],
    );
    const categoryTotalCredits = allCourseCredits(editorCourses);
    const canRequestCourse = Boolean(
        isSetupMode
        && !template?.isActive
        && !showAllCourses
        && selectedCategory
        && isLeafCategory(selectedCategory),
    );
    const setupPanelTitle = showAllCourses
        ? 'วิชาทั้งหมด'
        : selectedCategory
            ? `${selectedCategory.code ? `${selectedCategory.code} ` : ''}${selectedCategory.name}`
            : 'เลือกหมวดวิชา';
    const setupPanelHint = template?.isActive
        ? 'Template พร้อมใช้งานแล้ว จึงดูข้อมูลได้อย่างเดียว'
        : showAllCourses
            ? 'แสดงรายวิชาทั้งหมดใน Template ข้อมูลในมุมมองนี้แก้ไขไม่ได้'
            : !selectedCategory
                ? 'เลือกหมวดวิชาเพื่อจัดการรายวิชาเพิ่มเติมเฉพาะ Template'
                : isLeafCategory(selectedCategory)
                    ? 'เพิ่มและจัดการรายวิชาเพิ่มเติมเฉพาะ Template ได้ในหมวดนี้'
                    : 'หมวดนี้ใช้ดูรายวิชารวมจากหมวดย่อย เพิ่มรายวิชาได้เฉพาะหมวดย่อยที่สุด';
    const setupActionTitle = template?.isActive
        ? 'Template พร้อมใช้งานแล้ว จึงไม่สามารถแก้ไขรายวิชาได้'
        : canRequestCourse
            ? 'เพิ่มรายวิชา'
            : showAllCourses
                ? 'ไม่สามารถเพิ่มรายวิชาจากมุมมองวิชาทั้งหมดได้'
                : 'เลือกหมวดวิชาย่อยที่สุดก่อนเพิ่มรายวิชา';

    const getCategoryCapabilities = (category, { depth, directCourses }) => {
        const canAddChild = isSetupMode
            && !template?.isActive
            && directCourses.length === 0
            && depth < 3;

        if (category.fromMaster) {
            return {
                locked: true,
                canEdit: false,
                canRename: false,
                canDelete: false,
                canDrag: false,
                canAddChild,
            };
        }

        return {
            canEdit: isSetupMode && !template?.isActive,
            canRename: isSetupMode && !template?.isActive,
            canDelete: isSetupMode && !template?.isActive,
            canDrag: isSetupMode && !template?.isActive,
            canAddChild,
        };
    };

    const getCourseCapabilities = (course) => {
        if (course.fromMaster) {
            return {
                locked: true,
                canEdit: false,
                canSelect: false,
                canDrag: false,
            };
        }

        return {
            badge: 'เฉพาะ Template',
            canEdit: isSetupMode && !template?.isActive,
            canSelect: isSetupMode && !template?.isActive,
            canDrag: isSetupMode && !template?.isActive,
        };
    };

    const getEditorCourseCapabilities = (course) => {
        if (isAggregateCategoryView) {
            return {
                canEdit: false,
                canSelect: false,
                canDrag: false,
            };
        }
        return getCourseCapabilities(course);
    };

    if (!template) {
        return <div className="tm-panel template-structure-workspace"><div className="panel-empty">เลือก Template ก่อน</div></div>;
    }

    return (
        <div className="tm-panel template-structure-workspace">
            {template.isActive && (
                <div className="template-structure-workspace__active-warning">
                    <TriangleAlert size={18} />
                    <span><strong>Template พร้อมใช้งานแล้ว</strong> จึงแก้ไขโครงสร้างและน้ำหนักไม่ได้</span>
                </div>
            )}

            <div className="template-structure-workspace__panels">
                <div className="template-structure-workspace__sidebar">
                    <CurriculumStructureSidebar
                        categories={categories}
                        coursesByCategory={coursesByCategoryId}
                        selectedCategoryId={showAllCourses ? null : selectedCategory?.id}
                        showAllCourses={showAllCourses}
                        showAllOption
                        title="โครงสร้างหลักสูตร"
                        addLabel="เพิ่มหมวด"
                        emptyText="กด “เพิ่มหมวด” เพื่อเริ่มจัดโครงสร้าง Template"
                        disabled={Boolean(template.isActive)}
                        canEdit={isSetupMode}
                        maxDepth={3}
                        draggingCategoryId={draggingCategoryId}
                        draggedCourseId={draggedCourseId}
                        dropTargetCategoryId={dropTargetCategoryId}
                        onSelectCategory={onSelectCategory}
                        onSelectAllCourses={onSelectAllCourses}
                        onAddCategory={() => onCreateCategory?.(null)}
                        onAddChildCategory={category => onCreateCategory?.(category.id)}
                        onRenameCategory={(categoryId, name) => onRenameCategory?.(categoryId, name)}
                        onDeleteCategory={onDeleteCategory}
                        onCategoryRootDragOver={onCategoryRootDragOver}
                        onCategoryRootDrop={onCategoryRootDrop}
                        onCategoryDragStart={onCategoryDragStart}
                        onCategoryDragOver={onCategoryDragOver}
                        onCategoryDrop={onCategoryDrop}
                        onCategoryDragEnd={onCategoryDragEnd}
                        onCategoryDragLeave={onCategoryDragLeave}
                        onCourseCategoryDragOver={onCourseCategoryDragOver}
                        onCourseCategoryDrop={onCourseCategoryDrop}
                        onCourseDragStart={onCourseDragStart}
                        onCourseDragEnd={onCourseDragEnd}
                        onRequestClearSelection={onDeselectCategory}
                        getCategoryCapabilities={getCategoryCapabilities}
                        getCourseCapabilities={getCourseCapabilities}
                        getCategoryBadge={category => category.fromMaster ? '' : 'เฉพาะ Template'}
                        getCourseBadge={course => course.fromMaster ? '' : 'เฉพาะ Template'}
                    />
                </div>

                <div className="template-structure-workspace__content">
                    {isSetupMode ? (
                        <TemplateWorkspacePanel
                            title={setupPanelTitle}
                            hint={setupPanelHint}
                            courseCount={editorCourses.length}
                            totalCredits={categoryTotalCredits}
                            action={{
                                label: 'เพิ่มรายวิชา',
                                icon: Plus,
                                disabled: !canRequestCourse,
                                title: setupActionTitle,
                                onClick: () => setAddCourseRequestId(current => current + 1),
                            }}
                        >
                        <CurriculumCourseEditorPanel
                            category={editorCategory}
                            courses={editorCourses}
                            allCourses={allCourses}
                            categoryTotalCredits={categoryTotalCredits}
                            canEdit
                            disabled={Boolean(template.isActive)}
                            isLeafCategory={!showAllCourses && isLeafCategory(selectedCategory)}
                            isAllCoursesView={showAllCourses}
                            showCategoryToolbar={false}
                            showCourseSummary={false}
                            showAddCourseAction={false}
                            externalAddCourseRequestId={addCourseRequestId}
                            draggedCourseId={draggedCourseId}
                            canEditCategoryMetadata={Boolean(selectedCategory && !selectedCategory.fromMaster && isSetupMode && !isAggregateCategoryView)}
                            canManageCourses={isSetupMode}
                            allowSelection={!isAggregateCategoryView}
                            getCourseCapabilities={getEditorCourseCapabilities}
                            onRenameCategory={(categoryId, updates) => onRenameCategory?.(categoryId, updates.nameTh ?? updates.name ?? '')}
                            onDeleteCategory={onDeleteCategory}
                            onAddCourse={course => onAddCourse?.(selectedCategory?.id, course)}
                            onUpdateCourse={course => onUpdateCourse?.(selectedCategory?.id, course)}
                            onDeleteCourse={course => onDeleteCourse?.(selectedCategory?.id, course)}
                            onBulkDeleteCourses={courses => onBulkDeleteCourses?.(selectedCategory?.id, courses)}
                            onMoveCourse={onMoveCourse}
                            onValidateCourse={onValidateCourse}
                            onCourseDragStart={(event, course) => onCourseDragStart?.(event, {
                                ...course,
                                ownerCategoryId: selectedCategory?.id,
                            })}
                            onCourseDragEnd={onCourseDragEnd}
                        />
                        </TemplateWorkspacePanel>
                    ) : (
                        <TemplateWeightEditor
                            template={template}
                            categories={categories}
                            selectedCategory={selectedCategory}
                            showAllCourses={showAllCourses}
                            coursesByCategoryId={coursesByCategoryId}
                            weightsByCourseId={weightsByCourseId}
                            competencies={competencies}
                            allCourses={allCourses}
                            onSetWeight={onSetWeight}
                            onManageCompetencies={onManageCompetencies}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
