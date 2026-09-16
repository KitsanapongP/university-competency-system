'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, Edit3, Eye, Lock, Megaphone, Plus, Power, RefreshCw, Save, Search, Trash2 } from 'lucide-react';
import ToastNotifications from '../../../components/ui/ToastNotifications';
import BaseModal from '../../../components/ui/BaseModal';
import ConfirmActionModal from '../../../components/ui/ConfirmActionModal';
import { useAuth } from '../../../providers/auth-provider';
import { useLanguage } from '../../../providers/LanguageContext';
import { officerActivityStatusLabel, officerText } from '../officer-labels';
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
    { value: '' },
    { value: 'draft' },
    { value: 'published' },
    { value: 'closed' },
    { value: 'cancelled' },
];

const STATUS_META = {
    draft: { className: 'draft' },
    published: { className: 'published' },
    closed: { className: 'closed' },
    cancelled: { className: 'cancelled' },
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

const BACKEND_MESSAGE_EN = {
    'faculty_id is required': 'Please select a faculty.',
    'code is required': 'Please enter an activity code.',
    'name_th is required': 'Please enter the Thai activity name.',
    'activity code and Thai name already exist in this faculty': 'An activity with this code and Thai name is already in draft or published status.',
    'activity already exists': 'This activity already exists.',
    'activity not found': 'Activity not found.',
    'insufficient activity scope': 'You do not have permission to manage this activity.',
    'published activity identity cannot be changed': 'A published activity cannot change its code, name, or faculty.',
    'closed or cancelled activity cannot be edited': 'A closed or cancelled activity cannot be edited.',
    'invalid activity status transition': 'This activity status change is not allowed.',
    'only draft activity can be deleted': 'Only draft activities can be deleted.',
    'activity cannot be deleted while sessions are connected': 'This activity cannot be deleted because sessions are connected.',
    'activity operation failed': 'Unable to complete the activity operation.',
};

function mapActivityError(error, language) {
    const message = error?.message || error?.payload?.error?.message || '';
    return officerText(
        language,
        BACKEND_MESSAGE_TH[message] || message || 'ไม่สามารถดำเนินการกับกิจกรรมได้',
        BACKEND_MESSAGE_EN[message] || message || 'Unable to complete the activity operation.',
    );
}

function formatDateTime(value, language) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'th-TH', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
}

function activityStatusMeta(status, language) {
    return {
        label: officerActivityStatusLabel(language, status),
        ...(STATUS_META[status] || { className: 'default' }),
    };
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
    const { language } = useLanguage();
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
            title={mode === 'edit'
                ? officerText(language, 'แก้ไขกิจกรรม', 'Edit activity')
                : officerText(language, 'เพิ่มกิจกรรมใหม่', 'Add activity')}
            size="md"
            onClose={onClose}
            closeDisabled={submitting}
            footer={(
                <>
                    <button className="course-btn course-btn--ghost" onClick={onClose} disabled={submitting}>
                        {officerText(language, 'ยกเลิก', 'Cancel')}
                    </button>
                    <button
                        className="course-btn course-btn--primary"
                        onClick={onSubmit}
                        disabled={submitting || !canSubmit}
                    >
                        <Save size={16} />
                        {submitting
                            ? officerText(language, 'กำลังบันทึก...', 'Saving...')
                            : officerText(language, 'บันทึก', 'Save')}
                    </button>
                </>
            )}
        >
            <div className="activity-management__session-note">
                <CalendarClock size={16} />
                {officerText(
                    language,
                    'อาจารย์หรือวิทยากรจะกำหนดในรอบกิจกรรม ไม่ได้กำหนดในข้อมูลกิจกรรมหลัก',
                    'Lecturers and speakers are assigned to each activity session, not to the parent activity.',
                )}
            </div>

            <div className="course-row">
                <label className="course-field">
                    <span className="course-label">
                        {officerText(language, 'คณะ', 'Faculty')}
                        <span className="course-required">*</span>
                    </span>
                    <select
                        className="course-input activity-input--disabled-aware"
                        value={form.facultyId}
                        onChange={event => setForm(prev => ({ ...prev, facultyId: event.target.value }))}
                        disabled={facultyLocked}
                    >
                        <option value="">{officerText(language, 'เลือกคณะ', 'Select faculty')}</option>
                        {faculties.map(faculty => (
                            <option key={faculty.facultyId} value={faculty.facultyId}>
                                {language === 'en' ? faculty.nameEn || faculty.nameTh : faculty.nameTh}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="course-field">
                    <span className="course-label">
                        {officerText(language, 'รหัสกิจกรรม', 'Activity code')}
                        <span className="course-required">*</span>
                    </span>
                    <input
                        className="course-input"
                        value={form.code}
                        onChange={event => setForm(prev => ({ ...prev, code: event.target.value }))}
                        placeholder={officerText(language, 'เช่น TST-AI-WS', 'e.g. TST-AI-WS')}
                        disabled={identityLocked}
                    />
                </label>
            </div>

            <label className="course-field">
                <span className="course-label">
                    {officerText(language, 'ชื่อกิจกรรม (ภาษาไทย)', 'Activity name (Thai)')}
                    <span className="course-required">*</span>
                </span>
                <input
                    className="course-input"
                    value={form.nameTh}
                    onChange={event => setForm(prev => ({ ...prev, nameTh: event.target.value }))}
                    placeholder={officerText(language, 'เช่น อบรมเชิงปฏิบัติการ AI', 'e.g. AI workshop')}
                    disabled={identityLocked}
                />
            </label>

            <label className="course-field">
                <span className="course-label">
                    {officerText(language, 'ชื่อกิจกรรม (ภาษาอังกฤษ)', 'Activity name (English)')}
                </span>
                <input
                    className="course-input"
                    value={form.nameEn}
                    onChange={event => setForm(prev => ({ ...prev, nameEn: event.target.value }))}
                    placeholder={officerText(language, 'เช่น AI Workshop', 'e.g. AI Workshop')}
                    disabled={identityLocked}
                />
            </label>

            <div className="course-row">
                <label className="course-field">
                    <span className="course-label">
                        {officerText(language, 'หมวดกิจกรรม', 'Activity category')}
                    </span>
                    <input
                        className="course-input"
                        list="activity-category-options"
                        value={form.category}
                        onChange={event => setForm(prev => ({ ...prev, category: event.target.value }))}
                        placeholder={officerText(language, 'เช่น academic', 'e.g. academic')}
                        disabled={isReadOnly}
                    />
                </label>

                <label className="course-field">
                    <span className="course-label">
                        {officerText(language, 'ประเภทกิจกรรม', 'Activity type')}
                    </span>
                    <input
                        className="course-input"
                        list="activity-type-options"
                        value={form.type}
                        onChange={event => setForm(prev => ({ ...prev, type: event.target.value }))}
                        placeholder={officerText(language, 'เช่น workshop', 'e.g. workshop')}
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
                <span className="course-label">
                    {officerText(language, 'คำอธิบาย', 'Description')}
                </span>
                <textarea
                    className="course-input activity-management__textarea"
                    value={form.description}
                    onChange={event => setForm(prev => ({ ...prev, description: event.target.value }))}
                    placeholder={officerText(language, 'รายละเอียดกิจกรรม', 'Activity details')}
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
                <span>
                    {officerText(language, 'ต้องลงทะเบียนก่อนเข้าร่วมกิจกรรม', 'Registration is required before joining')}
                </span>
            </label>
        </BaseModal>
    );
}

function DeleteActivityModal({ activity, submitting, onCancel, onConfirm }) {
    const { language } = useLanguage();

    return (
        <ConfirmActionModal
            open={Boolean(activity)}
            title={officerText(language, 'ลบกิจกรรม', 'Delete activity')}
            message={(
                <>
                    {officerText(language, 'ยืนยันการลบกิจกรรม ', 'Delete activity ')}
                    <strong>{activity?.nameTh || activity?.code}</strong>
                    {officerText(language, ' หรือไม่?', '?')}
                </>
            )}
            hint={officerText(
                language,
                'ระบบจะลบแบบ Soft delete เฉพาะกิจกรรมฉบับร่างที่ยังไม่มีรอบกิจกรรมเท่านั้น',
                'Only draft activities without sessions can be soft-deleted.',
            )}
            confirmLabel={submitting
                ? officerText(language, 'กำลังลบ...', 'Deleting...')
                : officerText(language, 'ลบกิจกรรม', 'Delete activity')}
            variant="danger"
            loading={submitting}
            onCancel={onCancel}
            onConfirm={onConfirm}
        />
    );
}

export default function ActivityManagementPage() {
    const { user } = useAuth();
    const { language } = useLanguage();
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
                    setFeedback({
                        type: 'error',
                        message: err?.message || officerText(
                            language,
                            'ไม่สามารถโหลดข้อมูลคณะได้',
                            'Unable to load faculties.',
                        ),
                    });
                }
            } finally {
                if (mounted) setLookupsLoading(false);
            }
        }

        loadFaculties();
        return () => {
            mounted = false;
        };
    }, [language]);

    const loadOptions = useCallback(async () => {
        try {
            const nextOptions = await fetchActivityOptions({ facultyId: filters.facultyId });
            setOptions(nextOptions);
        } catch (err) {
            setFeedback({
                type: 'error',
                message: mapActivityError(err, language) || officerText(
                    language,
                    'ไม่สามารถโหลดตัวเลือกกิจกรรมได้',
                    'Unable to load activity options.',
                ),
            });
        }
    }, [filters.facultyId, language]);

    const loadActivities = useCallback(async ({ clearFeedback = false } = {}) => {
        setLoading(true);
        if (clearFeedback) {
            setFeedback({ type: '', message: '' });
        }
        try {
            const nextActivities = await fetchActivities(filters);
            setActivities(nextActivities);
        } catch (err) {
            setFeedback({
                type: 'error',
                message: mapActivityError(err, language) || officerText(
                    language,
                    'ไม่สามารถโหลดข้อมูลกิจกรรมได้',
                    'Unable to load activities.',
                ),
            });
        } finally {
            setLoading(false);
        }
    }, [filters, language]);

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
                setFeedback({
                    type: 'success',
                    message: officerText(language, 'บันทึกกิจกรรมแล้ว', 'Activity saved.'),
                });
            } else {
                await createActivity(form);
                setFeedback({
                    type: 'success',
                    message: officerText(language, 'เพิ่มกิจกรรมแล้ว', 'Activity added.'),
                });
            }
            setModalMode('');
            setEditingActivity(null);
            setForm(EMPTY_ACTIVITY_FORM);
            await loadActivities({ clearFeedback: false });
            await loadOptions();
        } catch (err) {
            setFeedback({ type: 'error', message: mapActivityError(err, language) });
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
                message: status === 'published'
                    ? officerText(language, 'เผยแพร่กิจกรรมแล้ว', 'Activity published.')
                    : officerText(language, 'ปิดกิจกรรมแล้ว', 'Activity closed.'),
            });
            await loadActivities({ clearFeedback: false });
        } catch (err) {
            setFeedback({ type: 'error', message: mapActivityError(err, language) });
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
            setFeedback({
                type: 'success',
                message: officerText(language, 'ลบกิจกรรมแล้ว', 'Activity deleted.'),
            });
            await loadActivities({ clearFeedback: false });
            await loadOptions();
        } catch (err) {
            setFeedback({ type: 'error', message: mapActivityError(err, language) });
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
        <div className="activity-management-page officer-page">
            <div className="course-list-header officer-page__header">
                <div className="course-list-header__left">
                    <h1 className="course-list-header__title officer-page__title">
                        {officerText(language, 'จัดการกิจกรรม', 'Activity management')}
                    </h1>
                    <p className="course-list-header__subtitle officer-page__subtitle">
                        {officerText(
                            language,
                            'เพิ่ม แก้ไข เผยแพร่ และปิดกิจกรรมสำหรับสะสมสมรรถนะนักศึกษา',
                            'Create, edit, publish, and close activities used to collect learner competencies.',
                        )}
                    </p>
                </div>
                <div className="course-list-header__actions officer-page__actions">
                    <button className="course-btn course-btn--ghost" onClick={() => loadActivities({ clearFeedback: true })} disabled={loading || submitting}>
                        <RefreshCw size={16} className={loading ? 'activity-management__spin' : ''} />
                        {officerText(language, 'โหลดใหม่', 'Refresh')}
                    </button>
                    <button className="course-btn course-btn--primary" onClick={openCreateModal} disabled={submitting || lookupsLoading}>
                        <Plus size={16} />
                        {officerText(language, 'เพิ่มกิจกรรม', 'Add activity')}
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

            <section className="activity-filter-panel officer-panel">
                <label className="course-field">
                    <span className="course-label">{officerText(language, 'คณะ', 'Faculty')}</span>
                    <select
                        className="course-input activity-input--disabled-aware"
                        value={filters.facultyId}
                        onChange={event => handleFacultyFilterChange(event.target.value)}
                        disabled={lookupsLoading || facultyLocked}
                    >
                        <option value="">
                            {isAdmin
                                ? officerText(language, 'ทุกคณะ', 'All faculties')
                                : officerText(language, 'คณะของคุณ', 'Your faculty')}
                        </option>
                        {faculties.map(faculty => (
                            <option key={faculty.facultyId} value={faculty.facultyId}>
                                {language === 'en' ? faculty.nameEn || faculty.nameTh : faculty.nameTh}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="course-field">
                    <span className="course-label">{officerText(language, 'สถานะ', 'Status')}</span>
                    <select
                        className="course-input"
                        value={filters.status}
                        onChange={event => setFilters(prev => ({ ...prev, status: event.target.value }))}
                    >
                        {STATUS_OPTIONS.map(option => (
                            <option key={option.value || 'all'} value={option.value}>
                                {option.value
                                    ? officerActivityStatusLabel(language, option.value)
                                    : officerText(language, 'ทุกสถานะ', 'All statuses')}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="course-field">
                    <span className="course-label">{officerText(language, 'หมวด', 'Category')}</span>
                    <input
                        className="course-input"
                        list="activity-filter-category-options"
                        value={filters.category}
                        onChange={event => setFilters(prev => ({ ...prev, category: event.target.value }))}
                        placeholder={officerText(language, 'ทุกหมวด', 'All categories')}
                    />
                </label>

                <label className="course-field">
                    <span className="course-label">{officerText(language, 'ประเภท', 'Type')}</span>
                    <input
                        className="course-input"
                        list="activity-filter-type-options"
                        value={filters.type}
                        onChange={event => setFilters(prev => ({ ...prev, type: event.target.value }))}
                        placeholder={officerText(language, 'ทุกประเภท', 'All types')}
                    />
                </label>

                <label className="course-field activity-filter-panel__search-field">
                    <span className="course-label">{officerText(language, 'ค้นหา', 'Search')}</span>
                    <div className="activity-search">
                        <Search size={16} />
                        <input
                            value={filters.search}
                            onChange={event => setFilters(prev => ({ ...prev, search: event.target.value }))}
                            placeholder={officerText(language, 'ค้นหารหัสหรือชื่อกิจกรรม', 'Search activity code or name')}
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

            <section className="activity-management__panel officer-panel">
                <div className="activity-management__panel-header">
                    <div>
                        <span className="activity-management__panel-kicker">
                            {officerText(language, 'กิจกรรมหลัก', 'Parent activity')}
                        </span>
                        <strong>
                            {activities.length}{' '}{officerText(language, 'รายการ', 'items')}
                        </strong>
                    </div>
                    <span className="activity-management__panel-note">
                        {officerText(language, 'ผู้ประเมินจะกำหนดในรอบกิจกรรม', 'Assessors are assigned in each session.')}
                    </span>
                </div>

                <div className="activity-table-wrap">
                    <table className="activity-table">
                        <thead>
                            <tr>
                                <th>{officerText(language, 'กิจกรรม', 'Activity')}</th>
                                <th>{officerText(language, 'หมวด/ประเภท', 'Category / type')}</th>
                                <th>{officerText(language, 'รอบกิจกรรม', 'Sessions')}</th>
                                <th>{officerText(language, 'สถานะ', 'Status')}</th>
                                <th aria-label={officerText(language, 'การจัดการ', 'Actions')}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="activity-management__empty">
                                        {officerText(language, 'กำลังโหลดข้อมูลกิจกรรม...', 'Loading activities...')}
                                    </td>
                                </tr>
                            ) : activities.length ? (
                                activities.map(activity => {
                                    const statusMeta = activityStatusMeta(activity.status, language);
                                    return (
                                        <tr key={activity.activityId}>
                                            <td>
                                                <div className="activity-name-cell">
                                                    <span className="activity-code">{activity.code}</span>
                                                    <strong>{language === 'en' ? activity.nameEn || activity.nameTh : activity.nameTh}</strong>
                                                    {language === 'th' && activity.nameEn && <span>{activity.nameEn}</span>}
                                                    {isAdmin && <span>{activity.facultyNameTh}</span>}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="activity-meta-cell">
                                                    <span>{activity.category || '-'}</span>
                                                    <span>{activity.type || '-'}</span>
                                                    {activity.registrationRequired && (
                                                        <span>{officerText(language, 'ต้องลงทะเบียน', 'Registration required')}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="activity-session-cell">
                                                    <span>
                                                        <CalendarClock size={14} />{' '}
                                                        {activity.sessionCount}{' '}{officerText(language, 'รอบ', 'sessions')}
                                                    </span>
                                                    <span>
                                                        {officerText(language, 'รอบถัดไป: ', 'Next: ')}
                                                        {formatDateTime(activity.nextSessionAt, language)}
                                                    </span>
                                                    <span>
                                                        {officerText(language, 'ล่าสุด: ', 'Latest: ')}
                                                        {formatDateTime(activity.latestSessionAt, language)}
                                                    </span>
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
                                                        title={officerText(language, 'จัดการรอบกิจกรรม', 'Manage sessions')}
                                                    >
                                                        <CalendarClock size={16} />
                                                    </Link>
                                                    <button
                                                        className="course-icon-btn"
                                                        onClick={() => openEditModal(activity)}
                                                        disabled={!activity.canEdit || submitting}
                                                        title={activity.canEdit
                                                            ? officerText(language, 'แก้ไขกิจกรรม', 'Edit activity')
                                                            : officerText(language, 'กิจกรรมนี้แก้ไขไม่ได้', 'This activity cannot be edited')}
                                                    >
                                                        {activity.canEdit ? <Edit3 size={16} /> : <Eye size={16} />}
                                                    </button>
                                                    <button
                                                        className="course-icon-btn"
                                                        onClick={() => handleStatusChange(activity, 'published')}
                                                        disabled={!activity.canPublish || submitting}
                                                        title={officerText(language, 'เผยแพร่กิจกรรม', 'Publish activity')}
                                                    >
                                                        <Megaphone size={16} />
                                                    </button>
                                                    <button
                                                        className="course-icon-btn"
                                                        onClick={() => handleStatusChange(activity, 'closed')}
                                                        disabled={!activity.canClose || submitting}
                                                        title={officerText(language, 'ปิดกิจกรรม', 'Close activity')}
                                                    >
                                                        <Power size={16} />
                                                    </button>
                                                    <button
                                                        className="course-icon-btn course-icon-btn--danger"
                                                        onClick={() => setDeletingActivity(activity)}
                                                        disabled={!activity.canDelete || submitting}
                                                        title={activity.canDelete
                                                            ? officerText(language, 'ลบกิจกรรม', 'Delete activity')
                                                            : officerText(language, 'ลบได้เฉพาะกิจกรรมฉบับร่างที่ยังไม่มีรอบกิจกรรม', 'Only draft activities without sessions can be deleted')}
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
                                    <td colSpan={5} className="activity-management__empty">
                                        {officerText(language, 'ไม่พบกิจกรรมตามเงื่อนไขที่เลือก', 'No activities match the selected filters.')}
                                    </td>
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
