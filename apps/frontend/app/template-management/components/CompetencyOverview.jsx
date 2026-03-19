'use client';

import { useEffect, useRef, useMemo } from 'react';

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

    const labels = totals.map(t => t.comp.name);
    const data   = totals.map(t => t.total);
    const colors = totals.map(t => t.comp.color);
    const maxTotal = Math.max(...data, 0);
    const hasData  = maxTotal > 0;

    return (
        <div className="ov-page">
            <div className="ov-container">
                {/* Header */}
                <div className="ov-header">
                    <div>
                        <h2 className="ov-title">ภาพรวม Competency</h2>
                        <p className="ov-sub">ผลรวม Weight ของแต่ละ Competency จากทุกวิชาในหลักสูตร</p>
                    </div>
                    {/* Stats */}
                    <div className="ov-stats">
                        <div className="ov-stat">
                            <span className="ov-stat__val">{totalCourses}</span>
                            <span className="ov-stat__label">วิชาทั้งหมด</span>
                        </div>
                        <div className="ov-stat">
                            <span className="ov-stat__val">{coursesWithComp}</span>
                            <span className="ov-stat__label">วิชาที่ผูก Competency</span>
                        </div>
                        <div className="ov-stat">
                            <span className="ov-stat__val">{competencies.length}</span>
                            <span className="ov-stat__label">Competency</span>
                        </div>
                    </div>
                </div>

                <div className="ov-body">
                    {/* Radar */}
                    <div className="ov-radar-wrap">
                        {!hasData ? (
                            <div className="ov-empty">
                                <span style={{fontSize:'2rem', opacity:0.2}}>📊</span>
                                <p>ยังไม่มีข้อมูล Weight — ไปที่แท็บ "ใส่ Weight" เพื่อเริ่ม</p>
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
            </div>
        </div>
    );
}