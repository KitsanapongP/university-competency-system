'use client';

import React from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '../../providers/LanguageContext';

const ActivityDetailPanel = ({
    activeCompetency,
    activeDetailYear,
    setActiveCompetency,
    setActiveDetailYear,
    competencies,
    activitiesByCompetency,
    filterMode,
    selectedYears,
    dateRange,
    showAllScores
}) => {
    const { t } = useLanguage();

    if (!activeCompetency) return null;

    const comp = competencies.find(c => c.id === activeCompetency);
    const Icon = comp?.icon;
    const isAllYears = filterMode === 'year' && showAllScores;
    const displayYear = activeDetailYear || (filterMode === 'year' ? selectedYears[0] : dateRange.endYear);
    const activities = activitiesByCompetency[activeCompetency] || [];

    const completedActivities = activities.filter(a => (
        a.status === 'completed' && (isAllYears || a.year === displayYear)
    ));
    const totalEarned = completedActivities.reduce((sum, a) => sum + a.score, 0);

    return (
        <div className="activity-detail-card card">
            <div className="card-header">
                <h2>
                    <div className="detail-icon" style={{ backgroundColor: `${comp?.color}15`, color: comp?.color }}>
                        {Icon && <Icon size={20} />}
                    </div>
                    <span>{comp?.name}</span>
                    <span className="score-badge">{formatNumber(totalEarned, 2)} {t('score')}</span>
                </h2>
                <button className="close-btn" onClick={() => { setActiveCompetency(null); setActiveDetailYear(null); }}>
                    <X size={18} />
                </button>
            </div>

            {/* Year Tabs */}
            {filterMode === 'year' && !isAllYears && selectedYears.length > 1 && (
                <div className="detail-year-tabs">
                    {selectedYears.map(year => (
                        <button
                            key={year}
                            className={`year-tab ${(activeDetailYear || selectedYears[0]) === year ? 'active' : ''}`}
                            onClick={() => setActiveDetailYear(year)}
                        >
                            {t('year')} {year}
                        </button>
                    ))}
                </div>
            )}

            <div className="detail-content">
                {/* Completed Activities */}
                <div className="detail-activities">
                    <h4>{t('scored_activities')}</h4>
                    <div className="activity-cards">
                        {completedActivities.map(act => (
                            <div
                                key={act.id}
                                className="mini-activity-card completed"
                                style={{
                                    borderLeftColor: comp?.color
                                }}
                            >
                                <div className="act-badge">{(act.type || 'A').charAt(0)}</div>
                                <div className="act-info">
                                    <span className="act-title">{act.title}</span>
                                    <span className="act-date">{act.date || '-'}</span>
                                </div>
                                <div className="act-score earned">+{formatNumber(act.score, 2)}</div>
                            </div>
                        ))}
                        {completedActivities.length === 0 && (
                            <p className="no-activities">{t('no_activities_this_year')}</p>
                        )}
                    </div>
                </div>

                {/* Available Activities */}
                {activities.some(act => act.status === 'available' && act.year === displayYear) && (
                    <div className="detail-activities available-section">
                        <h4>{t('available_activities')}</h4>
                        <div className="activity-cards">
                            {activities
                                .filter(act => act.status === 'available' && act.year === displayYear)
                                .map(act => (
                                    <div
                                        key={act.id}
                                        className="mini-activity-card available"
                                        style={{
                                            borderLeftColor: comp?.color
                                        }}
                                    >
                                        <div className="act-badge available">{(act.type || 'A').charAt(0)}</div>
                                        <div className="act-info">
                                            <span className="act-title">{act.title}</span>
                                            <span className="act-date">{act.date || '-'}</span>
                                        </div>
                                        <div className="act-score potential">+{formatNumber(act.score, 2)}</div>
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

function formatNumber(value, decimals) {
    if (Number.isNaN(value)) return '0';
    const factor = 10 ** decimals;
    return (Math.round((value + Number.EPSILON) * factor) / factor).toFixed(decimals);
}
