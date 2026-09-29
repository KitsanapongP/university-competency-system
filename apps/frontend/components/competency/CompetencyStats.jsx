'use client';

import React from 'react';
import { Target, TrendingUp, Award } from 'lucide-react';
import { useLanguage } from '../../providers/LanguageContext';

const CompetencyStats = ({ stats, showPassedCriteria = true }) => {
    const { t } = useLanguage();

    return (
        <div className="stats-grid">
            <div className="stat-card">
                <div className="stat-icon blue">
                    <Target size={20} />
                </div>
                <div className="stat-info">
                    <span className="stat-label">{t('avg_score')}</span>
                    <span className="stat-value">{stats.avg}</span>
                </div>
            </div>
            <div className="stat-card">
                <div className="stat-icon green">
                    <TrendingUp size={20} />
                </div>
                <div className="stat-info">
                    <span className="stat-label">{t('growth')}</span>
                    <span className="stat-value">{stats.growth > 0 ? '+' : ''}{stats.growth}%</span>
                </div>
            </div>
            {showPassedCriteria && (
                <div className="stat-card">
                    <div className="stat-icon purple">
                        <Award size={20} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-label">{t('passed_criteria')}</span>
                        <span className="stat-value">{stats.passed}/{stats.total}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CompetencyStats;
