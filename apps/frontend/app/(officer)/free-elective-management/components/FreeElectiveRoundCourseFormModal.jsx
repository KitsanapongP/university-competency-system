import { useMemo, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import BaseModal from '../../../../components/ui/BaseModal';
import { getFreeElectiveGradeOptions } from '../../../../lib/free-elective';
import { localizedFreeElective } from '../free-elective-labels';

function emptyMapping() {
    return {
        competencyId: '',
        weightPercent: 0,
    };
}

export default function FreeElectiveRoundCourseFormModal({
    open,
    courses,
    competencies,
    saving,
    language,
    labels,
    onClose,
    onSubmit,
}) {
    const [courseId, setCourseId] = useState('');
    const [mappings, setMappings] = useState([]);
    const [localError, setLocalError] = useState('');

    const selectedCourse = useMemo(
        () => courses.find((course) => String(course.id) === String(courseId)),
        [courseId, courses],
    );

    const selectedIds = useMemo(
        () => new Set(mappings.map((row) => String(row.competencyId)).filter(Boolean)),
        [mappings],
    );

    const updateMapping = (index, field, value) => {
        setMappings((current) => current.map((row, rowIndex) => (
            rowIndex === index
                ? { ...row, [field]: value }
                : row
        )));
    };

    const addMapping = () => {
        if (!selectedCourse) {
            setLocalError(labels.chooseCourseFirst);
            return;
        }
        setLocalError('');
        setMappings((current) => [...current, emptyMapping()]);
    };

    const removeMapping = (index) => {
        setMappings((current) => current.filter((_, rowIndex) => rowIndex !== index));
    };

    const submit = () => {
        if (!selectedCourse) {
            setLocalError(labels.chooseCourse);
            return;
        }
        if (mappings.some((row) => !row.competencyId)) {
            setLocalError(labels.noSelectedCompetencies);
            return;
        }
        setLocalError('');
        onSubmit({
            courseId: selectedCourse.id,
            competencies: mappings,
        });
    };

    return (
        <BaseModal
            open={open}
            title={labels.addCourseToRound}
            size="xl"
            onClose={onClose}
            closeDisabled={saving}
        >
            <div className="free-elective-round-course-form">
                <p className="free-elective-round-course-form__hint">
                    {labels.roundCourseFormHint}
                </p>

                {localError && (
                    <div className="free-elective-notice free-elective-notice--error" role="alert">
                        {localError}
                    </div>
                )}

                <label className="free-elective-field">
                    <span>{labels.chooseCourse} *</span>
                    <select
                        value={courseId}
                        onChange={(event) => {
                            setCourseId(event.target.value);
                            setMappings([]);
                            setLocalError('');
                        }}
                        disabled={saving}
                    >
                        <option value="">{labels.chooseCourse}</option>
                        {courses.map((course) => (
                            <option key={course.id} value={course.id}>
                                {course.code} - {localizedFreeElective(
                                    course,
                                    language,
                                    'nameTh',
                                    'nameEn',
                                )}
                            </option>
                        ))}
                    </select>
                </label>

                {selectedCourse && (
                    <div className="free-elective-round-course-form__course-summary">
                        <div>
                            <strong>{selectedCourse.code}</strong>
                            <span>
                                {localizedFreeElective(
                                    selectedCourse,
                                    language,
                                    'nameTh',
                                    'nameEn',
                                )}
                            </span>
                        </div>
                        <span>
                            {labels.gradeScheme}:{' '}
                            {getFreeElectiveGradeOptions(selectedCourse.gradeScheme).join(', ')}
                        </span>
                    </div>
                )}

                <section className="free-elective-round-course-form__mappings">
                    <div className="free-elective-round-course-form__section-heading">
                        <div>
                            <h3>{labels.courseCompetencies}</h3>
                            <p>{labels.chooseCompetencies}</p>
                        </div>
                        <button
                            type="button"
                            className="free-elective-button free-elective-button--quiet"
                            onClick={addMapping}
                            disabled={saving || !selectedCourse || mappings.length >= competencies.length}
                        >
                            <Plus size={15} aria-hidden="true" />
                            {labels.addCompetency}
                        </button>
                    </div>

                    {mappings.length ? (
                        <div className="free-elective-round-course-form__mapping-list">
                            {mappings.map((mapping, index) => (
                                <div
                                    className="free-elective-round-course-form__mapping-row"
                                    key={`${index}-${mapping.competencyId || 'empty'}`}
                                >
                                    <select
                                        value={mapping.competencyId}
                                        onChange={(event) => updateMapping(
                                            index,
                                            'competencyId',
                                            event.target.value,
                                        )}
                                        disabled={saving}
                                        aria-label={labels.chooseCompetency}
                                    >
                                        <option value="">{labels.chooseCompetency}</option>
                                        {competencies.map((competency) => {
                                            const isCurrent = String(competency.id) === String(mapping.competencyId);
                                            const isUsed = selectedIds.has(String(competency.id)) && !isCurrent;
                                            return (
                                                <option
                                                    key={competency.id}
                                                    value={competency.id}
                                                    disabled={isUsed}
                                                >
                                                    {competency.code} - {localizedFreeElective(
                                                        competency,
                                                        language,
                                                        'nameTh',
                                                        'nameEn',
                                                    )}
                                                </option>
                                            );
                                        })}
                                    </select>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.01"
                                        value={mapping.weightPercent}
                                        onChange={(event) => updateMapping(
                                            index,
                                            'weightPercent',
                                            event.target.value,
                                        )}
                                        disabled={saving}
                                        aria-label={labels.mappingWeight}
                                    />
                                    <span>%</span>
                                    <button
                                        type="button"
                                        className="free-elective-icon-button free-elective-icon-button--danger"
                                        onClick={() => removeMapping(index)}
                                        disabled={saving}
                                        title={labels.removeCourse}
                                        aria-label={labels.removeCourse}
                                    >
                                        <Trash2 size={15} aria-hidden="true" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="free-elective-empty">
                            {labels.noSelectedCompetencies}
                        </div>
                    )}
                </section>

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
                        disabled={saving || !selectedCourse}
                    >
                        <Save size={16} aria-hidden="true" />
                        {saving ? labels.loading : labels.saveCourseInRound}
                    </button>
                </div>
            </div>
        </BaseModal>
    );
}
