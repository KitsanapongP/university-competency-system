'use client';

import { Plus, Trash2, BookOpen } from 'lucide-react';

/**
 * TemplateList — Panel 1
 * แสดงรายการ Template ทั้งหมด + ปุ่มสร้างใหม่/ลบ
 *
 * Props:
 *   templates       — รายการ template ทั้งหมด
 *   selectedId      — id ของ template ที่เลือกอยู่
 *   onSelect(t)     — เมื่อคลิกเลือก template
 *   onDelete(id)    — เมื่อกดลบ template
 *   onClickCreate() — เมื่อกดปุ่มสร้างใหม่
 */
export default function TemplateList({
    templates = [],
    selectedId,
    onSelect,
    onDelete,
    onClickCreate,
}) {
    return (
        <div className="tm-panel tm-panel--list">
            {/* Panel Header */}
            <div className="panel-header">
                <h2>Template ทั้งหมด</h2>
                <span className="panel-badge">{templates.length}</span>
            </div>

            {/* List */}
            <div className="template-list">
                {templates.length === 0 && (
                    <div className="panel-empty">
                        <BookOpen size={28} opacity={0.3} />
                        <span>ยังไม่มี Template</span>
                        <button className="btn btn--ghost btn--sm" onClick={onClickCreate}>
                            <Plus size={14} /> สร้างเลย
                        </button>
                    </div>
                )}

                {templates.map(t => (
                    <div
                        key={t.id}
                        className={`template-item ${selectedId === t.id ? 'template-item--selected' : ''}`}
                        onClick={() => onSelect(t)}
                    >
                        <div className="template-item__info">
                            <span className="template-item__name">{t.name}</span>
                            <span className="template-item__meta">
                                ปี {t.year} · {t.courseCount} วิชา
                            </span>
                        </div>
                        <button
                            className="icon-btn icon-btn--danger"
                            title="ลบ Template"
                            onClick={e => { e.stopPropagation(); onDelete(t.id); }}
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}
            </div>

            {/* Footer */}
            <div className="panel-footer">
                <button className="btn btn--primary btn--full" onClick={onClickCreate}>
                    <Plus size={15} /> สร้าง Template ใหม่
                </button>
            </div>
        </div>
    );
}