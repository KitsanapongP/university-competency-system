import { useEffect, useRef, useState } from 'react';
import { Save, Trash2 } from 'lucide-react';
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
    onDelete,
    selectedIds = new Set(),
    allVisibleSelected = false,
    someVisibleSelected = false,
    onToggleSelection,
    onToggleSelectAll,
    emptyLabel = labels.noRoundLearners,
}) {
    const [draftGrades, setDraftGrades] = useState({});
    const selectAllCheckboxRef = useRef(null);
    const gradeOptions = allowedGrades?.length
        ? allowedGrades
        : getFreeElectiveGradeOptions(gradeScheme);

    useEffect(() => {
        if (selectAllCheckboxRef.current) {
            selectAllCheckboxRef.current.indeterminate = someVisibleSelected
                && !allVisibleSelected;
        }
    }, [allVisibleSelected, someVisibleSelected]);

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
                {emptyLabel}
            </div>
        );
    }

    return (
        <div className="free-elective-grade-table-wrap free-elective-round-enrollment-table-wrap">
            <table className="free-elective-table free-elective-grade-table">
                <thead>
                    <tr>
                        {canEdit && (
                            <th className="free-elective-round-enrollment-table__selection">
                                <input
                                    ref={selectAllCheckboxRef}
                                    type="checkbox"
                                    checked={allVisibleSelected}
                                    onChange={onToggleSelectAll}
                                    disabled={saving || !enrollments.length}
                                    aria-label={labels.selectVisibleLearners}
                                    title={labels.selectVisibleLearners}
                                />
                            </th>
                        )}
                        <th>{labels.sequence}</th>
                        <th>{labels.studentCode}</th>
                        <th>{labels.learnerName}</th>
                        <th>{labels.curriculum}</th>
                        <th>{labels.major}</th>
                        <th>{labels.faculty}</th>
                        <th>{labels.entryYear}</th>
                        <th>{labels.learnerStatus}</th>
                        <th>{labels.grade}</th>
                        <th>{labels.gradeSource}</th>
                        <th>{labels.bestGrade}</th>
                        {canEdit && <th>{labels.manage}</th>}
                    </tr>
                </thead>
                <tbody>
                    {enrollments.map((enrollment, index) => {
                        const rowSaving = savingId === enrollment.id;
                        const hasDraft = Object.prototype.hasOwnProperty.call(
                            draftGrades,
                            enrollment.id,
                        );
                        const canEnterGrade = enrollment.status !== 'withdrawn';

                        return (
                            <tr key={enrollment.id}>
                                {canEdit && (
                                    <td className="free-elective-round-enrollment-table__selection">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(String(enrollment.id))}
                                            onChange={() => onToggleSelection(enrollment)}
                                            disabled={saving || rowSaving}
                                            aria-label={`${labels.selectLearner}: ${enrollment.studentCode}`}
                                        />
                                    </td>
                                )}
                                <td>{index + 1}</td>
                                <td>
                                    <strong>{enrollment.studentCode}</strong>
                                </td>
                                <td>
                                    <span className="free-elective-table__person">
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
                                <td>
                                    <span className="free-elective-table__secondary">
                                        {localizedFreeElective(
                                            enrollment,
                                            language,
                                            'majorNameTh',
                                            'majorNameEn',
                                        ) || '-'}
                                    </span>
                                </td>
                                <td>
                                    <span className="free-elective-table__secondary">
                                        {localizedFreeElective(
                                            enrollment,
                                            language,
                                            'facultyNameTh',
                                            'facultyNameEn',
                                        ) || '-'}
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
                                            <button
                                                type="button"
                                                className="free-elective-icon-button free-elective-icon-button--danger"
                                                onClick={() => onDelete(enrollment)}
                                                disabled={saving || rowSaving}
                                                title={labels.deleteLearner}
                                                aria-label={`${labels.deleteLearner}: ${enrollment.studentCode}`}
                                            >
                                                <Trash2 size={16} aria-hidden="true" />
                                            </button>
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
