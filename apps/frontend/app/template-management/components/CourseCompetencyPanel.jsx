'use client';

import { useState, useRef } from 'react';
import { Plus, Trash2, AlertCircle, GripVertical, Pencil } from 'lucide-react';

// ============================================================
// CompetencyTags — แถว tags ใต้ชื่อวิชา
// ============================================================
function CompetencyTags({ weights = [] }) {
    if (weights.length === 0) return null;
    return (
        <div className="course-competency-tags">
            {weights.map(({ competency, weight }) => (
                <span
                    key={competency.id}
                    className="competency-tag"
                    style={{ '--tag-color': competency.color || '#7dd3fc' }}
                    title={`${competency.name} — ${weight}%`}
                >
                    <span className="competency-tag__dot" />
                    {competency.name}
                    {weight > 0 && <span className="competency-tag__weight">{weight}%</span>}
                </span>
            ))}
        </div>
    );
}

// ============================================================
// SortableCourseItem — drag to reorder ใน Panel 3
// ============================================================
function SortableCourseItem({ course, index, onDelete, onReorder, onEdit, lang, weights }) {
    const [dragOver, setDragOver] = useState(null);
    const itemRef = useRef(null);

    const handleDragStart = (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('courseIndex', String(index));
    };
    const handleDragOver = (e) => {
        e.preventDefault();
        const rect = itemRef.current?.getBoundingClientRect();
        if (!rect) return;
        setDragOver(e.clientY - rect.top < rect.height / 2 ? 'before' : 'after');
    };
    const handleDrop = (e) => {
        e.preventDefault();
        const fromIdx = parseInt(e.dataTransfer.getData('courseIndex'), 10);
        if (!isNaN(fromIdx) && fromIdx !== index) {
            onReorder(fromIdx, dragOver === 'before' ? index : index + 1);
        }
        setDragOver(null);
    };

    const displayName = lang === 'en' && course.nameEn ? course.nameEn : course.nameTh;

    return (
        <div className="sortable-course-wrapper">
            {dragOver === 'before' && <div className="course-drop-indicator" />}
            <div
                ref={itemRef}
                className="course-panel-item"
                draggable
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragLeave={() => setDragOver(null)}
                onDrop={handleDrop}
            >
                {/* แถวบน: grip / รหัส / ชื่อ / หน่วยกิต / ปุ่ม */}
                <div className="course-panel-item__row">
                    <span className="course-panel-item__grip"><GripVertical size={13} /></span>
                    <div className="course-panel-item__info">
                        <span className="course-panel-item__code">{course.code}</span>
                        <span className="course-panel-item__name">{displayName}</span>
                    </div>
                    <span className="course-panel-item__credits">{course.credits} หน่วยกิต</span>
                    <button
                        className="icon-btn icon-btn--edit icon-btn--xs"
                        onClick={e => { e.stopPropagation(); onEdit(course); }}
                        title="แก้ไขรายวิชา"
                    >
                        <Pencil size={13} />
                    </button>
                    <button
                        className="icon-btn icon-btn--danger icon-btn--xs"
                        onClick={e => { e.stopPropagation(); onDelete(course.id); }}
                        title="ลบรายวิชา"
                    >
                        <Trash2 size={13} />
                    </button>
                </div>

                {/* แถวล่าง: competency tags */}
                <CompetencyTags weights={weights} />
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
    courses = [],
    courseWeightsMap = {},  // { [courseId]: [{ competency, weight }] }
    onDeleteCourse,
    onDeleteCategory,
    onReorderCourses,
    onOpenAddModal,
    onOpenEditModal,
    lang = 'th',
}) {
    const isLeaf = category && !category.children?.length;

    return (
        <div className="tm-panel tm-panel--detail">

            {/* ── Header ── */}
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

            {/* ── Body ── */}
            {!category ? (
                <div className="panel-empty">เลือกหมวดวิชาก่อน</div>
            ) : !isLeaf ? (
                <div className="panel-empty">
                    <AlertCircle size={20} opacity={0.4} />
                    <span>สามารถเพิ่มรายวิชาได้เฉพาะหมวดวิชาย่อยที่สุดเท่านั้น</span>
                </div>
            ) : (
                <div className="detail-body">

                    {/* ปุ่มเพิ่มวิชา */}
                    <button className="btn btn--primary btn--add-course" onClick={onOpenAddModal}>
                        <Plus size={15} /> เพิ่มรายวิชา
                    </button>

                    {/* รายการวิชา */}
                    {courses.length === 0 ? (
                        <div className="panel-empty panel-empty--sm">
                            <span>ยังไม่มีรายวิชาในหมวดนี้</span>
                        </div>
                    ) : (
                        <div className="detail-section">
                            <h3 className="detail-section__title">
                                รายวิชาในหมวดนี้
                                <span className="detail-section__count">{courses.length} วิชา</span>
                                <span className="detail-section__hint">
                                    ลาก <GripVertical size={11} /> เพื่อเรียงลำดับ
                                </span>
                            </h3>
                            <div className="course-panel-list">
                                {courses.map((course, i) => (
                                    <SortableCourseItem
                                        key={course.id}
                                        course={course}
                                        index={i}
                                        weights={courseWeightsMap[course.id] || []}
                                        onDelete={onDeleteCourse}
                                        onReorder={onReorderCourses}
                                        onEdit={onOpenEditModal}
                                        lang={lang}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
    }
    
