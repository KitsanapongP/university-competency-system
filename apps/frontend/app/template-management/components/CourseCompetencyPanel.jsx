'use client';

import { useState, useRef } from 'react';
import { Plus, Trash2, AlertCircle, GripVertical } from 'lucide-react';
import CompetencyWeightForm from './CompetencyWeightForm';

// ============================================================
// SortableCourseItem — drag to reorder ใน Panel 3
// ============================================================
function SortableCourseItem({ course, index, isSelected, onSelect, onDelete, onReorder }) {
    const [dragOver, setDragOver] = useState(null); // 'before' | 'after'
    const itemRef = useRef(null);
    const dragIdxRef = useRef(null);

    const handleDragStart = (e) => {
        dragIdxRef.current = index;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('courseIndex', String(index));
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        const rect = itemRef.current?.getBoundingClientRect();
        if (!rect) return;
        const y = e.clientY - rect.top;
        setDragOver(y < rect.height / 2 ? 'before' : 'after');
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const fromIdx = parseInt(e.dataTransfer.getData('courseIndex'), 10);
        if (isNaN(fromIdx) || fromIdx === index) { setDragOver(null); return; }
        const toIdx = dragOver === 'before' ? index : index + 1;
        onReorder(fromIdx, toIdx);
        setDragOver(null);
    };

    return (
        <div className="sortable-course-wrapper">
            {dragOver === 'before' && <div className="course-drop-indicator" />}
            <div
                ref={itemRef}
                className={`course-panel-item ${isSelected ? 'course-panel-item--selected' : ''}`}
                draggable
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragLeave={() => setDragOver(null)}
                onDrop={handleDrop}
                onClick={() => onSelect(course)}
            >
                <span className="course-panel-item__grip">
                    <GripVertical size={13} />
                </span>
                <div className="course-panel-item__info">
                    <span className="course-panel-item__code">{course.code}</span>
                    <span className="course-panel-item__name">{course.nameTh}</span>
                </div>
                <span className="course-panel-item__credits">{course.credits} หน่วยกิต</span>
                <button
                    className="icon-btn icon-btn--danger icon-btn--xs"
                    onClick={e => { e.stopPropagation(); onDelete(course.id); }}
                    title="ลบรายวิชา"
                >
                    <Trash2 size={13} />
                </button>
            </div>
            {dragOver === 'after' && <div className="course-drop-indicator" />}
        </div>
    );
}

// ============================================================
// CourseCompetencyPanel — Panel 3
// ============================================================
export default function CourseCompetencyPanel({
    category,
    competencies = [],
    selectedWeights = [],
    courses = [],
    selectedCourse,
    onSelectCourse,
    onCompetencyChange,
    onWeightChange,
    onCreateCompetency,
    onSaveCompetency,
    onAddCourse,
    onDeleteCourse,
    onDeleteCategory,
    onReorderCourses,   // (fromIdx, toIdx) → จัดลำดับใหม่
}) {
    const [courseForm, setCourseForm] = useState({
        code: '', nameTh: '', nameEn: '', credits: '',
    });

    const isLeaf = category && !category.children?.length;

    const handleAddCourse = () => {
        if (!courseForm.code.trim() || !courseForm.nameTh.trim()) return;
        onAddCourse({ ...courseForm, credits: Number(courseForm.credits) || 3 });
        setCourseForm({ code: '', nameTh: '', nameEn: '', credits: '' });
    };

    return (
        <div className="tm-panel tm-panel--detail">

            {/* Header */}
            <div className="panel-header">
                <h2>รายวิชา & Competency</h2>
                {category && (
                    <>
                        <span className="panel-badge--category" title={category.name}>
                            {category.code} {category.name}
                        </span>
                        <button
                            className="icon-btn icon-btn--danger"
                            title="ลบหมวดวิชานี้"
                            onClick={() => onDeleteCategory(category)}
                        >
                            <Trash2 size={15} />
                        </button>
                    </>
                )}
            </div>

            {/* Body */}
            {!category ? (
                <div className="panel-empty">เลือกหมวดวิชาก่อน</div>
            ) : (
                <div className="detail-body">

                    {/* เพิ่มรายวิชา */}
                    <div className="detail-section">
                        <h3 className="detail-section__title"><Plus size={14} /> เพิ่มรายวิชา</h3>
                        {!isLeaf ? (
                            <div className="info-banner">
                                <AlertCircle size={14} />
                                สามารถเพิ่มรายวิชาได้เฉพาะหมวดวิชาย่อยที่สุดเท่านั้น
                            </div>
                        ) : (
                            <div className="course-form">
                                <input className="form-input" placeholder="รหัสวิชา เช่น CP351001"
                                    value={courseForm.code}
                                    onChange={e => setCourseForm(p => ({ ...p, code: e.target.value }))} />
                                <input className="form-input" placeholder="ชื่อวิชาภาษาไทย"
                                    value={courseForm.nameTh}
                                    onChange={e => setCourseForm(p => ({ ...p, nameTh: e.target.value }))} />
                                <input className="form-input" placeholder="ชื่อวิชาภาษาอังกฤษ"
                                    value={courseForm.nameEn}
                                    onChange={e => setCourseForm(p => ({ ...p, nameEn: e.target.value }))} />
                                <input className="form-input" type="number" placeholder="หน่วยกิต"
                                    min={1} max={6}
                                    value={courseForm.credits}
                                    onChange={e => setCourseForm(p => ({ ...p, credits: e.target.value }))} />
                                <button className="btn btn--primary btn--sm" onClick={handleAddCourse}>
                                    <Plus size={14} /> เพิ่มวิชา
                                </button>
                            </div>
                        )}
                    </div>

                    {/* รายการวิชา — sortable */}
                    {isLeaf && courses.length > 0 && (
                        <div className="detail-section">
                            <h3 className="detail-section__title">
                                รายวิชาในหมวดนี้
                                <span className="detail-section__count">{courses.length} วิชา</span>
                                <span className="detail-section__hint">ลาก <GripVertical size={11} /> เพื่อเรียงลำดับหรือย้ายหมวด</span>
                            </h3>
                            <div className="course-panel-list">
                                {courses.map((course, i) => (
                                    <SortableCourseItem
                                        key={course.id}
                                        course={course}
                                        index={i}
                                        isSelected={selectedCourse?.id === course.id}
                                        onSelect={onSelectCourse}
                                        onDelete={onDeleteCourse}
                                        onReorder={onReorderCourses}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Competency ของวิชาที่เลือก */}
                    {selectedCourse && (
                        <div className="detail-section">
                            <h3 className="detail-section__title">
                                Competency ของ
                                <span className="detail-section__course-name">
                                    {selectedCourse.code} {selectedCourse.nameTh}
                                </span>
                            </h3>
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

                    {isLeaf && courses.length > 0 && !selectedCourse && (
                        <div className="info-banner info-banner--neutral">
                            <AlertCircle size={14} />
                            คลิกที่รายวิชาเพื่อผูก Competency
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}