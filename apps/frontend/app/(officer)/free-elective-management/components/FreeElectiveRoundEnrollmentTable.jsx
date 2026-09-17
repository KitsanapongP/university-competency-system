import { useState } from 'react';
import { RotateCcw, Save, Trash2, UserRound } from 'lucide-react';
import { getFreeElectiveGradeOptions } from '../../../../lib/free-elective';
import {
    freeElectiveGradeSourceLabel,
    localizedFreeElective,
} from '../free-elective-labels';
import FreeElectiveEnrollmentStatusBadge from './FreeElectiveEnrollmentStatusBadge';

export default function FreeElectiveRoundEnrollmentTable({
    enrollments,
    gradeScheme,
    allowedGrades,
    canEdit,
    saving = false,
    savingId,
    language,
    labels,
    onSaveGrade,
    onWithdraw,
    onRestore,
}) {
    const [draftGrades, setDraftGrades] = useState({});
    const gradeOptions = allowedGrades?.length
        ? allowedGrades
        : getFreeElectiveGradeOptions(gradeScheme);

    const gradeFor = (enrollment) => draftGrades[enrollment.id] ?? enrollment.grade;

    const setGrade = (enrollmentId, grade) => {
        setDraftGrades((current) => ({ ...current, [enrollmentId]: grade }));
    };

    const saveGrade = async (enrollment) => {
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
                {labels.noRoundLearners}
            </div>
        );
    }

    return (
        <div className="free-elective-grade-table-wrap free-elective-round-enrollment-table-wrap">
            <table className="free-elective-table free-elective-grade-table">
                <thead>
                    <tr>
                        <th>{labels.studentCode}</th>
                        <th>{labels.learnerName}</th>
                        <th>{labels.curriculum}</th>
                        <th>{labels.entryYear}</th>
                        <th>{labels.learnerStatus}</th>
                        <th>{labels.grade}</th>
                        <th>{labels.gradeSource}</th>
                        <th>{labels.bestGrade}</th>
                        {canEdit && <th>{labels.manage}</th>}
                    </tr>
                </thead>
                <tbody>
                    {enrollments.map((enrollment) => {
                        const rowSaving = savingId === enrollment.id;
                        const hasDraft = Object.prototype.hasOwnProperty.call(
                            draftGrades,
                            enrollment.id,
                        );
                        const canEnterGrade = enrollment.status !== 'withdrawn';

                        return (
                            <tr key={enrollment.id}>
                                <td>
                                    <strong>{enrollment.studentCode}</strong>
                                </td>
                                <td>
                                    <span className="free-elective-table__person">
                                        <UserRound size={14} aria-hidden="true" />
                                        {localizedFreeElective(
                                            enrollment,
                                            language,
                                            'studentNameTh',
                                            'studentNameEn',
                                        )}
                                    </span>
                                </td>
                                <td>
                                    <span className="free-elective-table__secondary">
                                        {localizedFreeElective(
                                            enrollment,
                                            language,
                                            'curriculumNameTh',
                                            'curriculumNameEn',
                                        )}
                                    </span>
                                </td>
                                <td>{enrollment.entryYearBE || '-'}</td>
                                <td>
                                    <FreeElectiveEnrollmentStatusBadge
                                        status={enrollment.status}
                                        language={language}
                                    />
                                </td>
                                <td>
                                    {canEdit && canEnterGrade ? (
                                        <select
                                            className="free-elective-grade-select"
                                            value={gradeFor(enrollment)}
                                            onChange={(event) => setGrade(
                                                enrollment.id,
                                                event.target.value,
                                            )}
                                            disabled={saving || rowSaving}
                                            aria-label={`${labels.grade}: ${enrollment.studentCode}`}
                                        >
                                            <option value="">{labels.noGrade}</option>
                                            {gradeOptions.map((grade) => (
                                                <option key={grade} value={grade}>
                                                    {grade}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <strong className="free-elective-grade-value">
                                            {enrollment.grade || labels.noGrade}
                                        </strong>
                                    )}
                                </td>
                                <td>
                                    {enrollment.grade
                                        ? freeElectiveGradeSourceLabel(
                                            enrollment.gradeSource,
                                            language,
                                        )
                                        : '-'}
                                </td>
                                <td>
                                    {enrollment.isBestGrade && enrollment.grade ? (
                                        <span className="free-elective-best-badge">
                                            {labels.bestGrade}
                                        </span>
                                    ) : (
                                        <span className="free-elective-table__secondary">
                                            -
                                        </span>
                                    )}
                                </td>
                                {canEdit && (
                                    <td>
                                        <div className="free-elective-round-enrollment-actions">
                                            {canEnterGrade && (
                                                <button
                                                    type="button"
                                                    className="free-elective-icon-button free-elective-icon-button--success"
                                                    onClick={() => saveGrade(enrollment)}
                                                    disabled={saving || rowSaving || !hasDraft || !gradeFor(enrollment)}
                                                    title={labels.saveGrade}
                                                    aria-label={`${labels.saveGrade}: ${enrollment.studentCode}`}
                                                >
                                                    <Save size={16} aria-hidden="true" />
                                                </button>
                                            )}
                                            {enrollment.status === 'withdrawn' ? (
                                                <button
                                                    type="button"
                                                    className="free-elective-icon-button free-elective-icon-button--success"
                                                    onClick={() => onRestore(enrollment)}
                                                    disabled={saving || rowSaving}
                                                    title={labels.restoreLearner}
                                                    aria-label={`${labels.restoreLearner}: ${enrollment.studentCode}`}
                                                >
                                                    <RotateCcw size={16} aria-hidden="true" />
                                                </button>
                                            ) : enrollment.status !== 'completed' ? (
                                                <button
                                                    type="button"
                                                    className="free-elective-icon-button free-elective-icon-button--danger"
                                                    onClick={() => onWithdraw(enrollment)}
                                                    disabled={saving || rowSaving}
                                                    title={labels.withdrawLearner}
                                                    aria-label={`${labels.withdrawLearner}: ${enrollment.studentCode}`}
                                                >
                                                    <Trash2 size={16} aria-hidden="true" />
                                                </button>
                                            ) : null}
                                        </div>
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
