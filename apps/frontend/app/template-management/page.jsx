'use client';

import { useState, useCallback, useRef } from 'react';
import { MOCK_TEMPLATES, MOCK_COMPETENCIES, MOCK_CATEGORIES } from './mockData';
import TemplateList          from './components/TemplateList';
import CourseCategoryTree, { getNextCode, getDepthFromCode } from './components/CourseCategoryTree';
import CourseCompetencyPanel from './components/CourseCompetencyPanel';
import TemplateFormModal     from './components/TemplateFormModal';
import './TemplateManagement.css';

// ============================================================
// Pure recursive helpers (ไว้นอก component เพื่อไม่ recreate)
// ============================================================

// แทรก child เข้า parent ที่ตรงกับ parentId
function insertChild(cats, parentId, newChild) {
    return cats.map(cat => {
        if (cat.id === parentId) {
            return { ...cat, children: [...(cat.children || []), newChild] };
        }
        if (cat.children?.length > 0) {
            return { ...cat, children: insertChild(cat.children, parentId, newChild) };
        }
        return cat;
    });
}

// rename category ด้วย id
function renameCategory(cats, id, newName) {
    return cats.map(cat => {
        if (cat.id === id) return { ...cat, name: newName, isNew: false };
        if (cat.children?.length > 0) {
            return { ...cat, children: renameCategory(cat.children, id, newName) };
        }
        return cat;
    });
}

// หา category จาก id (recursive)
function findById(cats, id) {
    for (const cat of cats) {
        if (cat.id === id) return cat;
        const found = findById(cat.children || [], id);
        if (found) return found;
    }
    return null;
}

// ลบ category ออกจาก tree
function removeById(cats, id) {
    return cats
        .filter(cat => cat.id !== id)
        .map(cat => ({
            ...cat,
            children: removeById(cat.children || [], id),
        }));
}

// ย้าย sourceId ไปเป็น child ของ targetId (null = root level)
function moveCategory(cats, sourceId, targetId) {
    const source = findById(cats, sourceId);
    if (!source) return cats;

    // ลบออกจากที่เดิม
    let result = removeById(cats, sourceId);

    if (targetId === null) {
        // ย้ายไป root level
        result = [...result, source];
    } else {
        // ย้ายเป็น child ของ target
        result = insertChild(result, targetId, source);
    }
    return result;
}

// หา children โดยตรงของ parentId (หรือ root ถ้า parentId = null)
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
    const [categories,   setCategories]   = useState(MOCK_CATEGORIES);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [showModal,    setShowModal]    = useState(false);
    const [categoryWeights, setCategoryWeights] = useState({});

    // id counters
    const idRef       = useRef(9000);
    const compIdRef   = useRef(8000);
    const templateRef = useRef(7000);

    const currentWeights = selectedCategory
        ? (categoryWeights[selectedCategory.id] || [])
        : [];

    // ---- Template ----
    const handleSelectTemplate = useCallback((t) => {
        setSelectedTemplate(t);
        setSelectedCategory(null);
    }, []);

    const handleDeleteTemplate = useCallback((id) => {
        setTemplates(prev => prev.filter(t => t.id !== id));
        setSelectedTemplate(prev => prev?.id === id ? null : prev);
        setSelectedCategory(null);
    }, []);

    const handleSaveTemplate = useCallback(({ name, year }) => {
        const newId = ++templateRef.current;
        setTemplates(prev => [...prev, { id: newId, name, year, courseCount: 0 }]);
        setShowModal(false);
    }, []);

    // ---- Category ----
    const handleSelectCategory = useCallback((cat) => {
        setSelectedCategory(cat);
    }, []);

    const createCourseCategory = useCallback(() => {
        const newId = ++idRef.current;

        // คำนวณ code อัตโนมัติ
        let newCode = '';
        let parentDepth = 0;

        if (!selectedCategory) {
            // root level
            const siblings = getDirectChildren(categories, null);
            newCode = getNextCode('', siblings);
            parentDepth = 0;
        } else {
            parentDepth = getDepthFromCode(selectedCategory.code);

            // จำกัดแค่ depth 2 (เช่น 1.1.1) ไม่ให้ลึกกว่านี้
            if (parentDepth >= 2) {
                alert('ไม่สามารถสร้างหมวดวิชาที่ลึกกว่า 3 ระดับได้');
                return;
            }

            const siblings = getDirectChildren(categories, selectedCategory.id);
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
            setCategories(prev => [...prev, newCategory]);
        } else {
            setCategories(prev => insertChild(prev, selectedCategory.id, newCategory));
        }

        setSelectedCategory(newCategory);
    }, [selectedCategory, categories]);

    const handleRenameCategory = useCallback((id, newName) => {
        setCategories(prev => renameCategory(prev, id, newName));
    }, []);

    const handleMoveCategory = useCallback((sourceId, targetId) => {
        if (!sourceId) return;
        setCategories(prev => moveCategory(prev, sourceId, targetId));
    }, []);

    // ---- Competency ----
    const handleCompetencyChange = useCallback((newSelected) => {
        if (!selectedCategory) return;
        setCategoryWeights(p => {
            const prev = p[selectedCategory.id] || [];
            const updated = newSelected.map(comp => {
                const existing = prev.find(w => w.competency.id === comp.id);
                return existing ?? { competency: comp, weight: 0 };
            });
            return { ...p, [selectedCategory.id]: updated };
        });
    }, [selectedCategory]);

    const handleWeightChange = useCallback((compId, value) => {
        if (!selectedCategory) return;
        setCategoryWeights(p => ({
            ...p,
            [selectedCategory.id]: (p[selectedCategory.id] || []).map(w =>
                w.competency.id === compId
                    ? { ...w, weight: Math.min(100, Math.max(0, Number(value) || 0)) }
                    : w
            ),
        }));
    }, [selectedCategory]);

    const handleCreateCompetency = useCallback((name) => {
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
        console.log('save competency weights:', currentWeights);
        alert('บันทึก Competency เรียบร้อย (mock)');
    }, [currentWeights]);

    const handleAddCourse = useCallback((data) => {
        console.log('add course:', data);
        setTemplates(prev => prev.map(t =>
            t.id === selectedTemplate?.id
                ? { ...t, courseCount: t.courseCount + 1 }
                : t
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
                    categories={categories}
                    selectedId={selectedCategory?.id}
                    onSelect={handleSelectCategory}
                    onCreateCategory={createCourseCategory}
                    onRename={handleRenameCategory}
                    onMoveCategory={handleMoveCategory}
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