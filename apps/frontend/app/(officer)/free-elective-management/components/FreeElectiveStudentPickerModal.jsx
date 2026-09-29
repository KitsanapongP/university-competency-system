import { useMemo, useState } from 'react';
import { CheckSquare, Search, Users, X } from 'lucide-react';
import BaseModal from '../../../../components/ui/BaseModal';
import { localizedFreeElective } from '../free-elective-labels';

export default function FreeElectiveStudentPickerModal({
    open,
    groups,
    selectedGroupId,
    groupStudents,
    enrolledIds,
    loadingStudents,
    saving,
    language,
    labels,
    onGroupChange,
    onClose,
    onSubmit,
}) {
    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState(new Set());

    const availableStudents = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) {
            return groupStudents;
        }
        return groupStudents.filter((student) => {
            return `${student.studentCode} ${student.studentNameTh} ${student.studentNameEn}`
                .toLowerCase()
                .includes(term);
        });
    }, [groupStudents, search]);

    const toggleStudent = (student) => {
        setSelectedIds((current) => {
            const next = new Set(current);
            if (next.has(student.enrollmentId)) {
                next.delete(student.enrollmentId);
            } else {
                next.add(student.enrollmentId);
            }
            return next;
        });
    };

    const toggleAll = () => {
        const selectable = availableStudents.filter((student) => !enrolledIds.has(student.enrollmentId));
        const allSelected = selectable.length > 0 && selectable.every((student) => selectedIds.has(student.enrollmentId));
        setSelectedIds((current) => {
            const next = new Set(current);
            selectable.forEach((student) => {
                if (allSelected) {
                    next.delete(student.enrollmentId);
                } else {
                    next.add(student.enrollmentId);
                }
            });
            return next;
        });
    };

    const submit = () => {
        onSubmit(groupStudents.filter((student) => selectedIds.has(student.enrollmentId)));
    };

    return (
        <BaseModal
            open={open}
            title={labels.addLearners}
            icon={<Users size={18} />}
            size="lg"
            onClose={onClose}
            closeDisabled={saving}
        >
            <div className="free-elective-picker">
                <label className="free-elective-field">
                    <span>{labels.group}</span>
                    <select
                        value={selectedGroupId}
                        onChange={(event) => onGroupChange(event.target.value)}
                        disabled={saving}
                    >
                        <option value="">{labels.chooseGroup}</option>
                        {groups.map((group) => (
                            <option key={group.cohortId} value={group.cohortId}>
                                {localizedFreeElective(
                                    group,
                                    language,
                                    'curriculumNameTh',
                                    'curriculumNameEn',
                                )} · {group.entryYearBE}
                            </option>
                        ))}
                    </select>
                </label>
                {selectedGroupId && (
                    <>
                        <div className="free-elective-picker__toolbar">
                            <label className="free-elective-search-field">
                                <Search size={16} aria-hidden="true" />
                                <input
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder={labels.searchLearners}
                                    disabled={saving}
                                />
                            </label>
                            <div className="free-elective-inline-actions">
                                <button
                                    type="button"
                                    className="free-elective-button free-elective-button--quiet"
                                    onClick={toggleAll}
                                    disabled={saving || loadingStudents || !availableStudents.length}
                                >
                                    <CheckSquare size={15} aria-hidden="true" />
                                    {labels.selectAll}
                                </button>
                                <button
                                    type="button"
                                    className="free-elective-button free-elective-button--quiet"
                                    onClick={() => setSelectedIds(new Set())}
                                    disabled={saving || !selectedIds.size}
                                >
                                    <X size={15} aria-hidden="true" />
                                    {labels.clearAll}
                                </button>
                            </div>
                        </div>
                        {loadingStudents ? (
                            <div className="free-elective-loading">{labels.loading}</div>
                        ) : availableStudents.length ? (
                            <div className="free-elective-student-option-list">
                                {availableStudents.map((student) => {
                                    const isEnrolled = enrolledIds.has(student.enrollmentId);
                                    const isSelected = selectedIds.has(student.enrollmentId);
                                    return (
                                        <label
                                            key={student.enrollmentId}
                                            className={`free-elective-student-option ${isSelected
                                                ? 'free-elective-student-option--selected'
                                                : ''} ${isEnrolled
                                                ? 'free-elective-student-option--disabled'
                                                : ''}`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isSelected || isEnrolled}
                                                disabled={isEnrolled || saving}
                                                onChange={() => toggleStudent(student)}
                                            />
                                            <span>
                                                <strong>{student.studentCode}</strong>
                                                <small>
                                                    {localizedFreeElective(
                                                        student,
                                                        language,
                                                        'studentNameTh',
                                                        'studentNameEn',
                                                    )}
                                                </small>
                                            </span>
                                            {isEnrolled && <em>{labels.groupSelectedCount}</em>}
                                        </label>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="free-elective-empty">
                                {labels.noLearners}
                            </div>
                        )}
                    </>
                )}
                <p className="free-elective-picker__selection">
                    {selectedIds.size} {labels.selectedLearners}
                </p>
                <div className="free-elective-modal-actions">
                    <button
                        type="button"
                        className="free-elective-button free-elective-button--secondary"
                        onClick={onClose}
                        disabled={saving}
                    >
                        {labels.cancel}
                    </button>
                    <button
                        type="button"
                        className="free-elective-button free-elective-button--primary"
                        onClick={submit}
                        disabled={saving || !selectedIds.size}
                    >
                        {saving ? labels.loading : labels.addSelected}
                    </button>
                </div>
            </div>
        </BaseModal>
    );
}
