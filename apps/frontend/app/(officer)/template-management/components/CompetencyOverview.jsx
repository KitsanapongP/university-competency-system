'use client';

import { useEffect, useRef, useMemo } from 'react';
import { BookOpen, BookOpenCheck, Award, Layers, FolderOpen, Link2, Unlink, Target, Trash2,AlertCircle } from 'lucide-react';
import TemplateStatusCard from './TemplateStatusCard';

// ============================================================
// Helper — รวม weight ทุกวิชาทั้งหลักสูตรต่อ competency
// ============================================================
function calcGlobalTotals(coursesByCategoryId, weightsByCourseId, competencies) {
    return competencies.map(comp => {
        let total = 0;
        Object.values(coursesByCategoryId).forEach(courses => {
            courses.forEach(course => {
                total += Number(weightsByCourseId[course.id]?.[comp.id]) || 0;
            });
        });
        return { comp, total };
    });
}

function collectAllCourses(coursesByCategoryId) {
    return Object.values(coursesByCategoryId).flat();
}

// ============================================================
// RadarChart — วาดด้วย Canvas ไม่ต้องลง library
// ============================================================
function RadarChart({ data, labels, colors, size = 320 }) {
    const canvasRef = useRef(null);
    const cx = size / 2;
    const cy = size / 2;
    const r  = size * 0.36;

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const n = labels.length;
        if (n < 3) return;

        ctx.clearRect(0, 0, size, size);

        const angle = (i) => (Math.PI * 2 * i) / n - Math.PI / 2;
        const pt = (i, radius) => ({
            x: cx + radius * Math.cos(angle(i)),
            y: cy + radius * Math.sin(angle(i)),
        });

        // Grid
        for (let lvl = 1; lvl <= 5; lvl++) {
            const rr = (r * lvl) / 5;
            ctx.beginPath();
            for (let i = 0; i < n; i++) {
                const p = pt(i, rr);
                i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
            }
            ctx.closePath();
            ctx.strokeStyle = 'rgba(148,163,184,0.12)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // Axes
        for (let i = 0; i < n; i++) {
            const p = pt(i, r);
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(p.x, p.y);
            ctx.strokeStyle = 'rgba(148,163,184,0.18)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // Labels
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < n; i++) {
            const p = pt(i, r + 26);
            ctx.fillStyle = colors[i] || '#94a3b8';
            ctx.fillText(labels[i], p.x, p.y);
        }

        // Data polygon
        const maxVal = Math.max(...data, 1);
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
            const ratio = (data[i] || 0) / maxVal;
            const p = pt(i, r * ratio);
            i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
        ctx.fillStyle   = 'rgba(59,130,246,0.18)';
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth   = 2;
        ctx.fill();
        ctx.stroke();

        // Dots
        for (let i = 0; i < n; i++) {
            const ratio = (data[i] || 0) / maxVal;
            const p = pt(i, r * ratio);
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.fillStyle   = colors[i] || '#3b82f6';
            ctx.strokeStyle = '#fff';
            ctx.lineWidth   = 1.5;
            ctx.fill();
            ctx.stroke();
        }
    }, [data, labels, colors, size]);

    return (
        <canvas ref={canvasRef} width={size} height={size}
            style={{ display:'block', margin:'0 auto' }}/>
    );
}

// ============================================================
// CompetencyOverview — หน้า 4
// ============================================================
export default function CompetencyOverview({
    categories = [],
    coursesByCategoryId = {},
    weightsByCourseId = {},
    competencies = [],
    templateName = '',
    templateStatus = true,
    academicYear = null,
    courseMasterName = null,
    courseMasterYear = null,
    onToggleStatus,
    onDeleteTemplate,
}) {
    const totals  = useMemo(() =>
        calcGlobalTotals(coursesByCategoryId, weightsByCourseId, competencies),
        [coursesByCategoryId, weightsByCourseId, competencies]
    );
    const allCourses = useMemo(() => collectAllCourses(coursesByCategoryId), [coursesByCategoryId]);
    const totalCourses = allCourses.length;
    const coursesWithComp = allCourses.filter(c =>
        competencies.some(comp => (Number(weightsByCourseId[c.id]?.[comp.id]) || 0) > 0)
    ).length;
    const coursesWithoutComp = totalCourses - coursesWithComp;
    const credits = allCourses.reduce((sum, c) => sum + (Number(c.credits) || 0), 0);
    const totalCoreCourse = allCourses.filter(c => c.isCoreCourse).length;
    const totalnonCoreCourse = allCourses.filter(c => !c.isCoreCourse).length;
    const totalCourseMaster = allCourses.filter(c => c.fromMaster).length;
    const totalnonCourseMaster = allCourses.filter(c => !c.fromMaster).length;

    const labels = totals.map(t => t.comp.name);
    const data   = totals.map(t => t.total);
    const colors = totals.map(t => t.comp.color);
    const maxTotal = Math.max(...data, 0);
    const hasData  = maxTotal > 0;

    const yearDisplay = academicYear ? academicYear : 'ยังไม่กำหนด';
    const courseMasterDisplay = courseMasterName 
        ? `${courseMasterName} (${courseMasterYear})` 
        : null;

    return (
        <div className="ov-page">
            <div className="ov-container">
                {/* Header */}
                {templateName && (
                    <div className="ov-template-info">
                        <div className="ov-template-name">{templateName}</div>
                        <div className="ov-template-text">
                            {courseMasterDisplay 
                                ? `${courseMasterDisplay} · ปีการศึกษา ${yearDisplay}`
                                : `ปีการศึกษา ${yearDisplay}`}
                        </div> 
                    </div>
                )}
                {/* Status Template */}
                <TemplateStatusCard
                    isActive={templateStatus}
                    academicYear={academicYear}
                    courseMasterName={courseMasterName}
                    courseMasterYear={courseMasterYear}
                    onToggleStatus={onToggleStatus}
                />

                
                {/* Stats Courses */}
                <div className="ov-header">
                    <div className="ov-header__top">
                        <h1 className="ov-title">ภาพรวมของโครงสร้างหลักสูตร</h1>
                        <p className="ov-sub">รายละเอียดเกี่ยวกับวิชาในแบบแผนการประเมิน</p>
                    </div>
                    <div className="ov-stats-grid">
                        <div className="ov-card">
                            <div className="ov-card__icon">
                                <BookOpen size={20} />
                            </div>
                            <div className="ov-card__content">
                                <span className="ov-card__value">{totalCourses}</span>
                                <span className="ov-card__label">วิชาทั้งหมด</span>
                            </div>
                        </div>
                        <div className="ov-card">
                            <div className="ov-card__icon">
                                <BookOpen size={20} />
                            </div>
                            <div className="ov-card__content">
                                <span className="ov-card__value">{totalCourseMaster}</span>
                                <span className="ov-card__label">วิชาจาก Master</span>
                            </div>
                        </div>
                        <div className="ov-card">
                            <div className="ov-card__icon">
                                <BookOpen size={20} />
                            </div>
                            <div className="ov-card__content">
                                <span className="ov-card__value">{totalnonCourseMaster}</span>
                                <span className="ov-card__label">วิชาที่เพิ่มมาใหม่</span>
                            </div>
                        </div>
                        <div className="ov-card">
                            <div className="ov-card__icon">
                                <BookOpenCheck size={20} />
                            </div>
                            <div className="ov-card__content">
                                <span className="ov-card__value">{totalCoreCourse}</span>
                                <span className="ov-card__label">วิชาบังคับ</span>
                            </div>
                        </div>
                        <div className="ov-card">
                            <div className="ov-card__icon">
                                <FolderOpen size={20} />
                            </div>
                            <div className="ov-card__content">
                                <span className="ov-card__value">{totalnonCoreCourse}</span>
                                <span className="ov-card__label">วิชาเลือก</span>
                            </div>
                        </div>
                        <div className="ov-card">
                            <div className="ov-card__icon">
                                <Award size={20} />
                            </div>
                            <div className="ov-card__content">
                                <span className="ov-card__value">{credits}</span>
                                <span className="ov-card__label">หน่วยกิตรวม</span>
                            </div>
                        </div>
                        <div className="ov-card">
                            <div className="ov-card__icon">
                                <Layers size={20} />
                            </div>
                            <div className="ov-card__content">
                                <span className="ov-card__value">{categories.length}</span>
                                <span className="ov-card__label">หมวดวิชา</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* States Competency */}
                <div className="ov-header">
                    <div className="ov-header__top">
                        <h1 className="ov-title">ภาพรวมของสมรรถนะ</h1>
                        <p className="ov-sub">ผลรวมสัดส่วนน้ำหนัก ของแต่ละสมรรถนะ จากทุกวิชาในหลักสูตร</p>
                    </div>
                    <div className="ov-stats-grid">
                        <div className="ov-card">
                            <div className="ov-card__icon">
                                <Link2 size={20} />
                            </div>
                            <div className="ov-card__content">
                                <span className="ov-card__value">{coursesWithComp}</span>
                                <span className="ov-card__label">วิชาที่ผูกสมรรถนะ</span>
                            </div>
                        </div>
                        <div className="ov-card">
                            <div className="ov-card__icon">
                                <Unlink  size={20} />
                            </div>
                            <div className="ov-card__content">
                                <span className="ov-card__value">{coursesWithoutComp}</span>
                                <span className="ov-card__label">วิชาที่ไม่ผูกสมรรถนะ</span>
                            </div>
                            <div className="ov-card__badge">
                            {coursesWithoutComp > 0 ? (
                                <>
                                <AlertCircle size={12} /> โปรดใส่น้ำหนักให้ครบ
                                </>
                            ) : (
                                ''
                            )}
                            </div>
                        </div>
                        <div className="ov-card">
                            <div className="ov-card__icon">
                                <Target size={20} />
                            </div>
                            <div className="ov-card__content">
                                <span className="ov-card__value">{competencies.length}</span>
                                <span className="ov-card__label">สมรรถนะทั้งหมด</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="ov-body">
                    {/* Radar */}
                    <div className="ov-radar-wrap">
                        {!hasData ? (
                            <div className="ov-empty">
                                <span style={{fontSize:'2rem', opacity:0.2}}>📊</span>
                                <p>ยังไม่มีข้อมูลน้ำหนัก — ไปที่แท็บ "ใส่น้ำหนักสมรรถนะ" เพื่อเริ่ม</p>
                            </div>
                        ) : (
                            <RadarChart labels={labels} data={data} colors={colors} size={340}/>
                        )}
                    </div>

                    {/* Bar list */}
                    <div className="ov-bar-list">
                        <h3 className="ov-bar-title">รายละเอียด</h3>
                        {totals.map(({ comp, total }) => {
                            const pct = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
                            return (
                                <div key={comp.id} className="ov-bar-row">
                                    <div className="ov-bar-row__top">
                                        <span className="ov-bar-dot" style={{ background: comp.color }}/>
                                        <span className="ov-bar-name">{comp.name}</span>
                                        <span className="ov-bar-val" style={{ color: comp.color }}>{total}</span>
                                    </div>
                                    <div className="ov-bar-track">
                                        <div className="ov-bar-fill"
                                            style={{ width: `${pct}%`, background: comp.color }}/>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Danger Zone */}
                <div className="ov-danger-zone">
                    <div className="ov-danger-zone__header">
                        <h1 className="ov-danger-zone__title">โซนอันตราย</h1>
                        <span className="ov-danger-zone__desc">
                            โซนลบแบบแผนการประเมิน - เมื่อลบแล้วจะไม่สามารถกู้คืนได้ และข้อมูลทั้งหมดในแบบแผนนี้จะหายไป
                        </span>
                    </div>
                    <div className="ov-danger-zone__content">
                        <button 
                            className="ov-delete-template-btn"
                            onClick={onDeleteTemplate}
                        >
                            <Trash2 size={14} />
                            <span>ลบแบบแผนนี้</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
