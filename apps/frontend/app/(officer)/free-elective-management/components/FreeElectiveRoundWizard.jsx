import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown } from 'lucide-react';
import BaseModal from '../../../../components/ui/BaseModal';
import { FREE_ELECTIVE_GRADE_SCHEMES } from '../../../../lib/free-elective';
import FreeElectiveRoundCompetencyPanel from './FreeElectiveRoundCompetencyPanel';
import FreeElectiveRoundCourseTable from './FreeElectiveRoundCourseTable';

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

function getCompetencyName(competency, language, labels) {
    if (!competency) {
        return labels.unknownCompetency;
    }

    return language === 'en'
        ? competency.nameEn || competency.nameTh || labels.unknownCompetency
        : competency.nameTh || competency.nameEn || labels.unknownCompetency;
}

function getReviewCompetencies(course, competencies, language, labels) {
    return course.competencies
        .map((mapping, index) => {
            const competency = competencies.find(
                (item) => String(item.id) === String(mapping.competencyId),
            );

            return {
                id: mapping.competencyId,
                name: getCompetencyName(competency, language, labels),
                weightPercent: Number(mapping.weightPercent),
                index,
            };
        })
        .sort((left, right) => (
            right.weightPercent - left.weightPercent || left.index - right.index
        ));
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

function ReviewCourseItem({
    course,
    courseIndex,
    competencies,
    language,
    labels,
    isExpanded,
    onToggle,
}) {
    const reviewCompetencies = getReviewCompetencies(
        course,
        competencies,
        language,
        labels,
    );
    const competencyPanelId = `free-elective-review-course-${courseIndex}-competencies`;

    return (
        <article>
            <button
                type="button"
                className="free-elective-round-review-list__course-toggle"
                onClick={() => onToggle(courseIndex)}
                aria-expanded={isExpanded}
                aria-controls={competencyPanelId}
                title={isExpanded
                    ? labels.collapseCompetencies
                    : labels.expandCompetencies}
                aria-label={`${isExpanded
                    ? labels.collapseCompetencies
                    : labels.expandCompetencies}: ${course.courseCode}`}
            >
                <span className="free-elective-round-review-list__course-summary">
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
                </span>
                <span className="free-elective-round-review-list__course-meta">
                    <span>
                        {reviewCompetencies.length} {labels.competencies}
                    </span>
                    <ChevronDown
                        size={18}
                        aria-hidden="true"
                        className={isExpanded ? 'is-expanded' : ''}
                    />
                </span>
            </button>
            {isExpanded && (
                <div
                    id={competencyPanelId}
                    className="free-elective-round-review-list__competencies"
                >
                    <span className="free-elective-round-review-list__competencies-heading">
                        {labels.reviewCompetencies}
                    </span>
                    {reviewCompetencies.length ? (
                        <ul>
                            {reviewCompetencies.map((item) => (
                                <li key={`${item.id}-${item.index}`}>
                                    <span>{item.name}</span>
                                    <strong>{item.weightPercent}%</strong>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p>{labels.noCompetencies}</p>
                    )}
                </div>
            )}
        </article>
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
    onRefreshCompetencies,
    onSubmit,
}) {
    const [step, setStep] = useState(1);
    const [form, setForm] = useState(initialForm);
    const [fieldErrors, setFieldErrors] = useState(createFieldErrors());
    const [preview, setPreview] = useState(null);
    const [previewing, setPreviewing] = useState(false);
    const [selectedCourseIndex, setSelectedCourseIndex] = useState(null);
    const [expandedReviewCourses, setExpandedReviewCourses] = useState(() => new Set());
    const courseRowRefs = useRef({});
    const competencyManagementContextRef = useRef(null);
    const competencyRefreshInFlightRef = useRef(false);

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
        const newCourseIndex = form.courses.length;
        setForm((current) => ({
            ...current,
            courses: [...current.courses, createCourseRow()],
        }));
        setFieldErrors((current) => ({
            ...current,
            courses: '',
            rows: [...current.rows, createRowErrors()],
        }));
        setSelectedCourseIndex(newCourseIndex);
        requestAnimationFrame(() => {
            courseRowRefs.current[newCourseIndex]?.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
            });
        });
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
        setSelectedCourseIndex((current) => {
            if (current === index) {
                return null;
            }
            return current > index ? current - 1 : current;
        });
        delete courseRowRefs.current[index];
    };

    const setCourseRowRef = (index, element) => {
        if (element) {
            courseRowRefs.current[index] = element;
            return;
        }
        delete courseRowRefs.current[index];
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

    const addCreatedCompetencyToCourse = useCallback((courseIndex, competencyId) => {
        const currentCourse = form.courses[courseIndex];
        if (!currentCourse || currentCourse.competencies.some(
            (mapping) => String(mapping.competencyId) === String(competencyId),
        )) {
            return;
        }

        const blankMappingIndex = currentCourse.competencies.findIndex(
            (mapping) => !mapping.competencyId,
        );
        const mappingIndex = blankMappingIndex >= 0
            ? blankMappingIndex
            : currentCourse.competencies.length;

        setForm((current) => ({
            ...current,
            courses: current.courses.map((course, rowIndex) => {
                if (rowIndex !== courseIndex) {
                    return course;
                }

                const nextCompetencies = [...course.competencies];
                if (mappingIndex < nextCompetencies.length) {
                    nextCompetencies[mappingIndex] = {
                        ...nextCompetencies[mappingIndex],
                        competencyId: String(competencyId),
                    };
                } else {
                    nextCompetencies.push({
                        competencyId: String(competencyId),
                        weightPercent: 0,
                    });
                }

                return { ...course, competencies: nextCompetencies };
            }),
        }));
        setFieldErrors((current) => ({
            ...current,
            rows: current.rows.map((row, rowIndex) => {
                if (rowIndex !== courseIndex) {
                    return row;
                }

                const nextMappings = [...row.mappings];
                if (mappingIndex < nextMappings.length) {
                    nextMappings[mappingIndex] = {
                        ...nextMappings[mappingIndex],
                        competencyId: '',
                    };
                } else {
                    nextMappings.push({ competencyId: '', weightPercent: '' });
                }

                return {
                    ...row,
                    competencies: '',
                    mappings: nextMappings,
                };
            }),
        }));
    }, [form]);

    const openCompetencyManagement = () => {
        if (selectedCourseIndex === null) {
            return;
        }

        competencyManagementContextRef.current = {
            courseIndex: selectedCourseIndex,
            competencyIds: new Set(
                competencies.map((competency) => String(competency.id)),
            ),
        };

        const competencyWindow = window.open(
            '/competency-management',
            '_blank',
            'noopener,noreferrer',
        );
        if (!competencyWindow) {
            competencyManagementContextRef.current = null;
        }
    };

    useEffect(() => {
        if (!open || !onRefreshCompetencies) {
            return undefined;
        }

        const handleWindowFocus = async () => {
            const context = competencyManagementContextRef.current;
            if (!context || competencyRefreshInFlightRef.current) {
                return;
            }

            competencyRefreshInFlightRef.current = true;
            try {
                const refreshedCompetencies = await onRefreshCompetencies();
                const createdCompetency = (Array.isArray(refreshedCompetencies)
                    ? refreshedCompetencies
                    : [])
                    .filter((competency) => !context.competencyIds.has(String(competency.id)))
                    .at(-1);

                if (createdCompetency) {
                    addCreatedCompetencyToCourse(context.courseIndex, createdCompetency.id);
                }
            } finally {
                competencyRefreshInFlightRef.current = false;
                competencyManagementContextRef.current = null;
            }
        };

        window.addEventListener('focus', handleWindowFocus);
        return () => window.removeEventListener('focus', handleWindowFocus);
    }, [addCreatedCompetencyToCourse, onRefreshCompetencies, open]);

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
            setExpandedReviewCourses(new Set(
                normalizedCourses.map((_, index) => index),
            ));
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

    const toggleReviewCourse = (courseIndex) => {
        setExpandedReviewCourses((current) => {
            const next = new Set(current);
            if (next.has(courseIndex)) {
                next.delete(courseIndex);
            } else {
                next.add(courseIndex);
            }
            return next;
        });
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
            size={step === 2 ? 'xxl' : 'lg'}
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
                        </div>
                        <FieldError
                            id="free-elective-round-courses-error"
                            message={fieldErrors.courses}
                        />
                        <div className="free-elective-round-course-workspace">
                            <FreeElectiveRoundCourseTable
                                courses={form.courses}
                                fieldErrors={fieldErrors}
                                language={language}
                                labels={labels}
                                saving={saving}
                                selectedCourseIndex={selectedCourseIndex}
                                onSelectCourse={setSelectedCourseIndex}
                                onAddCourse={addCourseRow}
                                onRemoveCourse={removeCourseRow}
                                onUpdateCourseField={updateCourseField}
                                onResolveCatalogCourse={resolveCatalogCourse}
                                onOpenCompetencies={setSelectedCourseIndex}
                                rowRefs={setCourseRowRef}
                            />
                            <FreeElectiveRoundCompetencyPanel
                                course={selectedCourseIndex === null
                                    ? null
                                    : form.courses[selectedCourseIndex]}
                                courseIndex={selectedCourseIndex}
                                rowErrors={selectedCourseIndex === null
                                    ? createRowErrors()
                                    : fieldErrors.rows[selectedCourseIndex] || createRowErrors()}
                                competencies={competencies}
                                language={language}
                                labels={labels}
                                saving={saving}
                                onAddCompetency={addCompetency}
                                onOpenCompetencyManagement={openCompetencyManagement}
                                onUpdateCompetency={updateCompetency}
                                onRemoveCompetency={removeCompetency}
                                onClose={() => setSelectedCourseIndex(null)}
                            />
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
                                <ReviewCourseItem
                                    key={`${course.courseCode}-${index}`}
                                    course={course}
                                    courseIndex={index}
                                    competencies={competencies}
                                    language={language}
                                    labels={labels}
                                    isExpanded={expandedReviewCourses.has(index)}
                                    onToggle={toggleReviewCourse}
                                />
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
