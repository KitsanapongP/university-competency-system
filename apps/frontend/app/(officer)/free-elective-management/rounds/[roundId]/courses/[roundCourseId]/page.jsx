'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import {
    ArrowLeft,
    BookOpen,
    Check,
    Pencil,
    RefreshCw,
    Search,
    Trash2,
    Users,
    X,
} from 'lucide-react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../../../../../providers/auth-provider';
import { useLanguage } from '../../../../../../../providers/LanguageContext';
import { fetchCompetenciesForManagement } from '../../../../../../../lib/competency-management';
import {
    addAllFreeElectiveRoundCourseLearners,
    addFreeElectiveRoundCourseEnrollments,
    deleteFreeElectiveRoundCourse,
    deleteFreeElectiveRoundCourseEnrollment,
    deleteFreeElectiveRoundCourseEnrollments,
    fetchFreeElectiveRound,
    fetchFreeElectiveRoundCourse,
    recalculateFreeElectiveRoundScores,
    upsertFreeElectiveRoundCourseGrade,
    replaceFreeElectiveRoundCourseCompetencies,
} from '../../../../../../../lib/free-elective';
import ConfirmActionModal from '../../../../../../../components/ui/ConfirmActionModal';
import ToastNotifications from '../../../../../../../components/ui/ToastNotifications';
import FreeElectiveCompetencyMapping from '../../../../components/FreeElectiveCompetencyMapping';
import FreeElectiveRoundEnrollmentTable from '../../../../components/FreeElectiveRoundEnrollmentTable';
import FreeElectiveRoundLearnerPickerModal from '../../../../components/FreeElectiveRoundLearnerPickerModal';
import FreeElectiveStatusBadge from '../../../../components/FreeElectiveStatusBadge';
import {
    buildFreeElectiveLabels,
    formatFreeElectiveTerm,
    formatFreeElectiveBulkDeleteMessage,
    formatFreeElectiveBulkDeleteSuccess,
    formatFreeElectiveLearnerDeleteMessage,
    localizedFreeElective,
} from '../../../../free-elective-labels';
import '../../../../../curriculum-management/CourseLayout.css';
import '../../../../FreeElectiveManagement.css';

const EMPTY_ENROLLMENTS = [];

function errorMessage(error, fallback) {
    return error?.message || fallback;
}

function getCourseName(course, language) {
    return language === 'en'
        ? course.courseNameEn || course.courseNameTh
        : course.courseNameTh;
}

function getFacultyName(round, language) {
    return language === 'en'
        ? round.facultyNameEn || round.facultyNameTh
        : round.facultyNameTh;
}

function gradeSchemeLabel(course, labels) {
    return course.gradeScheme === 'satisfactory'
        ? labels.satisfactoryGrades
        : labels.letterGrades;
}

function FreeElectiveRoundCoursePageContent() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const { user, loading: authLoading } = useAuth();
    const { language } = useLanguage();
    const labels = useMemo(() => buildFreeElectiveLabels(language), [language]);
    const roundId = params?.roundId;
    const roundCourseId = params?.roundCourseId;
    const editRequested = searchParams.get('edit') === '1';

    const [round, setRound] = useState(null);
    const [courseDetail, setCourseDetail] = useState(null);
    const [masterCompetencies, setMasterCompetencies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savingGradeId, setSavingGradeId] = useState(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [pickerOpen, setPickerOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleteLearnerTarget, setDeleteLearnerTarget] = useState(null);
    const [learnerSearch, setLearnerSearch] = useState('');
    const [selectedEnrollmentIds, setSelectedEnrollmentIds] = useState(new Set());
    const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
    const [recalculateOpen, setRecalculateOpen] = useState(false);

    const refreshMasterCompetencies = useCallback(async () => {
        const nextCompetencies = await fetchCompetenciesForManagement();
        const activeCompetencies = nextCompetencies.filter((item) => item.isActive);
        setMasterCompetencies(activeCompetencies);
        return activeCompetencies;
    }, []);

    const loadData = useCallback(async () => {
        if (!user || !roundId || !roundCourseId) {
            return;
        }
        setLoading(true);
        setError('');
        try {
            const [nextRound, nextCourseDetail, nextCompetencies] = await Promise.all([
                fetchFreeElectiveRound(roundId),
                fetchFreeElectiveRoundCourse(roundId, roundCourseId),
                fetchCompetenciesForManagement(),
            ]);
            setRound(nextRound?.round || null);
            setCourseDetail(nextCourseDetail);
            setMasterCompetencies(nextCompetencies.filter((item) => item.isActive));
        } catch (loadError) {
            setError(errorMessage(loadError, labels.roundLoadError));
        } finally {
            setLoading(false);
        }
    }, [labels.roundLoadError, roundCourseId, roundId, user]);

    useEffect(() => {
        if (!authLoading && user) {
            loadData();
        }
    }, [authLoading, loadData, user]);

    const course = courseDetail?.course;
    const enrollments = courseDetail?.enrollments ?? EMPTY_ENROLLMENTS;
    const editMode = round?.status === 'draft'
        || (round?.status === 'active' && editRequested);
    const canEdit = editMode;
    const canRecalculate = round?.status === 'draft' || round?.status === 'active';
    const canDelete = round?.status === 'draft' && enrollments.length === 0;

    const setEditMode = (enabled) => {
        const path = `/free-elective-management/rounds/${roundId}/courses/${roundCourseId}`;
        router.replace(enabled ? `${path}?edit=1` : path, { scroll: false });
    };
    const enrolledIds = useMemo(
        () => new Set(enrollments.map((enrollment) => String(enrollment.enrollmentId))),
        [enrollments],
    );
    const filteredEnrollments = useMemo(() => {
        const query = learnerSearch.trim().toLocaleLowerCase();
        if (!query) {
            return enrollments;
        }
        return enrollments.filter((enrollment) => [
            enrollment.studentCode,
            localizedFreeElective(enrollment, language, 'studentNameTh', 'studentNameEn'),
            localizedFreeElective(enrollment, language, 'curriculumNameTh', 'curriculumNameEn'),
            localizedFreeElective(enrollment, language, 'majorNameTh', 'majorNameEn'),
            localizedFreeElective(enrollment, language, 'facultyNameTh', 'facultyNameEn'),
            enrollment.entryYearBE,
        ].some((value) => String(value || '').toLocaleLowerCase().includes(query)));
    }, [enrollments, language, learnerSearch]);
    const visibleEnrollmentIds = useMemo(
        () => filteredEnrollments.map((enrollment) => String(enrollment.id)),
        [filteredEnrollments],
    );
    const allVisibleSelected = visibleEnrollmentIds.length > 0
        && visibleEnrollmentIds.every((id) => selectedEnrollmentIds.has(id));
    const someVisibleSelected = visibleEnrollmentIds.some((id) => selectedEnrollmentIds.has(id));

    useEffect(() => {
        const activeIds = new Set(enrollments.map((enrollment) => String(enrollment.id)));
        setSelectedEnrollmentIds((current) => {
            const next = new Set(
                Array.from(current).filter((id) => activeIds.has(id)),
            );
            return next.size === current.size ? current : next;
        });
    }, [enrollments]);

    const handleSaveMappings = async (rows) => {
        if (!rows.length || rows.some((row) => !row.competencyId)) {
            setError(labels.noSelectedCompetencies);
            return;
        }
        setSaving(true);
        setError('');
        try {
            const nextDetail = await replaceFreeElectiveRoundCourseCompetencies(
                roundId,
                roundCourseId,
                rows,
            );
            setCourseDetail(nextDetail);
            setSuccess(labels.roundCourseSaved);
        } catch (saveError) {
            setError(errorMessage(saveError, labels.loadError));
        } finally {
            setSaving(false);
        }
    };

    const handleSaveGrade = async (enrollment, grade) => {
        setSavingGradeId(enrollment.id);
        setError('');
        try {
            const nextEnrollments = await upsertFreeElectiveRoundCourseGrade(
                roundId,
                roundCourseId,
                enrollment.roundCourseEnrollmentId,
                { grade, gradeSource: 'manual' },
            );
            setCourseDetail((current) => ({
                ...current,
                enrollments: nextEnrollments,
            }));
            setSuccess(labels.gradeSaved);
            return true;
        } catch (gradeError) {
            setError(errorMessage(gradeError, labels.loadError));
            return false;
        } finally {
            setSavingGradeId(null);
        }
    };

    const handleAddLearners = async (learners) => {
        setSaving(true);
        setError('');
        try {
            const nextEnrollments = await addFreeElectiveRoundCourseEnrollments(
                roundId,
                roundCourseId,
                learners,
            );
            setCourseDetail((current) => ({
                ...current,
                enrollments: nextEnrollments,
            }));
            setPickerOpen(false);
            setSuccess(labels.learnerAdded);
        } catch (enrollmentError) {
            setError(errorMessage(enrollmentError, labels.loadError));
        } finally {
            setSaving(false);
        }
    };

    const handleAddAllLearners = async (filters) => {
        setSaving(true);
        setError('');
        try {
            const nextEnrollments = await addAllFreeElectiveRoundCourseLearners(
                roundId,
                roundCourseId,
                filters,
            );
            setCourseDetail((current) => ({
                ...current,
                enrollments: nextEnrollments,
            }));
            setPickerOpen(false);
            setSuccess(labels.learnerAdded);
        } catch (enrollmentError) {
            setError(errorMessage(enrollmentError, labels.loadError));
        } finally {
            setSaving(false);
        }
    };

    const confirmDeleteLearner = async () => {
        if (!deleteLearnerTarget) {
            return;
        }
        setSaving(true);
        setError('');
        try {
            await deleteFreeElectiveRoundCourseEnrollment(
                roundId,
                roundCourseId,
                deleteLearnerTarget.roundCourseEnrollmentId,
            );
            const nextDetail = await fetchFreeElectiveRoundCourse(roundId, roundCourseId);
            setCourseDetail(nextDetail);
            setDeleteLearnerTarget(null);
            setSuccess(labels.learnerDeleted);
        } catch (deleteError) {
            setError(errorMessage(deleteError, labels.loadError));
        } finally {
            setSaving(false);
        }
    };

    const toggleEnrollmentSelection = (enrollment) => {
        const id = String(enrollment.id);
        setSelectedEnrollmentIds((current) => {
            const next = new Set(current);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const toggleSelectAllVisible = () => {
        setSelectedEnrollmentIds((current) => {
            const next = new Set(current);
            if (allVisibleSelected) {
                visibleEnrollmentIds.forEach((id) => next.delete(id));
            } else {
                visibleEnrollmentIds.forEach((id) => next.add(id));
            }
            return next;
        });
    };

    const clearEnrollmentSelection = () => setSelectedEnrollmentIds(new Set());

    const confirmBulkDeleteLearners = async () => {
        const enrollmentIds = Array.from(selectedEnrollmentIds).map(Number);
        if (!enrollmentIds.length) {
            return;
        }
        setSaving(true);
        setError('');
        try {
            await deleteFreeElectiveRoundCourseEnrollments(
                roundId,
                roundCourseId,
                enrollmentIds,
            );
            const nextDetail = await fetchFreeElectiveRoundCourse(roundId, roundCourseId);
            setCourseDetail(nextDetail);
            clearEnrollmentSelection();
            setBulkDeleteOpen(false);
            setSuccess(formatFreeElectiveBulkDeleteSuccess(language, enrollmentIds.length));
        } catch (deleteError) {
            setError(errorMessage(deleteError, labels.loadError));
        } finally {
            setSaving(false);
        }
    };

    const confirmDelete = async () => {
        setSaving(true);
        setError('');
        try {
            await deleteFreeElectiveRoundCourse(roundId, roundCourseId);
            setDeleteOpen(false);
            setSuccess(labels.deleteRoundCourseSuccess);
            router.push(`/free-elective-management/rounds/${roundId}`);
        } catch (deleteError) {
            setError(errorMessage(deleteError, labels.loadError));
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
            setError(errorMessage(recalculateError, labels.loadError));
        } finally {
            setSaving(false);
        }
    };

    if (loading && !course) {
        return (
            <div className="free-elective-loading" role="status">
                {labels.loading}
            </div>
        );
    }

    if (!course || !round) {
        return (
            <div className="free-elective-empty">
                {labels.roundLoadError}
            </div>
        );
    }

    return (
        <div className="free-elective-page officer-page ui-page">
            <button
                type="button"
                className="free-elective-back-button"
                onClick={() => router.push(
                    `/free-elective-management/rounds/${roundId}${editMode ? '?edit=1' : ''}`,
                )}
            >
                <ArrowLeft size={16} aria-hidden="true" />
                {labels.backToRound}
            </button>

            <header className="free-elective-page__header officer-page__header ui-page__header">
                <div>
                    <p className="free-elective-page__eyebrow free-elective-eyebrow">
                        <BookOpen size={15} aria-hidden="true" />
                        {labels.roundCourseDetail}
                    </p>
                    <h1 className="free-elective-page__title officer-page__title">
                        {course.courseCode}
                        {' | '}
                        {getCourseName(course, language)}
                    </h1>
                    <p className="free-elective-page__subtitle officer-page__subtitle">
                        {formatFreeElectiveTerm(
                            round.academicYearBE,
                            round.semester,
                            language,
                        )}
                        {' | '}
                        {getFacultyName(round, language)}
                    </p>
                    <div className="free-elective-summary-chips">
                        <span>{labels.credits}: {course.credits}</span>
                        <span>
                            {labels.gradeScheme}: {gradeSchemeLabel(course, labels)}
                        </span>
                        <span>
                            <Users size={14} aria-hidden="true" />
                            {enrollments.length} {labels.courseLearnerCount}
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
                            title={labels.enterCourseEditMode}
                        >
                            <Pencil size={16} aria-hidden="true" />
                            {labels.enterCourseEditMode}
                        </button>
                    )}
                    {round.status === 'active' && editMode && (
                        <button
                            type="button"
                            className="free-elective-button free-elective-button--secondary"
                            onClick={() => setEditMode(false)}
                            disabled={saving || loading}
                            title={labels.finishCourseEditMode}
                        >
                            <Check size={16} aria-hidden="true" />
                            {labels.finishCourseEditMode}
                        </button>
                    )}
                    {canDelete && (
                        <button
                            type="button"
                            className="free-elective-button free-elective-button--danger"
                            onClick={() => setDeleteOpen(true)}
                            disabled={saving}
                        >
                            <Trash2 size={16} aria-hidden="true" />
                            {labels.deleteRoundCourse}
                        </button>
                    )}
                </div>
            </header>

            {round.scoresRecalculationRequired && (
                <div className="free-elective-notice free-elective-notice--warning" role="status">
                    <RefreshCw size={16} aria-hidden="true" />
                    <span>{labels.roundScoreRecalculation}</span>
                    {canRecalculate && (
                        <button
                            type="button"
                            className="free-elective-button free-elective-button--primary free-elective-notice__action"
                            onClick={() => setRecalculateOpen(true)}
                            disabled={saving || loading}
                        >
                            <RefreshCw size={15} aria-hidden="true" />
                            {labels.recalculateRoundScores}
                        </button>
                    )}
                </div>
            )}

            {round.status === 'active' && !editMode && (
                <div className="free-elective-notice" role="status">
                    <span>{labels.courseEditModeHint}</span>
                </div>
            )}
            {round.status !== 'draft' && round.status !== 'active' && (
                <div className="free-elective-notice" role="status">
                    <span>{labels.roundNotEditable}</span>
                </div>
            )}

            <FreeElectiveCompetencyMapping
                competencies={course.competencies}
                masterCompetencies={masterCompetencies}
                canEdit={canEdit}
                saving={saving}
                language={language}
                labels={labels}
                onSave={handleSaveMappings}
                onRefreshMasterCompetencies={refreshMasterCompetencies}
            />

            <section className="free-elective-panel">
                <div className="free-elective-panel__heading">
                    <div>
                        <p className="free-elective-eyebrow">{labels.learnerList}</p>
                        <p>{enrollments.length} {labels.courseLearnerCount}</p>
                    </div>
                    {canEdit && (
                        <button
                            type="button"
                            className="free-elective-button free-elective-button--primary"
                            onClick={() => setPickerOpen(true)}
                            disabled={saving}
                        >
                            <Users size={16} aria-hidden="true" />
                            {labels.chooseLearners}
                        </button>
                    )}
                </div>
                <div className="free-elective-round-enrollment-toolbar">
                    <label className="free-elective-round-enrollment-search">
                        <Search size={16} aria-hidden="true" />
                        <input
                            type="search"
                            value={learnerSearch}
                            onChange={(event) => setLearnerSearch(event.target.value)}
                            placeholder={labels.searchRoundLearners}
                            aria-label={labels.searchRoundLearners}
                            disabled={saving}
                        />
                    </label>
                    <span className="free-elective-round-enrollment-count">
                        {filteredEnrollments.length} / {enrollments.length} {labels.courseLearnerCount}
                    </span>
                </div>
                {selectedEnrollmentIds.size > 0 && (
                    <div className="free-elective-selection-toolbar" role="status">
                        <span className="free-elective-selection-toolbar__summary">
                            {labels.selectedLearners}: <strong>{selectedEnrollmentIds.size}</strong>
                        </span>
                        <div className="free-elective-selection-toolbar__actions">
                            <button
                                type="button"
                                className="free-elective-button free-elective-button--quiet"
                                onClick={clearEnrollmentSelection}
                                disabled={saving}
                            >
                                <X size={15} aria-hidden="true" />
                                {labels.clearSelection}
                            </button>
                            <button
                                type="button"
                                className="free-elective-button free-elective-button--danger"
                                onClick={() => setBulkDeleteOpen(true)}
                                disabled={saving}
                            >
                                <Trash2 size={15} aria-hidden="true" />
                                {labels.deleteSelectedLearners} ({selectedEnrollmentIds.size})
                            </button>
                        </div>
                    </div>
                )}
                <FreeElectiveRoundEnrollmentTable
                    enrollments={filteredEnrollments}
                    gradeScheme={course.gradeScheme}
                    allowedGrades={courseDetail.allowedGrades}
                    canEdit={canEdit}
                    saving={saving}
                    savingId={savingGradeId}
                    language={language}
                    labels={labels}
                    onSaveGrade={handleSaveGrade}
                    onDelete={setDeleteLearnerTarget}
                    selectedIds={selectedEnrollmentIds}
                    allVisibleSelected={allVisibleSelected}
                    someVisibleSelected={someVisibleSelected}
                    onToggleSelection={toggleEnrollmentSelection}
                    onToggleSelectAll={toggleSelectAllVisible}
                    emptyLabel={enrollments.length ? labels.noLearners : labels.noRoundLearners}
                />
            </section>

            <FreeElectiveRoundLearnerPickerModal
                open={pickerOpen}
                roundId={roundId}
                roundCourseId={roundCourseId}
                enrolledIds={enrolledIds}
                saving={saving}
                language={language}
                labels={labels}
                isAdmin={Boolean(user?.roles?.includes('admin'))}
                lockedFacultyId={round.facultyId}
                lockedFacultyName={getFacultyName(round, language)}
                onClose={() => setPickerOpen(false)}
                onSubmit={handleAddLearners}
                onSubmitAll={handleAddAllLearners}
            />
            <ConfirmActionModal
                open={deleteOpen}
                title={labels.deleteRoundCourseTitle}
                message={labels.deleteRoundCourseMessage}
                hint={labels.deleteRoundCourseHint}
                variant="danger"
                size="md"
                loading={saving}
                confirmLabel={labels.deleteRoundCourse}
                cancelLabel={labels.cancel}
                onConfirm={confirmDelete}
                onCancel={() => setDeleteOpen(false)}
            />
            <ConfirmActionModal
                open={Boolean(deleteLearnerTarget)}
                title={labels.confirmDeleteLearner}
                message={formatFreeElectiveLearnerDeleteMessage(
                    language,
                    localizedFreeElective(
                        deleteLearnerTarget,
                        language,
                        'studentNameTh',
                        'studentNameEn',
                    ),
                )}
                variant="danger"
                size="md"
                loading={saving}
                confirmLabel={labels.deleteLearner}
                cancelLabel={labels.cancel}
                onConfirm={confirmDeleteLearner}
                onCancel={() => setDeleteLearnerTarget(null)}
            />
            <ConfirmActionModal
                open={bulkDeleteOpen}
                title={labels.bulkDeleteLearnersTitle}
                message={formatFreeElectiveBulkDeleteMessage(
                    language,
                    selectedEnrollmentIds.size,
                )}
                hint={labels.bulkDeleteLearnersHint}
                variant="danger"
                size="md"
                loading={saving}
                confirmLabel={`${labels.deleteSelectedLearners} (${selectedEnrollmentIds.size})`}
                cancelLabel={labels.cancel}
                onConfirm={confirmBulkDeleteLearners}
                onCancel={() => setBulkDeleteOpen(false)}
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

export default function FreeElectiveRoundCoursePage() {
    return (
        <Suspense
            fallback={(
                <div className="free-elective-loading" role="status">
                    {buildFreeElectiveLabels('th').loading}
                </div>
            )}
        >
            <FreeElectiveRoundCoursePageContent />
        </Suspense>
    );
}
