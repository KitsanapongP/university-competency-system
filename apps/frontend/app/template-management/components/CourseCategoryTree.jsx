'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronRight, ChevronDown, Plus, GripVertical } from 'lucide-react';

// ============================================================
// Recode — คำนวณ code ใหม่ทั้ง subtree หลังจัดเรียง
// parentCode = "" → root level (1, 2, 3...)
// parentCode = "1" → children (1.1, 1.2, 1.3...)
// ============================================================
function recodeChildren(children, parentCode) {
    return children.map((cat, index) => {
        const newCode = parentCode
            ? `${parentCode}.${index + 1}`
            : `${index + 1}`;
        return {
            ...cat,
            code: newCode,
            children: cat.children?.length > 0
                ? recodeChildren(cat.children, newCode)
                : cat.children,
        };
    });
}

// depth ของ code เช่น "1"→0, "1.1"→1, "1.1.1"→2
function getDepthFromCode(code) {
    if (!code) return 0;
    return code.split('.').length - 1;
}

// หา next code ของ children ใน parent
function getNextCode(parentCode, siblings) {
    const next = siblings.length + 1;
    return parentCode ? `${parentCode}.${next}` : `${next}`;
}

// ============================================================
// Drag state ระดับ module (ใช้ ref แทน state เพื่อไม่ re-render)
// ============================================================
let globalDragSource = null; // { cat, parentId }

// ============================================================
// TreeItem
// ============================================================
function TreeItem({
    category,
    parentId,
    depth,
    index,
    siblings,
    selectedId,
    onSelect,
    editingId,
    editingName,
    setEditingName,
    onRename,
    onStartEdit,
    onDrop,          // (sourceInfo, targetInfo, position) → 'before'|'after'|'inside'
}) {
    const [expanded, setExpanded]   = useState(depth <= 1);
    const [dragOver, setDragOver]   = useState(null); // 'before'|'after'|'inside'
    const itemRef = useRef(null);

    const hasChildren = category.children?.length > 0;
    const isSelected  = selectedId === category.id;
    const isEditing   = editingId  === category.id;
    const maxDepth    = 2; // 0=root, 1=sub, 2=subsub

    useEffect(() => {
        if (hasChildren) setExpanded(true);
    }, [category.children?.length]);

    // ---- Drag source ----
    const handleDragStart = (e) => {
        globalDragSource = { cat: category, parentId };
        e.dataTransfer.effectAllowed = 'move';
        e.stopPropagation();
    };

    // ---- Drag target ----
    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!globalDragSource || globalDragSource.cat.id === category.id) return;

        const rect = itemRef.current?.getBoundingClientRect();
        if (!rect) return;

        const y = e.clientY - rect.top;
        const h = rect.height;

        let position;
        if (y < h * 0.25) {
            position = 'before';
        } else if (y > h * 0.75) {
            position = depth < maxDepth ? 'after' : 'after'; // ถ้า depth < max อนุญาต inside ด้วย
        } else {
            // กลางๆ → inside (ถ้า depth ไม่เกิน limit)
            position = depth < maxDepth ? 'inside' : 'after';
        }

        setDragOver(position);
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDragLeave = (e) => {
        e.stopPropagation();
        setDragOver(null);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!globalDragSource || globalDragSource.cat.id === category.id) {
            setDragOver(null);
            return;
        }
        onDrop(
            globalDragSource,
            { cat: category, parentId, index, siblings },
            dragOver || 'after'
        );
        setDragOver(null);
        globalDragSource = null;
    };

    return (
        <div className="tree-item-wrapper">
            {/* Drop indicator — before */}
            {dragOver === 'before' && <div className="tree-drop-indicator" />}

            <div
                ref={itemRef}
                className={[
                    'tree-item',
                    isSelected  ? 'tree-item--selected' : '',
                    dragOver === 'inside' ? 'tree-item--dragover-inside' : '',
                ].join(' ')}
                style={{ paddingLeft: `${10 + depth * 16}px` }}
                draggable
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => onSelect(category)}
                onDoubleClick={e => { e.stopPropagation(); onStartEdit(category); }}
            >
                <span className="tree-drag-handle"><GripVertical size={12} /></span>

                <button
                    className="tree-toggle"
                    onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
                >
                    {hasChildren
                        ? (expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />)
                        : <span className="tree-toggle--spacer" />}
                </button>

                <span className="tree-code">{category.code}</span>

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

            {/* Drop indicator — after */}
            {dragOver === 'after' && <div className="tree-drop-indicator" />}

            {/* Children */}
            {hasChildren && expanded && (
                <div className="tree-children">
                    {category.children.map((child, i) => (
                        <TreeItem
                            key={child.id}
                            category={child}
                            parentId={category.id}
                            depth={depth + 1}
                            index={i}
                            siblings={category.children}
                            selectedId={selectedId}
                            onSelect={onSelect}
                            editingId={editingId}
                            editingName={editingName}
                            setEditingName={setEditingName}
                            onRename={onRename}
                            onStartEdit={onStartEdit}
                            onDrop={onDrop}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// ============================================================
// CourseCategoryTree
// ============================================================
export default function CourseCategoryTree({
    categories = [],
    selectedId,
    onSelect,
    onCreateCategory,
    onRename,
    onReorder,   // (newCategories) → set state ใน page.js
    template,
}) {
    const [editingId,   setEditingId]   = useState(null);
    const [editingName, setEditingName] = useState('');

    // auto focus เมื่อมี isNew
    // เมื่อ categories เปลี่ยน → หา node ที่มี isNew = true → setEditingId เพื่อ auto focus input
    // เดี๋ยวในอนาคตจะกลับมา Refactor เป็น useRef แทน 
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

    // ============================================================
    // handleDrop — core sortable logic
    // sourceInfo = { cat, parentId }
    // targetInfo = { cat, parentId, index, siblings }
    // position   = 'before' | 'after' | 'inside'
    // ============================================================
    const handleDrop = useCallback((sourceInfo, targetInfo, position) => {
        const { cat: srcCat, parentId: srcParentId } = sourceInfo;
        const { cat: tgtCat, parentId: tgtParentId, index: tgtIndex } = targetInfo;

        // ไม่ drop ลงใน descendant ตัวเอง
        if (isDescendant(srcCat, tgtCat.id)) return;

        // 1. ลบ source ออกจากที่เดิม
        let newCats = removeNode(categories, srcCat.id);

        if (position === 'inside') {
            // วาง inside target → เป็น child ของ target
            newCats = insertAsChild(newCats, tgtCat.id, srcCat);
        } else {
            // วาง before/after target → sibling ของ target
            const insertIdx = position === 'before' ? tgtIndex : tgtIndex + 1;
            newCats = insertAtIndex(newCats, tgtParentId, srcCat, insertIdx);
        }

        // 2. recode ใหม่ทั้ง tree
        newCats = recodeChildren(newCats, '');

        onReorder(newCats);
    }, [categories, onReorder]);

    // Drop zone ที่ root level (ด้านล่าง tree ทั้งหมด)
    const handleRootDrop = (e) => {
        e.preventDefault();
        if (!globalDragSource) return;
        const { cat: srcCat } = globalDragSource;
        let newCats = removeNode(categories, srcCat.id);
        newCats = [...newCats, srcCat];
        newCats = recodeChildren(newCats, '');
        onReorder(newCats);
        globalDragSource = null;
    };

    return (
        <div className="tm-panel tm-panel--tree">
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
                        onClick={onCreateCategory}
                    >
                        <Plus size={14} />
                    </button>
                )}
            </div>

            {!template ? (
                <div className="panel-empty"><span>เลือก Template ก่อน</span></div>
            ) : (
                <div
                    className="category-tree"
                    onClick={e => { if (e.target === e.currentTarget) onSelect(null); }}
                    onDragOver={e => e.preventDefault()}
                    onDrop={handleRootDrop}
                >
                    {categories.map((cat, i) => (
                        <TreeItem
                            key={cat.id}
                            category={cat}
                            parentId={null}
                            depth={0}
                            index={i}
                            siblings={categories}
                            selectedId={selectedId}
                            onSelect={onSelect}
                            editingId={editingId}
                            editingName={editingName}
                            setEditingName={setEditingName}
                            onRename={handleRename}
                            onStartEdit={handleStartEdit}
                            onDrop={handleDrop}
                        />
                    ))}
                    {/* drop zone ด้านล่าง */}
                    <div
                        className="tree-root-drop-zone"
                        onDragOver={e => e.preventDefault()}
                        onDrop={handleRootDrop}
                    />
                </div>
            )}
        </div>
    );
}

// ============================================================
// Tree operation helpers
// ============================================================

// ลบ node ออกจาก tree
function removeNode(cats, id) {
    return cats
        .filter(c => c.id !== id)
        .map(c => ({ ...c, children: removeNode(c.children || [], id) }));
}

// แทรก node เป็น child ของ targetId
function insertAsChild(cats, targetId, node) {
    return cats.map(c => {
        if (c.id === targetId) {
            return { ...c, children: [...(c.children || []), node] };
        }
        return { ...c, children: insertAsChild(c.children || [], targetId, node) };
    });
}

// แทรก node ที่ index ใน parent (parentId=null → root)
function insertAtIndex(cats, parentId, node, index) {
    if (parentId === null) {
        const result = [...cats];
        result.splice(index, 0, node);
        return result;
    }
    return cats.map(c => {
        if (c.id === parentId) {
            const children = [...(c.children || [])];
            children.splice(index, 0, node);
            return { ...c, children };
        }
        return { ...c, children: insertAtIndex(c.children || [], parentId, node, index) };
    });
}

// เช็คว่า node เป็น descendant ของ id หรือไม่
function isDescendant(node, id) {
    if (!node.children?.length) return false;
    return node.children.some(c => c.id === id || isDescendant(c, id));
}

// หา node ที่มี isNew
function findNew(cats) {
    for (const cat of cats) {
        if (cat.isNew) return cat;
        const found = findNew(cat.children || []);
        if (found) return found;
    }
    return null;
}

export { getNextCode, getDepthFromCode };