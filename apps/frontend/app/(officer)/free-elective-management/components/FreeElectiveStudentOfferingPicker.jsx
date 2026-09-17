import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Building2, Check, Search } from 'lucide-react';
import BaseModal from '../../../../components/ui/BaseModal';
import { formatFreeElectiveTerm, localizedFreeElective } from '../free-elective-labels';

export default function FreeElectiveStudentOfferingPicker({
    open,
    offerings,
    loading,
    saving,
    language,
    labels,
    onClose,
    onSubmit,
}) {
    const [search, setSearch] = useState('');
    const [selectedOfferingId, setSelectedOfferingId] = useState('');

    useEffect(() => {
        if (!open) {
            setSearch('');
            setSelectedOfferingId('');
        }
    }, [open]);

    const filteredOfferings = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) {
            return offerings;
        }

        return offerings.filter((offering) => {
            return [
                offering.courseCode,
                offering.courseNameTh,
                offering.courseNameEn,
                offering.facultyNameTh,
                offering.facultyNameEn,
                offering.academicYearBE,
                offering.sectionNo,
            ]
                .join(' ')
                .toLowerCase()
                .includes(term);
        });
    }, [offerings, search]);

    const handleSubmit = () => {
        if (selectedOfferingId) {
            onSubmit(selectedOfferingId);
        }
    };

    return (
        <BaseModal
            open={open}
            title={labels.studentAddTitle}
            icon={<BookOpen size={18} />}
            size="xl"
            onClose={onClose}
            closeDisabled={saving}
            footer={(
                <>
                    <button
                        type="button"
                        className="course-btn course-btn--ghost"
                        onClick={onClose}
                        disabled={saving}
                    >
                        {labels.cancel}
                    </button>
                    <button
                        type="button"
                        className="course-btn course-btn--primary"
                        onClick={handleSubmit}
                        disabled={saving || !selectedOfferingId}
                    >
                        {saving ? labels.loading : labels.studentAddButton}
                    </button>
                </>
            )}
        >
            <div className="free-elective-student-offering-picker">
                <p className="free-elective-student-offering-picker__hint">
                    {labels.studentAddHint}
                </p>
                <label className="free-elective-search-field">
                    <Search size={16} aria-hidden="true" />
                    <input
                        type="search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder={labels.searchOfferings}
                        disabled={saving}
                    />
                </label>

                {loading ? (
                    <div className="free-elective-loading" role="status">
                        {labels.loading}
                    </div>
                ) : filteredOfferings.length ? (
                    <div className="free-elective-student-offering-list">
                        {filteredOfferings.map((offering) => {
                            const isSelected = String(offering.offeringId) === String(selectedOfferingId);
                            return (
                                <button
                                    type="button"
                                    className={`free-elective-student-offering-option ${isSelected
                                        ? 'free-elective-student-offering-option--selected'
                                        : ''}`}
                                    key={offering.offeringId}
                                    onClick={() => setSelectedOfferingId(String(offering.offeringId))}
                                    disabled={saving}
                                    aria-pressed={isSelected}
                                >
                                    <span className="free-elective-student-offering-option__icon" aria-hidden="true">
                                        <BookOpen size={17} />
                                    </span>
                                    <span className="free-elective-student-offering-option__content">
                                        <strong>{offering.courseCode}</strong>
                                        <span>
                                            {language === 'en'
                                                ? offering.courseNameEn || offering.courseNameTh
                                                : offering.courseNameTh}
                                        </span>
                                        <small>
                                            {formatFreeElectiveTerm(
                                                offering.academicYearBE,
                                                offering.semester,
                                                language,
                                            )}
                                            {' · '}
                                            {labels.section} {offering.sectionNo}
                                        </small>
                                    </span>
                                    <span className="free-elective-student-offering-option__meta">
                                        <span>
                                            <Building2 size={14} aria-hidden="true" />
                                            {localizedFreeElective(
                                                offering,
                                                language,
                                                'facultyNameTh',
                                                'facultyNameEn',
                                            )}
                                        </span>
                                        <small>
                                            {offering.gradeScheme === 'satisfactory'
                                                ? labels.satisfactoryGrades
                                                : labels.letterGrades}
                                        </small>
                                    </span>
                                    <span className="free-elective-student-offering-option__check" aria-hidden="true">
                                        {isSelected && <Check size={17} />}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className="free-elective-empty">
                        {search ? labels.noOfferings : labels.studentNoOfferings}
                    </div>
                )}
            </div>
        </BaseModal>
    );
}
