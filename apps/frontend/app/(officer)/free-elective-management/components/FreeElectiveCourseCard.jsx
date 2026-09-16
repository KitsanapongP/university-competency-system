import { Edit3, Layers } from 'lucide-react';
import { freeElectiveText, localizedFreeElective } from '../free-elective-labels';

export default function FreeElectiveCourseCard({ course, language, onEdit }) {
    const label = (key) => freeElectiveText(language, key);

    return (
        <article className="free-elective-course-card">
            <div className="free-elective-course-card__header">
                <div className="free-elective-course-card__icon" aria-hidden="true">
                    <Layers size={19} />
                </div>
                <div>
                    <p className="free-elective-code">{course.code}</p>
                    <h2>{localizedFreeElective(course, language, 'nameTh', 'nameEn')}</h2>
                    <p>{localizedFreeElective(course, language, 'facultyNameTh', 'facultyNameEn')}</p>
                </div>
            </div>
            <div className="free-elective-course-card__body">
                <p>{course.description || label('noDescription')}</p>
                <div className="free-elective-course-card__details">
                    <span>
                        {label('credits')}: <strong>{course.credits}</strong>
                    </span>
                    <span>
                        {label('gradeScheme')}:{' '}
                        <strong>
                            {course.gradeScheme === 'satisfactory'
                                ? label('satisfactoryGrades')
                                : label('letterGrades')}
                        </strong>
                    </span>
                </div>
                <div className="free-elective-course-card__details">
                    <span>
                        {label('offerings')}: <strong>{course.offeringCount}</strong>
                    </span>
                    <span>{course.isActive ? label('activeCourse') : label('inactiveCourse')}</span>
                </div>
            </div>
            <div className="free-elective-course-card__footer">
                <button
                    type="button"
                    className="free-elective-link-button"
                    onClick={() => onEdit(course)}
                    title={label('courseEditTitle')}
                    aria-label={`${label('courseEditTitle')}: ${course.code}`}
                >
                    <Edit3 size={15} aria-hidden="true" />
                    {label('courseEditTitle')}
                </button>
            </div>
        </article>
    );
}
