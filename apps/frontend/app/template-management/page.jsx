'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import { MOCK_TEMPLATES, MOCK_COMPETENCIES, MOCK_CATEGORIES } from './mockData';
import TemplateList          from './components/TemplateList';
import CourseCategoryTree, { getNextCode, getDepthFromCode } from './components/CourseCategoryTree';
import CourseCompetencyPanel from './components/CourseCompetencyPanel';
import TemplateFormModal     from './components/TemplateFormModal';
import ConfirmDeleteModal    from './components/ConfirmDeleteModal';
import './TemplateManagement.css';

// ============================================================
// Pure helpers
// ============================================================
function insertChild(cats, parentId, newChild) {
    return cats.map(cat => {
        if (cat.id === parentId) return { ...cat, children: [...(cat.children || []), newChild] };
        if (cat.children?.length > 0) return { ...cat, children: insertChild(cat.children, parentId, newChild) };
        return cat;
    });
}
function renameCategory(cats, id, newName) {
    return cats.map(cat => {
        if (cat.id === id) return { ...cat, name: newName, isNew: false };
        if (cat.children?.length > 0) return { ...cat, children: renameCategory(cat.children, id, newName) };
        return cat;
    });
}
function removeCategory(cats, id) {
    const filtered = cats.filter(c => c.id !== id);
    return recodeSiblings(filtered.map(c => ({ ...c, children: removeCategory(c.children || [], id) })));
}
function recodeSiblings(cats, parentCode = '') {
    return cats.map((cat, index) => {
        const newCode = parentCode ? `${parentCode}.${index + 1}` : `${index + 1}`;
        return { ...cat, code: newCode, children: cat.children?.length > 0 ? recodeSiblings(cat.children, newCode) : cat.children };
    });
}
function findById(cats, id) {
    for (const cat of cats) {
        if (cat.id === id) return cat;
        const found = findById(cat.children || [], id);
        if (found) return found;
    }
    return null;
}
function getDirectChildren(cats, parentId) {
    if (!parentId) return cats;
    return findById(cats, parentId)?.children || [];
}
function isDescendantOf(node, id) {
    if (!node?.children?.length) return false;
    return node.children.some(c => c.id === id || isDescendantOf(c, id));
}
function collectIds(cat) {
    const ids = [cat.id];
    for (const child of cat.children || []) ids.push(...collectIds(child));
    return ids;
}

// คำนวณ credits ของ subtree
function calcSubtreeCredits(category, coursesByCatId) {
    const ownCredits = (coursesByCatId[category.id] || [])
        .reduce((sum, c) => sum + (Number(c.credits) || 0), 0);
    return ownCredits + (category.children || [])
        .reduce((sum, child) => sum + calcSubtreeCredits(child, coursesByCatId), 0);
}
function buildCreditMap(cats, coursesByCatId) {
    const map = {};
    function walk(cat) {
        map[cat.id] = calcSubtreeCredits(cat, coursesByCatId);
        (cat.children || []).forEach(walk);
    }
    cats.forEach(walk);
    return map;
}
function countTotalCourses(coursesByCatId) {
    return Object.values(coursesByCatId || {})
        .reduce((sum, courses) => sum + (courses?.length || 0), 0);
}

// ============================================================
// Main Page
// ============================================================
export default function TemplateManagementPage() {
    const [templates,    setTemplates]    = useState(MOCK_TEMPLATES);
    const [competencies, setCompetencies] = useState(MOCK_COMPETENCIES);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [selectedCourse,   setSelectedCourse]   = useState(null);
    const [showModal,        setShowModal]         = useState(false);
    const [deletingCategory, setDeletingCategory] = useState(null);
    const [deletingCourse,   setDeletingCourse]   = useState(null);

    const [categoriesByTemplate, setCategoriesByTemplate] = useState(() => {
        const initial = {};
        MOCK_TEMPLATES.forEach(t => { initial[t.id] = JSON.parse(JSON.stringify(MOCK_CATEGORIES)); });
        return initial;
    });
    const [coursesByTemplate,  setCoursesByTemplate]  = useState({});
    const [weightsByTemplate,  setWeightsByTemplate]  = useState({});

    const idRef       = useRef(9000);
    const compIdRef   = useRef(8000);
    const templateRef = useRef(7000);
    const courseIdRef = useRef(5000);

    const currentCategories   = selectedTemplate ? (categoriesByTemplate[selectedTemplate.id] || []) : [];
    const currentCoursesByCat = selectedTemplate ? (coursesByTemplate[selectedTemplate.id] || {}) : {};
    const currentCourses      = (selectedTemplate && selectedCategory)
        ? (currentCoursesByCat[selectedCategory.id] || []) : [];
    const currentWeights      = (selectedTemplate && selectedCourse)
        ? (weightsByTemplate[selectedTemplate.id]?.[selectedCourse.id] || []) : [];

    const creditMap = useMemo(
        () => buildCreditMap(currentCategories, currentCoursesByCat),
        [currentCategories, currentCoursesByCat]
    );
    const courseCountMap = useMemo(() => {
        const map = {};
        templates.forEach(t => { map[t.id] = countTotalCourses(coursesByTemplate[t.id]); });
        return map;
    }, [templates, coursesByTemplate]);

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

    // ============================================================
    // Template Handlers
    // ============================================================
    const handleSelectTemplate = useCallback((t) => {
        setSelectedTemplate(t); setSelectedCategory(null); setSelectedCourse(null);
    }, []);

    const handleDeleteTemplate = useCallback((id) => {
        // TODO (Backend): DELETE /api/templates/:id
        setTemplates(prev => prev.filter(t => t.id !== id));
        setCategoriesByTemplate(prev => { const n = { ...prev }; delete n[id]; return n; });
        setCoursesByTemplate(prev => { const n = { ...prev }; delete n[id]; return n; });
        setWeightsByTemplate(prev => { const n = { ...prev }; delete n[id]; return n; });
        setSelectedTemplate(prev => prev?.id === id ? null : prev);
        setSelectedCategory(null); setSelectedCourse(null);
    }, []);

    const handleSaveTemplate = useCallback(({ name, year }) => {
        // TODO (Backend): POST /api/templates  body: { name, year }
        const newId = ++templateRef.current;
        setTemplates(prev => [...prev, { id: newId, name, year }]);
        setCategoriesByTemplate(prev => ({ ...prev, [newId]: [] }));
        setShowModal(false);
    }, []);

    // ============================================================
    // Category Handlers
    // ============================================================
    const handleSelectCategory = useCallback((cat) => {
        setSelectedCategory(cat); setSelectedCourse(null);
    }, []);

    const createCourseCategory = useCallback(() => {
        // TODO (Backend): POST /api/templates/:templateId/categories
        //   body: { name, code, requiredCredits, parentId }
        //
        // TODO (Backend) — Auto-move courses:
        //   ถ้า parentId มีวิชาอยู่แล้ว ให้ย้ายวิชาเหล่านั้นไปยัง category ใหม่
        //   PATCH /api/templates/:templateId/courses/move
        //     body: { courseIds: [...], toCategoryId: newCategory.id }
        const newId = ++idRef.current;
        let newCode = '';
        if (!selectedCategory) {
            newCode = getNextCode('', getDirectChildren(currentCategories, null));
        } else {
            const parentDepth = getDepthFromCode(selectedCategory.code);
            if (parentDepth >= 2) { alert('ไม่สามารถสร้างหมวดวิชาที่ลึกกว่า 3 ระดับได้'); return; }
            newCode = getNextCode(selectedCategory.code, getDirectChildren(currentCategories, selectedCategory.id));
        }
        const newCategory = { id: newId, code: newCode, name: '', requiredCredits: 0, children: [], isNew: true };

        // ย้ายวิชาอัตโนมัติถ้า parent มีวิชาอยู่แล้ว
        const parentCatId      = selectedCategory?.id;
        const existingCourses  = parentCatId ? (coursesByTemplate[selectedTemplate?.id]?.[parentCatId] || []) : [];
        if (existingCourses.length > 0 && selectedTemplate) {
            setCoursesByTemplate(prev => {
                const tpl = prev[selectedTemplate.id] || {};
                return { ...prev, [selectedTemplate.id]: { ...tpl, [parentCatId]: [], [newId]: existingCourses } };
            });
        }

        if (!selectedCategory) {
            updateCurrentCategories(prev => [...prev, newCategory]);
        } else {
            updateCurrentCategories(prev => insertChild(prev, selectedCategory.id, newCategory));
        }
        setSelectedCategory(newCategory); setSelectedCourse(null);
    }, [selectedCategory, currentCategories, updateCurrentCategories, coursesByTemplate, selectedTemplate]);

    const handleRenameCategory = useCallback((id, newName) => {
        // TODO (Backend): PATCH /api/templates/:templateId/categories/:id  body: { name }
        updateCurrentCategories(prev => renameCategory(prev, id, newName));
    }, [updateCurrentCategories]);

    const handleReorder = useCallback((newCategories) => {
        // TODO (Backend): PATCH /api/templates/:templateId/categories/reorder  body: { categories }
        updateCurrentCategories(newCategories);
        setSelectedCategory(prev => prev ? findById(newCategories, prev.id) || null : null);
    }, [updateCurrentCategories]);

    // ---- Delete Category ----
    const handleRequestDeleteCategory = useCallback((cat) => { setDeletingCategory(cat); }, []);
    const handleConfirmDeleteCategory = useCallback(() => {
        if (!deletingCategory || !selectedTemplate) return;
        // TODO (Backend): DELETE /api/templates/:templateId/categories/:id
        const deletedIds = collectIds(deletingCategory);
        setCoursesByTemplate(prev => {
            const tpl = { ...prev[selectedTemplate.id] };
            deletedIds.forEach(id => delete tpl[id]);
            return { ...prev, [selectedTemplate.id]: tpl };
        });
        setWeightsByTemplate(prev => {
            const tpl = { ...prev[selectedTemplate.id] };
            deletedIds.forEach(id => delete tpl[id]);
            return { ...prev, [selectedTemplate.id]: tpl };
        });
        updateCurrentCategories(prev => removeCategory(prev, deletingCategory.id));
        if (selectedCategory?.id === deletingCategory.id || isDescendantOf(deletingCategory, selectedCategory?.id)) {
            setSelectedCategory(null); setSelectedCourse(null);
        }
        setDeletingCategory(null);
    }, [deletingCategory, selectedTemplate, selectedCategory, updateCurrentCategories]);

    // ============================================================
    // Course Handlers
    // ============================================================
    const handleAddCourse = useCallback((data) => {
        if (!selectedTemplate || !selectedCategory) return;
        // TODO (Backend): POST /api/templates/:templateId/categories/:categoryId/courses
        //   body: { code, nameTh, nameEn, credits }
        const newCourse = { id: ++courseIdRef.current, ...data };
        updateCurrentCourses(prev => {
            const existing = prev[selectedCategory.id] || [];
            return { ...prev, [selectedCategory.id]: [...existing, newCourse] };
        });
    }, [selectedTemplate, selectedCategory, updateCurrentCourses]);

    const handleRequestDeleteCourse = useCallback((courseId) => {
        const course = (coursesByTemplate[selectedTemplate?.id]?.[selectedCategory?.id] || [])
            .find(c => c.id === courseId);
        if (course) setDeletingCourse(course);
    }, [coursesByTemplate, selectedTemplate, selectedCategory]);

    const handleConfirmDeleteCourse = useCallback(() => {
        if (!deletingCourse || !selectedTemplate || !selectedCategory) return;
        // TODO (Backend): DELETE /api/courses/:courseId
        updateCurrentCourses(prev => ({
            ...prev,
            [selectedCategory.id]: (prev[selectedCategory.id] || []).filter(c => c.id !== deletingCourse.id),
        }));
        setWeightsByTemplate(prev => {
            const tpl = { ...prev[selectedTemplate.id] };
            delete tpl[deletingCourse.id];
            return { ...prev, [selectedTemplate.id]: tpl };
        });
        if (selectedCourse?.id === deletingCourse.id) setSelectedCourse(null);
        setDeletingCourse(null);
    }, [deletingCourse, selectedTemplate, selectedCategory, selectedCourse, updateCurrentCourses]);

    // ---- ย้ายวิชาไปยัง category อื่น (drag จาก tree) ----
    const handleMoveCourseToCategory = useCallback((course, fromCatId, toCatId) => {
        if (!selectedTemplate || fromCatId === toCatId) return;
        // TODO (Backend): PATCH /api/courses/:courseId/move
        //   body: { toCategoryId }
        updateCurrentCourses(prev => {
            const fromList = (prev[fromCatId] || []).filter(c => c.id !== course.id);
            const toList   = [...(prev[toCatId] || []), course];
            return { ...prev, [fromCatId]: fromList, [toCatId]: toList };
        });
        // ถ้า course ที่ย้ายเป็นตัวที่ selected อยู่ → clear เพราะย้ายออกจาก category นี้แล้ว
        if (selectedCourse?.id === course.id) setSelectedCourse(null);
    }, [selectedTemplate, selectedCourse, updateCurrentCourses]);

    // ---- เรียงลำดับวิชาใน category เดิม (drag ใน Panel 3) ----
    const handleReorderCourses = useCallback((fromIdx, toIdx) => {
        if (!selectedTemplate || !selectedCategory) return;
        // TODO (Backend): PATCH /api/templates/:templateId/categories/:categoryId/courses/reorder
        //   body: { courseIds: [...] }  ส่ง array ของ id ตามลำดับใหม่
        updateCurrentCourses(prev => {
            const list = [...(prev[selectedCategory.id] || [])];
            const [moved] = list.splice(fromIdx, 1);
            const insertAt = toIdx > fromIdx ? toIdx - 1 : toIdx;
            list.splice(insertAt, 0, moved);
            return { ...prev, [selectedCategory.id]: list };
        });
    }, [selectedTemplate, selectedCategory, updateCurrentCourses]);

    // ============================================================
    // Competency Handlers
    // ============================================================
    const handleCompetencyChange = useCallback((newSelected) => {
        if (!selectedTemplate || !selectedCourse) return;
        // TODO (Backend): PUT /api/courses/:courseId/competencies  body: { competencies: [{ id, weight }] }
        setWeightsByTemplate(p => {
            const tw   = p[selectedTemplate.id] || {};
            const prev = tw[selectedCourse.id] || [];
            const updated = newSelected.map(comp => {
                const existing = prev.find(w => w.competency.id === comp.id);
                return existing ?? { competency: comp, weight: 0 };
            });
            return { ...p, [selectedTemplate.id]: { ...tw, [selectedCourse.id]: updated } };
        });
    }, [selectedTemplate, selectedCourse]);

    const handleWeightChange = useCallback((compId, value) => {
        if (!selectedTemplate || !selectedCourse) return;
        setWeightsByTemplate(p => {
            const tw = p[selectedTemplate.id] || {};
            return {
                ...p,
                [selectedTemplate.id]: {
                    ...tw,
                    [selectedCourse.id]: (tw[selectedCourse.id] || []).map(w =>
                        w.competency.id === compId
                            ? { ...w, weight: Math.min(100, Math.max(0, Number(value) || 0)) }
                            : w
                    ),
                },
            };
        });
    }, [selectedTemplate, selectedCourse]);

    const handleCreateCompetency = useCallback((name) => {
        // TODO (Backend): POST /api/competencies  body: { name, code }
        const newComp = { id: ++compIdRef.current, code: `custom_${compIdRef.current}`, name, color: '#7dd3fc' };
        setCompetencies(prev => [...prev, newComp]);
        return newComp;
    }, []);

    const handleSaveCompetency = useCallback(() => {
        // TODO (Backend): PUT /api/courses/:courseId/competencies  body: { weights: [{ competencyId, weight }] }
        console.log('save:', { templateId: selectedTemplate?.id, courseId: selectedCourse?.id, weights: currentWeights });
        alert('บันทึก Competency เรียบร้อย (mock)');
    }, [selectedTemplate, selectedCourse, currentWeights]);

    return (
        <div className="tm-page">
            <div className="tm-header">
                <h1 className="tm-header__title">จัดการ Template หลักสูตร</h1>
            </div>

            <div className="tm-panels">
                <TemplateList
                    templates={templates}
                    selectedId={selectedTemplate?.id}
                    onSelect={handleSelectTemplate}
                    onDelete={handleDeleteTemplate}
                    onClickCreate={() => setShowModal(true)}
                    courseCountMap={courseCountMap}
                />

                <CourseCategoryTree
                    categories={currentCategories}
                    selectedId={selectedCategory?.id}
                    onSelect={handleSelectCategory}
                    onCreateCategory={createCourseCategory}
                    onRename={handleRenameCategory}
                    onReorder={handleReorder}
                    template={selectedTemplate}
                    coursesByCategoryId={currentCoursesByCat}
                    onDeleteCourse={handleRequestDeleteCourse}
                    onMoveCourseToCategory={handleMoveCourseToCategory}
                    creditMap={creditMap}
                />

                <CourseCompetencyPanel
                    category={selectedCategory}
                    competencies={competencies}
                    selectedWeights={currentWeights}
                    courses={currentCourses}
                    selectedCourse={selectedCourse}
                    onSelectCourse={setSelectedCourse}
                    onCompetencyChange={handleCompetencyChange}
                    onWeightChange={handleWeightChange}
                    onCreateCompetency={handleCreateCompetency}
                    onSaveCompetency={handleSaveCompetency}
                    onAddCourse={handleAddCourse}
                    onDeleteCourse={handleRequestDeleteCourse}
                    onDeleteCategory={handleRequestDeleteCategory}
                    onReorderCourses={handleReorderCourses}
                />
            </div>

            {showModal && (
                <TemplateFormModal onClose={() => setShowModal(false)} onSave={handleSaveTemplate} />
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