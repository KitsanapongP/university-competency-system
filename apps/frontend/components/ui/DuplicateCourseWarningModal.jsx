'use client';

import { AlertTriangle } from 'lucide-react';
import BaseModal from './BaseModal';

export default function DuplicateCourseWarningModal({
    open,
    issues = [],
    language = 'th',
    onClose,
}) {
    const isEnglish = language === 'en';

    return (
        <BaseModal
            open={open}
            title={isEnglish ? 'Duplicate Course Information' : 'ข้อมูลรายวิชาซ้ำ'}
            size="sm"
            variant="warning"
            icon={(
                <span className="course-modal-icon course-modal-icon--warning">
                    <AlertTriangle size={18} />
                </span>
            )}
            onClose={onClose}
            footer={(
                <button
                    type="button"
                    className="course-btn course-btn--primary"
                    onClick={onClose}
                >
                    {isEnglish ? 'OK' : 'รับทราบ'}
                </button>
            )}
        >
            <p className="course-modal-message">
                {isEnglish
                    ? 'This course has duplicate information. Please edit the duplicated fields before saving.'
                    : 'รายวิชานี้มีข้อมูลซ้ำ กรุณาแก้ไขข้อมูลที่ซ้ำก่อนบันทึก'}
            </p>
            <p className="course-modal-hint">
                {isEnglish ? 'Duplicated fields: ' : 'ข้อมูลที่ซ้ำ: '}
                {issues.join(', ')}
            </p>
        </BaseModal>
    );
}
