'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Edit3, Lock, Plus, RefreshCw, Save, Search, ShieldCheck, Trash2, X } from 'lucide-react';
import {
    createCompetency,
    deleteCompetency,
    fetchCompetenciesForManagement,
    updateCompetency,
} from '../../../lib/competency-management';
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

function mapCompetencyError(error) {
    const englishMessage = error?.message || error?.payload?.error?.message || '';
    if (error?.code === 'COMPETENCY_IN_USE') {
        return 'ไม่สามารถแก้ไขหรือลบสมรรถนะนี้ได้ เพราะมี Template ใช้อยู่';
    }
    if (error?.code === 'DUPLICATE') {
        return BACKEND_MESSAGE_TH[englishMessage] || 'รหัสสมรรถนะนี้มีอยู่แล้ว';
    }
    return BACKEND_MESSAGE_TH[englishMessage] || englishMessage || 'ไม่สามารถดำเนินการกับสมรรถนะได้';
}

function CompetencyFormModal({ mode, form, setForm, submitting, onClose, onSubmit }) {
    const canSubmit = String(form.code || '').trim() && String(form.nameTh || '').trim();

    return (
        <div className="course-modal-overlay" onClick={onClose}>
            <div className="course-modal-box course-modal-box--md" onClick={event => event.stopPropagation()}>
                <div className="course-modal-header">
                    <h3>{mode === 'edit' ? 'แก้ไขสมรรถนะ' : 'เพิ่มสมรรถนะใหม่'}</h3>
                    <button className="course-modal-close" onClick={onClose} aria-label="ปิด">
                        <X size={18} />
                    </button>
                </div>

                <div className="course-modal-body">
                    <div className="course-row">
                        <label className="course-field">
                            <span className="course-label">รหัสสมรรถนะ<span className="course-required">*</span></span>
                            <input
                                className="course-input"
                                value={form.code}
                                onChange={event => setForm(prev => ({ ...prev, code: event.target.value }))}
                                placeholder="เช่น comm"
                            />
                        </label>

                        <label className="course-field">
                            <span className="course-label">ชื่อสมรรถนะ (ภาษาไทย)<span className="course-required">*</span></span>
                            <input
                                className="course-input"
                                value={form.nameTh}
                                onChange={event => setForm(prev => ({ ...prev, nameTh: event.target.value }))}
                                placeholder="เช่น การสื่อสาร"
                            />
                        </label>
                    </div>

                    <label className="course-field">
                        <span className="course-label">ชื่อสมรรถนะ (ภาษาอังกฤษ)</span>
                        <input
                            className="course-input"
                            value={form.nameEn}
                            onChange={event => setForm(prev => ({ ...prev, nameEn: event.target.value }))}
                            placeholder="เช่น Communication"
                        />
                    </label>

                    <label className="course-field">
                        <span className="course-label">คำอธิบาย</span>
                        <textarea
                            className="course-input competency-management__textarea"
                            value={form.description}
                            onChange={event => setForm(prev => ({ ...prev, description: event.target.value }))}
                            placeholder="รายละเอียดเพิ่มเติมของสมรรถนะ"
                            rows={4}
                        />
                    </label>
                </div>

                <div className="course-modal-footer">
                    <button className="course-btn course-btn--ghost" onClick={onClose} disabled={submitting}>
                        ยกเลิก
                    </button>
                    <button className="course-btn course-btn--primary" onClick={onSubmit} disabled={submitting || !canSubmit}>
                        <Save size={16} />
                        {submitting ? 'กำลังบันทึก...' : 'บันทึก'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function DeleteCompetencyModal({ competency, submitting, onCancel, onConfirm }) {
    return (
        <div className="course-modal-overlay" onClick={onCancel}>
            <div className="course-modal-box course-modal-box--sm" onClick={event => event.stopPropagation()}>
                <div className="course-modal-header">
                    <h3>ลบสมรรถนะ</h3>
                    <button className="course-modal-close" onClick={onCancel} aria-label="ปิด">
                        <X size={18} />
                    </button>
                </div>
                <div className="course-modal-body">
                    <p className="competency-management__confirm-text">
                        ยืนยันการลบสมรรถนะ <strong>{competency?.nameTh || competency?.code}</strong> หรือไม่?
                    </p>
                    <p className="competency-management__hint">
                        ระบบจะลบแบบ Soft delete และซ่อนออกจากรายการใช้งานปกติ
                    </p>
                </div>
                <div className="course-modal-footer">
                    <button className="course-btn course-btn--ghost" onClick={onCancel} disabled={submitting}>
                        ยกเลิก
                    </button>
                    <button className="course-btn course-btn--danger" onClick={onConfirm} disabled={submitting}>
                        <Trash2 size={16} />
                        {submitting ? 'กำลังลบ...' : 'ลบสมรรถนะ'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function CompetencyManagementPage() {
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
            setFeedback({ type: 'error', message: mapCompetencyError(err) || 'ไม่สามารถโหลดข้อมูลสมรรถนะได้' });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadCompetencies();
    }, [loadCompetencies]);

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
        if (!competency?.canEdit) {
            setFeedback({ type: 'error', message: 'ไม่สามารถแก้ไขสมรรถนะนี้ได้ เพราะมี Template ใช้อยู่' });
            return;
        }
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
            setFeedback({ type: 'error', message: 'ไม่สามารถลบสมรรถนะนี้ได้ เพราะมี Template ใช้อยู่' });
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
                setFeedback({ type: 'success', message: 'บันทึกสมรรถนะแล้ว' });
            } else {
                await createCompetency(form);
                setFeedback({ type: 'success', message: 'เพิ่มสมรรถนะแล้ว' });
            }
            setModalMode('');
            setEditingCompetency(null);
            setForm(EMPTY_COMPETENCY_FORM);
            await loadCompetencies({ clearFeedback: false });
        } catch (err) {
            setFeedback({ type: 'error', message: mapCompetencyError(err) });
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
            setFeedback({ type: 'success', message: 'ลบสมรรถนะแล้ว' });
            await loadCompetencies({ clearFeedback: false });
        } catch (err) {
            setFeedback({ type: 'error', message: mapCompetencyError(err) });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="course-list-page competency-management">
            <div className="course-list-header">
                <div className="course-list-header__left">
                    <h1 className="course-list-header__title">จัดการสมรรถนะ</h1>
                    <p className="course-list-header__subtitle">เพิ่ม แก้ไข และลบสมรรถนะที่ใช้สำหรับ Template</p>
                </div>
                <div className="course-list-header__actions">
                    <button className="course-btn course-btn--ghost" onClick={loadCompetencies} disabled={loading || submitting}>
                        <RefreshCw size={16} className={loading ? 'competency-management__spin' : ''} />
                        โหลดใหม่
                    </button>
                    <button className="course-btn course-btn--primary" onClick={openCreateModal} disabled={submitting}>
                        <Plus size={16} />
                        เพิ่มสมรรถนะ
                    </button>
                </div>
            </div>

            {feedback.message && (
                <div className={`course-feedback course-feedback--${feedback.type}`}>
                    {feedback.message}
                </div>
            )}

            <section className="competency-management__panel">
                <div className="competency-management__toolbar">
                    <label className="competency-management__search">
                        <Search size={16} />
                        <input
                            value={search}
                            onChange={event => setSearch(event.target.value)}
                            placeholder="ค้นหารหัสหรือชื่อสมรรถนะ"
                        />
                    </label>
                    <span className="competency-management__count">
                        {filteredCompetencies.length} รายการ
                    </span>
                </div>

                <div className="competency-management__table-wrap">
                    <table className="competency-management__table">
                        <thead>
                            <tr>
                                <th>รหัส</th>
                                <th>ชื่อสมรรถนะ</th>
                                <th>คำอธิบาย</th>
                                <th>การใช้งาน</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="competency-management__empty">กำลังโหลดข้อมูล...</td>
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
                                                <span className="competency-management__badge competency-management__badge--locked">
                                                    <Lock size={13} />
                                                    ใช้ใน Template {competency.templateUsageCount} รายการ
                                                </span>
                                            ) : (
                                                <span className="competency-management__badge">
                                                    <ShieldCheck size={13} />
                                                    ยังไม่มี Template ใช้
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            <div className="competency-management__row-actions">
                                                <button
                                                    type="button"
                                                    className="icon-course-btn icon-course-btn--edit"
                                                    onClick={() => openEditModal(competency)}
                                                    disabled={!competency.canEdit || submitting}
                                                    title={competency.canEdit ? 'แก้ไข' : 'มี Template ใช้อยู่'}
                                                >
                                                    <Edit3 size={15} />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="icon-course-btn icon-course-btn--danger"
                                                    onClick={() => requestDelete(competency)}
                                                    disabled={!competency.canDelete || submitting}
                                                    title={competency.canDelete ? 'ลบ' : 'มี Template ใช้อยู่'}
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="competency-management__empty">ไม่พบสมรรถนะที่ค้นหา</td>
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
