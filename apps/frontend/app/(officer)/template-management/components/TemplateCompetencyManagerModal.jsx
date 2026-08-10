'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckSquare, Plus, RefreshCw, Search, ShieldAlert } from 'lucide-react';
import BaseModal from '../../../../components/ui/BaseModal';

const COPY = {
    th: {
        title: 'จัดการสมรรถนะใน Template',
        search: 'ค้นหารหัสหรือชื่อสมรรถนะ',
        selected: 'เลือกแล้ว',
        items: 'รายการ',
        empty: 'ไม่พบสมรรถนะที่ตรงกับการค้นหา',
        noItems: 'ยังไม่มีสมรรถนะให้เลือก',
        activeLock: 'Template นี้เปิดใช้งานอยู่ จึงไม่สามารถเปลี่ยนสมรรถนะได้',
        scoreLock: 'Template นี้มีคะแนนรายวิชาของผู้เรียนแล้ว จึงไม่สามารถเปลี่ยนสมรรถนะได้',
        refresh: 'โหลดใหม่',
        addMaster: 'เพิ่มสมรรถนะใหม่',
        addMasterHint: 'ไปหน้าจัดการสมรรถนะเพื่อสร้าง Competency master ใหม่',
        cancel: 'ยกเลิก',
        save: 'บันทึกสมรรถนะ',
        saving: 'กำลังบันทึก...',
        current: 'รายการที่เชื่อมอยู่ในปัจจุบัน',
    },
    en: {
        title: 'Manage Template Competencies',
        search: 'Search competency code or name',
        selected: 'Selected',
        items: 'items',
        empty: 'No competencies match your search',
        noItems: 'No competencies are available',
        activeLock: 'This template is active, so its competencies cannot be changed.',
        scoreLock: 'This template already has learner course scores, so its competencies cannot be changed.',
        refresh: 'Refresh',
        addMaster: 'Add new competency',
        addMasterHint: 'Open Competency Management to create a new competency master',
        cancel: 'Cancel',
        save: 'Save competencies',
        saving: 'Saving...',
        current: 'Currently associated competencies',
    },
};

function normalizeId(competency) {
    return competency?.id || competency?.competency_id;
}

export default function TemplateCompetencyManagerModal({
    open,
    template,
    availableCompetencies = [],
    managerState,
    loading = false,
    saving = false,
    language = 'th',
    onClose,
    onRefresh,
    onSave,
}) {
    const copy = COPY[language] || COPY.th;
    const [query, setQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState([]);
    const initializedTemplateIdRef = useRef(null);
    const selectedCompetencies = managerState?.competencies || [];
    const canManage = Boolean(managerState?.can_manage);

    useEffect(() => {
        if (!open) {
            initializedTemplateIdRef.current = null;
            return;
        }

        const templateID = managerState?.template_id || template?.id;
        if (!templateID || initializedTemplateIdRef.current === templateID || !managerState) return;

        initializedTemplateIdRef.current = templateID;
        setQuery('');
        setSelectedIds(selectedCompetencies.map(normalizeId).filter(Boolean));
    }, [open, managerState, selectedCompetencies, template?.id]);

    useEffect(() => {
        if (!open) return undefined;

        const handleWindowFocus = () => onRefresh?.();
        window.addEventListener('focus', handleWindowFocus);
        return () => window.removeEventListener('focus', handleWindowFocus);
    }, [open, onRefresh]);

    const allOptions = useMemo(() => {
        const byId = new Map();
        availableCompetencies.forEach(competency => byId.set(normalizeId(competency), competency));
        selectedCompetencies.forEach(competency => {
            const id = normalizeId(competency);
            if (id && !byId.has(id)) byId.set(id, competency);
        });
        return [...byId.values()].filter(competency => normalizeId(competency));
    }, [availableCompetencies, selectedCompetencies]);

    const filteredOptions = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        const source = normalizedQuery
            ? allOptions.filter(competency => [
                competency.code,
                competency.nameTh,
                competency.name_th,
                competency.nameEn,
                competency.name_en,
                competency.name,
            ].some(value => String(value || '').toLowerCase().includes(normalizedQuery)))
            : allOptions;
        return [...source].sort((left, right) => {
            const leftName = left.nameTh || left.name_th || left.name || '';
            const rightName = right.nameTh || right.name_th || right.name || '';
            return leftName.localeCompare(rightName, 'th') || String(left.code || '').localeCompare(String(right.code || ''));
        });
    }, [allOptions, query]);

    const originalKey = selectedCompetencies.map(normalizeId).filter(Boolean).sort((a, b) => a - b).join(',');
    const selectedKey = [...selectedIds].sort((a, b) => a - b).join(',');
    const hasChanges = originalKey !== selectedKey;
    const lockMessage = managerState?.lock_reason === 'learner_course_scores'
        ? copy.scoreLock
        : copy.activeLock;

    const toggleCompetency = (competencyID) => {
        if (!canManage || saving) return;
        setSelectedIds(current => current.includes(competencyID)
            ? current.filter(id => id !== competencyID)
            : [...current, competencyID]);
    };

    const openCompetencyManagement = () => {
        window.open('/competency-management', '_blank', 'noopener,noreferrer');
    };

    const footer = (
        <>
            <button type="button" className="course-btn course-btn--ghost" onClick={onClose} disabled={saving}>
                {copy.cancel}
            </button>
            <button
                type="button"
                className="course-btn course-btn--primary"
                onClick={() => onSave?.(selectedIds)}
                disabled={!canManage || !hasChanges || loading || saving}
            >
                <CheckSquare size={16} /> {saving ? copy.saving : copy.save}
            </button>
        </>
    );

    return (
        <BaseModal open={open} title={copy.title} size="lg" onClose={onClose} closeDisabled={saving} footer={footer}>
            <div className="template-competency-manager">
                {(managerState && !canManage) && (
                    <div className="template-competency-manager__lock" role="status">
                        <ShieldAlert size={18} />
                        <span>{lockMessage}</span>
                    </div>
                )}

                <div className="template-competency-manager__toolbar">
                    <label className="template-competency-manager__search">
                        <Search size={16} />
                        <input
                            value={query}
                            onChange={event => setQuery(event.target.value)}
                            placeholder={copy.search}
                        />
                    </label>
                    <button type="button" className="course-btn course-btn--ghost course-btn--icon" onClick={onRefresh} disabled={loading || saving} title={copy.refresh}>
                        <RefreshCw size={16} className={loading ? 'template-competency-manager__spin' : ''} />
                    </button>
                    <button
                        type="button"
                        className="course-btn course-btn--ghost template-competency-manager__add-master"
                        onClick={openCompetencyManagement}
                        disabled={!canManage || loading || saving}
                        title={copy.addMasterHint}
                        aria-label={copy.addMaster}
                    >
                        <Plus size={16} /> {copy.addMaster}
                    </button>
                </div>

                <div className="template-competency-manager__summary">
                    <span>{copy.selected} <strong>{selectedIds.length}</strong> {copy.items}</span>
                    {template?.name && <span>{template.name}</span>}
                </div>

                <div className="template-competency-manager__list" aria-busy={loading}>
                    {loading && allOptions.length === 0 ? (
                        <div className="template-competency-manager__empty">{copy.refresh}</div>
                    ) : filteredOptions.length === 0 ? (
                        <div className="template-competency-manager__empty">
                            {allOptions.length ? copy.empty : copy.noItems}
                        </div>
                    ) : filteredOptions.map(competency => {
                        const competencyID = normalizeId(competency);
                        const checked = selectedIds.includes(competencyID);
                        const nameTh = competency.nameTh || competency.name_th || competency.name || '';
                        const nameEn = competency.nameEn || competency.name_en || '';
                        return (
                            <label key={competencyID} className={`template-competency-manager__row ${checked ? 'template-competency-manager__row--selected' : ''}`}>
                                <input type="checkbox" checked={checked} disabled={!canManage || saving} onChange={() => toggleCompetency(competencyID)} />
                                <span className="template-competency-manager__dot" style={{ backgroundColor: competency.color || '#3b82f6' }} />
                                <span className="template-competency-manager__content">
                                    <strong>{nameTh}</strong>
                                    <small>{competency.code}{nameEn ? ` · ${nameEn}` : ''}</small>
                                </span>
                            </label>
                        );
                    })}
                </div>
            </div>
        </BaseModal>
    );
}
