import { useEffect, useState } from 'react';
import { CheckSquare, Search, Users, X } from 'lucide-react';
import BaseModal from '../../../../components/ui/BaseModal';
import { fetchFreeElectiveRoundCourseLearners } from '../../../../lib/free-elective';
import { localizedFreeElective } from '../free-elective-labels';

export default function FreeElectiveRoundLearnerPickerModal({
    open,
    roundId,
    roundCourseId,
    enrolledIds,
    saving,
    language,
    labels,
    onClose,
    onSubmit,
}) {
    const [search, setSearch] = useState('');
    const [learners, setLearners] = useState([]);
    const [selected, setSelected] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!open) {
            return;
        }
        setSearch('');
        setLearners([]);
        setSelected({});
        setError('');
    }, [open]);

    useEffect(() => {
        if (!open || !roundId || !roundCourseId) {
            return undefined;
        }

        let cancelled = false;
        const timer = setTimeout(async () => {
            setLoading(true);
            setError('');
            try {
                const result = await fetchFreeElectiveRoundCourseLearners(
                    roundId,
                    roundCourseId,
                    search,
                );
                if (!cancelled) {
                    setLearners(result);
                }
            } catch (loadError) {
                if (!cancelled) {
                    setError(loadError.message || labels.roundLoadError);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }, 220);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [labels.roundLoadError, open, roundCourseId, roundId, search]);

    const toggleLearner = (learner) => {
        const key = String(learner.enrollmentId);
        setSelected((current) => {
            const next = { ...current };
            if (next[key]) {
                delete next[key];
            } else {
                next[key] = learner;
            }
            return next;
        });
    };

    const submit = () => {
        onSubmit(Object.values(selected));
    };

    return (
        <BaseModal
            open={open}
            title={labels.chooseLearners}
            icon={<Users size={18} />}
            size="lg"
            onClose={onClose}
            closeDisabled={saving}
        >
            <div className="free-elective-picker">
                <label className="free-elective-search-field">
                    <Search size={16} aria-hidden="true" />
                    <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder={labels.learnerSearch}
                        disabled={saving}
                    />
                </label>

                {error && (
                    <div className="free-elective-notice free-elective-notice--error" role="alert">
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="free-elective-loading" role="status">
                        {labels.loading}
                    </div>
                ) : learners.length ? (
                    <div className="free-elective-student-option-list">
                        {learners.map((learner) => {
                            const isSelected = Boolean(selected[String(learner.enrollmentId)]);
                            return (
                                <label
                                    key={learner.enrollmentId}
                                    className={`free-elective-student-option ${isSelected
                                        ? 'free-elective-student-option--selected'
                                        : ''}`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        disabled={saving || enrolledIds.has(learner.enrollmentId)}
                                        onChange={() => toggleLearner(learner)}
                                    />
                                    <span>
                                        <strong>{learner.studentCode}</strong>
                                        <small>
                                            {localizedFreeElective(
                                                learner,
                                                language,
                                                'studentNameTh',
                                                'studentNameEn',
                                            )}
                                        </small>
                                    </span>
                                    {enrolledIds.has(learner.enrollmentId) && (
                                        <em>{labels.groupSelectedCount}</em>
                                    )}
                                </label>
                            );
                        })}
                    </div>
                ) : (
                    <div className="free-elective-empty">
                        {labels.noLearners}
                    </div>
                )}

                <p className="free-elective-picker__selection">
                    <CheckSquare size={15} aria-hidden="true" />
                    {Object.keys(selected).length} {labels.selectedLearners}
                </p>

                <div className="free-elective-modal-actions">
                    <button
                        type="button"
                        className="free-elective-button free-elective-button--secondary"
                        onClick={onClose}
                        disabled={saving}
                    >
                        <X size={15} aria-hidden="true" />
                        {labels.cancel}
                    </button>
                    <button
                        type="button"
                        className="free-elective-button free-elective-button--primary"
                        onClick={submit}
                        disabled={saving || !Object.keys(selected).length}
                    >
                        <Users size={15} aria-hidden="true" />
                        {saving ? labels.loading : labels.addLearnersToCourse}
                    </button>
                </div>
            </div>
        </BaseModal>
    );
}
