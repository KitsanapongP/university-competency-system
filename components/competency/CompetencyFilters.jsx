'use client';

import React from 'react';
import { Filter, Brain, Calendar, Target, Check } from 'lucide-react';

const CompetencyFilters = ({
    allCompetencies,
    selectedCompetencies,
    onToggleCompetency,
    filterMode,
    setFilterMode,
    years,
    months,
    selectedYears,
    onToggleYear,
    dateRange,
    setDateRange,
    showRequirement,
    setShowRequirement
}) => {
    return (
        <div className="filter-section card">
            <div className="card-header">
                <h2>
                    <Filter size={20} className="section-icon" />
                    ตัวกรอง
                </h2>
            </div>

            {/* Competency Filter */}
            <div className="filter-group">
                <label>
                    <Brain size={14} />
                    เลือกสมรรถนะ
                </label>
                <div className="competency-chips">
                    {allCompetencies.map(comp => {
                        const Icon = comp.icon;
                        const isSelected = selectedCompetencies.includes(comp.id);
                        return (
                            <button
                                key={comp.id}
                                className={`comp-chip ${isSelected ? 'selected' : ''}`}
                                onClick={() => onToggleCompetency(comp.id)}
                                style={isSelected ? { borderColor: comp.color, backgroundColor: `${comp.color}10` } : {}}
                            >
                                <Icon size={14} style={{ color: isSelected ? comp.color : undefined }} />
                                <span>{comp.name}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Filter Mode Toggle */}
            <div className="filter-group">
                <label>
                    <Filter size={14} />
                    โหมดการกรอง
                </label>
                <div className="mode-toggle">
                    <button
                        className={`mode-btn ${filterMode === 'year' ? 'active' : ''}`}
                        onClick={() => setFilterMode('year')}
                    >
                        เปรียบเทียบปี
                    </button>
                    <button
                        className={`mode-btn ${filterMode === 'range' ? 'active' : ''}`}
                        onClick={() => setFilterMode('range')}
                    >
                        ช่วงเวลา
                    </button>
                </div>
            </div>

            {/* Year Filter - show when filterMode is 'year' */}
            {filterMode === 'year' && (
                <div className="filter-group">
                    <label>
                        <Calendar size={14} />
                        ปีการศึกษา (เลือกได้หลายปี)
                    </label>
                    <div className="year-buttons">
                        {years.map(year => (
                            <button
                                key={year}
                                className={`year-btn ${selectedYears.includes(year) ? 'selected' : ''}`}
                                onClick={() => onToggleYear(year)}
                            >
                                {selectedYears.includes(year) && <Check size={14} />}
                                {year}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Date Range Filters - show when filterMode is 'range' */}
            {filterMode === 'range' && (
                <>
                    <div className="filter-group">
                        <label>
                            <Calendar size={14} />
                            ช่วงเวลาเริ่มต้น
                        </label>
                        <div className="date-range-row">
                            <select
                                className="date-select"
                                value={dateRange.startMonth}
                                onChange={(e) => setDateRange({ ...dateRange, startMonth: parseInt(e.target.value) })}
                            >
                                {months.map((month, idx) => (
                                    <option key={month.id} value={idx + 1}>{month.label}</option>
                                ))}
                            </select>
                            <select
                                className="date-select"
                                value={dateRange.startYear}
                                onChange={(e) => setDateRange({ ...dateRange, startYear: e.target.value })}
                            >
                                {years.map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="filter-group">
                        <label>
                            <Calendar size={14} />
                            ช่วงเวลาสิ้นสุด
                        </label>
                        <div className="date-range-row">
                            <select
                                className="date-select"
                                value={dateRange.endMonth}
                                onChange={(e) => setDateRange({ ...dateRange, endMonth: parseInt(e.target.value) })}
                            >
                                {months.map((month, idx) => (
                                    <option key={month.id} value={idx + 1}>{month.label}</option>
                                ))}
                            </select>
                            <select
                                className="date-select"
                                value={dateRange.endYear}
                                onChange={(e) => setDateRange({ ...dateRange, endYear: e.target.value })}
                            >
                                {years.map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </>
            )}

            {/* Requirement Toggle */}
            <div className="filter-group toggle-group">
                <label>
                    <Target size={14} />
                    แสดงเกณฑ์หลักสูตร
                </label>
                <button
                    className={`toggle-switch ${showRequirement ? 'on' : ''}`}
                    onClick={() => setShowRequirement(!showRequirement)}
                >
                    <div className="toggle-knob"></div>
                </button>
            </div>
        </div>
    );
};

export default CompetencyFilters;
