'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Award,
    BookOpenText,
    GraduationCap,
    RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../providers/auth-provider';
import { useLanguage } from '../../providers/LanguageContext';
import { fetchLearnerAcademicProfile } from '../../lib/learner-profile';

function localizedValue(valueEN, valueTH, language, fallback = '-') {
    const english = String(valueEN || '').trim();
    const thai = String(valueTH || '').trim();

    if (language === 'en') {
        return english || thai || fallback;
    }

    return thai || english || fallback;
}

function getInitials(name) {
    const parts = String(name || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (!parts.length) {
        return 'U';
    }

    return parts
        .slice(0, 2)
        .map((part) => Array.from(part)[0])
        .join('')
        .toUpperCase();
}

function groupCourseHistory(courses) {
    const years = new Map();

    (courses || []).forEach((course) => {
        const yearKey = `${course.studyYear || 0}-${course.academicYearBE}`;
        if (!years.has(yearKey)) {
            years.set(yearKey, {
                academicYearBE: course.academicYearBE,
                studyYear: course.studyYear,
                semesters: new Map(),
            });
        }

        const year = years.get(yearKey);
        if (!year.semesters.has(course.semester)) {
            year.semesters.set(course.semester, []);
        }
        year.semesters.get(course.semester).push(course);
    });

    return Array.from(years.values())
        .sort((left, right) => left.academicYearBE - right.academicYearBE)
        .map((year) => ({
            ...year,
            semesters: Array.from(year.semesters.entries())
                .sort(([left], [right]) => left - right)
                .map(([semester, coursesInSemester]) => ({
                    semester,
                    courses: coursesInSemester,
                })),
        }));
}

function semesterLabel(semester, labels) {
    if (semester === 1) return labels.learnerSemesterOne;
    if (semester === 2) return labels.learnerSemesterTwo;
    if (semester === 3) return labels.learnerSummer;
    return `${labels.learnerSemester} ${semester || '-'}`;
}

function courseSourceLabel(source, labels) {
    return source === 'free_elective'
        ? labels.learnerFreeElectiveCourse
        : labels.learnerCurriculumCourse;
}

function AcademicHistory({ courses, language, labels }) {
    const yearGroups = useMemo(() => groupCourseHistory(courses), [courses]);

    if (!yearGroups.length) {
        return (
            <div className="learner-course-history__empty">
                {labels.learnerNoCourseHistory}
            </div>
        );
    }

    return (
        <div className="learner-course-history__years">
            {yearGroups.map((year) => (
                <section
                    className="learner-course-history__year"
                    key={`${year.studyYear || 'unknown'}-${year.academicYearBE}`}
                >
                    <div className="learner-course-history__year-heading">
                        <strong>
                            {year.studyYear
                                ? `${labels.learnerStudyYear} ${year.studyYear}`
                                : labels.learnerAcademicYear}
                        </strong>
                        <span>
                            {labels.learnerAcademicYear} {year.academicYearBE || '-'}
                        </span>
                    </div>

                    <div className="learner-course-history__terms">
                        {year.semesters.map((term) => (
                            <section
                                className="learner-course-history__term"
                                key={`${year.academicYearBE}-${term.semester}`}
                            >
                                <h3>{semesterLabel(term.semester, labels)}</h3>
                                <div className="learner-course-history__table">
                                    <div className="learner-course-history__table-header">
                                        <span>{labels.learnerCourseName}</span>
                                        <span>{labels.learnerGrade}</span>
                                    </div>
                                    {term.courses.map((course) => (
                                        <div
                                            className="learner-course-history__row"
                                            key={`${course.source}-${course.recordId}`}
                                        >
                                            <div className="learner-course-history__course">
                                                <strong>
                                                    {localizedValue(
                                                        course.courseNameEn,
                                                        course.courseNameTh,
                                                        language,
                                                    )}
                                                </strong>
                                                <span>
                                                    {courseSourceLabel(course.source, labels)}
                                                </span>
                                            </div>
                                            <strong className="learner-course-history__grade">
                                                {course.grade || labels.learnerNoGrade}
                                            </strong>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}

export default function LearnerAcademicProfile({ activityHistory }) {
    const { user } = useAuth();
    const { language, t } = useLanguage();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const labels = useMemo(() => ({
        activityHistory: t('activity_history'),
        courseHistory: t('course_history'),
        verified: t('verified'),
        learnerAcademicYear: t('learner_academic_year'),
        learnerCourseName: t('learner_course_name'),
        learnerCurriculumCourse: t('learner_curriculum_course'),
        learnerEntryYear: t('learner_entry_year'),
        learnerFaculty: t('learner_faculty'),
        learnerFreeElectiveCourse: t('learner_free_elective_course'),
        learnerGrade: t('learner_grade'),
        learnerMajor: t('learner_major'),
        learnerNoCourseHistory: t('learner_no_course_history'),
        learnerNoGrade: t('learner_no_grade'),
        learnerProfileError: t('learner_profile_error'),
        learnerRetry: t('learner_retry'),
        learnerSemester: t('learner_semester'),
        learnerSemesterOne: t('learner_semester_one'),
        learnerSemesterTwo: t('learner_semester_two'),
        learnerStudentID: t('learner_student_id'),
        learnerStudyYear: t('learner_study_year'),
        learnerSummer: t('learner_summer'),
        learnerCurriculum: t('learner_curriculum'),
    }), [t]);

    const loadProfile = useCallback(async () => {
        if (!user) return;

        setLoading(true);
        setError('');
        try {
            setData(await fetchLearnerAcademicProfile());
        } catch (loadError) {
            setError(loadError.message || labels.learnerProfileError);
        } finally {
            setLoading(false);
        }
    }, [labels.learnerProfileError, user]);

    useEffect(() => {
        loadProfile();
    }, [loadProfile]);

    if (loading && !data) {
        return (
            <div className="learner-profile-state" role="status">
                {t('loading')}
            </div>
        );
    }

    if (!data?.profile) {
        return (
            <div className="learner-profile-state learner-profile-state--error" role="alert">
                <p>{error || labels.learnerProfileError}</p>
                <button
                    type="button"
                    className="profile-retry-button"
                    onClick={loadProfile}
                    disabled={loading}
                >
                    <RefreshCw size={16} aria-hidden="true" />
                    {labels.learnerRetry}
                </button>
            </div>
        );
    }

    const { profile, courseHistory } = data;
    const learnerName = localizedValue(profile.nameEn, profile.nameTh, language);
    const learnerInitials = getInitials(learnerName);

    return (
        <div className="profile-page">
            <div className="profile-grid">
                <div className="profile-card card">
                    <div className="profile-avatar">{learnerInitials}</div>
                    <h3>{learnerName}</h3>
                    <dl className="learner-profile-details">
                        <div>
                            <dt>{labels.learnerStudentID}</dt>
                            <dd>{profile.studentCode || '-'}</dd>
                        </div>
                        <div>
                            <dt>{labels.learnerFaculty}</dt>
                            <dd>
                                {localizedValue(
                                    profile.facultyNameEn,
                                    profile.facultyNameTh,
                                    language,
                                )}
                            </dd>
                        </div>
                        <div>
                            <dt>{labels.learnerMajor}</dt>
                            <dd>
                                {localizedValue(
                                    profile.majorNameEn,
                                    profile.majorNameTh,
                                    language,
                                )}
                            </dd>
                        </div>
                        <div>
                            <dt>{labels.learnerCurriculum}</dt>
                            <dd>
                                {localizedValue(
                                    profile.curriculumNameEn,
                                    profile.curriculumNameTh,
                                    language,
                                )}
                            </dd>
                        </div>
                        <div>
                            <dt>{labels.learnerEntryYear}</dt>
                            <dd>{profile.entryYearBE || '-'}</dd>
                        </div>
                    </dl>
                </div>

                <div className="activity-history card">
                    <div className="card-header">
                        <h2>
                            <Award size={20} className="section-icon" />
                            {labels.activityHistory}
                        </h2>
                    </div>
                    <div className="activity-list">
                        {Object.values(activityHistory || {})
                            .flat()
                            .filter((activity) => activity.type !== 'course')
                            .slice(0, 5)
                            .map((activity) => (
                                <div key={activity.id} className="activity-item">
                                    <div className="activity-badge">
                                        {(activity.type || 'A').charAt(0)}
                                    </div>
                                    <div className="activity-info">
                                        <h4>{activity.title}</h4>
                                        <span>{activity.date}</span>
                                    </div>
                                    <div className="activity-status verified">
                                        {labels.verified}
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>
            </div>

            <section className="learner-course-history card">
                <div className="card-header learner-course-history__header">
                    <h2>
                        <BookOpenText size={20} className="section-icon" />
                        {labels.courseHistory}
                    </h2>
                    <span className="learner-course-history__hint">
                        <GraduationCap size={16} aria-hidden="true" />
                        {labels.learnerEntryYear} {profile.entryYearBE || '-'}
                    </span>
                </div>
                <AcademicHistory
                    courses={courseHistory}
                    language={language}
                    labels={labels}
                />
            </section>
        </div>
    );
}
