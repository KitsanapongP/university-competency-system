'use client';

import React, { useState } from 'react';
import { Plus, ChevronRight, ChevronDown, BookOpen, Award, Trash2, Edit2, X, Check } from 'lucide-react';
import './TemplateManagement.css';

// ============================================================
// Mock Data (ลบออกเมื่อต่อ API จริง)
// ============================================================
const MOCK_TEMPLATES = [
    { id: 1, name: 'หลักสูตรวิทยาการคอมพิวเตอร์ 2568', year: 2568, courseCount: 42 },
    { id: 2, name: 'หลักสูตรวิศวกรรมซอฟต์แวร์ 2568', year: 2568, courseCount: 38 },
];

const MOCK_CATEGORIES = [
    {
        id: 1, code: '1', name: 'หมวดวิชาศึกษาทั่วไป', requiredCredits: 30,
        children: [
            { id: 11, code: '1.1', name: 'กลุ่มวิชาภาษา', requiredCredits: 9, children: [] },
            { id: 12, code: '1.2', name: 'กลุ่มวิชามนุษยศาสตร์และสังคมศาสตร์', requiredCredits: 9, children: [] },
            { id: 13, code: '1.3', name: 'กลุ่มวิชาคณิตศาสตร์และวิทยาศาสตร์', requiredCredits: 12, children: [] },
        ]
    },
    {
        id: 2, code: '2', name: 'หมวดวิชาเฉพาะ', requiredCredits: 96,
        children: [
            {
                id: 21, code: '2.1', name: 'หมวดวิชาพื้นฐานหรือวิชาแกน', requiredCredits: 36,
                children: [
                    { id: 211, code: '2.1.1', name: 'กลุ่มวิชาบังคับพื้นฐานวิชาชีพ', requiredCredits: 30, children: [] },
                    { id: 212, code: '2.1.2', name: 'กลุ่มวิชาบังคับสัมมนาและฝึกงาน', requiredCredits: 6, children: [] },
                ]
            },
            {
                id: 22, code: '2.2', name: 'หมวดวิชาเฉพาะด้าน', requiredCredits: 42,
                children: [
                    { id: 221, code: '2.2.1', name: 'กลุ่มวิชาประเด็นด้านองค์การและระบบสารสนเทศ', requiredCredits: 9, children: [] },
                    { id: 222, code: '2.2.2', name: 'กลุ่มวิชาเทคโนโลยีเพื่องานประยุกต์', requiredCredits: 9, children: [] },
                    { id: 223, code: '2.2.3', name: 'กลุ่มวิชาเทคโนโลยีและวิธีการทางซอฟต์แวร์', requiredCredits: 9, children: [] },
                ]
            },
        ]
    },
    {
        id: 3, code: '3', name: 'หมวดวิชาเลือกเสรี', requiredCredits: 6,
        children: []
    },
];

const MOCK_COMPETENCIES = [
    { id: 1, code: 'tst_comm', name: 'การสื่อสาร' },
    { id: 2, code: 'tst_ct', name: 'คิดเชิงวิพากษ์' },
    { id: 3, code: 'tst_team', name: 'ทำงานเป็นทีม' },
    { id: 4, code: 'tst_lead', name: 'ภาวะผู้นำ' },
    { id: 5, code: 'tst_ethic', name: 'คุณธรรมจริยธรรม' },
    { id: 6, code: 'tst_digi', name: 'ทักษะดิจิทัล' },
];

// ============================================================
// Sub Components
// ============================================================

// --- Category Tree Item (Recursive) ---
function CategoryTreeItem({ category, depth = 0, selectedId, onSelect }) {
    const [expanded, setExpanded] = useState(depth === 0);
    const hasChildren = category.children?.length > 0;
    const isSelected = selectedId === category.id;

    return (
        <div className="tree-item-wrapper">
            <div
                className={`tree-item ${isSelected ? 'tree-item--selected' : ''}`}
                style={{ paddingLeft: `${12 + depth * 16}px` }}
                onClick={() => onSelect(category)}
            >
                <button
                    className="tree-toggle"
                    onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                >
                    {hasChildren
                        ? (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)
                        : <span style={{ width: 14 }} />
                    }
                </button>
                <span className="tree-code">{category.code}</span>
                <span className="tree-name">{category.name}</span>
                <span className="tree-credits">{category.requiredCredits} หน่วยกิต</span>
            </div>
            {hasChildren && expanded && (
                <div className="tree-children">
                    {category.children.map(child => (
                        <CategoryTreeItem
                            key={child.id}
                            category={child}
                            depth={depth + 1}
                            selectedId={selectedId}
                            onSelect={onSelect}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// --- Template Form Modal ---
function TemplateFormModal({ onClose, onSave }) {
    const [name, setName] = useState('');
    const [year, setYear] = useState(2568);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>สร้าง Template ใหม่</h3>
                    <button className="modal-close" onClick={onClose}><X size={18} /></button>
                </div>
                <div className="modal-body">
                    <label className="form-label">ชื่อ Template</label>
                    <input
                        className="form-input"
                        placeholder="เช่น หลักสูตรวิทยาการคอมพิวเตอร์ 2568"
                        value={name}
                        onChange={e => setName(e.target.value)}
                    />
                    <label className="form-label" style={{ marginTop: '1rem' }}>ปีการศึกษา (พ.ศ.)</label>
                    <input
                        className="form-input"
                        type="number"
                        value={year}
                        onChange={e => setYear(Number(e.target.value))}
                    />
                </div>
                <div className="modal-footer">
                    <button className="btn btn--ghost" onClick={onClose}>ยกเลิก</button>
                    <button className="btn btn--primary" onClick={() => onSave({ name, year })}>
                        <Check size={16} /> บันทึก
                    </button>
                </div>
            </div>
        </div>
    );
}

// ============================================================
// Main Page
// ============================================================
export default function TemplateManagementPage() {
    const [templates, setTemplates] = useState(MOCK_TEMPLATES);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [showModal, setShowModal] = useState(false);

    // Competency weights สำหรับ category ที่เลือก (mock)
    const [weights, setWeights] = useState({});

    const handleSaveTemplate = ({ name, year }) => {
        if (!name.trim()) return;
        const newTemplate = { id: Date.now(), name, year, courseCount: 0 };
        setTemplates(prev => [...prev, newTemplate]);
        setShowModal(false);
    };

    const handleDeleteTemplate = (id) => {
        setTemplates(prev => prev.filter(t => t.id !== id));
        if (selectedTemplate?.id === id) setSelectedTemplate(null);
    };

    const handleWeightChange = (competencyId, value) => {
        setWeights(prev => ({ ...prev, [competencyId]: value }));
    };

    return (
        <div className="tm-page">
            {/* Header */}
            <div className="tm-header">
                <div className="tm-header__title">
                    <BookOpen size={22} />
                    <h1>จัดการ Template หลักสูตร</h1>
                </div>
                <button className="btn btn--primary" onClick={() => setShowModal(true)}>
                    <Plus size={16} /> สร้าง Template ใหม่
                </button>
            </div>

            {/* 3 Panel Layout */}
            <div className="tm-panels">

                {/* Panel 1 — Template List */}
                <div className="tm-panel tm-panel--list">
                    <div className="panel-header">
                        <h2>Template ทั้งหมด</h2>
                        <span className="panel-badge">{templates.length}</span>
                    </div>
                    <div className="template-list">
                        {templates.map(t => (
                            <div
                                key={t.id}
                                className={`template-item ${selectedTemplate?.id === t.id ? 'template-item--selected' : ''}`}
                                onClick={() => { setSelectedTemplate(t); setSelectedCategory(null); }}
                            >
                                <div className="template-item__info">
                                    <span className="template-item__name">{t.name}</span>
                                    <span className="template-item__meta">ปี {t.year} · {t.courseCount} วิชา</span>
                                </div>
                                <button
                                    className="icon-btn icon-btn--danger"
                                    onClick={e => { e.stopPropagation(); handleDeleteTemplate(t.id); }}
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                        {templates.length === 0 && (
                            <div className="panel-empty">ยังไม่มี Template</div>
                        )}
                    </div>
                </div>

                {/* Panel 2 — Category Tree */}
                <div className="tm-panel tm-panel--tree">
                    <div className="panel-header">
                        <h2>หมวดวิชา</h2>
                        {selectedTemplate && (
                            <span className="panel-badge--template">{selectedTemplate.name}</span>
                        )}
                    </div>
                    {!selectedTemplate ? (
                        <div className="panel-empty">เลือก Template ก่อน</div>
                    ) : (
                        <div className="category-tree">
                            {MOCK_CATEGORIES.map(cat => (
                                <CategoryTreeItem
                                    key={cat.id}
                                    category={cat}
                                    selectedId={selectedCategory?.id}
                                    onSelect={setSelectedCategory}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Panel 3 — Course + Competency */}
                <div className="tm-panel tm-panel--detail">
                    <div className="panel-header">
                        <h2>รายวิชา & Competency</h2>
                        {selectedCategory && (
                            <span className="panel-badge--category">{selectedCategory.code} {selectedCategory.name}</span>
                        )}
                    </div>
                    {!selectedCategory ? (
                        <div className="panel-empty">เลือกหมวดวิชาก่อน</div>
                    ) : (
                        <div className="detail-body">
                            {/* Add Course Form */}
                            <div className="detail-section">
                                <h3 className="detail-section__title">เพิ่มรายวิชา</h3>
                                <div className="course-form">
                                    <input className="form-input" placeholder="รหัสวิชา เช่น CP351001" />
                                    <input className="form-input" placeholder="ชื่อวิชาภาษาไทย" />
                                    <input className="form-input" placeholder="ชื่อวิชาภาษาอังกฤษ" />
                                    <input className="form-input" type="number" placeholder="หน่วยกิต" min={1} max={6} />
                                    <button className="btn btn--primary btn--sm">
                                        <Plus size={14} /> เพิ่มวิชา
                                    </button>
                                </div>
                            </div>

                            {/* Competency Weight */}
                            <div className="detail-section">
                                <h3 className="detail-section__title">
                                    <Award size={16} /> ผูก Competency + Weight (%)
                                </h3>
                                <div className="competency-list">
                                    {MOCK_COMPETENCIES.map(comp => (
                                        <div key={comp.id} className="competency-row">
                                            <span className="competency-name">{comp.name}</span>
                                            <div className="competency-weight">
                                                <input
                                                    className="weight-input"
                                                    type="number"
                                                    min={0}
                                                    max={100}
                                                    placeholder="0"
                                                    value={weights[comp.id] || ''}
                                                    onChange={e => handleWeightChange(comp.id, e.target.value)}
                                                />
                                                <span className="weight-unit">%</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="weight-total">
                                    รวม: {Object.values(weights).reduce((sum, v) => sum + (Number(v) || 0), 0)}%
                                    {Object.values(weights).reduce((sum, v) => sum + (Number(v) || 0), 0) > 100 && (
                                        <span className="weight-error"> (เกิน 100%)</span>
                                    )}
                                </div>
                                <button className="btn btn--primary btn--sm" style={{ marginTop: '1rem' }}>
                                    <Check size={14} /> บันทึก Competency
                                </button>
                            </div>
                        </div>
                    )}
                </div>
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