'use client';

import { Award, Check } from 'lucide-react';
import CompetencyTagInput from './CompetencyTagInput';

/**
 * CompetencyWeightForm — ส่วนล่างของ Panel 3
 * TagInput เลือก Competency + กรอก Weight %
 *
 * Props:
 *   competencies        — รายการ competency ทั้งหมด
 *   selectedWeights     — [{ competency, weight }]
 *   onCompetencyChange  — เมื่อ tag เปลี่ยน (รับ competency[] ใหม่)
 *   onWeightChange(id, value) — เมื่อกรอก weight
 *   onCreateCompetency(name) → competency — สร้าง competency ใหม่
 *   onSave()            — เมื่อกดบันทึก
 */
export default function CompetencyWeightForm({
    competencies = [],
    selectedWeights = [],
    onCompetencyChange,
    onWeightChange,
    onCreateCompetency,
    onSave,
}) {
    const selectedCompetencies = selectedWeights.map(w => w.competency);
    const totalWeight = selectedWeights.reduce((sum, w) => sum + (Number(w.weight) || 0), 0);
    const isOverWeight = totalWeight > 100;
    const isExact = totalWeight === 100;

    return (
        <div className="cwf-wrapper">
            {/* Tag Input */}
            <div className="detail-section">
                <h3 className="detail-section__title">
                    <Award size={15} /> ผูก Competency
                </h3>
                <CompetencyTagInput
                    competencies={competencies}
                    selected={selectedCompetencies}
                    onChange={onCompetencyChange}
                    onCreateNew={onCreateCompetency}
                    placeholder="ค้นหาหรือสร้าง Competency..."
                />
            </div>

            {/* Weight inputs — โผล่เมื่อเลือก competency แล้ว */}
            {selectedWeights.length > 0 && (
                <div className="detail-section">
                    <h3 className="detail-section__title">กำหนด Weight (%)</h3>

                    <div className="competency-weight-list">
                        {selectedWeights.map(({ competency, weight }) => (
                            <div key={competency.id} className="competency-row">
                                <span
                                    className="competency-dot"
                                    style={{ background: competency.color || '#7dd3fc' }}
                                />
                                <span className="competency-name">{competency.name}</span>
                                <div className="competency-weight">
                                    <input
                                        className="weight-input"
                                        type="number"
                                        min={0}
                                        max={100}
                                        placeholder="0"
                                        value={weight || ''}
                                        onChange={e => onWeightChange(competency.id, e.target.value)}
                                    />
                                    <span className="weight-unit">%</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Total */}
                    <div className={`weight-total 
                        ${isOverWeight ? 'weight-total--error' : ''} 
                        ${isExact     ? 'weight-total--ok'    : ''}`}
                    >
                        {isOverWeight && '⚠ เกิน 100% — '}
                        {isExact && '✓ '}
                        รวม {totalWeight}%
                    </div>

                    <button
                        className="btn btn--primary btn--sm"
                        style={{ marginTop: '1rem' }}
                        disabled={isOverWeight}
                        onClick={onSave}
                    >
                        <Check size={14} /> บันทึก Competency
                    </button>
                </div>
            )}
        </div>
    );
}