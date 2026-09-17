import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, Plus, Trash2 } from 'lucide-react';
import BaseModal from '../../../../components/ui/BaseModal';

function initialForm() {
    return {
        academicYearBE: '',
        semester: '1',
        courses: [],
    };
}

function getCourseName(course, language) {
    if (!course) {
        return '';
    }

    return language === 'en'
        ? course.nameEn || course.nameTh
        : course.nameTh;
}

function getCompetencyName(competency, language) {
    return language === 'en'
        ? competency.nameEn || competency.nameTh
        : competency.nameTh;
}

function validateLocalForm(form, courses, labels) {
    const errors = [];
    if (!form.academicYearBE) {
        errors.push(labels.academicYear);
    }
    if (!form.courses.length) {
        errors.push(labels.selectedCourses);
    }

    const selectedIds = new Set();
    form.courses.forEach((item) => {
        if (!item.freeElectiveCourseId) {
            errors.push(labels.chooseCourse);
            return;
        }
        if (selectedIds.has(String(item.freeElectiveCourseId))) {
            errors.push(labels.courseAlreadyAdded);
        }
        selectedIds.add(String(item.freeElectiveCourseId));
        if (!item.competencies.length) {
            errors.push(labels.chooseCompetencies);
        }
        if (item.competencies.some((competency) => (
            !competency.competencyId
            || Number(competency.weightPercent) < 0
            || Number(competency.weightPercent) > 100
        ))) {
            errors.push(labels.mappingWeight);
        }

        const course = courses.find(
            (candidate) => String(candidate.id) === String(item.freeElectiveCourseId),
        );
        if (!course) {
            errors.push(labels.chooseCourse);
        }
    });
    return Array.from(new Set(errors));
}

export default function FreeElectiveRoundWizard({
    open,
    language,
    labels,
    courses,
    competencies,
    facultyId,
    saving,
    onClose,
    onPreview,
    onSubmit,
}) {
    const [step, setStep] = useState(1);
    const [form, setForm] = useState(initialForm);
    const [localErrors, setLocalErrors] = useState([]);
    const [preview, setPreview] = useState(null);
    const [previewing, setPreviewing] = useState(false);

    useEffect(() => {
        if (open) {
            setStep(1);
            setForm(initialForm());
            setLocalErrors([]);
            setPreview(null);
        }
    }, [open]);

    const availableCourses = useMemo(() => {
        const selectedIds = new Set(
            form.courses.map((item) => String(item.freeElectiveCourseId)).filter(Boolean),
        );
        return courses.filter((course) => !selectedIds.has(String(course.id)));
    }, [courses, form.courses]);

    const setPeriod = (field, value) => {
        setForm((current) => ({ ...current, [field]: value }));
        setLocalErrors([]);
    };

    const addCourseRow = () => {
        setForm((current) => ({
            ...current,
            courses: [
                ...current.courses,
                { freeElectiveCourseId: '', competencies: [] },
            ],
        }));
        setLocalErrors([]);
    };

    const removeCourseRow = (index) => {
        setForm((current) => ({
            ...current,
            courses: current.courses.filter((_, rowIndex) => rowIndex !== index),
        }));
    };

    const selectCourse = (index, courseId) => {
        setForm((current) => ({
            ...current,
            courses: current.courses.map((item, rowIndex) => (
                rowIndex === index
                    ? { ...item, freeElectiveCourseId: courseId, competencies: [] }
                    : item
            )),
        }));
        setLocalErrors([]);
    };

    const updateCompetency = (courseIndex, competencyIndex, field, value) => {
        setForm((current) => ({
            ...current,
            courses: current.courses.map((course, rowIndex) => {
                if (rowIndex !== courseIndex) {
                    return course;
                }
                return {
                    ...course,
                    competencies: course.competencies.map((item, itemIndex) => (
                        itemIndex === competencyIndex
                            ? { ...item, [field]: value }
                            : item
                    )),
                };
            }),
        }));
        setLocalErrors([]);
    };

    const addCompetency = (courseIndex) => {
        setForm((current) => ({
            ...current,
            courses: current.courses.map((course, rowIndex) => (
                rowIndex === courseIndex
                    ? {
                        ...course,
                        competencies: [
                            ...course.competencies,
                            { competencyId: '', weightPercent: 0 },
                        ],
                    }
                    : course
            )),
        }));
    };

    const removeCompetency = (courseIndex, competencyIndex) => {
        setForm((current) => ({
            ...current,
            courses: current.courses.map((course, rowIndex) => (
                rowIndex === courseIndex
                    ? {
                        ...course,
                        competencies: course.competencies.filter(
                            (_, itemIndex) => itemIndex !== competencyIndex,
                        ),
                    }
                    : course
            )),
        }));
    };

    const goToCourses = () => {
        if (!form.academicYearBE) {
            setLocalErrors([labels.academicYear]);
            return;
        }
        setStep(2);
    };

    const goToReview = async () => {
        const errors = validateLocalForm(form, courses, labels);
        if (errors.length) {
            setLocalErrors(errors);
            return;
        }
        setPreviewing(true);
        setLocalErrors([]);
        try {
            const result = await onPreview({ ...form, facultyId });
            setPreview(result);
            setStep(3);
        } catch (error) {
            setLocalErrors([error.message || labels.roundLoadError]);
        } finally {
            setPreviewing(false);
        }
    };

    const handleSubmit = async () => {
        if (!preview?.valid) {
            return;
        }
        await onSubmit({ ...form, facultyId });
    };

    const stepLabels = [
        labels.roundStepDetails,
        labels.roundStepCourses,
        labels.roundStepReview,
    ];

    return (
        <BaseModal
            open={open}
            title={labels.createRoundTitle}
            icon={<BookOpen size={18} />}
            size="xl"
            onClose={onClose}
            closeDisabled={saving || previewing}
        >
            <div className="free-elective-round-wizard">
                <ol className="free-elective-round-wizard__steps">
                    {stepLabels.map((stepLabel, index) => {
                        const stepNumber = index + 1;
                        return (
                            <li
                                key={stepLabel}
                                className={step === stepNumber ? 'is-active' : ''}
                            >
                                <span>{stepNumber}</span>
                                {stepLabel}
                            </li>
                        );
                    })}
                </ol>

                {localErrors.length > 0 && (
                    <div className="free-elective-notice free-elective-notice--error" role="alert">
                        {localErrors.join(language === 'en' ? ', ' : ' และ ')}
                    </div>
                )}

                {step === 1 && (
                    <section className="free-elective-round-wizard__section">
                        <h2>{labels.roundStepDetails}</h2>
                        <p>{labels.roundStatusHint}</p>
                        <div className="free-elective-form-grid">
                            <label className="free-elective-field">
                                <span>{labels.academicYear} *</span>
                                <input
                                    type="number"
                                    min="2400"
                                    value={form.academicYearBE}
                                    onChange={(event) => setPeriod('academicYearBE', event.target.value)}
                                    placeholder={labels.yearPlaceholder}
                                    disabled={saving}
                                    required
                                />
                            </label>
                            <label className="free-elective-field">
                                <span>{labels.semester} *</span>
                                <select
                                    value={form.semester}
                                    onChange={(event) => setPeriod('semester', event.target.value)}
                                    disabled={saving}
                                >
                                    <option value="1">{labels.semesterOne}</option>
                                    <option value="2">{labels.semesterTwo}</option>
                                    <option value="3">{labels.semesterThree}</option>
                                </select>
                            </label>
                        </div>
                    </section>
                )}

                {step === 2 && (
                    <section className="free-elective-round-wizard__section">
                        <div className="free-elective-round-wizard__section-heading">
                            <div>
                                <h2>{labels.roundStepCourses}</h2>
                                <p>{labels.chooseCompetencies}</p>
                            </div>
                            <button
                                type="button"
                                className="free-elective-button free-elective-button--secondary"
                                onClick={addCourseRow}
                                disabled={saving || !availableCourses.length}
                            >
                                <Plus size={16} aria-hidden="true" />
                                {labels.addCourseToRound}
                            </button>
                        </div>
                        {!form.courses.length && (
                            <div className="free-elective-empty">
                                {labels.noRoundCourses}
                            </div>
                        )}
                        <div className="free-elective-round-course-editor-list">
                            {form.courses.map((item, courseIndex) => {
                                const selectedCourse = courses.find(
                                    (course) => String(course.id) === String(item.freeElectiveCourseId),
                                );
                                const selectedCompetencyIds = new Set(
                                    item.competencies
                                        .map((competency) => String(competency.competencyId))
                                        .filter(Boolean),
                                );
                                const courseOptions = selectedCourse
                                    ? [selectedCourse, ...availableCourses]
                                    : availableCourses;

                                return (
                                    <article
                                        className="free-elective-round-course-editor"
                                        key={`${courseIndex}-${item.freeElectiveCourseId || 'empty'}`}
                                    >
                                        <div className="free-elective-round-course-editor__heading">
                                            <label className="free-elective-field">
                                                <span>{labels.course} *</span>
                                                <select
                                                    value={item.freeElectiveCourseId}
                                                    onChange={(event) => selectCourse(courseIndex, event.target.value)}
                                                    disabled={saving}
                                                    required
                                                >
                                                    <option value="">{labels.chooseCourse}</option>
                                                    {courseOptions.map((course) => (
                                                        <option key={course.id} value={course.id}>
                                                            {course.code} · {getCourseName(course, language)}
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>
                                            <button
                                                type="button"
                                                className="free-elective-icon-button free-elective-icon-button--danger"
                                                onClick={() => removeCourseRow(courseIndex)}
                                                title={labels.removeCourse}
                                                aria-label={labels.removeCourse}
                                                disabled={saving}
                                            >
                                                <Trash2 size={16} aria-hidden="true" />
                                            </button>
                                        </div>
                                        {selectedCourse && (
                                            <div className="free-elective-round-course-editor__meta">
                                                <strong>{selectedCourse.code}</strong>
                                                <span>{getCourseName(selectedCourse, language)}</span>
                                                <span>{labels.gradeScheme}: {selectedCourse.gradeScheme}</span>
                                            </div>
                                        )}
                                        {selectedCourse && (
                                            <div className="free-elective-round-course-editor__competencies">
                                                <div className="free-elective-round-course-editor__subheading">
                                                    <strong>{labels.courseCompetencies}</strong>
                                                    <button
                                                        type="button"
                                                        className="free-elective-button free-elective-button--quiet"
                                                        onClick={() => addCompetency(courseIndex)}
                                                        disabled={saving || item.competencies.length >= competencies.length}
                                                    >
                                                        <Plus size={14} aria-hidden="true" />
                                                        {labels.addCompetency}
                                                    </button>
                                                </div>
                                                {item.competencies.map((mapping, competencyIndex) => (
                                                    <div
                                                        className="free-elective-round-course-editor__mapping"
                                                        key={`${courseIndex}-${competencyIndex}`}
                                                    >
                                                        <select
                                                            value={mapping.competencyId}
                                                            onChange={(event) => updateCompetency(
                                                                courseIndex,
                                                                competencyIndex,
                                                                'competencyId',
                                                                event.target.value,
                                                            )}
                                                            disabled={saving}
                                                        >
                                                            <option value="">{labels.chooseCompetency}</option>
                                                            {competencies.map((competency) => {
                                                                const isCurrent = String(competency.id) === String(mapping.competencyId);
                                                                const isUsed = selectedCompetencyIds.has(String(competency.id)) && !isCurrent;
                                                                return (
                                                                    <option
                                                                        key={competency.id}
                                                                        value={competency.id}
                                                                        disabled={isUsed}
                                                                    >
                                                                        {getCompetencyName(competency, language)}
                                                                    </option>
                                                                );
                                                            })}
                                                        </select>
                                                        <span className="free-elective-round-course-editor__mapping-name">
                                                            {competencies.find(
                                                                (competency) => String(competency.id) === String(mapping.competencyId),
                                                            )?.code || labels.chooseCompetency}
                                                        </span>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max="100"
                                                            step="0.01"
                                                            value={mapping.weightPercent}
                                                            onChange={(event) => updateCompetency(
                                                                courseIndex,
                                                                competencyIndex,
                                                                'weightPercent',
                                                                event.target.value,
                                                            )}
                                                            disabled={saving}
                                                            aria-label={labels.mappingWeight}
                                                        />
                                                        <span>%</span>
                                                        <button
                                                            type="button"
                                                            className="free-elective-icon-button free-elective-icon-button--danger"
                                                            onClick={() => removeCompetency(courseIndex, competencyIndex)}
                                                            title={labels.cancel}
                                                            aria-label={labels.cancel}
                                                            disabled={saving}
                                                        >
                                                            <Trash2 size={15} aria-hidden="true" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </article>
                                );
                            })}
                        </div>
                    </section>
                )}

                {step === 3 && (
                    <section className="free-elective-round-wizard__section">
                        <h2>{labels.roundStepReview}</h2>
                        <p>{labels.previewHint}</p>
                        {preview?.errors?.length > 0 && (
                            <div className="free-elective-notice free-elective-notice--error" role="alert">
                                {preview.errors.map((issue) => issue.message).join(' ')}
                            </div>
                        )}
                        <div className="free-elective-round-review-summary">
                            <div>
                                <span>{labels.academicYear}</span>
                                <strong>{form.academicYearBE}</strong>
                            </div>
                            <div>
                                <span>{labels.semester}</span>
                                <strong>{form.semester}</strong>
                            </div>
                            <div>
                                <span>{labels.courseCount}</span>
                                <strong>{form.courses.length}</strong>
                            </div>
                        </div>
                        <div className="free-elective-round-review-list">
                            {form.courses.map((item) => {
                                const course = courses.find(
                                    (candidate) => String(candidate.id) === String(item.freeElectiveCourseId),
                                );
                                return (
                                    <article key={item.freeElectiveCourseId}>
                                        <div>
                                            <strong>{course?.code}</strong>
                                            <span>{getCourseName(course, language)}</span>
                                        </div>
                                        <span>
                                            {item.competencies.length} {labels.competencies}
                                        </span>
                                    </article>
                                );
                            })}
                        </div>
                    </section>
                )}

                <div className="free-elective-modal-actions free-elective-round-wizard__actions">
                    {step > 1 && (
                        <button
                            type="button"
                            className="free-elective-button free-elective-button--secondary"
                            onClick={() => setStep((current) => current - 1)}
                            disabled={saving || previewing}
                        >
                            <ArrowLeft size={16} aria-hidden="true" />
                            {labels.back}
                        </button>
                    )}
                    {step === 1 && (
                        <button
                            type="button"
                            className="free-elective-button free-elective-button--primary"
                            onClick={goToCourses}
                            disabled={saving}
                        >
                            {labels.roundStepCourses}
                            <ArrowRight size={16} aria-hidden="true" />
                        </button>
                    )}
                    {step === 2 && (
                        <button
                            type="button"
                            className="free-elective-button free-elective-button--primary"
                            onClick={goToReview}
                            disabled={saving || previewing}
                        >
                            {previewing ? labels.loading : labels.previewRound}
                            <ArrowRight size={16} aria-hidden="true" />
                        </button>
                    )}
                    {step === 3 && (
                        <button
                            type="button"
                            className="free-elective-button free-elective-button--primary"
                            onClick={handleSubmit}
                            disabled={saving || previewing || !preview?.valid}
                        >
                            <Check size={16} aria-hidden="true" />
                            {saving ? labels.loading : labels.saveRound}
                        </button>
                    )}
                </div>
            </div>
        </BaseModal>
    );
}

