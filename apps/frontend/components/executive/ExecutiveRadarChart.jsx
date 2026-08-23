'use client';

import React, { useMemo } from 'react';
import {
    Chart as ChartJS,
    Filler,
    Legend,
    LineElement,
    PointElement,
    RadialLinearScale,
    Tooltip,
} from 'chart.js';
import { Radar } from 'react-chartjs-2';
import { useTheme } from '../../providers/theme-provider';
import { useLanguage } from '../../providers/LanguageContext';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

function displayName(item, language) {
    if (language === 'en' && item.name_en) return item.name_en;
    return item.name_th || item.name_en || item.code;
}

export default function ExecutiveRadarChart({ competencies = [], targetLabel }) {
    const { resolvedTheme } = useTheme();
    const { language, t } = useLanguage();
    const dark = resolvedTheme === 'dark';

    const labels = useMemo(
        () => competencies.map((item) => displayName(item, language)),
        [competencies, language],
    );
    const values = useMemo(
        () => competencies.map((item) => Number(item.average_score || 0)),
        [competencies],
    );
    const targetValues = useMemo(
        () => competencies.map((item) => Number(item.target_score || 0)),
        [competencies],
    );
    const maxScore = Math.max(100, ...values, ...targetValues);
    const scaleMax = Math.ceil(maxScore / 25) * 25;

    if (!competencies.length) {
        return (
            <div className="executive-chart-empty">
                {t('executive_no_competency_data') || 'ยังไม่มีข้อมูลสมรรถนะที่พร้อมแสดง'}
            </div>
        );
    }

    const data = {
        labels,
        datasets: [
            {
                label: t('executive_course_total') || 'คะแนนจากรายวิชา',
                data: values,
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.2)',
                pointBackgroundColor: '#2563eb',
                pointBorderColor: dark ? '#0f172a' : '#ffffff',
                pointRadius: 4,
                borderWidth: 2,
            },
            {
                label: t('executive_target') || 'เป้าหมาย',
                data: targetValues,
                borderColor: '#f97316',
                backgroundColor: 'rgba(249, 115, 22, 0.05)',
                pointBackgroundColor: '#f97316',
                pointBorderColor: dark ? '#0f172a' : '#ffffff',
                pointRadius: 3,
                borderWidth: 1.5,
                borderDash: [6, 4],
            },
        ],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            r: {
                min: 0,
                max: scaleMax,
                ticks: {
                    stepSize: scaleMax / 4,
                    color: dark ? '#a1b4cf' : '#64748b',
                    backdropColor: 'transparent',
                    font: { size: 10 },
                },
                grid: { color: dark ? 'rgba(161, 180, 207, 0.22)' : 'rgba(100, 116, 139, 0.2)' },
                angleLines: { color: dark ? 'rgba(161, 180, 207, 0.22)' : 'rgba(100, 116, 139, 0.2)' },
                pointLabels: {
                    color: dark ? '#f1f5f9' : '#0f172a',
                    font: { family: 'Inter, Prompt, sans-serif', size: 11 },
                },
            },
        },
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    color: dark ? '#f1f5f9' : '#0f172a',
                    usePointStyle: true,
                    padding: 16,
                },
            },
            tooltip: {
                callbacks: {
                    label: (context) => context.dataset.label + ': ' + Number(context.raw || 0).toFixed(2),
                },
            },
        },
    };

    return (
        <div className="executive-chart-wrap">
            <div className="executive-chart-canvas">
                <Radar data={data} options={options} />
            </div>
            <p className="executive-chart-note">
                    {targetLabel || (t('executive_target_note') || 'เส้นสีส้มคือเกณฑ์ของรุ่นนักศึกษา')}
            </p>
        </div>
    );
}
