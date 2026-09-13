"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  BarChart3,
  Check,
  Info,
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  PointElement,
  RadialLinearScale,
  Tooltip,
} from "chart.js";
import { Radar } from "react-chartjs-2";
import { useTheme } from "../../providers/theme-provider";
import { fetchExecutiveComparison } from "../../lib/executive-analytics";
import {
  comparisonOptions,
  useExecutiveComparisonSelection,
} from "./useExecutiveComparisonSelection";
import "./ExecutiveComparisonView.css";

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
);

const MAX_SELECTED_COMPETENCIES = 8;

function displayName(item, language, fallback = "-") {
  if (!item) return fallback;
  if (language === "en") {
    return item.name_en || item.curriculum_name_en || item.name_th || fallback;
  }
  return item.name_th || item.curriculum_name_th || item.name_en || fallback;
}

function score(value) {
  return Number(value || 0).toFixed(2);
}

function idOf(value) {
  return String(value || "");
}

function readinessMessage(cohort, language) {
  if (!cohort) return language === "en" ? "Choose a cohort" : "กรุณาเลือกรุ่นนักศึกษา";
  return language === "en"
    ? cohort.readiness_message_en || "This cohort is not ready for comparison"
    : cohort.readiness_message_th || "รุ่นนี้ยังไม่พร้อมสำหรับการเปรียบเทียบ";
}

function readinessLabel(cohort, language) {
  if (cohort?.ready) return language === "en" ? "Ready to compare" : "พร้อมเปรียบเทียบ";
  return language === "en" ? "Not ready" : "ยังไม่พร้อมเปรียบเทียบ";
}

function sideTitle(cohort, language) {
  if (!cohort) return language === "en" ? "No cohort selected" : "ยังไม่ได้เลือกรุ่นนักศึกษา";
  return `${displayName(cohort, language)} ${
    language === "en" ? "cohort" : "รุ่น"
  } ${cohort.entry_year_be}`;
}

function aggregateMap(items = []) {
  return new Map(items.map((item) => [idOf(item.competency_id), item]));
}

function formatPercent(value) {
  return `${score(value)}%`;
}

function ComparisonRadarChart({ competencies, left, right, language }) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const labels = competencies.map((item) => displayName(item, language));
  const leftMap = aggregateMap(left);
  const rightMap = aggregateMap(right);
  const leftValues = competencies.map(
    (item) => leftMap.get(idOf(item.competency_id))?.average_score || 0,
  );
  const rightValues = competencies.map(
    (item) => rightMap.get(idOf(item.competency_id))?.average_score || 0,
  );
  const data = {
    labels,
    datasets: [
      {
        label: "ชุดข้อมูลที่ 1",
        data: leftValues,
        borderColor: "#5b9dff",
        backgroundColor: "rgba(91, 157, 255, 0.2)",
        pointBackgroundColor: "#5b9dff",
        pointBorderColor: dark ? "#18233a" : "#ffffff",
        pointRadius: 4,
        borderWidth: 2,
      },
      {
        label: "ชุดข้อมูลที่ 2",
        data: rightValues,
        borderColor: "#28c5d7",
        backgroundColor: "rgba(40, 197, 215, 0.15)",
        pointBackgroundColor: "#28c5d7",
        pointBorderColor: dark ? "#18233a" : "#ffffff",
        pointRadius: 4,
        borderWidth: 2,
      },
    ],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 650,
      easing: "easeOutCubic",
    },
    scales: {
      r: {
        min: 0,
        max: 100,
        ticks: {
          stepSize: 25,
          color: dark ? "#9eb0cd" : "#667795",
          backdropColor: "transparent",
          font: { size: 10 },
        },
        grid: {
          color: dark ? "rgba(158, 176, 205, .23)" : "rgba(102, 119, 149, .2)",
        },
        angleLines: {
          color: dark ? "rgba(158, 176, 205, .23)" : "rgba(102, 119, 149, .2)",
        },
        pointLabels: {
          color: dark ? "#edf4ff" : "#14213a",
          font: {
            family: "Inter, Prompt, sans-serif",
            size: 11,
          },
        },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context) =>
            `${context.dataset.label}: ${score(context.raw)} คะแนน`,
        },
      },
    },
  };

  return <Radar data={data} options={options} />;
}

function FilterSelect({ label, value, options, placeholder, onChange, disabled }) {
  return (
    <label className="executive-paired-filter">
      <span>{label}</span>
      <select
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        <option value="">{placeholder}</option>
        {options.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ScopeSelector({
  side,
  selection,
  scope,
  scopeLoading,
  isDean,
  language,
  isEnglish,
  onChange,
}) {
  const current = selection[side];
  const options = comparisonOptions(scope, selection, side, isDean);
  const option = (item, name) => ({
    value: item[name],
    label: displayName(item, language),
  });
  const cohortOptions = options.cohorts.map((item) => ({
    value: item.cohort_id,
    label: `${isEnglish ? "Cohort " : "รุ่น "}${item.entry_year_be}`,
  }));

  return (
    <article className={`executive-paired-side executive-paired-side--${side}`}>
      <div className="executive-paired-side__heading">
        <div>
          <strong>
            {isEnglish
              ? side === "left"
                ? "Comparison set 1"
                : "Comparison set 2"
              : side === "left"
                ? "ชุดข้อมูลที่ 1"
                : "ชุดข้อมูลที่ 2"}
          </strong>
          <small>
            {isEnglish
              ? side === "left"
                ? "Blue line"
                : "Teal line"
              : side === "left"
                ? "เส้นสีน้ำเงิน"
                : "เส้นสีฟ้าอมเขียว"}
          </small>
        </div>
        <span className="executive-paired-side__dot" />
      </div>
      <div className="executive-paired-fields">
        {!isDean && (
          <FilterSelect
            label={isEnglish ? "Faculty" : "คณะ"}
            value={current.faculty_id}
            options={options.faculties.map((item) => option(item, "faculty_id"))}
            placeholder={isEnglish ? "Select faculty" : "เลือกคณะ"}
            onChange={(value) => onChange(side, "faculty_id", value)}
            disabled={scopeLoading}
          />
        )}
        <FilterSelect
          label={isEnglish ? "Major" : "สาขา"}
          value={current.major_id}
          options={options.majors.map((item) => option(item, "major_id"))}
          placeholder={isEnglish ? "Select major" : "เลือกสาขา"}
          onChange={(value) => onChange(side, "major_id", value)}
          disabled={scopeLoading}
        />
        <FilterSelect
          label={isEnglish ? "Curriculum" : "หลักสูตร"}
          value={current.curriculum_id}
          options={options.curricula.map((item) => option(item, "curriculum_id"))}
          placeholder={isEnglish ? "Select curriculum" : "เลือกหลักสูตร"}
          onChange={(value) => onChange(side, "curriculum_id", value)}
          disabled={scopeLoading}
        />
        <FilterSelect
          label={isEnglish ? "Student cohort" : "รุ่นนักศึกษา"}
          value={current.cohort_id}
          options={cohortOptions}
          placeholder={isEnglish ? "Select cohort" : "เลือกรุ่นนักศึกษา"}
          onChange={(value) => onChange(side, "cohort_id", value)}
          disabled={scopeLoading || !current.curriculum_id}
        />
      </div>
      {isDean && (
        <small className="executive-paired-side__scope-note">
          {isEnglish
            ? "Limited to your faculty"
            : "จำกัดเฉพาะข้อมูลในคณะของคุณ"}
        </small>
      )}
    </article>
  );
}

function CompetencyPicker({ competencies, selected, onToggle, language, isEnglish, onSelectAll, onClear }) {
  return (
    <section className="executive-paired-picker">
      <div className="executive-paired-picker__top">
        <div>
          <strong>
            {isEnglish
              ? "Competencies to show on the chart"
              : "สมรรถนะที่ต้องการดูบนกราฟ"}
          </strong>
          <small>
            {isEnglish
              ? "Choose up to 8 shared competencies"
              : "เลือกได้ไม่เกิน 8 ด้าน และเลือกได้เฉพาะสมรรถนะที่มีร่วมกัน"}
          </small>
        </div>
        <div className="executive-paired-picker__actions">
          <button type="button" onClick={onSelectAll}>
            {isEnglish ? "Select shared" : "เลือกที่มีร่วมกันทั้งหมด"}
          </button>
          <button type="button" onClick={onClear}>
            {isEnglish ? "Clear" : "ล้างการเลือก"}
          </button>
        </div>
      </div>
      {!competencies.length ? (
        <p className="executive-paired-picker__empty">
          {isEnglish
            ? "No shared competencies are available."
            : "ยังไม่มีสมรรถนะที่ทั้งสองรุ่นมีร่วมกัน"}
        </p>
      ) : (
        <div className="executive-paired-chips">
          {competencies.map((item) => {
            const id = idOf(item.competency_id);
            const active = selected.includes(id);
            return (
              <button
                type="button"
                key={id}
                className={active ? "active" : ""}
                aria-pressed={active}
                onClick={() => onToggle(id)}
              >
                {active && <Check size={13} />}
                {displayName(item, language)}
              </button>
            );
          })}
        </div>
      )}
      <small className="executive-paired-picker__count">
        {isEnglish
          ? `${selected.length} selected from ${competencies.length} shared competencies`
          : `เลือก ${selected.length} จาก ${competencies.length} สมรรถนะที่มีร่วมกัน`}
      </small>
    </section>
  );
}

function ScoreCell({ item, language }) {
  if (!item) {
    return <span className="executive-paired-no-score">{language === "en" ? "Not in this curriculum" : "ไม่มีในหลักสูตรนี้"}</span>;
  }
  const hasScore = Number(item.evaluated_count || 0) > 0;
  return (
    <div className="executive-paired-score-cell">
      <strong>{hasScore ? score(item.average_score) : "-"}</strong>
      {hasScore ? (
        <small>
          {language === "en" ? "Target " : "เป้าหมาย "}
          {score(item.target_score)}
          {language === "en" ? ` · ${formatPercent(item.pass_rate)} reached` : ` · ถึงเป้าหมาย ${formatPercent(item.pass_rate)}`}
        </small>
      ) : (
        <small>{language === "en" ? "No calculated score" : "ยังไม่มีผลคะแนนที่คำนวณแล้ว"}</small>
      )}
      <span className={!item.is_required ? "tracking" : "required"}>
        {!item.is_required
          ? language === "en"
            ? "For tracking"
            : "ติดตามผล"
          : language === "en"
            ? "Required competency"
            : "สมรรถนะเกณฑ์จบ"}
      </span>
    </div>
  );
}

function ComparisonTable({ left, right, language, isEnglish }) {
  const leftMap = aggregateMap(left?.competencies);
  const rightMap = aggregateMap(right?.competencies);
  const names = [
    ...(left?.competencies || []).map((item) => idOf(item.competency_id)),
    ...(right?.competencies || [])
      .map((item) => idOf(item.competency_id))
      .filter((id) => !leftMap.has(id)),
  ];
  const rows = names.map((id) => {
    const leftItem = leftMap.get(id);
    const rightItem = rightMap.get(id);
    const item = leftItem || rightItem;
    const delta = leftItem && rightItem
      ? Number(rightItem.average_score || 0) - Number(leftItem.average_score || 0)
      : null;
    return { id, item, leftItem, rightItem, delta };
  });

  return (
    <section className="executive-paired-table-card">
      <header className="executive-paired-card-heading">
        <div>
          <h2>{isEnglish ? "All competency details" : "รายละเอียดสมรรถนะทั้งหมด"}</h2>
          <p>
            {isEnglish
              ? "Every competency is listed. A missing competency is not treated as zero."
              : "แสดงสมรรถนะจากทั้งสองรุ่น และไม่แทนสมรรถนะที่ไม่มีด้วยคะแนนศูนย์"}
          </p>
        </div>
      </header>
      <div className="executive-paired-table-scroll">
        <table>
          <thead>
            <tr>
              <th>{isEnglish ? "Competency" : "สมรรถนะ"}</th>
              <th>{sideTitle(left?.cohort, language)}</th>
              <th>{sideTitle(right?.cohort, language)}</th>
              <th>{isEnglish ? "Difference" : "ส่วนต่างคะแนน"}</th>
              <th>{isEnglish ? "Comparison status" : "สถานะการเปรียบเทียบ"}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ id, item, leftItem, rightItem, delta }) => (
              <tr key={id}>
                <td className="executive-paired-table__name">{displayName(item, language)}</td>
                <td><ScoreCell item={leftItem} language={language} /></td>
                <td><ScoreCell item={rightItem} language={language} /></td>
                <td className={delta > 0 ? "positive" : delta < 0 ? "negative" : "neutral"}>
                  {delta === null ? "-" : `${delta > 0 ? "+" : ""}${score(delta)}`}
                </td>
                <td>
                  {leftItem && rightItem ? (
                    <span className="executive-paired-status shared">
                      {isEnglish ? "Comparable" : "เปรียบเทียบได้"}
                    </span>
                  ) : leftItem ? (
                    <span className="executive-paired-status left-only">
                      {isEnglish ? "Only in set 1" : "มีเฉพาะชุดข้อมูลที่ 1"}
                    </span>
                  ) : (
                    <span className="executive-paired-status right-only">
                      {isEnglish ? "Only in set 2" : "มีเฉพาะชุดข้อมูลที่ 2"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ComparisonSummary({ selectedCompetencies, left, right, language, isEnglish }) {
  const leftMap = aggregateMap(left?.competencies);
  const rightMap = aggregateMap(right?.competencies);
  const differences = selectedCompetencies
    .map((item) => ({
      item,
      delta:
        Number(rightMap.get(idOf(item.competency_id))?.average_score || 0) -
        Number(leftMap.get(idOf(item.competency_id))?.average_score || 0),
    }))
    .sort((a, b) => b.delta - a.delta);
  const increase = differences[0];
  const review = differences[differences.length - 1];
  const leftOnly = (left?.competencies || []).filter(
    (item) => !rightMap.has(idOf(item.competency_id)),
  ).length;
  const rightOnly = (right?.competencies || []).filter(
    (item) => !leftMap.has(idOf(item.competency_id)),
  ).length;
  const summary = (item, title) => (
    <div className="executive-paired-summary-row">
      <div>
        <strong>{title}</strong>
        {item ? (
          <small>
            {displayName(item.item, language)} · {isEnglish ? "set 1" : "ชุดข้อมูลที่ 1"} {score(leftMap.get(idOf(item.item.competency_id))?.average_score)} · {isEnglish ? "set 2" : "ชุดข้อมูลที่ 2"} {score(rightMap.get(idOf(item.item.competency_id))?.average_score)}
          </small>
        ) : (
          <small>{isEnglish ? "No selected competency to compare" : "ยังไม่มีสมรรถนะที่เลือกเพื่อเปรียบเทียบ"}</small>
        )}
      </div>
      <b className={item?.delta > 0 ? "positive" : item?.delta < 0 ? "negative" : "neutral"}>
        {item ? `${item.delta > 0 ? "+" : ""}${score(item.delta)}` : "-"}
      </b>
    </div>
  );

  return (
    <section className="executive-paired-summary executive-paired-card">
      <header className="executive-paired-card-heading">
        <div>
          <h2>{isEnglish ? "What the comparison shows" : "สรุปสิ่งที่เห็นจากข้อมูล"}</h2>
          <p>{isEnglish ? "Use these differences as a starting point for review." : "ใช้ส่วนต่างนี้เป็นจุดเริ่มต้นในการตรวจสอบข้อมูลต่อ"}</p>
        </div>
      </header>
      <div className="executive-paired-summary-list">
        {summary(increase, isEnglish ? "Largest increase in set 2" : "ด้านที่ชุดข้อมูลที่ 2 มีคะแนนสูงขึ้นมากที่สุด")}
        {summary(review, isEnglish ? "Largest decrease in set 2" : "ด้านที่ควรตรวจสอบเพิ่มเติม")}
        <div className="executive-paired-summary-row">
          <div>
            <strong>{isEnglish ? "Shared competencies" : "สมรรถนะที่มีร่วมกัน"}</strong>
            <small>{isEnglish ? "Selected for the radar chart" : "สมรรถนะที่เลือกแสดงบนกราฟเรดาร์"}</small>
          </div>
          <b className="neutral">{selectedCompetencies.length}</b>
        </div>
        <div className="executive-paired-summary-row">
          <div>
            <strong>{isEnglish ? "Read separately" : "สมรรถนะที่ต้องอ่านแยก"}</strong>
            <small>{isEnglish ? `${leftOnly + rightOnly} competencies exist in one curriculum only` : `มี ${leftOnly + rightOnly} ด้านที่อยู่ในหลักสูตรเพียงฝั่งเดียว`}</small>
          </div>
          <b className="neutral">{leftOnly + rightOnly}</b>
        </div>
      </div>
    </section>
  );
}

function ReadinessCard({ side, language }) {
  const cohort = side?.cohort;
  return (
    <div className={`executive-paired-readiness ${cohort?.ready ? "ready" : "not-ready"}`}>
      <div>
        <strong>{sideTitle(cohort, language)}</strong>
        <small>{readinessMessage(cohort, language)}</small>
      </div>
      <span>{readinessLabel(cohort, language)}</span>
    </div>
  );
}

export default function ExecutiveComparisonView({
  scope,
  scopeLoading,
  user,
  refreshKey,
  language,
  isEnglish,
}) {
  const isDean = user?.roles?.includes("dean");
  const { initialized, selection, updateSide, swap } =
    useExecutiveComparisonSelection({ scope, scopeLoading, user });
  const [requestState, setRequestState] = useState({
    key: "",
    data: null,
    error: "",
  });
  const leftCohortID = selection.left.cohort_id;
  const rightCohortID = selection.right.cohort_id;
  const canRequest = initialized && leftCohortID && rightCohortID;
  const requestKey = `${leftCohortID}:${rightCohortID}:${refreshKey}`;
  const comparison = requestState.key === requestKey ? requestState.data : null;
  const error = requestState.key === requestKey ? requestState.error : "";

  useEffect(() => {
    let alive = true;
    if (!canRequest) {
      return () => {
        alive = false;
      };
    }
    fetchExecutiveComparison({
      left_cohort_id: leftCohortID,
      right_cohort_id: rightCohortID,
    })
      .then((data) => {
        if (alive) setRequestState({ key: requestKey, data: data || null, error: "" });
      })
      .catch((requestError) => {
        if (!alive) return;
        setRequestState({
          key: requestKey,
          data: null,
          error: requestError?.message || (isEnglish ? "Unable to load comparison data" : "ไม่สามารถโหลดข้อมูลเปรียบเทียบได้"),
        });
      });
    return () => {
      alive = false;
    };
  }, [canRequest, isEnglish, leftCohortID, requestKey, rightCohortID]);

  const isLoading = Boolean(canRequest && requestState.key !== requestKey);

  const left = comparison?.left;
  const right = comparison?.right;
  const rightMap = useMemo(() => aggregateMap(right?.competencies), [right]);
  const sharedCompetencies = useMemo(
    () =>
      (left?.competencies || []).filter((item) =>
        rightMap.has(idOf(item.competency_id)),
      ),
    [left, rightMap],
  );
  const ready = Boolean(left?.cohort?.ready && right?.cohort?.ready);

  const comparisonKey = `${leftCohortID}:${rightCohortID}`;
  const [selectedCompetencyState, setSelectedCompetencyState] = useState({
    key: "",
    ids: [],
  });
  const selectedCompetencyIDs =
    selectedCompetencyState.key === comparisonKey
      ? selectedCompetencyState.ids
      : sharedCompetencies
          .slice(0, MAX_SELECTED_COMPETENCIES)
          .map((item) => idOf(item.competency_id));
  const selectedCompetencies = sharedCompetencies.filter((item) =>
    selectedCompetencyIDs.includes(idOf(item.competency_id)),
  );

  const toggleCompetency = (id) => {
    setSelectedCompetencyState((currentState) => {
      const current =
        currentState.key === comparisonKey
          ? currentState.ids
          : selectedCompetencyIDs;
      if (current.includes(id)) {
        return {
          key: comparisonKey,
          ids: current.filter((item) => item !== id),
        };
      }
      if (current.length >= MAX_SELECTED_COMPETENCIES) return currentState;
      return {
        key: comparisonKey,
        ids: [...current, id],
      };
    });
  };

  return (
    <div className="executive-paired-page">
      <div className="executive-paired-note">
        <Info size={16} />
        <span>
          {isEnglish
            ? "The radar chart compares only shared competencies. A competency that exists in one curriculum only is shown separately and is never treated as zero."
            : "กราฟเรดาร์จะแสดงเฉพาะสมรรถนะที่ทั้งสองรุ่นมีร่วมกัน ส่วนสมรรถนะที่มีเพียงหลักสูตรเดียวจะแสดงแยก และไม่ถือเป็นคะแนนศูนย์"}
        </span>
      </div>

      <section className="executive-paired-selection executive-paired-card">
        <header className="executive-paired-card-heading executive-paired-selection__heading">
          <div>
            <h2>{isEnglish ? "Choose two comparison sets" : "เลือกชุดข้อมูลที่ต้องการเปรียบเทียบ"}</h2>
            <p>{isEnglish ? "Each side can use a different faculty, major, curriculum, and student cohort." : "แต่ละฝั่งเลือกคณะ สาขา หลักสูตร และรุ่นนักศึกษาได้อย่างอิสระ"}</p>
          </div>
          <button type="button" className="executive-paired-swap" onClick={swap}>
            <ArrowLeftRight size={16} />
            {isEnglish ? "Swap sets" : "สลับชุดข้อมูล"}
          </button>
        </header>
        <div className="executive-paired-selectors">
          <ScopeSelector
            side="left"
            selection={selection}
            scope={scope}
            scopeLoading={scopeLoading}
            isDean={isDean}
            language={language}
            isEnglish={isEnglish}
            onChange={updateSide}
          />
          <div className="executive-paired-versus">เทียบ</div>
          <ScopeSelector
            side="right"
            selection={selection}
            scope={scope}
            scopeLoading={scopeLoading}
            isDean={isDean}
            language={language}
            isEnglish={isEnglish}
            onChange={updateSide}
          />
        </div>
        <CompetencyPicker
          competencies={ready ? sharedCompetencies : []}
          selected={selectedCompetencyIDs}
          onToggle={toggleCompetency}
          language={language}
          isEnglish={isEnglish}
          onSelectAll={() =>
            setSelectedCompetencyState({
              key: comparisonKey,
              ids: sharedCompetencies
                .slice(0, MAX_SELECTED_COMPETENCIES)
                .map((item) => idOf(item.competency_id)),
            })
          }
          onClear={() =>
            setSelectedCompetencyState({ key: comparisonKey, ids: [] })
          }
        />
      </section>

      {isLoading && (
        <div className="executive-paired-loading" role="status">
          <Loader2 size={20} className="executive-spin" />
          <span>{isEnglish ? "Loading comparison data..." : "กำลังโหลดข้อมูลเปรียบเทียบ..."}</span>
        </div>
      )}
      {error && <div className="executive-paired-error">{error}</div>}

      {comparison && !isLoading && (
        <>
          {!ready && (
            <section className="executive-paired-readiness-card executive-paired-card">
              <header className="executive-paired-card-heading">
                <div>
                  <h2>{isEnglish ? "Comparison is not ready" : "ยังเปรียบเทียบข้อมูลไม่ได้"}</h2>
                  <p>{isEnglish ? "Both cohorts must have calculated course results before the comparison can be read." : "ทั้งสองรุ่นต้องมีผลคะแนนจากรายวิชาที่คำนวณแล้ว จึงจะเริ่มอ่านผลเปรียบเทียบได้"}</p>
                </div>
              </header>
              <div className="executive-paired-readiness-grid">
                <ReadinessCard side={left} language={language} />
                <ReadinessCard side={right} language={language} />
              </div>
            </section>
          )}
          {ready && (
            <>
              <section className="executive-paired-results-grid">
                <section className="executive-paired-radar executive-paired-card">
                  <header className="executive-paired-card-heading">
                    <div>
                      <h2>{isEnglish ? "Shared competency overview" : "ภาพรวมสมรรถนะที่มีร่วมกัน"}</h2>
                      <p>{sideTitle(left?.cohort, language)} {isEnglish ? "compared with" : "เทียบกับ"} {sideTitle(right?.cohort, language)}</p>
                    </div>
                    <BarChart3 size={19} />
                  </header>
                  <div className="executive-paired-radar__body">
                    {selectedCompetencies.length >= 3 ? (
                      <div className="executive-paired-radar__chart">
                        <ComparisonRadarChart competencies={selectedCompetencies} left={left?.competencies} right={right?.competencies} language={language} />
                      </div>
                    ) : (
                      <div className="executive-paired-empty-chart">
                        {isEnglish ? "Select at least 3 competencies to show the radar chart." : "เลือกอย่างน้อย 3 สมรรถนะเพื่อแสดงกราฟเรดาร์"}
                      </div>
                    )}
                    <div className="executive-paired-legend">
                      <div><i className="left" /><span><strong>{isEnglish ? "Set 1" : "ชุดข้อมูลที่ 1"}</strong><small>{sideTitle(left?.cohort, language)}</small></span></div>
                      <div><i className="right" /><span><strong>{isEnglish ? "Set 2" : "ชุดข้อมูลที่ 2"}</strong><small>{sideTitle(right?.cohort, language)}</small></span></div>
                    </div>
                  </div>
                </section>
                <ComparisonSummary selectedCompetencies={selectedCompetencies} left={left} right={right} language={language} isEnglish={isEnglish} />
              </section>
              <ComparisonTable left={left} right={right} language={language} isEnglish={isEnglish} />
            </>
          )}
        </>
      )}
      {!comparison && !isLoading && !error && (
        <div className="executive-paired-empty-state">
          {isEnglish ? "Choose one cohort on each side to start comparing." : "เลือก Cohort ให้ครบทั้งสองฝั่งเพื่อเริ่มเปรียบเทียบ"}
        </div>
      )}
      <button type="button" className="executive-paired-refresh" onClick={() => window.location.reload()}>
        <RefreshCw size={14} />
        {isEnglish ? "Refresh preview" : "โหลดข้อมูลใหม่"}
      </button>
    </div>
  );
}
