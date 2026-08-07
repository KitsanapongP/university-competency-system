'use client';

import { X, AlertCircle, AlertTriangle, Info, CheckCircle2, ShieldAlert } from 'lucide-react';

/**
 * AlertModal — styled replacement for native browser alert()
 * Matches the dark theme design of TemplateManagement
 *
 * Props:
 *   open      — boolean, show/hide
 *   title     — heading text (default: based on type)
 *   message   — main body text (string or React node)
 *   details   — optional sub-detail text (for listing items etc.)
 *   type      — 'error' | 'warning' | 'info' | 'success' (default: 'warning')
 *   onClose   — callback when dismissed
 *   btnLabel  — custom button label (default: 'ตกลง')
 */
export default function AlertModal({
    open = false,
    title,
    message,
    details,
    type = 'warning',
    onClose,
    btnLabel = 'ตกลง',
}) {
    if (!open) return null;

    const config = {
        error: {
            icon: <ShieldAlert size={28} />,
            iconClass: 'alert-modal__icon--error',
            accentColor: '#ef4444',
            defaultTitle: 'เกิดข้อผิดพลาด',
            btnClass: 'alert-modal__btn--error',
        },
        warning: {
            icon: <AlertTriangle size={28} />,
            iconClass: 'alert-modal__icon--warning',
            accentColor: '#f59e0b',
            defaultTitle: 'แจ้งเตือน',
            btnClass: 'alert-modal__btn--warning',
        },
        info: {
            icon: <Info size={28} />,
            iconClass: 'alert-modal__icon--info',
            accentColor: '#3b82f6',
            defaultTitle: 'แจ้งให้ทราบ',
            btnClass: 'alert-modal__btn--info',
        },
        success: {
            icon: <CheckCircle2 size={28} />,
            iconClass: 'alert-modal__icon--success',
            accentColor: '#10b981',
            defaultTitle: 'สำเร็จ',
            btnClass: 'alert-modal__btn--success',
        },
    };

    const c = config[type] || config.warning;

    return (
        <div className="alert-modal__overlay" onClick={onClose}>
            <div
                className="alert-modal__box"
                onClick={e => e.stopPropagation()}
                role="alertdialog"
                aria-modal="true"
            >
                {/* Top accent bar */}
                <div
                    className="alert-modal__accent"
                    style={{ background: c.accentColor }}
                />

                {/* Close button */}
                <button className="alert-modal__close" onClick={onClose} aria-label="Close">
                    <X size={16} />
                </button>

                {/* Icon circle */}
                <div className={`alert-modal__icon-wrap ${c.iconClass}`}>
                    {c.icon}
                </div>

                {/* Title */}
                <h3 className="alert-modal__title">
                    {title || c.defaultTitle}
                </h3>

                {/* Message */}
                <div className="alert-modal__message">
                    {typeof message === 'string' ? (
                        message.split('\n').map((line, i) => (
                            <p key={i} className="alert-modal__line">{line}</p>
                        ))
                    ) : (
                        message
                    )}
                </div>

                {/* Optional detail box */}
                {details && (
                    <div className="alert-modal__details">
                        {typeof details === 'string' ? (
                            details.split('\n').map((line, i) => (
                                <p key={i} className="alert-modal__detail-line">{line}</p>
                            ))
                        ) : (
                            details
                        )}
                    </div>
                )}

                {/* Action button */}
                <button
                    className={`alert-modal__btn ${c.btnClass}`}
                    onClick={onClose}
                    autoFocus
                >
                    {btnLabel}
                </button>
            </div>
        </div>
    );
}
