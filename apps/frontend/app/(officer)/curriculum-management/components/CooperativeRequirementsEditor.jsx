'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, LoaderCircle, Pencil, Plus, Save, Send, Trash2 } from 'lucide-react';
import ConfirmActionModal from '../../../../components/ui/ConfirmActionModal';
import { useLanguage } from '../../../../providers/LanguageContext';
import {
    fetchCooperativeRequirements,
    publishCooperativeRequirements,
    saveCooperativeRequirementsDraft,
} from '../../../../lib/cooperative-readiness';
import './CooperativeRequirementsEditor.css';

const CRITERION_TYPES = [
    'overall_gpa',
    'category_gpa',
    'course_grade',
    'category_credits',
    'free_elective_credits',
];

const LETTER_GRADES = ['A', 'B+', 'B', 'C+', 'C', 'D+', 'D'];

function flattenCategories(nodes, language, level = 0, result = [], parentPath = []) {
    for (const category of nodes || []) {
        if (!category.isActive) continue;
        const name = language === 'en'
            ? category.nameEn || category.name
            : category.name || category.nameEn;
        const path = [...parentPath, name].filter(Boolean);
        result.push({
            id: String(category.id),
            label: `${'— '.repeat(level)}${name || ''}`,
            path: path.join(' / '),
        });
        flattenCategories(category.children, language, level + 1, result, path);
    }
    return result;
}

function flattenCourses(nodes, language, result = [], seen = new Set()) {
    for (const category of nodes || []) {
        if (category.isActive) {
            for (const course of category.courses || []) {
                if (!course.isActive || seen.has(String(course.courseId))) continue;
                seen.add(String(course.courseId));
                const courseName = language === 'en'
                    ? course.nameEn || course.nameTh
                    : course.nameTh || course.nameEn;
                result.push({
                    id: String(course.courseId),
                    code: course.code || '',
                    name: courseName || '',
                    gradeScheme: course.gradeScheme || 'letter',
                });
            }
            flattenCourses(category.children, language, result, seen);
        }
    }
    return result;
}

function newRequirement(id) {
    return {
        clientId: id,
        requirementId: 0,
        criterionType: '',
        nameTh: '',
        nameEn: '',
        minimumValue: '',
        minimumGrade: '',
        categoryId: '',
        courseId: '',
    };
}

function withClientIds(requirements, makeId) {
    return (requirements || []).map((item) => ({
        ...item,
        clientId: makeId(),
    }));
}

function criterionTitle(type, t) {
    return t(`coop_requirements_type_${type}`);
}

function requirementCountLabel(count, isDraft, t) {
    const quantity = count === 1 ? 'one' : 'many';
    const kind = isDraft ? 'draft_count' : 'count';
    return t(`coop_requirements_${kind}_${quantity}`).replace('{count}', count);
}

function localizedValue(valueEn, valueTh, language, fallback = '-') {
    const english = String(valueEn || '').trim();
    const thai = String(valueTh || '').trim();
    return language === 'en' ? english || thai || fallback : thai || english || fallback;
}

function requirementScope(requirement, categories, courses, t) {
    if (requirement.criterionType === 'overall_gpa') {
        return t('coop_requirements_scope_overall_gpa');
    }

    if (requirement.criterionType.startsWith('category_')) {
        const category = categories.find((item) => item.id === requirement.categoryId);
        if (!category) return t('coop_requirements_scope_missing_category');
        return t('coop_requirements_scope_category')
            .replace('{category}', category.path);
    }

    if (requirement.criterionType === 'course_grade') {
        const course = courses.find((item) => item.id === requirement.courseId);
        if (!course) return t('coop_requirements_scope_missing_course');
        return [course.code, course.name].filter(Boolean).join(' · ');
    }

    if (requirement.criterionType === 'free_elective_credits') {
        return t('coop_requirements_scope_free_electives');
    }

    return '-';
}

function formatRequirementValue(value, isGpa, language) {
    if (value === '' || value == null || !Number.isFinite(Number(value))) return '-';
    const locale = language === 'en' ? 'en-US' : 'th-TH';
    return new Intl.NumberFormat(locale, {
        maximumFractionDigits: 2,
        minimumFractionDigits: isGpa ? 2 : 0,
        useGrouping: true,
    }).format(Number(value));
}

function requirementThreshold(requirement, course, language, t) {
    if (requirement.criterionType === 'course_grade') {
        const key = course?.gradeScheme === 'satisfactory'
            ? 'coop_requirements_threshold_satisfactory'
            : 'coop_requirements_threshold_letter_grade';
        return t(key).replace('{grade}', requirement.minimumGrade || '-');
    }

    const isGpa = requirement.criterionType.includes('gpa');
    const value = formatRequirementValue(requirement.minimumValue, isGpa, language);
    const key = isGpa
        ? 'coop_requirements_threshold_gpa'
        : 'coop_requirements_threshold_credits';
    return t(key).replace('{value}', value);
}

function validateRequirementRows(requirements) {
    const errors = {};
    const configured = requirements.filter((item) => item.criterionType);
    if (!requirements.length) {
        return { errors, message: 'empty' };
    }

    for (const item of configured) {
        const rowErrors = {};
        if (!item.nameTh.trim()) rowErrors.nameTh = true;
        if (item.criterionType.includes('category_') && !item.categoryId) rowErrors.categoryId = true;
        if (item.criterionType === 'course_grade' && !item.courseId) rowErrors.courseId = true;
        if (item.criterionType === 'course_grade' && !item.minimumGrade) rowErrors.minimumGrade = true;
        if (item.criterionType !== 'course_grade') {
            const minimum = Number(item.minimumValue);
            if (item.minimumValue === '' || !Number.isFinite(minimum) || minimum < 0) {
                rowErrors.minimumValue = true;
            }
            if (item.criterionType.includes('gpa') && minimum > 4) rowErrors.minimumValue = true;
        }
        if (Object.keys(rowErrors).length) errors[item.clientId] = rowErrors;
    }
    for (const item of requirements.filter((requirement) => !requirement.criterionType)) {
        errors[item.clientId] = { criterionType: true };
    }
    return {
        errors,
        message: !configured.length || Object.keys(errors).length ? 'invalid' : '',
    };
}

export default function CooperativeRequirementsEditor({ curriculum, onDirtyChange }) {
    const { language, t } = useLanguage();
    const nextClientId = useRef(1);
    const translateRef = useRef(t);
    const [draft, setDraft] = useState(null);
    const [published, setPublished] = useState(null);
    const [requirements, setRequirements] = useState([]);
    const [editing, setEditing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadedSemester, setLoadedSemester] = useState(null);
    const [saving, setSaving] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [fieldErrors, setFieldErrors] = useState({});
    const [publishConfirmation, setPublishConfirmation] = useState(false);
    const [pendingSemester, setPendingSemester] = useState(null);
    const [semesterChangeConfirmation, setSemesterChangeConfirmation] = useState(false);
    const [semester, setSemester] = useState(1);

    translateRef.current = t;

    const makeClientId = () => {
        nextClientId.current += 1;
        return `cooperative-requirement-${nextClientId.current}`;
    };
    const categories = useMemo(
        () => flattenCategories(curriculum?.categories || [], language),
        [curriculum?.categories, language],
    );
    const courses = useMemo(
        () => flattenCourses(curriculum?.categories || [], language),
        [curriculum?.categories, language],
    );

    useEffect(() => {
        let active = true;
        setLoading(true);
        setError('');
        setMessage('');
        setDraft(null);
        setPublished(null);
        setRequirements([]);
        setEditing(false);
        setHasUnsavedChanges(false);
        onDirtyChange?.(false);
        fetchCooperativeRequirements(curriculum.curriculumId || curriculum.id, semester)
            .then((data) => {
                if (!active) return;
                setDraft(data.draft);
                setPublished(data.published);
                const initialSet = data.draft || data.published;
                setRequirements(withClientIds(initialSet?.requirements, makeClientId));
                setEditing(Boolean(data.draft));
                onDirtyChange?.(false);
            })
            .catch(() => {
                if (active) setError(translateRef.current('coop_requirements_load_error'));
            })
            .finally(() => {
                if (active) {
                    setLoadedSemester(semester);
                    setLoading(false);
                }
            });
        return () => {
            active = false;
        };
    }, [curriculum.curriculumId, curriculum.id, semester, onDirtyChange]);

    const switchSemester = (nextSemester) => {
        setLoading(true);
        setLoadedSemester(null);
        setDraft(null);
        setPublished(null);
        setRequirements([]);
        setEditing(false);
        setError('');
        setMessage('');
        setFieldErrors({});
        setHasUnsavedChanges(false);
        onDirtyChange?.(false);
        setSemester(nextSemester);
    };

    const requestSemesterChange = (nextSemester) => {
        if (nextSemester === semester || loading || saving) return;
        if (hasUnsavedChanges) {
            setPendingSemester(nextSemester);
            setSemesterChangeConfirmation(true);
            return;
        }
        switchSemester(nextSemester);
    };

    const confirmSemesterChange = () => {
        if (!pendingSemester) return;
        setSemesterChangeConfirmation(false);
        switchSemester(pendingSemester);
        setPendingSemester(null);
    };

    const cancelSemesterChange = () => {
        setSemesterChangeConfirmation(false);
        setPendingSemester(null);
    };

    const startEditing = () => {
        const current = draft || published;
        setRequirements(withClientIds(current?.requirements, makeClientId));
        setEditing(true);
        setError('');
        setMessage('');
        setHasUnsavedChanges(false);
        onDirtyChange?.(false);
    };

    const updateRequirement = (clientId, patch) => {
        setRequirements((current) => current.map((item) => (
            item.clientId === clientId ? { ...item, ...patch } : item
        )));
        setFieldErrors((current) => ({ ...current, [clientId]: {} }));
        setError('');
        setMessage('');
        setHasUnsavedChanges(true);
        onDirtyChange?.(true);
    };

    const handleTypeChange = (clientId, criterionType) => {
        updateRequirement(clientId, {
            criterionType,
            minimumValue: '',
            minimumGrade: '',
            categoryId: '',
            courseId: '',
        });
    };

    const handleAddRequirement = () => {
        setRequirements((current) => [...current, newRequirement(makeClientId())]);
        setEditing(true);
        setMessage('');
        setHasUnsavedChanges(true);
        onDirtyChange?.(true);
    };

    const handleRemoveRequirement = (clientId) => {
        setRequirements((current) => current.filter((item) => item.clientId !== clientId));
        setFieldErrors((current) => {
            const next = { ...current };
            delete next[clientId];
            return next;
        });
        setHasUnsavedChanges(true);
        onDirtyChange?.(true);
    };

    const handleCancelEditing = () => {
        const current = draft || published;
        setRequirements(withClientIds(current?.requirements, makeClientId));
        setEditing(Boolean(draft));
        setError('');
        setMessage('');
        setFieldErrors({});
        setHasUnsavedChanges(false);
        onDirtyChange?.(false);
    };

    const handleSaveDraft = async () => {
        setSaving(true);
        setError('');
        setMessage('');
        try {
            const data = await saveCooperativeRequirementsDraft(
                curriculum.curriculumId || curriculum.id,
                semester,
                requirements,
            );
            setDraft(data.draft);
            setPublished(data.published);
            setRequirements(withClientIds(data.draft?.requirements, makeClientId));
            setEditing(true);
            setHasUnsavedChanges(false);
            onDirtyChange?.(false);
            setMessage(t('coop_requirements_save_success'));
        } catch {
            setError(t('coop_requirements_save_error'));
        } finally {
            setSaving(false);
        }
    };

    const handleRequestPublish = () => {
        const validation = validateRequirementRows(requirements);
        setFieldErrors(validation.errors);
        if (validation.message) {
            setError(validation.message === 'empty'
                ? t('coop_requirements_empty_draft')
                : t('coop_requirements_publish_error'));
            return;
        }
        setPublishConfirmation(true);
    };

    const handlePublish = async () => {
        setSaving(true);
        setPublishConfirmation(false);
        setError('');
        try {
            const data = await publishCooperativeRequirements(curriculum.curriculumId || curriculum.id, semester);
            setDraft(data.draft);
            setPublished(data.published);
            setRequirements(withClientIds(data.published?.requirements, makeClientId));
            setEditing(false);
            setFieldErrors({});
            setHasUnsavedChanges(false);
            onDirtyChange?.(false);
            setMessage(t('coop_requirements_publish_success'));
        } catch {
            setError(t('coop_requirements_publish_error'));
        } finally {
            setSaving(false);
        }
    };

    const isLoadingSemester = loading || loadedSemester !== semester;
    const semesterLabel = t(semester === 1 ? 'learner_semester_one' : 'learner_semester_two');
    const publishMessage = t('coop_requirements_confirm_message').replace('{semester}', semesterLabel);
    const publishHint = t('coop_requirements_confirm_hint').replace('{semester}', semesterLabel);
    const visibleRequirementCount = editing
        ? requirements.length
        : published?.requirements?.length || 0;

    return (
        <section className="coop-requirements" aria-labelledby="coop-requirements-title">
            <header className="coop-requirements__header">
                <div>
                    <h2 id="coop-requirements-title">{t('coop_requirements_title')}</h2>
                    <p>{t('coop_requirements_description')}</p>
                </div>
            </header>

            <div className="coop-requirements__semester-tabs" role="tablist" aria-label={t('coop_requirements_semester_label')}>
                {[1, 2].map((term) => (
                    <button
                        key={term}
                        id={`coop-requirements-semester-${term}`}
                        type="button"
                        role="tab"
                        aria-selected={semester === term}
                        aria-controls="coop-requirements-semester-panel"
                        className={`coop-requirements__semester-tab ${semester === term ? 'coop-requirements__semester-tab--active' : ''}`}
                        onClick={() => requestSemesterChange(term)}
                        disabled={isLoadingSemester || saving}
                    >
                        {t(term === 1 ? 'learner_semester_one' : 'learner_semester_two')}
                    </button>
                ))}
            </div>

            <div className="coop-requirements__semester-summary">
                <div className="coop-requirements__semester-summary-main">
                    <div className="coop-requirements__semester-summary-heading">
                        <h3>{semesterLabel}</h3>
                        {!isLoadingSemester && (
                            <span className="coop-requirements__count">
                                {requirementCountLabel(visibleRequirementCount, editing, t)}
                            </span>
                        )}
                    </div>
                    {!isLoadingSemester && (
                        <div className="coop-requirements__badges">
                            {published && (
                                <span className="coop-requirements__badge coop-requirements__badge--published">
                                    <Check size={14} aria-hidden="true" />
                                    {t('coop_requirements_published')} · {t('coop_requirements_revision')}
                                    {' '}{published.revision}
                                </span>
                            )}
                            {!published && (
                                <span className="coop-requirements__badge coop-requirements__badge--missing">
                                    {t('coop_requirements_no_active_set')}
                                </span>
                            )}
                            {draft && (
                                <span className="coop-requirements__badge coop-requirements__badge--draft">
                                    {t('coop_requirements_draft')} · {t('coop_requirements_revision')}
                                    {' '}{draft.revision}
                                </span>
                            )}
                        </div>
                    )}
                </div>
                {!isLoadingSemester && !editing && (
                    <button
                        type="button"
                        className="course-btn course-btn--primary coop-requirements__primary-action"
                        onClick={startEditing}
                    >
                        {published ? (
                            <Pencil size={16} aria-hidden="true" />
                        ) : (
                            <Plus size={16} aria-hidden="true" />
                        )}
                        {published
                            ? t('coop_requirements_edit')
                            : t('coop_requirements_define')}
                    </button>
                )}
            </div>

            <div
                id="coop-requirements-semester-panel"
                role="tabpanel"
                aria-labelledby={`coop-requirements-semester-${semester}`}
            >
                {isLoadingSemester ? (
                    <div className="coop-requirements__state" role="status">
                        {t('coop_requirements_loading')}
                    </div>
                ) : (
                    <>
                        {!published && !editing && !error && (
                            <div className="coop-requirements__empty">
                                <p>{t('coop_requirements_not_configured')}</p>
                            </div>
                        )}

                        {!editing && published && (
                            <div className="coop-requirements__list">
                                <table className="coop-requirements__summary-table">
                                    <caption className="coop-requirements__sr-only">
                                        {t('coop_requirements_summary_caption')}
                                    </caption>
                                    <thead>
                                        <tr>
                                            <th scope="col">{t('coop_requirements_column_number')}</th>
                                            <th scope="col">{t('coop_requirements_column_name')}</th>
                                            <th scope="col">{t('coop_requirements_column_scope')}</th>
                                            <th scope="col">{t('coop_requirements_column_threshold')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {published.requirements.map((item, index) => {
                                            const selectedCourse = courses.find(
                                                (course) => course.id === item.courseId,
                                            );

                                            return (
                                                <tr key={item.requirementId}>
                                                    <th
                                                        scope="row"
                                                        data-label={t('coop_requirements_column_number')}
                                                    >
                                                        {index + 1}
                                                    </th>
                                                    <td data-label={t('coop_requirements_column_name')}>
                                                        <strong>
                                                            {localizedValue(
                                                                item.nameEn,
                                                                item.nameTh,
                                                                language,
                                                                criterionTitle(item.criterionType, t),
                                                            )}
                                                        </strong>
                                                    </td>
                                                    <td data-label={t('coop_requirements_column_scope')}>
                                                        {requirementScope(item, categories, courses, t)}
                                                    </td>
                                                    <td data-label={t('coop_requirements_column_threshold')}>
                                                        {requirementThreshold(item, selectedCourse, language, t)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {editing && (
                            <>
                                {published && (
                                    <div className="coop-requirements__current-note">
                                        <Check size={16} aria-hidden="true" />
                                        <span>{publishHint}</span>
                                    </div>
                                )}

                                {requirements.length === 0 && (
                                    <p className="coop-requirements__empty-inline">
                                        {t('coop_requirements_empty_draft')}
                                    </p>
                                )}

                                <div className="coop-requirements__rows">
                                    {requirements.map((requirement) => (
                                        <RequirementRow
                                            key={requirement.clientId}
                                            requirement={requirement}
                                            categories={categories}
                                            courses={courses}
                                            errors={fieldErrors[requirement.clientId] || {}}
                                            saving={saving}
                                            t={t}
                                            onChange={updateRequirement}
                                            onTypeChange={handleTypeChange}
                                            onRemove={handleRemoveRequirement}
                                        />
                                    ))}
                                </div>

                                <div className="coop-requirements__add-action">
                                    <button
                                        type="button"
                                        className="course-btn coop-requirements__add-button"
                                        onClick={handleAddRequirement}
                                        disabled={saving}
                                    >
                                        <Plus size={16} aria-hidden="true" />
                                        {t('coop_requirements_add')}
                                    </button>
                                </div>

                                {error && (
                                    <p className="coop-requirements__alert" role="alert">
                                        {error}
                                    </p>
                                )}
                                {message && (
                                    <p className="coop-requirements__success" role="status">
                                        {message}
                                    </p>
                                )}

                                <footer className="coop-requirements__actions">
                                    <button
                                        type="button"
                                        className="course-btn coop-requirements__cancel-button"
                                        onClick={handleCancelEditing}
                                        disabled={saving}
                                    >
                                        {t('coop_requirements_cancel')}
                                    </button>
                                    <button
                                        type="button"
                                        className="course-btn coop-requirements__save-draft-button"
                                        onClick={handleSaveDraft}
                                        disabled={saving}
                                    >
                                        {saving ? (
                                            <LoaderCircle
                                                size={16}
                                                className="coop-requirements__spin"
                                                aria-hidden="true"
                                            />
                                        ) : (
                                            <Save size={16} aria-hidden="true" />
                                        )}
                                        {t('coop_requirements_save_draft')}
                                    </button>
                                    <button
                                        type="button"
                                        className="course-btn course-btn--primary"
                                        onClick={handleRequestPublish}
                                        disabled={saving}
                                    >
                                        <Send size={16} aria-hidden="true" />
                                        {t('coop_requirements_publish')}
                                    </button>
                                </footer>
                            </>
                        )}

                        {!editing && error && (
                            <p className="coop-requirements__alert" role="alert">
                                {error}
                            </p>
                        )}
                        {!editing && message && (
                            <p className="coop-requirements__success" role="status">
                                {message}
                            </p>
                        )}
                    </>
            )}
            </div>

            <ConfirmActionModal
                open={publishConfirmation}
                title={t('coop_requirements_confirm_title')}
                message={publishMessage}
                hint={publishHint}
                confirmLabel={t('coop_requirements_publish')}
                cancelLabel={t('curriculum_cancel')}
                loading={saving}
                onConfirm={handlePublish}
                onCancel={() => setPublishConfirmation(false)}
            />

            <ConfirmActionModal
                open={semesterChangeConfirmation}
                title={t('coop_requirements_discard_semester_title')}
                message={t('coop_requirements_discard_semester_message')}
                hint={t('coop_requirements_discard_semester_hint')}
                confirmLabel={t('coop_requirements_discard_semester_confirm')}
                cancelLabel={t('curriculum_cancel')}
                onConfirm={confirmSemesterChange}
                onCancel={cancelSemesterChange}
            />
        </section>
    );
}

function RequirementRow({
    requirement,
    categories,
    courses,
    errors,
    saving,
    t,
    onChange,
    onTypeChange,
    onRemove,
}) {
    const selectedCourse = courses.find((course) => course.id === requirement.courseId);
    const allowedGrades = selectedCourse?.gradeScheme === 'satisfactory'
        ? ['S']
        : LETTER_GRADES;
    const errorId = (field) => `${requirement.clientId}-${field}-error`;
    const invalidProps = (field) => errors[field]
        ? { 'aria-invalid': true, 'aria-describedby': errorId(field) }
        : {};

    return (
        <article className="coop-requirements__row">
            <div className="coop-requirements__row-heading">
                <strong>
                    {requirement.criterionType
                        ? criterionTitle(requirement.criterionType, t)
                        : t('coop_requirements_type')}
                </strong>
                <button
                    type="button"
                    className="course-icon-btn course-icon-btn--danger"
                    title={t('coop_requirements_remove')}
                    aria-label={t('coop_requirements_remove')}
                    onClick={() => onRemove(requirement.clientId)}
                    disabled={saving}
                >
                    <Trash2 size={16} aria-hidden="true" />
                </button>
            </div>

            <div className="coop-requirements__grid">
                <Field
                    label={t('coop_requirements_type')}
                    error={errors.criterionType}
                    errorId={errorId('criterionType')}
                    errorMessage={t('coop_requirements_field_invalid')}
                >
                    <select
                        value={requirement.criterionType}
                        onChange={(event) => onTypeChange(requirement.clientId, event.target.value)}
                        disabled={saving}
                        {...invalidProps('criterionType')}
                    >
                        <option value="">{t('coop_requirements_type')}</option>
                        {CRITERION_TYPES.map((type) => (
                            <option key={type} value={type}>
                                {criterionTitle(type, t)}
                            </option>
                        ))}
                    </select>
                </Field>

                <Field
                    label={t('coop_requirements_name_th')}
                    error={errors.nameTh}
                    errorId={errorId('nameTh')}
                    errorMessage={t('coop_requirements_field_invalid')}
                >
                    <input
                        value={requirement.nameTh}
                        onChange={(event) => onChange(requirement.clientId, { nameTh: event.target.value })}
                        disabled={saving}
                        {...invalidProps('nameTh')}
                    />
                </Field>

                <Field label={t('coop_requirements_name_en')}>
                    <input
                        value={requirement.nameEn}
                        onChange={(event) => onChange(requirement.clientId, { nameEn: event.target.value })}
                        disabled={saving}
                    />
                </Field>

                {requirement.criterionType.includes('category_') && (
                    <Field
                        label={t('coop_requirements_category')}
                        error={errors.categoryId}
                        errorId={errorId('categoryId')}
                        errorMessage={t('coop_requirements_field_invalid')}
                    >
                        <select
                            value={requirement.categoryId}
                            onChange={(event) => onChange(requirement.clientId, { categoryId: event.target.value })}
                            disabled={saving}
                            {...invalidProps('categoryId')}
                        >
                            <option value="">{t('coop_requirements_category')}</option>
                            {categories.map((category) => (
                                <option key={category.id} value={category.id}>
                                    {category.label}
                                </option>
                            ))}
                        </select>
                    </Field>
                )}

                {requirement.criterionType === 'course_grade' && (
                    <>
                        <Field
                            label={t('coop_requirements_course')}
                            error={errors.courseId}
                            errorId={errorId('courseId')}
                            errorMessage={t('coop_requirements_field_invalid')}
                        >
                            <select
                                value={requirement.courseId}
                                onChange={(event) => onChange(requirement.clientId, {
                                    courseId: event.target.value,
                                    minimumGrade: '',
                                })}
                                disabled={saving}
                                {...invalidProps('courseId')}
                            >
                                <option value="">{t('coop_requirements_course')}</option>
                                {courses.map((course) => (
                                    <option key={course.id} value={course.id}>
                                        {course.code} · {course.name}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <Field
                            label={t('coop_requirements_grade')}
                            error={errors.minimumGrade}
                            errorId={errorId('minimumGrade')}
                            errorMessage={t('coop_requirements_field_invalid')}
                        >
                            <select
                                value={requirement.minimumGrade}
                                onChange={(event) => onChange(requirement.clientId, {
                                    minimumGrade: event.target.value,
                                })}
                                disabled={saving || !selectedCourse}
                                {...invalidProps('minimumGrade')}
                            >
                                <option value="">{t('coop_requirements_grade')}</option>
                                {allowedGrades.map((grade) => (
                                    <option key={grade} value={grade}>
                                        {grade}
                                    </option>
                                ))}
                            </select>
                        </Field>
                    </>
                )}

                {requirement.criterionType && requirement.criterionType !== 'course_grade' && (
                    <Field
                        label={t('coop_requirements_minimum')}
                        error={errors.minimumValue}
                        errorId={errorId('minimumValue')}
                        errorMessage={t('coop_requirements_field_invalid')}
                    >
                        <input
                            type="number"
                            min="0"
                            max={requirement.criterionType.includes('gpa') ? '4' : undefined}
                            step={requirement.criterionType.includes('gpa') ? '0.01' : '1'}
                            value={requirement.minimumValue}
                            onChange={(event) => onChange(requirement.clientId, { minimumValue: event.target.value })}
                            disabled={saving}
                            {...invalidProps('minimumValue')}
                        />
                    </Field>
                )}
            </div>
        </article>
    );
}

function Field({ label, error, errorId, errorMessage, children }) {
    return (
        <label
            className={`coop-requirements__field ${error ? 'coop-requirements__field--invalid' : ''}`}
        >
            <span>{label}</span>
            {children}
            {error && (
                <small id={errorId}>
                    {errorMessage}
                </small>
            )}
        </label>
    );
}
