'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Search, UserRound, Users } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../../../providers/auth-provider';
import { useLanguage } from '../../../../../providers/LanguageContext';
import {
    fetchFreeElectiveGroupStudents,
    fetchFreeElectiveStudentGroups,
} from '../../../../../lib/free-elective';
import ToastNotifications from '../../../../../components/ui/ToastNotifications';
import {
    FREE_ELECTIVE_LABELS,
    freeElectiveText,
    localizedFreeElective,
} from '../../free-elective-labels';
import '../../FreeElectiveManagement.css';

function buildLabels(language) {
    return Object.fromEntries(
        Object.keys(FREE_ELECTIVE_LABELS.th).map((key) => [key, freeElectiveText(language, key)]),
    );
}

export default function FreeElectiveGroupDetailPage() {
    const router = useRouter();
    const params = useParams();
    const { user, loading: authLoading } = useAuth();
    const { language } = useLanguage();
    const labels = useMemo(() => buildLabels(language), [language]);
    const cohortId = params?.cohortId;
    const [group, setGroup] = useState(null);
    const [students, setStudents] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const loadData = useCallback(async () => {
        if (!user || !cohortId) {
            return;
        }
        setLoading(true);
        try {
            const [groups, nextStudents] = await Promise.all([
                fetchFreeElectiveStudentGroups(),
                fetchFreeElectiveGroupStudents(cohortId),
            ]);
            setGroup(groups.find((item) => String(item.cohortId) === String(cohortId)) || null);
            setStudents(nextStudents);
        } catch (loadError) {
            setError(loadError.message || labels.loadError);
        } finally {
            setLoading(false);
        }
    }, [cohortId, labels.loadError, user]);

    useEffect(() => {
        if (!authLoading && user) {
            loadData();
        }
    }, [authLoading, loadData, user]);

    const filteredStudents = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) {
            return students;
        }
        return students.filter((student) => {
            return `${student.studentCode} ${student.studentNameTh} ${student.studentNameEn}`
                .toLowerCase()
                .includes(term);
        });
    }, [search, students]);

    if (loading && !students.length) {
        return (
            <div className="free-elective-loading" role="status">
                {labels.loading}
            </div>
        );
    }

    return (
        <div className="free-elective-page">
            <button
                type="button"
                className="free-elective-back-button"
                onClick={() => router.push('/free-elective-management/groups')}
            >
                <ArrowLeft size={16} aria-hidden="true" />
                {labels.groupPageTitle}
            </button>
            <header className="free-elective-page__header">
                <div>
                    <p className="free-elective-page__eyebrow">
                        <Users size={15} aria-hidden="true" />
                        {labels.groupDetail}
                    </p>
                    <h1 className="free-elective-page__title">
                        {localizedFreeElective(
                            group,
                            language,
                            'curriculumNameTh',
                            'curriculumNameEn',
                        )}
                    </h1>
                    <p className="free-elective-page__subtitle">
                        {localizedFreeElective(
                            group,
                            language,
                            'majorNameTh',
                            'majorNameEn',
                        )} · {labels.entryYear} {group?.entryYearBE || '-'}
                    </p>
                </div>
                <div className="free-elective-summary-chips">
                    <span>
                        <Users size={14} />
                        {students.length} {labels.groupLearnerCount}
                    </span>
                    <span>
                        {group?.selectedCount || 0} {labels.enrolledCount}
                    </span>
                </div>
            </header>

            <section className="free-elective-panel">
                <div className="free-elective-panel__heading">
                    <div>
                        <p className="free-elective-eyebrow">{labels.groupDetailSubtitle}</p>
                    </div>
                    <label className="free-elective-search-field free-elective-group-search">
                        <Search size={16} aria-hidden="true" />
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder={labels.searchLearners}
                        />
                    </label>
                </div>
                {filteredStudents.length ? (
                    <div className="free-elective-group-student-list">
                        {filteredStudents.map((student) => (
                            <div className="free-elective-group-student-row" key={student.enrollmentId}>
                                <div className="free-elective-group-student-identity">
                                    <UserRound size={17} aria-hidden="true" />
                                    <div>
                                        <strong>{student.studentCode}</strong>
                                        <span>
                                            {localizedFreeElective(
                                                student,
                                                language,
                                                'studentNameTh',
                                                'studentNameEn',
                                            )}
                                        </span>
                                    </div>
                                </div>
                                <span className="free-elective-table__secondary">
                                    {localizedFreeElective(
                                        student,
                                        language,
                                        'curriculumNameTh',
                                        'curriculumNameEn',
                                    )}
                                </span>
                                <button
                                    type="button"
                                    className="free-elective-link-button"
                                    onClick={() => router.push(`/free-elective-management/students/${student.enrollmentId}`)}
                                >
                                    {labels.viewStudent}
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="free-elective-empty free-elective-panel__content">
                        {students.length ? labels.noStudentMatches : labels.noLearners}
                    </div>
                )}
            </section>
            <ToastNotifications error={error} onCloseError={() => setError('')} />
        </div>
    );
}
