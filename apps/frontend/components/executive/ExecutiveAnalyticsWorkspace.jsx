"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  ChevronRight,
  Filter,
  GraduationCap,
  Info,
  LockKeyhole,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Target,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "../../providers/auth-provider";
import { useLanguage } from "../../providers/LanguageContext";
import ExecutiveRadarChart from "./ExecutiveRadarChart";
import {
  fetchExecutiveCompetency,
  fetchExecutiveComparison,
  fetchExecutiveOverview,
  fetchExecutiveScope,
  fetchExecutiveStudent,
  fetchExecutiveStudents,
} from "../../lib/executive-analytics";
import "./ExecutiveAnalytics.css";

const FILTER_KEYS = [
  "faculty_id",
  "major_id",
  "curriculum_id",
  "cohort_id",
  "entry_year_be",
];

function numeric(value) {
  if (!value) return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : "";
}

function readFilters(searchParams, user) {
  const result = {};
  FILTER_KEYS.forEach((key) => {
    const value = numeric(searchParams.get(key));
    if (value) result[key] = value;
  });
  if (!result.faculty_id && user?.roles?.includes("admin") && user.faculty_id) {
    result.faculty_id = String(user.faculty_id);
  }
  return result;
}

function apiFilters(filters) {
  return Object.fromEntries(
    Object.entries(filters).filter(
      ([, value]) => value !== undefined && value !== "",
    ),
  );
}

function nameOf(item, language, fallback = "-") {
  if (!item) return fallback;
  const nameTH = item.name_th || item.curriculum_name_th || "";
  const nameEN = item.name_en || item.curriculum_name_en || "";
  const code = item.code || item.curriculum_code || "";
  return language === "en"
    ? nameEN || nameTH || code || fallback
    : nameTH || nameEN || code || fallback;
}

function score(value) {
  return Number(value || 0).toFixed(2);
}

function studentCompetencyOutcome(item, isEnglish) {
  if (!item.is_required)
    return { label: isEnglish ? "For tracking" : "ติดตามผล", tone: "tracking" };
  const target = isEnglish
    ? " (target " + score(item.target_score) + " points)"
    : " (เป้าหมาย " + score(item.target_score) + " คะแนน)";
  if (!item.has_score)
    return {
      label: (isEnglish ? "Not calculated yet" : "ยังไม่มีผลคำนวณ") + target,
      tone: "pending",
    };
  return item.passed
    ? {
        label: (isEnglish ? "At target" : "ผ่านเกณฑ์") + target,
        tone: "passed",
      }
    : {
        label: (isEnglish ? "Below target" : "ยังไม่ผ่านเกณฑ์") + target,
        tone: "below-target",
      };
}

function dateLabel(value) {
  return value || "-";
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

function MetricCard({ label, value, note, icon: Icon, tone = "" }) {
  return (
    <div className={"executive-metric " + tone}>
      <div>
        <span className="executive-metric-label">
          <Icon size={16} />
          {label}
        </span>
        <strong>{value}</strong>
        {note && <small>{note}</small>}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  placeholder,
  onChange,
  disabled,
  renderOption,
}) {
  return (
    <label className="executive-filter-field">
      <span>{label}</span>
      <select
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
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
    <div
      className="executive-drawer-backdrop"
      role="presentation"
      onMouseDown={onClose}
    >
      <aside
        className="executive-drawer"
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="executive-drawer-header">
          <h2>{title}</h2>
          <button
            type="button"
            className="executive-icon-button"
            onClick={onClose}
            aria-label="ปิด"
          >
            <X size={18} />
          </button>
        </header>
        <div className="executive-drawer-body">{children}</div>
      </aside>
    </div>
  );
}

export default function ExecutiveAnalyticsWorkspace({ view = "overview" }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const isEnglish = language === "en";
  const filters = useMemo(
    () => readFilters(searchParams, user),
    [searchParams, user],
  );
  const filterQuery = useMemo(
    () => JSON.stringify(apiFilters(filters)),
    [filters],
  );
  const hasDeanScope = user?.roles?.includes("dean");

  const [scope, setScope] = useState({
    faculties: [],
    majors: [],
    curricula: [],
    cohorts: [],
    entry_years: [],
  });
  const [overview, setOverview] = useState(null);
  const [comparison, setComparison] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scopeLoading, setScopeLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedCompetency, setSelectedCompetency] = useState(null);
  const [competencyDetail, setCompetencyDetail] = useState(null);
  const [studentDetail, setStudentDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const updateFilter = useCallback(
    (key, value) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      if (key === "faculty_id") {
        params.delete("major_id");
        params.delete("curriculum_id");
        params.delete("cohort_id");
      }
      if (key === "major_id") {
        params.delete("curriculum_id");
        params.delete("cohort_id");
      }
      if (key === "curriculum_id") params.delete("cohort_id");
      const next = params.toString();
      router.replace(next ? pathname + "?" + next : pathname);
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    let alive = true;
    setScopeLoading(true);
    fetchExecutiveScope(apiFilters(filters))
      .then((data) => {
        if (alive)
          setScope(
            data || {
              faculties: [],
              majors: [],
              curricula: [],
              cohorts: [],
              entry_years: [],
            },
          );
      })
      .catch(() => {
        if (alive)
          setError(
            t("executive_load_error") || "ไม่สามารถโหลดข้อมูลผู้บริหารได้",
          );
      })
      .finally(() => {
        if (alive) setScopeLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [filterQuery, filters, refreshKey, t]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    const requestFilters = apiFilters(filters);
    let request;
    if (view === "comparison")
      request = fetchExecutiveComparison(requestFilters);
    else if (view === "students")
      request = fetchExecutiveStudents(requestFilters);
    else request = fetchExecutiveOverview(requestFilters);
    request
      .then((data) => {
        if (!alive) return;
        if (view === "comparison")
          setComparison(Array.isArray(data) ? data : []);
        else if (view === "students")
          setStudents(Array.isArray(data) ? data : []);
        else setOverview(data || null);
      })
      .catch(() => {
        if (alive)
          setError(
            t("executive_load_error") || "ไม่สามารถโหลดข้อมูลผู้บริหารได้",
          );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [filterQuery, filters, refreshKey, t, view]);

  const openCompetency = async (item) => {
    setSelectedCompetency(item);
    setCompetencyDetail(null);
    setDetailLoading(true);
    try {
      const data = await fetchExecutiveCompetency(
        item.competency_id,
        apiFilters(filters),
      );
      setCompetencyDetail(data);
    } catch {
      setError(
        t("executive_load_error") || "ไม่สามารถโหลดรายละเอียดสมรรถนะได้",
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const openStudent = async (item) => {
    setDetailLoading(true);
    setStudentDetail(null);
    try {
      const data = await fetchExecutiveStudent(
        item.enrollment_id,
        apiFilters(filters),
      );
      setStudentDetail(data);
    } catch {
      setError(
        t("executive_load_error") || "ไม่สามารถโหลดรายละเอียดนักศึกษาได้",
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const activeCompetencies = overview?.competencies || [];
  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return students;
    return students.filter(
      (item) =>
        String(item.student_code || "")
          .toLowerCase()
          .includes(query) ||
        String(item.student_name_th || "")
          .toLowerCase()
          .includes(query) ||
        String(item.student_name_en || "")
          .toLowerCase()
          .includes(query),
    );
  }, [search, students]);

  const selectedFaculty = filters.faculty_id || "";
  const selectedMajor = filters.major_id || "";
  const selectedCurriculum = filters.curriculum_id || "";
  const selectedCohort = filters.cohort_id || "";
  const overviewMetrics = overview?.metrics || {};

  return (
    <section className="executive-page">
      <header className="executive-page-header executive-topbar">
        <div>
          <p className="executive-eyebrow">
            <ShieldCheck size={15} />
            {hasDeanScope
              ? isEnglish
                ? "Your faculty data"
                : "ข้อมูลภายในคณะของคุณ"
              : t("executive_analytics") || "วิเคราะห์ข้อมูลผู้บริหาร"}
          </p>
          <h1>
            {isEnglish
              ? "Faculty Competency Analytics"
              : "ภาพรวมสมรรถนะระดับคณะ"}
          </h1>
          <p>
            {isEnglish
              ? "Read-only view of course competency outcomes and cohort targets."
              : "ดูภาพรวมผลลัพธ์สมรรถนะจากรายวิชาและเกณฑ์ของแต่ละรุ่น"}
          </p>
        </div>
        <div className="executive-top-actions">
          <button
            type="button"
            className="executive-refresh-button"
            onClick={() => setRefreshKey((current) => current + 1)}
            disabled={loading || scopeLoading}
          >
            <RefreshCw
              size={16}
              className={loading || scopeLoading ? "executive-spin" : ""}
            />
            {isEnglish ? "Refresh" : "โหลดใหม่"}
          </button>
        </div>
      </header>

      <section className="executive-filter-panel executive-scopebar">
        <div
          className={
            "executive-filter-grid " +
            (hasDeanScope ? "dean-scope" : "admin-scope")
          }
        >
          {!hasDeanScope && (
            <FilterSelect
              label={isEnglish ? "Faculty" : "คณะ"}
              value={selectedFaculty}
              options={(scope.faculties || []).map((item) => ({
                value: item.faculty_id,
                label: nameOf(item, language),
              }))}
              placeholder={isEnglish ? "All faculties" : "ทุกคณะ"}
              onChange={(value) => updateFilter("faculty_id", value)}
              disabled={scopeLoading}
            />
          )}
          <FilterSelect
            label={isEnglish ? "Major" : "สาขา"}
            value={selectedMajor}
            options={(scope.majors || [])
              .filter(
                (item) =>
                  !selectedFaculty ||
                  String(item.faculty_id) === selectedFaculty,
              )
              .map((item) => ({
                value: item.major_id,
                label: nameOf(item, language),
              }))}
            placeholder={isEnglish ? "All majors" : "ทุกสาขา"}
            onChange={(value) => updateFilter("major_id", value)}
            disabled={scopeLoading}
          />
          <FilterSelect
            label={isEnglish ? "Curriculum" : "หลักสูตร"}
            value={selectedCurriculum}
            options={(scope.curricula || []).map((item) => ({
              value: item.curriculum_id,
              label: nameOf(item, language),
            }))}
            placeholder={isEnglish ? "All curricula" : "ทุกหลักสูตร"}
            onChange={(value) => updateFilter("curriculum_id", value)}
            disabled={scopeLoading}
          />
          <FilterSelect
            label={isEnglish ? "Student cohort" : "รุ่นนักศึกษา"}
            value={selectedCohort}
            options={(scope.cohorts || []).map((item) => ({
              value: item.cohort_id,
              label:
                nameOf(item, language) +
                (isEnglish ? " (entered " : " (ปีเข้า ") +
                item.entry_year_be +
                ")",
            }))}
            placeholder={isEnglish ? "All cohorts" : "ทุกรุ่น"}
            onChange={(value) => updateFilter("cohort_id", value)}
            disabled={scopeLoading}
          />
        </div>
        <div className="executive-scope-lock">
          {hasDeanScope ? <LockKeyhole size={15} /> : <Filter size={15} />}
          <span>
            {hasDeanScope
              ? isEnglish
                ? "Limited to your faculty"
                : "จำกัดเฉพาะคณะของคุณ"
              : isEnglish
                ? "Faculty can be changed"
                : "เลือกดูข้อมูลตามคณะที่ต้องการ"}
          </span>
        </div>
      </section>

      <div className="executive-data-note">
        <Info size={16} />
        <span>
          {isEnglish
            ? "Results use current Course Total and cohort competency targets. Activity scores are not included."
            : "ข้อมูลนี้ใช้คะแนนจากรายวิชาและเกณฑ์สมรรถนะของรุ่น คะแนนกิจกรรมยังไม่รวมในหน้านี้"}
        </span>
      </div>

      {error && (
        <div className="executive-error" role="alert">
          <AlertTriangle size={18} />
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} aria-label="ปิด">
            <X size={16} />
          </button>
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : (
        <>
          {(view === "overview" || view === "competencies") && (
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
          {view === "comparison" && (
            <ComparisonView
              rows={comparison}
              scope={scope}
              filters={filters}
              onCurriculumChange={(value) =>
                updateFilter("curriculum_id", value)
              }
              language={language}
              t={t}
              isEnglish={isEnglish}
            />
          )}
          {view === "students" && (
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
        <Drawer
          title={nameOf(selectedCompetency, language)}
          onClose={() => setSelectedCompetency(null)}
        >
          {detailLoading ? (
            <LoadingState />
          ) : competencyDetail ? (
            <CompetencyDrawer
              detail={competencyDetail}
              language={language}
              t={t}
              isEnglish={isEnglish}
            />
          ) : (
            <EmptyState>
              {t("executive_no_detail") || "ยังไม่มีรายละเอียด"}
            </EmptyState>
          )}
        </Drawer>
      )}
      {studentDetail && (
        <Drawer
          title={studentDetail.student?.student_code || ""}
          onClose={() => setStudentDetail(null)}
        >
          {detailLoading ? (
            <LoadingState />
          ) : (
            <StudentDrawer
              detail={studentDetail}
              language={language}
              t={t}
              isEnglish={isEnglish}
            />
          )}
        </Drawer>
      )}
    </section>
  );
}

function OverviewView({
  view,
  overview,
  metrics,
  competencies,
  onCompetency,
  language,
  t,
  isEnglish,
}) {
  if (!overview)
    return (
      <EmptyState>
        {t("executive_no_data") || "ยังไม่มีข้อมูลสำหรับขอบเขตที่เลือก"}
      </EmptyState>
    );
  return (
    <div className="executive-content">
      {view === "overview" && (
        <>
          <div className="executive-kpi-grid">
            <MetricCard
              label={
                isEnglish ? "Students with results" : "นักศึกษาที่มีข้อมูล"
              }
              value={metricValue(metrics, "students_evaluated")}
              note={
                metricValue(metrics, "students") +
                (isEnglish ? " students in scope" : " รายชื่อในขอบเขต")
              }
              icon={Users}
            />
            <MetricCard
              label={isEnglish ? "Active cohorts" : "รุ่นที่กำลังใช้งาน"}
              value={metricValue(metrics, "ready_cohorts")}
              note={
                metricValue(metrics, "cohorts") +
                (isEnglish ? " selected cohorts" : " รุ่นในขอบเขต")
              }
              icon={GraduationCap}
            />
            <MetricCard
              label={isEnglish ? "Reached cohort target" : "ถึงเกณฑ์หลักสูตร"}
              value={metricValue(metrics, "students_at_target")}
              note={
                metricValue(metrics, "students_evaluated") +
                (isEnglish ? " evaluated" : " คนที่คำนวณแล้ว")
              }
              icon={Target}
              tone="success"
            />
            <MetricCard
              label={isEnglish ? "Needs data setup" : "ข้อมูลยังไม่พร้อม"}
              value={metricValue(metrics, "not_ready_cohorts")}
              note={
                isEnglish
                  ? "not counted as below target"
                  : "ไม่นับเป็นผู้ไม่ผ่าน"
              }
              icon={AlertTriangle}
              tone="warning"
            />
          </div>
          <div className="executive-main-grid">
            <section className="executive-panel executive-radar-panel">
              <PanelTitle
                icon={BarChart3}
                title={
                  isEnglish
                    ? "Course competency overview"
                    : "ภาพรวมสมรรถนะจากรายวิชา"
                }
                description={
                  isEnglish
                    ? "Course Total compared with cohort targets."
                    : "คะแนนจากรายวิชาเทียบกับเกณฑ์ของรุ่น"
                }
              />
              <ExecutiveRadarChart competencies={competencies} />
            </section>
            <section className="executive-panel">
              <PanelTitle
                icon={AlertTriangle}
                title={
                  isEnglish
                    ? "Competencies furthest from their targets"
                    : "สมรรถนะที่ผู้เรียนยังไปไม่ถึงเป้าหมายมากที่สุด"
                }
                description={
                  isEnglish
                    ? "These are required competencies where the fewest evaluated learners have reached their cohort targets."
                    : "เป็นสมรรถนะที่ใช้เป็นเกณฑ์จบ และมีผู้เรียนที่คำนวณผลแล้วทำคะแนนถึงเป้าหมายของรุ่นนักศึกษาน้อยกว่าด้านอื่น"
                }
              />
              <div className="executive-attention-list executive-attention-cards">
                {(overview.attention || []).map((item) => (
                  <button
                    type="button"
                    key={item.competency_id}
                    className="executive-attention-row"
                    onClick={() => onCompetency(item)}
                  >
                    <span className="executive-attention-icon">
                      <AlertTriangle size={16} />
                    </span>
                    <span className="executive-attention-copy">
                      <strong>{nameOf(item, language)}</strong>
                      <small>
                        {isEnglish
                          ? "Learners who reached their cohort target"
                          : "ผู้เรียนที่ทำคะแนนถึงเป้าหมายของรุ่นนักศึกษา"}
                      </small>
                    </span>
                    <b>{score(item.pass_rate)}%</b>
                  </button>
                ))}
                {!overview.attention?.length && (
                  <EmptyState>
                    {t("executive_no_attention") ||
                      "ยังไม่มีรายการที่ต้องติดตาม"}
                  </EmptyState>
                )}
              </div>
            </section>
          </div>
        </>
      )}
      {view === "competencies" && (
        <section className="executive-panel executive-competency-directory">
          <PanelTitle
            icon={ShieldCheck}
            title={
              isEnglish ? "All competency outcomes" : "ผลลัพธ์ของสมรรถนะทั้งหมด"
            }
            description={
              isEnglish
                ? "Review the average score, target, and learner attainment for every competency. Select a row to see contributing courses."
                : "ตรวจดูคะแนนเฉลี่ย เป้าหมาย และสัดส่วนผู้เรียนที่ถึงเป้าหมายของสมรรถนะทุกด้าน แล้วกดเพื่อดูรายวิชาที่สร้างคะแนน"
            }
          />
          <div className="executive-competency-list">
            {competencies.map((item) => (
              <button
                type="button"
                key={item.competency_id}
                className="executive-competency-row executive-competency-row--detail"
                onClick={() => onCompetency(item)}
              >
                <span className="executive-rank-name">
                  <strong>{nameOf(item, language)}</strong>
                  <small>
                    {item.is_required
                      ? isEnglish
                        ? "Graduation criterion"
                        : "ใช้เป็นเกณฑ์จบ"
                      : isEnglish
                        ? "For tracking"
                        : "ใช้ติดตามผล"}
                  </small>
                </span>
                <span className="executive-competency-progress">
                  <span className="executive-competency-track">
                    <i
                      style={{
                        width:
                          Math.min(100, Number(item.average_score || 0)) + "%",
                      }}
                    />
                  </span>
                  <small>
                    {isEnglish ? "Average score" : "คะแนนเฉลี่ย"}{" "}
                    <b>{score(item.average_score)}</b>
                  </small>
                </span>
                <span className="executive-competency-metric">
                  <small>{isEnglish ? "Target" : "เป้าหมาย"}</small>
                  <b>{item.is_required ? score(item.target_score) : "-"}</b>
                </span>
                <span className="executive-competency-metric">
                  <small>
                    {isEnglish
                      ? "Reached target"
                      : "สัดส่วนนักศึกษาที่ถึงเป้าหมาย"}
                  </small>
                  <b>{item.is_required ? score(item.pass_rate) + "%" : "-"}</b>
                </span>
                <ChevronRight size={17} />
              </button>
            ))}
            {!competencies.length && (
              <EmptyState>
                {t("executive_no_competency_data") ||
                  "ยังไม่มีข้อมูลสมรรถนะที่พร้อมแสดง"}
              </EmptyState>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function PanelTitle({ icon: Icon, title, description }) {
  return (
    <div className="executive-panel-title">
      <div className="executive-panel-title-icon">
        <Icon size={18} />
      </div>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </div>
  );
}

function ComparisonView({
  rows,
  scope,
  filters,
  onCurriculumChange,
  language,
  t,
  isEnglish,
}) {
  const [selectedYears, setSelectedYears] = useState([]);
  const [selectedCompetencyIDs, setSelectedCompetencyIDs] = useState([]);
  const availableYears = useMemo(
    () =>
      Array.from(new Set(rows.map((row) => Number(row.entry_year_be)))).sort(
        (left, right) => left - right,
      ),
    [rows],
  );
  const competencyOptions = useMemo(() => {
    const seen = new Map();
    rows.forEach((row) => {
      if (!seen.has(String(row.competency_id)))
        seen.set(String(row.competency_id), row);
    });
    return Array.from(seen.values()).sort((left, right) =>
      nameOf(left, language).localeCompare(nameOf(right, language)),
    );
  }, [language, rows]);
  const filteredRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          (!selectedYears.length ||
            selectedYears.includes(Number(row.entry_year_be))) &&
          (!selectedCompetencyIDs.length ||
            selectedCompetencyIDs.includes(String(row.competency_id))),
      ),
    [rows, selectedCompetencyIDs, selectedYears],
  );
  const series = useMemo(() => {
    const grouped = new Map();
    filteredRows.forEach((row) => {
      const key = String(row.competency_id);
      const current = grouped.get(key) || {
        ...row,
        rows: [],
        minimum: Number.POSITIVE_INFINITY,
        maximum: Number.NEGATIVE_INFINITY,
      };
      const value = Number(row.average_score || 0);
      current.rows.push(row);
      current.minimum = Math.min(current.minimum, value);
      current.maximum = Math.max(current.maximum, value);
      grouped.set(key, current);
    });
    return Array.from(grouped.values())
      .map((item) => ({ ...item, spread: item.maximum - item.minimum }))
      .sort(
        (left, right) =>
          right.spread - left.spread ||
          nameOf(left, language).localeCompare(nameOf(right, language)),
      )
      .slice(0, 8);
  }, [filteredRows, language]);

  const years = useMemo(
    () =>
      Array.from(
        new Set(filteredRows.map((row) => Number(row.entry_year_be))),
      ).sort((left, right) => left - right),
    [filteredRows],
  );
  const scaleMaximum = Math.max(
    100,
    ...series.flatMap((item) =>
      item.rows.map((row) => Number(row.average_score || 0)),
    ),
  );
  const impactSummaries = useMemo(
    () =>
      series.map((item) => {
        const values = [...item.rows].sort(
          (left, right) =>
            Number(left.average_score || 0) - Number(right.average_score || 0),
        );
        return {
          ...item,
          lowest: values[0],
          highest: values[values.length - 1],
        };
      }),
    [series],
  );
  const canCompare = years.length >= 2 && series.length > 0;

  const toggleYear = (year) => {
    setSelectedYears((current) =>
      current.includes(year)
        ? current.filter((item) => item !== year)
        : [...current, year],
    );
  };
  const toggleCompetency = (competencyID) => {
    setSelectedCompetencyIDs((current) =>
      current.includes(competencyID)
        ? current.filter((item) => item !== competencyID)
        : [...current, competencyID],
    );
  };

  return (
    <>
      <section className="executive-panel executive-comparison-panel">
        <PanelTitle
          icon={BarChart3}
          title={
            isEnglish
              ? "Compare competency results by cohort"
              : "เปรียบเทียบผลสมรรถนะระหว่างรุ่น"
          }
          description={
            isEnglish
              ? "Choose a curriculum, cohorts, and competencies to compare their average course scores."
              : "เลือกหลักสูตร รุ่น และสมรรถนะที่ต้องการ เพื่อเปรียบเทียบคะแนนเฉลี่ยจากรายวิชา"
          }
        />
        {!rows.length ? (
          <EmptyState>
            {t("executive_no_comparison") ||
              "ยังไม่มีข้อมูลเปรียบเทียบที่พร้อมใช้"}
          </EmptyState>
        ) : (
          <>
            <div className="executive-comparison-controls">
              <label className="executive-comparison-select">
                <span>
                  {isEnglish ? "Curriculum" : "หลักสูตรที่ต้องการเปรียบเทียบ"}
                </span>
                <select
                  value={filters.curriculum_id || ""}
                  onChange={(event) => onCurriculumChange(event.target.value)}
                >
                  <option value="">
                    {isEnglish ? "All curricula" : "ทุกหลักสูตร"}
                  </option>
                  {(scope.curricula || []).map((item) => (
                    <option key={item.curriculum_id} value={item.curriculum_id}>
                      {nameOf(item, language)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="executive-comparison-choice">
                <span>
                  {isEnglish
                    ? "Cohorts to compare"
                    : "รุ่นที่ต้องการเปรียบเทียบ"}
                </span>
                <div className="executive-choice-chips">
                  {availableYears.map((year) => (
                    <button
                      type="button"
                      key={year}
                      className={
                        !selectedYears.length || selectedYears.includes(year)
                          ? "active"
                          : ""
                      }
                      onClick={() => toggleYear(year)}
                    >
                      {isEnglish ? "Cohort " : "รุ่น "}
                      {year}
                    </button>
                  ))}
                </div>
              </div>
              <div className="executive-comparison-choice executive-comparison-choice--competencies">
                <span>
                  {isEnglish
                    ? "Competencies to compare"
                    : "สมรรถนะที่ต้องการเปรียบเทียบ"}
                </span>
                <div className="executive-choice-chips">
                  {competencyOptions.map((item) => {
                    const competencyID = String(item.competency_id);
                    return (
                      <button
                        type="button"
                        key={competencyID}
                        className={
                          !selectedCompetencyIDs.length ||
                          selectedCompetencyIDs.includes(competencyID)
                            ? "active"
                            : ""
                        }
                        onClick={() => toggleCompetency(competencyID)}
                      >
                        {nameOf(item, language)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            {canCompare ? (
              <>
                <div
                  className="executive-comparison-key"
                  aria-label={
                    isEnglish ? "Competency legend" : "คำอธิบายสีของสมรรถนะ"
                  }
                >
                  {series.map((item, index) => (
                    <span
                      key={item.competency_id}
                      className={"executive-comparison-key-item tone-" + index}
                    >
                      <i />
                      {nameOf(item, language)}
                    </span>
                  ))}
                </div>
                <div className="executive-bar-scroll">
                  <div
                    className="executive-bar-chart"
                    role="img"
                    aria-label={
                      isEnglish
                        ? "Average competency scores by entry year"
                        : "กราฟเปรียบเทียบคะแนนสมรรถนะเฉลี่ยตามปีเข้าเรียน"
                    }
                  >
                    {years.map((year) => (
                      <div className="executive-bar-group" key={year}>
                        <div
                          className="executive-bar-set"
                          style={{ "--bar-count": series.length }}
                        >
                          {series.map((item, index) => {
                            const matching = item.rows.find(
                              (row) => Number(row.entry_year_be) === year,
                            );
                            const value = Number(matching?.average_score || 0);
                            return (
                              <div
                                key={item.competency_id}
                                className={"executive-bar tone-" + index}
                                style={{
                                  height: (value / scaleMaximum) * 100 + "%",
                                }}
                              >
                                <span>{score(value)}</span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="executive-bar-label">
                          {isEnglish ? "Cohort " + year : "รุ่น " + year}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <EmptyState>
                {isEnglish
                  ? "Select at least two cohorts to compare."
                  : "เลือกอย่างน้อยสองรุ่นเพื่อเริ่มเปรียบเทียบ"}
              </EmptyState>
            )}
          </>
        )}
      </section>

      {canCompare && (
        <section className="executive-panel executive-comparison-summary">
          <PanelTitle
            icon={Info}
            title={
              isEnglish
                ? "Clear differences to review"
                : "สรุปความแตกต่างที่เห็นชัด"
            }
            description={
              isEnglish
                ? "These cards show the largest score gaps among the choices above."
                : "บัตรเหล่านี้แสดงสมรรถนะที่มีคะแนนเฉลี่ยต่างกันมากที่สุดจากตัวเลือกด้านบน"
            }
          />
          <div className="executive-impact-cards">
            {impactSummaries.slice(0, 3).map((item) => (
              <article
                key={item.competency_id}
                className="executive-impact-card"
              >
                <span className="executive-impact-card__label">
                  {isEnglish ? "Competency" : "สมรรถนะ"}
                </span>
                <h3>{nameOf(item, language)}</h3>
                <strong>
                  {score(item.spread)}{" "}
                  {isEnglish ? "points different" : "คะแนน"}
                </strong>
                <p>
                  {isEnglish
                    ? "Difference between "
                    : "คะแนนเฉลี่ยต่างกันระหว่างรุ่น "}
                  {item.lowest.entry_year_be} {isEnglish ? "and " : "กับรุ่น "}
                  {item.highest.entry_year_be}
                </p>
                <div className="executive-impact-card__values">
                  <span>
                    {isEnglish ? "Cohort " : "รุ่น "}
                    {item.lowest.entry_year_be}
                    <b>{score(item.lowest.average_score)}</b>
                  </span>
                  <span>
                    {isEnglish ? "Cohort " : "รุ่น "}
                    {item.highest.entry_year_be}
                    <b>{score(item.highest.average_score)}</b>
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function StudentsView({
  students,
  search,
  onSearch,
  onStudent,
  language,
  t,
  isEnglish,
}) {
  return (
    <section className="executive-panel">
      <PanelTitle
        icon={Users}
        title={isEnglish ? "Student drill-down" : "ข้อมูลนักศึกษารายบุคคล"}
        description={
          isEnglish
            ? "Read-only course competency results without contact information."
            : "ดูผลลัพธ์จากรายวิชาแบบอ่านอย่างเดียว โดยไม่แสดงข้อมูลติดต่อ"
        }
      />
      <label className="executive-search">
        <Search size={17} />
        <input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder={
            isEnglish
              ? "Search student code or name"
              : "ค้นหารหัสหรือชื่อนักศึกษา"
          }
        />
      </label>
      {!students.length ? (
        <EmptyState>
          {t("executive_no_student_data") ||
            "ยังไม่มีข้อมูลนักศึกษาที่พร้อมแสดง"}
        </EmptyState>
      ) : (
        <div className="executive-table-wrap">
          <table className="executive-table">
            <thead>
              <tr>
                <th>{isEnglish ? "Student" : "นักศึกษา"}</th>
                <th>
                  {isEnglish ? "Curriculum and cohort" : "หลักสูตรและรุ่น"}
                </th>
                <th>{isEnglish ? "Course total" : "คะแนนจากรายวิชา"}</th>
                <th>{isEnglish ? "Target" : "เป้าหมาย"}</th>
                <th>{isEnglish ? "Status" : "สถานะ"}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.enrollment_id}>
                  <td>
                    <strong>{student.student_code}</strong>
                    <small>
                      {language === "en"
                        ? student.student_name_en || student.student_name_th
                        : student.student_name_th}
                    </small>
                  </td>
                  <td>
                    <strong>{student.curriculum_name_th || "-"}</strong>
                    <small>
                      {isEnglish ? "Entered " : "ปีเข้า "}
                      {student.entry_year_be}
                    </small>
                  </td>
                  <td>
                    {student.ready ? score(student.course_total_score) : "-"}
                  </td>
                  <td>{student.ready ? score(student.target_score) : "-"}</td>
                  <td>
                    <span
                      className={
                        "executive-status " +
                        (student.ready
                          ? student.passed
                            ? "ready"
                            : "pending"
                          : "pending")
                      }
                    >
                      {student.ready
                        ? student.passed
                          ? isEnglish
                            ? "At target"
                            : "ถึงเกณฑ์"
                          : isEnglish
                            ? "Below target"
                            : "ต่ำกว่าเกณฑ์"
                        : isEnglish
                          ? "Not ready"
                          : "ข้อมูลยังไม่พร้อม"}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="executive-text-button"
                      onClick={() => onStudent(student)}
                    >
                      {isEnglish ? "View" : "ดูข้อมูล"}{" "}
                      <ChevronRight size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function CompetencyDrawer({ detail, language, t, isEnglish }) {
  return (
    <>
      <div className="executive-detail-summary">
        <strong>{score(detail.competency?.average_score)}</strong>
        <span>{isEnglish ? "average score" : "คะแนนเฉลี่ย"}</span>
        <small>
          {detail.competency?.is_required
            ? isEnglish
              ? "Required competency"
              : "สมรรถนะเกณฑ์จบ"
            : isEnglish
              ? "Tracking only"
              : "ติดตามผล"}
        </small>
      </div>
      <h3>{isEnglish ? "Cohort results" : "ผลลัพธ์รายรุ่น"}</h3>
      <div className="executive-detail-list">
        {(detail.cohorts || []).map((item) => (
          <div className="executive-detail-row" key={item.cohort_id}>
            <span>{item.entry_year_be || item.cohort_id}</span>
            <strong>{score(item.average_score)}</strong>
            <small>
              {score(item.pass_rate)}% {isEnglish ? "at target" : "ถึงเกณฑ์"}
            </small>
          </div>
        ))}
      </div>
      <h3>{isEnglish ? "Course sources" : "วิชาที่สร้างคะแนน"}</h3>
      <div className="executive-detail-list">
        {(detail.sources || []).map((item, index) => (
          <div
            className="executive-detail-row"
            key={item.course_id + "-" + index}
          >
            <span>{item.course_code}</span>
            <strong>{item.course_name_th}</strong>
            <small>
              {score(item.contribution)} · {item.student_count}{" "}
              {isEnglish ? "students" : "คน"}
            </small>
          </div>
        ))}
        {!detail.sources?.length && (
          <EmptyState>
            {t("executive_no_sources") || "ยังไม่มีข้อมูลที่มา"}
          </EmptyState>
        )}
      </div>
    </>
  );
}

function StudentDrawer({ detail, language, t, isEnglish }) {
  const student = detail.student || {};
  const curriculumName =
    language === "en"
      ? student.curriculum_name_en || student.curriculum_name_th || "-"
      : student.curriculum_name_th || student.curriculum_name_en || "-";
  const coursesByTerm = (detail.courses || []).reduce((groups, course) => {
    const key = course.academic_year_be + "-" + course.semester;
    const term = groups.get(key) || {
      academicYearBE: course.academic_year_be,
      semester: course.semester,
      courses: [],
    };
    term.courses.push(course);
    groups.set(key, term);
    return groups;
  }, new Map());
  const courseTerms = Array.from(coursesByTerm.values()).sort(
    (left, right) =>
      Number(left.academicYearBE) - Number(right.academicYearBE) ||
      Number(left.semester) - Number(right.semester),
  );
  return (
    <>
      <div className="executive-student-heading">
        <strong>{student.student_code}</strong>
        <span>
          {language === "en"
            ? student.student_name_en || student.student_name_th
            : student.student_name_th}
        </span>
        <small>
          {curriculumName} · {isEnglish ? "entered " : "ปีเข้า "}
          {student.entry_year_be}
        </small>
      </div>
      <h3>{isEnglish ? "Competency results" : "ผลลัพธ์สมรรถนะ"}</h3>
      <div className="executive-detail-list">
        {(detail.competencies || []).map((item) => {
          const outcome = studentCompetencyOutcome(item, isEnglish);
          return (
            <div className="executive-detail-row" key={item.competency_id}>
              <span>{nameOf(item, language)}</span>
              <strong>
                {item.has_score ? score(item.course_total_score) : "-"}
              </strong>
              <small className={"executive-student-outcome " + outcome.tone}>
                {outcome.label}
              </small>
            </div>
          );
        })}
      </div>
      <h3>{isEnglish ? "Courses taken" : "วิชาที่เรียน"}</h3>
      <div className="executive-student-course-terms">
        {courseTerms.map((term) => (
          <section
            className="executive-student-course-term"
            key={term.academicYearBE + "-" + term.semester}
          >
            <header>
              <strong>
                {isEnglish ? "Academic year " : "ปีการศึกษา "}
                {term.academicYearBE || "-"}
              </strong>
              <span>
                {isEnglish ? "Semester " : "ภาคเรียนที่ "}
                {term.semester || "-"}
              </span>
            </header>
            <div className="executive-student-course-list">
              {term.courses.map((course) => (
                <article
                  className="executive-student-course"
                  key={
                    course.course_id +
                    "-" +
                    course.academic_year_be +
                    "-" +
                    course.semester
                  }
                >
                  <header>
                    <div>
                      <strong>{course.course_code}</strong>
                      <span>
                        {language === "en"
                          ? course.course_name_en || course.course_name_th
                          : course.course_name_th}
                      </span>
                    </div>
                    <span className="executive-course-grade">
                      {isEnglish ? "Grade " : "เกรด "}
                      {course.grade || "-"}
                    </span>
                  </header>
                  <div className="executive-course-competencies">
                    {course.competencies?.map((competency) => (
                      <div key={competency.competency_id}>
                        <span>
                          {language === "en"
                            ? competency.competency_name_en ||
                              competency.competency_name_th
                            : competency.competency_name_th}
                        </span>
                        <b>{score(competency.score)}</b>
                      </div>
                    ))}
                    {!course.competencies?.length && (
                      <small>
                        {isEnglish
                          ? "No competency score from this course"
                          : "รายวิชานี้ยังไม่มีคะแนนสมรรถนะ"}
                      </small>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
        {!courseTerms.length && (
          <EmptyState>
            {isEnglish
              ? "No course enrollment data is available"
              : "ยังไม่มีข้อมูลรายวิชาที่เรียน"}
          </EmptyState>
        )}
      </div>
    </>
  );
}
