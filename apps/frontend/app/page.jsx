'use client';

import React, { useState, useEffect, useMemo, use } from 'react';
import { useRouter } from 'next/navigation';
import {
    Award,
    BookOpenText,
    Activity,
    Brain,
    Monitor,
    Crown,
    Scale,
    MessageCircle,
    Users
} from 'lucide-react';

// Config & Data
import { CHART_COLORS } from '../config/theme';
import { MONTHS } from '../data/competencyData';
import { fetchCompetencyDashboard } from '../lib/competency';

// Components
import CompetencyLayout from '../components/competency/CompetencyLayout';
import CompetencyFilters from '../components/competency/CompetencyFilters';
import CompetencyStats from '../components/competency/CompetencyStats';
import CompetencyRadarChart from '../components/competency/CompetencyRadarChart';
import ActivityDetailPanel from '../components/competency/ActivityDetailPanel';
import GapAnalysis from '../components/competency/GapAnalysis';
import LoadingSkeleton from '../components/competency/LoadingSkeleton';
import { useAuth } from '../providers/auth-provider';
import { useLanguage } from '../providers/LanguageContext';

// CSS
import './Competency.css';

export default function CompetencyPage() {
    const router = useRouter();
    const { user, loading, logout } = useAuth();
    const { t, language } = useLanguage();
    const [activePage, setActivePage] = useState('dashboard');

    // Dashboard States
    const [selectedCompetencies, setSelectedCompetencies] = useState([]);
    const [competencies, setCompetencies] = useState([]);
    const [requirements, setRequirements] = useState({});

    // Data Maps for quick access (competencyId -> activities/courses)
    const [radarChartByCompetency, setRadarChartByCompetency] = useState({});

    const [availableYears, setAvailableYears] = useState([]);
    const [dataLoading, setDataLoading] = useState(true);
    const [dataError, setDataError] = useState(null);

    // Filter Mode: 'year' | 'range'
    const [filterMode, setFilterMode] = useState('year');
    const [selectedYears, setSelectedYears] = useState([]);
    const [dateRange, setDateRange] = useState({
        startYear: '', startMonth: 1,
        endYear: '', endMonth: 1
    });

    // Category: 'activity' | 'course'
    const [category, setCategory] = useState('activity');

    // Course History States
    const[courseHistory, setCourseHistoryMap] = useState([]);
    
    // Activity History States
    const [activityHistory, setActivityHistoryMap] = useState([]);

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

    useEffect(() => {
        if (!loading && !user) {
            router.replace('/login');
        }
    }, [loading, user, router]);

    useEffect(() => {
        const loadDashboard = async () => {
            if (!user) return;
            setDataLoading(true);
            setDataError(null);
            try {
                const response = await fetchCompetencyDashboard(category);
                const payload = response?.data || response;
                const styledCompetencies = (payload.competencies || []).map((comp) => {
                    return {
                        id: comp.id,
                        code: comp.code,
                        name_th: comp.name_th || '',
                        name_en: comp.name_en || '',
                        name: comp.name_th || comp.name_en || comp.code,
                        icon: getCompetencyIcon(comp.code),
                        color: getCompetencyColor(comp.code),
                    };
                });

                // สร้าง map สำหรับ cometency ทั้งหมด
                const activityMap = {};
                Object.entries(payload.activities || {}).forEach(([key, value]) => {
                    activityMap[Number(key)] = value || [];
                });
                setRadarChartByCompetency(activityMap);

                const years = normalizeYears(payload.available_years || [], activityMap);
                
                // โหลด activity แยกสำหรับ Profile History
                const actResponse = await fetchCompetencyDashboard('activity');
                const actPayload = actResponse?.data || actResponse;
                const actMap = {};
                Object.entries(actPayload.activities || {}).forEach(([key, value]) => {
                    actMap[Number(key)] = value || [];
                });
                setActivityHistoryMap(actMap);

                // โหลด course แยกสำหรับ Profile History
                const crsResponse = await fetchCompetencyDashboard('course');
                const crsPayload = crsResponse?.data || crsResponse;
                const crsMap = {};
                Object.entries(crsPayload.activities || {}).forEach(([key, value]) => {
                    crsMap[Number(key)] = value || [];
                });
                setCourseHistoryMap(crsMap);

                setCompetencies(styledCompetencies);
                setRequirements(payload.requirements || {});
                setAvailableYears(years);

                if (styledCompetencies.length) {
                    setSelectedCompetencies(styledCompetencies.slice(0, 6).map((c) => c.id));
                }
                if (years.length) {
                    setSelectedYears([years[0]]);
                    setDateRange((prev) => ({
                        ...prev,
                        startYear: years[0],
                        endYear: years[0],
                    }));
                }
            } catch (error) {
                if (error?.status === 401) {
                    await logout();
                    router.replace('/login');
                    return;
                }
                setDataError(error?.message || 'Error loading data');
            } finally {
                setDataLoading(false);
            }
        };

        loadDashboard();
    }, [user, logout, router, category]);


    useEffect(() => {
        setCompetencies((prev) => prev.map((comp) => {
            let name;
            if (language === 'th') {
                name = comp.name_th || t(comp.code) || comp.name_en || comp.code;
            } else {
                name = comp.name_en || t(comp.code) || comp.name_th || comp.code;
            }
            return { ...comp, name };
        }));
    }, [language, t]);
    
    const handleLogout = async () => {
        await logout();
        router.push('/login');
    };

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
            return getScoresByYear(selectedYears[0], radarChartByCompetency);
        }
        const { startYear, startMonth, endYear, endMonth } = dateRange;
        return getScoresByDateRange(startYear, startMonth, endYear, endMonth, radarChartByCompetency);
    };

    // Chart Data Preparation
    const getChartData = () => {
        const labels = selectedCompetencies.map(id =>
            competencies.find(c => c.id === id)?.name || id
        );
        const datasets = [];

        if (filterMode === 'year') {
            selectedYears.forEach((year, index) => {
                const yearData = getScoresByYear(year, radarChartByCompetency);
                const data = selectedCompetencies.map(id => yearData[id] || 0);

                datasets.push({
                    label: `${t('year')} ${year}`,
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
            const periodData = getScoresByDateRange(startYear, startMonth, endYear, endMonth, radarChartByCompetency);
            const data = selectedCompetencies.map(id => periodData[id] || 0);

            // Create label
            const startMonthObj = MONTHS[startMonth - 1];
            const endMonthObj = MONTHS[endMonth - 1];
            const startMonthName = startMonthObj ? t(`${startMonthObj.id}_short`) : '';
            const endMonthName = endMonthObj ? t(`${endMonthObj.id}_short`) : '';
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
            const reqData = selectedCompetencies.map(id => requirements[id] || 0);
            datasets.push({
                label: t('requirement'),
                data: reqData,
                backgroundColor: 'transparent',
                borderColor: '#ef4444',
                borderWidth: 2,
                borderDash: [5, 5],
                pointBackgroundColor: '#ef4444',
                pointRadius: 4,
                isRequirement: true,
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
        const avgValue = values.length > 0 ? (values.reduce((a, b) => a + b, 0) / values.length) : 0;
        const avg = formatNumber(avgValue, 1);

        let growth = 0;
        if (filterMode === 'year' && selectedYears.length >= 2) {
            const sorted = [...selectedYears].sort().reverse();
            const latest = getScoresByYear(sorted[0], radarChartByCompetency);
            const prev = getScoresByYear(sorted[1], radarChartByCompetency);
            const divisor = selectedCompetencies.length || 1;
            const latestAvg = Object.values(latest).reduce((a, b) => a + b, 0) / divisor;
            const prevAvg = Object.values(prev).reduce((a, b) => a + b, 0) / divisor;
            growth = prevAvg > 0 ? (((latestAvg - prevAvg) / prevAvg) * 100).toFixed(0) : 0;
        }

        const passed = selectedCompetencies.filter(id => {
            const score = data[id] || 0;
            const req = requirements[id] || 0;
            return score >= req;
        }).length;

        return { avg, growth, passed, total: selectedCompetencies.length };
    };

    const scoresForFilters = useMemo(
        () => getScoresForCurrentFilter(),
        [filterMode, selectedYears, dateRange, radarChartByCompetency]
    );

    if (dataLoading) {
        return <LoadingSkeleton />;
    }

    return (
        <CompetencyLayout
            activePage={activePage}
            onNavigate={setActivePage}
            user={user}
            loading={loading}
            onLogout={handleLogout}
        >
            {dataError && (
                <div className="card" style={{ margin: '1.5rem', color: '#b91c1c' }}>
                    {dataError}
                </div>
            )}
            {/* DASHBOARD PAGE */}
            {activePage === 'dashboard' && (
                <>
                    <div className="dashboard-grid">
                        {/* Chart Section */}
                        <CompetencyRadarChart
                            chartData={getChartData()}
                            competencies={competencies}
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
                            allCompetencies={competencies}
                            selectedCompetencies={selectedCompetencies}
                            onToggleCompetency={toggleCompetency}
                            filterMode={filterMode}
                            setFilterMode={setFilterMode}
                            years={availableYears}
                            months={MONTHS}
                            selectedYears={selectedYears}
                            onToggleYear={toggleYear}
                            dateRange={dateRange}
                            setDateRange={setDateRange}
                            showRequirement={showRequirement}
                            setShowRequirement={setShowRequirement}
                            category={category}
                            setCategory={setCategory}
                        />
                    </div>

                    {/* Activity Detail Card */}
                    <ActivityDetailPanel
                        activeCompetency={activeCompetency}
                        activeDetailYear={activeDetailYear}
                        setActiveCompetency={setActiveCompetency}
                        setActiveDetailYear={setActiveDetailYear}
                        competencies={competencies}
                        radarChartByCompetency={radarChartByCompetency}
                        filterMode={filterMode}
                        selectedYears={selectedYears}
                        dateRange={dateRange}
                    />

                    {/* Stats Cards */}
                    <CompetencyStats stats={getStats()} />

                    {/* Gap Analysis */}
                    <GapAnalysis
                        competencies={competencies.filter((comp) => selectedCompetencies.includes(comp.id))}
                        scores={scoresForFilters}
                        requirements={requirements}
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
                            <p>Student ID: 6530xxxxx</p>
                            <p>Faculty of Engineering</p>
                            <p>Computer Engineering</p>
                        </div>

                        <div className="activity-history card">
                            <div className="card-header">
                                <h2>
                                    <Award size={20} className="section-icon" />
                                    {t('activity_history')}
                                </h2>
                            </div>
                            <div className="activity-list">
                                {Object.values(activityHistory).flat()
                                .filter(act => act.type != 'course')
                                .slice(0, 5)
                                .map(act => (
                                    <div key={act.id} className="activity-item">
                                        <div className="activity-badge">{(act.type || 'A').charAt(0)}</div>
                                        <div className="activity-info">
                                            <h4>{act.title}</h4>
                                            <span>{act.date}</span>
                                        </div>
                                        <div className="activity-status verified">
                                            {t('verified')}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className='course-history-card'>
                                <div className="card-header" style={{ marginTop: '1.5rem' }}>
                                    <h2>
                                        <BookOpenText size={20} className="section-icon" />
                                        {t('course_history')}
                                    </h2>
                                </div>
                                <div className="course-history-list">
                                    {Object.values(courseHistory).flat().length === 0 ? (
                                        <div style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8' }}>
                                            {t('no_course_history')}
                                        </div>
                                    ) : (
                                        // ใช้ Set กรอง title ซ้ำออก
                                        [...new Map(
                                            Object.values(courseHistory).flat().map(c => [c.title, c])
                                        ).values()].map(course => (
                                            <div key={course.id} className="activity-item">
                                                <div className="activity-badge">C</div>
                                                <div className="activity-info">
                                                    <h4>{course.title}</h4>
                                                    <span>{course.year}</span>
                                                </div>
                                                <div className="activity-status verified">
                                                    {t('verified')}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
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
                                {t('activities')}
                            </h2>
                        </div>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>{t('activities')}</th>
                                    <th>{t('date')}</th>
                                    <th>{t('type')}</th>
                                    <th>{t('score')}</th>
                                    <th>{t('verified')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(radarChartByCompetency).flatMap(([compId, acts]) =>
                                    acts.map(act => {
                                        const comp = competencies.find(c => c.id === Number(compId));
                                        const Icon = comp?.icon;
                                        return (
                                            <tr key={act.id}>
                                                <td>{act.title}</td>
                                                <td>{act.date}</td>
                                                <td>
                                                    <span className="comp-badge" style={{ backgroundColor: `${comp?.color || '#64748b'}15`, color: comp?.color || '#64748b' }}>
                                                        {Icon && <Icon size={14} />}
                                                        <span>{comp?.name || 'สมรรถนะ'}</span>
                                                    </span>
                                                </td>
                                                <td><strong>+{formatNumber(act.score, 2)}</strong></td>
                                                <td>
                                                    <span className="status-badge verified">
                                                        ✓ {t('verified')}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Course Verify Table */}
                    <div className="verify-list card" style={{ marginTop: '3rem' }}>
                        <div className="card-header">
                            <h2>
                                <BookOpenText size={20} className="section-icon" />
                                {t('courses')}
                            </h2>
                        </div>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>{t('courses')}</th>
                                    <th>{t('year')}</th>
                                    <th>{t('score')}</th>
                                    <th>{t('verified')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.values(radarChartByCompetency).flat().map(course => (
                                    <tr key={course.id}>
                                        <td>{course.title}</td>
                                        <td>{course.year}</td>
                                        <td><strong>+{formatNumber(course.score, 2)}</strong></td>
                                        <td>
                                            <span className="status-badge verified">
                                                ✓ {t('verified')}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            <div>
                {console.log('Radar Chart Data:', { radarChartByCompetency })}
            </div>
        </CompetencyLayout>
    );
}

function normalizeYears(apiYears, activityMap) {
    const yearSet = new Set(apiYears);
    Object.values(activityMap).forEach((activities) => {
        activities.forEach((activity) => {
            if (activity.year) {
                yearSet.add(activity.year);
            }
        });
    });
    if (!yearSet.size) {
        const now = new Date();
        const beYear = now.getFullYear() + 543 + (now.getMonth() >= 5 ? 1 : 0);
        return [String(beYear)];
    }
    return Array.from(yearSet).sort((a, b) => Number(b) - Number(a));
}

function getScoresByYear(year, activityMap) {
    const scores = {};
    Object.keys(activityMap).forEach((compId) => {
        const activities = activityMap[compId] || [];
        const completed = activities.filter((activity) => activity.status === 'completed' && activity.year === year);
        const total = completed.reduce((sum, activity) => sum + (activity.score || 0), 0);
        scores[compId] = roundNumber(total, 2);
    });
    return scores;
}

function getScoresByDateRange(startYear, startMonth, endYear, endMonth, activityMap) {
    const scores = {};
    const startValue = Number(startYear) * 100 + Number(startMonth);
    const endValue = Number(endYear) * 100 + Number(endMonth);

    Object.keys(activityMap).forEach((compId) => {
        const activities = activityMap[compId] || [];
        const completed = activities.filter((activity) => {
            if (activity.status !== 'completed') return false;
            if (!activity.year || !activity.month) return false;
            const value = Number(activity.year) * 100 + Number(activity.month);
            return value >= startValue && value <= endValue;
        });
        const total = completed.reduce((sum, activity) => sum + (activity.score || 0), 0);
        scores[compId] = roundNumber(total, 2);
    });
    return scores;
}

function getCompetencyIcon(code) {
    const mapping = {
        tst_comm: MessageCircle,
        tst_ct: Brain,
        tst_team: Users,
        tst_lead: Crown,
        tst_ethic: Scale,
        tst_digi: Monitor,
    };
    return mapping[code] || Activity;
}

function getCompetencyColor(code) {
    const mapping = {
        tst_comm: '#ec4899',
        tst_ct: '#3b82f6',
        tst_team: '#06b6d4',
        tst_lead: '#f59e0b',
        tst_ethic: '#10b981',
        tst_digi: '#8b5cf6',
    };
    return mapping[code] || '#64748b';
}

function roundNumber(value, decimals) {
    const factor = 10 ** decimals;
    return Math.round((value + Number.EPSILON) * factor) / factor;
}

function formatNumber(value, decimals) {
    if (Number.isNaN(value)) return '0';
    return roundNumber(value, decimals).toFixed(decimals);
}
