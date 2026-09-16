import { useState } from 'react';
import { Save, UserRound } from 'lucide-react';
import { getFreeElectiveGradeOptions } from '../../../../lib/free-elective';
import { freeElectiveGradeSourceLabel, localizedFreeElective } from '../free-elective-labels';

export default function FreeElectiveGradeTable({
    enrollments,
    gradeScheme,
    canEdit,
    savingId,
    language,
    labels,
    onSaveGrade,
}) {
    const [draftGrades, setDraftGrades] = useState({});
    const gradeOptions = getFreeElectiveGradeOptions(gradeScheme);

    const gradeFor = (enrollment) => draftGrades[enrollment.id] ?? enrollment.grade;

    const setGrade = (enrollmentId, grade) => {
        setDraftGrades((current) => ({ ...current, [enrollmentId]: grade }));
    };

    const save = async (enrollment) => {
        const saved = await onSaveGrade(enrollment, gradeFor(enrollment));
        if (!saved) {
            return;
        }
        setDraftGrades((current) => {
            const next = { ...current };
            delete next[enrollment.id];
            return next;
        });
    };

    if (!enrollments.length) {
        return (
            <div className="free-elective-empty free-elective-panel__content">
                {labels.noEnrolledLearners}
            </div>
        );
    }

    return (
        <div className="free-elective-grade-table-wrap">
            <table className="free-elective-table free-elective-grade-table">
                <thead>
                    <tr>
                        <th>{labels.studentCode}</th>
                        <th>{labels.learnerName}</th>
                        <th>{labels.group}</th>
                        <th>{labels.grade}</th>
                        <th>{labels.gradeSource}</th>
                        <th>{labels.bestGrade}</th>
                        {canEdit && <th>{labels.manage}</th>}
                    </tr>
                </thead>
                <tbody>
                    {enrollments.map((enrollment) => {
                        const saving = savingId === enrollment.id;
                        const hasDraft = Object.prototype.hasOwnProperty.call(draftGrades, enrollment.id);
                        return (
                            <tr key={enrollment.id}>
                                <td>
                                    <strong>{enrollment.studentCode}</strong>
                                </td>
                                <td>
                                    <span className="free-elective-table__person">
                                        <UserRound size={14} aria-hidden="true" />
                                        {language === 'en'
                                            ? enrollment.studentNameEn || enrollment.studentNameTh
                                            : enrollment.studentNameTh}
                                    </span>
                                </td>
                                <td>
                                    <span className="free-elective-table__secondary">
                                        {localizedFreeElective(
                                            enrollment,
                                            language,
                                            'curriculumNameTh',
                                            'curriculumNameEn',
                                        )} · {enrollment.entryYearBE}
                                    </span>
                                </td>
                                <td>
                                    {canEdit ? (
                                        <select
                                            className="free-elective-grade-select"
                                            value={gradeFor(enrollment)}
                                            onChange={(event) => setGrade(enrollment.id, event.target.value)}
                                            disabled={saving}
                                        >
                                            <option value="">{labels.noGrade}</option>
                                            {gradeOptions.map((grade) => (
                                                <option key={grade} value={grade}>
                                                    {grade}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <strong className="free-elective-grade-value">{enrollment.grade || labels.noGrade}</strong>
                                    )}
                                </td>
                                <td>
                                    {enrollment.grade
                                        ? freeElectiveGradeSourceLabel(enrollment.gradeSource, language)
                                        : '-'}
                                </td>
                                <td>
                                    {enrollment.isBestGrade && enrollment.grade ? (
                                        <span className="free-elective-best-badge">{labels.bestGrade}</span>
                                    ) : (
                                        <span className="free-elective-table__secondary">-</span>
                                    )}
                                </td>
                                {canEdit && (
                                    <td>
                                        <button
                                            type="button"
                                            className="free-elective-icon-button free-elective-icon-button--success"
                                            onClick={() => save(enrollment)}
                                            disabled={saving || !hasDraft || !gradeFor(enrollment)}
                                            title={labels.saveGrade}
                                            aria-label={`${labels.saveGrade}: ${enrollment.studentCode}`}
                                        >
                                            <Save size={16} aria-hidden="true" />
                                        </button>
                                    </td>
                                )}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
