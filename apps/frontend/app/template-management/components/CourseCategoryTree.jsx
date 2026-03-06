'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronRight, ChevronDown, Plus, GripVertical, BookOpen, Trash2 } from 'lucide-react';

// ---- global drag state แยกระหว่าง category drag กับ course drag ----
let globalCatDrag    = null; // { cat, parentId }
let globalCourseDrag = null; // { course, fromCategoryId }

// ============================================================
// Helpers
// ============================================================
function getDepthFromCode(code) {
    if (!code) return 0;
    return code.split('.').length - 1;
}
function getNextCode(parentCode, siblings) {
    const next = siblings.length + 1;
    return parentCode ? `${parentCode}.${next}` : `${next}`;
}
function recodeChildren(children, parentCode) {
    return children.map((cat, index) => {
        const newCode = parentCode ? `${parentCode}.${index + 1}` : `${index + 1}`;
        return { ...cat, code: newCode, children: cat.children?.length > 0 ? recodeChildren(cat.children, newCode) : cat.children };
    });
}

// ============================================================
// CourseItem — แสดงในแถว inline ใต้ tree node
// รองรับ drag ออกไปยัง category อื่น
// ============================================================
function CourseItem({ course, categoryId, onDelete, onCourseDragStart }) {
    return (
        <div
            className="course-row"
            draggable
            onDragStart={e => {
                e.stopPropagation();
                globalCourseDrag = { course, fromCategoryId: categoryId };
                onCourseDragStart?.();
                e.dataTransfer.effectAllowed = 'move';
            }}
            onDragEnd={() => { globalCourseDrag = null; }}
        >
            <GripVertical size={11} className="course-row__grip" />
            <BookOpen size={13} className="course-row__icon" />
            <span className="course-row__code">{course.code}</span>
            <span className="course-row__name">{course.nameTh}</span>
            <span className="course-row__credits">{course.credits} หน่วยกิต</span>
            <button
                className="icon-btn icon-btn--danger icon-btn--xs"
                onClick={e => { e.stopPropagation(); onDelete(course.id); }}
                title="ลบรายวิชา"
            >
                <Trash2 size={12} />
            </button>
        </div>
    );
}

// ============================================================
// TreeItem
// ============================================================
function TreeItem({
    category, parentId, depth, index, siblings,
    selectedId, onSelect,
    editingId, editingName, setEditingName, onRename, onStartEdit,
    onCatDrop,
    onCourseDropToCategory,  // (course, fromCatId, toCatId)
    coursesByCategoryId,
    onDeleteCourse,
    creditMap,
    draggingCourse,          // true เมื่อมี course กำลัง drag อยู่
}) {
    const [expanded,       setExpanded]       = useState(depth <= 1);
    const [catDragOver,    setCatDragOver]     = useState(null);   // 'before'|'after'|'inside'
    const [courseDropOver, setCourseDropOver] = useState(false);   // highlight เมื่อ course hover
    const itemRef = useRef(null);

    const hasChildren = category.children?.length > 0;
    const isLeaf      = !hasChildren;
    const isSelected  = selectedId === category.id;
    const isEditing   = editingId  === category.id;
    const maxDepth    = 2;
    const displayCredits = creditMap?.[category.id] ?? category.requiredCredits;
    const courses = isLeaf ? (coursesByCategoryId[category.id] || []) : [];

    useEffect(() => { if (hasChildren) setExpanded(true); }, [category.children?.length]);

    // ---- Category drag handlers ----
    const handleCatDragStart = (e) => {
        if (globalCourseDrag) return; // ถ้า course กำลัง drag อยู่ไม่ให้ drag category
        globalCatDrag = { cat: category, parentId };
        e.dataTransfer.effectAllowed = 'move';
        e.stopPropagation();
    };

    const handleDragOver = (e) => {
        e.preventDefault(); e.stopPropagation();

        // Course drag → highlight leaf node เป็นเป้า drop
        if (globalCourseDrag) {
            if (isLeaf && globalCourseDrag.fromCategoryId !== category.id) {
                setCourseDropOver(true);
            }
            return;
        }

        // Category drag
        if (!globalCatDrag || globalCatDrag.cat.id === category.id) return;
        const rect = itemRef.current?.getBoundingClientRect();
        if (!rect) return;
        const y = e.clientY - rect.top;
        const h = rect.height;
        setCatDragOver(y < h * 0.25 ? 'before' : y > h * 0.75 ? 'after' : depth < maxDepth ? 'inside' : 'after');
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDragLeave = (e) => {
        e.stopPropagation();
        setCatDragOver(null);
        setCourseDropOver(false);
    };

    const handleDrop = (e) => {
        e.preventDefault(); e.stopPropagation();

        // Course drop → ย้ายวิชาไป category นี้
        if (globalCourseDrag) {
            if (isLeaf && globalCourseDrag.fromCategoryId !== category.id) {
                onCourseDropToCategory(globalCourseDrag.course, globalCourseDrag.fromCategoryId, category.id);
            }
            globalCourseDrag = null;
            setCourseDropOver(false);
            return;
        }

        // Category drop
        if (!globalCatDrag || globalCatDrag.cat.id === category.id) { setCatDragOver(null); return; }
        onCatDrop(globalCatDrag, { cat: category, parentId, index, siblings }, catDragOver || 'after');
        setCatDragOver(null);
        globalCatDrag = null;
    };

    return (
        <div className="tree-item-wrapper">
            {catDragOver === 'before' && <div className="tree-drop-indicator" />}

            <div
                ref={itemRef}
                className={[
                    'tree-item',
                    isSelected          ? 'tree-item--selected'       : '',
                    catDragOver === 'inside' ? 'tree-item--dragover-inside' : '',
                    courseDropOver      ? 'tree-item--course-dropover' : '',
                ].join(' ')}
                style={{ paddingLeft: `${10 + depth * 16}px` }}
                draggable
                onDragStart={handleCatDragStart}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => onSelect(category)}
                onDoubleClick={e => { e.stopPropagation(); onStartEdit(category); }}
            >
                <span className="tree-drag-handle"><GripVertical size={12} /></span>

                <button className="tree-toggle"
                    onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}>
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
                            if (e.key === 'Enter') { e.preventDefault(); onRename(category.id, editingName); }
                            if (e.key === 'Escape') { onRename(category.id, category.name); }
                        }}
                        onClick={e => e.stopPropagation()}
                    />
                ) : (
                    <span className="tree-name">{category.name || 'หมวดใหม่'}</span>
                )}

                <span className={`tree-credits ${displayCredits > 0 && displayCredits !== category.requiredCredits ? 'tree-credits--live' : ''}`}>
                    {displayCredits} หน่วยกิต
                </span>

                {isLeaf && courses.length > 0 && (
                    <span className="tree-course-badge">{courses.length}</span>
                )}
            </div>

            {catDragOver === 'after' && <div className="tree-drop-indicator" />}

            {/* รายวิชา inline เมื่อ selected */}
            {isLeaf && isSelected && courses.length > 0 && (
                <div className="course-list-inline" style={{ paddingLeft: `${26 + depth * 16}px` }}>
                    {courses.map(course => (
                        <CourseItem
                            key={course.id}
                            course={course}
                            categoryId={category.id}
                            onDelete={onDeleteCourse}
                            onCourseDragStart={() => {}}
                        />
                    ))}
                </div>
            )}

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
                            onCatDrop={onCatDrop}
                            onCourseDropToCategory={onCourseDropToCategory}
                            coursesByCategoryId={coursesByCategoryId}
                            onDeleteCourse={onDeleteCourse}
                            creditMap={creditMap}
                            draggingCourse={draggingCourse}
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
    onReorder,
    template,
    coursesByCategoryId = {},
    onDeleteCourse,
    onMoveCourseToCategory,  // (course, fromCatId, toCatId)
    creditMap = {},
}) {
    const [editingId,      setEditingId]      = useState(null);
    const [editingName,    setEditingName]     = useState('');
    const [draggingCourse, setDraggingCourse] = useState(false);

    useEffect(() => {
        const newCat = findNew(categories);
        if (newCat) { setEditingId(newCat.id); setEditingName(''); }
    }, [categories]);

    const handleStartEdit = useCallback((cat) => {
        setEditingId(cat.id); setEditingName(cat.name);
    }, []);
    const handleRename = useCallback((id, newName) => {
        onRename(id, newName || 'หมวดใหม่'); setEditingId(null);
    }, [onRename]);

    const handleCatDrop = useCallback((sourceInfo, targetInfo, position) => {
        const { cat: srcCat } = sourceInfo;
        const { cat: tgtCat, parentId: tgtParentId, index: tgtIndex } = targetInfo;
        if (isDescendant(srcCat, tgtCat.id)) return;
        let newCats = removeNode(categories, srcCat.id);
        if (position === 'inside') {
            newCats = insertAsChild(newCats, tgtCat.id, srcCat);
        } else {
            newCats = insertAtIndex(newCats, tgtParentId, srcCat, position === 'before' ? tgtIndex : tgtIndex + 1);
        }
        onReorder(recodeChildren(newCats, ''));
    }, [categories, onReorder]);

    const handleRootDrop = (e) => {
        e.preventDefault();
        if (globalCourseDrag) { globalCourseDrag = null; return; }
        if (!globalCatDrag) return;
        let newCats = removeNode(categories, globalCatDrag.cat.id);
        onReorder(recodeChildren([...newCats, globalCatDrag.cat], ''));
        globalCatDrag = null;
    };

    const handleCourseDropToCategory = useCallback((course, fromCatId, toCatId) => {
        onMoveCourseToCategory(course, fromCatId, toCatId);
        setDraggingCourse(false);
    }, [onMoveCourseToCategory]);

    return (
        <div className="tm-panel tm-panel--tree">
            <div className="panel-header">
                <h2>หมวดวิชา</h2>
                {template && <span className="panel-badge--template" title={template.name}>{template.name}</span>}
                {template && (
                    <button className="btn btn--ghost btn--sm" title="เพิ่มหมวดวิชาใหม่" onClick={onCreateCategory}>
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
                            onCatDrop={handleCatDrop}
                            onCourseDropToCategory={handleCourseDropToCategory}
                            coursesByCategoryId={coursesByCategoryId}
                            onDeleteCourse={onDeleteCourse}
                            creditMap={creditMap}
                            draggingCourse={draggingCourse}
                        />
                    ))}
                    <div className="tree-root-drop-zone"
                        onDragOver={e => e.preventDefault()} onDrop={handleRootDrop} />
                </div>
            )}
        </div>
    );
}

// ============================================================
// Tree helpers
// ============================================================
function findNew(cats) {
    for (const cat of cats) {
        if (cat.isNew) return cat;
        const found = findNew(cat.children || []);
        if (found) return found;
    }
    return null;
}
function removeNode(cats, id) {
    return cats.filter(c => c.id !== id).map(c => ({ ...c, children: removeNode(c.children || [], id) }));
}
function insertAsChild(cats, targetId, node) {
    return cats.map(c => {
        if (c.id === targetId) return { ...c, children: [...(c.children || []), node] };
        return { ...c, children: insertAsChild(c.children || [], targetId, node) };
    });
}
function insertAtIndex(cats, parentId, node, index) {
    if (parentId === null) { const r = [...cats]; r.splice(index, 0, node); return r; }
    return cats.map(c => {
        if (c.id === parentId) {
            const children = [...(c.children || [])]; children.splice(index, 0, node);
            return { ...c, children };
        }
        return { ...c, children: insertAtIndex(c.children || [], parentId, node, index) };
    });
}
function isDescendant(node, id) {
    if (!node.children?.length) return false;
    return node.children.some(c => c.id === id || isDescendant(c, id));
}

export { getNextCode, getDepthFromCode };