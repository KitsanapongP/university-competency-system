'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Edit3, Plus, RefreshCw, Save, Search, ShieldCheck, Trash2 } from 'lucide-react';
import {
    createCompetency,
    deleteCompetency,
    fetchCompetenciesForManagement,
    updateCompetency,
} from '../../../lib/competency-management';
import ToastNotifications from '../../../components/ui/ToastNotifications';
import BaseModal from '../../../components/ui/BaseModal';
import ConfirmActionModal from '../../../components/ui/ConfirmActionModal';
import { useLanguage } from '../../../providers/LanguageContext';
import { officerText } from '../officer-labels';
import '../curriculum-management/CourseLayout.css';
import '../curriculum-management/CourseList.css';
import './CompetencyManagement.css';

const EMPTY_COMPETENCY_FORM = {
    code: '',
    nameTh: '',
    nameEn: '',
    description: '',
};

const BACKEND_MESSAGE_TH = {
    'code is required': 'กรุณากรอกรหัสสมรรถนะ',
    'name_th is required': 'กรุณากรอกชื่อสมรรถนะภาษาไทย',
    'competency code already exists': 'รหัสสมรรถนะนี้มีอยู่แล้ว',
    'competency already exists': 'มีสมรรถนะนี้อยู่แล้ว',
    'competency not found': 'ไม่พบสมรรถนะ',
    'competency is used by templates': 'ไม่สามารถแก้ไขหรือลบสมรรถนะนี้ได้ เพราะมี Template ใช้อยู่',
    'competency operation failed': 'ไม่สามารถดำเนินการกับสมรรถนะได้',
};

const BACKEND_MESSAGE_EN = {
    'code is required': 'Please enter a competency code.',
    'name_th is required': 'Please enter the Thai competency name.',
    'competency code already exists': 'This competency code already exists.',
    'competency already exists': 'This competency already exists.',
    'competency not found': 'Competency not found.',
    'competency is used by templates': 'This competency cannot be changed or deleted because a template uses it.',
    'competency operation failed': 'Unable to complete the competency operation.',
};

function mapCompetencyError(error, language) {
    const englishMessage = error?.message || error?.payload?.error?.message || '';
    if (error?.code === 'COMPETENCY_IN_USE') {
        return officerText(language, 'ไม่สามารถแก้ไขหรือลบสมรรถนะนี้ได้ เพราะมี Template ใช้อยู่', 'This competency cannot be changed or deleted because a template uses it.');
    }
    if (error?.code === 'DUPLICATE') {
        return officerText(
            language,
            BACKEND_MESSAGE_TH[englishMessage] || 'รหัสสมรรถนะนี้มีอยู่แล้ว',
            BACKEND_MESSAGE_EN[englishMessage] || 'This competency code already exists.',
        );
    }
    return officerText(
        language,
        BACKEND_MESSAGE_TH[englishMessage] || englishMessage || 'ไม่สามารถดำเนินการกับสมรรถนะได้',
        BACKEND_MESSAGE_EN[englishMessage] || englishMessage || 'Unable to complete the competency operation.',
    );
}

function CompetencyFormModal({ mode, form, setForm, submitting, onClose, onSubmit }) {
    const { language } = useLanguage();
    const canSubmit = String(form.code || '').trim() && String(form.nameTh || '').trim();

    return (
        <BaseModal
            open
            title={mode === 'edit' ? officerText(language, 'แก้ไขสมรรถนะ', 'Edit competency') : officerText(language, 'เพิ่มสมรรถนะใหม่', 'Add competency')}
            size="md"
            onClose={onClose}
            closeDisabled={submitting}
            footer={(
                <>
                    <button className="course-btn course-btn--ghost" onClick={onClose} disabled={submitting}>
                        {officerText(language, 'ยกเลิก', 'Cancel')}
                    </button>
                    <button className="course-btn course-btn--primary" onClick={onSubmit} disabled={submitting || !canSubmit}>
                        <Save size={16} />
                        {submitting
                            ? officerText(language, 'กำลังบันทึก...', 'Saving...')
                            : officerText(language, 'บันทึก', 'Save')}
                    </button>
                </>
            )}
        >
                    <div className="course-row">
                        <label className="course-field">
                            <span className="course-label">
                                {officerText(language, 'รหัสสมรรถนะ', 'Competency code')}
                                <span className="course-required">*</span>
                            </span>
                            <input
                                className="course-input"
                                value={form.code}
                                onChange={event => setForm(prev => ({ ...prev, code: event.target.value }))}
                                placeholder={officerText(language, 'เช่น comm', 'e.g. comm')}
                            />
                        </label>

                        <label className="course-field">
                            <span className="course-label">
                                {officerText(language, 'ชื่อสมรรถนะ (ภาษาไทย)', 'Competency name (Thai)')}
                                <span className="course-required">*</span>
                            </span>
                            <input
                                className="course-input"
                                value={form.nameTh}
                                onChange={event => setForm(prev => ({ ...prev, nameTh: event.target.value }))}
                                placeholder={officerText(language, 'เช่น การสื่อสาร', 'e.g. การสื่อสาร')}
                            />
                        </label>
                    </div>

                    <label className="course-field">
                        <span className="course-label">
                            {officerText(language, 'ชื่อสมรรถนะ (ภาษาอังกฤษ)', 'Competency name (English)')}
                        </span>
                        <input
                            className="course-input"
                            value={form.nameEn}
                            onChange={event => setForm(prev => ({ ...prev, nameEn: event.target.value }))}
                            placeholder={officerText(language, 'เช่น Communication', 'e.g. Communication')}
                        />
                    </label>

                    <label className="course-field">
                        <span className="course-label">{officerText(language, 'คำอธิบาย', 'Description')}</span>
                        <textarea
                            className="course-input competency-management__textarea"
                            value={form.description}
                            onChange={event => setForm(prev => ({ ...prev, description: event.target.value }))}
                            placeholder={officerText(language, 'รายละเอียดเพิ่มเติมของสมรรถนะ', 'Additional competency details')}
                            rows={4}
                        />
                    </label>
        </BaseModal>
    );
}

function DeleteCompetencyModal({ competency, submitting, onCancel, onConfirm }) {
    const { language } = useLanguage();

    return (
        <ConfirmActionModal
            open={Boolean(competency)}
            title={officerText(language, 'ลบสมรรถนะ', 'Delete competency')}
            message={(
                <>
                    {officerText(language, 'ยืนยันการลบสมรรถนะ ', 'Delete competency ')}
                    <strong>{competency?.nameTh || competency?.code}</strong>
                    {officerText(language, ' หรือไม่?', '?')}
                </>
            )}
            hint={officerText(
                language,
                'ระบบจะลบแบบ Soft delete และซ่อนออกจากรายการใช้งานปกติ',
                'The competency will be soft-deleted and hidden from active lists.',
            )}
            confirmLabel={submitting
                ? officerText(language, 'กำลังลบ...', 'Deleting...')
                : officerText(language, 'ลบสมรรถนะ', 'Delete competency')}
            variant="danger"
            loading={submitting}
            onCancel={onCancel}
            onConfirm={onConfirm}
        />
    );
}

export default function CompetencyManagementPage() {
    const { language } = useLanguage();
    const [competencies, setCompetencies] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [feedback, setFeedback] = useState({ type: '', message: '' });
    const [modalMode, setModalMode] = useState('');
    const [editingCompetency, setEditingCompetency] = useState(null);
    const [deletingCompetency, setDeletingCompetency] = useState(null);
    const [form, setForm] = useState(EMPTY_COMPETENCY_FORM);

    const loadCompetencies = useCallback(async ({ clearFeedback = true } = {}) => {
        setLoading(true);
        if (clearFeedback) {
            setFeedback({ type: '', message: '' });
        }
        try {
            const nextCompetencies = await fetchCompetenciesForManagement();
            setCompetencies(nextCompetencies);
        } catch (err) {
            setFeedback({
                type: 'error',
                message: mapCompetencyError(err, language) || officerText(language, 'ไม่สามารถโหลดข้อมูลสมรรถนะได้', 'Unable to load competencies.'),
            });
        } finally {
            setLoading(false);
        }
    }, [language]);

    useEffect(() => {
        loadCompetencies();
    }, [loadCompetencies]);

    useEffect(() => {
        if (feedback.type !== 'success' || !feedback.message) return undefined;

        const timer = window.setTimeout(() => {
            setFeedback(current => (
                current.type === 'success' && current.message === feedback.message
                    ? { type: '', message: '' }
                    : current
            ));
        }, 5200);

        return () => window.clearTimeout(timer);
    }, [feedback.type, feedback.message]);

    const filteredCompetencies = useMemo(() => {
        const keyword = search.trim().toLowerCase();
        if (!keyword) return competencies;
        return competencies.filter(item => {
            return [
                item.code,
                item.nameTh,
                item.nameEn,
                item.description,
            ].some(value => String(value || '').toLowerCase().includes(keyword));
        });
    }, [competencies, search]);

    const openCreateModal = () => {
        setFeedback({ type: '', message: '' });
        setEditingCompetency(null);
        setForm(EMPTY_COMPETENCY_FORM);
        setModalMode('create');
    };

    const openEditModal = (competency) => {
        setFeedback({ type: '', message: '' });
        setEditingCompetency(competency);
        setForm({
            code: competency.code || '',
            nameTh: competency.nameTh || '',
            nameEn: competency.nameEn || '',
            description: competency.description || '',
        });
        setModalMode('edit');
    };

    const requestDelete = (competency) => {
        if (!competency?.canDelete) {
            setFeedback({
                type: 'error',
                message: officerText(
                    language,
                    'ไม่สามารถลบสมรรถนะนี้ได้ เพราะมีแบบแผนการประเมินใช้อยู่',
                    'This competency cannot be deleted because an assessment plan uses it.',
                ),
            });
            return;
        }
        setFeedback({ type: '', message: '' });
        setDeletingCompetency(competency);
    };

    const closeFormModal = () => {
        if (submitting) return;
        setModalMode('');
        setEditingCompetency(null);
        setForm(EMPTY_COMPETENCY_FORM);
    };

    const handleSubmit = async () => {
        if (submitting) return;
        setSubmitting(true);
        setFeedback({ type: '', message: '' });
        try {
            if (modalMode === 'edit' && editingCompetency) {
                await updateCompetency(editingCompetency.competencyId, form);
                setFeedback({
                    type: 'success',
                    message: officerText(language, 'บันทึกสมรรถนะแล้ว', 'Competency saved.'),
                });
            } else {
                await createCompetency(form);
                setFeedback({
                    type: 'success',
                    message: officerText(language, 'เพิ่มสมรรถนะแล้ว', 'Competency added.'),
                });
            }
            setModalMode('');
            setEditingCompetency(null);
            setForm(EMPTY_COMPETENCY_FORM);
            await loadCompetencies({ clearFeedback: false });
        } catch (err) {
            setFeedback({ type: 'error', message: mapCompetencyError(err, language) });
        } finally {
            setSubmitting(false);
        }
    };

    const handleConfirmDelete = async () => {
        if (!deletingCompetency || submitting) return;
        setSubmitting(true);
        setFeedback({ type: '', message: '' });
        try {
            await deleteCompetency(deletingCompetency.competencyId);
            setDeletingCompetency(null);
            setFeedback({
                type: 'success',
                message: officerText(language, 'ลบสมรรถนะแล้ว', 'Competency deleted.'),
            });
            await loadCompetencies({ clearFeedback: false });
        } catch (err) {
            setFeedback({ type: 'error', message: mapCompetencyError(err, language) });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="course-list-page officer-page ui-page competency-management">
            <div className="course-list-header officer-page__header ui-page__header">
                <div className="course-list-header__left">
                    <h1 className="course-list-header__title officer-page__title">
                        {officerText(language, 'จัดการสมรรถนะ', 'Competency management')}
                    </h1>
                    <p className="course-list-header__subtitle officer-page__subtitle">
                        {officerText(
                            language,
                            'เพิ่ม แก้ไข และลบสมรรถนะที่ใช้สำหรับแบบแผนการประเมิน',
                            'Create, edit, and delete competencies used by assessment plans.',
                        )}
                    </p>
                </div>
                <div className="course-list-header__actions officer-page__actions">
                    <button className="course-btn course-btn--ghost" onClick={loadCompetencies} disabled={loading || submitting}>
                        <RefreshCw size={16} className={loading ? 'competency-management__spin' : ''} />
                        {officerText(language, 'โหลดใหม่', 'Refresh')}
                    </button>
                    <button className="course-btn course-btn--primary" onClick={openCreateModal} disabled={submitting}>
                        <Plus size={16} />
                        {officerText(language, 'เพิ่มสมรรถนะ', 'Add competency')}
                    </button>
                </div>
            </div>

            <ToastNotifications
                success={feedback.type === 'success' ? feedback.message : ''}
                error={feedback.type === 'error' ? feedback.message : ''}
                onCloseSuccess={() => setFeedback(current => (
                    current.type === 'success' ? { type: '', message: '' } : current
                ))}
                onCloseError={() => setFeedback(current => (
                    current.type === 'error' ? { type: '', message: '' } : current
                ))}
            />

            <section className="competency-management__panel officer-panel ui-panel">
                <div className="competency-management__toolbar">
                    <label className="competency-management__search">
                        <Search size={16} />
                        <input
                            value={search}
                            onChange={event => setSearch(event.target.value)}
                            placeholder={officerText(language, 'ค้นหารหัสหรือชื่อสมรรถนะ', 'Search competency code or name')}
                        />
                    </label>
                    <span className="competency-management__count">
                        {filteredCompetencies.length}{' '}{officerText(language, 'รายการ', 'items')}
                    </span>
                </div>

                <div className="competency-management__table-wrap officer-table-wrap">
                    <table className="competency-management__table officer-table">
                        <thead>
                            <tr>
                                <th>{officerText(language, 'รหัส', 'Code')}</th>
                                <th>{officerText(language, 'ชื่อสมรรถนะ', 'Competency name')}</th>
                                <th>{officerText(language, 'คำอธิบาย', 'Description')}</th>
                                <th>{officerText(language, 'การใช้งาน', 'Usage')}</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="competency-management__empty">
                                        {officerText(language, 'กำลังโหลดข้อมูล...', 'Loading competencies...')}
                                    </td>
                                </tr>
                            ) : filteredCompetencies.length ? (
                                filteredCompetencies.map(competency => (
                                    <tr key={competency.competencyId}>
                                        <td>
                                            <span className="competency-management__code">{competency.code}</span>
                                        </td>
                                        <td>
                                            <div className="competency-management__name">
                                                <strong>{competency.nameTh}</strong>
                                                {competency.nameEn && <span>{competency.nameEn}</span>}
                                            </div>
                                        </td>
                                        <td className="competency-management__description">
                                            {competency.description || '-'}
                                        </td>
                                        <td>
                                            {competency.templateUsageCount > 0 ? (
                                                <span className="competency-management__badge">
                                                    <ShieldCheck size={13} />
                                                    {officerText(language, 'ใช้ในแบบแผนการประเมิน', 'Used by assessment plans')}{' '}
                                                    {competency.templateUsageCount} {officerText(language, 'รายการ', 'items')}
                                                </span>
                                            ) : (
                                                <span className="competency-management__badge">
                                                    <ShieldCheck size={13} />
                                                    {officerText(language, 'ยังไม่มีแบบแผนการประเมินใช้', 'Not used by an assessment plan')}
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            <div className="competency-management__row-actions">
                                                <button
                                                    type="button"
                                                    className="icon-course-btn icon-course-btn--edit"
                                                    onClick={() => openEditModal(competency)}
                                                    disabled={submitting}
                                                    title={officerText(language, 'แก้ไข', 'Edit')}
                                                >
                                                    <Edit3 size={15} />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="icon-course-btn icon-course-btn--danger"
                                                    onClick={() => requestDelete(competency)}
                                                    disabled={!competency.canDelete || submitting}
                                                    title={competency.canDelete
                                                        ? officerText(language, 'ลบ', 'Delete')
                                                        : officerText(language, 'มีแบบแผนการประเมินใช้อยู่', 'Used by an assessment plan')}
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="competency-management__empty">
                                        {officerText(language, 'ไม่พบสมรรถนะที่ค้นหา', 'No competencies match your search.')}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            {modalMode && (
                <CompetencyFormModal
                    mode={modalMode}
                    form={form}
                    setForm={setForm}
                    submitting={submitting}
                    onClose={closeFormModal}
                    onSubmit={handleSubmit}
                />
            )}

            {deletingCompetency && (
                <DeleteCompetencyModal
                    competency={deletingCompetency}
                    submitting={submitting}
                    onCancel={() => !submitting && setDeletingCompetency(null)}
                    onConfirm={handleConfirmDelete}
                />
            )}
        </div>
    );
}
