import { ArrowRight, BookOpen, ClipboardList, GraduationCap, Scale } from 'lucide-react';
import { formatFreeElectiveTerm, freeElectiveText } from '../free-elective-labels';
import FreeElectiveStatusBadge from './FreeElectiveStatusBadge';

export default function FreeElectiveOfferingCard({ offering, language, onManage }) {
    const label = (key) => freeElectiveText(language, key);

    return (
        <article className="free-elective-offering-card">
            <div className="free-elective-offering-card__header">
                <div className="free-elective-offering-card__icon" aria-hidden="true">
                    <BookOpen size={19} />
                </div>
                <div>
                    <p className="free-elective-code">{offering.courseCode}</p>
                    <h2>
                        {language === 'en'
                            ? offering.courseNameEn || offering.courseNameTh
                            : offering.courseNameTh}
                    </h2>
                    <p>
                        {formatFreeElectiveTerm(offering.academicYearBE, offering.semester, language)} ·{' '}
                        {label('section')} {offering.sectionNo}
                    </p>
                </div>
            </div>
            <div className="free-elective-offering-card__body">
                <div className="free-elective-metric">
                    <span>
                        <GraduationCap size={14} />
                        {label('students')}
                    </span>
                    <strong>{offering.studentCount}</strong>
                </div>
                <div className="free-elective-metric">
                    <span>
                        <ClipboardList size={14} />
                        {label('graded')}
                    </span>
                    <strong>{offering.gradedStudentCount}</strong>
                </div>
                <div className="free-elective-metric">
                    <span>
                        <Scale size={14} />
                        {label('competencies')}
                    </span>
                    <strong>{offering.competencyCount}</strong>
                </div>
                <div className="free-elective-metric">
                    <span>{label('gradeScheme')}</span>
                    <strong className="free-elective-metric__accent">
                        {offering.gradeScheme === 'satisfactory'
                            ? label('satisfactoryGrades')
                            : label('letterGrades')}
                    </strong>
                </div>
            </div>
            <div className="free-elective-offering-card__footer">
                <FreeElectiveStatusBadge status={offering.status} language={language} />
                <button
                    type="button"
                    className="free-elective-link-button"
                    onClick={() => onManage(offering.offeringId)}
                >
                    {label('manage')}
                    <ArrowRight size={15} aria-hidden="true" />
                </button>
            </div>
        </article>
    );
}
