'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, Edit3, Eye, Lock, Megaphone, Plus, Power, RefreshCw, Save, Search, Trash2 } from 'lucide-react';
import ToastNotifications from '../../../components/ui/ToastNotifications';
import BaseModal from '../../../components/ui/BaseModal';
import ConfirmActionModal from '../../../components/ui/ConfirmActionModal';
import { useAuth } from '../../../providers/auth-provider';
import {
    createActivity,
    deleteActivity,
    fetchActivities,
    fetchActivityOptions,
    updateActivity,
    updateActivityStatus,
} from '../../../lib/activity';
import { fetchMajorFaculties } from '../../../lib/major';
import '../curriculum-management/CourseLayout.css';
import '../curriculum-management/CourseList.css';
import './ActivityManagement.css';

const EMPTY_ACTIVITY_FORM = {
    facultyId: '',
    code: '',
    nameTh: '',
    nameEn: '',
    description: '',
    category: '',
    type: '',
    registrationRequired: false,
};

const STATUS_OPTIONS = [
    { value: '', label: 'ทุกสถานะ' },
    { value: 'draft', label: 'Draft' },
    { value: 'published', label: 'Published' },
    { value: 'closed', label: 'Closed' },
    { value: 'cancelled', label: 'Cancelled' },
];

const STATUS_META = {
    draft: { label: 'Draft', className: 'draft' },
    published: { label: 'Published', className: 'published' },
    closed: { label: 'Closed', className: 'closed' },
    cancelled: { label: 'Cancelled', className: 'cancelled' },
};

const BACKEND_MESSAGE_TH = {
    'faculty_id is required': 'กรุณาเลือกคณะ',
    'code is required': 'กรุณากรอกรหัสกิจกรรม',
    'name_th is required': 'กรุณากรอกชื่อกิจกรรมภาษาไทย',
    'activity code and Thai name already exist in this faculty': 'มีกิจกรรมรหัสและชื่อภาษาไทยนี้ที่ยัง Draft หรือ Published อยู่แล้ว',
    'activity already exists': 'มีกิจกรรมนี้อยู่แล้ว',
    'activity not found': 'ไม่พบกิจกรรม',
    'insufficient activity scope': 'คุณไม่มีสิทธิ์จัดการกิจกรรมนี้',
    'published activity identity cannot be changed': 'กิจกรรมที่ Published แล้วไม่สามารถแก้รหัส ชื่อ หรือคณะได้',
    'closed or cancelled activity cannot be edited': 'กิจกรรมที่ Closed หรือ Cancelled แล้วไม่สามารถแก้ไขได้',
    'invalid activity status transition': 'ไม่สามารถเปลี่ยนสถานะกิจกรรมตามลำดับนี้ได้',
    'only draft activity can be deleted': 'ลบได้เฉพาะกิจกรรม Draft เท่านั้น',
    'activity cannot be deleted while sessions are connected': 'ไม่สามารถลบกิจกรรมนี้ได้ เพราะมีรอบกิจกรรมเชื่อมอยู่',
    'activity operation failed': 'ไม่สามารถดำเนินการกับกิจกรรมได้',
};

function mapActivityError(error) {
    const message = error?.message || error?.payload?.error?.message || '';
    return BACKEND_MESSAGE_TH[message] || message || 'ไม่สามารถดำเนินการกับกิจกรรมได้';
}

function formatDateTime(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('th-TH', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
}

function activityStatusMeta(status) {
    return STATUS_META[status] || { label: status || '-', className: 'default' };
}

function ActivityFormModal({
    mode,
    form,
    setForm,
    faculties,
    isAdmin,
    submitting,
    editingActivity,
    options,
    onClose,
    onSubmit,
}) {
    const isPublished = editingActivity?.status === 'published';
    const isReadOnly = editingActivity && !['draft', 'published'].includes(editingActivity.status);
    const identityLocked = isPublished || isReadOnly;
    const facultyLocked = !isAdmin || faculties.length <= 1 || identityLocked;
    const canSubmit = String(form.code || '').trim()
        && String(form.nameTh || '').trim()
        && String(form.facultyId || '').trim()
        && !isReadOnly;

    return (
        <BaseModal
            open
            title={mode === 'edit' ? 'แก้ไขกิจกรรม' : 'เพิ่มกิจกรรมใหม่'}
            size="md"
            onClose={onClose}
            closeDisabled={submitting}
            footer={(
                <>
                    <button className="course-btn course-btn--ghost" onClick={onClose} disabled={submitting}>
                        ยกเลิก
                    </button>
                    <button className="course-btn course-btn--primary" onClick={onSubmit} disabled={submitting || !canSubmit}>
                        <Save size={16} />
                        {submitting ? 'กำลังบันทึก...' : 'บันทึก'}
                    </button>
                </>
            )}
        >
                    <div className="activity-management__session-note">
                        <CalendarClock size={16} />
                        อาจารย์หรือวิทยากรจะกำหนดในรอบกิจกรรม (Session) ไม่ได้กำหนดในข้อมูลกิจกรรมหลัก
                    </div>

                    <div className="course-row">
                        <label className="course-field">
                            <span className="course-label">คณะ<span className="course-required">*</span></span>
                            <select
                                className="course-input activity-input--disabled-aware"
                                value={form.facultyId}
                                onChange={event => setForm(prev => ({ ...prev, facultyId: event.target.value }))}
                                disabled={facultyLocked}
                            >
                                <option value="">เลือกคณะ</option>
                                {faculties.map(faculty => (
                                    <option key={faculty.facultyId} value={faculty.facultyId}>
                                        {faculty.nameTh}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="course-field">
                            <span className="course-label">รหัสกิจกรรม<span className="course-required">*</span></span>
                            <input
                                className="course-input"
                                value={form.code}
                                onChange={event => setForm(prev => ({ ...prev, code: event.target.value }))}
                                placeholder="เช่น TST-AI-WS"
                                disabled={identityLocked}
                            />
                        </label>
                    </div>

                    <label className="course-field">
                        <span className="course-label">ชื่อกิจกรรม (ภาษาไทย)<span className="course-required">*</span></span>
                        <input
                            className="course-input"
                            value={form.nameTh}
                            onChange={event => setForm(prev => ({ ...prev, nameTh: event.target.value }))}
                            placeholder="เช่น อบรมเชิงปฏิบัติการ AI"
                            disabled={identityLocked}
                        />
                    </label>

                    <label className="course-field">
                        <span className="course-label">ชื่อกิจกรรม (ภาษาอังกฤษ)</span>
                        <input
                            className="course-input"
                            value={form.nameEn}
                            onChange={event => setForm(prev => ({ ...prev, nameEn: event.target.value }))}
                            placeholder="เช่น AI Workshop"
                            disabled={identityLocked}
                        />
                    </label>

                    <div className="course-row">
                        <label className="course-field">
                            <span className="course-label">หมวดกิจกรรม</span>
                            <input
                                className="course-input"
                                list="activity-category-options"
                                value={form.category}
                                onChange={event => setForm(prev => ({ ...prev, category: event.target.value }))}
                                placeholder="เช่น academic"
                                disabled={isReadOnly}
                            />
                        </label>

                        <label className="course-field">
                            <span className="course-label">ประเภทกิจกรรม</span>
                            <input
                                className="course-input"
                                list="activity-type-options"
                                value={form.type}
                                onChange={event => setForm(prev => ({ ...prev, type: event.target.value }))}
                                placeholder="เช่น workshop"
                                disabled={isReadOnly}
                            />
                        </label>
                    </div>

                    <datalist id="activity-category-options">
                        {options.categories.map(value => <option key={value} value={value} />)}
                    </datalist>
                    <datalist id="activity-type-options">
                        {options.types.map(value => <option key={value} value={value} />)}
                    </datalist>

                    <label className="course-field">
                        <span className="course-label">คำอธิบาย</span>
                        <textarea
                            className="course-input activity-management__textarea"
                            value={form.description}
                            onChange={event => setForm(prev => ({ ...prev, description: event.target.value }))}
                            placeholder="รายละเอียดกิจกรรม"
                            rows={4}
                            disabled={isReadOnly}
                        />
                    </label>

                    <label className="activity-management__checkbox">
                        <input
                            type="checkbox"
                            checked={form.registrationRequired}
                            onChange={event => setForm(prev => ({ ...prev, registrationRequired: event.target.checked }))}
                            disabled={isReadOnly}
                        />
                        <span>ต้องลงทะเบียนก่อนเข้าร่วมกิจกรรม</span>
                    </label>
        </BaseModal>
    );
}

function DeleteActivityModal({ activity, submitting, onCancel, onConfirm }) {
    return (
        <ConfirmActionModal
            open={Boolean(activity)}
            title="ลบกิจกรรม"
            message={<>ยืนยันการลบกิจกรรม <strong>{activity?.nameTh || activity?.code}</strong> หรือไม่?</>}
            hint="ระบบจะลบแบบ Soft delete เฉพาะกิจกรรม Draft ที่ยังไม่มีรอบกิจกรรมเท่านั้น"
            confirmLabel={submitting ? 'กำลังลบ...' : 'ลบกิจกรรม'}
            variant="danger"
            loading={submitting}
            onCancel={onCancel}
            onConfirm={onConfirm}
        />
    );
}

export default function ActivityManagementPage() {
    const { user } = useAuth();
    const isAdmin = user?.roles?.includes('admin');
    const [activities, setActivities] = useState([]);
    const [faculties, setFaculties] = useState([]);
    const [options, setOptions] = useState({ categories: [], types: [] });
    const [filters, setFilters] = useState({
        facultyId: '',
        status: '',
        category: '',
        type: '',
        search: '',
    });
    const [loading, setLoading] = useState(true);
    const [lookupsLoading, setLookupsLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [feedback, setFeedback] = useState({ type: '', message: '' });
    const [modalMode, setModalMode] = useState('');
    const [editingActivity, setEditingActivity] = useState(null);
    const [deletingActivity, setDeletingActivity] = useState(null);
    const [form, setForm] = useState(EMPTY_ACTIVITY_FORM);

    useEffect(() => {
        let mounted = true;

        async function loadFaculties() {
            setLookupsLoading(true);
            try {
                const nextFaculties = await fetchMajorFaculties();
                if (!mounted) return;
                setFaculties(nextFaculties);
                if (nextFaculties.length === 1) {
                    setFilters(prev => ({ ...prev, facultyId: String(nextFaculties[0].facultyId) }));
                }
            } catch (err) {
                if (mounted) {
                    setFeedback({ type: 'error', message: err?.message || 'ไม่สามารถโหลดข้อมูลคณะได้' });
                }
            } finally {
                if (mounted) setLookupsLoading(false);
            }
        }

        loadFaculties();
        return () => {
            mounted = false;
        };
    }, []);

    const loadOptions = useCallback(async () => {
        try {
            const nextOptions = await fetchActivityOptions({ facultyId: filters.facultyId });
            setOptions(nextOptions);
        } catch (err) {
            setFeedback({ type: 'error', message: mapActivityError(err) || 'ไม่สามารถโหลดตัวเลือกกิจกรรมได้' });
        }
    }, [filters.facultyId]);

    const loadActivities = useCallback(async ({ clearFeedback = false } = {}) => {
        setLoading(true);
        if (clearFeedback) {
            setFeedback({ type: '', message: '' });
        }
        try {
            const nextActivities = await fetchActivities(filters);
            setActivities(nextActivities);
        } catch (err) {
            setFeedback({ type: 'error', message: mapActivityError(err) || 'ไม่สามารถโหลดข้อมูลกิจกรรมได้' });
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        loadActivities();
    }, [loadActivities]);

    useEffect(() => {
        loadOptions();
    }, [loadOptions]);

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

    const selectedFacultyId = filters.facultyId || (faculties.length === 1 ? String(faculties[0].facultyId) : '');

    const openCreateModal = () => {
        setEditingActivity(null);
        setForm({
            ...EMPTY_ACTIVITY_FORM,
            facultyId: selectedFacultyId,
        });
        setModalMode('create');
        setFeedback({ type: '', message: '' });
    };

    const openEditModal = (activity) => {
        setEditingActivity(activity);
        setForm({
            facultyId: String(activity.facultyId || ''),
            code: activity.code || '',
            nameTh: activity.nameTh || '',
            nameEn: activity.nameEn || '',
            description: activity.description || '',
            category: activity.category || '',
            type: activity.type || '',
            registrationRequired: Boolean(activity.registrationRequired),
        });
        setModalMode('edit');
        setFeedback({ type: '', message: '' });
    };

    const closeModal = () => {
        if (submitting) return;
        setModalMode('');
        setEditingActivity(null);
        setForm(EMPTY_ACTIVITY_FORM);
    };

    const handleSubmit = async () => {
        if (submitting) return;
        setSubmitting(true);
        setFeedback({ type: '', message: '' });
        try {
            if (modalMode === 'edit' && editingActivity) {
                await updateActivity(editingActivity.activityId, form);
                setFeedback({ type: 'success', message: 'บันทึกกิจกรรมแล้ว' });
            } else {
                await createActivity(form);
                setFeedback({ type: 'success', message: 'เพิ่มกิจกรรมแล้ว' });
            }
            setModalMode('');
            setEditingActivity(null);
            setForm(EMPTY_ACTIVITY_FORM);
            await loadActivities({ clearFeedback: false });
            await loadOptions();
        } catch (err) {
            setFeedback({ type: 'error', message: mapActivityError(err) });
        } finally {
            setSubmitting(false);
        }
    };

    const handleStatusChange = async (activity, status) => {
        if (submitting) return;
        setSubmitting(true);
        setFeedback({ type: '', message: '' });
        try {
            await updateActivityStatus(activity.activityId, status);
            setFeedback({
                type: 'success',
                message: status === 'published' ? 'เผยแพร่กิจกรรมแล้ว' : 'ปิดกิจกรรมแล้ว',
            });
            await loadActivities({ clearFeedback: false });
        } catch (err) {
            setFeedback({ type: 'error', message: mapActivityError(err) });
        } finally {
            setSubmitting(false);
        }
    };

    const handleConfirmDelete = async () => {
        if (!deletingActivity || submitting) return;
        setSubmitting(true);
        setFeedback({ type: '', message: '' });
        try {
            await deleteActivity(deletingActivity.activityId);
            setDeletingActivity(null);
            setFeedback({ type: 'success', message: 'ลบกิจกรรมแล้ว' });
            await loadActivities({ clearFeedback: false });
            await loadOptions();
        } catch (err) {
            setFeedback({ type: 'error', message: mapActivityError(err) });
        } finally {
            setSubmitting(false);
        }
    };

    const handleFacultyFilterChange = (facultyId) => {
        setFilters(prev => ({
            ...prev,
            facultyId,
            category: '',
            type: '',
        }));
    };

    const facultyLocked = !isAdmin || faculties.length <= 1;

    return (
        <div className="activity-management-page">
            <div className="course-list-header">
                <div className="course-list-header__left">
                    <h1 className="course-list-header__title">จัดการกิจกรรม</h1>
                    <p className="course-list-header__subtitle">
                        เพิ่ม แก้ไข เผยแพร่ และปิดกิจกรรมสำหรับสะสมสมรรถนะนักศึกษา
                    </p>
                </div>
                <div className="course-list-header__actions">
                    <button className="course-btn course-btn--ghost" onClick={() => loadActivities({ clearFeedback: true })} disabled={loading || submitting}>
                        <RefreshCw size={16} className={loading ? 'activity-management__spin' : ''} />
                        โหลดใหม่
                    </button>
                    <button className="course-btn course-btn--primary" onClick={openCreateModal} disabled={submitting || lookupsLoading}>
                        <Plus size={16} />
                        เพิ่มกิจกรรม
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

            <section className="activity-filter-panel">
                <label className="course-field">
                    <span className="course-label">คณะ</span>
                    <select
                        className="course-input activity-input--disabled-aware"
                        value={filters.facultyId}
                        onChange={event => handleFacultyFilterChange(event.target.value)}
                        disabled={lookupsLoading || facultyLocked}
                    >
                        <option value="">{isAdmin ? 'ทุกคณะ' : 'คณะของคุณ'}</option>
                        {faculties.map(faculty => (
                            <option key={faculty.facultyId} value={faculty.facultyId}>
                                {faculty.nameTh}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="course-field">
                    <span className="course-label">สถานะ</span>
                    <select
                        className="course-input"
                        value={filters.status}
                        onChange={event => setFilters(prev => ({ ...prev, status: event.target.value }))}
                    >
                        {STATUS_OPTIONS.map(option => (
                            <option key={option.value || 'all'} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="course-field">
                    <span className="course-label">หมวด</span>
                    <input
                        className="course-input"
                        list="activity-filter-category-options"
                        value={filters.category}
                        onChange={event => setFilters(prev => ({ ...prev, category: event.target.value }))}
                        placeholder="ทุกหมวด"
                    />
                </label>

                <label className="course-field">
                    <span className="course-label">ประเภท</span>
                    <input
                        className="course-input"
                        list="activity-filter-type-options"
                        value={filters.type}
                        onChange={event => setFilters(prev => ({ ...prev, type: event.target.value }))}
                        placeholder="ทุกประเภท"
                    />
                </label>

                <label className="course-field activity-filter-panel__search-field">
                    <span className="course-label">ค้นหา</span>
                    <div className="activity-search">
                        <Search size={16} />
                        <input
                            value={filters.search}
                            onChange={event => setFilters(prev => ({ ...prev, search: event.target.value }))}
                            placeholder="ค้นหารหัสหรือชื่อกิจกรรม"
                        />
                    </div>
                </label>
            </section>

            <datalist id="activity-filter-category-options">
                {options.categories.map(value => <option key={value} value={value} />)}
            </datalist>
            <datalist id="activity-filter-type-options">
                {options.types.map(value => <option key={value} value={value} />)}
            </datalist>

            <section className="activity-management__panel">
                <div className="activity-management__panel-header">
                    <div>
                        <span className="activity-management__panel-kicker">Activity parent</span>
                        <strong>{activities.length} รายการ</strong>
                    </div>
                    <span className="activity-management__panel-note">
                        ผู้ประเมินจะกำหนดใน Session
                    </span>
                </div>

                <div className="activity-table-wrap">
                    <table className="activity-table">
                        <thead>
                            <tr>
                                <th>กิจกรรม</th>
                                <th>หมวด/ประเภท</th>
                                <th>รอบกิจกรรม</th>
                                <th>สถานะ</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="activity-management__empty">กำลังโหลดข้อมูลกิจกรรม...</td>
                                </tr>
                            ) : activities.length ? (
                                activities.map(activity => {
                                    const statusMeta = activityStatusMeta(activity.status);
                                    return (
                                        <tr key={activity.activityId}>
                                            <td>
                                                <div className="activity-name-cell">
                                                    <span className="activity-code">{activity.code}</span>
                                                    <strong>{activity.nameTh}</strong>
                                                    {activity.nameEn && <span>{activity.nameEn}</span>}
                                                    {isAdmin && <span>{activity.facultyNameTh}</span>}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="activity-meta-cell">
                                                    <span>{activity.category || '-'}</span>
                                                    <span>{activity.type || '-'}</span>
                                                    {activity.registrationRequired && <span>ต้องลงทะเบียน</span>}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="activity-session-cell">
                                                    <span><CalendarClock size={14} /> {activity.sessionCount} รอบ</span>
                                                    <span>รอบถัดไป: {formatDateTime(activity.nextSessionAt)}</span>
                                                    <span>ล่าสุด: {formatDateTime(activity.latestSessionAt)}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`activity-status activity-status--${statusMeta.className}`}>
                                                    {statusMeta.label}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="activity-row-actions">
                                                    <Link
                                                        className="course-icon-btn"
                                                        href={`/activity-management/${activity.activityId}/sessions`}
                                                        title="จัดการรอบกิจกรรม"
                                                    >
                                                        <CalendarClock size={16} />
                                                    </Link>
                                                    <button
                                                        className="course-icon-btn"
                                                        onClick={() => openEditModal(activity)}
                                                        disabled={!activity.canEdit || submitting}
                                                        title={activity.canEdit ? 'แก้ไขกิจกรรม' : 'กิจกรรมนี้แก้ไขไม่ได้'}
                                                    >
                                                        {activity.canEdit ? <Edit3 size={16} /> : <Eye size={16} />}
                                                    </button>
                                                    <button
                                                        className="course-icon-btn"
                                                        onClick={() => handleStatusChange(activity, 'published')}
                                                        disabled={!activity.canPublish || submitting}
                                                        title="เผยแพร่กิจกรรม"
                                                    >
                                                        <Megaphone size={16} />
                                                    </button>
                                                    <button
                                                        className="course-icon-btn"
                                                        onClick={() => handleStatusChange(activity, 'closed')}
                                                        disabled={!activity.canClose || submitting}
                                                        title="ปิดกิจกรรม"
                                                    >
                                                        <Power size={16} />
                                                    </button>
                                                    <button
                                                        className="course-icon-btn course-icon-btn--danger"
                                                        onClick={() => setDeletingActivity(activity)}
                                                        disabled={!activity.canDelete || submitting}
                                                        title={activity.canDelete ? 'ลบกิจกรรม' : 'ลบได้เฉพาะ Draft ที่ยังไม่มีรอบกิจกรรม'}
                                                    >
                                                        {activity.canDelete ? <Trash2 size={16} /> : <Lock size={16} />}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={5} className="activity-management__empty">ไม่พบกิจกรรมตามเงื่อนไขที่เลือก</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            {modalMode && (
                <ActivityFormModal
                    mode={modalMode}
                    form={form}
                    setForm={setForm}
                    faculties={faculties}
                    isAdmin={isAdmin}
                    submitting={submitting}
                    editingActivity={editingActivity}
                    options={options}
                    onClose={closeModal}
                    onSubmit={handleSubmit}
                />
            )}

            {deletingActivity && (
                <DeleteActivityModal
                    activity={deletingActivity}
                    submitting={submitting}
                    onCancel={() => !submitting && setDeletingActivity(null)}
                    onConfirm={handleConfirmDelete}
                />
            )}
        </div>
    );
}
