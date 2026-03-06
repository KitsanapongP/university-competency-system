'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronRight, ChevronDown, Plus, GripVertical } from 'lucide-react';

// ============================================================
// Helper — คำนวณ code อัตโนมัติจาก parent
// เช่น parent.code = "1" → children มี "1.1","1.2" → next = "1.3"
// ============================================================
function getNextCode(parentCode, siblings) {
    const prefix = parentCode ? `${parentCode}.` : '';
    const existingNums = siblings
        .map(s => {
            const suffix = s.code?.replace(prefix, '');
            const num = parseInt(suffix, 10);
            return isNaN(num) ? 0 : num;
        })
        .filter(n => n > 0);
    const next = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1;
    return `${prefix}${next}`;
}

// ============================================================
// Helper — คำนวณ depth จาก code
// "1" → 0, "1.1" → 1, "1.1.1" → 2
// ============================================================
function getDepthFromCode(code) {
    if (!code) return 0;
    return code.split('.').length - 1;
}

// ============================================================
// TreeItem
// ============================================================
function TreeItem({
    category,
    depth = 0,
    selectedId,
    onSelect,
    editingId,
    editingName,
    setEditingName,
    onRename,
    onStartEdit,
    // drag props
    draggingId,
    dragOverId,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
}) {
    const [expanded, setExpanded] = useState(depth <= 1);
    const hasChildren = category.children?.length > 0;
    const isSelected = selectedId === category.id;
    const isEditing  = editingId  === category.id;
    const isDragging = draggingId === category.id;
    const isDragOver = dragOverId === category.id;

    // auto expand เมื่อ children เพิ่มขึ้น
    useEffect(() => {
        if (hasChildren) setExpanded(true);
    }, [category.children?.length]);

    return (
        <div
            className={`tree-item-wrapper ${isDragging ? 'tree-item--dragging' : ''} ${isDragOver ? 'tree-item--dragover' : ''}`}
            draggable
            onDragStart={e => onDragStart(e, category)}
            onDragOver={e => onDragOver(e, category)}
            onDrop={e => onDrop(e, category)}
            onDragEnd={onDragEnd}
        >
            <div
                className={`tree-item ${isSelected ? 'tree-item--selected' : ''}`}
                style={{ paddingLeft: `${10 + depth * 16}px` }}
                onClick={() => onSelect(category)}
                onDoubleClick={e => { e.stopPropagation(); onStartEdit(category); }}
            >
                {/* Drag handle */}
                <span className="tree-drag-handle">
                    <GripVertical size={12} />
                </span>

                {/* Expand toggle */}
                <button
                    className="tree-toggle"
                    onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
                >
                    {hasChildren
                        ? (expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />)
                        : <span className="tree-toggle--spacer" />
                    }
                </button>

                <span className="tree-code">{category.code}</span>

                {/* Inline rename input / label */}
                {isEditing ? (
                    <input
                        className="tree-name-input"
                        value={editingName}
                        autoFocus
                        onChange={e => setEditingName(e.target.value)}
                        onBlur={() => onRename(category.id, editingName)}
                        onKeyDown={e => {
                            if (e.key === 'Enter')  { e.preventDefault(); onRename(category.id, editingName); }
                            if (e.key === 'Escape') { onRename(category.id, category.name); }
                        }}
                        onClick={e => e.stopPropagation()}
                    />
                ) : (
                    <span className="tree-name">{category.name || 'หมวดใหม่'}</span>
                )}

                <span className="tree-credits">{category.requiredCredits} หน่วยกิต</span>
            </div>

            {/* Children */}
            {hasChildren && expanded && (
                <div className="tree-children">
                    {category.children.map(child => (
                        <TreeItem
                            key={child.id}
                            category={child}
                            depth={depth + 1}
                            selectedId={selectedId}
                            onSelect={onSelect}
                            editingId={editingId}
                            editingName={editingName}
                            setEditingName={setEditingName}
                            onRename={onRename}
                            onStartEdit={onStartEdit}
                            draggingId={draggingId}
                            dragOverId={dragOverId}
                            onDragStart={onDragStart}
                            onDragOver={onDragOver}
                            onDrop={onDrop}
                            onDragEnd={onDragEnd}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// ============================================================
// CourseCategoryTree — Panel 2
// ============================================================
export default function CourseCategoryTree({
    categories = [],
    selectedId,
    onSelect,
    onCreateCategory,
    onRename,
    onMoveCategory,
    template,
}) {
    const [editingId,   setEditingId]   = useState(null);
    const [editingName, setEditingName] = useState('');
    const [draggingId,  setDraggingId]  = useState(null);
    const [dragOverId,  setDragOverId]  = useState(null);
    const draggingCatRef = useRef(null);

    // Auto focus เมื่อมี isNew
    useEffect(() => {
        const newCat = findNew(categories);
        if (newCat) {
            setEditingId(newCat.id);
            setEditingName('');
        }
    }, [categories]);

    const handleStartEdit = useCallback((cat) => {
        setEditingId(cat.id);
        setEditingName(cat.name);
    }, []);

    const handleRename = useCallback((id, newName) => {
        onRename(id, newName || 'หมวดใหม่');
        setEditingId(null);
    }, [onRename]);

    // ---- Drag handlers ----
    const handleDragStart = useCallback((e, category) => {
        draggingCatRef.current = category;
        setDraggingId(category.id);
        e.dataTransfer.effectAllowed = 'move';
    }, []);

    const handleDragOver = useCallback((e, category) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (category.id !== draggingCatRef.current?.id) {
            setDragOverId(category.id);
        }
    }, []);

    const handleDrop = useCallback((e, targetCategory) => {
        e.preventDefault();
        const source = draggingCatRef.current;
        if (!source || source.id === targetCategory.id) return;
        onMoveCategory?.(source.id, targetCategory.id);
        setDraggingId(null);
        setDragOverId(null);
        draggingCatRef.current = null;
    }, [onMoveCategory]);

    const handleDragEnd = useCallback(() => {
        setDraggingId(null);
        setDragOverId(null);
        draggingCatRef.current = null;
    }, []);

    // คลิกที่พื้นที่ว่าง → ยกเลิก selection
    const handlePanelClick = (e) => {
        if (e.target === e.currentTarget) {
            onSelect(null);
        }
    };

    return (
        <div className="tm-panel tm-panel--tree">
            {/* Header */}
            <div className="panel-header">
                <h2>หมวดวิชา</h2>
                {template && (
                    <span className="panel-badge--template" title={template.name}>
                        {template.name}
                    </span>
                )}
                {template && (
                    <button
                        className="btn btn--ghost btn--sm"
                        title="เพิ่มหมวดวิชาใหม่"
                        onClick={() => onCreateCategory()}
                    >
                        <Plus size={14} />
                    </button>
                )}
            </div>

            {/* Body */}
            {!template ? (
                <div className="panel-empty">
                    <span>เลือก Template ก่อน</span>
                </div>
            ) : (
                // onClick บน div นี้ → ยกเลิก selection เมื่อคลิกที่ว่าง
                <div
                    className="category-tree"
                    onClick={handlePanelClick}
                >
                    {categories.map(cat => (
                        <TreeItem
                            key={cat.id}
                            category={cat}
                            selectedId={selectedId}
                            onSelect={onSelect}
                            editingId={editingId}
                            editingName={editingName}
                            setEditingName={setEditingName}
                            onRename={handleRename}
                            onStartEdit={handleStartEdit}
                            draggingId={draggingId}
                            dragOverId={dragOverId}
                            onDragStart={handleDragStart}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                            onDragEnd={handleDragEnd}
                        />
                    ))}
                    {/* พื้นที่ว่างด้านล่าง tree สำหรับ drop ที่ root level */}
                    <div
                        className="tree-drop-zone"
                        onDragOver={e => { e.preventDefault(); }}
                        onDrop={e => { e.preventDefault(); onMoveCategory?.(draggingCatRef.current?.id, null); handleDragEnd(); }}
                    />
                </div>
            )}
        </div>
    );
}

// ============================================================
// Helpers
// ============================================================
function findNew(cats) {
    for (const cat of cats) {
        if (cat.isNew) return cat;
        const found = findNew(cat.children || []);
        if (found) return found;
    }
    return null;
}

// Export helpers สำหรับใช้ใน page.js
export { getNextCode, getDepthFromCode };