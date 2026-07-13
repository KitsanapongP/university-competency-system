'use client';

import { AlertTriangle, Info, Trash2 } from 'lucide-react';
import BaseModal from './BaseModal';

function getVariantIcon(variant) {
    if (variant === 'danger') return <Trash2 size={18} />;
    if (variant === 'info') return <Info size={18} />;
    return <AlertTriangle size={18} />;
}

export default function ConfirmActionModal({
    open,
    title,
    message,
    hint,
    impact,
    confirmLabel = 'ยืนยัน',
    cancelLabel = 'ยกเลิก',
    variant = 'warning',
    loading = false,
    disabled = false,
    onConfirm,
    onCancel,
}) {
    const icon = (
        <span className={`course-modal-icon course-modal-icon--${variant}`}>
            {getVariantIcon(variant)}
        </span>
    );

    return (
        <BaseModal
            open={open}
            title={title}
            size="sm"
            variant={variant}
            icon={icon}
            onClose={onCancel}
            closeDisabled={loading}
            footer={(
                <>
                    <button
                        type="button"
                        className="course-btn course-btn--ghost"
                        onClick={onCancel}
                        disabled={loading}
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        className={variant === 'danger' ? 'course-btn course-btn--danger' : 'course-btn course-btn--primary'}
                        onClick={onConfirm}
                        disabled={loading || disabled}
                    >
                        {loading ? 'กำลังดำเนินการ...' : confirmLabel}
                    </button>
                </>
            )}
        >
            {message && <p className="course-modal-message">{message}</p>}
            {impact && <div className="course-modal-impact">{impact}</div>}
            {hint && <p className="course-modal-hint">{hint}</p>}
        </BaseModal>
    );
}
