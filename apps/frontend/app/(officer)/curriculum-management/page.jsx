'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, BookOpen, Pencil, Trash2, Copy, Upload, ArrowLeft, Check, X, ChevronDown, ChevronRight, Layers, Award, GripVertical, ChevronLeft, ChevronFirst, ChevronLast } from 'lucide-react';
import {
    createCurriculumCategory,
    createCurriculumCourse,
    deleteCurriculumCategory,
    deleteCurriculumCoursePlacement,
    fetchCurriculumDetail,
    fetchCurriculums,
    getDeleteCurriculumCategoryPreview,
    updateCurriculumCategory,
    updateCurriculumCourseDetail,
    updateCurriculumStatus,
} from '../../../lib/curriculum';
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

function getNextCode(parentCode, siblings) {
    return parentCode ? `${parentCode}.${siblings.length + 1}` : `${siblings.length + 1}`;
}

const STATUS_LABELS = {
    draft: 'กำลังสร้าง',
    active: 'พร้อมใช้งาน',
    inactive: 'ปิดใช้งาน',
};

function getStatusAction(status) {
    if (status === 'active') {
        return { nextStatus: 'inactive', label: 'ปิดใช้งาน' };
    }
    return { nextStatus: 'active', label: 'เปิดใช้งาน' };
}

function buildConfirmationMessage(error) {
    const templates = error?.payload?.data?.affected_templates || [];
    if (!templates.length) {
        return `${error?.message || 'This action requires confirmation'}\n\nยืนยันดำเนินการต่อหรือไม่?`;
    }

    const templateList = templates
        .slice(0, 8)
        .map(template => `- ${template.name || template.code || 'Template'}${template.cohort_year_be ? ` (${template.cohort_year_be})` : ''}`)
        .join('\n');
    const more = templates.length > 8 ? `\n- และอีก ${templates.length - 8} รายการ` : '';

    return `${error?.message || 'This action requires confirmation'}\n\nTemplate ที่อาจได้รับผลกระทบ:\n${templateList}${more}\n\nยืนยันดำเนินการต่อหรือไม่?`;
}

function getEditorErrorMessage(error) {
    if (error?.code === 'CURRICULUM_STRUCTURE_LOCKED') {
        return 'โครงสร้างหลักสูตรถูกล็อกอยู่ เพราะมี Active Template เชื่อมอยู่';
    }
    if (error?.code === 'CURRICULUM_HAS_ACTIVE_TEMPLATE') {
        return 'ยังปิดใช้งานหลักสูตรไม่ได้ เพราะมี Active Template เชื่อมอยู่';
    }
    if (error?.code === 'DUPLICATE') {
        return error.message || 'ข้อมูลซ้ำกับรายการเดิม';
    }
    return error?.message || 'ไม่สามารถบันทึกข้อมูลหลักสูตรได้';
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
                    <span className="course-card__stat-value">{course.stats.totalCategories}</span>
                    <span className="course-card__stat-label">หมวด</span>
                </div>
                <div className="course-card__stat">
                    <span className="course-card__stat-value">{course.stats.totalCredits}</span>
                    <span className="course-card__stat-label">หน่วยกิต</span>
                </div>
                <div className="course-card__status">
                    <span className={`course-card__badge ${course.isActive ? 'course-card__badge--active' : 'course-card__badge--inactive'}`}>
                        {course.isActive ? <Check size={12} /> : <X size={12} />}
                        {course.isActive ? 'ใช้งาน' : 'ไม่ใช้งาน'}
                    </span>
                </div>
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
export default function CurriculumManagementPage() {
    const router = useRouter();
    const [view, setView] = useState('list'); // 'list' | 'editor'
    const [courses, setCourses] = useState([]);
    const [search, setSearch] = useState('');
    const [selectedCourse, setSelectedCourse] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [editingCourse, setEditingCourse] = useState(null);
    const [deletingCourse, setDeletingCourse] = useState(null);
    const [loading, setLoading] = useState(true);
    const [detailLoadingId, setDetailLoadingId] = useState(null);
    const [operationLoading, setOperationLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const courseIdRef = useRef(9000);

    const loadCurriculums = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const data = await fetchCurriculums();
            setCourses(data);
        } catch (err) {
            setError(err?.message || 'ไม่สามารถโหลดข้อมูลหลักสูตรได้');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadCurriculums();
    }, [loadCurriculums]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('created') === '1') {
            setSuccess('สร้างหลักสูตรสำเร็จ');
        }
    }, []);

    // Filter courses
    const filteredCourses = courses.filter(c => {
        const term = search.toLowerCase();
        return (c.nameTh || '').toLowerCase().includes(term) ||
            (c.nameEn || '').toLowerCase().includes(term) ||
            (c.code || '').toLowerCase().includes(term) ||
            String(c.year).includes(term);
    });

    // Stats
    const totalCourses = courses.length;
    const activeCourses = courses.filter(c => c.isActive).length;
    const totalTemplates = courses.reduce((sum, c) => sum + c.templateCount, 0);
    const totalCurriculumCredits = courses.reduce((sum, c) => sum + (c.stats?.totalCredits || 0), 0);

    // Handlers
    const handleOpenCourse = useCallback(async (course) => {
        setDetailLoadingId(course.id);
        setError('');
        setSuccess('');
        try {
            const detail = await fetchCurriculumDetail(course.curriculumId || course.id);
            setSelectedCourse(detail);
            setView('editor');
        } catch (err) {
            setError(err?.message || 'ไม่สามารถโหลดรายละเอียดหลักสูตรได้');
        } finally {
            setDetailLoadingId(null);
        }
    }, []);

    const handleBackToList = useCallback(() => {
        setView('list');
        setSelectedCourse(null);
        setSelectedCategory(null);
        setShowAllCourses(false);
    }, []);

    const handleCreateCourse = useCallback(() => {
        router.push('/curriculum-management/create');
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
    // Editor View (Category/Curriculum Management)
    // ============================================================
    const [categories, setCategories] = useState(selectedCourse?.categories || []);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [showAllCourses, setShowAllCourses] = useState(false);
    const [coursesByCategory, setCoursesByCategory] = useState({});
    const [deletingCategory, setDeletingCategory] = useState(null);

    useEffect(() => {
        const nextCategories = selectedCourse?.categories || [];
        setCategories(nextCategories);
        setCoursesByCategory(selectedCourse?.coursesByCategory || {});
        setSelectedCategory(current => (current ? findById(nextCategories, current.id) : null));
        if (!selectedCourse) {
            setShowAllCourses(false);
        }
    }, [selectedCourse]);

    const commitCurriculumMutation = useCallback(async (operation, successMessage) => {
        let confirmImpact = false;

        for (;;) {
            setOperationLoading(true);
            setError('');
            setSuccess('');

            try {
                const detail = await operation(confirmImpact);
                setSelectedCourse(detail);
                setSuccess(successMessage);
                await loadCurriculums();
                return detail;
            } catch (err) {
                const needsConfirmation = err?.status === 409 && err?.code === 'CONFIRMATION_REQUIRED' && !confirmImpact;
                if (needsConfirmation && window.confirm(buildConfirmationMessage(err))) {
                    confirmImpact = true;
                    continue;
                }

                setError(getEditorErrorMessage(err));
                return null;
            } finally {
                setOperationLoading(false);
            }
        }
    }, [loadCurriculums]);

    const handleSelectAllCourses = useCallback(() => {
        setSelectedCategory(null);
        setShowAllCourses(true);
    }, []);

    const handleSelectCategory = useCallback((cat) => {
        setSelectedCategory(cat);
        setShowAllCourses(false);
    }, []);

    const handleAddCategory = useCallback(async () => {
        if (!selectedCourse) return;
        const parentId = selectedCategory?.id;
        const siblings = parentId ? selectedCategory.children || [] : categories;
        const code = getNextCode(selectedCategory?.code || '', siblings);

        await commitCurriculumMutation((confirmImpact) => createCurriculumCategory(selectedCourse.curriculumId, {
            parentId: parentId || null,
            code,
            name: 'หมวดวิชาใหม่',
            requiredCredits: 0,
            displayOrder: siblings.length + 1,
        }, confirmImpact), 'เพิ่มหมวดวิชาแล้ว');
    }, [categories, commitCurriculumMutation, selectedCategory, selectedCourse]);

    const handleRenameCategory = useCallback(async (id, updates) => {
        if (!selectedCourse) return null;
        const current = findById(categories, id);
        if (!current) return null;

        const payload = typeof updates === 'string' ? { nameTh: updates } : updates;
        return commitCurriculumMutation((confirmImpact) => updateCurriculumCategory(selectedCourse.curriculumId, id, {
            code: payload.code ?? current.code,
            nameTh: payload.nameTh ?? payload.name ?? current.name,
            nameEn: payload.nameEn ?? current.nameEn,
            requiredCredits: payload.requiredCredits ?? current.requiredCredits,
            displayOrder: payload.displayOrder ?? current.displayOrder,
        }, confirmImpact), 'บันทึกหมวดวิชาแล้ว');
    }, [categories, commitCurriculumMutation, selectedCourse]);

    const handleRequestDeleteCategory = useCallback(async (cat) => {
        if (!selectedCourse || !cat?.id) return;
        setError('');
        try {
            const preview = await getDeleteCurriculumCategoryPreview(selectedCourse.curriculumId, cat.id);
            setDeletingCategory({ ...cat, deletePreview: preview });
        } catch (err) {
            setError(getEditorErrorMessage(err));
        }
    }, [selectedCourse]);

    const handleConfirmDeleteCategory = useCallback(async () => {
        if (!deletingCategory) return;
        await commitCurriculumMutation(() => deleteCurriculumCategory(selectedCourse.curriculumId, deletingCategory.id, true), 'ลบหมวดวิชาแล้ว');
        setDeletingCategory(null);
    }, [commitCurriculumMutation, deletingCategory, selectedCourse]);


    const handleAddCourse = useCallback(async (data) => {
        if (!selectedCourse || !selectedCategory) return null;
        const displayOrder = (coursesByCategory[selectedCategory.id] || []).length + 1;
        return commitCurriculumMutation((confirmImpact) => createCurriculumCourse(selectedCourse.curriculumId, selectedCategory.id, {
            ...data,
            displayOrder,
        }, confirmImpact), 'เพิ่มรายวิชาแล้ว');
    }, [commitCurriculumMutation, coursesByCategory, selectedCategory, selectedCourse]);

    const handleUpdateCourse = useCallback(async (updatedCourse) => {
        if (!selectedCourse || !updatedCourse?.courseId) return null;
        return commitCurriculumMutation((confirmImpact) => updateCurriculumCourseDetail(selectedCourse.curriculumId, updatedCourse.courseId, {
            code: updatedCourse.code,
            nameTh: updatedCourse.nameTh,
            nameEn: updatedCourse.nameEn,
            credits: updatedCourse.credits,
            description: updatedCourse.description,
        }, confirmImpact), 'บันทึกรายวิชาแล้ว');
    }, [commitCurriculumMutation, selectedCourse]);

    const handleRequestDeleteCourseInEditor = useCallback(async (course) => {
        if (!selectedCourse || !course?.curriculumCourseId) return null;
        if (!window.confirm(`ยืนยันถอดรายวิชา ${course.code || course.nameTh || ''} ออกจากหลักสูตรหรือไม่?`)) return null;
        return commitCurriculumMutation((confirmImpact) => deleteCurriculumCoursePlacement(selectedCourse.curriculumId, course.curriculumCourseId, confirmImpact), 'ถอดรายวิชาแล้ว');
    }, [commitCurriculumMutation, selectedCourse]);

    const handleChangeStatus = useCallback(async (nextStatus) => {
        if (!selectedCourse) return null;
        return commitCurriculumMutation((confirmImpact) => updateCurriculumStatus(selectedCourse.curriculumId, nextStatus, confirmImpact), 'อัปเดตสถานะหลักสูตรแล้ว');
    }, [commitCurriculumMutation, selectedCourse]);

    const statusAction = selectedCourse ? getStatusAction(selectedCourse.status) : null;

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
                            <span className="course-stat-card__value">{activeCourses}</span>
                            <span className="course-stat-card__label">หลักสูตร</span>
                        </div>
                    </div>
                    <div className="course-stat-card">
                        <div className="course-stat-card__icon course-stat-card__icon--categories">
                            <Layers size={20} />
                        </div>
                        <div className="course-stat-card__content">
                            <span className="course-stat-card__value">{totalTemplates}</span>
                            <span className="course-stat-card__label">หมวดวิชา</span>
                        </div>
                    </div>
                    <div className="course-stat-card">
                        <div className="course-stat-card__icon course-stat-card__icon--credits">
                                <Layers size={22} />
                            </div>
                            <div className="course-stat-card__content">
                                <span className="course-stat-card__value">{totalCurriculumCredits}</span>
                                <span className="course-stat-card__label">หมวดวิชาทั้งหมด</span>
                            </div>
                        </div>
                    </div>

                    {success && (
                        <div className="course-feedback course-feedback--success">
                            {success}
                        </div>
                    )}

                    {error && (
                        <div className="course-feedback course-feedback--error">
                            <span>{error}</span>
                            <button className="course-btn course-btn--ghost course-btn--sm" onClick={loadCurriculums}>
                                ลองใหม่
                            </button>
                        </div>
                    )}

                    {detailLoadingId && (
                        <div className="course-feedback course-feedback--info">
                            กำลังโหลดรายละเอียดหลักสูตร...
                        </div>
                    )}

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
                    {loading ? (
                        <div className="course-loading">
                            <div className="course-spinner" />
                        </div>
                    ) : filteredCourses.length > 0 ? (
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
                        <div className="course-editor-header__actions">
                            <span className={`course-status-badge course-status-badge--${selectedCourse.status}`}>
                                {STATUS_LABELS[selectedCourse.status] || selectedCourse.status}
                            </span>
                            {statusAction && (
                                <button
                                    className={`course-btn ${selectedCourse.status === 'active' ? 'course-btn--danger' : 'course-btn--primary'}`}
                                    onClick={() => handleChangeStatus(statusAction.nextStatus)}
                                    disabled={operationLoading}
                                >
                                    {statusAction.label}
                                </button>
                            )}
                        </div>
                    </div>

                    {success && (
                        <div className="course-feedback course-feedback--success">
                            {success}
                        </div>
                    )}

                    {error && (
                        <div className="course-feedback course-feedback--error">
                            <span>{error}</span>
                        </div>
                    )}

                    {operationLoading && (
                        <div className="course-feedback course-feedback--info">
                            กำลังบันทึกข้อมูลหลักสูตร...
                        </div>
                    )}

                    {/* Stats Row */}
                    <div className="course-stats-row">
                        <div className="course-stat-card">
                            <div className="course-stat-card__icon">
                                <BookOpen size={20} />
                            </div>
                            <div className="course-stat-card__content">
                                <span className="course-stat-card__value">{selectedCourse.stats?.totalCourses ?? Object.values(coursesByCategory).flat().length}</span>
                                <span className="course-stat-card__label">วิชา</span>
                            </div>
                        </div>
                        <div className="course-stat-card">
                            <div className="course-stat-card__icon">
                                <Layers size={20} />
                            </div>
                            <div className="course-stat-card__content">
                                <span className="course-stat-card__value">{selectedCourse.stats?.totalCategories ?? categories.length}</span>
                                <span className="course-stat-card__label">หมวดวิชา</span>
                            </div>
                        </div>
                        <div className="course-stat-card">
                            <div className="course-stat-card__icon">
                                <Award size={20} />
                            </div>
                            <div className="course-stat-card__content">
                                <span className="course-stat-card__value">{selectedCourse.stats?.totalCredits ?? 0}</span>
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
                                    <button className="course-btn course-btn--ghost course-btn--sm" onClick={handleAddCategory} disabled={operationLoading}>
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
                                            <button className="course-btn course-btn--primary course-btn--sm course-tree-empty__btn" onClick={handleAddCategory} disabled={operationLoading}>
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
                                key={`${showAllCourses ? 'all' : selectedCategory?.id || 'none'}:${selectedCategory?.name || ''}:${selectedCategory?.requiredCredits ?? 0}`}
                                category={showAllCourses ? { id: 'all', code: '', name: 'วิชาทั้งหมดในหลักสูตร' } : selectedCategory}
                                courses={getDisplayCourses(categories, selectedCategory, showAllCourses)}
                                onRename={selectedCategory ? handleRenameCategory : () => { }}
                                onDelete={selectedCategory ? handleRequestDeleteCategory : () => { }}
                                onAddCourse={handleAddCourse}
                                onUpdateCourse={handleUpdateCourse}
                                onDeleteCourse={handleRequestDeleteCourseInEditor}
                                canEdit={Boolean(selectedCategory) && !showAllCourses}
                                disabled={operationLoading}
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
function CategoryDetailPanel({ category, courses, onRename, onDelete, onAddCourse, onUpdateCourse, onDeleteCourse, canEdit = false, disabled = false }) {
    const [editName, setEditName] = useState(category?.name || '');
    const [credits, setCredits] = useState(category?.requiredCredits || 0);
    const [showAddCourse, setShowAddCourse] = useState(false);
    const [newCourse, setNewCourse] = useState({ code: '', nameTh: '', nameEn: '', credits: 0, isCoreCourse: true });
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;
    const isReadOnly = disabled || !canEdit || !category || category.id === 'all';

    const totalPages = Math.max(1, Math.ceil(courses.length / ITEMS_PER_PAGE));
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
    const paginatedCourses = courses.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const handleSaveName = () => {
        if (isReadOnly || !category?.id || editName.trim() === category.name) return;
        onRename(category.id, { nameTh: editName.trim() });
    };

    const handleSaveCredits = () => {
        if (isReadOnly || !category?.id) return;
        const nextCredits = Number(credits);
        if (!Number.isFinite(nextCredits) || nextCredits < 0 || nextCredits === category.requiredCredits) return;
        onRename(category.id, { requiredCredits: nextCredits });
    };

    const handleAddCourse = async () => {
        if (isReadOnly || !newCourse.code.trim() || !newCourse.nameTh.trim()) return;
        const result = await onAddCourse({
            ...newCourse,
            code: newCourse.code.trim(),
            nameTh: newCourse.nameTh.trim(),
            nameEn: newCourse.nameEn.trim(),
            credits: Number(newCourse.credits) || 0,
        });
        if (result) {
            setNewCourse({ code: '', nameTh: '', nameEn: '', credits: 0, isCoreCourse: true });
            setShowAddCourse(false);
        }
    };

    const handleAddNewCourse = () => {
        if (!isReadOnly) {
            setShowAddCourse(true);
        }
    };

    const handlePageChange = (page) => {
        setCurrentPage(Math.min(Math.max(page, 1), totalPages));
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
                        disabled={isReadOnly}
                    />
                </div>
                <div className="course-detail-panel__credits">
                    <label className="cfm-label">หน่วยกิต</label>
                    <input
                        className="cfm-input"
                        type="number"
                        min={0}
                        value={credits}
                        onChange={e => setCredits(e.target.value)}
                        onBlur={handleSaveCredits}
                        onKeyDown={e => e.key === 'Enter' && handleSaveCredits()}
                        disabled={isReadOnly}
                    />
                </div>
                <button className="course-btn course-btn--ghost course-btn--danger course-delete-btn" onClick={() => onDelete(category)} disabled={isReadOnly}>
                    <Trash2 size={14} />
                </button>
            </div>

            <div className="course-detail-panel__courses">
                <div className="course-detail-panel__courses-header">
                    <span className="course-detail-panel__courses-title">รายวิชา ({courses.length})</span>
                    <button className="course-btn course-btn--primary course-btn--sm" onClick={handleAddNewCourse} disabled={isReadOnly || showAddCourse}>
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
                                {showAddCourse && (
                                    <tr className="ss-row ss-row--editing">
                                        <td className="ss-cell ss-cell--grip">
                                            <GripVertical size={13} />
                                        </td>
                                        <td className="ss-cell">
                                            <input
                                                className="ss-input"
                                                value={newCourse.code}
                                                onChange={e => setNewCourse(p => ({ ...p, code: e.target.value }))}
                                                placeholder="รหัสวิชา"
                                            />
                                        </td>
                                        <td className="ss-cell ss-cell--wide">
                                            <input
                                                className="ss-input"
                                                value={newCourse.nameTh}
                                                onChange={e => setNewCourse(p => ({ ...p, nameTh: e.target.value }))}
                                                placeholder="ชื่อวิชาภาษาไทย"
                                            />
                                        </td>
                                        <td className="ss-cell ss-cell--wide">
                                            <input
                                                className="ss-input"
                                                value={newCourse.nameEn}
                                                onChange={e => setNewCourse(p => ({ ...p, nameEn: e.target.value }))}
                                                placeholder="English Name"
                                            />
                                        </td>
                                        <td className="ss-cell ss-cell--num">
                                            <input
                                                className="ss-input ss-input--num"
                                                type="number"
                                                min={0}
                                                max={12}
                                                value={newCourse.credits}
                                                onChange={e => setNewCourse(p => ({ ...p, credits: parseInt(e.target.value, 10) || 0 }))}
                                                placeholder="0"
                                            />
                                        </td>
                                        <td className="ss-cell ss-cell--actions">
                                            <button className="icon-course-btn icon-course-btn--edit icon-course-btn--xs" onClick={handleAddCourse} disabled={!newCourse.code.trim() || !newCourse.nameTh.trim()}>
                                                <Check size={13} />
                                            </button>
                                            <button className="icon-course-btn icon-course-btn--danger icon-course-btn--xs" onClick={() => setShowAddCourse(false)}>
                                                <X size={12} />
                                            </button>
                                        </td>
                                    </tr>
                                )}
                                {courses.length === 0 && !showAddCourse ? (
                                    <tr>
                                        <td colSpan={6} className="ss-empty">
                                            {'ยังไม่มีรายวิชา - กดปุ่มเพิ่มรายวิชาด้านบน'}
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedCourses.map(course => (
                                        <CourseRow
                                            key={`${course.id}:${course.code}:${course.nameTh}:${course.nameEn}:${course.credits}`}
                                            course={course}
                                            onUpdate={onUpdateCourse}
                                            onDelete={() => onDeleteCourse(course)}
                                            disabled={disabled}
                                        />
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Pagination */}
                <div className="course-pagination">
                    <span className="course-pagination__info">
                        หน้า {safeCurrentPage} / {totalPages}
                    </span>
                    <div className="course-pagination__buttons">
                        <button
                            className="course-btn course-btn--ghost course-btn--sm"
                            onClick={() => handlePageChange(1)}
                            disabled={safeCurrentPage === 1}
                            title="หน้าแรก"
                        >
                            <ChevronFirst size={14} />
                        </button>
                        <button
                            className="course-btn course-btn--ghost course-btn--sm"
                            onClick={() => handlePageChange(safeCurrentPage - 1)}
                            disabled={safeCurrentPage === 1}
                            title="ย้อนกลับ"
                        >
                            <ChevronLeft size={14} /> ย้อนกลับ
                        </button>
                        <button
                            className="course-btn course-btn--ghost course-btn--sm"
                            onClick={() => handlePageChange(safeCurrentPage + 1)}
                            disabled={safeCurrentPage === totalPages}
                            title="ถัดไป"
                        >
                            ถัดไป <ChevronRight size={14} />
                        </button>
                        <button
                            className="course-btn course-btn--ghost course-btn--sm"
                            onClick={() => handlePageChange(totalPages)}
                            disabled={safeCurrentPage === totalPages}
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
function CourseRow({ course, onUpdate, onDelete, disabled = false }) {
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState({
        code: course.code || '',
        nameTh: course.nameTh || '',
        nameEn: course.nameEn || '',
        credits: course.credits || 0,
    });

    const handleSave = async () => {
        if (disabled || !form.code.trim() || !form.nameTh.trim()) return;
        const result = await onUpdate({
            ...course,
            code: form.code.trim(),
            nameTh: form.nameTh.trim(),
            nameEn: form.nameEn.trim(),
            credits: Number(form.credits) || 0,
        });
        if (result) {
            setEditing(false);
        }
    };

    const handleKey = (e) => {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') {
            setForm({ code: course.code || '', nameTh: course.nameTh || '', nameEn: course.nameEn || '', credits: course.credits || 0 });
            setEditing(false);
        }
    };

    const handleCellClick = () => {
        if (!disabled) setEditing(true);
    };

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
                        disabled={disabled}
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
                        disabled={disabled}
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
                        disabled={disabled}
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
                        disabled={disabled}
                    />
                ) : (
                    <span>{course.credits || <span className="ss-placeholder">0</span>}</span>
                )}
            </td>
            <td className="ss-cell ss-cell--actions" onClick={e => e.stopPropagation()}>
                {editing ? (
                    <button className="icon-course-btn icon-course-btn--edit icon-course-btn--xs" onClick={handleSave} disabled={disabled || !form.code.trim() || !form.nameTh.trim()}>
                        <Check size={13} />
                    </button>
                ) : (
                    <button className="icon-course-btn icon-course-btn--edit icon-course-btn--xs" onClick={() => setEditing(true)} disabled={disabled}>
                        <Pencil size={12} />
                    </button>
                )}
                <button className="icon-course-btn icon-course-btn--danger icon-course-btn--xs" onClick={() => onDelete(course)} disabled={disabled}>
                    <Trash2 size={12} />
                </button>
            </td>
        </tr>
    );
}
