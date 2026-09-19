import { useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, Plus, Trash2 } from 'lucide-react';
import BaseModal from '../../../../components/ui/BaseModal';
import { FREE_ELECTIVE_GRADE_SCHEMES } from '../../../../lib/free-elective';

function initialForm() {
    return {
        academicYearBE: '',
        semester: '1',
        courses: [],
    };
}

function createCourseRow() {
    return {
        freeElectiveCourseId: '',
        courseCode: '',
        courseNameTh: '',
        courseNameEn: '',
        credits: '',
        gradeScheme: '',
        competencies: [],
    };
}

function createMappingRow() {
    return {
        competencyId: '',
        weightPercent: 0,
    };
}

function createFieldErrors(courseCount = 0) {
    return {
        academicYearBE: '',
        courses: '',
        rows: Array.from({ length: courseCount }, () => ({
            courseCode: '',
            courseNameTh: '',
            courseNameEn: '',
            credits: '',
            gradeScheme: '',
            competencies: '',
            mappings: [],
        })),
    };
}

function createRowErrors() {
    return {
        courseCode: '',
        courseNameTh: '',
        courseNameEn: '',
        credits: '',
        gradeScheme: '',
        competencies: '',
        mappings: [],
    };
}

function normalizeCourseCode(code) {
    return String(code || '').trim().toUpperCase();
}

function getGradeSchemeLabel(scheme, labels) {
    return scheme === 'satisfactory'
        ? labels.satisfactoryGrades
        : labels.letterGrades;
}

function getCompetencyName(competency, language) {
    return language === 'en'
        ? competency.nameEn || competency.nameTh
        : competency.nameTh;
}

function isValidGradeScheme(value) {
    return FREE_ELECTIVE_GRADE_SCHEMES.some((scheme) => scheme.value === value);
}

function hasFieldErrors(errors) {
    return Boolean(
        errors.academicYearBE
        || errors.courses
        || errors.rows.some((row) => (
            row.courseCode
            || row.courseNameTh
            || row.courseNameEn
            || row.credits
            || row.gradeScheme
            || row.competencies
            || row.mappings.some((mapping) => mapping.competencyId || mapping.weightPercent)
        )),
    );
}

function validateLocalForm(form, labels) {
    const errors = createFieldErrors(form.courses.length);
    const seenCodes = new Set();

    if (!form.academicYearBE) {
        errors.academicYearBE = labels.academicYearRequired;
    }

    if (!form.courses.length) {
        errors.courses = labels.coursesRequired;
    }

    form.courses.forEach((course, courseIndex) => {
        const rowErrors = errors.rows[courseIndex];
        const normalizedCode = normalizeCourseCode(course.courseCode);

        if (!normalizedCode) {
            rowErrors.courseCode = labels.courseCodeRequired;
        } else if (seenCodes.has(normalizedCode)) {
            rowErrors.courseCode = labels.courseAlreadyAdded;
        } else {
            seenCodes.add(normalizedCode);
        }

        if (!String(course.courseNameTh || '').trim()) {
            rowErrors.courseNameTh = labels.courseNameRequired;
        }

        if (!Number.isInteger(Number(course.credits)) || Number(course.credits) <= 0) {
            rowErrors.credits = labels.creditsInvalid;
        }

        if (!isValidGradeScheme(course.gradeScheme)) {
            rowErrors.gradeScheme = labels.gradeSchemeRequired;
        }

        if (!course.competencies.length) {
            rowErrors.competencies = labels.competenciesRequired;
        }

        course.competencies.forEach((mapping, competencyIndex) => {
            const mappingErrors = {
                competencyId: '',
                weightPercent: '',
            };
            if (!mapping.competencyId) {
                mappingErrors.competencyId = labels.competencyRequired;
            }
            if (
                mapping.weightPercent === ''
                || Number.isNaN(Number(mapping.weightPercent))
                || Number(mapping.weightPercent) < 0
                || Number(mapping.weightPercent) > 100
            ) {
                mappingErrors.weightPercent = labels.weightInvalid;
            }
            rowErrors.mappings[competencyIndex] = mappingErrors;
        });
    });

    return errors;
}

function mapPreviewCourse(course, fallback) {
    return {
        freeElectiveCourseId: course.free_elective_course_id
            ? String(course.free_elective_course_id)
            : fallback.freeElectiveCourseId,
        courseCode: course.course_code ?? fallback.courseCode,
        courseNameTh: course.course_name_th ?? fallback.courseNameTh,
        courseNameEn: course.course_name_en ?? fallback.courseNameEn,
        credits: course.credits ?? fallback.credits,
        gradeScheme: course.grade_scheme ?? fallback.gradeScheme,
        competencies: (course.competencies || fallback.competencies || []).map((mapping) => ({
            competencyId: String(mapping.competency_id ?? mapping.competencyId ?? ''),
            weightPercent: mapping.weight_percent ?? mapping.weightPercent ?? 0,
        })),
    };
}

function mapPreviewCourses(courses, currentCourses) {
    return (courses || []).map((course, index) => (
        mapPreviewCourse(course, currentCourses[index] || createCourseRow())
    ));
}

function localizeIssue(issue, labels) {
    const messages = {
        FACULTY_REQUIRED: labels.facultyRequired,
        FACULTY_SCOPE_FORBIDDEN: labels.facultyUnavailable,
        INVALID_PERIOD: labels.periodInvalid,
        COURSES_REQUIRED: labels.coursesRequired,
        COURSE_REQUIRED: labels.courseCodeRequired,
        COURSE_NOT_FOUND: labels.courseNotFound,
        COURSE_FACULTY_MISMATCH: labels.courseFacultyMismatch,
        COURSE_INACTIVE: labels.courseInactive,
        DUPLICATE_COURSE: labels.courseAlreadyAdded,
        COURSE_NAME_REQUIRED: labels.courseNameRequired,
        INVALID_CREDITS: labels.creditsInvalid,
        INVALID_GRADE_SCHEME: labels.gradeSchemeRequired,
        COMPETENCIES_REQUIRED: labels.competenciesRequired,
        COMPETENCY_REQUIRED: labels.competencyRequired,
        DUPLICATE_COMPETENCY: labels.competencyAlreadyAdded,
        INVALID_WEIGHT: labels.weightInvalid,
        ROUND_ALREADY_EXISTS: labels.roundAlreadyExists,
    };
    return messages[issue.code] || labels.validationError;
}

function applyServerErrors(issues, labels, courseCount) {
    const errors = createFieldErrors(courseCount);
    (issues || []).forEach((issue) => {
        const message = localizeIssue(issue, labels);
        const path = String(issue.path || '');
        const courseMatch = path.match(/^courses\[(\d+)\](?:\.(.*))?$/);

        if (!courseMatch) {
            if (path === 'academic_year_be') {
                errors.academicYearBE = message;
            } else {
                errors.courses = message;
            }
            return;
        }

        const courseIndex = Number(courseMatch[1]);
        const rowErrors = errors.rows[courseIndex];
        if (!rowErrors) {
            return;
        }

        const fieldPath = courseMatch[2] || '';
        const mappingMatch = fieldPath.match(/^competencies\[(\d+)\]\.(.*)$/);
        if (mappingMatch) {
            const mappingIndex = Number(mappingMatch[1]);
            rowErrors.mappings[mappingIndex] = {
                competencyId: mappingMatch[2] === 'competency_id' ? message : '',
                weightPercent: mappingMatch[2] === 'weight_percent' ? message : '',
            };
            return;
        }

        const fieldMap = {
            course_code: 'courseCode',
            free_elective_course_id: 'courseCode',
            course_name_th: 'courseNameTh',
            course_name_en: 'courseNameEn',
            credits: 'credits',
            grade_scheme: 'gradeScheme',
            competencies: 'competencies',
        };
        const field = fieldMap[fieldPath] || 'courseCode';
        rowErrors[field] = message;
    });
    return errors;
}

function cleanForm(form, facultyId) {
    return {
        facultyId,
        academicYearBE: form.academicYearBE,
        semester: form.semester,
        courses: form.courses.map(({ competencies, ...course }) => ({
            ...course,
            competencies: competencies.map(({ competencyId, weightPercent }) => ({
                competencyId,
                weightPercent,
            })),
        })),
    };
}

function FieldError({ id, message }) {
    if (!message) {
        return null;
    }

    return (
        <span id={id} className="free-elective-field__error" role="alert">
            {message}
        </span>
    );
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
    const [fieldErrors, setFieldErrors] = useState(createFieldErrors());
    const [preview, setPreview] = useState(null);
    const [previewing, setPreviewing] = useState(false);

    const clearFieldError = (courseIndex, field) => {
        setFieldErrors((current) => ({
            ...current,
            rows: current.rows.map((row, index) => (
                index === courseIndex ? { ...row, [field]: '' } : row
            )),
        }));
    };

    const setPeriod = (field, value) => {
        setForm((current) => ({ ...current, [field]: value }));
        if (field === 'academicYearBE') {
            setFieldErrors((current) => ({ ...current, academicYearBE: '' }));
        }
    };

    const addCourseRow = () => {
        setForm((current) => ({
            ...current,
            courses: [...current.courses, createCourseRow()],
        }));
        setFieldErrors((current) => ({
            ...current,
            courses: '',
            rows: [...current.rows, createRowErrors()],
        }));
    };

    const removeCourseRow = (index) => {
        setForm((current) => ({
            ...current,
            courses: current.courses.filter((_, rowIndex) => rowIndex !== index),
        }));
        setFieldErrors((current) => ({
            ...current,
            rows: current.rows.filter((_, rowIndex) => rowIndex !== index),
        }));
    };

    const updateCourseField = (index, field, value) => {
        setForm((current) => ({
            ...current,
            courses: current.courses.map((course, rowIndex) => {
                if (rowIndex !== index) {
                    return course;
                }
                return {
                    ...course,
                    [field]: value,
                    ...(field === 'courseCode' ? { freeElectiveCourseId: '' } : {}),
                };
            }),
        }));
        clearFieldError(index, field);
    };

    const resolveCatalogCourse = (index) => {
        const currentCourse = form.courses[index];
        const code = normalizeCourseCode(currentCourse?.courseCode);
        const catalogCourse = courses.find(
            (course) => normalizeCourseCode(course.code) === code,
        );
        if (!catalogCourse) {
            return;
        }

        setForm((current) => ({
            ...current,
            courses: current.courses.map((course, rowIndex) => (
                rowIndex === index
                    ? {
                        ...course,
                        freeElectiveCourseId: String(catalogCourse.id),
                        courseCode: catalogCourse.code,
                        courseNameTh: catalogCourse.nameTh,
                        courseNameEn: catalogCourse.nameEn || '',
                        credits: catalogCourse.credits,
                        gradeScheme: catalogCourse.gradeScheme,
                    }
                    : course
            )),
        }));
        setFieldErrors((current) => ({
            ...current,
            rows: current.rows.map((row, rowIndex) => (
                rowIndex === index ? createRowErrors() : row
            )),
        }));
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
        setFieldErrors((current) => ({
            ...current,
            rows: current.rows.map((row, rowIndex) => {
                if (rowIndex !== courseIndex) {
                    return row;
                }
                return {
                    ...row,
                    mappings: row.mappings.map((mapping, mappingIndex) => (
                        mappingIndex === competencyIndex
                            ? { ...mapping, [field]: '' }
                            : mapping
                    )),
                };
            }),
        }));
    };

    const addCompetency = (courseIndex) => {
        setForm((current) => ({
            ...current,
            courses: current.courses.map((course, rowIndex) => (
                rowIndex === courseIndex
                    ? {
                        ...course,
                        competencies: [...course.competencies, createMappingRow()],
                    }
                    : course
            )),
        }));
        setFieldErrors((current) => ({
            ...current,
            rows: current.rows.map((row, rowIndex) => (
                rowIndex === courseIndex
                    ? {
                        ...row,
                        competencies: '',
                        mappings: [...row.mappings, { competencyId: '', weightPercent: '' }],
                    }
                    : row
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
        setFieldErrors((current) => ({
            ...current,
            rows: current.rows.map((row, rowIndex) => (
                rowIndex === courseIndex
                    ? {
                        ...row,
                        mappings: row.mappings.filter(
                            (_, itemIndex) => itemIndex !== competencyIndex,
                        ),
                    }
                    : row
            )),
        }));
    };

    const goToCourses = () => {
        if (!form.academicYearBE) {
            setFieldErrors((current) => ({
                ...current,
                academicYearBE: labels.academicYearRequired,
            }));
            return;
        }
        setStep(2);
    };

    const goToReview = async () => {
        const localValidation = validateLocalForm(form, labels);
        if (hasFieldErrors(localValidation)) {
            setFieldErrors(localValidation);
            return;
        }

        setPreviewing(true);
        setFieldErrors(createFieldErrors(form.courses.length));
        try {
            const result = await onPreview(cleanForm(form, facultyId));
            if (!result?.valid) {
                setFieldErrors(applyServerErrors(result?.errors, labels, form.courses.length));
                setPreview(result);
                return;
            }
            const normalizedCourses = mapPreviewCourses(result.courses, form.courses);
            setForm((current) => ({ ...current, courses: normalizedCourses }));
            setPreview({ ...result, courses: normalizedCourses });
            setStep(3);
        } catch (error) {
            const issues = error?.payload?.data?.errors || error?.payload?.errors;
            if (Array.isArray(issues) && issues.length) {
                setFieldErrors(applyServerErrors(issues, labels, form.courses.length));
            } else {
                setFieldErrors((current) => ({ ...current, courses: labels.validationError }));
            }
        } finally {
            setPreviewing(false);
        }
    };

    const handleSubmit = async () => {
        if (!preview?.valid) {
            return;
        }
        try {
            await onSubmit(cleanForm(form, facultyId));
        } catch (error) {
            const issues = error?.payload?.data?.errors || error?.payload?.errors;
            if (Array.isArray(issues) && issues.length) {
                setFieldErrors(applyServerErrors(issues, labels, form.courses.length));
                setStep(2);
            }
        }
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

                {step === 1 && (
                    <section className="free-elective-round-wizard__section">
                        <h2>{labels.roundStepDetails}</h2>
                        <p>{labels.roundStatusHint}</p>
                        <div className="free-elective-form-grid">
                            <label className="free-elective-field">
                                <span>{labels.academicYear} *</span>
                                <input
                                    id="free-elective-round-academic-year"
                                    type="number"
                                    min="2400"
                                    value={form.academicYearBE}
                                    onChange={(event) => setPeriod('academicYearBE', event.target.value)}
                                    placeholder={labels.yearPlaceholder}
                                    disabled={saving}
                                    aria-invalid={Boolean(fieldErrors.academicYearBE)}
                                    aria-describedby={fieldErrors.academicYearBE ? 'free-elective-round-academic-year-error' : undefined}
                                    required
                                />
                                <FieldError
                                    id="free-elective-round-academic-year-error"
                                    message={fieldErrors.academicYearBE}
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
                                <p>{labels.roundCourseFieldsHint}</p>
                            </div>
                            <button
                                type="button"
                                className="free-elective-button free-elective-button--secondary"
                                onClick={addCourseRow}
                                disabled={saving}
                            >
                                <Plus size={16} aria-hidden="true" />
                                {labels.addCourseToRound}
                            </button>
                        </div>
                        <FieldError
                            id="free-elective-round-courses-error"
                            message={fieldErrors.courses}
                        />
                        {!form.courses.length && (
                            <div className="free-elective-empty">
                                {labels.noRoundCourses}
                            </div>
                        )}
                        <div className="free-elective-round-course-editor-list">
                            {form.courses.map((item, courseIndex) => {
                                const rowErrors = fieldErrors.rows[courseIndex] || createRowErrors();
                                const selectedCompetencyIds = new Set(
                                    item.competencies
                                        .map((competency) => String(competency.competencyId))
                                        .filter(Boolean),
                                );
                                const isCatalogCourse = Boolean(item.freeElectiveCourseId);

                                return (
                                    <article
                                        className="free-elective-round-course-editor"
                                        key={`round-course-${courseIndex}`}
                                    >
                                        <div className="free-elective-round-course-editor__heading">
                                            <div>
                                                <h3>{labels.course} {courseIndex + 1}</h3>
                                                <p>{labels.courseFieldsHint}</p>
                                            </div>
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

                                        <div className="free-elective-round-course-editor__fields">
                                            <label className="free-elective-field free-elective-field--code">
                                                <span>{labels.code} *</span>
                                                <input
                                                    value={item.courseCode}
                                                    onChange={(event) => updateCourseField(
                                                        courseIndex,
                                                        'courseCode',
                                                        event.target.value,
                                                    )}
                                                    onBlur={() => resolveCatalogCourse(courseIndex)}
                                                    placeholder={labels.codePlaceholder}
                                                    disabled={saving}
                                                    aria-invalid={Boolean(rowErrors.courseCode)}
                                                />
                                                <FieldError message={rowErrors.courseCode} />
                                            </label>
                                            <label className="free-elective-field">
                                                <span>{labels.credits} *</span>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    step="1"
                                                    value={item.credits}
                                                    onChange={(event) => updateCourseField(
                                                        courseIndex,
                                                        'credits',
                                                        event.target.value,
                                                    )}
                                                    placeholder="1"
                                                    disabled={saving || isCatalogCourse}
                                                    aria-invalid={Boolean(rowErrors.credits)}
                                                />
                                                <FieldError message={rowErrors.credits} />
                                            </label>
                                            <label className="free-elective-field">
                                                <span>{labels.gradeScheme} *</span>
                                                <select
                                                    value={item.gradeScheme}
                                                    onChange={(event) => updateCourseField(
                                                        courseIndex,
                                                        'gradeScheme',
                                                        event.target.value,
                                                    )}
                                                    disabled={saving || isCatalogCourse}
                                                    aria-invalid={Boolean(rowErrors.gradeScheme)}
                                                >
                                                    <option value="">{labels.selectGradeScheme}</option>
                                                    {FREE_ELECTIVE_GRADE_SCHEMES.map((scheme) => (
                                                        <option key={scheme.value} value={scheme.value}>
                                                            {language === 'en' ? scheme.labelEn : scheme.labelTh}
                                                        </option>
                                                    ))}
                                                </select>
                                                <small className="free-elective-field__hint">
                                                    {labels.gradeSchemeHint}: {item.gradeScheme
                                                        ? getGradeSchemeLabel(item.gradeScheme, labels)
                                                        : labels.selectGradeScheme}
                                                </small>
                                                <FieldError message={rowErrors.gradeScheme} />
                                            </label>
                                            <label className="free-elective-field free-elective-round-course-editor__field--wide">
                                                <span>{labels.courseName} ({labels.thaiLanguage}) *</span>
                                                <input
                                                    value={item.courseNameTh}
                                                    onChange={(event) => updateCourseField(
                                                        courseIndex,
                                                        'courseNameTh',
                                                        event.target.value,
                                                    )}
                                                    disabled={saving || isCatalogCourse}
                                                    aria-invalid={Boolean(rowErrors.courseNameTh)}
                                                />
                                                <FieldError message={rowErrors.courseNameTh} />
                                            </label>
                                            <label className="free-elective-field free-elective-round-course-editor__field--wide">
                                                <span>{labels.courseName} ({labels.englishLanguage})</span>
                                                <input
                                                    value={item.courseNameEn}
                                                    onChange={(event) => updateCourseField(
                                                        courseIndex,
                                                        'courseNameEn',
                                                        event.target.value,
                                                    )}
                                                    disabled={saving || isCatalogCourse}
                                                    aria-invalid={Boolean(rowErrors.courseNameEn)}
                                                />
                                                <FieldError message={rowErrors.courseNameEn} />
                                            </label>
                                        </div>

                                        <div className="free-elective-round-course-editor__competencies">
                                            <div className="free-elective-round-course-editor__subheading">
                                                <div>
                                                    <strong>{labels.courseCompetencies}</strong>
                                                    <p>{labels.chooseCompetencies}</p>
                                                </div>
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
                                            <FieldError message={rowErrors.competencies} />
                                            {item.competencies.map((mapping, competencyIndex) => {
                                                const mappingErrors = rowErrors.mappings[competencyIndex] || {};
                                                return (
                                                    <div
                                                        className="free-elective-round-course-editor__mapping"
                                                        key={`${courseIndex}-${competencyIndex}`}
                                                    >
                                                        <label className="free-elective-field">
                                                            <span>{labels.competency} *</span>
                                                            <select
                                                                value={mapping.competencyId}
                                                                onChange={(event) => updateCompetency(
                                                                    courseIndex,
                                                                    competencyIndex,
                                                                    'competencyId',
                                                                    event.target.value,
                                                                )}
                                                                disabled={saving}
                                                                aria-invalid={Boolean(mappingErrors.competencyId)}
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
                                                                            {competency.code} - {getCompetencyName(competency, language)}
                                                                        </option>
                                                                    );
                                                                })}
                                                            </select>
                                                            <FieldError message={mappingErrors.competencyId} />
                                                        </label>
                                                        <label className="free-elective-field">
                                                            <span>{labels.mappingWeight} *</span>
                                                            <div className="free-elective-round-course-editor__weight-input">
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
                                                                    aria-invalid={Boolean(mappingErrors.weightPercent)}
                                                                />
                                                                <span>%</span>
                                                            </div>
                                                            <FieldError message={mappingErrors.weightPercent} />
                                                        </label>
                                                        <button
                                                            type="button"
                                                            className="free-elective-icon-button free-elective-icon-button--danger"
                                                            onClick={() => removeCompetency(courseIndex, competencyIndex)}
                                                            title={labels.removeCompetency}
                                                            aria-label={labels.removeCompetency}
                                                            disabled={saving}
                                                        >
                                                            <Trash2 size={15} aria-hidden="true" />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
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
                            {form.courses.map((course, index) => (
                                <article key={`${course.courseCode}-${index}`}>
                                    <div>
                                        <strong>{course.courseCode}</strong>
                                        <span>
                                            {language === 'en'
                                                ? course.courseNameEn || course.courseNameTh
                                                : course.courseNameTh}
                                        </span>
                                        <small>
                                            {labels.gradeScheme}:{' '}
                                            {getGradeSchemeLabel(course.gradeScheme, labels)}
                                        </small>
                                    </div>
                                    <span>
                                        {course.competencies.length} {labels.competencies}
                                    </span>
                                </article>
                            ))}
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
                            {labels.previous}
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
