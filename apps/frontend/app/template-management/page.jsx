'use client';

import { useState } from 'react';
import { MOCK_TEMPLATES, MOCK_COMPETENCIES, MOCK_CATEGORIES } from './mockData';
import TemplateList        from './components/TemplateList';
import CourseCategoryTree  from './components/CourseCategoryTree';
import CourseCompetencyPanel from './components/CourseCompetencyPanel';
import TemplateFormModal   from './components/TemplateFormModal';
import './TemplateManagement.css';

export default function TemplateManagementPage() {
    // ---- State ----
    const [templates,    setTemplates]    = useState(MOCK_TEMPLATES);
    const [competencies, setCompetencies] = useState(MOCK_COMPETENCIES);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [showModal, setShowModal] = useState(false);

    // เพิ่ม state สำหรับ categories (ย้ายออกจาก MOCK_CATEGORIES)
    const [categories, setCategories] = useState(MOCK_CATEGORIES);

    // เก็บ weights แยกตาม categoryId → [{ competency, weight }]
    const [categoryWeights, setCategoryWeights] = useState({});

    // weights ของ category ที่เลือกอยู่ตอนนี้
    const currentWeights = selectedCategory
        ? (categoryWeights[selectedCategory.id] || [])
        : [];

    // ---- Template Handlers ----
    const handleSelectTemplate = (t) => {
        setSelectedTemplate(t);
        setSelectedCategory(null);
    };

    const handleDeleteTemplate = (id) => {
        setTemplates(prev => prev.filter(t => t.id !== id));
        if (selectedTemplate?.id === id) {
            setSelectedTemplate(null);
            setSelectedCategory(null);
        }
    };

    const handleSaveTemplate = ({ name, year }) => {
        setTemplates(prev => [
            ...prev,
            { id: Date.now(), name, year, courseCount: 0 },
        ]);
        setShowModal(false);
    };

    // ---- Category Handlers ----
    const handleSelectCategory = (cat) => {
        setSelectedCategory(cat);
    };

    // ---- Competency Handlers ----

    // TagInput เปลี่ยน → sync weights (คง weight เดิมถ้ามี)
    const handleCompetencyChange = (newSelected) => {
        if (!selectedCategory) return;
        const prev = categoryWeights[selectedCategory.id] || [];
        const updated = newSelected.map(comp => {
            const existing = prev.find(w => w.competency.id === comp.id);
            return existing ?? { competency: comp, weight: 0 };
        });
        setCategoryWeights(p => ({ ...p, [selectedCategory.id]: updated }));
    };

    // กรอก weight ของ competency ตัวใดตัวหนึ่ง
    const handleWeightChange = (compId, value) => {
        if (!selectedCategory) return;
        setCategoryWeights(p => ({
            ...p,
            [selectedCategory.id]: (p[selectedCategory.id] || []).map(w =>
                w.competency.id === compId
                    ? { ...w, weight: Math.min(100, Math.max(0, Number(value) || 0)) }
                    : w
            ),
        }));
    };

    // สร้าง Competency ใหม่จาก TagInput
    const handleCreateCompetency = (name) => {
        const newComp = {
            id: Date.now(),
            code: `custom_${Date.now()}`,
            name,
            color: '#7dd3fc',
        };
        setCompetencies(prev => [...prev, newComp]);
        return newComp;
    };

    // บันทึก Competency (TODO: ต่อ API)
    const handleSaveCompetency = () => {
        console.log('save competency weights:', currentWeights);
        alert('บันทึก Competency เรียบร้อย (mock)');
    };

    // เพิ่มรายวิชา (TODO: ต่อ API)
    const handleAddCourse = (data) => {
        console.log('add course:', data);
        setTemplates(prev => prev.map(t =>
            t.id === selectedTemplate?.id
                ? { ...t, courseCount: t.courseCount + 1 }
                : t
        ));
    };

    // ---- สร้างหมวดวิชาใหม่ ----
    const createCourseCategory = (templateId) => {
        const newCategory = {
            id: Date.now(),
            code: '',           // ให้กรอกทีหลัง หรือ auto generate
            name: 'หมวดใหม่',  // ชื่อ default → ให้ rename ทีหลัง
            requiredCredits: 0,
            children: [],
            isNew: true,        // flag สำหรับ auto focus เพื่อให้ rename ทันที
        };

        if (!selectedCategory) {
            // ไม่มีเลือก → เพิ่มเป็น root
            setCategories(prev => [...prev, newCategory]);
        } else {
            // มีเลือก → เพิ่มเป็น child ของที่เลือก
            setCategories(prev => insertChild(prev, selectedCategory.id, newCategory));
        }

        setSelectedCategory(newCategory);
    };
    
    // recursive helper — หา parent แล้วแทรก child
    function insertChild(categories, parentId, newChild) {
        return categories.map(cat => {
            if (cat.id === parentId) {
                return { ...cat, children: [...cat.children, newChild] };
            }
            if (cat.children?.length > 0) {
                return { ...cat, children: insertChild(cat.children, parentId, newChild) };
            }
            return cat;
        });
    }

    const handleRenameCategory = (id, newName) => {
        setCategories(prev => renameCategory(prev, id, newName));
    };

    function renameCategory(categories, id, newName) {
        return categories.map(cat => {
            if (cat.id === id) return { ...cat, name: newName, isNew: false };
            if (cat.children?.length > 0) {
                return { ...cat, children: renameCategory(cat.children, id, newName) };
            }
            return cat;
        });
    }

    return (
        <div className="tm-page">
            {/* Header */}
            <div className="tm-header">
                <h1 className="tm-header__title">จัดการ Template หลักสูตร</h1>
            </div>

            {/* 3 Panel Layout */}
            <div className="tm-panels">

                {/* Panel 1 */}
                <TemplateList
                    templates={templates}
                    selectedId={selectedTemplate?.id}
                    onSelect={handleSelectTemplate}
                    onDelete={handleDeleteTemplate}
                    onClickCreate={() => setShowModal(true)}
                />

                {/* Panel 2 */}
                <CourseCategoryTree
                    categories={categories}
                    selectedId={selectedCategory?.id}
                    onCreateCategory={createCourseCategory} 
                    onRename={handleRenameCategory}         
                    template={selectedTemplate}
                />

                {/* Panel 3 */}
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

            {/* Modal */}
            {showModal && (
                <TemplateFormModal
                    onClose={() => setShowModal(false)}
                    onSave={handleSaveTemplate}
                />
            )}
        </div>
    );
}