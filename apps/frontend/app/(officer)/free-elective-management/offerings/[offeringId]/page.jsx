'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import {
    ArrowLeft,
    CalendarCheck,
    CheckCircle2,
    ClipboardList,
    FileSpreadsheet,
    Lock,
    Play,
    RefreshCw,
    Users,
} from 'lucide-react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../../../providers/auth-provider';
import { useLanguage } from '../../../../../providers/LanguageContext';
import {
    fetchCompetenciesForManagement,
} from '../../../../../lib/competency-management';
import {
    addOfferingEnrollments,
    copyPreviousOfferingCompetencies,
    fetchFreeElectiveGroupStudents,
    fetchFreeElectiveOffering,
    fetchFreeElectiveReadiness,
    fetchFreeElectiveStudentGroups,
    fetchOfferingCompetencies,
    fetchOfferingEnrollments,
    finalizeFreeElectiveOffering,
    replaceOfferingCompetencies,
    updateFreeElectiveOfferingStatus,
    upsertOfferingGrade,
    commitFreeElectiveGradeImport,
    previewFreeElectiveGradeImport,
} from '../../../../../lib/free-elective';
import ConfirmActionModal from '../../../../../components/ui/ConfirmActionModal';
import ToastNotifications from '../../../../../components/ui/ToastNotifications';
import FreeElectiveCompetencyMapping from '../../components/FreeElectiveCompetencyMapping';
import FreeElectiveGradeImportModal from '../../components/FreeElectiveGradeImportModal';
import FreeElectiveGradeTable from '../../components/FreeElectiveGradeTable';
import FreeElectiveReadinessPanel from '../../components/FreeElectiveReadinessPanel';
import FreeElectiveStatusBadge from '../../components/FreeElectiveStatusBadge';
import FreeElectiveStudentPickerModal from '../../components/FreeElectiveStudentPickerModal';
import {
    FREE_ELECTIVE_LABELS,
    formatFreeElectiveTerm,
    freeElectiveText,
} from '../../free-elective-labels';
import '../../../curriculum-management/CourseLayout.css';
import '../../FreeElectiveManagement.css';

const TABS = ['overview', 'competencies', 'students'];

function getTab(value) {
    return TABS.includes(value) ? value : 'overview';
}

function errorMessage(error, fallback) {
    return error?.message || fallback;
}

function FreeElectiveOfferingDetailPageContent() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const { user, loading: authLoading } = useAuth();
    const { language } = useLanguage();
    const labels = useMemo(
        () => Object.fromEntries(
            Object.keys(FREE_ELECTIVE_LABELS.th).map((key) => [
                key,
                freeElectiveText(language, key),
            ]),
        ),
        [language],
    );
    const offeringId = params?.offeringId;
    const activeTab = getTab(searchParams.get('tab'));

    const [offering, setOffering] = useState(null);
    const [readiness, setReadiness] = useState(null);
    const [competencies, setCompetencies] = useState([]);
    const [masterCompetencies, setMasterCompetencies] = useState([]);
    const [enrollments, setEnrollments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savingGradeId, setSavingGradeId] = useState(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [pickerOpen, setPickerOpen] = useState(false);
    const [groups, setGroups] = useState([]);
    const [selectedGroupId, setSelectedGroupId] = useState('');
    const [groupStudents, setGroupStudents] = useState([]);
    const [loadingGroupStudents, setLoadingGroupStudents] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const [importPreview, setImportPreview] = useState(null);
    const [finalizeOpen, setFinalizeOpen] = useState(false);

    const loadOffering = useCallback(async () => {
        if (!offeringId || !user) {
            return;
        }

        setLoading(true);
        setError('');
        try {
            const [nextOffering, nextReadiness, nextCompetencies, nextEnrollments, nextMasterCompetencies] = await Promise.all([
                fetchFreeElectiveOffering(offeringId),
                fetchFreeElectiveReadiness(offeringId),
                fetchOfferingCompetencies(offeringId),
                fetchOfferingEnrollments(offeringId),
                fetchCompetenciesForManagement(),
            ]);
            setOffering(nextOffering);
            setReadiness(nextReadiness);
            setCompetencies(nextCompetencies);
            setEnrollments(nextEnrollments);
            setMasterCompetencies(nextMasterCompetencies);
        } catch (loadError) {
            setError(errorMessage(loadError, labels.loadError));
        } finally {
            setLoading(false);
        }
    }, [labels.loadError, offeringId, user]);

    useEffect(() => {
        if (!authLoading && user) {
            loadOffering();
        }
    }, [authLoading, loadOffering, user]);

    const canEdit = offering?.status === 'draft' || offering?.status === 'active';
    const canFinalize = offering?.status === 'active';
    const enrolledIds = useMemo(
        () => new Set(enrollments.map((enrollment) => enrollment.enrollmentId)),
        [enrollments],
    );

    const setTab = (tab) => {
        const nextParams = new URLSearchParams(searchParams.toString());
        if (tab === 'overview') {
            nextParams.delete('tab');
        } else {
            nextParams.set('tab', tab);
        }
        const query = nextParams.toString();
        router.replace(`/free-elective-management/offerings/${offeringId}${query ? `?${query}` : ''}`, { scroll: false });
    };

    const handleSaveMappings = async (rows) => {
        const incomplete = rows.some((row) => !row.competencyId);
        if (incomplete) {
            setError(labels.chooseCompetency);
            return;
        }
        setSaving(true);
        setError('');
        try {
            await replaceOfferingCompetencies(offeringId, rows);
            setSuccess(labels.mappingSaved);
            await loadOffering();
        } catch (saveError) {
            setError(errorMessage(saveError, labels.loadError));
        } finally {
            setSaving(false);
        }
    };

    const handleCopyPrevious = async () => {
        setSaving(true);
        setError('');
        try {
            await copyPreviousOfferingCompetencies(offeringId);
            setSuccess(labels.mappingSaved);
            await loadOffering();
        } catch (copyError) {
            setError(errorMessage(copyError, labels.loadError));
        } finally {
            setSaving(false);
        }
    };

    const handleActivate = async () => {
        setSaving(true);
        setError('');
        try {
            await updateFreeElectiveOfferingStatus(offeringId, 'active');
            setSuccess(labels.active);
            await loadOffering();
        } catch (statusError) {
            setError(errorMessage(statusError, labels.loadError));
        } finally {
            setSaving(false);
        }
    };

    const handleFinalize = async () => {
        setSaving(true);
        setError('');
        try {
            await finalizeFreeElectiveOffering(offeringId);
            setFinalizeOpen(false);
            setSuccess(labels.finalize);
            await loadOffering();
        } catch (finalizeError) {
            setError(errorMessage(finalizeError, labels.loadError));
        } finally {
            setSaving(false);
        }
    };

    const openStudentPicker = async () => {
        setPickerOpen(true);
        setSelectedGroupId('');
        setGroupStudents([]);
        try {
            setGroups(await fetchFreeElectiveStudentGroups());
        } catch (groupError) {
            setError(errorMessage(groupError, labels.loadError));
        }
    };

    const handleGroupChange = async (groupId) => {
        setSelectedGroupId(groupId);
        setGroupStudents([]);
        if (!groupId) {
            return;
        }
        setLoadingGroupStudents(true);
        try {
            setGroupStudents(await fetchFreeElectiveGroupStudents(groupId));
        } catch (studentError) {
            setError(errorMessage(studentError, labels.loadError));
        } finally {
            setLoadingGroupStudents(false);
        }
    };

    const handleAddLearners = async (students) => {
        setSaving(true);
        setError('');
        try {
            await addOfferingEnrollments(offeringId, students);
            setPickerOpen(false);
            setSuccess(labels.enrollSuccess);
            await loadOffering();
        } catch (enrollmentError) {
            setError(errorMessage(enrollmentError, labels.loadError));
        } finally {
            setSaving(false);
        }
    };

    const handleSaveGrade = async (enrollment, grade) => {
        setSavingGradeId(enrollment.id);
        setError('');
        try {
            await upsertOfferingGrade(offeringId, enrollment.id, {
                grade,
                gradeSource: 'manual',
            });
            setSuccess(labels.gradeSaved);
            await loadOffering();
            return true;
        } catch (gradeError) {
            setError(errorMessage(gradeError, labels.loadError));
            return false;
        } finally {
            setSavingGradeId(null);
        }
    };

    const handlePreviewImport = async (rows, replaceExisting) => {
        setSaving(true);
        setError('');
        try {
            setImportPreview(await previewFreeElectiveGradeImport(offeringId, rows, replaceExisting));
        } catch (previewError) {
            setError(errorMessage(previewError, labels.loadError));
        } finally {
            setSaving(false);
        }
    };

    const handleCommitImport = async (rows, replaceExisting) => {
        setSaving(true);
        setError('');
        try {
            await commitFreeElectiveGradeImport(offeringId, rows, replaceExisting);
            setImportOpen(false);
            setImportPreview(null);
            setSuccess(labels.importSuccess);
            await loadOffering();
        } catch (importError) {
            setError(errorMessage(importError, labels.loadError));
        } finally {
            setSaving(false);
        }
    };

    const selectedMessages = language === 'en' ? readiness?.messagesEn : readiness?.messagesTh;

    if (loading && !offering) {
        return (
            <div className="free-elective-loading" role="status">
                {labels.loading}
            </div>
        );
    }

    if (!offering) {
        return (
            <div className="free-elective-empty">
                {labels.loadError}
            </div>
        );
    }

    return (
        <div className="free-elective-page">
            <button
                type="button"
                className="free-elective-back-button"
                onClick={() => router.push('/free-elective-management')}
            >
                <ArrowLeft size={16} aria-hidden="true" />
                {labels.back}
            </button>
            <header className="free-elective-detail-header">
                <div>
                    <p className="free-elective-page__eyebrow">
                        <CalendarCheck size={15} aria-hidden="true" />
                        {labels.offeringDetail}
                    </p>
                    <h1 className="free-elective-page__title">
                        {offering.courseCode} ·{' '}
                        {language === 'en'
                            ? offering.courseNameEn || offering.courseNameTh
                            : offering.courseNameTh}
                    </h1>
                    <p className="free-elective-page__subtitle">
                        {formatFreeElectiveTerm(
                            offering.academicYearBE,
                            offering.semester,
                            language,
                        )} · {labels.section} {offering.sectionNo}
                    </p>
                    <div className="free-elective-summary-chips">
                        <span>
                            {labels.gradeScheme}:{' '}
                            {offering.gradeScheme === 'satisfactory'
                                ? labels.satisfactoryGrades
                                : labels.letterGrades}
                        </span>
                        <span>
                            <Users size={14} aria-hidden="true" />
                            {offering.studentCount} {labels.students}
                        </span>
                        <span>
                            <ClipboardList size={14} aria-hidden="true" />
                            {offering.gradedStudentCount} {labels.graded}
                        </span>
                    </div>
                </div>
                <div className="free-elective-page__actions">
                    <FreeElectiveStatusBadge status={offering.status} language={language} />
                    {offering.status === 'draft' && (
                        <button
                            type="button"
                            className="free-elective-button free-elective-button--secondary"
                            onClick={handleActivate}
                            disabled={saving || !readiness?.competencyMapped}
                        >
                            <Play size={16} aria-hidden="true" />
                            {labels.active}
                        </button>
                    )}
                    {canFinalize && (
                        <button
                            type="button"
                            className="free-elective-button free-elective-button--primary"
                            onClick={() => setFinalizeOpen(true)}
                            disabled={saving || !readiness?.ready}
                        >
                            <Lock size={16} aria-hidden="true" />
                            {labels.finalize}
                        </button>
                    )}
                </div>
            </header>

            {selectedMessages?.length > 0 && (
                <div className="free-elective-notice" role="status">
                    <RefreshCw size={16} aria-hidden="true" />
                    <span>{selectedMessages.join(' ')}</span>
                </div>
            )}

            <nav className="free-elective-view-tabs" aria-label={labels.offeringDetail}>
                <button
                    type="button"
                    className={`free-elective-view-tab ${activeTab === 'overview' ? 'free-elective-view-tab--active' : ''}`}
                    onClick={() => setTab('overview')}
                >
                    {labels.overview}
                </button>
                <button
                    type="button"
                    className={`free-elective-view-tab ${activeTab === 'competencies' ? 'free-elective-view-tab--active' : ''}`}
                    onClick={() => setTab('competencies')}
                >
                    {labels.competencyMapping}
                </button>
                <button
                    type="button"
                    className={`free-elective-view-tab ${activeTab === 'students' ? 'free-elective-view-tab--active' : ''}`}
                    onClick={() => setTab('students')}
                >
                    {labels.studentGrades}
                </button>
            </nav>

            {activeTab === 'overview' && readiness && (
                <div className="free-elective-detail-grid">
                    <FreeElectiveReadinessPanel
                        readiness={readiness}
                        language={language}
                        labels={labels}
                    />
                    <section className="free-elective-panel">
                        <div className="free-elective-panel__heading">
                            <div>
                                <p className="free-elective-eyebrow">{labels.course}</p>
                                <h2>{offering.courseCode}</h2>
                            </div>
                            <CheckCircle2 size={20} color="var(--primary)" aria-hidden="true" />
                        </div>
                        <div className="free-elective-detail-list">
                            <div>
                                <span>{labels.courseName}</span>
                                <strong>
                                    {language === 'en'
                                        ? offering.courseNameEn || offering.courseNameTh
                                        : offering.courseNameTh}
                                </strong>
                            </div>
                            <div>
                                <span>{labels.gradeScheme}</span>
                                <strong>
                                    {offering.gradeScheme === 'satisfactory'
                                        ? labels.satisfactoryGrades
                                        : labels.letterGrades}
                                </strong>
                            </div>
                            <div>
                                <span>{labels.academicYear}</span>
                                <strong>{offering.academicYearBE}</strong>
                            </div>
                            <div>
                                <span>{labels.semester}</span>
                                <strong>{offering.semester}</strong>
                            </div>
                            <div>
                                <span>{labels.capacity}</span>
                                <strong>{offering.capacity ?? labels.unlimited}</strong>
                            </div>
                        </div>
                    </section>
                </div>
            )}

            {activeTab === 'competencies' && (
                <FreeElectiveCompetencyMapping
                    competencies={competencies}
                    masterCompetencies={masterCompetencies}
                    canEdit={canEdit}
                    saving={saving}
                    language={language}
                    labels={labels}
                    onSave={handleSaveMappings}
                    onCopyPrevious={handleCopyPrevious}
                />
            )}

            {activeTab === 'students' && (
                <section className="free-elective-panel">
                    <div className="free-elective-panel__heading">
                        <div>
                            <p className="free-elective-eyebrow">{labels.studentGrades}</p>
                            <p>{enrollments.length} {labels.students}</p>
                        </div>
                        {canEdit && (
                            <div className="free-elective-inline-actions">
                                <button
                                    type="button"
                                    className="free-elective-button free-elective-button--secondary"
                                    onClick={openStudentPicker}
                                    disabled={saving}
                                >
                                    <Users size={16} aria-hidden="true" />
                                    {labels.addLearners}
                                </button>
                                <button
                                    type="button"
                                    className="free-elective-button free-elective-button--secondary"
                                    onClick={() => {
                                        setImportPreview(null);
                                        setImportOpen(true);
                                    }}
                                    disabled={saving || !enrollments.length}
                                >
                                    <FileSpreadsheet size={16} aria-hidden="true" />
                                    {labels.importGrades}
                                </button>
                            </div>
                        )}
                    </div>
                    <FreeElectiveGradeTable
                        enrollments={enrollments}
                        gradeScheme={offering.gradeScheme}
                        canEdit={canEdit}
                        savingId={savingGradeId}
                        language={language}
                        labels={labels}
                        onSaveGrade={handleSaveGrade}
                    />
                </section>
            )}

            <FreeElectiveStudentPickerModal
                key={`${pickerOpen ? 'open' : 'closed'}-${selectedGroupId}`}
                open={pickerOpen}
                groups={groups}
                selectedGroupId={selectedGroupId}
                groupStudents={groupStudents}
                enrolledIds={enrolledIds}
                loadingStudents={loadingGroupStudents}
                saving={saving}
                language={language}
                labels={labels}
                onGroupChange={handleGroupChange}
                onClose={() => setPickerOpen(false)}
                onSubmit={handleAddLearners}
            />
            <FreeElectiveGradeImportModal
                open={importOpen}
                gradeScheme={offering.gradeScheme}
                labels={labels}
                saving={saving}
                preview={importPreview}
                onPreview={handlePreviewImport}
                onCommit={handleCommitImport}
                onClearPreview={() => setImportPreview(null)}
                onClose={() => {
                    setImportOpen(false);
                    setImportPreview(null);
                }}
            />
            <ConfirmActionModal
                open={finalizeOpen}
                title={labels.finalizeTitle}
                message={labels.finalizeMessage}
                variant="warning"
                size="md"
                loading={saving}
                confirmLabel={labels.confirmFinalize}
                cancelLabel={labels.cancel}
                onConfirm={handleFinalize}
                onCancel={() => setFinalizeOpen(false)}
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

export default function FreeElectiveOfferingDetailPage() {
    return (
        <Suspense
            fallback={(
                <div className="free-elective-loading" role="status">
                    {FREE_ELECTIVE_LABELS.th.loading}
                </div>
            )}
        >
            <FreeElectiveOfferingDetailPageContent />
        </Suspense>
    );
}
