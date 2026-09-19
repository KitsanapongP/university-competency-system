import { useEffect, useMemo, useState } from 'react';
import { CheckSquare, Search, Users, X } from 'lucide-react';
import BaseModal from '../../../../components/ui/BaseModal';
import {
    fetchFreeElectiveRoundCourseLearnerSummary,
    fetchFreeElectiveRoundCourseLearners,
    fetchFreeElectiveStudentGroups,
} from '../../../../lib/free-elective';
import { localizedFreeElective } from '../free-elective-labels';

const EMPTY_FILTERS = {
    facultyId: '',
    majorId: '',
    curriculumId: '',
    entryYearBE: '',
};

function uniqueOptions(items, idKey, nameThKey, nameEnKey) {
    const options = new Map();
    items.forEach((item) => {
        const id = item?.[idKey];
        if (id === undefined || id === null || id === '') {
            return;
        }
        const key = String(id);
        if (!options.has(key)) {
            options.set(key, {
                id: key,
                nameTh: item[nameThKey] || '',
                nameEn: item[nameEnKey] || '',
            });
        }
    });
    return Array.from(options.values());
}

function filterGroups(groups, filters, field) {
    return groups.filter((group) => {
        if (field !== 'facultyId' && filters.facultyId
            && String(group.facultyId) !== String(filters.facultyId)) {
            return false;
        }
        if (field !== 'majorId' && filters.majorId
            && String(group.majorId) !== String(filters.majorId)) {
            return false;
        }
        if (field !== 'curriculumId' && filters.curriculumId
            && String(group.curriculumId) !== String(filters.curriculumId)) {
            return false;
        }
        if (field !== 'entryYearBE' && filters.entryYearBE
            && String(group.entryYearBE) !== String(filters.entryYearBE)) {
            return false;
        }
        return true;
    });
}

export default function FreeElectiveRoundLearnerPickerModal({
    open,
    roundId,
    roundCourseId,
    enrolledIds,
    saving,
    language,
    labels,
    isAdmin,
    lockedFacultyId,
    lockedFacultyName,
    onClose,
    onSubmit,
    onSubmitAll,
}) {
    const [search, setSearch] = useState('');
    const [learners, setLearners] = useState([]);
    const [groups, setGroups] = useState([]);
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [selected, setSelected] = useState({});
    const [loading, setLoading] = useState(false);
    const [groupsLoading, setGroupsLoading] = useState(false);
    const [error, setError] = useState('');
    const [summary, setSummary] = useState({ selectableCount: 0 });

    useEffect(() => {
        if (!open) {
            return;
        }
        const initialFacultyId = isAdmin ? '' : String(lockedFacultyId || '');
        setSearch('');
        setLearners([]);
        setGroups([]);
        setFilters({ ...EMPTY_FILTERS, facultyId: initialFacultyId });
        setSelected({});
        setSummary({ selectableCount: 0 });
        setError('');

        let cancelled = false;
        setGroupsLoading(true);
        fetchFreeElectiveStudentGroups(isAdmin || !lockedFacultyId
            ? {}
            : { facultyId: lockedFacultyId })
            .then((result) => {
                if (!cancelled) {
                    setGroups(result);
                }
            })
            .catch((loadError) => {
                if (!cancelled) {
                    setError(loadError.message || labels.roundLoadError);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setGroupsLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [isAdmin, labels.roundLoadError, lockedFacultyId, open]);

    const facultyOptions = useMemo(
        () => uniqueOptions(groups, 'facultyId', 'facultyNameTh', 'facultyNameEn'),
        [groups],
    );
    const majorOptions = useMemo(
        () => uniqueOptions(
            filterGroups(groups, filters, 'majorId'),
            'majorId',
            'majorNameTh',
            'majorNameEn',
        ),
        [filters, groups],
    );
    const curriculumOptions = useMemo(
        () => uniqueOptions(
            filterGroups(groups, filters, 'curriculumId'),
            'curriculumId',
            'curriculumNameTh',
            'curriculumNameEn',
        ),
        [filters, groups],
    );
    const entryYearOptions = useMemo(() => {
        const options = new Set(
            filterGroups(groups, filters, 'entryYearBE')
                .map((group) => String(group.entryYearBE))
                .filter(Boolean),
        );
        return Array.from(options).sort((left, right) => Number(right) - Number(left));
    }, [filters, groups]);

    const hasRequiredScope = Boolean(filters.curriculumId && filters.entryYearBE);

    useEffect(() => {
        if (!open || !roundId || !roundCourseId || !hasRequiredScope) {
            setLearners([]);
            setSummary({ selectableCount: 0 });
            return undefined;
        }

        let cancelled = false;
        const timer = setTimeout(async () => {
            setLoading(true);
            setError('');
            const requestFilters = { ...filters, search };
            try {
                const [nextLearners, nextSummary] = await Promise.all([
                    fetchFreeElectiveRoundCourseLearners(
                        roundId,
                        roundCourseId,
                        requestFilters,
                    ),
                    fetchFreeElectiveRoundCourseLearnerSummary(
                        roundId,
                        roundCourseId,
                        requestFilters,
                    ),
                ]);
                if (!cancelled) {
                    setLearners(nextLearners);
                    setSummary(nextSummary);
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
    }, [filters, hasRequiredScope, labels.roundLoadError, open, roundCourseId, roundId, search]);

    const handleFilterChange = (field, value) => {
        setFilters((current) => {
            const next = { ...current, [field]: value };
            if (field === 'facultyId') {
                next.majorId = '';
                next.curriculumId = '';
                next.entryYearBE = '';
            }
            if (field === 'majorId') {
                next.curriculumId = '';
                next.entryYearBE = '';
            }
            if (field === 'curriculumId') {
                next.entryYearBE = '';
            }
            return next;
        });
        setSelected({});
        setSearch('');
    };

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

    const isEnrolled = (learner) => enrolledIds.has(String(learner.enrollmentId));
    const selectedCount = Object.keys(selected).length;
    const submit = () => onSubmit(Object.values(selected));
    const submitAll = () => onSubmitAll({ ...filters, search });

    const optionLabel = (option) => localizedFreeElective(
        option,
        language,
        'nameTh',
        'nameEn',
    );

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
                <div className="free-elective-picker__filters">
                    <div className="free-elective-picker__filter-heading">
                        <strong>{labels.learnerFilters}</strong>
                        <span>{labels.learnerFilterHint}</span>
                    </div>
                    <div className="free-elective-picker__filter-grid">
                        {isAdmin ? (
                            <label className="free-elective-field">
                                <span>{labels.faculty}</span>
                                <select
                                    value={filters.facultyId}
                                    onChange={(event) => handleFilterChange('facultyId', event.target.value)}
                                    disabled={saving || groupsLoading}
                                >
                                    <option value="">{labels.allFaculties}</option>
                                    {facultyOptions.map((option) => (
                                        <option key={option.id} value={option.id}>
                                            {optionLabel(option)}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        ) : (
                            <div className="free-elective-picker__locked-scope">
                                <span>{labels.faculty}</span>
                                <strong>{lockedFacultyName || labels.signInScope}</strong>
                            </div>
                        )}
                        <label className="free-elective-field">
                            <span>{labels.major}</span>
                            <select
                                value={filters.majorId}
                                onChange={(event) => handleFilterChange('majorId', event.target.value)}
                                disabled={saving || groupsLoading}
                            >
                                <option value="">{labels.allMajors}</option>
                                {majorOptions.map((option) => (
                                    <option key={option.id} value={option.id}>
                                        {optionLabel(option)}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="free-elective-field">
                            <span>{labels.curriculum}</span>
                            <select
                                value={filters.curriculumId}
                                onChange={(event) => handleFilterChange('curriculumId', event.target.value)}
                                disabled={saving || groupsLoading}
                            >
                                <option value="">{labels.allCurriculums}</option>
                                {curriculumOptions.map((option) => (
                                    <option key={option.id} value={option.id}>
                                        {optionLabel(option)}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="free-elective-field">
                            <span>{labels.entryYear}</span>
                            <select
                                value={filters.entryYearBE}
                                onChange={(event) => handleFilterChange('entryYearBE', event.target.value)}
                                disabled={saving || groupsLoading}
                            >
                                <option value="">{labels.allEntryYears}</option>
                                {entryYearOptions.map((year) => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        </label>
                    </div>
                </div>

                <label className="free-elective-search-field">
                    <Search size={16} aria-hidden="true" />
                    <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder={labels.learnerSearch}
                        disabled={saving || !hasRequiredScope}
                    />
                </label>

                {error && (
                    <div className="free-elective-notice free-elective-notice--error" role="alert">
                        {error}
                    </div>
                )}

                {!hasRequiredScope ? (
                    <div className="free-elective-empty">
                        {labels.selectLearnerScopeHint}
                    </div>
                ) : loading ? (
                    <div className="free-elective-loading" role="status">
                        {labels.loading}
                    </div>
                ) : learners.length ? (
                    <div className="free-elective-student-option-list">
                        {learners.map((learner) => {
                            const key = String(learner.enrollmentId);
                            const isSelected = Boolean(selected[key]);
                            return (
                                <label
                                    key={key}
                                    className={`free-elective-student-option ${isSelected
                                        ? 'free-elective-student-option--selected'
                                        : ''}`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        disabled={saving || isEnrolled(learner)}
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
                                    {isEnrolled(learner) && (
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

                <div className="free-elective-picker__bulk-actions">
                    <button
                        type="button"
                        className="free-elective-button free-elective-button--quiet"
                        onClick={submitAll}
                        disabled={saving || !hasRequiredScope || !summary.selectableCount}
                    >
                        <Users size={15} aria-hidden="true" />
                        {labels.selectAllFiltered} ({summary.selectableCount})
                    </button>
                    <button
                        type="button"
                        className="free-elective-button free-elective-button--quiet"
                        onClick={() => setSelected({})}
                        disabled={saving || !selectedCount}
                    >
                        <X size={15} aria-hidden="true" />
                        {labels.clearAll}
                    </button>
                </div>

                <p className="free-elective-picker__selection">
                    <CheckSquare size={15} aria-hidden="true" />
                    {selectedCount} {labels.selectedLearners}
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
                        disabled={saving || !selectedCount}
                    >
                        <Users size={15} aria-hidden="true" />
                        {saving ? labels.loading : labels.addLearnersToCourse}
                    </button>
                </div>
            </div>
        </BaseModal>
    );
}
