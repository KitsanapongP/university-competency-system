'use client';

import React, { useState, useEffect } from 'react';
import { Award, Activity } from 'lucide-react';

// Config & Data
import { CHART_COLORS } from '../config/theme';
import {
    COMPETENCIES, YEARS, MONTHS, CURRICULUM_REQUIREMENTS, ACTIVITIES_BY_COMPETENCY,
    getScoresByYear, getScoresByDateRange
} from '../data/competencyData';

// Components
import CompetencyLayout from '../components/competency/CompetencyLayout';
import CompetencyFilters from '../components/competency/CompetencyFilters';
import CompetencyStats from '../components/competency/CompetencyStats';
import CompetencyRadarChart from '../components/competency/CompetencyRadarChart';
import ActivityDetailPanel from '../components/competency/ActivityDetailPanel';
import GapAnalysis from '../components/competency/GapAnalysis';

// CSS
import './Competency.css';

export default function CompetencyPage() {
    const [activePage, setActivePage] = useState('dashboard');

    // Dashboard States
    const [selectedCompetencies, setSelectedCompetencies] = useState(
        COMPETENCIES.slice(0, 6).map(c => c.id)
    );

    // Filter Mode: 'year' | 'range'
    const [filterMode, setFilterMode] = useState('year');
    const [selectedYears, setSelectedYears] = useState(['2567']);
    const [dateRange, setDateRange] = useState({
        startYear: '2567', startMonth: 1,
        endYear: '2567', endMonth: 3
    });

    const [showRequirement, setShowRequirement] = useState(false);

    // Chart Interaction State
    const [activeCompetency, setActiveCompetency] = useState(null);
    const [activeDetailYear, setActiveDetailYear] = useState(null);

    // Fix: Override root element styles to ensure proper scrolling
    useEffect(() => {
        // Next.js might not use #root, but body/html adjustments are still valid
        const html = document.documentElement;
        const body = document.body;

        // Check if we are in Next.js, main container might vary, but global styles usually attach to body/html
        const originalHtmlStyle = html.getAttribute('style') || '';
        const originalBodyStyle = body.getAttribute('style') || '';

        html.style.height = 'auto';
        html.style.overflow = 'visible';
        body.style.height = 'auto';
        body.style.overflow = 'visible';
        body.style.overflowX = 'hidden';

        return () => {
            html.setAttribute('style', originalHtmlStyle);
            body.setAttribute('style', originalBodyStyle);
        };
    }, []);

    // Toggle Functions
    const toggleCompetency = (id) => {
        if (selectedCompetencies.includes(id)) {
            if (selectedCompetencies.length > 3) {
                setSelectedCompetencies(selectedCompetencies.filter(c => c !== id));
            }
        } else {
            setSelectedCompetencies([...selectedCompetencies, id]);
        }
    };

    const toggleYear = (year) => {
        if (selectedYears.includes(year)) {
            if (selectedYears.length > 1) {
                setSelectedYears(selectedYears.filter(y => y !== year));
            }
        } else if (selectedYears.length < 4) {
            setSelectedYears([...selectedYears, year]);
        }
    };

    // Get Data Helper
    const getScoresForCurrentFilter = () => {
        if (filterMode === 'year') {
            return getScoresByYear(selectedYears[0]);
        } else {
            const { startYear, startMonth, endYear, endMonth } = dateRange;
            return getScoresByDateRange(startYear, startMonth, endYear, endMonth);
        }
    };

    // Chart Data Preparation
    const getChartData = () => {
        const labels = selectedCompetencies.map(id =>
            COMPETENCIES.find(c => c.id === id)?.name || id
        );
        const datasets = [];

        if (filterMode === 'year') {
            selectedYears.forEach((year, index) => {
                const yearData = getScoresByYear(year);
                const data = selectedCompetencies.map(id => yearData[id] || 0);

                datasets.push({
                    label: `ปี ${year}`,
                    data,
                    backgroundColor: CHART_COLORS[index % CHART_COLORS.length].bg,
                    borderColor: CHART_COLORS[index % CHART_COLORS.length].border,
                    borderWidth: 2,
                    pointBackgroundColor: CHART_COLORS[index % CHART_COLORS.length].border,
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 10,
                    pointHitRadius: 20,
                });
            });
        } else {
            const { startYear, startMonth, endYear, endMonth } = dateRange;
            const periodData = getScoresByDateRange(startYear, startMonth, endYear, endMonth);
            const data = selectedCompetencies.map(id => periodData[id] || 0);

            // Create label
            const startMonthName = MONTHS[startMonth - 1]?.short || '';
            const endMonthName = MONTHS[endMonth - 1]?.short || '';
            let label = '';
            if (startYear === endYear && startMonth === endMonth) {
                label = `${startMonthName} ${startYear}`;
            } else if (startYear === endYear) {
                label = `${startMonthName} - ${endMonthName} ${startYear}`;
            } else {
                label = `${startMonthName} ${startYear} - ${endMonthName} ${endYear}`;
            }

            datasets.push({
                label,
                data,
                backgroundColor: CHART_COLORS[0].bg,
                borderColor: CHART_COLORS[0].border,
                borderWidth: 2,
                pointBackgroundColor: CHART_COLORS[0].border,
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 6,
                pointHoverRadius: 10,
                pointHitRadius: 20,
            });
        }

        if (showRequirement) {
            const reqData = selectedCompetencies.map(id => CURRICULUM_REQUIREMENTS[id] || 0);
            datasets.push({
                label: 'เกณฑ์หลักสูตร',
                data: reqData,
                backgroundColor: 'transparent',
                borderColor: '#ef4444',
                borderWidth: 2,
                borderDash: [5, 5],
                pointBackgroundColor: '#ef4444',
                pointRadius: 4,
            });
        }

        return { labels, datasets };
    };

    const handleChartPointClick = (compId, datasetIndex) => {
        let clickedYear;
        if (filterMode === 'year') {
            clickedYear = selectedYears[datasetIndex];
        } else {
            clickedYear = dateRange.endYear;
        }

        if (activeCompetency === compId && activeDetailYear === clickedYear) {
            setActiveCompetency(null);
            setActiveDetailYear(null);
        } else {
            setActiveCompetency(compId);
            setActiveDetailYear(clickedYear);
        }
    };

    // Stats Logic
    const getStats = () => {
        const data = getScoresForCurrentFilter();
        const values = Object.values(data);
        const avg = values.length > 0 ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) : 0;

        let growth = 0;
        if (filterMode === 'year' && selectedYears.length >= 2) {
            const sorted = [...selectedYears].sort().reverse();
            const latest = getScoresByYear(sorted[0]);
            const prev = getScoresByYear(sorted[1]);
            const latestAvg = Object.values(latest).reduce((a, b) => a + b, 0) / 8;
            const prevAvg = Object.values(prev).reduce((a, b) => a + b, 0) / 8;
            growth = prevAvg > 0 ? (((latestAvg - prevAvg) / prevAvg) * 100).toFixed(0) : 0;
        }

        const passed = selectedCompetencies.filter(id => {
            const score = data[id] || 0;
            const req = CURRICULUM_REQUIREMENTS[id];
            return score >= req;
        }).length;

        return { avg, growth, passed, total: selectedCompetencies.length };
    };

    return (
        <CompetencyLayout activePage={activePage} onNavigate={setActivePage}>

            {/* DASHBOARD PAGE */}
            {activePage === 'dashboard' && (
                <>
                    <div className="dashboard-grid">
                        {/* Chart Section */}
                        <CompetencyRadarChart
                            chartData={getChartData()}
                            competencies={COMPETENCIES}
                            selectedCompetencies={selectedCompetencies}
                            activeCompetency={activeCompetency}
                            onCompetencyClick={handleChartPointClick}
                            filterMode={filterMode}
                            selectedYears={selectedYears}
                            dateRange={dateRange}
                            months={MONTHS}
                            showRequirement={showRequirement}
                        />

                        {/* Filter Section */}
                        <CompetencyFilters
                            allCompetencies={COMPETENCIES}
                            selectedCompetencies={selectedCompetencies}
                            onToggleCompetency={toggleCompetency}
                            filterMode={filterMode}
                            setFilterMode={setFilterMode}
                            years={YEARS}
                            months={MONTHS}
                            selectedYears={selectedYears}
                            onToggleYear={toggleYear}
                            dateRange={dateRange}
                            setDateRange={setDateRange}
                            showRequirement={showRequirement}
                            setShowRequirement={setShowRequirement}
                        />
                    </div>

                    {/* Activity Detail Card */}
                    <ActivityDetailPanel
                        activeCompetency={activeCompetency}
                        activeDetailYear={activeDetailYear}
                        setActiveCompetency={setActiveCompetency}
                        setActiveDetailYear={setActiveDetailYear}
                        competencies={COMPETENCIES}
                        activitiesByCompetency={ACTIVITIES_BY_COMPETENCY}
                        filterMode={filterMode}
                        selectedYears={selectedYears}
                        dateRange={dateRange}
                    />

                    {/* Stats Cards */}
                    <CompetencyStats stats={getStats()} />

                    {/* Gap Analysis */}
                    <GapAnalysis
                        competencies={selectedCompetencies.map(id => COMPETENCIES.find(c => c.id === id)).filter(Boolean)}
                        scores={getScoresForCurrentFilter()}
                        requirements={CURRICULUM_REQUIREMENTS}
                    />
                </>
            )}

            {/* PROFILE PAGE */}
            {activePage === 'profile' && (
                <div className="profile-page">
                    <div className="profile-grid">
                        <div className="profile-card card">
                            <div className="profile-avatar">KP</div>
                            <h3>Kitsanapong Panasri</h3>
                            <p>รหัสนักศึกษา: 6530xxxxx</p>
                            <p>คณะวิศวกรรมศาสตร์</p>
                            <p>สาขาวิศวกรรมคอมพิวเตอร์</p>
                        </div>

                        <div className="activity-history card">
                            <div className="card-header">
                                <h2>
                                    <Award size={20} className="section-icon" />
                                    กิจกรรมล่าสุด
                                </h2>
                            </div>
                            <div className="activity-list">
                                {Object.values(ACTIVITIES_BY_COMPETENCY).flat().slice(0, 5).map(act => (
                                    <div key={act.id} className="activity-item">
                                        <div className="activity-badge">{act.type.charAt(0)}</div>
                                        <div className="activity-info">
                                            <h4>{act.title}</h4>
                                            <span>{act.date}</span>
                                        </div>
                                        <div className="activity-status verified">
                                            ยืนยันแล้ว
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* VERIFY PAGE */}
            {activePage === 'verify' && (
                <div className="verify-page">
                    <div className="verify-list card">
                        <div className="card-header">
                            <h2>
                                <Activity size={20} className="section-icon" />
                                รายการกิจกรรมทั้งหมด
                            </h2>
                        </div>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>กิจกรรม</th>
                                    <th>วันที่</th>
                                    <th>ประเภท</th>
                                    <th>คะแนน</th>
                                    <th>สถานะ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(ACTIVITIES_BY_COMPETENCY).flatMap(([compId, acts]) =>
                                    acts.map(act => {
                                        const comp = COMPETENCIES.find(c => c.id === compId);
                                        const Icon = comp.icon;
                                        return (
                                            <tr key={act.id}>
                                                <td>{act.title}</td>
                                                <td>{act.date}</td>
                                                <td>
                                                    <span className="comp-badge" style={{ backgroundColor: `${comp.color}15`, color: comp.color }}>
                                                        <Icon size={14} />
                                                        <span>{comp.name}</span>
                                                    </span>
                                                </td>
                                                <td><strong>+{act.score}</strong></td>
                                                <td>
                                                    <span className="status-badge verified">
                                                        ✓ ยืนยันแล้ว
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

        </CompetencyLayout>
    );
}
