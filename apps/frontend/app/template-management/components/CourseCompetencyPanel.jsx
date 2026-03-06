'use client';

import { useState } from 'react';
import { BinaryIcon, Pencil, PencilIcon, Plus, Trash, Trash2 } from 'lucide-react';
import CompetencyWeightForm from './CompetencyWeightForm';

/**
 * CourseCompetencyPanel — Panel 3
 * Form เพิ่มรายวิชา + ผูก Competency + Weight
 *
 * Props:
 *   category            — category ที่เลือกอยู่
 *   competencies        — รายการ competency ทั้งหมด
 *   selectedWeights     — [{ competency, weight }] ของ category นี้
 *   onCompetencyChange  — เมื่อ tag เปลี่ยน
 *   onWeightChange      — เมื่อกรอก weight
 *   onCreateCompetency  — สร้าง competency ใหม่
 *   onSaveCompetency    — บันทึก competency
 *   onAddCourse(data)   — เพิ่มวิชาใหม่
 */
export default function CourseCompetencyPanel({
    category,
    competencies = [],
    selectedWeights = [],
    onCompetencyChange,
    onWeightChange,
    onCreateCompetency,
    onSaveCompetency,
    onAddCourse,
}) {
    const [courseForm, setCourseForm] = useState({
        code: '', nameTh: '', nameEn: '', credits: '',
    });

    const handleAddCourse = () => {
        if (!courseForm.code.trim() || !courseForm.nameTh.trim()) return;
        onAddCourse({ ...courseForm, credits: Number(courseForm.credits) || 3 });
        setCourseForm({ code: '', nameTh: '', nameEn: '', credits: '' });
    };

    return (
        <div className="tm-panel tm-panel--detail">
            {/* Panel Header */}
            <div className="panel-header">
                <h2>รายวิชา & Competency</h2>
                {category && (
                    <span className="panel-badge--category" title={category.name}>
                        {category.code} {category.name}
                    </span>
                )}
                <button className="icon-btn icon-btn--danger" title="ลบหมวดวิชา" >
                    <Trash2 size={14} />
                </button>
            </div>
                
            {/* Body */}
            {!category ? (
                <div className="panel-empty">เลือกหมวดวิชาก่อน</div>
            ) : (
                <div className="detail-body">

                    {/* เพิ่มรายวิชา */}
                    <div className="detail-section">
                        <h3 className="detail-section__title">เพิ่มรายวิชา</h3>
                        <div className="course-form">
                            <input
                                className="form-input"
                                placeholder="รหัสวิชา เช่น CP351001"
                                value={courseForm.code}
                                onChange={e => setCourseForm(p => ({ ...p, code: e.target.value }))}
                            />
                            <input
                                className="form-input"
                                placeholder="ชื่อวิชาภาษาไทย"
                                value={courseForm.nameTh}
                                onChange={e => setCourseForm(p => ({ ...p, nameTh: e.target.value }))}
                            />
                            <input
                                className="form-input"
                                placeholder="ชื่อวิชาภาษาอังกฤษ"
                                value={courseForm.nameEn}
                                onChange={e => setCourseForm(p => ({ ...p, nameEn: e.target.value }))}
                            />
                            <input
                                className="form-input"
                                type="number"
                                placeholder="หน่วยกิต"
                                min={1} max={6}
                                value={courseForm.credits}
                                onChange={e => setCourseForm(p => ({ ...p, credits: e.target.value }))}
                            />
                            <button className="btn btn--primary btn--sm" onClick={handleAddCourse}>
                                <Plus size={14} /> เพิ่มวิชา
                            </button>
                        </div>
                    </div>

                    {/* Competency + Weight */}
                    <CompetencyWeightForm
                        competencies={competencies}
                        selectedWeights={selectedWeights}
                        onCompetencyChange={onCompetencyChange}
                        onWeightChange={onWeightChange}
                        onCreateCompetency={onCreateCompetency}
                        onSave={onSaveCompetency}
                    />
                </div>
            )}
        </div>
    );
}