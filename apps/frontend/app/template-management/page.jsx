'use client';

import { useState, useCallback, useRef } from 'react';
import { MOCK_TEMPLATES, MOCK_COMPETENCIES, MOCK_CATEGORIES } from './mockData';
import TemplateList          from './components/TemplateList';
import CourseCategoryTree, { getNextCode, getDepthFromCode } from './components/CourseCategoryTree';
import CourseCompetencyPanel from './components/CourseCompetencyPanel';
import TemplateFormModal     from './components/TemplateFormModal';
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

    // ============================================================
    // categoriesByTemplate — แยก categories ตาม templateId
    // { [templateId]: Category[] }
    //
    // TODO (Backend): GET /api/templates/:id/categories
    //   → ดึง categories ของ template นั้นมาแสดง
    //   → ตอนนี้ใช้ MOCK_CATEGORIES เป็น default สำหรับทุก template ใหม่
    // ============================================================
    const [categoriesByTemplate, setCategoriesByTemplate] = useState(() => {
        // สร้าง initial state: แต่ละ template ได้รับ MOCK_CATEGORIES copy ของตัวเอง
        const initial = {};
        MOCK_TEMPLATES.forEach(t => {
            // deep clone เพื่อไม่ให้ reference เดียวกัน
            initial[t.id] = JSON.parse(JSON.stringify(MOCK_CATEGORIES));
        });
        return initial;
    });

    // ============================================================
    // categoryWeights — แยกตาม templateId → categoryId
    // { [templateId]: { [categoryId]: CompetencyWeight[] } }
    //
    // TODO (Backend): GET /api/templates/:id/categories/:catId/competencies
    //   → ดึง competency weights ของ category นั้น
    // ============================================================
    const [weightsByTemplate, setWeightsByTemplate] = useState({});

    const idRef       = useRef(9000);
    const compIdRef   = useRef(8000);
    const templateRef = useRef(7000);

    // categories และ weights ของ template ที่เลือกอยู่ตอนนี้
    const currentCategories = selectedTemplate
        ? (categoriesByTemplate[selectedTemplate.id] || [])
        : [];

    const currentCategoryWeights = selectedTemplate
        ? (weightsByTemplate[selectedTemplate.id] || {})
        : {};

    const currentWeights = selectedCategory
        ? (currentCategoryWeights[selectedCategory.id] || [])
        : [];

    // ---- helper: อัปเดต categories ของ template ที่เลือกอยู่ ----
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
        setCategoriesByTemplate(prev => {
            const next = { ...prev };
            delete next[id];
            return next;
        });
        setWeightsByTemplate(prev => {
            const next = { ...prev };
            delete next[id];
            return next;
        });
        setSelectedTemplate(prev => prev?.id === id ? null : prev);
        setSelectedCategory(null);
    }, []);

    const handleSaveTemplate = useCallback(({ name, year }) => {
        // TODO (Backend): POST /api/templates
        //   body: { name, year }
        //   response: { id, name, year, courseCount: 0 }
        const newId = ++templateRef.current;
        setTemplates(prev => [...prev, { id: newId, name, year, courseCount: 0 }]);

        // สร้าง categories ว่างๆ สำหรับ template ใหม่
        // TODO (Backend): ไม่ต้อง init เอง → ดึงจาก API แทน
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
            if (parentDepth >= 3) {
                alert('ไม่สามารถสร้างหมวดวิชาที่ลึกกว่า 3 ระดับได้');
                return;
            }
            const siblings = getDirectChildren(currentCategories, selectedCategory.id);
            newCode = getNextCode(selectedCategory.code, siblings);
        }

        const newCategory = {
            id: newId,
            code: newCode,
            name: '',
            requiredCredits: 0,
            children: [],
            isNew: true,
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
        //   body: { categories: newCategories } → ส่ง tree ทั้งหมดที่ recode แล้ว
        //   หรือแยกเป็น: { moves: [{ id, newParentId, newIndex, newCode }] }
        updateCurrentCategories(newCategories);
        setSelectedCategory(prev => {
            if (!prev) return null;
            return findById(newCategories, prev.id) || null;
        });
    }, [updateCurrentCategories]);

    // ============================================================
    // Competency Handlers
    // ============================================================
    const handleCompetencyChange = useCallback((newSelected) => {
        if (!selectedTemplate || !selectedCategory) return;
        setWeightsByTemplate(p => {
            const templateWeights = p[selectedTemplate.id] || {};
            const prev = templateWeights[selectedCategory.id] || [];
            const updated = newSelected.map(comp => {
                const existing = prev.find(w => w.competency.id === comp.id);
                return existing ?? { competency: comp, weight: 0 };
            });
            return {
                ...p,
                [selectedTemplate.id]: {
                    ...templateWeights,
                    [selectedCategory.id]: updated,
                },
            };
        });
    }, [selectedTemplate, selectedCategory]);

    const handleWeightChange = useCallback((compId, value) => {
        if (!selectedTemplate || !selectedCategory) return;
        setWeightsByTemplate(p => {
            const templateWeights = p[selectedTemplate.id] || {};
            const catWeights = templateWeights[selectedCategory.id] || [];
            return {
                ...p,
                [selectedTemplate.id]: {
                    ...templateWeights,
                    [selectedCategory.id]: catWeights.map(w =>
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
        //   response: { id, name, code, color }
        const newComp = {
            id: ++compIdRef.current,
            code: `custom_${compIdRef.current}`,
            name,
            color: '#7dd3fc',
        };
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
        console.log('add course:', { templateId: selectedTemplate?.id, categoryId: selectedCategory?.id, ...data });
        setTemplates(prev => prev.map(t =>
            t.id === selectedTemplate?.id ? { ...t, courseCount: t.courseCount + 1 } : t
        ));
    }, [selectedTemplate, selectedCategory]);

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
                />
            </div>

            {showModal && (
                <TemplateFormModal
                    onClose={() => setShowModal(false)}
                    onSave={handleSaveTemplate}
                />
            )}
        </div>
    );
}