'use client';

import { useState, useCallback } from 'react';
import { Calendar, Check, X, Edit3, Plus, AlertCircle, AlertTriangle } from 'lucide-react';
import ConfirmDeleteModal from './ConfirmDeleteModal';

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

export function TemplateStatusCard({
    isActive = false,
    academicYears = [],
    onToggleStatus,
    onUpdateAcademicYears,
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [tempYears, setTempYears] = useState(() => [...academicYears]);
    const [newYear, setNewYear] = useState('');
    const [deletingYear, setDeletingYear] = useState(null);
    const [pendingStatus, setPendingStatus] = useState(null);

    const handleStartEdit = useCallback(() => {
        setTempYears([...academicYears]);
        setIsEditing(true);
    }, [academicYears]);

    const handleCancelEdit = useCallback(() => {
        setIsEditing(false);
        setNewYear('');
    }, []);

    const handleSave = useCallback(() => {
        const sortedYears = [...tempYears].sort((a, b) => b - a);
        onUpdateAcademicYears?.(sortedYears);
        setIsEditing(false);
        setNewYear('');
    }, [tempYears, onUpdateAcademicYears]);

    const handleAddYear = useCallback(() => {
        const year = parseInt(newYear, 10);
        if (year && !tempYears.includes(year)) {
            setTempYears(prev => [...prev, year].sort((a, b) => b - a));
            setNewYear('');
        }
    }, [newYear, tempYears]);

    const handleRequestRemoveYear = useCallback((year) => {
        setDeletingYear(year);
    }, []);

    const handleConfirmRemoveYear = useCallback(() => {
        if (deletingYear !== null) {
            setTempYears(prev => prev.filter(y => y !== deletingYear));
            setDeletingYear(null);
        }
    }, [deletingYear]);

    const handleCancelRemoveYear = useCallback(() => {
        setDeletingYear(null);
    }, []);

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

    const formatYearsList = () => {
        if (academicYears.length === 0) {
            return 'ยังไม่กำหนด';
        }
        return academicYears.join(', ');
    };

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
                    <div className="ov-years-header">
                        <div className="ov-years-label">
                            <Calendar size={14} />
                            <span>ปีการศึกษาที่ใช้งาน</span>
                        </div>
                        {!isEditing && (
                            <button className="ov-years-edit-btn" onClick={handleStartEdit}>
                                <Edit3 size={12} />
                                <span>แก้ไข</span>
                            </button>
                        )}
                    </div>

                    {isEditing ? (
                        <div className="ov-years-editor">
                            <div className="ov-years-list">
                                {tempYears.length === 0 ? (
                                    <span className="ov-years-empty">ยังไม่มีปีการศึกษา</span>
                                ) : (
                                    tempYears.map(year => (
                                        <div key={year} className="ov-year-chip">
                                            <span>ปี {year}</span>
                                            <button
                                                className="ov-year-chip-remove"
                                                onClick={() => handleRequestRemoveYear(year)}
                                                aria-label={`Remove year ${year}`}
                                            >
                                                <X size={10} />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                            <div className="ov-years-add">
                                <input
                                    type="number"
                                    className="ov-year-input"
                                    placeholder="เพิ่มปี พ.ศ."
                                    value={newYear}
                                    onChange={e => setNewYear(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') handleAddYear();
                                    }}
                                    min={2560}
                                    max={2600}
                                />
                                <button
                                    className="ov-year-add-btn"
                                    onClick={handleAddYear}
                                    disabled={!newYear}
                                >
                                    <Plus size={14} />
                                </button>
                            </div>
                            <div className="ov-years-actions">
                                <button className="ov-years-cancel-btn" onClick={handleCancelEdit}>
                                    ยกเลิก
                                </button>
                                <button className="ov-years-save-btn" onClick={handleSave}>
                                    บันทึก
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="ov-years-display">
                            {academicYears.length === 0 ? (
                                <span className="ov-years-empty">ยังไม่กำหนด</span>
                            ) : (
                                <div className="ov-academic-years-display">
                                    <div className="ov-years-chips">
                                        {academicYears.map(year => (
                                            <span key={year} className="ov-year-chip-display">
                                                {year}
                                            </span>
                                        ))}
                                    </div>
                                    <div className="ov-admission-hint">
                                        <AlertCircle size={12} />
                                        <span>นักศึกษาที่เข้าเรียนปี {formatYearsList()} สามารถใช้ Template นี้ได้</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {deletingYear !== null && (
                <ConfirmDeleteModal
                    category={{ code: '', name: `ปีการศึกษา ${deletingYear}` }}
                    label="ปีการศึกษา"
                    onConfirm={handleConfirmRemoveYear}
                    onCancel={handleCancelRemoveYear}
                />
            )}

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