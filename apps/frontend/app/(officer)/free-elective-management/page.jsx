'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, Plus, RefreshCw } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../providers/auth-provider';
import { useLanguage } from '../../../providers/LanguageContext';
import { fetchCompetenciesForManagement } from '../../../lib/competency-management';
import { fetchFaculties } from '../../../lib/curriculum';
import {
    createFreeElectiveRound,
    fetchFreeElectiveCourses,
    fetchFreeElectiveRounds,
    previewFreeElectiveRound,
} from '../../../lib/free-elective';
import ToastNotifications from '../../../components/ui/ToastNotifications';
import FreeElectiveFilters from './components/FreeElectiveFilters';
import FreeElectiveRoundCard from './components/FreeElectiveRoundCard';
import FreeElectiveRoundWizard from './components/FreeElectiveRoundWizard';
import { FREE_ELECTIVE_LABELS, buildFreeElectiveLabels } from './free-elective-labels';
import '../curriculum-management/CourseLayout.css';
import './FreeElectiveManagement.css';

function getDefaultFacultyId(user) {
    return user?.faculty_id || '';
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
    const [catalogLoadedKey, setCatalogLoadedKey] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [roundWizardOpen, setRoundWizardOpen] = useState(false);
    const [roundWizardKey, setRoundWizardKey] = useState(0);
    const competencyRefreshInFlightRef = useRef(false);
    const catalogKey = selectedFacultyId || 'all';
    const wizardFacultyId = selectedFacultyId || accountFacultyId || faculties[0]?.facultyId || '';

    const loadRounds = useCallback(async () => {
        if (!user) {
            return;
        }

        setLoading(true);
        setError('');
        try {
            const facultyFilter = catalogKey !== 'all'
                ? { facultyId: catalogKey }
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
        catalogKey,
        labels.roundLoadError,
        selectedSemester,
        selectedStatus,
        selectedYear,
        user,
    ]);

    const loadCourseCatalog = useCallback(async (force = false) => {
        if (!user || (!force && catalogLoadedKey === catalogKey) || catalogLoading) {
            return;
        }
        setCatalogLoading(true);
        try {
            const facultyFilter = catalogKey !== 'all'
                ? { facultyId: catalogKey }
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
            // An empty response or a failed request is still a completed attempt.
            // Mark it so the open-modal effect cannot retry in a loop.
            setCatalogLoadedKey(catalogKey);
            setCatalogLoading(false);
        }
    }, [catalogKey, catalogLoadedKey, catalogLoading, labels.loadError, user]);

    const refreshCompetencies = useCallback(async () => {
        if (!user || competencyRefreshInFlightRef.current) {
            return competencies;
        }

        competencyRefreshInFlightRef.current = true;
        try {
            const nextCompetencies = await fetchCompetenciesForManagement();
            setCompetencies(nextCompetencies);
            return nextCompetencies;
        } catch (loadError) {
            setError(loadError.message || labels.loadError);
            throw loadError;
        } finally {
            competencyRefreshInFlightRef.current = false;
        }
    }, [competencies, labels.loadError, user]);

    useEffect(() => {
        if (!authLoading && user) {
            loadRounds();
        }
    }, [authLoading, loadRounds, user]);

    useEffect(() => {
        if (roundWizardOpen) {
            loadCourseCatalog();
        }
    }, [loadCourseCatalog, roundWizardOpen]);

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

    const openRoundWizard = () => {
        setRoundWizardKey((current) => current + 1);
        setRoundWizardOpen(true);
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
            throw saveError;
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
                onRefreshCompetencies={refreshCompetencies}
                onSubmit={handleRoundSubmit}
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
