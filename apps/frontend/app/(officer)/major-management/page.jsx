'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Building2, Edit3, GraduationCap, Plus, Power, RefreshCw, Save, Search, X } from 'lucide-react';
import { useAuth } from '../../../providers/auth-provider';
import {
    createMajor,
    fetchDepartments,
    fetchMajorFaculties,
    fetchMajorsForManagement,
    updateMajor,
    updateMajorStatus,
} from '../../../lib/major';
import ToastNotifications from '../../../components/ui/ToastNotifications';
import '../curriculum-management/CourseLayout.css';
import '../curriculum-management/CourseList.css';
import './MajorManagement.css';

const DEGREE_LEVELS = [
    { value: 'bachelor', label: 'ปริญญาตรี' },
    { value: 'master', label: 'ปริญญาโท' },
    { value: 'phd', label: 'ปริญญาเอก' },
    { value: 'other', label: 'อื่น ๆ' },
];

const EMPTY_MAJOR_FORM = {
    facultyId: '',
    departmentId: '',
    code: '',
    nameTh: '',
    nameEn: '',
    degreeLevel: 'bachelor',
    isActive: true,
};

function safeReturnTo(value) {
    if (!value || !value.startsWith('/') || value.startsWith('//')) {
        return '';
    }
    return value;
}

function appendCreatedMajor(returnTo, majorId) {
    const separator = returnTo.includes('?') ? '&' : '?';
    return `${returnTo}${separator}created_major_id=${majorId}`;
}

function degreeLabel(value) {
    return DEGREE_LEVELS.find(level => level.value === value)?.label || value || '-';
}

function MajorFormModal({
    mode,
    form,
    setForm,
    faculties,
    departments,
    isAdmin,
    submitting,
    forceActive,
    onClose,
    onSubmit,
}) {
    const formDepartments = form.facultyId
        ? departments.filter(department => String(department.facultyId) === String(form.facultyId))
        : [];
    const facultyLocked = !isAdmin || faculties.length <= 1;

    return (
        <div className="course-modal-overlay" onClick={onClose}>
            <div className="course-modal-box course-modal-box--md" onClick={event => event.stopPropagation()}>
                <div className="course-modal-header">
                    <h3>{mode === 'edit' ? 'แก้ไขสาขา' : 'เพิ่มสาขาใหม่'}</h3>
                    <button className="course-modal-close" onClick={onClose} aria-label="ปิด">
                        <X size={18} />
                    </button>
                </div>

                <div className="course-modal-body">
                    <div className="course-row">
                        <label className="course-field">
                            <span className="course-label">คณะ<span className="course-required">*</span></span>
                            <select
                                className="course-input major-input--disabled-aware"
                                value={form.facultyId || ''}
                                onChange={event => setForm(prev => ({
                                    ...prev,
                                    facultyId: event.target.value,
                                    departmentId: '',
                                }))}
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
                            <span className="course-label">ภาควิชา<span className="course-required">*</span></span>
                            <select
                                className="course-input"
                                value={form.departmentId || ''}
                                onChange={event => setForm(prev => ({ ...prev, departmentId: event.target.value }))}
                                disabled={!form.facultyId}
                            >
                                <option value="">เลือกภาควิชา</option>
                                {formDepartments.map(department => (
                                    <option key={department.departmentId} value={department.departmentId}>
                                        {department.nameTh}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <div className="course-row">
                        <label className="course-field">
                            <span className="course-label">รหัสสาขา<span className="course-required">*</span></span>
                            <input
                                className="course-input"
                                value={form.code}
                                onChange={event => setForm(prev => ({ ...prev, code: event.target.value }))}
                                placeholder="เช่น cp_major"
                            />
                        </label>

                        <label className="course-field">
                            <span className="course-label">ระดับปริญญา<span className="course-required">*</span></span>
                            <select
                                className="course-input"
                                value={form.degreeLevel}
                                onChange={event => setForm(prev => ({ ...prev, degreeLevel: event.target.value }))}
                            >
                                {DEGREE_LEVELS.map(level => (
                                    <option key={level.value} value={level.value}>
                                        {level.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <label className="course-field">
                        <span className="course-label">ชื่อสาขา (ภาษาไทย)<span className="course-required">*</span></span>
                        <input
                            className="course-input"
                            value={form.nameTh}
                            onChange={event => setForm(prev => ({ ...prev, nameTh: event.target.value }))}
                            placeholder="เช่น วิทยาการคอมพิวเตอร์"
                        />
                    </label>

                    <label className="course-field">
                        <span className="course-label">ชื่อสาขา (ภาษาอังกฤษ)</span>
                        <input
                            className="course-input"
                            value={form.nameEn}
                            onChange={event => setForm(prev => ({ ...prev, nameEn: event.target.value }))}
                            placeholder="เช่น Computer Science"
                        />
                    </label>

                    <label className="major-toggle-field">
                        <input
                            type="checkbox"
                            checked={forceActive ? true : form.isActive}
                            onChange={event => setForm(prev => ({ ...prev, isActive: event.target.checked }))}
                            disabled={forceActive}
                        />
                        <span>เปิดใช้งานสาขานี้</span>
                    </label>
                </div>

                <div className="course-modal-footer">
                    <button className="course-btn course-btn--ghost" onClick={onClose} disabled={submitting}>
                        ยกเลิก
                    </button>
                    <button className="course-btn course-btn--primary" onClick={onSubmit} disabled={submitting}>
                        <Save size={16} />
                        {submitting ? 'กำลังบันทึก...' : 'บันทึก'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function MajorManagementPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user } = useAuth();
    const isAdmin = user?.roles?.includes('admin');
    const returnTo = safeReturnTo(searchParams.get('return_to'));
    const requestedFacultyId = searchParams.get('faculty_id') || '';

    const [faculties, setFaculties] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [majors, setMajors] = useState([]);
    const [filters, setFilters] = useState({
        facultyId: '',
        departmentId: '',
        includeInactive: true,
    });
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [lookupsLoading, setLookupsLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [feedback, setFeedback] = useState({ type: '', message: '' });
    const [modalMode, setModalMode] = useState('');
    const [editingMajor, setEditingMajor] = useState(null);
    const [form, setForm] = useState(EMPTY_MAJOR_FORM);

    const facultyLocked = !isAdmin || faculties.length <= 1;

    useEffect(() => {
        let mounted = true;

        async function loadFaculties() {
            setLookupsLoading(true);
            try {
                const nextFaculties = await fetchMajorFaculties();
                if (!mounted) return;

                setFaculties(nextFaculties);
                const scopedFacultyId = nextFaculties.length === 1 ? String(nextFaculties[0].facultyId) : '';
                const initialFacultyId = requestedFacultyId || scopedFacultyId;
                setFilters(prev => ({
                    ...prev,
                    facultyId: initialFacultyId,
                }));
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
    }, [requestedFacultyId]);

    useEffect(() => {
        let mounted = true;

        async function loadDepartments() {
            try {
                const nextDepartments = await fetchDepartments({ facultyId: filters.facultyId });
                if (!mounted) return;
                setDepartments(nextDepartments);
            } catch (err) {
                if (mounted) {
                    setFeedback({ type: 'error', message: err?.message || 'ไม่สามารถโหลดข้อมูลภาควิชาได้' });
                }
            }
        }

        loadDepartments();
        return () => {
            mounted = false;
        };
    }, [filters.facultyId]);

    const loadMajors = useCallback(async () => {
        setLoading(true);
        try {
            const nextMajors = await fetchMajorsForManagement(filters);
            setMajors(nextMajors);
        } catch (err) {
            setFeedback({ type: 'error', message: err?.message || 'ไม่สามารถโหลดข้อมูลสาขาได้' });
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        loadMajors();
    }, [loadMajors]);

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

    const filteredMajors = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return majors;

        return majors.filter(major => {
            const values = [
                major.code,
                major.nameTh,
                major.nameEn,
                major.departmentNameTh,
                major.facultyNameTh,
            ].join(' ').toLowerCase();
            return values.includes(query);
        });
    }, [majors, search]);

    const openCreateModal = () => {
        const initialFacultyId = filters.facultyId || (faculties.length === 1 ? String(faculties[0].facultyId) : '');
        const scopedDepartments = initialFacultyId
            ? departments.filter(department => String(department.facultyId) === String(initialFacultyId))
            : [];

        setEditingMajor(null);
        setForm({
            ...EMPTY_MAJOR_FORM,
            facultyId: initialFacultyId,
            departmentId: filters.departmentId || (scopedDepartments.length === 1 ? String(scopedDepartments[0].departmentId) : ''),
        });
        setModalMode('create');
        setFeedback({ type: '', message: '' });
    };

    const openEditModal = (major) => {
        setEditingMajor(major);
        setForm({
            facultyId: String(major.facultyId || ''),
            departmentId: String(major.departmentId || ''),
            code: major.code || '',
            nameTh: major.nameTh || '',
            nameEn: major.nameEn || '',
            degreeLevel: major.degreeLevel || 'bachelor',
            isActive: major.isActive,
        });
        setModalMode('edit');
        setFeedback({ type: '', message: '' });
    };

    const closeModal = () => {
        if (submitting) return;
        setModalMode('');
        setEditingMajor(null);
        setForm(EMPTY_MAJOR_FORM);
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        setFeedback({ type: '', message: '' });

        try {
            const submitForm = returnTo && modalMode === 'create'
                ? { ...form, isActive: true }
                : form;
            const savedMajor = modalMode === 'edit'
                ? await updateMajor(editingMajor.majorId, submitForm)
                : await createMajor(submitForm);

            if (returnTo && modalMode === 'create') {
                router.push(appendCreatedMajor(returnTo, savedMajor.majorId));
                return;
            }

            setFeedback({
                type: 'success',
                message: modalMode === 'edit' ? 'บันทึกการแก้ไขสาขาสำเร็จ' : 'เพิ่มสาขาใหม่สำเร็จ',
            });
            setModalMode('');
            setEditingMajor(null);
            setForm(EMPTY_MAJOR_FORM);
            await loadMajors();
        } catch (err) {
            setFeedback({ type: 'error', message: err?.message || 'ไม่สามารถบันทึกข้อมูลสาขาได้' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleStatusToggle = async (major) => {
        setFeedback({ type: '', message: '' });
        try {
            await updateMajorStatus(major.majorId, !major.isActive);
            setFeedback({
                type: 'success',
                message: !major.isActive ? 'เปิดใช้งานสาขาสำเร็จ' : 'ปิดใช้งานสาขาสำเร็จ',
            });
            await loadMajors();
        } catch (err) {
            setFeedback({ type: 'error', message: err?.message || 'ไม่สามารถเปลี่ยนสถานะสาขาได้' });
        }
    };

    const handleFacultyFilterChange = (facultyId) => {
        setFilters(prev => ({
            ...prev,
            facultyId,
            departmentId: '',
        }));
    };

    const departmentsForFilter = filters.facultyId
        ? departments.filter(department => String(department.facultyId) === String(filters.facultyId))
        : departments;

    return (
        <div className="major-management-page">
            <div className="course-list-header">
                <div className="course-list-header__left">
                    {returnTo && (
                        <button className="major-back-btn" onClick={() => router.push(returnTo)}>
                            <ArrowLeft size={16} />
                            กลับไปสร้างหลักสูตร
                        </button>
                    )}
                    <div className="course-list-header__title">จัดการสาขา</div>
                    <p className="course-list-header__subtitle">
                        เพิ่ม แก้ไข และเปิด/ปิดสาขาที่ใช้เชื่อมกับหลักสูตร
                    </p>
                </div>
                <div className="course-list-header__actions">
                    <button className="course-btn course-btn--ghost" onClick={loadMajors} disabled={loading}>
                        <RefreshCw size={16} />
                        รีโหลด
                    </button>
                    <button className="course-btn course-btn--primary" onClick={openCreateModal}>
                        <Plus size={16} />
                        เพิ่มสาขา
                    </button>
                </div>
            </div>

            <div className="major-filter-panel">
                <label className="course-field">
                    <span className="course-label">คณะ</span>
                    <select
                        className="course-input major-input--disabled-aware"
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
                    <span className="course-label">ภาควิชา</span>
                    <select
                        className="course-input"
                        value={filters.departmentId}
                        onChange={event => setFilters(prev => ({ ...prev, departmentId: event.target.value }))}
                    >
                        <option value="">ทุกภาควิชา</option>
                        {departmentsForFilter.map(department => (
                            <option key={department.departmentId} value={department.departmentId}>
                                {department.nameTh}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="course-field">
                    <span className="course-label">ค้นหา</span>
                    <div className="major-search">
                        <Search size={16} />
                        <input
                            value={search}
                            onChange={event => setSearch(event.target.value)}
                            placeholder="ค้นหารหัสหรือชื่อสาขา"
                        />
                    </div>
                </label>

                <label className="major-checkbox">
                    <input
                        type="checkbox"
                        checked={filters.includeInactive}
                        onChange={event => setFilters(prev => ({ ...prev, includeInactive: event.target.checked }))}
                    />
                    <span>แสดงสาขาที่ปิดใช้งาน</span>
                </label>
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

            <div className="major-table-wrap">
                <table className="major-table">
                    <thead>
                        <tr>
                            <th>สาขา</th>
                            <th>คณะ/ภาควิชา</th>
                            <th>ระดับ</th>
                            <th>หลักสูตร</th>
                            <th>สถานะ</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredMajors.map(major => (
                            <tr key={major.majorId}>
                                <td>
                                    <div className="major-name-cell">
                                        <span className="major-code">{major.code}</span>
                                        <strong>{major.nameTh}</strong>
                                        {major.nameEn && <span>{major.nameEn}</span>}
                                    </div>
                                </td>
                                <td>
                                    <div className="major-org-cell">
                                        <span><Building2 size={14} />{major.facultyNameTh || '-'}</span>
                                        <span>{major.departmentNameTh || '-'}</span>
                                    </div>
                                </td>
                                <td>
                                    <span className="major-degree-pill">
                                        <GraduationCap size={14} />
                                        {degreeLabel(major.degreeLevel)}
                                    </span>
                                </td>
                                <td>{major.curriculumCount}</td>
                                <td>
                                    <span className={`major-status major-status--${major.isActive ? 'active' : 'inactive'}`}>
                                        {major.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                                    </span>
                                </td>
                                <td>
                                    <div className="major-row-actions">
                                        <button className="course-icon-btn" onClick={() => openEditModal(major)} title="แก้ไขสาขา">
                                            <Edit3 size={16} />
                                        </button>
                                        <button
                                            className={`course-icon-btn ${major.isActive ? 'course-icon-btn--danger' : ''}`}
                                            onClick={() => handleStatusToggle(major)}
                                            title={major.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                                        >
                                            <Power size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {!loading && filteredMajors.length === 0 && (
                    <div className="course-empty">
                        <div className="course-empty__icon">
                            <GraduationCap size={34} />
                        </div>
                        <div className="course-empty__title">ยังไม่มีสาขา</div>
                        <p className="course-empty__text">เพิ่มสาขาใหม่เพื่อใช้เชื่อมกับหลักสูตร</p>
                    </div>
                )}

                {loading && (
                    <div className="major-loading">กำลังโหลดข้อมูลสาขา...</div>
                )}
            </div>

            {modalMode && (
                <MajorFormModal
                    mode={modalMode}
                    form={form}
                    setForm={setForm}
                    faculties={faculties}
                    departments={departments}
                    isAdmin={isAdmin}
                    submitting={submitting}
                    forceActive={Boolean(returnTo && modalMode === 'create')}
                    onClose={closeModal}
                    onSubmit={handleSubmit}
                />
            )}
        </div>
    );
}

export default function MajorManagementPage() {
    return (
        <Suspense fallback={<div className="major-management-page">กำลังโหลด...</div>}>
            <MajorManagementPageContent />
        </Suspense>
    );
}
