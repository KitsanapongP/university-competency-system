"use client";

import React, { useRef, useState, useEffect } from "react";
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import { Radar } from "react-chartjs-2";
import { Sparkles } from "lucide-react";
import { useTheme } from "../../providers/theme-provider";
import { useLanguage } from "../../providers/LanguageContext";

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
);

const CompetencyRadarChart = ({
  chartData,
  competencies,
  selectedCompetencies,
  activeCompetency,
  onCompetencyClick,
  filterMode,
  selectedYears,
  dateRange,
  months,
  showRequirement,
  showAllScores,
}) => {
  const chartRef = useRef(null);
  const [chartLabelRadius, setChartLabelRadius] = useState(165);
  const [dpr, setDpr] = useState(1);
  const { resolvedTheme } = useTheme();
  const { t } = useLanguage();
  const isDark = resolvedTheme === "dark";

  // Dynamic radius for chart labels based on screen size
  useEffect(() => {
    const calculateRadius = () => {
      const width = window.innerWidth;
      setDpr(window.devicePixelRatio || 1);

      if (width <= 768) {
        setChartLabelRadius(150); // Mobile
      } else if (width <= 1024) {
        setChartLabelRadius(160); // Tablet
      } else {
        setChartLabelRadius(190); // Desktop
      }
    };

    calculateRadius();
    window.addEventListener("resize", calculateRadius);
    return () => window.removeEventListener("resize", calculateRadius);
  }, []);

  const handleChartClick = (event) => {
    const chart = chartRef.current;
    if (!chart) return;

    const points = chart.getElementsAtEventForMode(
      event,
      "nearest",
      { intersect: true },
      true,
    );

    if (points.length) {
      const firstPoint = points[0];
      const compId = selectedCompetencies[firstPoint.index];
      const datasetIndex = firstPoint.datasetIndex;
      onCompetencyClick(compId, datasetIndex);
    }
  };

  // Theme-aware chart colors
  const gridColor = isDark
    ? "rgba(255, 255, 255, 0.12)"
    : "rgba(0, 0, 0, 0.05)";
  const angleLineColor = isDark
    ? "rgba(255, 255, 255, 0.15)"
    : "rgba(0, 0, 0, 0.1)";
  const tickColor = isDark ? "rgba(255, 255, 255, 0.7)" : "#64748b";
  const tooltipBg = isDark ? "#1e293b" : "white";
  const tooltipTitleColor = isDark ? "#f1f5f9" : "#0f172a";
  const tooltipBodyColor = isDark ? "#cbd5e1" : "#475569";
  const tooltipBorderColor = isDark ? "#475569" : "#e2e8f0";
  const chartValueMax = Math.max(
    100,
    ...(chartData?.datasets || [])
      .flatMap((dataset) => dataset.data || [])
      .map(Number),
  );
  const chartScaleMax = Math.ceil(chartValueMax / 25) * 25;

  const radarOptions = {
    onClick: handleChartClick,
    devicePixelRatio: dpr,
    onHover: (event, chartElement) => {
      if (event.native) {
        event.native.target.style.cursor = chartElement[0]
          ? "pointer"
          : "default";
      }
    },
    scales: {
      r: {
        angleLines: { color: angleLineColor },
        suggestedMin: 0,
        suggestedMax: chartScaleMax,
        ticks: {
          stepSize: chartScaleMax / 4,
          backdropColor: "transparent",
          color: tickColor,
          font: { size: 10 },
        },
        grid: { color: gridColor },
        pointLabels: {
          display: false, // We use custom labels
        },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: tooltipBg,
        titleColor: tooltipTitleColor,
        bodyColor: tooltipBodyColor,
        borderColor: tooltipBorderColor,
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        displayColors: true,
        callbacks: {
          title: (items) => {
            const compId = selectedCompetencies[items[0].dataIndex];
            const comp = competencies.find((c) => c.id === compId);
            return comp?.name || "";
          },
          afterBody: () => t("click_for_details") || "(คลิกเพื่อดูรายละเอียด)",
        },
      },
    },
    maintainAspectRatio: false,
  };

  // Custom Chart Labels Renderer
  const renderChartLabels = () => {
    if (!selectedCompetencies.length) return null;
    const angleStep = (2 * Math.PI) / selectedCompetencies.length;
    const startAngle = -Math.PI / 2;

    return selectedCompetencies.map((id, index) => {
      const comp = competencies.find((c) => c.id === id);
      const angle = startAngle + index * angleStep;
      const x = Math.cos(angle) * chartLabelRadius;
      const y = Math.sin(angle) * chartLabelRadius;
      const Icon = comp.icon;
      const isActive = activeCompetency === id;

      return (
        <div
          key={id}
          className={`chart-label ${isActive ? "active" : ""}`}
          style={{
            transform: `translate(${x}px, ${y}px) translate(-50%, -50%)`,
          }}
          onClick={() => {
            onCompetencyClick(id, 0);
          }}
        >
          <div
            className="label-icon"
            style={{
              backgroundColor: `${comp.color}${isActive ? "30" : "15"}`,
              color: comp.color,
              transform: isActive ? "scale(1.1)" : "scale(1)",
            }}
          >
            <Icon size={22} />
          </div>
          <span
            className="label-text"
            style={{ color: isActive ? comp.color : undefined }}
          >
            {comp.name}
          </span>
        </div>
      );
    });
  };

  return (
    <div className="chart-section card">
      <div className="card-header">
        <h2>
          <Sparkles size={20} className="section-icon" />
          {t("competency_chart") || "กราฟสมรรถนะ"}
        </h2>
        <span className="year-badge">
          {filterMode === "year"
            ? showAllScores
              ? t("all_years_total")
              : `${t("year") || "ปี"} ${selectedYears.join(", ")}`
            : `${months[dateRange.startMonth - 1] ? t(months[dateRange.startMonth - 1].id + "_short") : ""} ${dateRange.startYear} - ${months[dateRange.endMonth - 1] ? t(months[dateRange.endMonth - 1].id + "_short") : ""} ${dateRange.endYear}`}
        </span>
      </div>
      <div className="chart-wrapper">
        <div className="chart-labels-container">{renderChartLabels()}</div>
        <div className="chart-canvas">
          <Radar
            key={`${dpr}-${resolvedTheme}`}
            ref={chartRef}
            data={chartData}
            options={radarOptions}
          />
        </div>
      </div>

      {/* Custom Legend */}
      <div className="chart-custom-legend">
        {chartData.datasets
          .filter((ds) => !ds.isRequirement)
          .map((ds, i) => (
            <div key={i} className="legend-item">
              <div
                className="legend-color"
                style={{
                  backgroundColor: ds.borderColor,
                  borderColor: ds.borderColor,
                }}
              ></div>
              <span>{ds.label}</span>
            </div>
          ))}
        {showRequirement && (
          <div className="legend-item">
            <div
              className="legend-color dashed"
              style={{ borderColor: "#ef4444" }}
            ></div>
            <span>{t("requirement")}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default CompetencyRadarChart;
