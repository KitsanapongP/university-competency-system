'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, ExternalLink, Plus, RefreshCw } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../providers/auth-provider';
import { useLanguage } from '../../../providers/LanguageContext';
import { fetchFaculties } from '../../../lib/curriculum';
import {
    createFreeElectiveCourse,
    createFreeElectiveOffering,
    fetchFreeElectiveCourses,
    fetchFreeElectiveOfferings,
    getFreeElectiveImpactFromError,
    updateFreeElectiveCourse,
} from '../../../lib/free-elective';
import ConfirmActionModal from '../../../components/ui/ConfirmActionModal';
import ToastNotifications from '../../../components/ui/ToastNotifications';
import FreeElectiveCourseCard from './components/FreeElectiveCourseCard';
import FreeElectiveCourseModal from './components/FreeElectiveCourseModal';
import FreeElectiveFilters from './components/FreeElectiveFilters';
import FreeElectiveOfferingCard from './components/FreeElectiveOfferingCard';
import FreeElectiveOfferingModal from './components/FreeElectiveOfferingModal';
import { FREE_ELECTIVE_LABELS, freeElectiveText } from './free-elective-labels';
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
    const labels = useMemo(
        () => Object.fromEntries(
            Object.keys(FREE_ELECTIVE_LABELS.th).map((key) => [
                key,
                freeElectiveText(language, key),
            ]),
        ),
        [language],
    );
    const isAdmin = user?.roles?.includes('admin');
    const accountFacultyId = getDefaultFacultyId(user);
    const view = searchParams.get('view') === 'courses' ? 'courses' : 'offerings';
    const selectedFacultyId = isAdmin
        ? searchParams.get('faculty_id') || ''
        : accountFacultyId;
    const selectedYear = searchParams.get('academic_year_be') || '';
    const selectedSemester = searchParams.get('semester') || '';
    const selectedStatus = searchParams.get('status') || '';

    const [faculties, setFaculties] = useState([]);
    const [courses, setCourses] = useState([]);
    const [offerings, setOfferings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [courseModalOpen, setCourseModalOpen] = useState(false);
    const [offeringModalOpen, setOfferingModalOpen] = useState(false);
    const [editingCourse, setEditingCourse] = useState(null);
    const [impactConfirmation, setImpactConfirmation] = useState(null);

    const loadData = useCallback(async () => {
        if (!user) {
            return;
        }

        setLoading(true);
        setError('');
        try {
            const facultyFilter = selectedFacultyId
                ? { facultyId: selectedFacultyId }
                : {};
            const [nextFaculties, nextCourses, nextOfferings] = await Promise.all([
                fetchFaculties(),
                fetchFreeElectiveCourses(facultyFilter),
                fetchFreeElectiveOfferings({
                    ...facultyFilter,
                    academicYearBE: selectedYear,
                    semester: selectedSemester,
                    status: selectedStatus,
                }),
            ]);
            setFaculties(nextFaculties);
            setCourses(nextCourses);
            setOfferings(nextOfferings);
        } catch (loadError) {
            setError(loadError.message || labels.loadError);
        } finally {
            setLoading(false);
        }
    }, [labels.loadError, selectedFacultyId, selectedSemester, selectedStatus, selectedYear, user]);

    useEffect(() => {
        if (!authLoading && user) {
            loadData();
        }
    }, [authLoading, loadData, user]);

    const availableYears = useMemo(() => {
        return Array.from(
            new Set(offerings.map((offering) => offering.academicYearBE).filter(Boolean)),
        ).sort((left, right) => right - left);
    }, [offerings]);

    const setQueryValue = (key, value) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value === undefined || value === null || value === '') {
            params.delete(key);
        } else {
            params.set(key, String(value));
        }
        const query = params.toString();
        router.replace(`/free-elective-management${query ? `?${query}` : ''}`, { scroll: false });
    };

    const handleViewChange = (nextView) => {
        setQueryValue('view', nextView === 'offerings' ? '' : nextView);
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

    const openCreateCourse = () => {
        setEditingCourse(null);
        setCourseModalOpen(true);
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
            await loadData();
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
            await loadData();
        } catch (saveError) {
            setError(saveError.message || labels.loadError);
        } finally {
            setSaving(false);
        }
    };

    const handleOfferingSubmit = async (form) => {
        setSaving(true);
        setError('');
        try {
            await createFreeElectiveOffering(form);
            setOfferingModalOpen(false);
            setSuccess(labels.offeringCreated);
            await loadData();
        } catch (saveError) {
            setError(saveError.message || labels.loadError);
        } finally {
            setSaving(false);
        }
    };

    const goToOffering = (offeringId) => {
        router.push(`/free-elective-management/offerings/${offeringId}`);
    };

    const goToGroups = () => {
        router.push('/free-elective-management/groups');
    };

    const impact = impactConfirmation?.impact;

    return (
    <div className="free-elective-page officer-page ui-page">
      <header className="free-elective-page__header officer-page__header ui-page__header">
                <div>
                    <p className="free-elective-page__eyebrow">
                        <BookOpen size={15} aria-hidden="true" />
                        {labels.signInScope}
                    </p>
                    <h1 className="free-elective-page__title officer-page__title">{labels.title}</h1>
                    <p className="free-elective-page__subtitle officer-page__subtitle">{labels.subtitle}</p>
                </div>
                <div className="free-elective-page__actions officer-page__actions">
                    <button
                        type="button"
                        className="free-elective-button free-elective-button--secondary"
                        onClick={loadData}
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
                        {labels.groups}
                    </button>
                    <button
                        type="button"
                        className="free-elective-button free-elective-button--primary"
                        onClick={view === 'courses' ? openCreateCourse : () => setOfferingModalOpen(true)}
                    >
                        <Plus size={17} aria-hidden="true" />
                        {view === 'courses' ? labels.addCourse : labels.addOffering}
                    </button>
                </div>
            </header>

            <div className="free-elective-notice" role="status">
                <BookOpen size={17} aria-hidden="true" />
                <span>{labels.signInScope}</span>
            </div>

            <nav className="free-elective-view-tabs" aria-label={labels.title}>
                <button
                    type="button"
                    className={`free-elective-view-tab ${view === 'offerings' ? 'free-elective-view-tab--active' : ''}`}
                    onClick={() => handleViewChange('offerings')}
                    aria-current={view === 'offerings' ? 'page' : undefined}
                >
                    {labels.offerings}
                </button>
                <button
                    type="button"
                    className={`free-elective-view-tab ${view === 'courses' ? 'free-elective-view-tab--active' : ''}`}
                    onClick={() => handleViewChange('courses')}
                    aria-current={view === 'courses' ? 'page' : undefined}
                >
                    {labels.courses}
                </button>
            </nav>

            {view === 'offerings' && (
                <>
                    <FreeElectiveFilters
                        language={language}
                        faculties={faculties}
                        isAdmin={isAdmin}
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
                    ) : offerings.length ? (
                        <div className="free-elective-offering-grid">
                            {offerings.map((offering) => (
                                <FreeElectiveOfferingCard
                                    key={offering.id}
                                    offering={offering}
                                    language={language}
                                    onManage={goToOffering}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="free-elective-empty">{labels.noOfferings}</div>
                    )}
                </>
            )}

            {view === 'courses' && (
                <section className="free-elective-panel">
                    <div className="free-elective-panel__heading">
                        <div>
                            <h2>{labels.courses}</h2>
                            <p>{courses.length} {labels.records}</p>
                        </div>
                    </div>
                    {loading ? (
                        <div className="free-elective-loading" role="status">
                            {labels.loading}
                        </div>
                    ) : courses.length ? (
                        <div className="free-elective-course-grid free-elective-panel__content">
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
                        <div className="free-elective-empty free-elective-panel__content">{labels.noCourses}</div>
                    )}
                </section>
            )}

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
            <FreeElectiveOfferingModal
                key={`${courses[0]?.id || 'empty'}-${offeringModalOpen ? 'open' : 'closed'}`}
                open={offeringModalOpen}
                courses={courses.filter((course) => course.isActive)}
                language={language}
                labels={labels}
                saving={saving}
                onClose={() => setOfferingModalOpen(false)}
                onSubmit={handleOfferingSubmit}
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
