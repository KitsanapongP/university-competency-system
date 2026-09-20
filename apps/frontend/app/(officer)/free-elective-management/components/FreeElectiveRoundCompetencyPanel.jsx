import { useState } from 'react';
import { ExternalLink, Plus, Trash2, X } from 'lucide-react';
import FreeElectiveRemoveCompetencyModal from './FreeElectiveRemoveCompetencyModal';

function getCompetencyName(competency, language) {
    if (!competency) {
        return '';
    }

    return language === 'en'
        ? competency.nameEn || competency.nameTh
        : competency.nameTh || competency.nameEn;
}

function InlineError({ message }) {
    if (!message) {
        return null;
    }

    return (
        <span className="free-elective-field__error" role="alert">
            {message}
        </span>
    );
}

export default function FreeElectiveRoundCompetencyPanel({
    course,
    courseIndex,
    rowErrors,
    competencies,
    language,
    labels,
    saving,
    onAddCompetency,
    onOpenCompetencyManagement,
    onUpdateCompetency,
    onRemoveCompetency,
    onClose,
}) {
    const [deletingMapping, setDeletingMapping] = useState(null);

    if (!course) {
        return (
            <aside className="free-elective-round-competency-panel free-elective-round-competency-panel--empty">
                <strong>{labels.configureCompetencies}</strong>
                <p>{labels.selectCourseForCompetencies}</p>
            </aside>
        );
    }

    const selectedCompetencyIds = new Set(
        course.competencies
            .map((item) => String(item.competencyId))
            .filter(Boolean),
    );

    const confirmRemoveCompetency = () => {
        if (!deletingMapping) {
            return;
        }

        onRemoveCompetency(
            deletingMapping.courseIndex,
            deletingMapping.competencyIndex,
        );
        setDeletingMapping(null);
    };

    const pendingCompetency = deletingMapping
        ? course.competencies[deletingMapping.competencyIndex]
        : null;
    const pendingCompetencyName = pendingCompetency
        ? getCompetencyName(
            competencies.find(
                (item) => String(item.id) === String(pendingCompetency.competencyId),
            ),
            language,
        )
        : '';

    return (
        <aside className="free-elective-round-competency-panel">
            <div className="free-elective-round-competency-panel__heading">
                <div>
                    <span>{labels.courseCompetencies}</span>
                    <strong>{course.courseCode || `${labels.course} ${courseIndex + 1}`}</strong>
                    <p>{course.courseNameTh || course.courseNameEn || labels.courseFieldsHint}</p>
                </div>
                <button
                    type="button"
                    className="free-elective-icon-button"
                    onClick={onClose}
                    title={labels.close}
                    aria-label={labels.close}
                    disabled={saving}
                >
                    <X size={16} aria-hidden="true" />
                </button>
            </div>
            <div className="free-elective-round-competency-panel__body">
                <div className="free-elective-round-competency-panel__subheading">
                    <p>{labels.chooseCompetencies}</p>
                    <div className="free-elective-round-competency-panel__subheading-actions">
                        <button
                            type="button"
                            className="free-elective-button free-elective-button--primary"
                            onClick={() => onAddCompetency(courseIndex)}
                            disabled={saving || course.competencies.length >= competencies.length}
                            title={labels.addCompetencyHint}
                        >
                            <Plus size={14} aria-hidden="true" />
                            {labels.addCompetency}
                        </button>
                        <button
                            type="button"
                            className="free-elective-button free-elective-button--secondary"
                            onClick={onOpenCompetencyManagement}
                            title={labels.addNewCompetencyHint}
                            aria-label={labels.addNewCompetency}
                            disabled={saving}
                        >
                            <ExternalLink size={14} aria-hidden="true" />
                            {labels.addNewCompetency}
                        </button>
                    </div>
                </div>
                <InlineError message={rowErrors.competencies} />
                {!course.competencies.length && (
                    <div className="free-elective-empty">
                        {labels.noSelectedCompetencies}
                    </div>
                )}
                {course.competencies.map((mapping, competencyIndex) => {
                    const mappingErrors = rowErrors.mappings[competencyIndex] || {};
                    return (
                        <div
                            className="free-elective-round-competency-panel__mapping"
                            key={`${courseIndex}-${competencyIndex}`}
                        >
                            <label className="free-elective-field">
                                <span>{labels.competency} *</span>
                                <select
                                    value={mapping.competencyId}
                                    onChange={(event) => onUpdateCompetency(
                                        courseIndex,
                                        competencyIndex,
                                        'competencyId',
                                        event.target.value,
                                    )}
                                    disabled={saving}
                                    aria-invalid={Boolean(mappingErrors.competencyId)}
                                >
                                    <option value="">{labels.chooseCompetency}</option>
                                    {competencies.map((competency) => {
                                        const isCurrent = String(competency.id) === String(mapping.competencyId);
                                        const isUsed = selectedCompetencyIds.has(String(competency.id)) && !isCurrent;
                                        return (
                                            <option
                                                key={competency.id}
                                                value={competency.id}
                                                disabled={isUsed}
                                            >
                                                {getCompetencyName(competency, language)}
                                            </option>
                                        );
                                    })}
                                </select>
                                <InlineError message={mappingErrors.competencyId} />
                            </label>
                            <label className="free-elective-field">
                                <span>{labels.mappingWeight} *</span>
                                <div className="free-elective-round-competency-panel__weight">
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.01"
                                        value={mapping.weightPercent}
                                        onChange={(event) => onUpdateCompetency(
                                            courseIndex,
                                            competencyIndex,
                                            'weightPercent',
                                            event.target.value,
                                        )}
                                        disabled={saving}
                                        aria-invalid={Boolean(mappingErrors.weightPercent)}
                                    />
                                    <span>%</span>
                                </div>
                                <InlineError message={mappingErrors.weightPercent} />
                            </label>
                            <button
                                type="button"
                                className="free-elective-icon-button free-elective-icon-button--danger"
                                onClick={() => setDeletingMapping({
                                    courseIndex,
                                    competencyIndex,
                                })}
                                title={labels.removeCompetency}
                                aria-label={labels.removeCompetency}
                                disabled={saving}
                            >
                                <Trash2 size={15} aria-hidden="true" />
                            </button>
                        </div>
                    );
                })}
            </div>
            <FreeElectiveRemoveCompetencyModal
                open={Boolean(deletingMapping)}
                competencyName={pendingCompetencyName}
                labels={labels}
                loading={saving}
                onCancel={() => setDeletingMapping(null)}
                onConfirm={confirmRemoveCompetency}
            />
        </aside>
    );
}
