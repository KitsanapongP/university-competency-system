'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown, Plus } from 'lucide-react';

/**
 * TreeItem — แสดง node เดียว พร้อม recursive children
 */
function TreeItem({ 
    category, 
    depth = 0, 
    selectedId, 
    onSelect,
    editingId,        // ← เพิ่ม
    editingName,      // ← เพิ่ม
    setEditingName,   // ← เพิ่ม
    onRename          // ← เพิ่ม
}) {
    const [expanded, setExpanded] = useState(depth === 0);
    const hasChildren = category.children?.length > 0;
    const isSelected = selectedId === category.id;
    const isEditing = editingId === category.id;
    
    return (
        <div className="tree-item-wrapper">
            <div
                className={`tree-item ${isSelected ? 'tree-item--selected' : ''}`}
                style={{ paddingLeft: `${10 + depth * 16}px` }}
                onClick={() => onSelect(category)}
            >
                {/* expand/collapse toggle */}
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

                {/* edit mode */}
                {editingId === category.id ? (
                    <input
                        className="tree-name-input"
                        value={editingName}
                        autoFocus
                        onChange={e => setEditingName(e.target.value)}
                        onBlur={() => {
                            onRename(category.id, editingName);
                            setEditingId(null);
                        }}
                        onKeyDown={e => {
                            if (e.key === 'Enter') {
                                onRename(category.id, editingName);
                                setEditingId(null);
                            }
                            if (e.key === 'Escape') {
                                setEditingId(null);
                            }
                        }}
                        onClick={e => e.stopPropagation()}
                    />
                ) : (
                    <span className="tree-name">{category.name}</span>
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
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

/**
 * CourseCategoryTree — Panel 2
 * แสดง Tree hierarchy ของหมวดวิชา
 *
 * Props:
 *   categories      — โครงสร้างหมวดวิชา (nested)
 *   selectedId      — id ของ category ที่เลือกอยู่
 *   onSelect(cat)   — เมื่อคลิกเลือก category
 *   template        — template ที่เลือกอยู่ (เพื่อแสดงชื่อใน header)
 */
export default function CourseCategoryTree({
    categories = [],
    selectedId,
    onSelect,
    onCreateCategory,  // รับจาก page.js
    onRename,          // รับจาก page.js
    template,
}) {
    
    // สำหรับ edit mode
    const [editingId, setEditingId] = useState(null);
    const [editingName, setEditingName] = useState('');
    
    // เมื่อ categories เปลี่ยน → เช็คว่ามี isNew ไหม → auto focus
    const handleInputChange = (idx) => {
        const newCat = findNew(categories);
        if (newCat) {
            setEditingId(newCat.id);
            setEditingName(newCat.name);
        }
        setHighlightIdx(idx);
    }
    /*
    useEffect(() => {
        const newCat = findNew(categories);
        if (newCat) {
            setEditingId(newCat.id);
            setEditingName(newCat.name);
        }
    }, [categories]);
*/
    const handleRename = (id, newName) => {
        onRename(id, newName);
        setEditingId(null);
    };

    return (
        <div className="tm-panel tm-panel--tree">
            {/* Panel Header */}
            <div className="panel-header">
                <h2>หมวดวิชา</h2>
                {template && (
                    <span className="panel-badge--template" title={template.name}>
                        {template.name}
                    </span>
                )}
                <button className="btn btn--ghost btn--sm" title="เพิ่มหมวดวิชาใหม่" 
                    onClick={() => createCourseCategory(template.id)}
                >
                    <Plus size={14} />
                </button>
            </div>

            {/* Body */}
            {!template ? (
                <div className="panel-empty">
                    <span>เลือก Template ก่อน</span>
                </div>
            ) : (
                <div className="category-tree">
                    {categories.map(cat => (
                        <TreeItem
                            key={cat.id}
                            category={cat}
                            selectedId={selectedId}
                            onSelect={onSelect}
                            editingId={editingId}
                            editingName={editingName}
                            setEditingName={setEditingName}
                            onRename={onRename}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function findNew(cats) {
    for (const cat of cats) {
        if (cat.isNew) return cat;
        const found = findNew(cat.children || []);
        if (found) return found;
    }
    return null;
}