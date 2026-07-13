'use client';

import { useId } from 'react';
import { X } from 'lucide-react';
import './BaseModal.css';

export default function BaseModal({
    open,
    title,
    children,
    footer,
    onClose,
    size = 'md',
    variant = '',
    icon = null,
    closeOnOverlayClick = true,
    showCloseButton = true,
    closeDisabled = false,
}) {
    const generatedTitleId = useId();

    if (!open) return null;

    const titleId = title ? generatedTitleId : undefined;

    const handleOverlayClick = () => {
        if (closeOnOverlayClick && !closeDisabled) {
            onClose?.();
        }
    };

    return (
        <div className="course-modal-overlay" onClick={handleOverlayClick}>
            <div
                className={`course-modal-box course-modal-box--${size}`}
                onClick={event => event.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                data-variant={variant || undefined}
            >
                {(title || showCloseButton) && (
                    <div className="course-modal-header">
                        <div className="course-modal-title">
                            {icon}
                            {title && <h3 id={titleId}>{title}</h3>}
                        </div>
                        {showCloseButton && (
                            <button
                                type="button"
                                className="course-modal-close"
                                onClick={onClose}
                                disabled={closeDisabled}
                                aria-label="ปิด"
                            >
                                <X size={18} />
                            </button>
                        )}
                    </div>
                )}

                <div className="course-modal-body">
                    {children}
                </div>

                {footer && (
                    <div className="course-modal-footer">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}
