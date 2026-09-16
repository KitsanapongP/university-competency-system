import { freeElectiveText } from '../free-elective-labels';

const STATUS_KEYS = {
    draft: 'draft',
    active: 'active',
    finalized: 'finalized',
    cancelled: 'cancelled',
};

export default function FreeElectiveStatusBadge({ status, language }) {
    const normalizedStatus = STATUS_KEYS[status] ? status : 'draft';

    return (
        <span className={`free-elective-status free-elective-status--${normalizedStatus}`}>
            {freeElectiveText(language, STATUS_KEYS[normalizedStatus])}
        </span>
    );
}
