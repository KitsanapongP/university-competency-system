'use client';

import React from 'react';
import { X } from 'lucide-react';

const ActivityDetailPanel = ({
    activeCompetency,
    activeDetailYear,
    setActiveCompetency,
    setActiveDetailYear,
    competencies,
    activitiesByCompetency,
    filterMode,
    selectedYears,
    dateRange
}) => {
    if (!activeCompetency) return null;

    const comp = competencies.find(c => c.id === activeCompetency);
    const Icon = comp?.icon;
    const displayYear = activeDetailYear || (filterMode === 'year' ? selectedYears[0] : dateRange.endYear);
    const activities = activitiesByCompetency[activeCompetency] || [];

    const completedActivities = activities.filter(a => a.status === 'completed' && a.year === displayYear);
    const totalEarned = completedActivities.reduce((sum, a) => sum + a.score, 0);

    return (
        <div className="activity-detail-card card">
            <div className="card-header">
                <h2>
                    <div className="detail-icon" style={{ backgroundColor: `${comp?.color}15`, color: comp?.color }}>
                        {Icon && <Icon size={20} />}
                    </div>
                    <span>{comp?.name}</span>
                    <span className="score-badge">{totalEarned} คะแนน</span>
                </h2>
                <button className="close-btn" onClick={() => { setActiveCompetency(null); setActiveDetailYear(null); }}>
                    <X size={18} />
                </button>
            </div>

            {/* Year Tabs */}
            {filterMode === 'year' && selectedYears.length > 1 && (
                <div className="detail-year-tabs">
                    {selectedYears.map(year => (
                        <button
                            key={year}
                            className={`year-tab ${(activeDetailYear || selectedYears[0]) === year ? 'active' : ''}`}
                            onClick={() => setActiveDetailYear(year)}
                        >
                            ปี {year}
                        </button>
                    ))}
                </div>
            )}

            <div className="detail-content">
                {/* Completed Activities */}
                <div className="detail-activities">
                    <h4>กิจกรรมที่ได้รับคะแนนแล้ว</h4>
                    <div className="activity-cards">
                        {completedActivities.map(act => (
                            <div
                                key={act.id}
                                className="mini-activity-card completed"
                                style={{
                                    borderLeftColor: comp?.color
                                }}
                            >
                                <div className="act-badge">{act.type.charAt(0)}</div>
                                <div className="act-info">
                                    <span className="act-title">{act.title}</span>
                                    <span className="act-date">{act.date}</span>
                                </div>
                                <div className="act-score earned">+{act.score}</div>
                            </div>
                        ))}
                        {completedActivities.length === 0 && (
                            <p className="no-activities">ไม่มีกิจกรรมในปีนี้</p>
                        )}
                    </div>
                </div>

                {/* Available Activities - only show for current year (2567 mockup) */}
                {(displayYear === '2567') && (
                    <div className="detail-activities available-section">
                        <h4>กิจกรรมที่สามารถทำเพื่อรับคะแนนได้</h4>
                        <div className="activity-cards">
                            {activities
                                .filter(act => act.status === 'available' && act.year === '2567')
                                .map(act => (
                                    <div
                                        key={act.id}
                                        className="mini-activity-card available"
                                        style={{
                                            borderLeftColor: comp?.color
                                        }}
                                    >
                                        <div className="act-badge available">{act.type.charAt(0)}</div>
                                        <div className="act-info">
                                            <span className="act-title">{act.title}</span>
                                            <span className="act-date">{act.date}</span>
                                        </div>
                                        <div className="act-score potential">+{act.score}</div>
                                    </div>
                                ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ActivityDetailPanel;
