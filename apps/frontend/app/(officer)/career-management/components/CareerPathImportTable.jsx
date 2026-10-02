'use client';

import { AlertCircle, ChevronRight, Pencil } from 'lucide-react';
import { officerText } from '../../officer-labels';

function statusLabel(status, language) {
    const labels = {
        ready: ['พร้อมนำเข้า', 'Ready to import'],
        update: ['อัปเดตร่าง', 'Update draft'],
        duplicate: ['รายการซ้ำ · ข้ามอัตโนมัติ', 'Duplicate · skipped'],
        skipped: ['ข้ามรายการ', 'Skipped'],
        error: ['ต้องแก้ไข', 'Needs correction'],
        stale: ['ต้องตรวจใหม่', 'Revalidate'],
        pending: ['รอตรวจสอบ', 'Pending review'],
    };
    const [th, en] = labels[status] || labels.pending;
    return officerText(language, th, en);
}

export default function CareerPathImportTable({
    items,
    language,
    busy,
    previewStale,
    onSelectionChange,
    onActionChange,
    onOpenRow,
}) {
    const eligible = items.filter((item) => item.canSelect);
    const selectedEligible = eligible.filter((item) => item.selected).length;
    const allSelected = eligible.length > 0 && selectedEligible === eligible.length;
    const partlySelected = selectedEligible > 0 && !allSelected;

    const renderSelection = (item) => (
        <input
            type="checkbox"
            checked={item.selected}
            disabled={!item.canSelect || busy || previewStale}
            aria-label={officerText(language, `เลือกรายการ ${item.row.code}`, `Select ${item.row.code}`)}
            onChange={(event) => onSelectionChange(item.row.clientKey, event.target.checked)}
        />
    );

    const renderAction = (item) => (
        <select
            className="career-import-table__action"
            value={item.row.actionIntent}
            aria-label={officerText(language, `การจัดการ ${item.row.code}`, `Action for ${item.row.code}`)}
            disabled={busy}
            onChange={(event) => onActionChange(item.row.clientKey, event.target.value)}
        >
            <option value="auto">{officerText(language, 'ตรวจอัตโนมัติ', 'Automatic')}</option>
            <option value="update" disabled={!item.validation?.career_path_id}>
                {officerText(language, 'อัปเดตข้อมูลเดิม', 'Update existing')}
            </option>
            <option value="skip">{officerText(language, 'ข้ามรายการ', 'Skip')}</option>
        </select>
    );

    const renderStatus = (item) => (
        <span className={`career-import-status career-import-status--${item.status}`}>
            {statusLabel(item.status, language)}
            {item.issues.length > 0 && (
                <span className="career-import-status__count" aria-label={officerText(language, `${item.issues.length} ข้อผิดพลาด`, `${item.issues.length} issues`)}>
                    {item.issues.length}
                </span>
            )}
        </span>
    );

    if (items.length === 0) {
        return <div className="career-import__empty">{officerText(language, 'ไม่พบรายการตามเงื่อนไขที่เลือก', 'No rows match the current filters.')}</div>;
    }

    return (
        <div className="career-import-table-area">
            <div className="career-import-table-wrap">
                <table className="career-import-table">
                    <thead>
                        <tr>
                            <th className="career-import-table__check">
                                <input
                                    type="checkbox"
                                    checked={allSelected}
                                    ref={(node) => { if (node) node.indeterminate = partlySelected; }}
                                    disabled={eligible.length === 0 || busy || previewStale}
                                    aria-label={officerText(language, 'เลือกทั้งหมดในหน้านี้', 'Select all eligible rows on this page')}
                                    onChange={(event) => eligible.forEach((item) => onSelectionChange(item.row.clientKey, event.target.checked))}
                                />
                            </th>
                            <th>{officerText(language, 'รหัส', 'Code')}</th>
                            <th>{officerText(language, 'สายงาน', 'Career path')}</th>
                            <th>{officerText(language, 'หลักสูตร / สมรรถนะ', 'Curricula / competencies')}</th>
                            <th>{officerText(language, 'สถานะ', 'Status')}</th>
                            <th>{officerText(language, 'การดำเนินการ', 'Action')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item) => (
                            <tr key={item.row.clientKey} className={item.status === 'error' ? 'career-import-table__row--error' : ''}>
                                <td className="career-import-table__check">{renderSelection(item)}</td>
                                <td><code>{item.row.code || '-'}</code></td>
                                <td>
                                    <button
                                        type="button"
                                        className="career-import-table__name"
                                        data-career-import-edit={item.row.clientKey}
                                        onClick={() => onOpenRow(item.row.clientKey)}
                                        aria-label={officerText(language, `ดูหรือแก้ไข ${item.row.name_th || item.row.code}`, `Review or edit ${item.row.name_en || item.row.code}`)}
                                    >
                                        <strong>{item.row.name_th || officerText(language, 'ยังไม่มีชื่อภาษาไทย', 'Thai name missing')}</strong>
                                        {item.row.name_en && <span>{item.row.name_en}</span>}
                                    </button>
                                </td>
                                <td className="career-import-table__relations">
                                    <span>{officerText(language, `${item.curriculumCount} หลักสูตร`, `${item.curriculumCount} curricula`)}</span>
                                    <span>{officerText(language, `${item.competencyCount} สมรรถนะ`, `${item.competencyCount} competencies`)}</span>
                                </td>
                                <td>{renderStatus(item)}</td>
                                <td className="career-import-table__controls">
                                    {renderAction(item)}
                                    <button type="button" className="career-import-table__edit" onClick={() => onOpenRow(item.row.clientKey)} aria-label={officerText(language, 'แก้ไขรายการ', 'Edit row')}>
                                        <Pencil size={15} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="career-import-cards" aria-label={officerText(language, 'รายการนำเข้า', 'Import rows')}>
                {items.map((item) => (
                    <article className={`career-import-card ${item.status === 'error' ? 'career-import-card--error' : ''}`} key={item.row.clientKey}>
                        <div className="career-import-card__top">
                            {renderSelection(item)}
                            <code>{item.row.code || '-'}</code>
                            {renderStatus(item)}
                        </div>
                        <button type="button" className="career-import-card__name" onClick={() => onOpenRow(item.row.clientKey)}>
                            <strong>{item.row.name_th || officerText(language, 'ยังไม่มีชื่อภาษาไทย', 'Thai name missing')}</strong>
                            {item.row.name_en && <span>{item.row.name_en}</span>}
                        </button>
                        <div className="career-import-card__meta">
                            <span>{officerText(language, `${item.curriculumCount} หลักสูตร`, `${item.curriculumCount} curricula`)}</span>
                            <span>{officerText(language, `${item.competencyCount} สมรรถนะ`, `${item.competencyCount} competencies`)}</span>
                        </div>
                        <div className="career-import-card__actions">
                            {renderAction(item)}
                            <button type="button" className="ui-button ui-button--secondary" onClick={() => onOpenRow(item.row.clientKey)}>
                                <AlertCircle size={15} /> {officerText(language, 'ตรวจรายละเอียด', 'Review details')} <ChevronRight size={15} />
                            </button>
                        </div>
                    </article>
                ))}
            </div>
        </div>
    );
}
