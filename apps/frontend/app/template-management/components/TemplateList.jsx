'use client';

import { Plus, Trash2, BookOpen, ChevronsLeft, ChevronsRight } from 'lucide-react';

export default function TemplateList({
    templates = [],
    selectedId,
    onSelect,
    onDelete,
    onClickCreate,
    courseCountMap = {},
    collapsed = false,
    onToggleCollapse,
}) {
    return (
        <div className={`tm-panel tm-panel--list ${collapsed ? 'tm-panel--collapsed' : ''}`}>

            {/* ── Header ── */}
            <div className="panel-header">
                {!collapsed && (
                    <>
                        <h2>Template ทั้งหมด</h2>
                        <span className="panel-badge">{templates.length}</span>
                    </>
                )}
                <button
                    className="icon-btn icon-btn--xs panel-collapse-btn"
                    onClick={onToggleCollapse}
                    title={collapsed ? 'ขยาย Panel' : 'ย่อ Panel'}
                    style={{ marginLeft: collapsed ? 'auto' : 'auto' }}
                >
                    {collapsed ? <ChevronsRight size={15}/> : <ChevronsLeft size={15}/>}
                </button>
            </div>

            {/* ── Content (ซ่อนเมื่อ collapsed) ── */}
            {!collapsed && (
                <>
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
                                        ปี {t.year} · {courseCountMap[t.id] ?? 0} วิชา
                                    </span>
                                </div>
                                <button
                                    className="icon-btn icon-btn--danger"
                                    title="ลบ Template"
                                    onClick={e => { e.stopPropagation(); onDelete(t); }}
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="panel-footer">
                        <button className="btn btn--primary btn--full" onClick={onClickCreate}>
                            <Plus size={15} /> สร้าง Template ใหม่
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}