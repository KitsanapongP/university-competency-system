import { MoreHorizontal, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';

export default function FreeElectiveStudentCourseActions({
    course,
    labels,
    disabled = false,
    onEdit,
    onWithdraw,
    onRestore,
}) {
    const [open, setOpen] = useState(false);
    const locked = course.offeringStatus === 'finalized' || course.offeringStatus === 'cancelled';

    if (locked) {
        return (
            <span className="free-elective-course-actions__readonly">
                {labels.studentReadonly}
            </span>
        );
    }

    const closeAndRun = (action) => {
        setOpen(false);
        action(course);
    };

    return (
        <div
            className="free-elective-course-actions"
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                    setOpen(false);
                }
            }}
        >
            <button
                type="button"
                className="free-elective-icon-button"
                onClick={() => setOpen((current) => !current)}
                disabled={disabled}
                aria-label={labels.manage}
                aria-expanded={open}
                title={labels.manage}
            >
                <MoreHorizontal size={17} aria-hidden="true" />
            </button>
            {open && (
                <div className="free-elective-course-actions__menu" role="menu">
                    {course.status === 'withdrawn' ? (
                        <button
                            type="button"
                            role="menuitem"
                            onClick={() => closeAndRun(onRestore)}
                        >
                            <RotateCcw size={15} aria-hidden="true" />
                            {labels.studentRestore}
                        </button>
                    ) : (
                        <>
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => closeAndRun(onEdit)}
                            >
                                <Pencil size={15} aria-hidden="true" />
                                {labels.studentEditGrade}
                            </button>
                            {course.status !== 'completed' && (
                                <button
                                    type="button"
                                    role="menuitem"
                                    className="free-elective-course-actions__menu-item--danger"
                                    onClick={() => closeAndRun(onWithdraw)}
                                >
                                    <Trash2 size={15} aria-hidden="true" />
                                    {labels.studentWithdraw}
                                </button>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
