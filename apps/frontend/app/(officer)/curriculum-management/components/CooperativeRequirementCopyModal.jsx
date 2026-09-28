'use client';

import { useMemo, useState } from 'react';
import { Copy, LoaderCircle, RotateCw } from 'lucide-react';
import BaseModal from '../../../../components/ui/BaseModal';
import { isCopyableCooperativeRequirement } from '../../../../lib/cooperative-requirement-copy.mjs';
import './CooperativeRequirementCopyModal.css';

const EMPTY_REQUIREMENTS = [];

function requirementCount(count, t) {
    const key = count === 1
        ? 'coop_requirements_copy_count_one'
        : 'coop_requirements_copy_count_many';
    return t(key).replace('{count}', count);
}

export default function CooperativeRequirementCopyModal({
    open,
    sourceSemester,
    targetSemester,
    sourceSet,
    targetDraft,
    targetPublished,
    loading,
    saving,
    loadError,
    saveError,
    sourceWasUnsaved,
    targetWasUnsaved,
    getRequirementSummary,
    onRetry,
    onConfirm,
    onClose,
    t,
}) {
    const [selectedClientIds, setSelectedClientIds] = useState(null);
    const requirements = sourceSet?.requirements || EMPTY_REQUIREMENTS;
    const copyableRequirements = useMemo(
        () => requirements.filter(isCopyableCooperativeRequirement),
        [requirements],
    );

    const selectedIds = selectedClientIds ?? copyableRequirements.map((item) => item.clientId);
    const selectedSet = new Set(selectedIds);
    const selectedCount = copyableRequirements.filter(
        (item) => selectedSet.has(item.clientId),
    ).length;
    const allSelected = copyableRequirements.length > 0
        && selectedCount === copyableRequirements.length;
    const canConfirm = !loading && !saving && !loadError && selectedCount > 0;
    const semesterName = (value) => t(
        value === 1 ? 'learner_semester_one' : 'learner_semester_two',
    );
    const confirmLabel = targetDraft
        ? t('coop_requirements_copy_replace')
        : t('coop_requirements_copy_confirm');

    const toggleRequirement = (clientId) => {
        setSelectedClientIds((current) => {
            const next = new Set(current ?? copyableRequirements.map((item) => item.clientId));
            if (next.has(clientId)) {
                next.delete(clientId);
            } else {
                next.add(clientId);
            }
            return [...next];
        });
    };

    return (
        <BaseModal
            open={open}
            title={t('coop_requirements_copy_title')}
            size="lg"
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
                        {t('coop_requirements_copy_cancel')}
                    </button>
                    <button
                        type="button"
                        className={`course-btn ${targetDraft ? 'course-btn--danger' : 'course-btn--primary'}`}
                        onClick={() => onConfirm(selectedIds)}
                        disabled={!canConfirm}
                    >
                        {saving ? (
                            <LoaderCircle
                                size={16}
                                className="coop-requirements__spin"
                                aria-hidden="true"
                            />
                        ) : (
                            <Copy size={16} aria-hidden="true" />
                        )}
                        {saving ? t('coop_requirements_copy_saving') : confirmLabel}
                        {selectedCount > 0 && ` (${selectedCount})`}
                    </button>
                </>
            )}
        >
            <div className="coop-requirements-copy">
                <div className="coop-requirements-copy__route">
                    <div className="coop-requirements-copy__route-item">
                        <span>{t('coop_requirements_copy_source')}</span>
                        <strong>{semesterName(sourceSemester)}</strong>
                        {sourceSet && (
                            <small>
                                {t(sourceSet.status === 'draft'
                                    ? 'coop_requirements_draft'
                                    : 'coop_requirements_published')}
                                {' · '}
                                {t('coop_requirements_revision')} {sourceSet.revision}
                            </small>
                        )}
                    </div>
                    <Copy size={18} aria-hidden="true" className="coop-requirements-copy__route-icon" />
                    <div className="coop-requirements-copy__route-item">
                        <span>{t('coop_requirements_copy_destination')}</span>
                        <strong>{semesterName(targetSemester)}</strong>
                        <small>
                            {targetDraft
                                ? requirementCount(targetDraft.requirements?.length || 0, t)
                                : t('coop_requirements_copy_no_draft')}
                        </small>
                    </div>
                </div>

                {sourceWasUnsaved && (
                    <p className="coop-requirements-copy__notice">
                        {t('coop_requirements_copy_source_unsaved')}
                    </p>
                )}
                {targetWasUnsaved && (
                    <p className="coop-requirements-copy__warning">
                        {t('coop_requirements_copy_target_unsaved')}
                    </p>
                )}
                {targetDraft && (
                    <p className="coop-requirements-copy__warning" role="alert">
                        {t('coop_requirements_copy_replace_warning')
                            .replace('{oldCount}', String(targetDraft.requirements?.length || 0))
                            .replace('{newCount}', String(selectedCount))}
                    </p>
                )}
                {targetPublished && (
                    <p className="coop-requirements-copy__notice">
                        {t('coop_requirements_copy_active_preserved')}
                    </p>
                )}

                {loading && (
                    <div className="coop-requirements-copy__state" role="status">
                        <LoaderCircle className="coop-requirements__spin" size={18} aria-hidden="true" />
                        {t('coop_requirements_copy_loading')}
                    </div>
                )}

                {loadError && (
                    <div className="coop-requirements-copy__error" role="alert">
                        <span>{loadError}</span>
                        <button
                            type="button"
                            className="course-btn course-btn--ghost course-btn--sm"
                            onClick={onRetry}
                            disabled={loading || saving}
                        >
                            <RotateCw size={15} aria-hidden="true" />
                            {t('coop_requirements_copy_retry')}
                        </button>
                    </div>
                )}

                {saveError && (
                    <p className="coop-requirements-copy__error" role="alert">
                        {saveError}
                    </p>
                )}

                {!loading && sourceSet && copyableRequirements.length > 0 && (
                    <fieldset className="coop-requirements-copy__fieldset">
                        <legend>{t('coop_requirements_copy_choose')}</legend>
                        <div className="coop-requirements-copy__selection-tools">
                            <span>{requirementCount(selectedCount, t)}</span>
                            <div>
                                <button
                                    type="button"
                                    className="coop-requirements-copy__text-button"
                                    onClick={() => setSelectedClientIds(null)}
                                    disabled={allSelected || saving}
                                >
                                    {t('coop_requirements_copy_select_all')}
                                </button>
                                <button
                                    type="button"
                                    className="coop-requirements-copy__text-button"
                                    onClick={() => setSelectedClientIds([])}
                                    disabled={selectedCount === 0 || saving}
                                >
                                    {t('coop_requirements_copy_clear')}
                                </button>
                            </div>
                        </div>
                        <div className="coop-requirements-copy__list">
                            {requirements.map((item) => {
                                const copyable = isCopyableCooperativeRequirement(item);
                                const summary = getRequirementSummary(item);

                                return (
                                    <label
                                        key={item.clientId}
                                        className={`coop-requirements-copy__item ${copyable ? '' : 'coop-requirements-copy__item--disabled'}`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={copyable && selectedSet.has(item.clientId)}
                                            onChange={() => toggleRequirement(item.clientId)}
                                            disabled={!copyable || saving}
                                        />
                                        <span className="coop-requirements-copy__item-content">
                                            <strong>{summary.name}</strong>
                                            <span>{summary.scope}</span>
                                            <small>{summary.threshold}</small>
                                            {!copyable && (
                                                <small>{t('coop_requirements_copy_missing_type')}</small>
                                            )}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    </fieldset>
                )}

                {!loading && (!sourceSet || copyableRequirements.length === 0) && (
                    <div className="coop-requirements-copy__state">
                        {t('coop_requirements_copy_no_source')}
                    </div>
                )}
            </div>
        </BaseModal>
    );
}
