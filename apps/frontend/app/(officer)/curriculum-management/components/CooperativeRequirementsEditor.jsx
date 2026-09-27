'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, LoaderCircle, Plus, Save, Send, Trash2 } from 'lucide-react';
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

function flattenCategories(nodes, language, level = 0, result = []) {
    for (const category of nodes || []) {
        if (!category.isActive) continue;
        const name = language === 'en'
            ? category.nameEn || category.name
            : category.name || category.nameEn;
        result.push({
            id: String(category.id),
            label: `${'— '.repeat(level)}${name || ''}`,
        });
        flattenCategories(category.children, language, level + 1, result);
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

function localizedValue(valueEn, valueTh, language, fallback = '-') {
    const english = String(valueEn || '').trim();
    const thai = String(valueTh || '').trim();
    return language === 'en' ? english || thai || fallback : thai || english || fallback;
}

function minimumSummary(requirement, categories, courses, t) {
    const category = categories.find((item) => item.id === requirement.categoryId);
    const course = courses.find((item) => item.id === requirement.courseId);
    const selectedName = course
        ? `${course.code} · ${course.name}`
        : category?.label;
    const value = requirement.minimumGrade
        ? `${t('coop_requirements_grade')}: ${requirement.minimumGrade}`
        : requirement.minimumValue !== ''
            ? `${t('coop_requirements_minimum')}: ${requirement.minimumValue}`
            : '';
    if (selectedName && value) return `${selectedName} · ${value}`;
    return selectedName || value;
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
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [fieldErrors, setFieldErrors] = useState({});
    const [publishConfirmation, setPublishConfirmation] = useState(false);

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
        fetchCooperativeRequirements(curriculum.curriculumId || curriculum.id)
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
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, [curriculum.curriculumId, curriculum.id, onDirtyChange]);

    const startEditing = () => {
        const current = draft || published;
        setRequirements(withClientIds(current?.requirements, makeClientId));
        setEditing(true);
        setError('');
        setMessage('');
        onDirtyChange?.(false);
    };

    const updateRequirement = (clientId, patch) => {
        setRequirements((current) => current.map((item) => (
            item.clientId === clientId ? { ...item, ...patch } : item
        )));
        setFieldErrors((current) => ({ ...current, [clientId]: {} }));
        setError('');
        setMessage('');
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
        onDirtyChange?.(true);
    };

    const handleRemoveRequirement = (clientId) => {
        setRequirements((current) => current.filter((item) => item.clientId !== clientId));
        setFieldErrors((current) => {
            const next = { ...current };
            delete next[clientId];
            return next;
        });
        onDirtyChange?.(true);
    };

    const handleCancelEditing = () => {
        const current = draft || published;
        setRequirements(withClientIds(current?.requirements, makeClientId));
        setEditing(Boolean(draft));
        setError('');
        setMessage('');
        setFieldErrors({});
        onDirtyChange?.(false);
    };

    const handleSaveDraft = async () => {
        setSaving(true);
        setError('');
        setMessage('');
        try {
            const data = await saveCooperativeRequirementsDraft(
                curriculum.curriculumId || curriculum.id,
                requirements,
            );
            setDraft(data.draft);
            setPublished(data.published);
            setRequirements(withClientIds(data.draft?.requirements, makeClientId));
            setEditing(true);
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
            const data = await publishCooperativeRequirements(curriculum.curriculumId || curriculum.id);
            setDraft(data.draft);
            setPublished(data.published);
            setRequirements(withClientIds(data.published?.requirements, makeClientId));
            setEditing(false);
            setFieldErrors({});
            onDirtyChange?.(false);
            setMessage(t('coop_requirements_publish_success'));
        } catch {
            setError(t('coop_requirements_publish_error'));
        } finally {
            setSaving(false);
        }
    };

    const activeSet = published;

    if (loading) {
        return <div className="coop-requirements__state" role="status">{t('coop_requirements_loading')}</div>;
    }

    return (
        <section className="coop-requirements" aria-labelledby="coop-requirements-title">
            <header className="coop-requirements__header">
                <div>
                    <h2 id="coop-requirements-title">{t('coop_requirements_title')}</h2>
                    <p>{t('coop_requirements_description')}</p>
                </div>
                <div className="coop-requirements__badges">
                    {activeSet && (
                        <span className="coop-requirements__badge coop-requirements__badge--published">
                            <Check size={14} aria-hidden="true" />
                            {t('coop_requirements_published')} · {activeSet.revision}
                        </span>
                    )}
                    {draft && (
                        <span className="coop-requirements__badge coop-requirements__badge--draft">
                            {t('coop_requirements_draft')} · {draft.revision}
                        </span>
                    )}
                </div>
            </header>

            {!published && !editing && (
                <div className="coop-requirements__empty">
                    <p>{t('coop_requirements_not_configured')}</p>
                    <button type="button" className="course-btn course-btn--primary" onClick={startEditing}>
                        <Plus size={16} aria-hidden="true" /> {t('coop_requirements_start')}
                    </button>
                </div>
            )}

            {!editing && published && (
                <div className="coop-requirements__list">
                    {published.requirements.map((item) => (
                        <article className="coop-requirements__summary" key={item.requirementId}>
                            <strong>
                                {localizedValue(
                                    item.nameEn,
                                    item.nameTh,
                                    language,
                                    criterionTitle(item.criterionType, t),
                                )}
                            </strong>
                            <span>{criterionTitle(item.criterionType, t)}</span>
                            <span>{minimumSummary(item, categories, courses, t)}</span>
                        </article>
                    ))}
                    <button type="button" className="course-btn course-btn--secondary" onClick={startEditing}>
                        {t('coop_requirements_edit')}
                    </button>
                </div>
            )}

            {editing && (
                <>
                    {published && (
                        <div className="coop-requirements__current-note">
                            <Check size={16} aria-hidden="true" />
                            <span>{t('coop_requirements_confirm_hint')}</span>
                        </div>
                    )}

                    <div className="coop-requirements__toolbar">
                        <button
                            type="button"
                            className="course-btn course-btn--secondary"
                            onClick={handleAddRequirement}
                            disabled={saving}
                        >
                            <Plus size={16} aria-hidden="true" /> {t('coop_requirements_add')}
                        </button>
                    </div>

                    {requirements.length === 0 && (
                        <p className="coop-requirements__empty-inline">{t('coop_requirements_empty_draft')}</p>
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

                    {error && <p className="coop-requirements__alert" role="alert">{error}</p>}
                    {message && <p className="coop-requirements__success" role="status">{message}</p>}

                    <footer className="coop-requirements__actions">
                        <button
                            type="button"
                            className="course-btn course-btn--ghost"
                            onClick={handleCancelEditing}
                            disabled={saving}
                        >
                            {t('coop_requirements_cancel')}
                        </button>
                        <button
                            type="button"
                            className="course-btn course-btn--secondary"
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

            {!editing && error && <p className="coop-requirements__alert" role="alert">{error}</p>}
            {!editing && message && <p className="coop-requirements__success" role="status">{message}</p>}

            <ConfirmActionModal
                open={publishConfirmation}
                title={t('coop_requirements_confirm_title')}
                message={t('coop_requirements_confirm_message')}
                hint={t('coop_requirements_confirm_hint')}
                confirmLabel={t('coop_requirements_publish')}
                cancelLabel={t('curriculum_cancel')}
                loading={saving}
                onConfirm={handlePublish}
                onCancel={() => setPublishConfirmation(false)}
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
