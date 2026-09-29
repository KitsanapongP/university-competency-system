import {
    ArrowRight,
    BookOpen,
    ClipboardCheck,
    GraduationCap,
    Layers,
} from 'lucide-react';
import { formatFreeElectiveTerm, freeElectiveText } from '../free-elective-labels';
import FreeElectiveStatusBadge from './FreeElectiveStatusBadge';

export default function FreeElectiveRoundCard({ round, language, onManage }) {
    const label = (key) => freeElectiveText(language, key);
    const facultyName = language === 'en'
        ? round.facultyNameEn || round.facultyNameTh
        : round.facultyNameTh;

    return (
        <article className="free-elective-round-card">
            <div className="free-elective-round-card__header">
                <div className="free-elective-round-card__icon" aria-hidden="true">
                    <Layers size={20} />
                </div>
                <div>
                    <p className="free-elective-eyebrow">{label('round')}</p>
                    <h2>
                        {formatFreeElectiveTerm(
                            round.academicYearBE,
                            round.semester,
                            language,
                        )}
                    </h2>
                    <p>{facultyName}</p>
                </div>
            </div>
            <div className="free-elective-round-card__body">
                <div className="free-elective-metric">
                    <span>
                        <BookOpen size={14} />
                        {label('courseCount')}
                    </span>
                    <strong>{round.courseCount}</strong>
                </div>
                <div className="free-elective-metric">
                    <span>
                        <GraduationCap size={14} />
                        {label('learnerCountShort')}
                    </span>
                    <strong>{round.learnerCount}</strong>
                </div>
                <div className="free-elective-metric">
                    <span>
                        <ClipboardCheck size={14} />
                        {label('gradeCountShort')}
                    </span>
                    <strong>{round.gradeCount}</strong>
                </div>
                <div className="free-elective-round-card__note">
                    {label('roundCardHint')}
                </div>
            </div>
            <div className="free-elective-round-card__footer">
                <FreeElectiveStatusBadge status={round.status} language={language} />
                <button
                    type="button"
                    className="free-elective-link-button"
                    onClick={() => onManage(round.roundId)}
                    title={label('manageRound')}
                >
                    {label('manage')}
                    <ArrowRight size={15} aria-hidden="true" />
                </button>
            </div>
        </article>
    );
}

