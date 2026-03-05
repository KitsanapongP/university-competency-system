'use client';

import { useState } from 'react';
import { X, Check } from 'lucide-react';

/**
 * TemplateFormModal — Modal สร้าง/แก้ไข Template
 *
 * Props:
 *   onClose()          — ปิด modal
 *   onSave({ name, year }) — บันทึก
 */
export default function TemplateFormModal({ onClose, onSave }) {
    const [name, setName] = useState('');
    const [year, setYear] = useState(2568);

    const handleSave = () => {
        if (!name.trim()) return;
        onSave({ name: name.trim(), year });
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="modal-header">
                    <h3>สร้าง Template ใหม่</h3>
                    <button className="modal-close" onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="modal-body">
                    <label className="form-label">ชื่อ Template</label>
                    <input
                        className="form-input"
                        placeholder="เช่น หลักสูตรวิทยาการคอมพิวเตอร์ 2568"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSave()}
                        autoFocus
                    />

                    <label className="form-label" style={{ marginTop: '1rem' }}>
                        ปีการศึกษา (พ.ศ.)
                    </label>
                    <input
                        className="form-input"
                        type="number"
                        min={2560}
                        max={2599}
                        value={year}
                        onChange={e => setYear(Number(e.target.value))}
                    />
                </div>

                {/* Footer */}
                <div className="modal-footer">
                    <button className="btn btn--ghost" onClick={onClose}>ยกเลิก</button>
                    <button
                        className="btn btn--primary"
                        onClick={handleSave}
                        disabled={!name.trim()}
                    >
                        <Check size={16} /> บันทึก
                    </button>
                </div>
            </div>
        </div>
    );
}