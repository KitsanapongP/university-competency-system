'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, Plus, RefreshCw } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../providers/auth-provider';
import { useLanguage } from '../../../providers/LanguageContext';
import { fetchCompetenciesForManagement } from '../../../lib/competency-management';
import { fetchFaculties } from '../../../lib/curriculum';
import {
    createFreeElectiveCourse,
    createFreeElectiveRound,
    fetchFreeElectiveCourses,
    fetchFreeElectiveRounds,
    getFreeElectiveImpactFromError,
    previewFreeElectiveRound,
    updateFreeElectiveCourse,
} from '../../../lib/free-elective';
import ConfirmActionModal from '../../../components/ui/ConfirmActionModal';
import ToastNotifications from '../../../components/ui/ToastNotifications';
import FreeElectiveCourseCard from './components/FreeElectiveCourseCard';
import FreeElectiveCourseModal from './components/FreeElectiveCourseModal';
import FreeElectiveFilters from './components/FreeElectiveFilters';
import FreeElectiveRoundCard from './components/FreeElectiveRoundCard';
import FreeElectiveRoundWizard from './components/FreeElectiveRoundWizard';
import { FREE_ELECTIVE_LABELS, buildFreeElectiveLabels } from './free-elective-labels';
import '../curriculum-management/CourseLayout.css';
import './FreeElectiveManagement.css';

function getDefaultFacultyId(user) {
    return user?.faculty_id || '';
}

function ImpactStat({ label, value }) {
    return (
        <div>
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    );
}

function FreeElectiveManagementPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, loading: authLoading } = useAuth();
    const { language } = useLanguage();
    const labels = useMemo(() => buildFreeElectiveLabels(language), [language]);
    const isAdmin = user?.roles?.includes('admin');
    const accountFacultyId = getDefaultFacultyId(user);
    const selectedFacultyId = isAdmin
        ? searchParams.get('faculty_id') || ''
        : accountFacultyId;
    const selectedYear = searchParams.get('academic_year_be') || '';
    const selectedSemester = searchParams.get('semester') || '';
    const selectedStatus = searchParams.get('status') || '';

    const [faculties, setFaculties] = useState([]);
    const [courses, setCourses] = useState([]);
    const [competencies, setCompetencies] = useState([]);
    const [rounds, setRounds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [catalogLoading, setCatalogLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [courseCatalogOpen, setCourseCatalogOpen] = useState(false);
    const [roundWizardOpen, setRoundWizardOpen] = useState(false);
    const [roundWizardKey, setRoundWizardKey] = useState(0);
    const [courseModalOpen, setCourseModalOpen] = useState(false);
    const [editingCourse, setEditingCourse] = useState(null);
    const [impactConfirmation, setImpactConfirmation] = useState(null);
    const wizardFacultyId = selectedFacultyId || accountFacultyId || faculties[0]?.facultyId || '';

    const loadRounds = useCallback(async () => {
        if (!user) {
            return;
        }

        setLoading(true);
        setError('');
        try {
            const facultyFilter = selectedFacultyId
                ? { facultyId: selectedFacultyId }
                : {};
            const [nextFaculties, nextRounds] = await Promise.all([
                fetchFaculties(),
                fetchFreeElectiveRounds({
                    ...facultyFilter,
                    academicYearBE: selectedYear,
                    semester: selectedSemester,
                    status: selectedStatus,
                }),
            ]);
            setFaculties(nextFaculties);
            setRounds(nextRounds);
        } catch (loadError) {
            setError(loadError.message || labels.roundLoadError);
        } finally {
            setLoading(false);
        }
    }, [
        labels.roundLoadError,
        selectedFacultyId,
        selectedSemester,
        selectedStatus,
        selectedYear,
        user,
    ]);

    const loadCourseCatalog = useCallback(async (force = false) => {
        if (!user || (!force && courses.length > 0) || catalogLoading) {
            return;
        }
        setCatalogLoading(true);
        try {
            const facultyFilter = selectedFacultyId
                ? { facultyId: selectedFacultyId }
                : {};
            const [nextCourses, nextCompetencies] = await Promise.all([
                fetchFreeElectiveCourses(facultyFilter),
                fetchCompetenciesForManagement(),
            ]);
            setCourses(nextCourses);
            setCompetencies(nextCompetencies);
        } catch (loadError) {
            setError(loadError.message || labels.loadError);
        } finally {
            setCatalogLoading(false);
        }
    }, [catalogLoading, courses.length, labels.loadError, selectedFacultyId, user]);

    useEffect(() => {
        if (!authLoading && user) {
            loadRounds();
        }
    }, [authLoading, loadRounds, user]);

    useEffect(() => {
        if (roundWizardOpen || courseCatalogOpen) {
            loadCourseCatalog();
        }
    }, [courseCatalogOpen, loadCourseCatalog, roundWizardOpen]);

    const availableYears = useMemo(() => (
        Array.from(
            new Set(rounds.map((round) => round.academicYearBE).filter(Boolean)),
        ).sort((left, right) => right - left)
    ), [rounds]);

    const setQueryValue = (key, value) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value === undefined || value === null || value === '') {
            params.delete(key);
        } else {
            params.set(key, String(value));
        }
        const query = params.toString();
        router.replace(`/free-elective-management${query ? `?${query}` : ''}`, {
            scroll: false,
        });
    };

    const handleFilterChange = (key, value) => {
        const queryKey = {
            facultyId: 'faculty_id',
            academicYearBE: 'academic_year_be',
            semester: 'semester',
            status: 'status',
        }[key];
        setQueryValue(queryKey, value);
    };

    const openCourseCatalog = () => {
        setCourseCatalogOpen((current) => !current);
    };

    const openCreateCourse = () => {
        setEditingCourse(null);
        setCourseModalOpen(true);
    };

    const openRoundWizard = () => {
        setRoundWizardKey((current) => current + 1);
        setRoundWizardOpen(true);
    };

    const openEditCourse = (course) => {
        setEditingCourse(course);
        setCourseModalOpen(true);
    };

    const handleCourseSubmit = async (form) => {
        setSaving(true);
        setError('');
        try {
            if (editingCourse) {
                await updateFreeElectiveCourse(editingCourse.id, form);
                setSuccess(labels.saveSuccess);
            } else {
                await createFreeElectiveCourse(form);
                setSuccess(labels.courseCreated);
            }
            setCourseModalOpen(false);
            setEditingCourse(null);
            setCourses([]);
            await loadCourseCatalog(true);
        } catch (saveError) {
            const impact = getFreeElectiveImpactFromError(saveError);
            if (saveError.code === 'GRADE_SCHEME_CHANGE_REQUIRES_CONFIRMATION' && impact) {
                setImpactConfirmation({ form, impact });
            } else {
                setError(saveError.message || labels.loadError);
            }
        } finally {
            setSaving(false);
        }
    };

    const confirmCourseSchemeChange = async () => {
        if (!editingCourse || !impactConfirmation) {
            return;
        }

        setSaving(true);
        setError('');
        try {
            await updateFreeElectiveCourse(
                editingCourse.id,
                impactConfirmation.form,
                true,
            );
            setImpactConfirmation(null);
            setCourseModalOpen(false);
            setEditingCourse(null);
            setSuccess(labels.saveSuccess);
            setCourses([]);
            await loadCourseCatalog(true);
        } catch (saveError) {
            setError(saveError.message || labels.loadError);
        } finally {
            setSaving(false);
        }
    };

    const handleRoundPreview = async (form) => {
        const result = await previewFreeElectiveRound(form);
        if (!result) {
            throw new Error(labels.roundLoadError);
        }
        return result;
    };

    const handleRoundSubmit = async (form) => {
        setSaving(true);
        setError('');
        try {
            await createFreeElectiveRound(form);
            setRoundWizardOpen(false);
            setSuccess(labels.roundCreated);
            await loadRounds();
        } catch (saveError) {
            setError(saveError.message || labels.loadError);
        } finally {
            setSaving(false);
        }
    };

    const goToRound = (roundId) => {
        router.push(`/free-elective-management/rounds/${roundId}`);
    };

    const goToGroups = () => {
        router.push('/free-elective-management/groups');
    };

    const impact = impactConfirmation?.impact;

    return (
        <div className="free-elective-page officer-page ui-page">
            <header className="free-elective-page__header officer-page__header ui-page__header">
                <div>
                    <p className="free-elective-page__eyebrow free-elective-eyebrow">
                        {labels.round}
                    </p>
                    <h1 className="free-elective-page__title officer-page__title">
                        {labels.roundTitle}
                    </h1>
                    <p className="free-elective-page__subtitle officer-page__subtitle">
                        {labels.roundSubtitle}
                    </p>
                </div>
                <div className="free-elective-page__actions officer-page__actions">
                    <button
                        type="button"
                        className="free-elective-button free-elective-button--secondary"
                        onClick={loadRounds}
                        disabled={loading}
                        title={labels.refresh}
                    >
                        <RefreshCw size={16} aria-hidden="true" />
                        {labels.refresh}
                    </button>
                    <button
                        type="button"
                        className="free-elective-button free-elective-button--secondary"
                        onClick={goToGroups}
                    >
                        <ExternalLink size={16} aria-hidden="true" />
                        {labels.learnerManagement}
                    </button>
                    <button
                        type="button"
                        className="free-elective-button free-elective-button--primary"
                        onClick={openRoundWizard}
                    >
                        <Plus size={17} aria-hidden="true" />
                        {labels.createRound}
                    </button>
                </div>
            </header>

            <FreeElectiveFilters
                language={language}
                faculties={faculties}
                isAdmin={isAdmin}
                titleKey="roundFilters"
                values={{
                    facultyId: selectedFacultyId,
                    academicYearBE: selectedYear,
                    semester: selectedSemester,
                    status: selectedStatus,
                    availableYears,
                }}
                onChange={handleFilterChange}
            />

            {loading ? (
                <div className="free-elective-loading" role="status">
                    {labels.loading}
                </div>
            ) : rounds.length ? (
                <div className="free-elective-round-grid">
                    {rounds.map((round) => (
                        <FreeElectiveRoundCard
                            key={round.id}
                            round={round}
                            language={language}
                            onManage={goToRound}
                        />
                    ))}
                </div>
            ) : (
                <div className="free-elective-empty">{labels.noRounds}</div>
            )}

            <section className="free-elective-panel free-elective-course-catalog-panel">
                <div className="free-elective-panel__heading">
                    <div>
                        <h2>{labels.courses}</h2>
                        <p>{labels.roundCardHint}</p>
                    </div>
                    <div className="free-elective-inline-actions">
                        <button
                            type="button"
                            className="free-elective-button free-elective-button--secondary"
                            onClick={openCourseCatalog}
                        >
                            {courseCatalogOpen ? labels.close : labels.view}
                        </button>
                        <button
                            type="button"
                            className="free-elective-button free-elective-button--quiet"
                            onClick={openCreateCourse}
                        >
                            <Plus size={15} aria-hidden="true" />
                            {labels.addCourse}
                        </button>
                    </div>
                </div>
                {courseCatalogOpen && (
                    <div className="free-elective-panel__content">
                        {catalogLoading ? (
                            <div className="free-elective-loading" role="status">
                                {labels.loading}
                            </div>
                        ) : courses.length ? (
                            <div className="free-elective-course-grid">
                                {courses.map((course) => (
                                    <FreeElectiveCourseCard
                                        key={course.id}
                                        course={course}
                                        language={language}
                                        onEdit={openEditCourse}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="free-elective-empty">{labels.noCourses}</div>
                        )}
                    </div>
                )}
            </section>

            <FreeElectiveRoundWizard
                key={roundWizardKey}
                open={roundWizardOpen}
                language={language}
                labels={labels}
                courses={courses.filter((course) => course.isActive)}
                competencies={competencies.filter((competency) => competency.isActive)}
                facultyId={wizardFacultyId}
                saving={saving}
                onClose={() => setRoundWizardOpen(false)}
                onPreview={handleRoundPreview}
                onSubmit={handleRoundSubmit}
            />
            <FreeElectiveCourseModal
                key={`${editingCourse?.id || 'new'}-${courseModalOpen ? 'open' : 'closed'}`}
                open={courseModalOpen}
                course={editingCourse}
                faculties={faculties}
                defaultFacultyId={accountFacultyId}
                language={language}
                labels={labels}
                saving={saving}
                onClose={() => {
                    setCourseModalOpen(false);
                    setEditingCourse(null);
                }}
                onSubmit={handleCourseSubmit}
            />
            <ConfirmActionModal
                open={Boolean(impactConfirmation)}
                title={labels.schemeChangeTitle}
                message={labels.schemeChangeMessage}
                variant="warning"
                size="md"
                loading={saving}
                confirmLabel={labels.confirmChange}
                cancelLabel={labels.cancel}
                onConfirm={confirmCourseSchemeChange}
                onCancel={() => setImpactConfirmation(null)}
                impact={impact && (
                    <div className="free-elective-impact-list">
                        <ImpactStat label={labels.gradeRecordCount} value={impact.grade_record_count} />
                        <ImpactStat label={labels.learnerCount} value={impact.learner_count} />
                        <ImpactStat label={labels.offeringCount} value={impact.offering_count} />
                        <ImpactStat
                            label={labels.finalizedOfferingCount}
                            value={impact.finalized_offering_count}
                        />
                        <ImpactStat label={labels.cohortCount} value={impact.cohort_count} />
                    </div>
                )}
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

export default function FreeElectiveManagementPage() {
    return (
        <Suspense
            fallback={(
                <div className="free-elective-loading" role="status">
                    {FREE_ELECTIVE_LABELS.th.loading}
                </div>
            )}
        >
            <FreeElectiveManagementPageContent />
        </Suspense>
    );
}
