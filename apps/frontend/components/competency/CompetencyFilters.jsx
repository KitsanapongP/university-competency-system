'use client';

import React from 'react';
import { Filter, Brain, Calendar, Target, Check } from 'lucide-react';
import { useLanguage } from '../../providers/LanguageContext';

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
    setShowRequirement,
    category,
    setCategory,
}) => {
    const { t } = useLanguage();

    return (
        <div className="filter-section card">
            <div className="card-header">
                <h2>
                    <Filter size={20} className="section-icon" />
                    {t('filter')}
                </h2>
            </div>

            {/* Category Filter (Activity vs Course) */}
            <div className="filter-group">
                <label>
                    {t('select_category_label')}
                </label>
                <div className="mode-toggle">
                    <button
                        className={`mode-btn ${category === 'activity' ? 'active' : ''}`}
                        onClick={() => setCategory('activity')}
                    >
                        {t('activities') || 'Activities'}
                    </button>
                    <button
                        className={`mode-btn ${category === 'course' ? 'active' : ''}`}
                        onClick={() => setCategory('course')}
                    >
                        {t('courses') || 'Courses'}
                    </button>
                </div>
            </div>
            {/* v>Competency Filter */}
            <div className="filter-group">
                <label>
                    <Brain size={14} />
                    {t('select_competency_label')}
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
                    {t('filter_mode')}
                </label>
                <div className="mode-toggle">
                    <button
                        className={`mode-btn ${filterMode === 'year' ? 'active' : ''}`}
                        onClick={() => setFilterMode('year')}
                    >
                        {t('compare_years')}
                    </button>
                    <button
                        className={`mode-btn ${filterMode === 'range' ? 'active' : ''}`}
                        onClick={() => setFilterMode('range')}
                    >
                        {t('date_range_mode')}
                    </button>
                </div>
            </div>

            {/* Year Filter - show when filterMode is 'year' */}
            {filterMode === 'year' && (
                <div className="filter-group">
                    <label>
                        <Calendar size={14} />
                        {t('academic_year')}
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
                            {t('start_range')}
                        </label>
                        <div className="date-range-row">
                            <select
                                className="date-select"
                                value={dateRange.startMonth}
                                onChange={(e) => setDateRange({ ...dateRange, startMonth: parseInt(e.target.value) })}
                            >
                                {months.map((month, idx) => (
                                    <option key={month.id} value={idx + 1}>{t(month.id)}</option>
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
                            {t('end_range')}
                        </label>
                        <div className="date-range-row">
                            <select
                                className="date-select"
                                value={dateRange.endMonth}
                                onChange={(e) => setDateRange({ ...dateRange, endMonth: parseInt(e.target.value) })}
                            >
                                {months.map((month, idx) => (
                                    <option key={month.id} value={idx + 1}>{t(month.id)}</option>
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
                    {t('show_requirement')}
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
