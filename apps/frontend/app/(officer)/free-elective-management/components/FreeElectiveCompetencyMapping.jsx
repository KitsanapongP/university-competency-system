import { useEffect, useMemo, useState } from 'react';
import { Copy, Plus, Save, Trash2 } from 'lucide-react';

function mapRows(competencies) {
    return (competencies || []).map((item) => ({
        competencyId: item.competencyId,
        weightPercent: item.weightPercent,
    }));
}

export default function FreeElectiveCompetencyMapping({
    competencies,
    masterCompetencies,
    canEdit,
    saving,
    language,
    labels,
    onSave,
    onCopyPrevious,
}) {
    const [rows, setRows] = useState(mapRows(competencies));

    useEffect(() => {
        setRows(mapRows(competencies));
    }, [competencies]);

    const selectedIds = useMemo(() => {
        return new Set(rows.map((row) => String(row.competencyId)).filter(Boolean));
    }, [rows]);

    const updateRow = (index, field, value) => {
        setRows((current) => current.map((row, rowIndex) => (
            rowIndex === index ? { ...row, [field]: value } : row
        )));
    };

    const addRow = () => {
        setRows((current) => [...current, { competencyId: '', weightPercent: 0 }]);
    };

    const removeRow = (index) => {
        setRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
    };

    const getCompetencyName = (item) => language === 'en'
        ? item.nameEn || item.nameTh
        : item.nameTh;

    return (
        <section className="free-elective-panel">
            <div className="free-elective-panel__heading">
                <div>
                    <p className="free-elective-eyebrow">{labels.competencyMapping}</p>
                    <p>{labels.mappingHint}</p>
                </div>
                {canEdit && (
                    <div className="free-elective-inline-actions">
                        <button
                            type="button"
                            className="free-elective-button free-elective-button--quiet"
                            onClick={onCopyPrevious}
                            disabled={saving}
                            title={labels.copyPrevious}
                        >
                            <Copy size={15} aria-hidden="true" />
                            {labels.copyPrevious}
                        </button>
                        <button
                            type="button"
                            className="free-elective-button free-elective-button--quiet"
                            onClick={addRow}
                            disabled={saving || rows.length >= masterCompetencies.length}
                            title={labels.addCompetency}
                        >
                            <Plus size={15} aria-hidden="true" />
                            {labels.addCompetency}
                        </button>
                    </div>
                )}
            </div>
            {rows.length === 0 ? (
                <div className="free-elective-empty free-elective-panel__content">
                    {labels.noCompetencies}
                </div>
            ) : (
                <div className="free-elective-mapping-table-wrap">
                    <table className="free-elective-table">
                        <thead>
                            <tr>
                                <th>{labels.competencyCode}</th>
                                <th>{labels.competency}</th>
                                <th>{labels.mappingWeight}</th>
                                {canEdit && <th>{labels.manage}</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, index) => {
                                const selectedCompetency = masterCompetencies.find(
                                    (item) => String(item.id) === String(row.competencyId),
                                );

                                return (
                                    <tr key={`${row.competencyId || 'new'}-${index}`}>
                                        <td>
                                            {canEdit ? (
                                                <select
                                                    value={row.competencyId}
                                                    onChange={(event) => updateRow(index, 'competencyId', event.target.value)}
                                                    disabled={saving}
                                                >
                                                    <option value="">{labels.chooseCompetency}</option>
                                                    {masterCompetencies.map((item) => {
                                                        const isCurrent = String(item.id) === String(row.competencyId);
                                                        const isUsed = selectedIds.has(String(item.id)) && !isCurrent;
                                                        return (
                                                            <option key={item.id} value={item.id} disabled={isUsed}>
                                                                {item.code}
                                                            </option>
                                                        );
                                                    })}
                                                </select>
                                            ) : (
                                                <strong>{competencies[index]?.code || '-'}</strong>
                                            )}
                                        </td>
                                        <td>
                                            {canEdit ? (
                                                <span className="free-elective-table__secondary">
                                                    {selectedCompetency
                                                        ? getCompetencyName(selectedCompetency)
                                                        : labels.chooseCompetency}
                                                </span>
                                            ) : (
                                                getCompetencyName(competencies[index] || {})
                                            )}
                                        </td>
                                        <td>
                                            {canEdit ? (
                                                <input
                                                    className="free-elective-number-input"
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    step="0.01"
                                                    value={row.weightPercent}
                                                    onChange={(event) => updateRow(index, 'weightPercent', event.target.value)}
                                                    disabled={saving}
                                                />
                                            ) : (
                                                <strong className="free-elective-weight">
                                                    {competencies[index]?.weightPercent ?? 0}%
                                                </strong>
                                            )}
                                        </td>
                                        {canEdit && (
                                            <td>
                                                <button
                                                    type="button"
                                                    className="free-elective-icon-button free-elective-icon-button--danger"
                                                    onClick={() => removeRow(index)}
                                                    disabled={saving}
                                                    title={labels.cancel}
                                                    aria-label={`${labels.cancel}: ${row.competencyId || labels.chooseCompetency}`}
                                                >
                                                    <Trash2 size={16} aria-hidden="true" />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
            {canEdit && (
                <div className="free-elective-panel__footer">
                    <button
                        type="button"
                        className="free-elective-button free-elective-button--primary"
                        onClick={() => onSave(rows)}
                        disabled={saving}
                    >
                        <Save size={16} aria-hidden="true" />
                        {saving ? labels.loading : labels.saveMappings}
                    </button>
                </div>
            )}
        </section>
    );
}
