import { freeElectiveText } from '../free-elective-labels';

const STATUS_KEYS = {
    enrolled: 'enrollmentStatusEnrolled',
    completed: 'enrollmentStatusCompleted',
    withdrawn: 'enrollmentStatusWithdrawn',
};

export default function FreeElectiveEnrollmentStatusBadge({ status, language }) {
    const normalizedStatus = STATUS_KEYS[status] ? status : 'enrolled';

    return (
        <span
            className={`free-elective-status free-elective-status--${normalizedStatus}`}
        >
            {freeElectiveText(language, STATUS_KEYS[normalizedStatus])}
        </span>
    );
}
