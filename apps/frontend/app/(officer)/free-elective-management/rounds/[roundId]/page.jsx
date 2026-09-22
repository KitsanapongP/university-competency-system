'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import {
    ArrowLeft,
    BookOpen,
    Copy,
    Layers,
    Plus,
    RefreshCw,
    UserRound,
    XCircle,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../../../providers/auth-provider';
import { useLanguage } from '../../../../../providers/LanguageContext';
import { fetchCompetenciesForManagement } from '../../../../../lib/competency-management';
import {
    addFreeElectiveRoundCourse,
    duplicateFreeElectiveRound,
    fetchFreeElectiveCourses,
    fetchFreeElectiveRound,
    recalculateFreeElectiveRoundScores,
    updateFreeElectiveRoundStatus,
} from '../../../../../lib/free-elective';
import BaseModal from '../../../../../components/ui/BaseModal';
import ConfirmActionModal from '../../../../../components/ui/ConfirmActionModal';
import ToastNotifications from '../../../../../components/ui/ToastNotifications';
import FreeElectiveRoundCourseCard from '../../components/FreeElectiveRoundCourseCard';
import FreeElectiveRoundCourseFormModal from '../../components/FreeElectiveRoundCourseFormModal';
import FreeElectiveStatusBadge from '../../components/FreeElectiveStatusBadge';
import {
    buildFreeElectiveLabels,
    formatFreeElectiveTerm,
    freeElectiveText,
} from '../../free-elective-labels';
import '../../../curriculum-management/CourseLayout.css';
import '../../FreeElectiveManagement.css';

function getRoundStatusAction(round) {
    if (round?.status === 'draft') {
        return 'open';
    }
    if (round?.status === 'active') {
        return 'cancel';
    }
    return '';
}

function getFacultyName(round, language) {
    return language === 'en'
        ? round.facultyNameEn || round.facultyNameTh
        : round.facultyNameTh;
}

function getRoundCourseKey(course) {
    return [
        'round-course',
        course.roundCourseId || 'missing-id',
        course.freeElectiveCourseId || course.courseCode || 'unknown-course',
        course.displayOrder || 'unknown-order',
    ].join('-');
}

function RoundDuplicateModal({
    open,
    initialYear,
    initialSemester,
    saving,
    labels,
    onClose,
    onSubmit,
}) {
    const [academicYearBE, setAcademicYearBE] = useState(
        String(initialYear || ''),
    );
    const [semester, setSemester] = useState(String(initialSemester || '1'));

    return (
        <BaseModal
            open={open}
            title={labels.duplicateRoundTitle}
            icon={<Copy size={18} />}
            size="md"
            onClose={onClose}
            closeDisabled={saving}
        >
            <form
                className="free-elective-round-duplicate-form"
                onSubmit={(event) => {
                    event.preventDefault();
                    onSubmit({ academicYearBE, semester });
                }}
            >
                <p className="free-elective-round-duplicate-form__hint">
                    {labels.duplicateHint}
                </p>
                <label className="free-elective-field">
                    <span>{labels.duplicateTargetYear} *</span>
                    <input
                        type="number"
                        min="2400"
                        value={academicYearBE}
                        onChange={(event) => setAcademicYearBE(event.target.value)}
                        disabled={saving}
                        required
                    />
                </label>
                <label className="free-elective-field">
                    <span>{labels.duplicateTargetSemester} *</span>
                    <select
                        value={semester}
                        onChange={(event) => setSemester(event.target.value)}
                        disabled={saving}
                    >
                        <option value="1">{labels.semesterOne}</option>
                        <option value="2">{labels.semesterTwo}</option>
                        <option value="3">{labels.semesterThree}</option>
                    </select>
                </label>
                <div className="free-elective-modal-actions">
                    <button
                        type="button"
                        className="free-elective-button free-elective-button--secondary"
                        onClick={onClose}
                        disabled={saving}
                    >
                        <XCircle size={15} aria-hidden="true" />
                        {labels.cancel}
                    </button>
                    <button
                        type="submit"
                        className="free-elective-button free-elective-button--primary"
                        disabled={saving || !academicYearBE || !semester}
                    >
                        <Copy size={15} aria-hidden="true" />
                        {saving ? labels.loading : labels.duplicateRound}
                    </button>
                </div>
            </form>
        </BaseModal>
    );
}

function FreeElectiveRoundDetailPageContent() {
    const router = useRouter();
    const params = useParams();
    const { user, loading: authLoading } = useAuth();
    const { language } = useLanguage();
    const labels = useMemo(() => buildFreeElectiveLabels(language), [language]);
    const roundId = params?.roundId;

    const [roundDetail, setRoundDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [statusAction, setStatusAction] = useState('');
    const [recalculateOpen, setRecalculateOpen] = useState(false);
    const [duplicateOpen, setDuplicateOpen] = useState(false);
    const [duplicateKey, setDuplicateKey] = useState(0);
    const [addCourseOpen, setAddCourseOpen] = useState(false);
    const [courseFormKey, setCourseFormKey] = useState(0);
    const [catalogLoading, setCatalogLoading] = useState(false);
    const [catalogCourses, setCatalogCourses] = useState([]);
    const [masterCompetencies, setMasterCompetencies] = useState([]);

    const loadData = useCallback(async () => {
        if (!user || !roundId) {
            return;
        }
        setLoading(true);
        setError('');
        try {
            setRoundDetail(await fetchFreeElectiveRound(roundId));
        } catch (loadError) {
            setError(loadError.message || labels.roundLoadError);
        } finally {
            setLoading(false);
        }
    }, [labels.roundLoadError, roundId, user]);

    useEffect(() => {
        if (!authLoading && user) {
            loadData();
        }
    }, [authLoading, loadData, user]);

    const round = roundDetail?.round;
    const courses = roundDetail?.courses || [];
    const canEdit = round?.status === 'draft' || round?.status === 'active';

    const loadCourseCatalog = async () => {
        if (!round || catalogLoading) {
            return;
        }
        setCatalogLoading(true);
        setError('');
        try {
            const [nextCourses, nextCompetencies] = await Promise.all([
                fetchFreeElectiveCourses({ facultyId: round.facultyId }),
                fetchCompetenciesForManagement(),
            ]);
            const selectedIds = new Set(courses.map((course) => course.freeElectiveCourseId));
            setCatalogCourses(
                nextCourses.filter((course) => course.isActive && !selectedIds.has(course.id)),
            );
            setMasterCompetencies(nextCompetencies.filter((item) => item.isActive));
        } catch (loadError) {
            setError(loadError.message || labels.loadError);
        } finally {
            setCatalogLoading(false);
        }
    };

    const openAddCourse = async () => {
        setCourseFormKey((current) => current + 1);
        setAddCourseOpen(true);
        await loadCourseCatalog();
    };

    const openDuplicate = () => {
        setDuplicateKey((current) => current + 1);
        setDuplicateOpen(true);
    };

    const handleAddCourse = async ({ courseId, competencies }) => {
        setSaving(true);
        setError('');
        try {
            await addFreeElectiveRoundCourse(roundId, courseId, competencies);
            setAddCourseOpen(false);
            setSuccess(labels.courseAddedToRound);
            await loadData();
        } catch (saveError) {
            setError(saveError.message || labels.loadError);
        } finally {
            setSaving(false);
        }
    };

    const handleStatusChange = async () => {
        if (!statusAction) {
            return;
        }
        const nextStatus = statusAction === 'open' ? 'active' : 'cancelled';
        setSaving(true);
        setError('');
        try {
            await updateFreeElectiveRoundStatus(roundId, nextStatus);
            setStatusAction('');
            setSuccess(
                statusAction === 'open'
                    ? labels.openRound
                    : labels.cancelRound,
            );
            await loadData();
        } catch (statusError) {
            setError(statusError.message || labels.loadError);
        } finally {
            setSaving(false);
        }
    };

    const handleRecalculate = async () => {
        setSaving(true);
        setError('');
        try {
            await recalculateFreeElectiveRoundScores(roundId);
            setRecalculateOpen(false);
            setSuccess(labels.recalculateRoundScoresSuccess);
            await loadData();
        } catch (recalculateError) {
            setError(recalculateError.message || labels.loadError);
        } finally {
            setSaving(false);
        }
    };

    const handleDuplicate = async (form) => {
        setSaving(true);
        setError('');
        try {
            const duplicated = await duplicateFreeElectiveRound(roundId, form);
            setDuplicateOpen(false);
            setSuccess(labels.duplicateSuccess);
            if (duplicated?.round?.roundId) {
                router.push(`/free-elective-management/rounds/${duplicated.round.roundId}`);
            }
        } catch (duplicateError) {
            setError(duplicateError.message || labels.loadError);
        } finally {
            setSaving(false);
        }
    };

    if (loading && !round) {
        return (
            <div className="free-elective-loading" role="status">
                {labels.loading}
            </div>
        );
    }

    if (!round) {
        return (
            <div className="free-elective-empty">
                {labels.roundLoadError}
            </div>
        );
    }

    const statusMessage = statusAction === 'open'
        ? {
            title: labels.openRoundTitle,
            message: labels.openRoundMessage,
            confirm: labels.confirmOpenRound,
        }
        : {
            title: labels.cancelRoundTitle,
            message: labels.cancelRoundMessage,
            confirm: labels.confirmCancelRound,
        };

    return (
        <div className="free-elective-page officer-page ui-page">
            <button
                type="button"
                className="free-elective-back-button"
                onClick={() => router.push('/free-elective-management')}
            >
                <ArrowLeft size={16} aria-hidden="true" />
                {labels.back}
            </button>

            <header className="free-elective-page__header officer-page__header ui-page__header">
                <div>
                    <p className="free-elective-page__eyebrow free-elective-eyebrow">
                        <Layers size={15} aria-hidden="true" />
                        {labels.roundDetailTitle}
                    </p>
                    <h1 className="free-elective-page__title officer-page__title">
                        {formatFreeElectiveTerm(
                            round.academicYearBE,
                            round.semester,
                            language,
                        )}
                    </h1>
                    <p className="free-elective-page__subtitle officer-page__subtitle">
                        {getFacultyName(round, language)}
                        {' | '}
                        {labels.roundDetailSubtitle}
                    </p>
                    <div className="free-elective-summary-chips">
                        <span>
                            {labels.roundOwner}: {getFacultyName(round, language)}
                        </span>
                        <span>
                            <BookOpen size={14} aria-hidden="true" />
                            {round.courseCount} {labels.courseCount}
                        </span>
                        <span>
                            <UserRound size={14} aria-hidden="true" />
                            {round.learnerCount} {labels.learnerCountShort}
                        </span>
                    </div>
                </div>
                <div className="free-elective-page__actions officer-page__actions">
                    <FreeElectiveStatusBadge status={round.status} language={language} />
                    <button
                        type="button"
                        className="free-elective-button free-elective-button--secondary"
                        onClick={loadData}
                        disabled={loading || saving}
                        title={labels.refresh}
                    >
                        <RefreshCw size={16} aria-hidden="true" />
                        {labels.refresh}
                    </button>
                    {round.scoresRecalculationRequired && canEdit && (
                        <button
                            type="button"
                            className="free-elective-button free-elective-button--primary"
                            onClick={() => setRecalculateOpen(true)}
                            disabled={saving || loading}
                            title={labels.recalculateRoundScores}
                        >
                            <RefreshCw size={16} aria-hidden="true" />
                            {labels.recalculateRoundScores}
                        </button>
                    )}
                    <button
                        type="button"
                        className="free-elective-button free-elective-button--secondary"
                        onClick={openDuplicate}
                        disabled={saving}
                        title={labels.duplicateRound}
                    >
                        <Copy size={16} aria-hidden="true" />
                        {labels.duplicateRound}
                    </button>
                    {getRoundStatusAction(round) === 'open' && (
                        <button
                            type="button"
                            className="free-elective-button free-elective-button--primary"
                            onClick={() => setStatusAction('open')}
                            disabled={saving || !courses.length}
                        >
                            <Plus size={16} aria-hidden="true" />
                            {labels.openRound}
                        </button>
                    )}
                    {getRoundStatusAction(round) === 'cancel' && (
                        <button
                            type="button"
                            className="free-elective-button free-elective-button--secondary"
                            onClick={() => setStatusAction('cancel')}
                            disabled={saving}
                        >
                            <XCircle size={16} aria-hidden="true" />
                            {labels.cancelRound}
                        </button>
                    )}
                </div>
            </header>

            {round.scoresRecalculationRequired && (
                <div className="free-elective-notice free-elective-notice--warning" role="status">
                    <RefreshCw size={16} aria-hidden="true" />
                    <span>{labels.roundScoreRecalculation}</span>
                </div>
            )}

            <section className="free-elective-panel">
                <div className="free-elective-panel__heading">
                    <div>
                        <p className="free-elective-eyebrow">{labels.coursesInRound}</p>
                        <p>{labels.roundDetailSubtitle}</p>
                    </div>
                    {canEdit && (
                        <button
                            type="button"
                            className="free-elective-button free-elective-button--primary"
                            onClick={openAddCourse}
                            disabled={saving || catalogLoading}
                        >
                            <Plus size={16} aria-hidden="true" />
                            {labels.addCourseToRound}
                        </button>
                    )}
                </div>
                <div className="free-elective-panel__content">
                    {courses.length ? (
                        <div className="free-elective-round-course-grid">
                            {courses.map((course) => (
                                <FreeElectiveRoundCourseCard
                                    key={getRoundCourseKey(course)}
                                    course={course}
                                    language={language}
                                    labels={labels}
                                    onManage={(roundCourseIdValue) => router.push(
                                        `/free-elective-management/rounds/${roundId}/courses/${roundCourseIdValue}`,
                                    )}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="free-elective-empty">{labels.noRoundCourses}</div>
                    )}
                </div>
            </section>

            <FreeElectiveRoundCourseFormModal
                key={`round-course-form-${courseFormKey}`}
                open={addCourseOpen}
                courses={catalogCourses}
                competencies={masterCompetencies}
                saving={saving}
                language={language}
                labels={labels}
                onClose={() => setAddCourseOpen(false)}
                onSubmit={handleAddCourse}
            />
            <RoundDuplicateModal
                key={`round-duplicate-${duplicateKey}`}
                open={duplicateOpen}
                initialYear={round.academicYearBE + 1}
                initialSemester={round.semester}
                saving={saving}
                labels={labels}
                onClose={() => setDuplicateOpen(false)}
                onSubmit={handleDuplicate}
            />
            <ConfirmActionModal
                open={Boolean(statusAction)}
                title={statusMessage.title}
                message={statusMessage.message}
                variant={statusAction === 'cancel' ? 'danger' : 'info'}
                size="md"
                loading={saving}
                confirmLabel={statusMessage.confirm}
                cancelLabel={labels.cancel}
                onConfirm={handleStatusChange}
                onCancel={() => setStatusAction('')}
            />
            <ConfirmActionModal
                open={recalculateOpen}
                title={labels.recalculateRoundScoresTitle}
                message={labels.recalculateRoundScoresMessage}
                hint={labels.recalculateRoundScoresHint}
                variant="info"
                size="md"
                loading={saving}
                confirmLabel={labels.recalculateRoundScores}
                cancelLabel={labels.cancel}
                onConfirm={handleRecalculate}
                onCancel={() => setRecalculateOpen(false)}
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

export default function FreeElectiveRoundDetailPage() {
    return (
        <Suspense
            fallback={(
                <div className="free-elective-loading" role="status">
                    {freeElectiveText('th', 'loading')}
                </div>
            )}
        >
            <FreeElectiveRoundDetailPageContent />
        </Suspense>
    );
}
