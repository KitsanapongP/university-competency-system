import ConfirmActionModal from '../../../../components/ui/ConfirmActionModal';

export default function FreeElectiveRemoveCompetencyModal({
    open,
    competencyName,
    labels,
    loading = false,
    onCancel,
    onConfirm,
}) {
    return (
        <ConfirmActionModal
            open={open}
            title={labels.removeCompetencyTitle}
            message={labels.removeCompetencyMessage}
            impact={(
                <div>
                    <span>{labels.removeCompetencySelected}: </span>
                    <strong>{competencyName || labels.unknownCompetency}</strong>
                </div>
            )}
            hint={labels.removeCompetencyHint}
            variant="danger"
            size="sm"
            loading={loading}
            confirmLabel={labels.removeCompetency}
            cancelLabel={labels.cancel}
            onCancel={onCancel}
            onConfirm={onConfirm}
        />
    );
}
