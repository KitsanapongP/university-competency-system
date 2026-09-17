import {
    ArrowRight,
    BookOpen,
    CheckCircle2,
    GraduationCap,
    Users,
} from 'lucide-react';
import {
    freeElectiveText,
    localizedFreeElective,
} from '../free-elective-labels';

function gradeSchemeLabel(course, labels) {
    return course.gradeScheme === 'satisfactory'
        ? labels.satisfactoryGrades
        : labels.letterGrades;
}

export default function FreeElectiveRoundCourseCard({
    course,
    language,
    labels,
    onManage,
}) {
    const label = (key) => freeElectiveText(language, key);

    return (
        <article className="free-elective-round-course-card">
            <div className="free-elective-round-course-card__header">
                <div className="free-elective-round-course-card__icon" aria-hidden="true">
                    <BookOpen size={19} />
                </div>
                <div className="free-elective-round-course-card__identity">
                    <p className="free-elective-code">{course.courseCode}</p>
                    <h2>
                        {localizedFreeElective(
                            course,
                            language,
                            'courseNameTh',
                            'courseNameEn',
                        )}
                    </h2>
                </div>
            </div>

            <div className="free-elective-round-course-card__meta">
                <span>
                    {labels.credits}: <strong>{course.credits}</strong>
                </span>
                <span>
                    {labels.gradeScheme}: <strong>{gradeSchemeLabel(course, labels)}</strong>
                </span>
            </div>

            <div className="free-elective-round-course-card__competencies">
                <div className="free-elective-round-course-card__section-label">
                    <span>{labels.competencies}</span>
                    <span>{course.competencies?.length || 0}</span>
                </div>
                {course.competencies?.length ? (
                    <ul>
                        {course.competencies.map((competency) => (
                            <li key={competency.id}>
                                <span>
                                    <CheckCircle2 size={13} aria-hidden="true" />
                                    {localizedFreeElective(
                                        competency,
                                        language,
                                        'nameTh',
                                        'nameEn',
                                    )}
                                </span>
                                <strong>{competency.weightPercent}%</strong>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="free-elective-table__secondary">
                        {labels.noCompetencies}
                    </p>
                )}
            </div>

            <div className="free-elective-round-course-card__stats">
                <span>
                    <Users size={14} aria-hidden="true" />
                    {labels.courseLearnerCount}
                    <strong>{course.studentCount}</strong>
                </span>
                <span>
                    <GraduationCap size={14} aria-hidden="true" />
                    {labels.courseGradeCount}
                    <strong>{course.gradedStudentCount}</strong>
                </span>
            </div>

            <div className="free-elective-round-course-card__footer">
                <span className="free-elective-table__secondary">
                    {label('roundCourseManagement')}
                </span>
                <button
                    type="button"
                    className="free-elective-link-button"
                    onClick={() => onManage(course.roundCourseId)}
                    title={labels.manage}
                    aria-label={`${labels.manage}: ${course.courseCode}`}
                >
                    {labels.manage}
                    <ArrowRight size={15} aria-hidden="true" />
                </button>
            </div>
        </article>
    );
}
