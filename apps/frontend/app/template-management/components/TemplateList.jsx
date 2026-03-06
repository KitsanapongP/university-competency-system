'use client';

import { Plus, Trash2, BookOpen } from 'lucide-react';

/**
 * TemplateList — Panel 1
 *
 * Props:
 *   templates        — รายการ template ทั้งหมด
 *   selectedId       — id ที่เลือกอยู่
 *   onSelect(t)
 *   onDelete(id)
 *   onClickCreate()
 *   courseCountMap   — { [templateId]: number } จำนวนวิชาจริงจาก page.js
 */
export default function TemplateList({
    templates = [],
    selectedId,
    onSelect,
    onDelete,
    onClickCreate,
    courseCountMap = {},
}) {
    return (
        <div className="tm-panel tm-panel--list">
            <div className="panel-header">
                <h2>Template ทั้งหมด</h2>
                <span className="panel-badge">{templates.length}</span>
            </div>

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

                {templates.map(t => {
                    // ใช้ courseCountMap ถ้ามี ถ้าไม่มีก็ fallback เป็น 0
                    const courseCount = courseCountMap[t.id] ?? 0;

                    return (
                        <div
                            key={t.id}
                            className={`template-item ${selectedId === t.id ? 'template-item--selected' : ''}`}
                            onClick={() => onSelect(t)}
                        >
                            <div className="template-item__info">
                                <span className="template-item__name">{t.name}</span>
                                <span className="template-item__meta">
                                    ปี {t.year} · {courseCount} วิชา
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
                    );
                })}
            </div>

            <div className="panel-footer">
                <button className="btn btn--primary btn--full" onClick={onClickCreate}>
                    <Plus size={15} /> สร้าง Template ใหม่
                </button>
            </div>
        </div>
    );
}