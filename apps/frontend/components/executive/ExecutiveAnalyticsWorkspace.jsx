'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
    AlertTriangle,
    BarChart3,
    CheckCircle2,
    ChevronRight,
    Filter,
    GraduationCap,
    Loader2,
    Search,
    ShieldCheck,
    Users,
    X,
} from 'lucide-react';
import { useAuth } from '../../providers/auth-provider';
import { useLanguage } from '../../providers/LanguageContext';
import ExecutiveRadarChart from './ExecutiveRadarChart';
import {
    fetchExecutiveCompetency,
    fetchExecutiveComparison,
    fetchExecutiveOverview,
    fetchExecutiveScope,
    fetchExecutiveStudent,
    fetchExecutiveStudents,
} from '../../lib/executive-analytics';
import './ExecutiveAnalytics.css';

const FILTER_KEYS = ['faculty_id', 'major_id', 'curriculum_id', 'cohort_id', 'entry_year_be'];

function numeric(value) {
    if (!value) return '';
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : '';
}

function readFilters(searchParams, user) {
    const result = {};
    FILTER_KEYS.forEach((key) => {
        const value = numeric(searchParams.get(key));
        if (value) result[key] = value;
    });
    if (!result.faculty_id && user?.roles?.includes('admin') && user.faculty_id) {
        result.faculty_id = String(user.faculty_id);
    }
    return result;
}

function apiFilters(filters) {
    return Object.fromEntries(
        Object.entries(filters).filter(([, value]) => value !== undefined && value !== ''),
    );
}

function nameOf(item, language, fallback = '-') {
    if (!item) return fallback;
    return language === 'en'
        ? (item.name_en || item.name_th || item.code || fallback)
        : (item.name_th || item.name_en || item.code || fallback);
}

function score(value) {
    return Number(value || 0).toFixed(2);
}

function dateLabel(value) {
    return value || '-';
}

function readiness(item, language, t) {
    if (item?.ready) return t('executive_ready') || 'พร้อมใช้งาน';
    return language === 'en'
        ? (item?.readiness_message_en || 'Data is not ready')
        : (item?.readiness_message_th || 'ข้อมูลยังไม่พร้อม');
}

function metricValue(metrics, key) {
    return Number(metrics?.[key] || 0).toLocaleString();
}

function EmptyState({ children }) {
    return <div className="executive-empty-state">{children}</div>;
}

function LoadingState() {
    return (
        <div className="executive-loading">
            <Loader2 size={20} className="executive-spin" />
            <span>กำลังโหลดข้อมูล...</span>
        </div>
    );
}

function MetricCard({ label, value, note, icon: Icon, tone = '' }) {
    return (
        <div className={'executive-metric ' + tone}>
            <div className="executive-metric-icon"><Icon size={18} /></div>
            <div>
                <span>{label}</span>
                <strong>{value}</strong>
                {note && <small>{note}</small>}
            </div>
        </div>
    );
}

function FilterSelect({ label, value, options, placeholder, onChange, disabled, renderOption }) {
    return (
        <label className="executive-filter-field">
            <span>{label}</span>
            <select value={value || ''} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
                <option value="">{placeholder}</option>
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {renderOption ? renderOption(option) : option.label}
                    </option>
                ))}
            </select>
        </label>
    );
}

function Drawer({ title, onClose, children }) {
    return (
        <div className="executive-drawer-backdrop" role="presentation" onMouseDown={onClose}>
            <aside className="executive-drawer" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
                <header className="executive-drawer-header">
                    <h2>{title}</h2>
                    <button type="button" className="executive-icon-button" onClick={onClose} aria-label="ปิด">
                        <X size={18} />
                    </button>
                </header>
                <div className="executive-drawer-body">{children}</div>
            </aside>
        </div>
    );
}

export default function ExecutiveAnalyticsWorkspace({ view = 'overview' }) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { user } = useAuth();
    const { language, t } = useLanguage();
    const isEnglish = language === 'en';
    const filters = useMemo(
        () => readFilters(searchParams, user),
        [searchParams, user],
    );
    const filterQuery = useMemo(() => JSON.stringify(apiFilters(filters)), [filters]);

    const [scope, setScope] = useState({ faculties: [], majors: [], curricula: [], cohorts: [], entry_years: [] });
    const [overview, setOverview] = useState(null);
    const [comparison, setComparison] = useState([]);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [scopeLoading, setScopeLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [selectedCompetency, setSelectedCompetency] = useState(null);
    const [competencyDetail, setCompetencyDetail] = useState(null);
    const [studentDetail, setStudentDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);

    const updateFilter = useCallback((key, value) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value) params.set(key, value);
        else params.delete(key);
        if (key === 'faculty_id') {
            params.delete('major_id');
            params.delete('curriculum_id');
            params.delete('cohort_id');
        }
        if (key === 'major_id') {
            params.delete('curriculum_id');
            params.delete('cohort_id');
        }
        if (key === 'curriculum_id') params.delete('cohort_id');
        const next = params.toString();
        router.replace(next ? pathname + '?' + next : pathname);
    }, [pathname, router, searchParams]);

    useEffect(() => {
        let alive = true;
        setScopeLoading(true);
        fetchExecutiveScope(apiFilters(filters))
            .then((data) => {
                if (alive) setScope(data || { faculties: [], majors: [], curricula: [], cohorts: [], entry_years: [] });
            })
            .catch(() => {
                if (alive) setError(t('executive_load_error') || 'ไม่สามารถโหลดข้อมูลผู้บริหารได้');
            })
            .finally(() => {
                if (alive) setScopeLoading(false);
            });
        return () => { alive = false; };
    }, [filterQuery, filters, t]);

    useEffect(() => {
        let alive = true;
        setLoading(true);
        setError('');
        const requestFilters = apiFilters(filters);
        let request;
        if (view === 'comparison') request = fetchExecutiveComparison(requestFilters);
        else if (view === 'students') request = fetchExecutiveStudents(requestFilters);
        else request = fetchExecutiveOverview(requestFilters);
        request
            .then((data) => {
                if (!alive) return;
                if (view === 'comparison') setComparison(Array.isArray(data) ? data : []);
                else if (view === 'students') setStudents(Array.isArray(data) ? data : []);
                else setOverview(data || null);
            })
            .catch(() => {
                if (alive) setError(t('executive_load_error') || 'ไม่สามารถโหลดข้อมูลผู้บริหารได้');
            })
            .finally(() => {
                if (alive) setLoading(false);
            });
        return () => { alive = false; };
    }, [filterQuery, filters, t, view]);

    const openCompetency = async (item) => {
        setSelectedCompetency(item);
        setCompetencyDetail(null);
        setDetailLoading(true);
        try {
            const data = await fetchExecutiveCompetency(item.competency_id, apiFilters(filters));
            setCompetencyDetail(data);
        } catch {
            setError(t('executive_load_error') || 'ไม่สามารถโหลดรายละเอียดสมรรถนะได้');
        } finally {
            setDetailLoading(false);
        }
    };

    const openStudent = async (item) => {
        setDetailLoading(true);
        setStudentDetail(null);
        try {
            const data = await fetchExecutiveStudent(item.enrollment_id, apiFilters(filters));
            setStudentDetail(data);
        } catch {
            setError(t('executive_load_error') || 'ไม่สามารถโหลดรายละเอียดนักศึกษาได้');
        } finally {
            setDetailLoading(false);
        }
    };

    const activeCompetencies = overview?.competencies || [];
    const filteredStudents = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return students;
        return students.filter((item) => (
            String(item.student_code || '').toLowerCase().includes(query)
            || String(item.student_name_th || '').toLowerCase().includes(query)
            || String(item.student_name_en || '').toLowerCase().includes(query)
        ));
    }, [search, students]);

    const routeTabs = [
        { href: '/executive-management', label: t('executive_overview') || 'ภาพรวม' },
        { href: '/executive-management/competencies', label: t('executive_competencies') || 'ภาพรวมสมรรถนะ' },
        { href: '/executive-management/comparison', label: t('executive_comparison') || 'เปรียบเทียบรุ่น' },
        { href: '/executive-management/students', label: t('executive_students') || 'เจาะดูนักศึกษา' },
    ];

    const selectedFaculty = filters.faculty_id || '';
    const selectedMajor = filters.major_id || '';
    const selectedCurriculum = filters.curriculum_id || '';
    const selectedCohort = filters.cohort_id || '';
    const selectedYear = filters.entry_year_be || '';
    const overviewMetrics = overview?.metrics || {};

    return (
        <section className="executive-page">
            <header className="executive-page-header">
                <div>
                    <p className="executive-eyebrow">{t('executive_analytics') || 'วิเคราะห์ข้อมูลผู้บริหาร'}</p>
                    <h1>{isEnglish ? 'Faculty Competency Analytics' : 'ภาพรวมสมรรถนะระดับคณะ'}</h1>
                    <p>{isEnglish ? 'Read-only view of course competency outcomes and cohort targets.' : 'ดูภาพรวมผลลัพธ์สมรรถนะจากรายวิชาและเกณฑ์ของแต่ละรุ่น'}</p>
                </div>
                <div className="executive-scope-note">
                    <ShieldCheck size={18} />
                    <span>{user?.roles?.includes('dean') ? (isEnglish ? 'Faculty scope' : 'ข้อมูลเฉพาะคณะของคุณ') : (isEnglish ? 'Admin view' : 'มุมมองผู้ดูแลระบบ')}</span>
                </div>
            </header>

            <nav className="executive-tabs" aria-label="Executive analytics views">
                {routeTabs.map((tab) => (
                    <Link key={tab.href} href={tab.href} className={pathname === tab.href ? 'active' : ''}>
                        {tab.label}
                    </Link>
                ))}
            </nav>

            <section className="executive-filter-panel">
                <div className="executive-filter-heading">
                    <Filter size={18} />
                    <div>
                        <strong>{t('filters') || 'ตัวกรองข้อมูล'}</strong>
                        <span>{isEnglish ? 'Choose the scope to compare.' : 'เลือกขอบเขตข้อมูลที่ต้องการดู'}</span>
                    </div>
                </div>
                <div className="executive-filter-grid">
                    <FilterSelect
                        label={t('faculty') || 'คณะ'}
                        value={selectedFaculty}
                        options={(scope.faculties || []).map((item) => ({ value: item.faculty_id, label: nameOf(item, language) }))}
                        placeholder={isEnglish ? 'All faculties' : 'ทุกคณะ'}
                        onChange={(value) => updateFilter('faculty_id', value)}
                        disabled={user?.roles?.includes('dean') || scopeLoading}
                    />
                    <FilterSelect
                        label={t('major') || 'สาขา'}
                        value={selectedMajor}
                        options={(scope.majors || []).filter((item) => !selectedFaculty || String(item.faculty_id) === selectedFaculty).map((item) => ({ value: item.major_id, label: nameOf(item, language) }))}
                        placeholder={isEnglish ? 'All majors' : 'ทุกสาขา'}
                        onChange={(value) => updateFilter('major_id', value)}
                        disabled={scopeLoading}
                    />
                    <FilterSelect
                        label={t('curriculum') || 'หลักสูตร'}
                        value={selectedCurriculum}
                        options={(scope.curricula || []).map((item) => ({ value: item.curriculum_id, label: nameOf(item, language) + ' · ' + item.code }))}
                        placeholder={isEnglish ? 'All curricula' : 'ทุกหลักสูตร'}
                        onChange={(value) => updateFilter('curriculum_id', value)}
                        disabled={scopeLoading}
                    />
                    <FilterSelect
                        label={t('cohort') || 'รุ่นนักศึกษา'}
                        value={selectedCohort}
                        options={(scope.cohorts || []).map((item) => ({ value: item.cohort_id, label: nameOf(item, language) + ' · ' + item.entry_year_be }))}
                        placeholder={isEnglish ? 'All cohorts' : 'ทุกรุ่น'}
                        onChange={(value) => updateFilter('cohort_id', value)}
                        disabled={scopeLoading}
                    />
                    <FilterSelect
                        label={t('entry_year') || 'ปีเข้าเรียน'}
                        value={selectedYear}
                        options={(scope.entry_years || []).map((item) => ({ value: item, label: String(item) }))}
                        placeholder={isEnglish ? 'All years' : 'ทุกปี'}
                        onChange={(value) => updateFilter('entry_year_be', value)}
                        disabled={scopeLoading}
                    />
                </div>
            </section>

            {error && (
                <div className="executive-error" role="alert">
                    <AlertTriangle size={18} />
                    <span>{error}</span>
                    <button type="button" onClick={() => setError('')} aria-label="ปิด"><X size={16} /></button>
                </div>
            )}

            {loading ? <LoadingState /> : (
                <>
                    {(view === 'overview' || view === 'competencies') && (
                        <OverviewView
                            view={view}
                            overview={overview}
                            metrics={overviewMetrics}
                            competencies={activeCompetencies}
                            onCompetency={openCompetency}
                            language={language}
                            t={t}
                            isEnglish={isEnglish}
                        />
                    )}
                    {view === 'comparison' && (
                        <ComparisonView rows={comparison} language={language} t={t} isEnglish={isEnglish} />
                    )}
                    {view === 'students' && (
                        <StudentsView
                            students={filteredStudents}
                            search={search}
                            onSearch={setSearch}
                            onStudent={openStudent}
                            language={language}
                            t={t}
                            isEnglish={isEnglish}
                        />
                    )}
                </>
            )}

            {selectedCompetency && (
                <Drawer title={nameOf(selectedCompetency, language)} onClose={() => setSelectedCompetency(null)}>
                    {detailLoading ? <LoadingState /> : competencyDetail ? (
                        <CompetencyDrawer detail={competencyDetail} language={language} t={t} isEnglish={isEnglish} />
                    ) : <EmptyState>{t('executive_no_detail') || 'ยังไม่มีรายละเอียด'}</EmptyState>}
                </Drawer>
            )}
            {studentDetail && (
                <Drawer title={studentDetail.student?.student_code || ''} onClose={() => setStudentDetail(null)}>
                    {detailLoading ? <LoadingState /> : (
                        <StudentDrawer detail={studentDetail} language={language} t={t} isEnglish={isEnglish} />
                    )}
                </Drawer>
            )}
        </section>
    );
}

function OverviewView({ view, overview, metrics, competencies, onCompetency, language, t, isEnglish }) {
    if (!overview) return <EmptyState>{t('executive_no_data') || 'ยังไม่มีข้อมูลสำหรับขอบเขตที่เลือก'}</EmptyState>;
    return (
        <div className="executive-content">
            {view === 'overview' && (
                <>
                    <div className="executive-kpi-grid">
                        <MetricCard label={isEnglish ? 'Students' : 'นักศึกษา'} value={metricValue(metrics, 'students')} note={isEnglish ? 'in selected scope' : 'ในขอบเขตที่เลือก'} icon={Users} />
                        <MetricCard label={isEnglish ? 'Cohorts' : 'รุ่นนักศึกษา'} value={metricValue(metrics, 'cohorts')} note={metricValue(metrics, 'ready_cohorts') + ' พร้อมใช้งาน'} icon={GraduationCap} />
                        <MetricCard label={isEnglish ? 'Reached target' : 'ถึงเกณฑ์'} value={metricValue(metrics, 'students_at_target')} note={metricValue(metrics, 'students_evaluated') + ' มีผลคำนวณ'} icon={CheckCircle2} tone="success" />
                        <MetricCard label={isEnglish ? 'Not ready' : 'ข้อมูลยังไม่พร้อม'} value={metricValue(metrics, 'not_ready_cohorts')} note={isEnglish ? 'cohorts excluded from pass rate' : 'ไม่ถูกนับเป็นไม่ผ่าน'} icon={AlertTriangle} tone="warning" />
                    </div>
                    <div className="executive-main-grid">
                        <section className="executive-panel executive-radar-panel">
                            <PanelTitle icon={BarChart3} title={isEnglish ? 'Course competency overview' : 'ภาพรวมสมรรถนะจากรายวิชา'} description={isEnglish ? 'Course Total compared with cohort targets.' : 'คะแนนจากรายวิชาเทียบกับเกณฑ์ของรุ่น'} />
                            <ExecutiveRadarChart competencies={competencies} />
                        </section>
                        <section className="executive-panel">
                            <PanelTitle icon={GraduationCap} title={isEnglish ? 'Cohort readiness' : 'ความพร้อมของข้อมูลแต่ละรุ่น'} description={isEnglish ? 'Only ready cohorts are included in outcome statistics.' : 'เฉพาะรุ่นที่พร้อมเท่านั้นที่จะถูกนำไปคำนวณสถิติผลลัพธ์'} />
                            <div className="executive-cohort-list">
                                {(overview.cohorts || []).map((item) => (
                                    <div key={item.cohort_id} className="executive-cohort-row">
                                        <div>
                                            <strong>{nameOf(item, language)} · {item.entry_year_be}</strong>
                                            <span>{item.student_count.toLocaleString()} {isEnglish ? 'students' : 'รายชื่อ'}</span>
                                        </div>
                                        <span className={'executive-status ' + (item.ready ? 'ready' : 'pending')}>
                                            {readiness(item, language, t)}
                                        </span>
                                    </div>
                                ))}
                                {!overview.cohorts?.length && <EmptyState>{t('executive_no_cohort_data') || 'ยังไม่มีข้อมูลรุ่นนักศึกษา'}</EmptyState>}
                            </div>
                        </section>
                    </div>
                </>
            )}
            <div className="executive-secondary-grid">
                <section className="executive-panel">
                    <PanelTitle icon={ShieldCheck} title={isEnglish ? 'Competency ranking' : 'อันดับสมรรถนะ'} description={isEnglish ? 'Click a competency to see its course sources.' : 'กดเลือกสมรรถนะเพื่อดูว่าคะแนนมาจากวิชาใด'} />
                    <div className="executive-competency-list">
                        {competencies.map((item) => (
                            <button type="button" key={item.competency_id} className="executive-competency-row" onClick={() => onCompetency(item)}>
                                <span className="executive-rank-name">
                                    <strong>{nameOf(item, language)}</strong>
                                    <small>{item.is_required ? (isEnglish ? 'Required' : 'เกณฑ์จบ') : (isEnglish ? 'Track' : 'ติดตามผล')}</small>
                                </span>
                                <span className="executive-score">{score(item.average_score)}</span>
                                <ChevronRight size={17} />
                            </button>
                        ))}
                        {!competencies.length && <EmptyState>{t('executive_no_competency_data') || 'ยังไม่มีข้อมูลสมรรถนะที่พร้อมแสดง'}</EmptyState>}
                    </div>
                </section>
                <section className="executive-panel">
                    <PanelTitle icon={AlertTriangle} title={isEnglish ? 'Top areas to watch' : 'เรื่องที่ควรติดตาม'} description={isEnglish ? 'Required competencies with the lowest pass rate.' : 'สมรรถนะที่เป็นเกณฑ์จบและมีอัตราถึงเกณฑ์ต่ำ'} />
                    <div className="executive-attention-list">
                        {(overview.attention || []).map((item) => (
                            <button type="button" key={item.competency_id} className="executive-attention-row" onClick={() => onCompetency(item)}>
                                <span>{nameOf(item, language)}</span>
                                <strong>{score(item.pass_rate)}%</strong>
                            </button>
                        ))}
                        {!overview.attention?.length && <EmptyState>{t('executive_no_attention') || 'ยังไม่มีรายการที่ต้องติดตาม'}</EmptyState>}
                    </div>
                </section>
            </div>
        </div>
    );
}

function PanelTitle({ icon: Icon, title, description }) {
    return (
        <div className="executive-panel-title">
            <div className="executive-panel-title-icon"><Icon size={18} /></div>
            <div><h2>{title}</h2><p>{description}</p></div>
        </div>
    );
}

function ComparisonView({ rows, language, t, isEnglish }) {
    return (
        <section className="executive-panel">
            <PanelTitle icon={BarChart3} title={isEnglish ? 'Compare cohorts by entry year' : 'เปรียบเทียบรุ่นตามปีเข้าเรียน'} description={isEnglish ? 'Only competencies shared by all selected ready cohorts are shown.' : 'แสดงเฉพาะสมรรถนะที่มีร่วมกันในรุ่นที่พร้อมทั้งหมด'} />
            {!rows.length ? <EmptyState>{t('executive_no_comparison') || 'ยังไม่มีข้อมูลเปรียบเทียบที่พร้อมใช้'}</EmptyState> : (
                <div className="executive-table-wrap">
                    <table className="executive-table">
                        <thead><tr><th>{isEnglish ? 'Entry year' : 'ปีเข้าเรียน'}</th><th>{isEnglish ? 'Competency' : 'สมรรถนะ'}</th><th>{isEnglish ? 'Average' : 'ค่าเฉลี่ย'}</th><th>{isEnglish ? 'Pass rate' : 'อัตราถึงเกณฑ์'}</th><th>{isEnglish ? 'Evaluated' : 'มีผลคำนวณ'}</th></tr></thead>
                        <tbody>{rows.map((row) => <tr key={row.entry_year_be + '-' + row.competency_id}><td>{row.entry_year_be}</td><td><strong>{nameOf(row, language)}</strong><small>{row.cohort_count} {isEnglish ? 'cohorts' : 'รุ่น'}</small></td><td>{score(row.average_score)}</td><td>{score(row.pass_rate)}%</td><td>{row.evaluated_count}</td></tr>)}</tbody>
                    </table>
                </div>
            )}
        </section>
    );
}

function StudentsView({ students, search, onSearch, onStudent, language, t, isEnglish }) {
    return (
        <section className="executive-panel">
            <PanelTitle icon={Users} title={isEnglish ? 'Student drill-down' : 'ข้อมูลนักศึกษารายบุคคล'} description={isEnglish ? 'Read-only course competency results without contact information.' : 'ดูผลลัพธ์จากรายวิชาแบบอ่านอย่างเดียว โดยไม่แสดงข้อมูลติดต่อ'} />
            <label className="executive-search">
                <Search size={17} />
                <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder={isEnglish ? 'Search student code or name' : 'ค้นหารหัสหรือชื่อนักศึกษา'} />
            </label>
            {!students.length ? <EmptyState>{t('executive_no_student_data') || 'ยังไม่มีข้อมูลนักศึกษาที่พร้อมแสดง'}</EmptyState> : (
                <div className="executive-table-wrap">
                    <table className="executive-table">
                        <thead><tr><th>{isEnglish ? 'Student' : 'นักศึกษา'}</th><th>{isEnglish ? 'Cohort' : 'รุ่น'}</th><th>{isEnglish ? 'Course total' : 'คะแนนจากรายวิชา'}</th><th>{isEnglish ? 'Target' : 'เป้าหมาย'}</th><th>{isEnglish ? 'Status' : 'สถานะ'}</th><th /></tr></thead>
                        <tbody>{students.map((student) => <tr key={student.enrollment_id}><td><strong>{student.student_code}</strong><small>{language === 'en' ? (student.student_name_en || student.student_name_th) : student.student_name_th}</small></td><td>{student.curriculum_code} · {student.entry_year_be}</td><td>{student.ready ? score(student.course_total_score) : '-'}</td><td>{student.ready ? score(student.target_score) : '-'}</td><td><span className={'executive-status ' + (student.ready ? (student.passed ? 'ready' : 'pending') : 'pending')}>{student.ready ? (student.passed ? (isEnglish ? 'At target' : 'ถึงเกณฑ์') : (isEnglish ? 'Below target' : 'ต่ำกว่าเกณฑ์')) : (isEnglish ? 'Not ready' : 'ข้อมูลยังไม่พร้อม')}</span></td><td><button type="button" className="executive-text-button" onClick={() => onStudent(student)}>{isEnglish ? 'View' : 'ดูข้อมูล'} <ChevronRight size={15} /></button></td></tr>)}</tbody>
                    </table>
                </div>
            )}
        </section>
    );
}

function CompetencyDrawer({ detail, language, t, isEnglish }) {
    return (
        <>
            <div className="executive-detail-summary"><strong>{score(detail.competency?.average_score)}</strong><span>{isEnglish ? 'average score' : 'คะแนนเฉลี่ย'}</span><small>{detail.competency?.is_required ? (isEnglish ? 'Required competency' : 'สมรรถนะเกณฑ์จบ') : (isEnglish ? 'Tracking only' : 'ติดตามผล')}</small></div>
            <h3>{isEnglish ? 'Cohort results' : 'ผลลัพธ์รายรุ่น'}</h3>
            <div className="executive-detail-list">{(detail.cohorts || []).map((item) => <div className="executive-detail-row" key={item.cohort_id}><span>{item.entry_year_be || item.cohort_id}</span><strong>{score(item.average_score)}</strong><small>{score(item.pass_rate)}% {isEnglish ? 'at target' : 'ถึงเกณฑ์'}</small></div>)}</div>
            <h3>{isEnglish ? 'Course sources' : 'วิชาที่สร้างคะแนน'}</h3>
            <div className="executive-detail-list">{(detail.sources || []).map((item, index) => <div className="executive-detail-row" key={item.course_id + '-' + index}><span>{item.course_code}</span><strong>{item.course_name_th}</strong><small>{score(item.contribution)} · {item.student_count} {isEnglish ? 'students' : 'คน'}</small></div>)}{!detail.sources?.length && <EmptyState>{t('executive_no_sources') || 'ยังไม่มีข้อมูลที่มา'}</EmptyState>}</div>
        </>
    );
}

function StudentDrawer({ detail, language, t, isEnglish }) {
    const student = detail.student || {};
    return (
        <>
            <div className="executive-student-heading"><strong>{student.student_code}</strong><span>{language === 'en' ? (student.student_name_en || student.student_name_th) : student.student_name_th}</span><small>{student.curriculum_code} · {student.entry_year_be}</small></div>
            <h3>{isEnglish ? 'Competency results' : 'ผลลัพธ์สมรรถนะ'}</h3>
            <div className="executive-detail-list">{(detail.competencies || []).map((item) => <div className="executive-detail-row" key={item.competency_id}><span>{nameOf(item, language)}</span><strong>{item.has_score ? score(item.course_total_score) : '-'}</strong><small>{item.is_required ? (isEnglish ? 'Required' : 'เกณฑ์จบ') : (isEnglish ? 'Track' : 'ติดตามผล')}</small></div>)}</div>
            <h3>{isEnglish ? 'Course sources' : 'วิชาที่สร้างคะแนน'}</h3>
            <div className="executive-detail-list">{(detail.sources || []).map((item, index) => <div className="executive-detail-row" key={item.course_id + '-' + index}><span>{item.course_code}</span><strong>{item.course_name_th}</strong><small>{score(item.contribution)}</small></div>)}{!detail.sources?.length && <EmptyState>{t('executive_no_sources') || 'ยังไม่มีข้อมูลที่มา'}</EmptyState>}</div>
        </>
    );
}
