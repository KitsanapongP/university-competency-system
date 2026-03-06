'use client';

import { Trash2, X, AlertTriangle } from 'lucide-react';

/**
 * ConfirmDeleteModal — popup ยืนยันก่อนลบหมวดวิชา
 *
 * Props:
 *   category  — category ที่จะลบ { code, name }
 *   onConfirm — กดยืนยันลบ
 *   onCancel  — กดยกเลิก / คลิก overlay
 */
export default function ConfirmDeleteModal({ category, onConfirm, onCancel }) {
    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal-box modal-box--sm" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="modal-header">
                    <h3>ยืนยันการลบหมวดวิชา</h3>
                    <button className="modal-close" onClick={onCancel}>
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="modal-body">
                    <div className="confirm-delete__icon">
                        <AlertTriangle size={36} />
                    </div>
                    <p className="confirm-delete__desc">
                        คุณต้องการลบหมวดวิชานี้ใช่หรือไม่?
                    </p>
                    <p className="confirm-delete__name">
                        {category?.code} {category?.name}
                    </p>
                    <p className="confirm-delete__warn">
                        หมวดวิชาย่อยและรายวิชาทั้งหมดที่อยู่ภายในจะถูกลบไปด้วย
                        และไม่สามารถกู้คืนได้
                    </p>
                </div>

                {/* Footer */}
                <div className="modal-footer">
                    <button className="btn btn--ghost" onClick={onCancel}>
                        ยกเลิก
                    </button>
                    <button className="btn btn--danger" onClick={onConfirm}>
                        <Trash2 size={15} /> ลบหมวดวิชา
                    </button>
                </div>

            </div>
        </div>
    );
}