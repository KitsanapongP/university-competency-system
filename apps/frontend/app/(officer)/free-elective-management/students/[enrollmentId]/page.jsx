'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ArrowLeft,
    BookOpen,
    Check,
    GraduationCap,
    RefreshCw,
    UserRound,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../../../providers/auth-provider';
import { useLanguage } from '../../../../../providers/LanguageContext';
import {
    fetchFreeElectiveStudentDetail,
} from '../../../../../lib/free-elective';
import ToastNotifications from '../../../../../components/ui/ToastNotifications';
import FreeElectiveEnrollmentStatusBadge from '../../components/FreeElectiveEnrollmentStatusBadge';
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
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

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
                    <button
                        type="button"
                        className="free-elective-button free-elective-button--secondary"
                        onClick={loadDetail}
                        disabled={loading}
                        title={labels.refresh}
                    >
                        <RefreshCw size={16} aria-hidden="true" />
                        {labels.refresh}
                    </button>
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
                            </div>
                            {term.courses.map((course) => {
                                const key = `${course.roundCourseEnrollmentId}-${course.courseCode}`;

                                return (
                                    <div className="free-elective-student-course-row" key={key}>
                                        <div>
                                            <strong>{course.courseCode}</strong>
                                            <span>{courseName(course, language)}</span>
                                        </div>
                                        <span>
                                            {labels.sectionNo} {course.sectionNo}
                                        </span>
                                        <strong className="free-elective-grade-value">
                                            {course.grade || labels.noGrade}
                                        </strong>
                                        <span>
                                            {course.grade
                                                ? freeElectiveGradeSourceLabel(course.gradeSource, language)
                                                : labels.noGrade}
                                            {course.isBestGrade && (
                                                <span className="free-elective-best-badge">
                                                    <Check size={13} aria-hidden="true" />
                                                    {labels.usedForCalculation}
                                                </span>
                                            )}
                                        </span>
                                        <FreeElectiveEnrollmentStatusBadge
                                            status={course.status}
                                            language={language}
                                        />
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

            <ToastNotifications
                error={error}
                onCloseError={() => setError('')}
            />
        </div>
    );
}
