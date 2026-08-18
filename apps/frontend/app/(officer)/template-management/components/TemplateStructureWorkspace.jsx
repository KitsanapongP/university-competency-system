'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { BookOpen, Plus, TriangleAlert } from 'lucide-react';
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

function getWorkspaceCopy(language) {
    if (language === 'en') {
        return {
            allCourses: 'All courses',
            selectCategoryTitle: 'Select a category',
            courseCount: 'courses',
            totalCredits: 'Total credits',
            weightHint: 'Set competency weights for each course',
            selectCategory: 'Select a category to set competencies and weights',
            manageTemplateCourses: 'Add and manage Template-only courses',
            manageLeafCourses: 'Add and manage Template-only courses in this category',
            aggregateCategory: 'This category shows courses from its subcategories. Add courses only to the deepest category.',
            allCoursesReadOnly: 'All courses are shown here for review. This view is read-only.',
            activeReadOnly: 'This assessment plan is active, so its structure is read-only.',
            setupHint: 'Select a category to manage Template-only courses',
            addCourse: 'Add course',
            addCategory: 'Add category',
            structureTitle: 'Curriculum structure',
            emptyStructure: 'Add a category to begin building the assessment plan structure',
            templateOnly: 'Template only',
            setupActiveWarning: 'so its additional structure cannot be edited.',
            courseInformationRequired: 'Complete the course information before setting a weight',
        };
    }

    return {
        allCourses: 'วิชาทั้งหมด',
        selectCategoryTitle: 'เลือกหมวดวิชา',
        courseCount: 'วิชา',
        totalCredits: 'หน่วยกิตรวม',
        weightHint: 'กำหนด Competency และน้ำหนักของแต่ละรายวิชา',
        selectCategory: 'เลือกหมวดวิชาเพื่อกำหนด Competency และน้ำหนัก',
        manageTemplateCourses: 'เพิ่มและจัดการรายวิชาเฉพาะ Template',
        manageLeafCourses: 'เพิ่มและจัดการรายวิชาเฉพาะ Template ได้ในหมวดนี้',
        aggregateCategory: 'หมวดนี้ใช้ดูรายวิชารวมจากหมวดย่อย เพิ่มรายวิชาได้เฉพาะหมวดย่อยที่สุด',
        allCoursesReadOnly: 'แสดงรายวิชาทั้งหมดใน Template ข้อมูลในมุมมองนี้แก้ไขไม่ได้',
        activeReadOnly: 'แบบแผนพร้อมใช้งานแล้ว จึงดูข้อมูลได้อย่างเดียว',
        setupHint: 'เลือกหมวดวิชาเพื่อจัดการรายวิชาเพิ่มเติมเฉพาะ Template',
        addCourse: 'เพิ่มรายวิชา',
        addCategory: 'เพิ่มหมวด',
        structureTitle: 'โครงสร้างหลักสูตร',
        emptyStructure: 'กด “เพิ่มหมวด” เพื่อเริ่มจัดโครงสร้างแบบแผนการประเมิน',
        templateOnly: 'เฉพาะ Template',
        setupActiveWarning: 'จึงแก้ไขโครงสร้างแบบแผนเพิ่มเติมไม่ได้',
        courseInformationRequired: 'กรอกข้อมูลรายวิชาให้ครบก่อนกำหนดน้ำหนัก',
    };
}

function TemplateWorkspacePanel({
    title,
    hint,
    courseCount,
    totalCredits,
    summary = null,
    action = null,
    language = 'th',
    children,
}) {
    const ActionIcon = action?.icon;
    const copy = getWorkspaceCopy(language);

    return (
        <div className="template-weight-editor">
            <div className="template-weight-editor__toolbar">
                <div className="template-weight-editor__heading">
                    <span className="template-weight-editor__category">{title}</span>
                    {hint && <span className="template-weight-editor__hint">{hint}</span>}
                </div>
                <div className="template-weight-editor__actions">
                    <div className="template-weight-editor__course-summary" aria-label={`${copy.courseCount} ${courseCount} ${copy.totalCredits} ${totalCredits}`}>
                        <span><BookOpen size={14} /> {copy.courseCount} {courseCount}</span>
                        <span>{copy.totalCredits} <strong>{totalCredits}</strong></span>
                    </div>
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
            {summary && (
                <div className="template-weight-editor__summary-strip">
                    {summary}
                </div>
            )}
            <div className="template-weight-editor__body">{children}</div>
        </div>
    );
}

function TemplateWeightEditor({
    categories,
    selectedCategory,
    showAllCourses,
    coursesByCategoryId,
    weightsByCourseId,
    competencies,
    allCourses,
    language,
    onSetWeight,
}) {
    const copy = getWorkspaceCopy(language);
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
    const courseTypeColumn = {
        key: '__course_type__',
        label: language === 'en' ? 'Course type' : 'ประเภทวิชา',
        className: 'ss-th--weight',
        colClassName: 'curriculum-course-editor__col--course-type',
    };
    const weightColumnHeaders = [courseTypeColumn, ...competencies.map((competency) => {
        const name = language === 'en'
            ? competency.nameEn || competency.nameTh || competency.name || competency.code
            : competency.nameTh || competency.name || competency.nameEn || competency.code;

        return {
            key: competency.id,
            label: `${name} 100%`,
            className: 'ss-th--weight',
            colClassName: 'curriculum-course-editor__col--extra',
        };
    })];

    const renderWeightCells = (course) => [
        <td key="course-type" className="ss-cell ss-cell--weight">
            <span className={`template-course-type-badge ${course.isCoreCourse ? 'template-course-type-badge--required' : 'template-course-type-badge--elective'}`}>
                {course.isCoreCourse
                    ? (language === 'en' ? 'Required' : 'วิชาบังคับ')
                    : (language === 'en' ? 'Elective' : 'วิชาเลือก')}
            </span>
        </td>,
        ...competencies.map(competency => {
        const stored = weightsByCourseId?.[course.id]?.[competency.id] ?? 0;
        const isMapped = Number(stored) > 0;
        const isLocked = !course.code || !course.nameTh;

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
                        title={isLocked ? copy.courseInformationRequired : `${language === 'en' ? competency.nameEn || competency.nameTh || competency.name : competency.nameTh || competency.nameEn || competency.name} weight`}
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
        }),
    ];

    if (showAllCourses) {
        return (
            <TemplateWorkspacePanel
                    title={copy.allCourses}
                    hint={copy.allCoursesReadOnly}
                    courseCount={allCourses.length}
                    totalCredits={allCourseCredits(allCourses)}
                    language={language}
                    summary={(
                        <TemplateWeightSummary
                            categories={categories}
                            coursesByCategoryId={coursesByCategoryId}
                            weightsByCourseId={weightsByCourseId}
                            competencies={competencies}
                            language={language}
                        />
                    )}
                >
                    <CurriculumCourseEditorPanel
                        category={{ id: '__template_all_courses__', name: 'วิชาทั้งหมด' }}
                        courses={allCourses}
                        allCourses={allCourses}
                        categoryTotalCredits={allCourseCredits(allCourses)}
                        canEdit={false}
                        disabled={false}
                        isLeafCategory={false}
                        isAllCoursesView
                        showCategoryToolbar={false}
                        showCourseActions={false}
                        showRowActionsColumn={false}
                        tableVariant="template-weight"
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
                <span>{copy.selectCategory}</span>
            </div>
        );
    }

    return (
        <TemplateWorkspacePanel
                title={`${selectedCategory.code ? `${selectedCategory.code} ` : ''}${selectedCategory.name}`}
                hint={isLeafCategory(selectedCategory) ? copy.manageLeafCourses : copy.aggregateCategory}
                courseCount={selectedCourses.length}
                totalCredits={allCourseCredits(selectedCourses)}
                language={language}
                summary={(
                    <TemplateWeightSummary
                        categories={categories}
                        coursesByCategoryId={coursesByCategoryId}
                        weightsByCourseId={weightsByCourseId}
                        competencies={competencies}
                        language={language}
                    />
                )}
            >
                <CurriculumCourseEditorPanel
                    category={selectedCategory}
                    courses={selectedCourses}
                    allCourses={allCourses}
                    categoryTotalCredits={allCourseCredits(selectedCourses)}
                    canEdit={false}
                    canEditCategoryMetadata={false}
                    canManageCourses={false}
                    allowExtraEditing={false}
                    allowSelection={false}
                    disabled={false}
                    isLeafCategory={selectedIsLeaf}
                    getCourseCapabilities={() => ({
                        canEdit: false,
                        canSelect: false,
                        canDrag: false,
                    })}
                    showCategoryToolbar={false}
                    showCourseActions={false}
                    showRowActionsColumn={false}
                    tableVariant="template-weight"
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
    language = 'th',
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
    const copy = getWorkspaceCopy(language);
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
        ? copy.allCourses
        : selectedCategory
            ? `${selectedCategory.code ? `${selectedCategory.code} ` : ''}${selectedCategory.name}`
            : copy.selectCategoryTitle;
    const setupPanelHint = template?.isActive
        ? copy.activeReadOnly
        : showAllCourses
            ? copy.allCoursesReadOnly
            : !selectedCategory
                ? copy.setupHint
                : isLeafCategory(selectedCategory)
                    ? copy.manageLeafCourses
                    : copy.aggregateCategory;
    const setupActionTitle = template?.isActive
        ? copy.activeReadOnly
        : canRequestCourse
            ? copy.addCourse
            : showAllCourses
                ? copy.allCoursesReadOnly
                : copy.aggregateCategory;

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
        return <div className="tm-panel template-structure-workspace"><div className="panel-empty">{language === 'en' ? 'Select an assessment plan first' : 'เลือกแบบแผนการประเมินก่อน'}</div></div>;
    }

    return (
        <div className="tm-panel template-structure-workspace">
            {isSetupMode && template.isActive && (
                <div className="template-structure-workspace__active-warning">
                    <TriangleAlert size={18} />
                    <span><strong>{language === 'en' ? 'Assessment plan is active' : 'แบบแผนพร้อมใช้งานแล้ว'}</strong> {copy.setupActiveWarning}</span>
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
                        title={copy.structureTitle}
                        addLabel={copy.addCategory}
                        emptyText={copy.emptyStructure}
                        disabled={false}
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
                         getCategoryBadge={category => category.fromMaster ? '' : copy.templateOnly}
                         getCourseBadge={course => course.fromMaster ? '' : copy.templateOnly}
                    />
                </div>

                <div className="template-structure-workspace__content">
                    {isSetupMode ? (
                        <TemplateWorkspacePanel
                            title={setupPanelTitle}
                            hint={setupPanelHint}
                            courseCount={editorCourses.length}
                            totalCredits={categoryTotalCredits}
                            language={language}
                            action={{
                                label: copy.addCourse,
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
                            categories={categories}
                            selectedCategory={selectedCategory}
                            showAllCourses={showAllCourses}
                            coursesByCategoryId={coursesByCategoryId}
                            weightsByCourseId={weightsByCourseId}
                        competencies={competencies}
                            allCourses={allCourses}
                            language={language}
                        onSetWeight={onSetWeight}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
