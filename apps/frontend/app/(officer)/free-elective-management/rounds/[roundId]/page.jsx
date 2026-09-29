'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import {
    ArrowLeft,
    BookOpen,
    Building2,
    CalendarDays,
    Check,
    Copy,
    Layers,
    Pencil,
    Plus,
    RefreshCw,
    RotateCcw,
    UserRound,
    XCircle,
} from 'lucide-react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../../../providers/auth-provider';
import { useLanguage } from '../../../../../providers/LanguageContext';
import { fetchCompetenciesForManagement } from '../../../../../lib/competency-management';
import { fetchFaculties } from '../../../../../lib/curriculum';
import {
    addFreeElectiveRoundCourse,
    duplicateFreeElectiveRound,
    fetchFreeElectiveCourses,
    fetchFreeElectiveRound,
    recalculateFreeElectiveRoundScores,
    updateFreeElectiveRoundMetadata,
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

function RoundMetadataModal({
    open,
    round,
    faculties,
    facultyLoading,
    canChangeFaculty,
    saving,
    language,
    labels,
    serverPeriodError,
    onClearServerError,
    onClose,
    onSubmit,
}) {
    const [facultyId, setFacultyId] = useState(String(round?.facultyId || ''));
    const [academicYearBE, setAcademicYearBE] = useState(String(round?.academicYearBE || ''));
    const [semester, setSemester] = useState(String(round?.semester || ''));
    const [fieldErrors, setFieldErrors] = useState({});

    const selectedFaculty = faculties.find(
        (faculty) => String(faculty.facultyId) === facultyId,
    );
    const selectedFacultyName = language === 'en'
        ? selectedFaculty?.nameEn || selectedFaculty?.nameTh
        : selectedFaculty?.nameTh || selectedFaculty?.nameEn;
    const currentFacultyName = getFacultyName(round, language);

    const handleSubmit = (event) => {
        event.preventDefault();
        const nextErrors = {};
        if (canChangeFaculty && !facultyId) {
            nextErrors.faculty = labels.selectFaculty;
        }
        if (!academicYearBE || Number(academicYearBE) < 1) {
            nextErrors.academicYearBE = labels.roundAcademicYearRequired;
        }
        if (![1, 2, 3].includes(Number(semester))) {
            nextErrors.semester = labels.roundSemesterRequired;
        }
        setFieldErrors(nextErrors);
        if (Object.keys(nextErrors).length) {
            return;
        }

        onSubmit({
            facultyId: canChangeFaculty ? facultyId : String(round.facultyId),
            academicYearBE,
            semester,
        });
    };

    const handlePeriodChange = (setter) => (event) => {
        setter(event.target.value);
        if (serverPeriodError) {
            onClearServerError();
        }
    };

    return (
        <BaseModal
            open={open}
            title={labels.editRoundMetadataTitle}
            icon={<Pencil size={18} />}
            size="md"
            onClose={onClose}
            closeDisabled={saving}
        >
            <form
                className="free-elective-round-duplicate-form"
                onSubmit={handleSubmit}
            >
                <label className="free-elective-field">
                    <span>{labels.faculty} *</span>
                    <select
                        value={facultyId}
                        onChange={(event) => {
                            setFacultyId(event.target.value);
                            setFieldErrors((current) => ({ ...current, faculty: '' }));
                        }}
                        disabled={!canChangeFaculty || facultyLoading || saving}
                        aria-invalid={Boolean(fieldErrors.faculty)}
                        aria-describedby={fieldErrors.faculty
                            ? 'free-elective-round-metadata-faculty-error'
                            : undefined}
                    >
                        {facultyLoading && <option value="">{labels.loading}</option>}
                        {!facultyLoading && !canChangeFaculty && (
                            <option value={round?.facultyId}>{currentFacultyName}</option>
                        )}
                        {!facultyLoading && canChangeFaculty && (
                            <>
                                <option value="">{labels.selectFaculty}</option>
                                {faculties.map((faculty) => {
                                    const name = language === 'en'
                                        ? faculty.nameEn || faculty.nameTh
                                        : faculty.nameTh || faculty.nameEn;
                                    return (
                                        <option
                                            key={faculty.facultyId}
                                            value={faculty.facultyId}
                                        >
                                            {name}
                                        </option>
                                    );
                                })}
                            </>
                        )}
                    </select>
                    {!canChangeFaculty && (
                        <small className="free-elective-field__hint">
                            {labels.roundFacultyLockedHint}
                        </small>
                    )}
                    {fieldErrors.faculty && (
                        <small
                            className="free-elective-field__error"
                            id="free-elective-round-metadata-faculty-error"
                        >
                            {fieldErrors.faculty}
                        </small>
                    )}
                    {canChangeFaculty && selectedFacultyName && (
                        <span className="free-elective-field__hint">
                            <Building2 size={13} aria-hidden="true" />
                            {selectedFacultyName}
                        </span>
                    )}
                </label>
                <label className="free-elective-field">
                    <span>{labels.academicYear} *</span>
                    <input
                        type="number"
                        min="1"
                        value={academicYearBE}
                        onChange={handlePeriodChange(setAcademicYearBE)}
                        disabled={saving}
                        aria-invalid={Boolean(fieldErrors.academicYearBE)}
                        aria-describedby={fieldErrors.academicYearBE
                            ? 'free-elective-round-metadata-year-error'
                            : undefined}
                        required
                    />
                    {fieldErrors.academicYearBE && (
                        <small
                            className="free-elective-field__error"
                            id="free-elective-round-metadata-year-error"
                        >
                            {fieldErrors.academicYearBE}
                        </small>
                    )}
                </label>
                <label className="free-elective-field">
                    <span>{labels.semester} *</span>
                    <select
                        value={semester}
                        onChange={handlePeriodChange(setSemester)}
                        disabled={saving}
                        aria-invalid={Boolean(fieldErrors.semester || serverPeriodError)}
                        aria-describedby={fieldErrors.semester || serverPeriodError
                            ? 'free-elective-round-metadata-semester-error'
                            : undefined}
                    >
                        <option value="">{labels.roundSemesterRequired}</option>
                        <option value="1">{labels.semesterOne}</option>
                        <option value="2">{labels.semesterTwo}</option>
                        <option value="3">{labels.semesterThree}</option>
                    </select>
                    {(fieldErrors.semester || serverPeriodError) && (
                        <small
                            className="free-elective-field__error"
                            id="free-elective-round-metadata-semester-error"
                        >
                            {fieldErrors.semester || serverPeriodError}
                        </small>
                    )}
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
                        disabled={saving || facultyLoading || !academicYearBE || !semester}
                    >
                        <Check size={15} aria-hidden="true" />
                        {saving ? labels.loading : labels.save}
                    </button>
                </div>
            </form>
        </BaseModal>
    );
}

function FreeElectiveRoundDetailPageContent() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const { user, loading: authLoading } = useAuth();
    const { language } = useLanguage();
    const labels = useMemo(() => buildFreeElectiveLabels(language), [language]);
    const roundId = params?.roundId;
    const editRequested = searchParams.get('edit') === '1';

    const [roundDetail, setRoundDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [statusAction, setStatusAction] = useState('');
    const [recalculateOpen, setRecalculateOpen] = useState(false);
    const [metadataOpen, setMetadataOpen] = useState(false);
    const [metadataFormKey, setMetadataFormKey] = useState(0);
    const [periodImpactOpen, setPeriodImpactOpen] = useState(false);
    const [pendingMetadata, setPendingMetadata] = useState(null);
    const [faculties, setFaculties] = useState([]);
    const [facultyLoading, setFacultyLoading] = useState(false);
    const [metadataPeriodError, setMetadataPeriodError] = useState('');
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
    const isAdmin = user?.roles?.includes('admin') || false;
    const editMode = round?.status === 'draft'
        || (round?.status === 'active' && editRequested);
    const canEdit = editMode;
    const canRecalculate = round?.status === 'draft' || round?.status === 'active';
    const activeReadOnly = round?.status === 'active' && !editMode;
    const canRevertToDraft = round?.status === 'active'
        && round.learnerCount === 0
        && round.gradeCount === 0;
    const canChangeFaculty = isAdmin
        && round?.status === 'draft'
        && round.courseCount === 0
        && round.learnerCount === 0
        && round.gradeCount === 0;

    const setEditMode = (enabled) => {
        const path = `/free-elective-management/rounds/${roundId}`;
        router.replace(enabled ? `${path}?edit=1` : path, { scroll: false });
    };

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

    const openMetadataEditor = async () => {
        setMetadataFormKey((current) => current + 1);
        setMetadataPeriodError('');
        setMetadataOpen(true);
        if (!canChangeFaculty || facultyLoading) {
            return;
        }
        setFacultyLoading(true);
        try {
            setFaculties(await fetchFaculties());
        } catch (facultyError) {
            setError(facultyError.message || labels.loadError);
        } finally {
            setFacultyLoading(false);
        }
    };

    const saveRoundMetadata = async (form) => {
        if (!form) {
            return;
        }
        setSaving(true);
        setError('');
        try {
            await updateFreeElectiveRoundMetadata(roundId, form);
            setMetadataOpen(false);
            setPeriodImpactOpen(false);
            setPendingMetadata(null);
            setSuccess(labels.roundMetadataSaved);
            await loadData();
        } catch (saveError) {
            if (saveError.code === 'ROUND_ALREADY_EXISTS') {
                setMetadataPeriodError(labels.roundPeriodAlreadyExists);
                setPeriodImpactOpen(false);
                setMetadataOpen(true);
            } else if (saveError.code === 'ROUND_FACULTY_CHANGE_REQUIRES_EMPTY') {
                setError(labels.roundFacultyLockedHint);
                setMetadataOpen(true);
            } else {
                setError(saveError.message || labels.roundMetadataSaveError);
                setMetadataOpen(true);
            }
            setPendingMetadata(null);
        } finally {
            setSaving(false);
        }
    };

    const handleMetadataSubmit = (form) => {
        const periodChanged = Number(form.academicYearBE) !== round.academicYearBE
            || Number(form.semester) !== round.semester;
        if (periodChanged && round.gradeCount > 0) {
            setPendingMetadata(form);
            setMetadataOpen(false);
            setPeriodImpactOpen(true);
            return;
        }
        saveRoundMetadata(form);
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
        const nextStatus = statusAction === 'open'
            ? 'active'
            : statusAction === 'cancel'
                ? 'cancelled'
                : 'draft';
        setSaving(true);
        setError('');
        try {
            await updateFreeElectiveRoundStatus(roundId, nextStatus);
            setStatusAction('');
            setSuccess(
                statusAction === 'open'
                    ? labels.openRound
                    : statusAction === 'cancel'
                        ? labels.cancelRound
                        : labels.revertToDraft,
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

    const statusMessage = statusAction === 'revert-draft'
        ? {
            title: labels.revertToDraftTitle,
            message: labels.revertToDraftMessage,
            confirm: labels.confirmRevertToDraft,
        }
        : statusAction === 'open'
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
                    {round.status === 'active' && !editMode && (
                        <button
                            type="button"
                            className="free-elective-button free-elective-button--primary"
                            onClick={() => setEditMode(true)}
                            disabled={saving || loading}
                            title={labels.enterEditMode}
                        >
                            <Pencil size={16} aria-hidden="true" />
                            {labels.enterEditMode}
                        </button>
                    )}
                    {canRevertToDraft && !editMode && (
                        <button
                            type="button"
                            className="free-elective-button free-elective-button--secondary"
                            onClick={() => setStatusAction('revert-draft')}
                            disabled={saving || loading}
                            title={labels.revertToDraft}
                        >
                            <RotateCcw size={16} aria-hidden="true" />
                            {labels.revertToDraft}
                        </button>
                    )}
                    {round.status === 'active' && editMode && (
                        <button
                            type="button"
                            className="free-elective-button free-elective-button--secondary"
                            onClick={() => setEditMode(false)}
                            disabled={saving || loading}
                            title={labels.finishEditMode}
                        >
                            <Check size={16} aria-hidden="true" />
                            {labels.finishEditMode}
                        </button>
                    )}
                    {canEdit && (
                        <button
                            type="button"
                            className="free-elective-button free-elective-button--secondary"
                            onClick={openMetadataEditor}
                            disabled={saving || facultyLoading}
                            title={labels.editRoundMetadata}
                        >
                            <CalendarDays size={16} aria-hidden="true" />
                            {labels.editRoundMetadata}
                        </button>
                    )}
                    {round.scoresRecalculationRequired && canRecalculate && (
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

            {activeReadOnly && (
                <div className="free-elective-notice" role="status">
                    <span>{labels.activeEditModeHint}</span>
                </div>
            )}
            {!activeReadOnly && !canEdit && (
                <div className="free-elective-notice" role="status">
                    <span>{labels.roundNotEditable}</span>
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
                                        `/free-elective-management/rounds/${roundId}/courses/${roundCourseIdValue}${editMode ? '?edit=1' : ''}`,
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
            <RoundMetadataModal
                key={`round-metadata-${metadataFormKey}`}
                open={metadataOpen}
                round={round}
                faculties={faculties}
                facultyLoading={facultyLoading}
                canChangeFaculty={canChangeFaculty}
                saving={saving}
                language={language}
                labels={labels}
                serverPeriodError={metadataPeriodError}
                onClearServerError={() => setMetadataPeriodError('')}
                onClose={() => setMetadataOpen(false)}
                onSubmit={handleMetadataSubmit}
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
                open={periodImpactOpen}
                title={labels.roundPeriodImpactTitle}
                message={labels.roundPeriodImpactMessage}
                impact={(
                    <div>
                        <strong>
                            {labels.roundPeriodImpactCount}: {round.gradeCount}
                        </strong>
                        <p>
                            {formatFreeElectiveTerm(
                                round.academicYearBE,
                                round.semester,
                                language,
                            )}
                            {' -> '}
                            {formatFreeElectiveTerm(
                                pendingMetadata?.academicYearBE,
                                pendingMetadata?.semester,
                                language,
                            )}
                        </p>
                    </div>
                )}
                variant="info"
                size="md"
                loading={saving}
                confirmLabel={labels.save}
                cancelLabel={labels.cancel}
                onConfirm={() => saveRoundMetadata(pendingMetadata)}
                onCancel={() => {
                    setPeriodImpactOpen(false);
                    setMetadataOpen(true);
                }}
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
