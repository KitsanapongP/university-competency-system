'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, BookOpen, Pencil, Trash2, Copy, Upload, ArrowLeft, Check, X, ChevronDown, ChevronRight, Layers, BookOpenCheck, Award, GripVertical, ChevronLeft, ChevronFirst, ChevronLast } from 'lucide-react';
import { MOCK_COURSE_MASTERS } from '../template-management/mockData.js';
import CourseFormModal from './components/CourseFormModal';
import ConfirmDeleteModal from '../template-management/components/ConfirmDeleteModal';
import './CourseLayout.css';
import './CourseList.css';
import './CourseEditor.css';

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

    // หา category และ depth จริงใน tree
    const findCategory = (cats, targetId, depth = 0) => {
        for (const cat of cats) {
            if (cat.id === targetId) {
                return { category: cat, depth };
            }
            if (cat.children?.length) {
                const found = findCategory(cat.children, targetId, depth + 1);
                if (found) return found;
            }
        }
        return null;
    };

    const found = findCategory(categories, selectedCategory.id);
    if (!found) return [];

    const { category, depth } = found;

    // ถ้า depth >= 2 แสดงเฉพาะ courses ของ category นั้น
    if (depth >= 2) {
        return category.courses || [];
    }

    // ถ้า depth < 2 แสดง courses ของ category + children
    const result = [...(category.courses || [])];
    if (category.children?.length) {
        for (const child of category.children) {
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
        <div className="course-card" onClick={() => onOpen(course)}>
            <div className="course-card__header">
                <div className="course-card__icon">
                    <BookOpen size={24} />
                </div>
                <div className="course-card__actions">
                    <button className="icon-course-btn" title="แก้ไข" onClick={e => { e.stopPropagation(); onEdit(course); }}>
                        <Pencil size={14} />
                    </button>
                    <button className="icon-course-btn" title="ทำสำเนา" onClick={e => { e.stopPropagation(); onDuplicate(course); }}>
                        <Copy size={14} />
                    </button>
                    <button className="icon-course-btn icon-course-btn--danger" title="ลบ" onClick={e => { e.stopPropagation(); onDelete(course); }}>
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>
            <h3 className="course-card__title">
                {course.nameTh}
            </h3>
            <p className="course-card__subtitle">{course.nameEn}</p>
            <div className="course-card__meta">
                <span className="course-card__meta-item">
                    <BookOpen size={12} />
                    ปี {course.year}
                </span>
                <span className="course-card__meta-item">
                    <Award size={12} />
                    {course.degreeName}
                </span>
                <span className="course-card__meta-item">
                    <Layers size={12} />
                    {course.templateCount} Templates
                </span>
            </div>
            <div className="course-card__stats">
                <div className="course-card__stat">
                    <span className="course-card__stat-value">{course.stats.totalCourses}</span>
                    <span className="course-card__stat-label">วิชา</span>
                </div>
                <div className="course-card__stat">
                    <span className="course-card__stat-value">{course.categories.length}</span>
                    <span className="course-card__stat-label">หมวด</span>
                </div>
                <div className="course-card__stat">
                    <span className="course-card__stat-value">{course.stats.totalCredits}</span>
                    <span className="course-card__stat-label">หน่วยกิต</span>
                </div>
                <span className={`course-card__badge ${course.isActive ? 'course-card__badge--active' : 'course-card__badge--inactive'}`}>
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
        <div className="course-empty">
            <div className="course-empty__icon">
                <BookOpen size={40} />
            </div>
            <h3 className="course-empty__title">ยังไม่มีหลักสูตร</h3>
            <p className="course-empty__desc">เริ่มต้นสร้างหลักสูตรแรกของคุณเพื่อจัดการหลักสูตรนักศึกษา</p>
            <button className="course-btn course-btn--primary" onClick={onCreate}>
                <Plus size={16} /> สร้างหลักสูตร
            </button>
        </div>
    );
}

// ============================================================
// Main Page
// ============================================================
export default function CourseManagementPage() {
    const router = useRouter();
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
        router.push('/course-management/create');
    }, [router]);

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
        <>
            {/* หน้าแรก รวมหลักสูตรทั้งหมด */}
            {view === 'list' ? (
                <div className="course-list-page">
                    {/* Header */}
                    <div className="course-list-header">
                        <div className="course-list-header__left">
                            <h1 className="course-list-header__title">จัดการหลักสูตร</h1>
                            <p className="course-list-header__subtitle">สร้างและจัดการหลักสูตรสำหรับนักศึกษา</p>
                        </div>
                        <div className="course-list-header__actions">
                            <button className="course-btn course-btn--ghost">
                                <Upload size={16} /> Import
                            </button>
                            <button className="course-btn course-btn--primary" onClick={handleCreateCourse}>
                                <Plus size={16} /> สร้างหลักสูตร
                            </button>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="course-stats-row">
                        <div className="course-stat-card">
                            <div className="course-stat-card__icon">
                                <BookOpen size={22} />
                            </div>
                            <div className="course-stat-card__content">
                                <span className="course-stat-card__value">{totalCourses}</span>
                                <span className="course-stat-card__label">หลักสูตรทั้งหมด</span>
                            </div>
                        </div>
                        <div className="course-stat-card">
                        <div className="course-stat-card__icon course-stat-card__icon--courses">
                            <BookOpen size={20} />
                        </div>
                        <div className="course-stat-card__content">
                            <span className="course-stat-card__value">{courses.length}</span>
                            <span className="course-stat-card__label">หลักสูตร</span>
                        </div>
                    </div>
                    <div className="course-stat-card">
                        <div className="course-stat-card__icon course-stat-card__icon--categories">
                            <Layers size={20} />
                        </div>
                        <div className="course-stat-card__content">
                            <span className="course-stat-card__value">{categories.length}</span>
                            <span className="course-stat-card__label">หมวดวิชา</span>
                        </div>
                    </div>
                    <div className="course-stat-card">
                        <div className="course-stat-card__icon course-stat-card__icon--credits">
                                <Layers size={22} />
                            </div>
                            <div className="course-stat-card__content">
                                <span className="course-stat-card__value">{courses.reduce((s, c) => s + c.categories.length, 0)}</span>
                                <span className="course-stat-card__label">หมวดวิชาทั้งหมด</span>
                            </div>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="course-search-wrap">
                        <Search size={16} className="course-search-icon" />
                        <input
                            className="cfm-input course-search-input"
                            type="text"
                            placeholder="ค้นหาหลักสูตร..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>

                    {/* Course Grid */}
                    {filteredCourses.length > 0 ? (
                        <div className="course-grid">
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
                </div>
            ) : view === 'editor' && selectedCourse ? (
                <div className="course-editor-page">
                    {/* Editor View */}
                    {/* หน้ารายละเอียดหลักสูตร */}
                    <div className="course-editor-header">
                        <div className="course-editor-header__left">
                            <button className="course-btn-back" onClick={handleBackToList}>
                                <ArrowLeft size={16} /> กลับ
                            </button>
                            <div className='course-editor-header__title'>
                                <h1>{selectedCourse.nameTh}</h1>
                                <p className="course-editor-header__subtitle">{selectedCourse.nameEn} · ปี {selectedCourse.year}</p>
                            </div>
                        </div>
                    </div>

                    {/* Stats Row */}
                    <div className="course-stats-row">
                        <div className="course-stat-card">
                            <div className="course-stat-card__icon">
                                <BookOpen size={20} />
                            </div>
                            <div className="course-stat-card__content">
                                <span className="course-stat-card__value">{Object.values(coursesByCategory).flat().length}</span>
                                <span className="course-stat-card__label">วิชา</span>
                            </div>
                        </div>
                        <div className="course-stat-card">
                            <div className="course-stat-card__icon">
                                <Layers size={20} />
                            </div>
                            <div className="course-stat-card__content">
                                <span className="course-stat-card__value">{categories.length}</span>
                                <span className="course-stat-card__label">หมวดวิชา</span>
                            </div>
                        </div>
                        <div className="course-stat-card">
                            <div className="course-stat-card__icon">
                                <Award size={20} />
                            </div>
                            <div className="course-stat-card__content">
                                <span className="course-stat-card__value">{categories.reduce((s, c) => s + (c.requiredCredits || 0), 0)}</span>
                                <span className="course-stat-card__label">หน่วยกิตรวม</span>
                            </div>
                        </div>
                    </div>

                    {/* Category Tree and Detail Panel - Side by Side */}
                    <div className="course-editor-panels">
                        <div className="course-editor-panels__sidebar">
                            <div className="course-category-tree">
                                <div className="course-category-tree__header">
                                    <span className="course-category-tree__title">โครงสร้างหลักสูตร</span>
                                    <button className="course-btn course-btn--ghost course-btn--sm" onClick={handleAddCategory}>
                                        <Plus size={14} /> เพิ่มหมวด
                                    </button>
                                </div>
                                <div className="course-category-tree__body">
                                    {/* All Courses Option */}
                                    <div
                                        className={`course-tree-item ${showAllCourses ? 'course-tree-item--selected' : ''} course-all-courses-item ${showAllCourses ? 'course-all-courses-item--selected' : ''}`}
                                        onClick={handleSelectAllCourses}
                                    >
                                        <Layers size={16} />
                                        <span>วิชาทั้งหมด</span>
                                    </div>

                                    {categories.length === 0 ? (
                                        <div className="course-tree-empty">
                                            <p>ยังไม่มีหมวดวิชา</p>
                                            <button className="course-btn course-btn--primary course-btn--sm course-tree-empty__btn" onClick={handleAddCategory}>
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
                        </div>

                        {/* Category Detail Panel */}
                        <div className="course-editor-panels__content">
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
                </div>
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
        </>
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
                className={`course-tree-item ${isSelected ? 'course-tree-item--selected' : ''}`}
                style={{ '--level': level }}
                onClick={() => onSelect(category)}
            >
                {hasChildren ? (
                    <button
                        className="icon-course-btn course-tree-expand-btn"
                        onClick={e => { e.stopPropagation(); setExpanded(!expanded); }}
                    >
                        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                ) : (
                    <span className="course-tree-placeholder" />
                )}
                <span className="course-tree-item__code">{category.code}</span>
                <span className="course-tree-item__name">{category.name}</span>
                <span className="course-tree-item__credits">{category.requiredCredits} หน่วยกิต</span>
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
        <div className="course-detail-panel">
            <div className="course-detail-panel__header">
                <div>
                    <label className="cfm-label">ชื่อหมวดวิชา</label>
                    <input
                        className="cfm-input"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onBlur={handleSaveName}
                        onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                    />
                </div>
                <div className="course-detail-panel__credits">
                    <label className="cfm-label">หน่วยกิต</label>
                    <div className='cfm-input'> {credits}</div>
                </div>
                <button className="course-btn course-btn--ghost course-btn--danger course-delete-btn" onClick={() => onDelete(category)}>
                    <Trash2 size={14} />
                </button>
            </div>

            <div className="course-detail-panel__courses">
                <div className="course-detail-panel__courses-header">
                    <span className="course-detail-panel__courses-title">รายวิชา ({courses.length})</span>
                    <button className="course-btn course-btn--primary course-btn--sm" onClick={handleAddNewCourse}>
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
                <div className="course-pagination">
                    {totalPages === 0 ? (
                        <span className="course-pagination__info">
                            หน้า {currentPage} / {1}
                        </span>
                    ) : (
                        <span className="course-pagination__info">
                            หน้า {currentPage} / {totalPages}
                        </span>
                    )}
                    <div className="course-pagination__buttons">
                        <button
                            className="course-btn course-btn--ghost course-btn--sm"
                            onClick={() => handlePageChange(1)}
                            disabled={currentPage === 1}
                            title="หน้าแรก"
                        >
                            <ChevronFirst size={14} />
                        </button>
                        <button
                            className="course-btn course-btn--ghost course-btn--sm"
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            title="ย้อนกลับ"
                        >
                            <ChevronLeft size={14} /> ย้อนกลับ
                        </button>
                        <button
                            className="course-btn course-btn--ghost course-btn--sm"
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            title="ถัดไป"
                        >
                            ถัดไป <ChevronRight size={14} />
                        </button>
                        <button
                            className="course-btn course-btn--ghost course-btn--sm"
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
                    <button className="icon-course-btn icon-course-btn--edit icon-course-btn--xs" onClick={handleSave}>
                        <Check size={13} />
                    </button>
                ) : (
                    <button className="icon-course-btn icon-course-btn--edit icon-course-btn--xs" onClick={() => setEditing(true)}>
                        <Pencil size={12} />
                    </button>
                )}
                <button className="icon-course-btn icon-course-btn--danger icon-course-btn--xs" onClick={() => onDelete(course)}>
                    <Trash2 size={12} />
                </button>
            </td>
        </tr>
    );
}