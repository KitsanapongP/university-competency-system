import { useState } from 'react';
import { Plus, Search, Settings2, Trash2 } from 'lucide-react';
import { FREE_ELECTIVE_GRADE_SCHEMES } from '../../../../lib/free-elective';

function getCourseName(course, language) {
    return language === 'en'
        ? course.courseNameEn || course.courseNameTh
        : course.courseNameTh || course.courseNameEn;
}

function hasIncompleteCourse(course, rowErrors) {
    return Boolean(
        rowErrors.courseCode
        || rowErrors.courseNameTh
        || rowErrors.courseNameEn
        || rowErrors.credits
        || rowErrors.gradeScheme
        || rowErrors.competencies
        || (rowErrors.mappings || []).some((mapping) => mapping?.competencyId || mapping?.weightPercent)
        || !course.courseCode
        || !course.courseNameTh
        || !course.credits
        || !course.gradeScheme
        || !course.competencies.length
        || course.competencies.some((mapping) => (
            !mapping.competencyId
            || mapping.weightPercent === ''
            || Number.isNaN(Number(mapping.weightPercent))
            || Number(mapping.weightPercent) < 0
            || Number(mapping.weightPercent) > 100
        )),
    );
}

function InlineError({ message }) {
    if (!message) {
        return null;
    }

    return (
        <span className="free-elective-field__error" role="alert">
            {message}
        </span>
    );
}

export default function FreeElectiveRoundCourseTable({
    courses,
    fieldErrors,
    language,
    labels,
    saving,
    selectedCourseIndex,
    onSelectCourse,
    onAddCourse,
    onRemoveCourse,
    onUpdateCourseField,
    onResolveCatalogCourse,
    onOpenCompetencies,
    rowRefs,
}) {
    const [searchTerm, setSearchTerm] = useState('');
    const [showIncompleteOnly, setShowIncompleteOnly] = useState(false);

    const normalizedSearch = searchTerm.trim().toLowerCase();
    const visibleCourses = courses
        .map((course, index) => ({ course, index }))
        .filter(({ course, index }) => {
            const rowErrors = fieldErrors.rows[index] || {};
            const matchesSearch = !normalizedSearch || [
                course.courseCode,
                course.courseNameTh,
                course.courseNameEn,
            ].some((value) => String(value || '').toLowerCase().includes(normalizedSearch));
            const matchesIncomplete = !showIncompleteOnly
                || hasIncompleteCourse(course, rowErrors);
            return matchesSearch && matchesIncomplete;
        });

    return (
        <div className="free-elective-round-course-table">
            <div className="free-elective-round-course-table__toolbar">
                <label className="free-elective-search-field free-elective-round-course-table__search">
                    <Search size={16} aria-hidden="true" />
                    <span className="sr-only">{labels.searchRoundCourses}</span>
                    <input
                        type="search"
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder={labels.searchRoundCourses}
                        disabled={saving}
                    />
                </label>
                <label className="free-elective-checkbox free-elective-round-course-table__filter">
                    <input
                        type="checkbox"
                        checked={showIncompleteOnly}
                        onChange={(event) => setShowIncompleteOnly(event.target.checked)}
                        disabled={saving}
                    />
                    {labels.showIncompleteCourses}
                </label>
                <span className="free-elective-round-course-table__count">
                    {visibleCourses.length} / {courses.length} {labels.courseCount}
                </span>
                <button
                    type="button"
                    className="free-elective-button free-elective-button--secondary"
                    onClick={onAddCourse}
                    disabled={saving}
                >
                    <Plus size={16} aria-hidden="true" />
                    {labels.addCourseToRound}
                </button>
            </div>

            <div className="free-elective-round-course-table__scroll">
                <table className="free-elective-table free-elective-round-course-table__grid">
                    <colgroup>
                        <col className="free-elective-round-course-table__col--number" />
                        <col className="free-elective-round-course-table__col--code" />
                        <col className="free-elective-round-course-table__col--name" />
                        <col className="free-elective-round-course-table__col--name" />
                        <col className="free-elective-round-course-table__col--credits" />
                        <col className="free-elective-round-course-table__col--scheme" />
                        <col className="free-elective-round-course-table__col--competencies" />
                        <col className="free-elective-round-course-table__col--actions" />
                    </colgroup>
                    <thead>
                        <tr>
                            <th scope="col">#</th>
                            <th scope="col">{labels.code}</th>
                            <th scope="col">{labels.courseName} ({labels.thaiLanguage})</th>
                            <th scope="col">{labels.courseName} ({labels.englishLanguage})</th>
                            <th scope="col">{labels.credits}</th>
                            <th scope="col">{labels.gradeScheme}</th>
                            <th scope="col">{labels.courseCompetencies}</th>
                            <th scope="col">{labels.manage}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visibleCourses.map(({ course: item, index: courseIndex }) => {
                            const rowErrors = fieldErrors.rows[courseIndex] || {
                                courseCode: '',
                                courseNameTh: '',
                                courseNameEn: '',
                                credits: '',
                                gradeScheme: '',
                                competencies: '',
                                mappings: [],
                            };
                            const isCatalogCourse = Boolean(item.freeElectiveCourseId);
                            const isSelected = selectedCourseIndex === courseIndex;

                            return (
                                <tr
                                    key={`round-course-${courseIndex}`}
                                    ref={(element) => rowRefs(courseIndex, element)}
                                    className={isSelected ? 'is-selected' : ''}
                                    onClick={() => onSelectCourse(courseIndex)}
                                >
                                    <td className="free-elective-round-course-table__number">
                                        {courseIndex + 1}
                                    </td>
                                    <td>
                                        <label className="free-elective-table-field">
                                            <span className="sr-only">{labels.code}</span>
                                            <input
                                                value={item.courseCode}
                                                onChange={(event) => onUpdateCourseField(
                                                    courseIndex,
                                                    'courseCode',
                                                    event.target.value,
                                                )}
                                                onBlur={() => onResolveCatalogCourse(courseIndex)}
                                                placeholder={labels.codePlaceholder}
                                                disabled={saving}
                                                aria-invalid={Boolean(rowErrors.courseCode)}
                                            />
                                            <InlineError message={rowErrors.courseCode} />
                                        </label>
                                    </td>
                                    <td>
                                        <label className="free-elective-table-field">
                                            <span className="sr-only">{labels.courseName} ({labels.thaiLanguage})</span>
                                            <input
                                                value={item.courseNameTh}
                                                onChange={(event) => onUpdateCourseField(
                                                    courseIndex,
                                                    'courseNameTh',
                                                    event.target.value,
                                                )}
                                                disabled={saving || isCatalogCourse}
                                                aria-invalid={Boolean(rowErrors.courseNameTh)}
                                            />
                                            <InlineError message={rowErrors.courseNameTh} />
                                        </label>
                                    </td>
                                    <td>
                                        <label className="free-elective-table-field">
                                            <span className="sr-only">{labels.courseName} ({labels.englishLanguage})</span>
                                            <input
                                                value={item.courseNameEn}
                                                onChange={(event) => onUpdateCourseField(
                                                    courseIndex,
                                                    'courseNameEn',
                                                    event.target.value,
                                                )}
                                                disabled={saving || isCatalogCourse}
                                                aria-invalid={Boolean(rowErrors.courseNameEn)}
                                            />
                                            <InlineError message={rowErrors.courseNameEn} />
                                        </label>
                                    </td>
                                    <td>
                                        <label className="free-elective-table-field">
                                            <span className="sr-only">{labels.credits}</span>
                                            <input
                                                type="number"
                                                min="1"
                                                step="1"
                                                value={item.credits}
                                                onChange={(event) => onUpdateCourseField(
                                                    courseIndex,
                                                    'credits',
                                                    event.target.value,
                                                )}
                                                placeholder="1"
                                                disabled={saving || isCatalogCourse}
                                                aria-invalid={Boolean(rowErrors.credits)}
                                            />
                                            <InlineError message={rowErrors.credits} />
                                        </label>
                                    </td>
                                    <td>
                                        <label className="free-elective-table-field">
                                            <span className="sr-only">{labels.gradeScheme}</span>
                                            <select
                                                value={item.gradeScheme}
                                                onChange={(event) => onUpdateCourseField(
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
                                            <InlineError message={rowErrors.gradeScheme} />
                                        </label>
                                    </td>
                                    <td>
                                        <div className="free-elective-round-course-table__competencies">
                                            <span>
                                                {item.competencies.length
                                                    ? `${item.competencies.length} ${labels.competencies}`
                                                    : labels.noCompetencies}
                                            </span>
                                            <button
                                                type="button"
                                                className="free-elective-icon-button"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    onOpenCompetencies(courseIndex);
                                                }}
                                                title={labels.configureCompetencies}
                                                aria-label={`${labels.configureCompetencies}: ${getCourseName(item, language) || labels.course}`}
                                                disabled={saving}
                                            >
                                                <Settings2 size={15} aria-hidden="true" />
                                            </button>
                                        </div>
                                        <InlineError message={rowErrors.competencies} />
                                    </td>
                                    <td>
                                        <button
                                            type="button"
                                            className="free-elective-icon-button free-elective-icon-button--danger"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                onRemoveCourse(courseIndex);
                                            }}
                                            title={labels.removeCourse}
                                            aria-label={`${labels.removeCourse}: ${item.courseCode || courseIndex + 1}`}
                                            disabled={saving}
                                        >
                                            <Trash2 size={16} aria-hidden="true" />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {!visibleCourses.length && (
                    <div className="free-elective-empty free-elective-round-course-table__empty">
                        {courses.length ? labels.noMatchingRoundCourses : labels.noRoundCourses}
                    </div>
                )}
            </div>
        </div>
    );
}
