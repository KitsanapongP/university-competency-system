'use client';

import React, { useRef, useState, useEffect } from 'react';
import {
    Chart as ChartJS,
    RadialLinearScale,
    PointElement,
    LineElement,
    Filler,
    Tooltip,
    Legend,
} from 'chart.js';
import { Radar } from 'react-chartjs-2';
import { Sparkles } from 'lucide-react';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

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
    showRequirement
}) => {
    const chartRef = useRef(null);
    const [chartLabelRadius, setChartLabelRadius] = useState(165);

    // Dynamic radius for chart labels based on screen size
    useEffect(() => {
        const calculateRadius = () => {
            const width = window.innerWidth;
            if (width <= 768) {
                setChartLabelRadius(150); // Mobile
            } else if (width <= 1024) {
                setChartLabelRadius(160); // Tablet
            } else {
                setChartLabelRadius(190); // Desktop
            }
        };

        calculateRadius();
        window.addEventListener('resize', calculateRadius);
        return () => window.removeEventListener('resize', calculateRadius);
    }, []);

    const handleChartClick = (event) => {
        const chart = chartRef.current;
        if (!chart) return;

        const points = chart.getElementsAtEventForMode(event, 'nearest', { intersect: true }, true);

        if (points.length) {
            const firstPoint = points[0];
            const compId = selectedCompetencies[firstPoint.index];
            const datasetIndex = firstPoint.datasetIndex;

            // Logic to determine year/context from datasetIndex
            // This depends on how datasets are constructed in parent or here.
            // Assuming parent provides data in a specific order: [Year1, Year2, ...] or [DateRange] + [Requirement?]
            // We might need to bubble up the index or context.

            onCompetencyClick(compId, datasetIndex);
        }
    };

    const radarOptions = {
        onClick: handleChartClick,
        onHover: (event, chartElement) => {
            if (event.native) {
                event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
            }
        },
        scales: {
            r: {
                angleLines: { color: 'rgba(0, 0, 0, 0.1)' },
                suggestedMin: 0,
                suggestedMax: 100,
                ticks: {
                    stepSize: 25,
                    backdropColor: 'transparent',
                    color: '#64748b',
                    font: { size: 10 }
                },
                grid: { color: 'rgba(0, 0, 0, 0.05)' },
                pointLabels: {
                    display: false // We use custom labels
                }
            }
        },
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                backgroundColor: 'white',
                titleColor: '#0f172a',
                bodyColor: '#475569',
                borderColor: '#e2e8f0',
                borderWidth: 1,
                padding: 12,
                cornerRadius: 8,
                displayColors: true,
                callbacks: {
                    title: (items) => {
                        const compId = selectedCompetencies[items[0].dataIndex];
                        const comp = competencies.find(c => c.id === compId);
                        return comp?.name || '';
                    },
                    afterBody: () => '(คลิกเพื่อดูรายละเอียด)'
                }
            }
        },
        maintainAspectRatio: false,
    };

    // Custom Chart Labels Renderer
    const renderChartLabels = () => {
        const angleStep = (2 * Math.PI) / selectedCompetencies.length;
        const startAngle = -Math.PI / 2;

        return selectedCompetencies.map((id, index) => {
            const comp = competencies.find(c => c.id === id);
            const angle = startAngle + index * angleStep;
            const x = Math.cos(angle) * chartLabelRadius;
            const y = Math.sin(angle) * chartLabelRadius;
            const Icon = comp.icon;
            const isActive = activeCompetency === id;

            return (
                <div
                    key={id}
                    className={`chart-label ${isActive ? 'active' : ''}`}
                    style={{ transform: `translate(${x}px, ${y}px) translate(-50%, -50%)` }}
                    onClick={() => {
                        // If clicking label, we default to "first dataset" equivalent or just toggle
                        onCompetencyClick(id, 0);
                    }}
                >
                    <div
                        className="label-icon"
                        style={{
                            backgroundColor: `${comp.color}${isActive ? '30' : '15'}`,
                            color: comp.color,
                            transform: isActive ? 'scale(1.1)' : 'scale(1)'
                        }}
                    >
                        <Icon size={22} />
                    </div>
                    <span className="label-text" style={{ color: isActive ? comp.color : undefined }}>
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
                    กราฟสมรรถนะ
                </h2>
                <span className="year-badge">
                    {filterMode === 'year'
                        ? `ปี ${selectedYears.join(', ')}`
                        : `${months[dateRange.startMonth - 1]?.short} ${dateRange.startYear} - ${months[dateRange.endMonth - 1]?.short} ${dateRange.endYear}`
                    }
                </span>
            </div>
            <div className="chart-wrapper">
                <div className="chart-labels-container">
                    {renderChartLabels()}
                </div>
                <div className="chart-canvas">
                    <Radar ref={chartRef} data={chartData} options={radarOptions} />
                </div>
            </div>

            {/* Custom Legend */}
            <div className="chart-custom-legend">
                {chartData.datasets
                    .filter(ds => !ds.label.includes('เกณฑ์'))
                    .map((ds, i) => (
                        <div key={i} className="legend-item">
                            <div
                                className="legend-color"
                                style={{ backgroundColor: ds.borderColor, borderColor: ds.borderColor }}
                            ></div>
                            <span>{ds.label}</span>
                        </div>
                    ))}
                {showRequirement && (
                    <div className="legend-item">
                        <div className="legend-color dashed" style={{ borderColor: '#ef4444' }}></div>
                        <span>เกณฑ์หลักสูตร</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CompetencyRadarChart;
