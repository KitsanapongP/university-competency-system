'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Plus, Search, BookOpen, Pencil, Trash2, Copy, Upload, ArrowLeft, Check, X, ChevronDown, ChevronRight, Layers, BookOpenCheck, Award, GripVertical, ChevronLeft, ChevronFirst, ChevronLast } from 'lucide-react';
import { MOCK_COURSE_MASTERS } from '../template-management/mockData.js';
import CourseFormModal from './components/CourseFormModal';
import ConfirmDeleteModal from '../template-management/components/ConfirmDeleteModal';
import './CourseManagement.css';

// ============================================================
// Helper functions
// ============================================================
function findById(cats, id) {
    for (const c of cats) {
        if (c.id === id) return c;
        const f = findById(c.children || [], id);
        if (f) return f;
    }
    return null;
}

function insertChild(cats, parentId, newChild) {
    return cats.map(c => {
        if (c.id === parentId) return { ...c, children: [...(c.children || []), newChild] };
        if (c.children?.length) return { ...c, children: insertChild(c.children, parentId, newChild) };
        return c;
    });
}

function removeCategory(cats, id) {
    return cats
        .filter(c => c.id !== id)
        .map(c => ({ ...c, children: c.children ? removeCategory(c.children, id) : c }));
}

function renameInTree(cats, id, name) {
    return cats.map(c => {
        if (c.id === id) return { ...c, name, isNew: false };
        if (c.children?.length) return { ...c, children: renameInTree(c.children, id, name) };
        return c;
    });
}

function getNextCode(parentCode, siblings) {
    return parentCode ? `${parentCode}.${siblings.length + 1}` : `${siblings.length + 1}`;
}

function getDepthFromCode(code) {
    return code ? code.split('.').length - 1 : 0;
}

function getDisplayCourses(categories, selectedCategory, showAll) {
    if (showAll) {
        const collectAll = (cats) => {
            const result = [];
            for (const cat of cats) {
                if (cat.courses?.length) result.push(...cat.courses);
                if (cat.children?.length) result.push(...collectAll(cat.children));
            }
            return result;
        };
        return collectAll(categories);
    }

    if (!selectedCategory) return [];

    const findAndAggregate = (cats, targetId, currentDepth) => {
        for (const cat of cats) {
            if (cat.id === targetId) {
                if (currentDepth >= 2) {
                    return cat.courses || [];
                }
                const result = [...(cat.courses || [])];
                if (cat.children?.length) {
                    for (const child of cat.children) {
                        result.push(...(child.courses || []));
                        if (child.children?.length) {
                            for (const grandchild of child.children) {
                                result.push(...(grandchild.courses || []));
                            }
                        }
                    }
                }
                return result;
            }
            if (cat.children?.length) {
                const found = findAndAggregate(cat.children, targetId, currentDepth + 1);
                if (found) return found;
            }
        }
        return [];
    };

    return findAndAggregate(categories, selectedCategory.id, 0);
}

function isDescendantOf(node, id) {
    return (node.children || []).some(c => c.id === id || isDescendantOf(c, id));
}

function getDirectChildren(cats, parentId) {
    if (!parentId) return cats;
    return findById(cats, parentId)?.children || [];
}

// ============================================================
// CourseCard — แสดงใน list view 
// ============================================================
function CourseCard({ course, onEdit, onDuplicate, onDelete, onOpen }) {
    return (
        <div className="cm-card" onClick={() => onOpen(course)}>
            <div className="cm-card__header">
                <div className="cm-card__icon">
                    <BookOpen size={24} />
                </div>
                <div className="cm-card__actions">
                    <button className="icon-btn" title="แก้ไข" onClick={e => { e.stopPropagation(); onEdit(course); }}>
                        <Pencil size={14} />
                    </button>
                    <button className="icon-btn" title="ทำสำเนา" onClick={e => { e.stopPropagation(); onDuplicate(course); }}>
                        <Copy size={14} />
                    </button>
                    <button className="icon-btn icon-btn--danger" title="ลบ" onClick={e => { e.stopPropagation(); onDelete(course); }}>
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>
            <h3 className="cm-card__title">
                {course.nameTh}
            </h3>
            <p className="cm-card__subtitle">{course.nameEn}</p>
            <div className="cm-card__meta">
                <span className="cm-card__meta-item">
                    <BookOpen size={12} />
                    ปี {course.year}
                </span>
                <span className="cm-card__meta-item">
                    <Award size={12} />
                    {course.degreeName}
                </span>
                <span className="cm-card__meta-item">
                    <Layers size={12} />
                    {course.templateCount} Templates
                </span>
            </div>
            <div className="cm-card__stats">
                <div className="cm-card__stat">
                    <span className="cm-card__stat-value">{course.stats.totalCourses}</span>
                    <span className="cm-card__stat-label">วิชา</span>
                </div>
                <div className="cm-card__stat">
                    <span className="cm-card__stat-value">{course.categories.length}</span>
                    <span className="cm-card__stat-label">หมวด</span>
                </div>
                <div className="cm-card__stat">
                    <span className="cm-card__stat-value">{course.stats.totalCredits}</span>
                    <span className="cm-card__stat-label">หน่วยกิต</span>
                </div>
                <span className={`cm-card__badge ${course.isActive ? 'cm-card__badge--active' : 'cm-card__badge--inactive'}`}>
                    {course.isActive ? <Check size={12} /> : <X size={12} />}
                    {course.isActive ? 'ใช้งาน' : 'ไม่ใช้งาน'}
                </span>
            </div>
        </div>
    );
}

// ============================================================
// Empty State
// ============================================================
function EmptyState({ onCreate }) {
    return (
        <div className="cm-empty">
            <div className="cm-empty__icon">
                <BookOpen size={40} />
            </div>
            <h3 className="cm-empty__title">ยังไม่มีหลักสูตร</h3>
            <p className="cm-empty__desc">เริ่มต้นสร้างหลักสูตรแรกของคุณเพื่อจัดการหลักสูตรนักศึกษา</p>
            <button className="btn btn--primary" onClick={onCreate}>
                <Plus size={16} /> สร้างหลักสูตร
            </button>
        </div>
    );
}

// ============================================================
// Main Page
// ============================================================
export default function CourseManagementPage() {
    const [view, setView] = useState('list'); // 'list' | 'editor'
    const [courses, setCourses] = useState(MOCK_COURSE_MASTERS);
    const [search, setSearch] = useState('');
    const [selectedCourse, setSelectedCourse] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [editingCourse, setEditingCourse] = useState(null);
    const [deletingCourse, setDeletingCourse] = useState(null);

    const courseIdRef = useRef(9000);

    // Filter courses
    const filteredCourses = courses.filter(c => {
        const term = search.toLowerCase();
        return c.nameTh.toLowerCase().includes(term) ||
            c.nameEn.toLowerCase().includes(term) ||
            String(c.year).includes(term);
    });

    // Stats
    const totalCourses = courses.length;
    const activeCourses = courses.filter(c => c.isActive).length;
    const totalTemplates = courses.reduce((sum, c) => sum + c.templateCount, 0);

    // Handlers
    const handleOpenCourse = useCallback((course) => {
        setSelectedCourse(course);
        setView('editor');
    }, []);

    const handleBackToList = useCallback(() => {
        setView('list');
        setSelectedCourse(null);
    }, []);

    const handleCreateCourse = useCallback(() => {
        setEditingCourse(null);
        setShowForm(true);
    }, []);

    const handleEditCourse = useCallback((course) => {
        setEditingCourse(course);
        setShowForm(true);
    }, []);

    const handleDuplicateCourse = useCallback((course) => {
        const id = ++courseIdRef.current;
        const newCourse = {
            ...course,
            id,
            nameTh: `${course.nameTh} (คัดลอก)`,
            nameEn: `${course.nameEn} (Copy)`,
            isActive: false,
            templateCount: 0,
        };
        setCourses(p => [...p, newCourse]);
    }, []);

    const handleDeleteCourse = useCallback((course) => {
        if (course.templateCount > 0) {
            alert(`ไม่สามารถลบหลักสูตร "${course.nameTh}" ได้ เนื่องจากมี Template ที่ใช้งานอยู่ ${course.templateCount} รายการ`);
            return;
        }
        setDeletingCourse(course);
    }, []);

    const handleConfirmDeleteCourse = useCallback(() => {
        if (deletingCourse) {
            setCourses(p => p.filter(c => c.id !== deletingCourse.id));
            setDeletingCourse(null);
        }
    }, [deletingCourse]);

    const handleSaveCourse = useCallback((courseData) => {
        if (editingCourse) {
            setCourses(p => p.map(c => c.id === editingCourse.id ? { ...courseData, id: editingCourse.id, templateCount: editingCourse.templateCount } : c));
        } else {
            const id = ++courseIdRef.current;
            setCourses(p => [...p, { ...courseData, id, templateCount: 0 }]);
        }
        setShowForm(false);
        setEditingCourse(null);
    }, [editingCourse]);

    // ============================================================
    // Editor View (Category/Course Management)
    // ============================================================
    const [categories, setCategories] = useState(selectedCourse?.categories || []);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [showAllCourses, setShowAllCourses] = useState(false);
    const [coursesByCategory, setCoursesByCategory] = useState({});
    const [deletingCategory, setDeletingCategory] = useState(null);

    const handleSelectAllCourses = useCallback(() => {
        setSelectedCategory(null);
        setShowAllCourses(true);
    }, []);

    const handleSelectCategory = useCallback((cat) => {
        setSelectedCategory(cat);
        setShowAllCourses(false);
    }, []);

    const updateCategories = useCallback((updater) => {
        setCategories(typeof updater === 'function' ? updater(categories) : updater);
    }, [categories]);

    const currentChildren = getDirectChildren(categories, selectedCategory?.id);

    const handleAddCategory = useCallback(() => {
        const parentId = selectedCategory?.id;
        const siblings = parentId ? selectedCategory.children || [] : categories;
        const code = getNextCode(selectedCategory?.code || '', siblings);
        const newCat = {
            id: `new_${Date.now()}`,
            code,
            name: 'หมวดวิชาใหม่',
            requiredCredits: 0,
            children: [],
            isNew: true,
        };

        if (parentId) {
            setCategories(p => insertChild(p, parentId, newCat));
        } else {
            setCategories(p => [...p, newCat]);
        }
        setSelectedCategory(newCat);
    }, [selectedCategory, categories]);

    const handleRenameCategory = useCallback((id, name) => {
        setCategories(p => renameInTree(p, id, name));
    }, []);

    const handleRequestDeleteCategory = useCallback((cat) => {
        setDeletingCategory(cat);
    }, [setDeletingCategory]);

    const handleConfirmDeleteCategory = useCallback(() => {
        if (!deletingCategory) return;
        setCategories(p => removeCategory(p, deletingCategory.id));
        if (selectedCategory?.id === deletingCategory.id || isDescendantOf(deletingCategory, selectedCategory?.id)) {
            setSelectedCategory(null);
        }
        setDeletingCategory(null);
    }, [deletingCategory, selectedCategory, setCategories, setSelectedCategory, setDeletingCategory]);


    const handleAddCourse = useCallback((data) => {
        if (!selectedCategory) return;
        const course = { id: `course_${Date.now()}`, ...data };
        setCoursesByCategory(p => ({ ...p, [selectedCategory.id]: [...(p[selectedCategory.id] || []), course] }));
    }, [selectedCategory]);

    const handleUpdateCourse = useCallback((updatedCourse) => {
        if (!selectedCategory) return;
        setCoursesByCategory(p => ({
            ...p,
            [selectedCategory.id]: (p[selectedCategory.id] || []).map(c => c.id === updatedCourse.id ? updatedCourse : c),
        }));
    }, [selectedCategory]);

    const handleRequestDeleteCourseInEditor = useCallback((course) => {
        if (!selectedCategory) return;
        setCoursesByCategory(p => ({
            ...p,
            [selectedCategory.id]: (p[selectedCategory.id] || []).filter(c => c.id !== course.id),
        }));
    }, [selectedCategory]);

    // Load course data when selectedCourse changes
    if (view === 'editor' && selectedCourse && categories.length === 0 && selectedCourse.categories) {
        setCategories(selectedCourse.categories);
    }

    // ============================================================
    // Render
    // ============================================================
    return (
        <div className="cm-page">
            {/* หน้าแรก รวมหลักสูตรทั้งหมด */}
            {view === 'list' ? (
                <>
                    {/* Header */}
                    <div className="cm-header">
                        <div className="cm-header__left">
                            <h1 className="cm-header__title">จัดการหลักสูตร</h1>
                            <p className="cm-header__subtitle">สร้างและจัดการหลักสูตรสำหรับนักศึกษา</p>
                        </div>
                        <div className="cm-header__actions">
                            <button className="btn btn--ghost">
                                <Upload size={16} /> Import
                            </button>
                            <button className="btn btn--primary" onClick={handleCreateCourse}>
                                <Plus size={16} /> สร้างหลักสูตร
                            </button>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="cm-stats-row">
                        <div className="cm-stat-card">
                            <div className="cm-stat-card__icon">
                                <BookOpen size={22} />
                            </div>
                            <div className="cm-stat-card__content">
                                <span className="cm-stat-card__value">{totalCourses}</span>
                                <span className="cm-stat-card__label">หลักสูตรทั้งหมด</span>
                            </div>
                        </div>
                        <div className="cm-stat-card">
                            <div className="cm-stat-card__icon" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }}>
                                <Check size={22} />
                            </div>
                            <div className="cm-stat-card__content">
                                <span className="cm-stat-card__value">{activeCourses}</span>
                                <span className="cm-stat-card__label">หลักสูตรใช้งาน</span>
                            </div>
                        </div>
                        <div className="cm-stat-card">
                            <div className="cm-stat-card__icon" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}>
                                <BookOpenCheck size={22} />
                            </div>
                            <div className="cm-stat-card__content">
                                <span className="cm-stat-card__value">{totalTemplates}</span>
                                <span className="cm-stat-card__label">Templates ที่ใช้งาน</span>
                            </div>
                        </div>
                        <div className="cm-stat-card">
                            <div className="cm-stat-card__icon" style={{ background: 'rgba(251, 146, 60, 0.15)', color: '#fb923c' }}>
                                <Layers size={22} />
                            </div>
                            <div className="cm-stat-card__content">
                                <span className="cm-stat-card__value">{courses.reduce((s, c) => s + c.categories.length, 0)}</span>
                                <span className="cm-stat-card__label">หมวดวิชาทั้งหมด</span>
                            </div>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="cm-search-wrap">
                        <Search size={16} style={{ position: 'absolute', left: '1rem', color: 'var(--tm-text-muted)' }} />
                        <input
                            type="text"
                            className="cfm-input"
                            placeholder="ค้นหาหลักสูตร..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{ paddingLeft: '2.75rem', maxWidth: '400px' }}
                        />
                    </div>

                    {/* Course Grid */}
                    {filteredCourses.length > 0 ? (
                        <div className="cm-grid">
                            {filteredCourses.map(course => (
                                <CourseCard
                                    key={course.id}
                                    course={course}
                                    onOpen={handleOpenCourse}
                                    onEdit={handleEditCourse}
                                    onDuplicate={handleDuplicateCourse}
                                    onDelete={handleDeleteCourse}
                                />
                            ))}
                        </div>
                    ) : (
                        <EmptyState onCreate={handleCreateCourse} />
                    )}
                </>
            ) : view === 'editor' && selectedCourse ? (
                <>
                    {/* Editor View */}
                    {/* หน้ารายละเอียดหลักสูตร */}
                    <div className="cm-header" style={{ marginBottom: '1rem' }}>
                        <div className="cm-header__left">
                            <button className="btn btn--ghost btn--sm" onClick={handleBackToList}>
                                <ArrowLeft size={16} /> กลับ
                            </button>
                            <div className='cm-header__title'>
                                <h1 className="cm-header__title" style={{ fontSize: '1.25rem' }}>{selectedCourse.nameTh}</h1>
                                <p className="cm-header__subtitle">{selectedCourse.nameEn} · ปี {selectedCourse.year}</p>
                            </div>
                        </div>
                        <div className="cm-header__actions">
                            <button className="btn btn--primary btn--sm" onClick={handleCreateCourse}>
                                <Plus size={16} /> เพิ่มหมวดวิชา
                            </button>
                        </div>
                    </div>

                    {/* Stats Row */}
                    <div className="cm-stats-row" style={{ marginBottom: '1.5rem' }}>
                        <div className="cm-stat-card">
                            <div className="cm-stat-card__icon">
                                <BookOpen size={20} />
                            </div>
                            <div className="cm-stat-card__content">
                                <span className="cm-stat-card__value">{Object.values(coursesByCategory).flat().length}</span>
                                <span className="cm-stat-card__label">วิชา</span>
                            </div>
                        </div>
                        <div className="cm-stat-card">
                            <div className="cm-stat-card__icon">
                                <Layers size={20} />
                            </div>
                            <div className="cm-stat-card__content">
                                <span className="cm-stat-card__value">{categories.length}</span>
                                <span className="cm-stat-card__label">หมวดวิชา</span>
                            </div>
                        </div>
                        <div className="cm-stat-card">
                            <div className="cm-stat-card__icon">
                                <Award size={20} />
                            </div>
                            <div className="cm-stat-card__content">
                                <span className="cm-stat-card__value">{categories.reduce((s, c) => s + (c.requiredCredits || 0), 0)}</span>
                                <span className="cm-stat-card__label">หน่วยกิตรวม</span>
                            </div>
                        </div>
                    </div>

                    {/* Category Tree and Detail Panel - Side by Side */}
                    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
                        <div className="cm-cats-tree" style={{ width: 320, flexShrink: 0 }}>
                            <div className="cm-cats-header">
                                <span className="cm-cats-header__title">โครงสร้างหลักสูตร</span>
                                <button className="btn btn--ghost btn--sm" onClick={handleAddCategory}>
                                    <Plus size={14} /> เพิ่มหมวด
                                </button>
                            </div>
                            <div className="cm-cats-body">
                                {/* All Courses Option */}
                                <div
                                    className={`cm-cat-item ${showAllCourses ? 'cm-cat-item--selected' : ''}`}
                                    onClick={handleSelectAllCourses}
                                    style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderRadius: 8, marginBottom: '0.5rem', background: showAllCourses ? 'var(--tm-primary)' : 'transparent', color: showAllCourses ? '#fff' : 'var(--tm-text)' }}
                                >
                                    <Layers size={16} style={{ marginRight: '0.5rem' }} />
                                    <span style={{ fontWeight: 500 }}>วิชาทั้งหมด</span>
                                </div>

                                {categories.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--tm-text-muted)' }}>
                                        <p>ยังไม่มีหมวดวิชา</p>
                                        <button className="btn btn--primary btn--sm" onClick={handleAddCategory}>
                                            <Plus size={14} /> เพิ่มหมวดวิชาแรก
                                        </button>
                                    </div>
                                ) : (
                                    categories.map(cat => (
                                        <CategoryItem
                                            key={cat.id}
                                            category={cat}
                                            selectedId={selectedCategory?.id}
                                            onSelect={handleSelectCategory}
                                            level={0}
                                        />
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Category Detail Panel */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <CategoryDetailPanel
                                category={showAllCourses ? { id: 'all', code: '', name: 'วิชาทั้งหมดในหลักสูตร' } : selectedCategory}
                                courses={getDisplayCourses(categories, selectedCategory, showAllCourses)}
                                onRename={selectedCategory ? handleRenameCategory : () => { }}
                                onDelete={selectedCategory ? handleRequestDeleteCategory : () => { }}
                                onAddCourse={handleAddCourse}
                                onUpdateCourse={handleUpdateCourse}
                                onDeleteCourse={handleRequestDeleteCourseInEditor}
                            />
                        </div>
                    </div>
                </>
            ) : null}

            {/* Modals */}
            {showForm && (
                <CourseFormModal
                    course={editingCourse}
                    onClose={() => { setShowForm(false); setEditingCourse(null); }}
                    onSave={handleSaveCourse}
                />
            )}

            {deletingCourse && (
                <ConfirmDeleteModal
                    category={{ code: '', name: deletingCourse.nameTh }}
                    label="หลักสูตร"
                    onConfirm={handleConfirmDeleteCourse}
                    onCancel={() => setDeletingCourse(null)}
                />
            )}

            {deletingCategory && (
                <ConfirmDeleteModal
                    category={{ code: deletingCategory.code, name: deletingCategory.name }}
                    label="หมวดวิชา"
                    onConfirm={handleConfirmDeleteCategory}
                    onCancel={() => setDeletingCategory(null)}
                />
            )}
        </div>
    );
}

// ============================================================
// CategoryItem — แสดงใน tree
// ============================================================
function CategoryItem({ category, selectedId, onSelect, level }) {
    const [expanded, setExpanded] = useState(true);
    const hasChildren = category.children?.length > 0;
    const isSelected = category.id === selectedId;

    return (
        <div>
            <div
                className={`cm-cat-item ${isSelected ? 'cm-cat-item--selected' : ''}`}
                style={{ paddingLeft: `${0.75 + level * 1.25}rem` }}
                onClick={() => onSelect(category)}
            >
                {hasChildren ? (
                    <button
                        className="icon-btn"
                        style={{ width: 20, height: 20 }}
                        onClick={e => { e.stopPropagation(); setExpanded(!expanded); }}
                    >
                        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                ) : (
                    <span style={{ width: 20 }} />
                )}
                <span className="cm-cat-item__code">{category.code}</span>
                <span className="cm-cat-item__name">{category.name}</span>
                <span className="cm-cat-item__credits">{category.requiredCredits} หน่วยกิต</span>
            </div>
            {hasChildren && expanded && category.children.map(child => (
                <CategoryItem
                    key={child.id}
                    category={child}
                    selectedId={selectedId}
                    onSelect={onSelect}
                    level={level + 1}
                />
            ))}
        </div>
    );
}

// ============================================================
// CategoryDetailPanel — Spreadsheet style with Pagination
// ============================================================
function CategoryDetailPanel({ category, courses, onRename, onDelete, onAddCourse, onUpdateCourse, onDeleteCourse }) {
    const [editName, setEditName] = useState(category?.name || '');
    const [credits, setCredits] = useState(category?.requiredCredits || 0);
    const [showAddCourse, setShowAddCourse] = useState(false);
    const [newCourse, setNewCourse] = useState({ code: '', nameTh: '', nameEn: '', credits: 0, isCoreCourse: true });
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    useEffect(() => {
        setEditName(category?.name || '');
        setCredits(category?.requiredCredits || 0);
        setCurrentPage(1);
    }, [category?.id]);

    const totalPages = Math.ceil(courses.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedCourses = courses.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const handleSaveName = () => {
        if (!category?.id) return;
        onRename(category.id, editName);
    };

    const handleSaveCredits = () => {
        if (!category?.id) return;
        onRename(category.id, category.name);
    };

    const handleAddCourse = () => {
        if (!newCourse.nameTh.trim()) return;
        onAddCourse({ ...newCourse, id: `c_${Date.now()}` });
        setNewCourse({ code: '', nameTh: '', nameEn: '', credits: 0, isCoreCourse: true });
        setShowAddCourse(false);
    };

    const handleAddNewCourse = () => {
        onAddCourse({ code: '', nameTh: '', nameEn: '', credits: 0, isCoreCourse: true, id: `c_new_${Date.now()}` });
    };

    const handlePageChange = (page) => {
        setCurrentPage(page);
    };

    return (
        <div className="cm-detail-panel">
            <div className="cm-detail-panel__header">
                <div style={{ flex: 1 }}>
                    <label className="cfm-label">ชื่อหมวดวิชา</label>
                    <input
                        className="cfm-input"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onBlur={handleSaveName}
                        onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                    />
                </div>
                <div style={{ width: 120 }}>
                    <label className="cfm-label">หน่วยกิต</label>
                    <div className='cfm-input'> {credits}</div>
                </div>
                <button className="btn btn--ghost btn--danger" style={{ marginTop: '1.5rem' }} onClick={() => onDelete(category)}>
                    <Trash2 size={14} />
                </button>
            </div>

            <div style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--tm-text)' }}>รายวิชา ({courses.length})</span>
                    <button className="btn btn--primary btn--sm" onClick={handleAddNewCourse}>
                        <Plus size={14} /> เพิ่มรายวิชา
                    </button>
                </div>

                <div className="ss-wrapper">
                    <div className="ss-scroll">
                        <table className="ss-table">
                            <thead>
                                <tr>
                                    <th className="ss-th ss-th--grip"></th>
                                    <th className="ss-th">รหัสวิชา</th>
                                    <th className="ss-th ss-th--wide">ชื่อวิชา (ไทย)</th>
                                    <th className="ss-th ss-th--wide">ชื่อวิชา (Eng)</th>
                                    <th className="ss-th ss-th--num">หน่วยกิต</th>
                                    <th className="ss-th ss-th--actions"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {courses.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="ss-empty">
                                            ยังไม่มีรายวิชา — กดปุ่ม "+ เพิ่มรายวิชา" ด้านบน
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedCourses.map(course => (
                                        <CourseRow key={course.id} course={course} onDelete={() => onDeleteCourse(course)} />
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Pagination */}
                <div className="cm-pagination">
                    {totalPages === 0 ? (
                        <span className="cm-pagination__info">
                            หน้า {currentPage} / {1}
                        </span>
                    ) : (
                        <span className="cm-pagination__info">
                            หน้า {currentPage} / {totalPages}
                        </span>
                    )}
                    <div className="cm-pagination__buttons">
                        <button
                            className="btn btn--ghost btn--sm"
                            onClick={() => handlePageChange(1)}
                            disabled={currentPage === 1}
                            title="หน้าแรก"
                        >
                            <ChevronFirst size={14} />
                        </button>
                        <button
                            className="btn btn--ghost btn--sm"
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            title="ย้อนกลับ"
                        >
                            <ChevronLeft size={14} /> ย้อนกลับ
                        </button>
                        <button
                            className="btn btn--ghost btn--sm"
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            title="ถัดไป"
                        >
                            ถัดไป <ChevronRight size={14} />
                        </button>
                        <button
                            className="btn btn--ghost btn--sm"
                            onClick={() => handlePageChange(totalPages)}
                            disabled={currentPage === totalPages}
                            title="หน้าสุดท้าย"
                        >
                            <ChevronLast size={14} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ============================================================
// CourseRow — SpreadsheetRow style
// ============================================================
function CourseRow({ course, onDelete }) {
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState({
        code: course.code || '',
        nameTh: course.nameTh || '',
        nameEn: course.nameEn || '',
        credits: course.credits || 0,
    });

    const handleSave = () => {
        if (!form.code.trim() && !form.nameTh.trim()) return;
        setEditing(false);
    };

    const handleKey = (e) => {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') {
            setForm({ code: course.code || '', nameTh: course.nameTh || '', nameEn: course.nameEn || '', credits: course.credits || 0 });
            setEditing(false);
        }
    };

    const handleCellClick = () => setEditing(true);

    return (
        <tr className={`ss-row ${editing ? 'ss-row--editing' : ''}`}>
            <td className="ss-cell ss-cell--grip">
                <GripVertical size={13} />
            </td>
            <td className="ss-cell" onClick={handleCellClick}>
                {editing ? (
                    <input
                        className="ss-input"
                        value={form.code}
                        onChange={e => setForm(p => ({ ...p, code: e.target.value }))}
                        onKeyDown={handleKey}
                        placeholder="รหัสวิชา"
                    />
                ) : (
                    <span className="ss-code">{course.code || <span className="ss-placeholder">รหัสวิชา</span>}</span>
                )}
            </td>
            <td className="ss-cell ss-cell--wide" onClick={handleCellClick}>
                {editing ? (
                    <input
                        className="ss-input"
                        value={form.nameTh}
                        onChange={e => setForm(p => ({ ...p, nameTh: e.target.value }))}
                        onKeyDown={handleKey}
                        placeholder="ชื่อวิชาภาษาไทย"
                    />
                ) : (
                    <span>{course.nameTh || <span className="ss-placeholder">ชื่อภาษาไทย</span>}</span>
                )}
            </td>
            <td className="ss-cell ss-cell--wide" onClick={handleCellClick}>
                {editing ? (
                    <input
                        className="ss-input"
                        value={form.nameEn}
                        onChange={e => setForm(p => ({ ...p, nameEn: e.target.value }))}
                        onKeyDown={handleKey}
                        placeholder="English Name"
                    />
                ) : (
                    <span>{course.nameEn || <span className="ss-placeholder">English Name</span>}</span>
                )}
            </td>
            <td className="ss-cell ss-cell--num" onClick={handleCellClick}>
                {editing ? (
                    <input
                        className="ss-input ss-input--num"
                        type="number"
                        min={0}
                        max={12}
                        value={form.credits}
                        onChange={e => setForm(p => ({ ...p, credits: parseInt(e.target.value) || 0 }))}
                        onKeyDown={handleKey}
                        placeholder="0"
                    />
                ) : (
                    <span>{course.credits || <span className="ss-placeholder">0</span>}</span>
                )}
            </td>
            <td className="ss-cell ss-cell--actions" onClick={e => e.stopPropagation()}>
                {editing ? (
                    <button className="icon-btn icon-btn--edit icon-btn--xs" onClick={handleSave}>
                        <Check size={13} />
                    </button>
                ) : (
                    <button className="icon-btn icon-btn--edit icon-btn--xs" onClick={() => setEditing(true)}>
                        <Pencil size={12} />
                    </button>
                )}
                <button className="icon-btn icon-btn--danger icon-btn--xs" onClick={() => onDelete(course)}>
                    <Trash2 size={12} />
                </button>
            </td>
        </tr>
    );
}