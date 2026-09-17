'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ArrowLeft,
    BookOpen,
    Check,
    GraduationCap,
    Plus,
    RefreshCw,
    Save,
    UserRound,
    X,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../../../providers/auth-provider';
import { useLanguage } from '../../../../../providers/LanguageContext';
import {
    addFreeElectiveStudentOffering,
    fetchFreeElectiveStudentAvailableOfferings,
    fetchFreeElectiveStudentDetail,
    getFreeElectiveGradeOptions,
    updateFreeElectiveStudentGrade,
    updateFreeElectiveStudentOfferingStatus,
} from '../../../../../lib/free-elective';
import ConfirmActionModal from '../../../../../components/ui/ConfirmActionModal';
import ToastNotifications from '../../../../../components/ui/ToastNotifications';
import FreeElectiveEnrollmentStatusBadge from '../../components/FreeElectiveEnrollmentStatusBadge';
import FreeElectiveStudentCourseActions from '../../components/FreeElectiveStudentCourseActions';
import FreeElectiveStudentOfferingPicker from '../../components/FreeElectiveStudentOfferingPicker';
import {
    FREE_ELECTIVE_LABELS,
    freeElectiveGradeSourceLabel,
    freeElectiveText,
    localizedFreeElective,
} from '../../free-elective-labels';
import '../../FreeElectiveManagement.css';

function buildLabels(language) {
    return Object.fromEntries(
        Object.keys(FREE_ELECTIVE_LABELS.th).map((key) => [key, freeElectiveText(language, key)]),
    );
}

function courseKey(course) {
    return String(course.offeringEnrollmentId || `${course.offeringId}-${course.courseCode}`);
}

function groupCoursesByTerm(courses) {
    const groups = new Map();
    (courses || []).forEach((course) => {
        const key = `${course.academicYearBE}-${course.semester}`;
        if (!groups.has(key)) {
            groups.set(key, {
                year: course.academicYearBE,
                semester: course.semester,
                courses: [],
            });
        }
        groups.get(key).courses.push(course);
    });

    return Array.from(groups.values()).sort((left, right) => {
        if (left.year !== right.year) {
            return left.year - right.year;
        }
        return left.semester - right.semester;
    });
}

function semesterLabel(semester, labels) {
    const labelsBySemester = {
        1: labels.semesterOne,
        2: labels.semesterTwo,
        3: labels.semesterThree,
    };

    return labelsBySemester[semester] || `${labels.term} ${semester || '-'}`;
}

function courseName(course, language) {
    return language === 'en'
        ? course.courseNameEn || course.courseNameTh
        : course.courseNameTh;
}

export default function FreeElectiveStudentDetailPage() {
    const router = useRouter();
    const params = useParams();
    const { user, loading: authLoading } = useAuth();
    const { language } = useLanguage();
    const labels = useMemo(() => buildLabels(language), [language]);
    const enrollmentId = params?.enrollmentId;
    const canManage = user?.roles?.some((role) => role === 'admin' || role === 'officer');

    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [editingCourseId, setEditingCourseId] = useState('');
    const [draftGrades, setDraftGrades] = useState({});
    const [savingAction, setSavingAction] = useState('');
    const [pendingWithdrawal, setPendingWithdrawal] = useState(null);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [availableOfferings, setAvailableOfferings] = useState([]);
    const [availableLoading, setAvailableLoading] = useState(false);

    const loadDetail = useCallback(async () => {
        if (!user || !enrollmentId) {
            return;
        }

        setLoading(true);
        setError('');
        try {
            setDetail(await fetchFreeElectiveStudentDetail(enrollmentId));
        } catch (loadError) {
            setError(loadError.message || labels.loadError);
        } finally {
            setLoading(false);
        }
    }, [enrollmentId, labels.loadError, user]);

    useEffect(() => {
        if (!authLoading && user) {
            loadDetail();
        }
    }, [authLoading, loadDetail, user]);

    const termGroups = useMemo(
        () => groupCoursesByTerm(detail?.courses),
        [detail?.courses],
    );

    const openPicker = async () => {
        setPickerOpen(true);
        setAvailableLoading(true);
        setError('');
        try {
            setAvailableOfferings(await fetchFreeElectiveStudentAvailableOfferings(enrollmentId));
        } catch (loadError) {
            setError(loadError.message || labels.loadError);
        } finally {
            setAvailableLoading(false);
        }
    };

    const handleAddOffering = async (offeringId) => {
        setSavingAction('add-offering');
        setError('');
        setSuccess('');
        try {
            const nextDetail = await addFreeElectiveStudentOffering(enrollmentId, offeringId);
            setDetail(nextDetail);
            setAvailableOfferings((current) => current.filter(
                (offering) => String(offering.offeringId) !== String(offeringId),
            ));
            setPickerOpen(false);
            setSuccess(labels.studentAddSuccess);
        } catch (saveError) {
            setError(saveError.message || labels.loadError);
        } finally {
            setSavingAction('');
        }
    };

    const startEditing = (course) => {
        const key = courseKey(course);
        setEditingCourseId(key);
        setDraftGrades((current) => ({ ...current, [key]: course.grade || '' }));
    };

    const cancelEditing = () => {
        setEditingCourseId('');
        setDraftGrades((current) => {
            const next = { ...current };
            delete next[editingCourseId];
            return next;
        });
    };

    const setDraftGrade = (course, grade) => {
        setDraftGrades((current) => ({
            ...current,
            [courseKey(course)]: grade,
        }));
    };

    const saveGrade = async (course) => {
        const key = courseKey(course);
        const grade = draftGrades[key] || '';
        if (!grade) {
            setError(labels.noGrade);
            return;
        }

        setSavingAction(`grade:${key}`);
        setError('');
        setSuccess('');
        try {
            setDetail(await updateFreeElectiveStudentGrade(
                enrollmentId,
                course.offeringEnrollmentId,
                grade,
            ));
            setEditingCourseId('');
            setDraftGrades((current) => {
                const next = { ...current };
                delete next[key];
                return next;
            });
            setSuccess(labels.gradeSaved);
        } catch (saveError) {
            setError(saveError.message || labels.loadError);
        } finally {
            setSavingAction('');
        }
    };

    const requestWithdraw = (course) => {
        setPendingWithdrawal(course);
    };

    const confirmWithdraw = async () => {
        if (!pendingWithdrawal) {
            return;
        }

        const key = courseKey(pendingWithdrawal);
        setSavingAction(`status:${key}`);
        setError('');
        setSuccess('');
        try {
            setDetail(await updateFreeElectiveStudentOfferingStatus(
                enrollmentId,
                pendingWithdrawal.offeringEnrollmentId,
                'withdrawn',
            ));
            setPendingWithdrawal(null);
            setSuccess(labels.studentWithdrawSuccess);
        } catch (saveError) {
            setError(saveError.message || labels.loadError);
        } finally {
            setSavingAction('');
        }
    };

    const restoreEnrollment = async (course) => {
        const key = courseKey(course);
        setSavingAction(`status:${key}`);
        setError('');
        setSuccess('');
        try {
            setDetail(await updateFreeElectiveStudentOfferingStatus(
                enrollmentId,
                course.offeringEnrollmentId,
                'enrolled',
            ));
            setSuccess(labels.studentRestoreSuccess);
        } catch (saveError) {
            setError(saveError.message || labels.loadError);
        } finally {
            setSavingAction('');
        }
    };

    if (loading && !detail) {
        return (
            <div className="free-elective-loading" role="status">
                {labels.loading}
            </div>
        );
    }

    if (!detail) {
        return (
            <div className="free-elective-empty">
                {labels.loadError}
            </div>
        );
    }

    const { student } = detail;

    return (
        <div className="free-elective-page officer-page ui-page">
            <button
                type="button"
                className="free-elective-back-button"
                onClick={() => router.push('/free-elective-management/groups')}
            >
                <ArrowLeft size={16} aria-hidden="true" />
                {labels.groups}
            </button>
            <header className="free-elective-page__header officer-page__header ui-page__header">
                <div>
                    <p className="free-elective-page__eyebrow">
                        <UserRound size={15} aria-hidden="true" />
                        {labels.studentDetail}
                    </p>
                    <h1 className="free-elective-page__title officer-page__title">
                        {student.studentCode}
                    </h1>
                    <p className="free-elective-page__subtitle officer-page__subtitle">
                        {localizedFreeElective(
                            student,
                            language,
                            'studentNameTh',
                            'studentNameEn',
                        )}
                    </p>
                    <div className="free-elective-summary-chips">
                        <span>
                            <GraduationCap size={14} aria-hidden="true" />
                            {localizedFreeElective(
                                student,
                                language,
                                'curriculumNameTh',
                                'curriculumNameEn',
                            )}
                        </span>
                        <span>
                            {labels.entryYear} {student.entryYearBE || '-'}
                        </span>
                    </div>
                </div>
                <div className="free-elective-page__actions officer-page__actions">
                    <div className="free-elective-student-detail-count">
                        <strong>{detail.courses.length}</strong>
                        <span>{labels.courseHistory}</span>
                    </div>
                    {canManage && (
                        <>
                            <button
                                type="button"
                                className="free-elective-button free-elective-button--secondary"
                                onClick={loadDetail}
                                disabled={loading || Boolean(savingAction)}
                                title={labels.refresh}
                            >
                                <RefreshCw size={16} aria-hidden="true" />
                                {labels.refresh}
                            </button>
                            <button
                                type="button"
                                className="free-elective-button free-elective-button--primary"
                                onClick={openPicker}
                                disabled={Boolean(savingAction)}
                            >
                                <Plus size={17} aria-hidden="true" />
                                {labels.studentAddButton}
                            </button>
                        </>
                    )}
                </div>
            </header>

            <section className="free-elective-panel">
                <div className="free-elective-panel__heading">
                    <div>
                        <p className="free-elective-eyebrow">
                            <BookOpen size={15} aria-hidden="true" />
                            {labels.courseHistory}
                        </p>
                        <p>{labels.studentDetailSubtitle}</p>
                    </div>
                </div>
                {termGroups.length ? termGroups.map((term) => (
                    <section
                        className="free-elective-term-group"
                        key={`${term.year}-${term.semester}`}
                    >
                        <div className="free-elective-term-group__heading">
                            <strong>
                                {labels.academicYear} {term.year}
                            </strong>
                            <span>{semesterLabel(term.semester, labels)}</span>
                        </div>
                        <div className="free-elective-student-course-list">
                            <div className="free-elective-student-course-list__header">
                                <span>{labels.course}</span>
                                <span>{labels.sectionNo}</span>
                                <span>{labels.grade}</span>
                                <span>{labels.gradeSource}</span>
                                <span>{labels.enrollmentStatus}</span>
                                <span>{labels.manage}</span>
                            </div>
                            {term.courses.map((course) => {
                                const key = courseKey(course);
                                const isEditing = editingCourseId === key;
                                const isSavingGrade = savingAction === `grade:${key}`;
                                const isSavingStatus = savingAction === `status:${key}`;
                                const gradeOptions = getFreeElectiveGradeOptions(course.gradeScheme);

                                return (
                                    <div
                                        className={`free-elective-student-course-row ${isEditing
                                            ? 'free-elective-student-course-row--editing'
                                            : ''}`}
                                        key={key}
                                    >
                                        <div>
                                            <strong>{course.courseCode}</strong>
                                            <span>{courseName(course, language)}</span>
                                        </div>
                                        <span>
                                            {labels.sectionNo} {course.sectionNo}
                                        </span>
                                        {isEditing ? (
                                            <select
                                                className="free-elective-grade-select"
                                                value={draftGrades[key] || ''}
                                                onChange={(event) => setDraftGrade(course, event.target.value)}
                                                disabled={isSavingGrade}
                                                aria-label={`${labels.grade}: ${course.courseCode}`}
                                            >
                                                <option value="">{labels.noGrade}</option>
                                                {gradeOptions.map((grade) => (
                                                    <option key={grade} value={grade}>
                                                        {grade}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <strong className="free-elective-grade-value">
                                                {course.grade || labels.noGrade}
                                            </strong>
                                        )}
                                        <span>
                                            {course.grade ? (
                                                <>
                                                    {freeElectiveGradeSourceLabel(course.gradeSource, language)}
                                                    {course.isBestGrade && (
                                                        <span className="free-elective-best-badge">
                                                            <Check size={13} aria-hidden="true" />
                                                            {labels.usedForCalculation}
                                                        </span>
                                                    )}
                                                </>
                                            ) : (
                                                labels.noGrade
                                            )}
                                        </span>
                                        <FreeElectiveEnrollmentStatusBadge
                                            status={course.status}
                                            language={language}
                                        />
                                        <div className="free-elective-course-row__manage">
                                            {isEditing ? (
                                                <div className="free-elective-inline-actions">
                                                    <button
                                                        type="button"
                                                        className="free-elective-icon-button free-elective-icon-button--danger"
                                                        onClick={cancelEditing}
                                                        disabled={isSavingGrade}
                                                        title={labels.cancel}
                                                        aria-label={labels.cancel}
                                                    >
                                                        <X size={16} aria-hidden="true" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="free-elective-icon-button free-elective-icon-button--success"
                                                        onClick={() => saveGrade(course)}
                                                        disabled={isSavingGrade || !draftGrades[key]}
                                                        title={labels.saveGrade}
                                                        aria-label={labels.saveGrade}
                                                    >
                                                        <Save size={16} aria-hidden="true" />
                                                    </button>
                                                </div>
                                            ) : canManage ? (
                                                <FreeElectiveStudentCourseActions
                                                    course={course}
                                                    labels={labels}
                                                    disabled={Boolean(editingCourseId) || isSavingStatus}
                                                    onEdit={startEditing}
                                                    onWithdraw={requestWithdraw}
                                                    onRestore={restoreEnrollment}
                                                />
                                            ) : null}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )) : (
                    <div className="free-elective-empty free-elective-panel__content">
                        {labels.courseHistoryEmpty}
                    </div>
                )}
            </section>

            <FreeElectiveStudentOfferingPicker
                open={pickerOpen}
                offerings={availableOfferings}
                loading={availableLoading}
                saving={savingAction === 'add-offering'}
                language={language}
                labels={labels}
                onClose={() => setPickerOpen(false)}
                onSubmit={handleAddOffering}
            />
            <ConfirmActionModal
                open={Boolean(pendingWithdrawal)}
                title={labels.studentWithdrawTitle}
                message={pendingWithdrawal
                    ? `${labels.studentWithdrawMessage}\n\n${pendingWithdrawal.courseCode} ${courseName(pendingWithdrawal, language)}`
                    : ''}
                confirmLabel={labels.studentWithdraw}
                cancelLabel={labels.cancel}
                variant="danger"
                loading={Boolean(savingAction)}
                onConfirm={confirmWithdraw}
                onCancel={() => setPendingWithdrawal(null)}
            />
            <ToastNotifications
                success={success}
                error={error}
                onCloseSuccess={() => setSuccess('')}
                onCloseError={() => setError('')}
            />
        </div>
    );
}
