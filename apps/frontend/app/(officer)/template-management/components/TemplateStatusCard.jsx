'use client';

import { useState, useCallback } from 'react';
import { Check, X, BookOpen } from 'lucide-react';

function ConfirmStatusModal({ isEnabling, onConfirm, onCancel }) {
    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal-box modal-box--sm" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>ยืนยันการเปลี่ยนสถานะ</h3>
                    <button className="modal-close" onClick={onCancel}>
                        <X size={18} />
                    </button>
                </div>
                <div className="modal-body">
                    <div>
                        {isEnabling 
                            ? <div className='confirm-active__icon--enabled'><Check size={36} /></div>
                            : <div className='confirm-active__icon--disabled'><AlertTriangle size={36} /></div>}
                    </div>
                    <p className="confirm-delete__desc">
                        {isEnabling 
                            ? 'คุณต้องการเปิดใช้งาน Template นี้ใช่หรือไม่?' 
                            : 'คุณต้องการปิดใช้งาน Template นี้ใช่หรือไม่?'}
                    </p>
                    <div>
                        {isEnabling
                            ? <div className='confirm-active__warn--enabled'>Template นี้จะพร้อมใช้งานสำหรับการกำหนดกับนักศึกษา</div>
                            : <div className='confirm-active__warn--disabled'>Template นี้จะไม่สามารถใช้กับนักศึกษาได้อีกต่อไป</div>}
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn--ghost" onClick={onCancel}>
                        ยกเลิก
                    </button>
                    <button className={isEnabling ? 'btn btn--primary' : 'btn btn--danger'} onClick={onConfirm}>
                        <Check size={15} /> {isEnabling ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function AlertTriangle({ size }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
    );
}

export function TemplateStatusCard({
    isActive = false,
    academicYear = null,
    courseMasterName = null,
    courseMasterYear = null,
    onToggleStatus,
}) {
    const [pendingStatus, setPendingStatus] = useState(null);

    const handleRequestToggleStatus = useCallback(() => {
        setPendingStatus(!isActive);
    }, [isActive]);

    const handleConfirmToggleStatus = useCallback(() => {
        if (pendingStatus !== null) {
            onToggleStatus?.(pendingStatus);
            setPendingStatus(null);
        }
    }, [pendingStatus, onToggleStatus]);

    const handleCancelToggleStatus = useCallback(() => {
        setPendingStatus(null);
    }, []);

    return (
        <>
            <div className="ov-template-status-card">
                <div className="ov-status-section">
                    <div className="ov-status-header">
                        <span className="ov-status-label">สถานะ Template</span>
                    </div>
                    <div className="ov-status-toggle-wrap">
                        <button
                            className={`ov-status-toggle ${isActive ? 'ov-status-toggle--active' : 'ov-status-toggle--inactive'}`}
                            onClick={handleRequestToggleStatus}
                            aria-pressed={isActive}
                        >
                            <span className="ov-status-toggle-track">
                                <span className="ov-status-toggle-thumb" />
                            </span>
                            <span className="ov-status-toggle-text">
                                {isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                            </span>
                        </button>
                        <div className={`ov-status-badge ${isActive ? 'ov-status-badge--active' : 'ov-status-badge--inactive'}`}>
                            {isActive ? <Check size={12} /> : <X size={12} />}
                            <span>{isActive ? 'Active' : 'Disabled'}</span>
                        </div>
                    </div>
                </div>

                <div className="ov-years-section">
                    <div className="ov-years-display">
                        {courseMasterName ? (
                            <div className="ov-template-info">
                                <div className="ov-template-info-item">
                                    <span className="ov-status-label">หลักสูตร</span>
                                    <span className="ov-template-info-value">{courseMasterName}</span>
                                </div>
                                <div className="ov-template-info-item">
                                    <span className="ov-status-label">ปีการศึกษา</span>
                                    <span className="ov-template-info-value">{academicYear}</span>
                                </div>
                            </div>
                        ) : academicYear ? (
                            <div className="ov-template-info">
                                <div className="ov-template-info-item">
                                    <span className="ov-template-info-label">ปีการศึกษา</span>
                                    <span className="ov-template-info-value">{academicYear}</span>
                                </div>
                            </div>
                        ) : (
                            <span className="ov-years-empty">ยังไม่กำหนด</span>
                        )}
                    </div>
                </div>
            </div>

            {pendingStatus !== null && (
                <ConfirmStatusModal
                    isEnabling={pendingStatus}
                    onConfirm={handleConfirmToggleStatus}
                    onCancel={handleCancelToggleStatus}
                />
            )}
        </>
    );
}

export default TemplateStatusCard;