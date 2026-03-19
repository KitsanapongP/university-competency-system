'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import { Plus, Pencil, Trash2, BookOpen, ArrowLeft, CalendarDays, BookOpenCheck, Settings, SlidersHorizontal, BarChart3 } from 'lucide-react';
import { MOCK_TEMPLATES, MOCK_COMPETENCIES, MOCK_CATEGORIES } from './mockData';
import CategoryCoursePanel  from './components/CategoryCoursePanel';
import CompetencyOverview   from './components/CompetencyOverview';
import TemplateFormModal    from './components/TemplateFormModal';
import ConfirmDeleteModal   from './components/ConfirmDeleteModal';
import './TemplateManagement.css';

// ============================================================
// Pure helpers
// ============================================================
function insertChild(cats, parentId, newChild) {
    return cats.map(c => {
        if (c.id === parentId) return { ...c, children: [...(c.children || []), newChild] };
        if (c.children?.length) return { ...c, children: insertChild(c.children, parentId, newChild) };
        return c;
    });
}
function renameCategory(cats, id, name) {
    return cats.map(c => {
        if (c.id === id) return { ...c, name, isNew: false };
        if (c.children?.length) return { ...c, children: renameCategory(c.children, id, name) };
        return c;
    });
}
function removeCategory(cats, id) {
    return recodeSiblings(
        cats.filter(c => c.id !== id)
            .map(c => ({ ...c, children: removeCategory(c.children || [], id) }))
    );
}
function recodeSiblings(cats, parentCode = '') {
    return cats.map((c, i) => {
        const code = parentCode ? `${parentCode}.${i + 1}` : `${i + 1}`;
        return { ...c, code, children: c.children?.length ? recodeSiblings(c.children, code) : c.children };
    });
}
function findById(cats, id) {
    for (const c of cats) {
        if (c.id === id) return c;
        const f = findById(c.children || [], id);
        if (f) return f;
    }
    return null;
}
function collectIds(cat) { return [cat.id, ...(cat.children || []).flatMap(collectIds)]; }
function isDescendantOf(node, id) { return (node.children || []).some(c => c.id === id || isDescendantOf(c, id)); }
function getDirectChildren(cats, parentId) {
    if (!parentId) return cats;
    return findById(cats, parentId)?.children || [];
}
function getNextCode(parentCode, siblings) {
    return parentCode ? `${parentCode}.${siblings.length + 1}` : `${siblings.length + 1}`;
}
function getDepthFromCode(code) { return code ? code.split('.').length - 1 : 0; }

// ============================================================
// TemplateCard — การ์ดแสดงใน list view
// ============================================================
function TemplateCard({ template, courseCount, onOpen, onDelete }) {
    return (
        <div className="tpl-card" onClick={() => onOpen(template)}>
            <div className="tpl-card__icon">
                <BookOpenCheck size={28} />
            </div>
            <div className="tpl-card__body">
                <span className="tpl-card__name">{template.name}</span>
                <div className="tpl-card__meta">
                    <span><CalendarDays size={12}/> ปี {template.year}</span>
                    <span><BookOpen size={12}/> {courseCount} วิชา</span>
                </div>
            </div>
            <button
                className="icon-btn icon-btn--danger tpl-card__delete"
                title="ลบ Template"
                onClick={e => { e.stopPropagation(); onDelete(template); }}
            >
                <Trash2 size={15}/>
            </button>
        </div>
    );
}

// ============================================================
// Main Page
// ============================================================
export default function TemplateManagementPage() {
    // ── view: 'list' | 'editor' ──
    const [view, setView] = useState('list');
    const [editorTab, setEditorTab] = useState('setup'); // 'setup' | 'weight' | 'overview'

    const [templates,    setTemplates]    = useState(MOCK_TEMPLATES);
    const [competencies, setCompetencies] = useState(MOCK_COMPETENCIES);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [deletingTemplate,  setDeletingTemplate]  = useState(null);
    const [deletingCategory,  setDeletingCategory]  = useState(null);
    const [deletingCourse,    setDeletingCourse]    = useState(null);

    const [categoriesByTemplate, setCategoriesByTemplate] = useState(() => {
        const m = {};
        MOCK_TEMPLATES.forEach(t => { m[t.id] = JSON.parse(JSON.stringify(MOCK_CATEGORIES)); });
        return m;
    });
    const [coursesByTemplate,  setCoursesByTemplate]  = useState({});
    const [weightsByTemplate,  setWeightsByTemplate]  = useState({});

    const idRef       = useRef(9000);
    const compIdRef   = useRef(8000);
    const templateRef = useRef(7000);
    const courseIdRef = useRef(5000);

    // ── Derived ──
    const currentCategories      = selectedTemplate ? (categoriesByTemplate[selectedTemplate.id] || []) : [];
    const currentCoursesByCat    = selectedTemplate ? (coursesByTemplate[selectedTemplate.id] || {}) : {};
    const currentWeightsByCourse = selectedTemplate ? (weightsByTemplate[selectedTemplate.id] || {}) : {};

    const updateCurrentCategories = useCallback((updater) => {
        if (!selectedTemplate) return;
        setCategoriesByTemplate(prev => ({
            ...prev,
            [selectedTemplate.id]: typeof updater === 'function'
                ? updater(prev[selectedTemplate.id] || []) : updater,
        }));
    }, [selectedTemplate]);

    const updateCurrentCourses = useCallback((updater) => {
        if (!selectedTemplate) return;
        setCoursesByTemplate(prev => ({
            ...prev,
            [selectedTemplate.id]: typeof updater === 'function'
                ? updater(prev[selectedTemplate.id] || {}) : updater,
        }));
    }, [selectedTemplate]);

    // ── Credit map ──
    const creditMap = useMemo(() => {
        const map = {};
        function calc(cat) {
            const own = (currentCoursesByCat[cat.id] || []).reduce((s, c) => s + (Number(c.credits) || 0), 0);
            const child = (cat.children || []).reduce((s, ch) => s + calc(ch), 0);
            map[cat.id] = own + child;
            return map[cat.id];
        }
        currentCategories.forEach(calc);
        return map;
    }, [currentCategories, currentCoursesByCat]);

    const courseCountMap = useMemo(() => {
        const m = {};
        templates.forEach(t => {
            m[t.id] = Object.values(coursesByTemplate[t.id] || {}).reduce((s, a) => s + a.length, 0);
        });
        return m;
    }, [templates, coursesByTemplate]);

    // ============================================================
    // Template handlers
    // ============================================================
    const handleOpenTemplate = useCallback((t) => {
        setSelectedTemplate(t);
        setSelectedCategory(null);
        setView('editor');
    }, []);

    const handleBackToList = useCallback(() => {
        setView('list');
        setSelectedTemplate(null);
        setSelectedCategory(null);
    }, []);

    const handleRequestDeleteTemplate = useCallback((t) => setDeletingTemplate(t), []);
    const handleConfirmDeleteTemplate  = useCallback(() => {
        if (!deletingTemplate) return;
        const id = deletingTemplate.id;
        setTemplates(p => p.filter(t => t.id !== id));
        setCategoriesByTemplate(p => { const n = { ...p }; delete n[id]; return n; });
        setCoursesByTemplate(p => { const n = { ...p }; delete n[id]; return n; });
        setWeightsByTemplate(p => { const n = { ...p }; delete n[id]; return n; });
        if (selectedTemplate?.id === id) handleBackToList();
        setDeletingTemplate(null);
    }, [deletingTemplate, selectedTemplate, handleBackToList]);

    const handleSaveTemplate = useCallback(({ name, year, masterData, competencyIds }) => {
        const id = ++templateRef.current;
        const newTemplate = { id, name, year };
        setTemplates(p => [...p, newTemplate]);

        // ถ้ามี masterData → แปลง categories และ courses จาก master
        if (masterData) {
            // แปลง master categories → format ที่ใช้ใน app
            function convertCats(cats, courseMap) {
                return cats.map((cat, i) => {
                    const newId = ++idRef.current;
                    const converted = {
                        id: newId,
                        code: cat.code,
                        name: cat.name,
                        requiredCredits: cat.requiredCredits || 0,
                        children: convertCats(cat.children || [], courseMap),
                        isNew: false,
                        fromMaster: true,  // ← mark ว่ามาจาก master
                    };
                    if (cat.courses?.length) {
                        courseMap[newId] = cat.courses.map(c => ({
                            id: ++courseIdRef.current,
                            code: c.code,
                            nameTh: c.nameTh,
                            nameEn: c.nameEn,
                            credits: c.credits,
                            fromMaster: true,
                        }));
                    }
                    return converted;
                });
            }
            const courseMap = {};
            const cats = convertCats(masterData.categories, courseMap);
            setCategoriesByTemplate(p => ({ ...p, [id]: cats }));
            setCoursesByTemplate(p => ({ ...p, [id]: courseMap }));
        } else {
            setCategoriesByTemplate(p => ({ ...p, [id]: [] }));
        }

        // set competencies ที่เลือก
        if (competencyIds?.length) {
            setCompetencies(prev => {
                const existing = new Set(prev.map(c => c.id));
                const kept = prev.filter(c => competencyIds.includes(c.id));
                return kept.length ? kept : prev.filter(c => competencyIds.includes(c.id));
            });
        }

        setShowTemplateModal(false);
        setSelectedTemplate(newTemplate);
        setSelectedCategory(null);
        setView('editor');
    }, []);

    // ============================================================
    // Category handlers
    // ============================================================
    const handleSelectCategory = useCallback((cat) => setSelectedCategory(cat), []);

    const handleCreateCategory = useCallback(() => {
        const newId = ++idRef.current;
        if (!selectedCategory) {
            const code = getNextCode('', getDirectChildren(currentCategories, null));
            const newCat = { id: newId, code, name: '', requiredCredits: 0, children: [], isNew: true };
            updateCurrentCategories(p => [...p, newCat]);
            setSelectedCategory(newCat);
        } else {
            if (getDepthFromCode(selectedCategory.code) >= 2) {
                alert('ไม่สามารถสร้างหมวดวิชาที่ลึกกว่า 3 ระดับได้'); return;
            }
            const existing = currentCoursesByCat[selectedCategory.id] || [];
            const code = getNextCode(selectedCategory.code, getDirectChildren(currentCategories, selectedCategory.id));
            const newCat = { id: newId, code, name: '', requiredCredits: 0, children: [], isNew: true };
            if (existing.length > 0 && selectedTemplate) {
                setCoursesByTemplate(p => {
                    const tpl = p[selectedTemplate.id] || {};
                    return { ...p, [selectedTemplate.id]: { ...tpl, [selectedCategory.id]: [], [newId]: existing } };
                });
            }
            updateCurrentCategories(p => insertChild(p, selectedCategory.id, newCat));
            setSelectedCategory(newCat);
        }
    }, [selectedCategory, currentCategories, currentCoursesByCat, updateCurrentCategories, selectedTemplate]);

    const handleRenameCategory = useCallback((id, name) => {
        updateCurrentCategories(p => renameCategory(p, id, name || 'หมวดใหม่'));
    }, [updateCurrentCategories]);

    const handleReorderCategories = useCallback((newCats) => {
        updateCurrentCategories(newCats);
        setSelectedCategory(p => p ? findById(newCats, p.id) || null : null);
    }, [updateCurrentCategories]);

    const handleRequestDeleteCategory = useCallback((cat) => setDeletingCategory(cat), []);
    const handleConfirmDeleteCategory  = useCallback(() => {
        if (!deletingCategory || !selectedTemplate) return;
        const ids = collectIds(deletingCategory);
        setCoursesByTemplate(p => {
            const tpl = { ...p[selectedTemplate.id] };
            ids.forEach(id => delete tpl[id]);
            return { ...p, [selectedTemplate.id]: tpl };
        });
        updateCurrentCategories(p => removeCategory(p, deletingCategory.id));
        if (selectedCategory?.id === deletingCategory.id || isDescendantOf(deletingCategory, selectedCategory?.id)) {
            setSelectedCategory(null);
        }
        setDeletingCategory(null);
    }, [deletingCategory, selectedTemplate, selectedCategory, updateCurrentCategories]);

    // ============================================================
    // Course handlers
    // ============================================================
    const handleAddCourse = useCallback((catId, data) => {
        if (!selectedTemplate) return;
        const course = { id: ++courseIdRef.current, ...data };
        updateCurrentCourses(p => ({ ...p, [catId]: [...(p[catId] || []), course] }));
    }, [selectedTemplate, updateCurrentCourses]);

    const handleUpdateCourse = useCallback((catId, updatedCourse) => {
        updateCurrentCourses(p => ({
            ...p,
            [catId]: (p[catId] || []).map(c => c.id === updatedCourse.id ? updatedCourse : c),
        }));
    }, [updateCurrentCourses]);

    const handleReorderCourses = useCallback((catId, fromIdx, toIdx) => {
        if (fromIdx === toIdx) return;
        updateCurrentCourses(p => {
            const list = [...(p[catId] || [])];
            const [moved] = list.splice(fromIdx, 1);
            list.splice(toIdx, 0, moved);
            return { ...p, [catId]: list };
        });
    }, [updateCurrentCourses]);

    const handleRequestDeleteCourse = useCallback((catId, course) => {
        setDeletingCourse({ ...course, _catId: catId });
    }, []);

    const handleConfirmDeleteCourse = useCallback(() => {
        if (!deletingCourse || !selectedTemplate) return;
        const catId = deletingCourse._catId;
        updateCurrentCourses(p => ({ ...p, [catId]: (p[catId] || []).filter(c => c.id !== deletingCourse.id) }));
        setWeightsByTemplate(p => {
            const tpl = { ...(p[selectedTemplate.id] || {}) };
            delete tpl[deletingCourse.id];
            return { ...p, [selectedTemplate.id]: tpl };
        });
        setDeletingCourse(null);
    }, [deletingCourse, selectedTemplate, updateCurrentCourses]);

    // ============================================================
    // Competency / Weight handlers
    // ============================================================
    const handleSetWeight = useCallback((courseId, compId, weight) => {
        if (!selectedTemplate) return;
        setWeightsByTemplate(p => {
            const tpl    = p[selectedTemplate.id] || {};
            const course = { ...(tpl[courseId] || {}), [compId]: weight };
            return { ...p, [selectedTemplate.id]: { ...tpl, [courseId]: course } };
        });
    }, [selectedTemplate]);

    const handleAddCompetency = useCallback((name, color) => {
        const newComp = { id: ++compIdRef.current, code: `custom_${compIdRef.current}`, name, color: color || '#7dd3fc' };
        setCompetencies(p => [...p, newComp]);
        return newComp;
    }, []);

    // ============================================================
    // Render
    // ============================================================

    // ── List View ──
    if (view === 'list') {
        return (
            <div className="tm-page">
                <div className="tpl-list-view">
                    {/* Header */}
                    <div className="tpl-list-view__header">
                        <div>
                            <h1 className="tm-header__title">จัดการ Template หลักสูตร</h1>
                            <p className="tpl-list-view__sub">เลือก Template ที่ต้องการแก้ไข หรือสร้าง Template ใหม่</p>
                        </div>
                        <button className="btn btn--primary" onClick={() => setShowTemplateModal(true)}>
                            <Plus size={15}/> สร้าง Template ใหม่
                        </button>
                    </div>

                    {/* Cards */}
                    {templates.length === 0 ? (
                        <div className="tpl-list-view__empty">
                            <BookOpenCheck size={48} opacity={0.2}/>
                            <p>ยังไม่มี Template — กดปุ่ม "สร้าง Template ใหม่" เพื่อเริ่ม</p>
                            <button className="btn btn--primary" onClick={() => setShowTemplateModal(true)}>
                                <Plus size={15}/> สร้าง Template ใหม่
                            </button>
                        </div>
                    ) : (
                        <div className="tpl-card-grid">
                            {templates.map(t => (
                                <TemplateCard
                                    key={t.id}
                                    template={t}
                                    courseCount={courseCountMap[t.id] ?? 0}
                                    onOpen={handleOpenTemplate}
                                    onDelete={handleRequestDeleteTemplate}
                                />
                            ))}
                            {/* + Create card */}
                            <div className="tpl-card tpl-card--create" onClick={() => setShowTemplateModal(true)}>
                                <Plus size={28} opacity={0.4}/>
                                <span>สร้าง Template ใหม่</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Modals */}
                {showTemplateModal && (
                    <TemplateFormModal onClose={() => setShowTemplateModal(false)} onSave={handleSaveTemplate}/>
                )}
                {deletingTemplate && (
                    <ConfirmDeleteModal
                        category={{ code:'', name: deletingTemplate.name }}
                        label="Template"
                        onConfirm={handleConfirmDeleteTemplate}
                        onCancel={() => setDeletingTemplate(null)}
                    />
                )}
            </div>
        );
    }

    // ── Editor View ──
    return (
        <div className="tm-page tm-page--editor">
            {/* Topbar */}
            <div className="editor-topbar">
                <button className="btn btn--ghost btn--sm editor-topbar__back" onClick={handleBackToList}>
                    <ArrowLeft size={15}/> Template ทั้งหมด
                </button>
                <span className="editor-topbar__title">{selectedTemplate?.name}</span>
                <span className="editor-topbar__year">ปี {selectedTemplate?.year}</span>
                <div style={{ marginLeft:'auto', display:'flex', gap:'0.5rem' }}>
                    <button className="icon-btn icon-btn--danger icon-btn--xs"
                        title="ลบ Template นี้"
                        onClick={() => handleRequestDeleteTemplate(selectedTemplate)}>
                        <Trash2 size={14}/>
                    </button>
                </div>
            </div>

            {/* Tab bar */}
            <div className="editor-tabs">
                {[
                    { id:'setup',    label:'ตั้งค่าวิชา',    icon: <Settings size={14}/> },
                    { id:'weight',   label:'ใส่ Weight',     icon: <SlidersHorizontal size={14}/> },
                    { id:'overview', label:'ภาพรวม Competency', icon: <BarChart3 size={14}/> },
                ].map(tab => (
                    <button key={tab.id}
                        className={`editor-tab ${editorTab === tab.id ? 'editor-tab--active' : ''}`}
                        onClick={() => setEditorTab(tab.id)}>
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            {editorTab === 'setup' && (
                <CategoryCoursePanel
                    template={selectedTemplate}
                    categories={currentCategories}
                    selectedCategory={selectedCategory}
                    coursesByCategoryId={currentCoursesByCat}
                    weightsByCourseId={currentWeightsByCourse}
                    competencies={competencies}
                    creditMap={creditMap}
                    onSelectCategory={handleSelectCategory}
                    onCreateCategory={handleCreateCategory}
                    onRenameCategory={handleRenameCategory}
                    onReorderCategories={handleReorderCategories}
                    onDeleteCategory={handleRequestDeleteCategory}
                    onAddCourse={handleAddCourse}
                    onUpdateCourse={handleUpdateCourse}
                    onReorderCourses={handleReorderCourses}
                    onDeleteCourse={handleRequestDeleteCourse}
                    onSetWeight={handleSetWeight}
                    onAddCompetency={handleAddCompetency}
                    mode="setup"
                />
            )}

            {editorTab === 'weight' && (
                <CategoryCoursePanel
                    template={selectedTemplate}
                    categories={currentCategories}
                    selectedCategory={selectedCategory}
                    coursesByCategoryId={currentCoursesByCat}
                    weightsByCourseId={currentWeightsByCourse}
                    competencies={competencies}
                    creditMap={creditMap}
                    onSelectCategory={handleSelectCategory}
                    onCreateCategory={handleCreateCategory}
                    onRenameCategory={handleRenameCategory}
                    onReorderCategories={handleReorderCategories}
                    onDeleteCategory={handleRequestDeleteCategory}
                    onAddCourse={handleAddCourse}
                    onUpdateCourse={handleUpdateCourse}
                    onReorderCourses={handleReorderCourses}
                    onDeleteCourse={handleRequestDeleteCourse}
                    onSetWeight={handleSetWeight}
                    onAddCompetency={handleAddCompetency}
                    mode="weight"
                />
            )}

            {editorTab === 'overview' && (
                <CompetencyOverview
                    categories={currentCategories}
                    coursesByCategoryId={currentCoursesByCat}
                    weightsByCourseId={currentWeightsByCourse}
                    competencies={competencies}
                />
            )}
            {/* Modals */}
            {deletingTemplate && (
                <ConfirmDeleteModal
                    category={{ code:'', name: deletingTemplate.name }}
                    label="Template"
                    onConfirm={handleConfirmDeleteTemplate}
                    onCancel={() => setDeletingTemplate(null)}
                />
            )}
            {deletingCategory && (
                <ConfirmDeleteModal
                    category={deletingCategory}
                    onConfirm={handleConfirmDeleteCategory}
                    onCancel={() => setDeletingCategory(null)}
                />
            )}
            {deletingCourse && (
                <ConfirmDeleteModal
                    category={{ code: deletingCourse.code, name: deletingCourse.nameTh }}
                    label="รายวิชา"
                    onConfirm={handleConfirmDeleteCourse}
                    onCancel={() => setDeletingCourse(null)}
                />
            )}
        </div>
    );
}