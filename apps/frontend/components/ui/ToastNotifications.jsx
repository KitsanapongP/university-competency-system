'use client';

import { Check, X } from 'lucide-react';
import './ToastNotifications.css';

export default function ToastNotifications({
    success,
    error,
    errorDebug,
    onCloseSuccess,
    onCloseError,
}) {
    if (!success && !error) return null;

    return (
        <div className="course-toast-stack" aria-live="polite" aria-atomic="true">
            {success && (
                <div className="course-toast course-toast--success course-toast--auto-dismiss">
                    <Check size={16} className="course-toast__icon" />
                    <div className="course-toast__content">{success}</div>
                    <button type="button" className="course-toast__close" onClick={onCloseSuccess} aria-label="ปิดข้อความแจ้งเตือน">
                        <X size={14} />
                    </button>
                </div>
            )}
            {error && (
                <div className="course-toast course-toast--error">
                    <X size={16} className="course-toast__icon" />
                    <div className="course-toast__content" title={errorDebug}>{error}</div>
                    <button type="button" className="course-toast__close" onClick={onCloseError} aria-label="ปิดข้อความแจ้งเตือน">
                        <X size={14} />
                    </button>
                </div>
            )}
        </div>
    );
}
