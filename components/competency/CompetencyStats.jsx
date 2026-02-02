import React from 'react';
import { Target, TrendingUp, Award } from 'lucide-react';

const CompetencyStats = ({ stats }) => {
    return (
        <div className="stats-grid">
            <div className="stat-card">
                <div className="stat-icon blue">
                    <Target size={20} />
                </div>
                <div className="stat-info">
                    <span className="stat-label">คะแนนเฉลี่ย</span>
                    <span className="stat-value">{stats.avg}</span>
                </div>
            </div>
            <div className="stat-card">
                <div className="stat-icon green">
                    <TrendingUp size={20} />
                </div>
                <div className="stat-info">
                    <span className="stat-label">การเติบโต</span>
                    <span className="stat-value">{stats.growth > 0 ? '+' : ''}{stats.growth}%</span>
                </div>
            </div>
            <div className="stat-card">
                <div className="stat-icon purple">
                    <Award size={20} />
                </div>
                <div className="stat-info">
                    <span className="stat-label">ผ่านเกณฑ์</span>
                    <span className="stat-value">{stats.passed}/{stats.total}</span>
                </div>
            </div>
        </div>
    );
};

export default CompetencyStats;
