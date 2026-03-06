'use client';

import { useState, useCallback, useRef } from 'react';
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

// ลบ node และ children ทั้งหมดออกจาก tree แล้ว recode
function removeCategory(cats, id) {
    const filtered = cats.filter(c => c.id !== id);
    const withRemovedChildren = filtered.map(c => ({
        ...c,
        children: removeCategory(c.children || [], id),
    }));
    return recodeSiblings(withRemovedChildren);
}

// recode เฉพาะ siblings ในระดับเดียวกัน (ไม่ recode ทั้ง tree)
function recodeSiblings(cats, parentCode = '') {
    return cats.map((cat, index) => {
        const newCode = parentCode ? `${parentCode}.${index + 1}` : `${index + 1}`;
        return {
            ...cat,
            code: newCode,
            children: cat.children?.length > 0
                ? recodeSiblings(cat.children, newCode)
                : cat.children,
        };
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
    const parent = findById(cats, parentId);
    return parent?.children || [];
}

// ============================================================
// Main Page
// ============================================================
export default function TemplateManagementPage() {
    const [templates,    setTemplates]    = useState(MOCK_TEMPLATES);
    const [competencies, setCompetencies] = useState(MOCK_COMPETENCIES);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [showModal,    setShowModal]    = useState(false);

    // modal ยืนยันลบ — เก็บ category ที่รอลบ
    const [deletingCategory, setDeletingCategory] = useState(null);

    const [categoriesByTemplate, setCategoriesByTemplate] = useState(() => {
        const initial = {};
        MOCK_TEMPLATES.forEach(t => {
            initial[t.id] = JSON.parse(JSON.stringify(MOCK_CATEGORIES));
        });
        return initial;
    });

    const [weightsByTemplate, setWeightsByTemplate] = useState({});

    const idRef       = useRef(9000);
    const compIdRef   = useRef(8000);
    const templateRef = useRef(7000);

    const currentCategories = selectedTemplate
        ? (categoriesByTemplate[selectedTemplate.id] || [])
        : [];

    const currentCategoryWeights = selectedTemplate
        ? (weightsByTemplate[selectedTemplate.id] || {})
        : {};

    const currentWeights = selectedCategory
        ? (currentCategoryWeights[selectedCategory.id] || [])
        : [];

    const updateCurrentCategories = useCallback((updater) => {
        if (!selectedTemplate) return;
        setCategoriesByTemplate(prev => ({
            ...prev,
            [selectedTemplate.id]: typeof updater === 'function'
                ? updater(prev[selectedTemplate.id] || [])
                : updater,
        }));
    }, [selectedTemplate]);

    // ============================================================
    // Template Handlers
    // ============================================================
    const handleSelectTemplate = useCallback((t) => {
        setSelectedTemplate(t);
        setSelectedCategory(null);
    }, []);

    const handleDeleteTemplate = useCallback((id) => {
        // TODO (Backend): DELETE /api/templates/:id
        setTemplates(prev => prev.filter(t => t.id !== id));
        setCategoriesByTemplate(prev => { const n = { ...prev }; delete n[id]; return n; });
        setWeightsByTemplate(prev => { const n = { ...prev }; delete n[id]; return n; });
        setSelectedTemplate(prev => prev?.id === id ? null : prev);
        setSelectedCategory(null);
    }, []);

    const handleSaveTemplate = useCallback(({ name, year }) => {
        // TODO (Backend): POST /api/templates
        const newId = ++templateRef.current;
        setTemplates(prev => [...prev, { id: newId, name, year, courseCount: 0 }]);
        setCategoriesByTemplate(prev => ({ ...prev, [newId]: [] }));
        setShowModal(false);
    }, []);

    // ============================================================
    // Category Handlers
    // ============================================================
    const handleSelectCategory = useCallback((cat) => {
        setSelectedCategory(cat);
    }, []);

    const createCourseCategory = useCallback(() => {
        // TODO (Backend): POST /api/templates/:templateId/categories
        //   body: { name, code, requiredCredits, parentId }
        //   response: { id, name, code, requiredCredits, parentId, children: [] }
        const newId = ++idRef.current;
        let newCode = '';

        if (!selectedCategory) {
            const siblings = getDirectChildren(currentCategories, null);
            newCode = getNextCode('', siblings);
        } else {
            const parentDepth = getDepthFromCode(selectedCategory.code);
            if (parentDepth >= 2) {
                alert('ไม่สามารถสร้างหมวดวิชาที่ลึกกว่า 3 ระดับได้');
                return;
            }
            const siblings = getDirectChildren(currentCategories, selectedCategory.id);
            newCode = getNextCode(selectedCategory.code, siblings);
        }

        const newCategory = {
            id: newId, code: newCode, name: '',
            requiredCredits: 0, children: [], isNew: true,
        };

        if (!selectedCategory) {
            updateCurrentCategories(prev => [...prev, newCategory]);
        } else {
            updateCurrentCategories(prev => insertChild(prev, selectedCategory.id, newCategory));
        }
        setSelectedCategory(newCategory);
    }, [selectedCategory, currentCategories, updateCurrentCategories]);

    const handleRenameCategory = useCallback((id, newName) => {
        // TODO (Backend): PATCH /api/templates/:templateId/categories/:id
        //   body: { name: newName }
        updateCurrentCategories(prev => renameCategory(prev, id, newName));
    }, [updateCurrentCategories]);

    const handleReorder = useCallback((newCategories) => {
        // TODO (Backend): PATCH /api/templates/:templateId/categories/reorder
        //   body: { categories: newCategories }
        updateCurrentCategories(newCategories);
        setSelectedCategory(prev => {
            if (!prev) return null;
            return findById(newCategories, prev.id) || null;
        });
    }, [updateCurrentCategories]);

    // ---- Delete Category ----

    // กดปุ่มถังขยะ → เปิด modal (ยังไม่ลบจริง)
    const handleRequestDeleteCategory = useCallback((cat) => {
        setDeletingCategory(cat);
    }, []);

    // กดยืนยันใน modal → ลบจริง
    const handleConfirmDeleteCategory = useCallback(() => {
        if (!deletingCategory) return;

        // TODO (Backend): DELETE /api/templates/:templateId/categories/:id
        //   → ลบ category และ children ทั้งหมดที่อยู่ภายใน
        //   → recode categories ที่เหลือ แล้ว response กลับมาเป็น tree ใหม่
        updateCurrentCategories(prev => removeCategory(prev, deletingCategory.id));

        // clear selected ถ้าเป็น category ที่ลบ หรือ child ของมัน
        setSelectedCategory(prev => {
            if (!prev) return null;
            if (prev.id === deletingCategory.id) return null;
            // เช็คว่า selectedCategory อยู่ใน subtree ที่ถูกลบหรือเปล่า
            if (isDescendantOf(deletingCategory, prev.id)) return null;
            return prev;
        });

        setDeletingCategory(null);
    }, [deletingCategory, updateCurrentCategories]);

    // กดยกเลิกใน modal
    const handleCancelDeleteCategory = useCallback(() => {
        setDeletingCategory(null);
    }, []);

    // ============================================================
    // Competency Handlers
    // ============================================================
    const handleCompetencyChange = useCallback((newSelected) => {
        if (!selectedTemplate || !selectedCategory) return;
        setWeightsByTemplate(p => {
            const tw = p[selectedTemplate.id] || {};
            const prev = tw[selectedCategory.id] || [];
            const updated = newSelected.map(comp => {
                const existing = prev.find(w => w.competency.id === comp.id);
                return existing ?? { competency: comp, weight: 0 };
            });
            return { ...p, [selectedTemplate.id]: { ...tw, [selectedCategory.id]: updated } };
        });
    }, [selectedTemplate, selectedCategory]);

    const handleWeightChange = useCallback((compId, value) => {
        if (!selectedTemplate || !selectedCategory) return;
        setWeightsByTemplate(p => {
            const tw = p[selectedTemplate.id] || {};
            return {
                ...p,
                [selectedTemplate.id]: {
                    ...tw,
                    [selectedCategory.id]: (tw[selectedCategory.id] || []).map(w =>
                        w.competency.id === compId
                            ? { ...w, weight: Math.min(100, Math.max(0, Number(value) || 0)) }
                            : w
                    ),
                },
            };
        });
    }, [selectedTemplate, selectedCategory]);

    const handleCreateCompetency = useCallback((name) => {
        // TODO (Backend): POST /api/competencies
        //   body: { name, code }
        const newComp = { id: ++compIdRef.current, code: `custom_${compIdRef.current}`, name, color: '#7dd3fc' };
        setCompetencies(prev => [...prev, newComp]);
        return newComp;
    }, []);

    const handleSaveCompetency = useCallback(() => {
        // TODO (Backend): PUT /api/templates/:templateId/categories/:categoryId/competencies
        //   body: { weights: [{ competencyId, weight }] }
        console.log('save:', { templateId: selectedTemplate?.id, categoryId: selectedCategory?.id, weights: currentWeights });
        alert('บันทึก Competency เรียบร้อย (mock)');
    }, [selectedTemplate, selectedCategory, currentWeights]);

    const handleAddCourse = useCallback((data) => {
        // TODO (Backend): POST /api/templates/:templateId/categories/:categoryId/courses
        //   body: { code, nameTh, nameEn, credits }
        console.log('add course:', data);
        setTemplates(prev => prev.map(t =>
            t.id === selectedTemplate?.id ? { ...t, courseCount: t.courseCount + 1 } : t
        ));
    }, [selectedTemplate]);

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
                />

                <CourseCategoryTree
                    categories={currentCategories}
                    selectedId={selectedCategory?.id}
                    onSelect={handleSelectCategory}
                    onCreateCategory={createCourseCategory}
                    onRename={handleRenameCategory}
                    onReorder={handleReorder}
                    template={selectedTemplate}
                />

                <CourseCompetencyPanel
                    category={selectedCategory}
                    competencies={competencies}
                    selectedWeights={currentWeights}
                    onCompetencyChange={handleCompetencyChange}
                    onWeightChange={handleWeightChange}
                    onCreateCompetency={handleCreateCompetency}
                    onSaveCompetency={handleSaveCompetency}
                    onAddCourse={handleAddCourse}
                    onDeleteCategory={handleRequestDeleteCategory}
                />
            </div>

            {/* Modal สร้าง Template */}
            {showModal && (
                <TemplateFormModal
                    onClose={() => setShowModal(false)}
                    onSave={handleSaveTemplate}
                />
            )}

            {/* Modal ยืนยันลบหมวดวิชา — แสดงเฉพาะเมื่อกดปุ่มลบ */}
            {deletingCategory && (
                <ConfirmDeleteModal
                    category={deletingCategory}
                    onConfirm={handleConfirmDeleteCategory}
                    onCancel={handleCancelDeleteCategory}
                />
            )}
        </div>
    );
}

// ============================================================
// Helper — เช็คว่า node มี id นี้เป็น descendant หรือไม่
// ============================================================
function isDescendantOf(node, id) {
    if (!node?.children?.length) return false;
    return node.children.some(c => c.id === id || isDescendantOf(c, id));
}