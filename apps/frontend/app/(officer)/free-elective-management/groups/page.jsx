'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, GraduationCap, RefreshCw, Search, Users } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../../providers/auth-provider';
import { useLanguage } from '../../../../providers/LanguageContext';
import { fetchFaculties } from '../../../../lib/curriculum';
import {
    fetchFreeElectiveStudentGroups,
} from '../../../../lib/free-elective';
import ToastNotifications from '../../../../components/ui/ToastNotifications';
import {
    FREE_ELECTIVE_LABELS,
    freeElectiveText,
    localizedFreeElective,
} from '../free-elective-labels';
import '../FreeElectiveManagement.css';

function buildLabels(language) {
    return Object.fromEntries(
        Object.keys(FREE_ELECTIVE_LABELS.th).map((key) => [key, freeElectiveText(language, key)]),
    );
}

export default function FreeElectiveGroupsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, loading: authLoading } = useAuth();
    const { language } = useLanguage();
    const labels = useMemo(() => buildLabels(language), [language]);
    const isAdmin = user?.roles?.includes('admin');
    const accountFacultyId = user?.faculty_id || '';
    const selectedFacultyId = isAdmin
        ? searchParams.get('faculty_id') || ''
        : accountFacultyId;
    const selectedMajorId = searchParams.get('major_id') || '';
    const selectedCurriculumId = searchParams.get('curriculum_id') || '';
    const selectedEntryYear = searchParams.get('entry_year_be') || '';

    const [faculties, setFaculties] = useState([]);
    const [allGroups, setAllGroups] = useState([]);
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const loadGroups = useCallback(async () => {
        if (!user) {
            return;
        }
        setLoading(true);
        setError('');
        try {
            const [nextFaculties, nextGroups] = await Promise.all([
                fetchFaculties(),
                fetchFreeElectiveStudentGroups({
                    facultyId: selectedFacultyId,
                    majorId: selectedMajorId,
                    curriculumId: selectedCurriculumId,
                    entryYearBE: selectedEntryYear,
                }),
            ]);
            const nextAllGroups = await fetchFreeElectiveStudentGroups();
            setFaculties(nextFaculties);
            setAllGroups(nextAllGroups);
            setGroups(nextGroups);
        } catch (loadError) {
            setError(loadError.message || labels.loadError);
        } finally {
            setLoading(false);
        }
    }, [labels.loadError, selectedCurriculumId, selectedEntryYear, selectedFacultyId, selectedMajorId, user]);

    useEffect(() => {
        if (!authLoading && user) {
            loadGroups();
        }
    }, [authLoading, loadGroups, user]);

    const options = useMemo(() => {
        const scopedGroups = allGroups.filter((group) => {
            if (selectedFacultyId && String(group.facultyId) !== String(selectedFacultyId)) {
                return false;
            }
            if (selectedMajorId && String(group.majorId) !== String(selectedMajorId)) {
                return false;
            }
            if (selectedCurriculumId && String(group.curriculumId) !== String(selectedCurriculumId)) {
                return false;
            }
            return true;
        });
        const majorMap = new Map();
        const curriculumMap = new Map();
        const years = new Set();
        scopedGroups.forEach((group) => {
            majorMap.set(group.majorId, {
                nameTh: group.majorNameTh,
                nameEn: group.majorNameEn,
            });
            curriculumMap.set(group.curriculumId, {
                nameTh: group.curriculumNameTh,
                nameEn: group.curriculumNameEn,
            });
            if (group.entryYearBE) {
                years.add(group.entryYearBE);
            }
        });
        return {
            majors: Array.from(majorMap, ([id, names]) => ({
                id,
                name: language === 'en' ? names.nameEn || names.nameTh : names.nameTh,
            })),
            curriculums: Array.from(curriculumMap, ([id, names]) => ({
                id,
                name: language === 'en' ? names.nameEn || names.nameTh : names.nameTh,
            })),
            years: Array.from(years).sort((left, right) => right - left),
        };
    }, [allGroups, language, selectedCurriculumId, selectedFacultyId, selectedMajorId]);

    const setQueryValue = (key, value) => {
        const nextParams = new URLSearchParams(searchParams.toString());
        if (value) {
            nextParams.set(key, value);
        } else {
            nextParams.delete(key);
        }
        const dependentKeys = {
            faculty_id: ['major_id', 'curriculum_id', 'entry_year_be'],
            major_id: ['curriculum_id', 'entry_year_be'],
            curriculum_id: ['entry_year_be'],
        };
        (dependentKeys[key] || []).forEach((dependentKey) => {
            nextParams.delete(dependentKey);
        });
        const query = nextParams.toString();
        router.replace(`/free-elective-management/groups${query ? `?${query}` : ''}`, { scroll: false });
    };

    const openGroup = (groupId) => {
        router.push(`/free-elective-management/groups/${groupId}`);
    };

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
            <header className="free-elective-page__header">
                <div>
                    <p className="free-elective-page__eyebrow">
                        <Users size={15} aria-hidden="true" />
                        {labels.groups}
                    </p>
                    <h1 className="free-elective-page__title">{labels.groupPageTitle}</h1>
                    <p className="free-elective-page__subtitle">{labels.groupPageSubtitle}</p>
                </div>
                <button
                    type="button"
                    className="free-elective-button free-elective-button--secondary"
                    onClick={loadGroups}
                    disabled={loading}
                    title={labels.refresh}
                >
                    <RefreshCw size={16} aria-hidden="true" />
                    {labels.refresh}
                </button>
            </header>

            <section className="free-elective-panel free-elective-group-filters">
                <div className="free-elective-panel__heading">
                    <div>
                        <p className="free-elective-eyebrow">
                            <Search size={15} aria-hidden="true" />
                            {labels.groupFilterTitle}
                        </p>
                    </div>
                </div>
                <div className="free-elective-filter-grid">
                    {isAdmin && (
                        <label className="free-elective-field">
                            <span>{labels.faculty}</span>
                            <select
                                value={selectedFacultyId}
                                onChange={(event) => setQueryValue('faculty_id', event.target.value)}
                            >
                                <option value="">{labels.allFaculties}</option>
                                {faculties.map((faculty) => (
                                    <option key={faculty.facultyId} value={faculty.facultyId}>
                                        {language === 'en' ? faculty.nameEn || faculty.nameTh : faculty.nameTh}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}
                    <label className="free-elective-field">
                        <span>{labels.major}</span>
                        <select
                            value={selectedMajorId}
                            onChange={(event) => setQueryValue('major_id', event.target.value)}
                        >
                            <option value="">{labels.allMajors}</option>
                            {options.majors.map((major) => (
                                <option key={major.id} value={major.id}>
                                    {major.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="free-elective-field">
                        <span>{labels.curriculum}</span>
                        <select
                            value={selectedCurriculumId}
                            onChange={(event) => setQueryValue('curriculum_id', event.target.value)}
                        >
                            <option value="">{labels.allCurriculums}</option>
                            {options.curriculums.map((curriculum) => (
                                <option key={curriculum.id} value={curriculum.id}>
                                    {curriculum.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="free-elective-field">
                        <span>{labels.entryYear}</span>
                        <select
                            value={selectedEntryYear}
                            onChange={(event) => setQueryValue('entry_year_be', event.target.value)}
                        >
                            <option value="">{labels.allEntryYears}</option>
                            {options.years.map((year) => (
                                <option key={year} value={year}>
                                    {year}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
            </section>

            {loading ? (
                <div className="free-elective-loading" role="status">
                    {labels.loading}
                </div>
            ) : groups.length ? (
                <div className="free-elective-group-grid">
                    {groups.map((group) => (
                        <article className="free-elective-group-card" key={group.cohortId}>
                            <div className="free-elective-group-card__header">
                                <div className="free-elective-course-card__icon" aria-hidden="true">
                                    <GraduationCap size={19} />
                                </div>
                                <div>
                                    <p className="free-elective-code">
                                        {labels.entryYear} {group.entryYearBE}
                                    </p>
                                    <h2>
                                        {localizedFreeElective(
                                            group,
                                            language,
                                            'curriculumNameTh',
                                            'curriculumNameEn',
                                        )}
                                    </h2>
                                    <p>
                                        {localizedFreeElective(
                                            group,
                                            language,
                                            'majorNameTh',
                                            'majorNameEn',
                                        )}
                                    </p>
                                </div>
                            </div>
                            <div className="free-elective-group-card__body">
                                <div className="free-elective-metric">
                                    <span>
                                        <Users size={14} />
                                        {labels.groupLearnerCount}
                                    </span>
                                    <strong>{group.studentCount}</strong>
                                </div>
                                <div className="free-elective-metric">
                                    <span>
                                        <BookOpen size={14} />
                                        {labels.enrolledCount}
                                    </span>
                                    <strong>{group.selectedCount}</strong>
                                </div>
                            </div>
                            <div className="free-elective-group-card__footer">
                                <span className="free-elective-table__secondary">
                                    {localizedFreeElective(
                                        group,
                                        language,
                                        'facultyNameTh',
                                        'facultyNameEn',
                                    )}
                                </span>
                                <button
                                    type="button"
                                    className="free-elective-link-button"
                                    onClick={() => openGroup(group.cohortId)}
                                >
                                    {labels.viewLearners}
                                </button>
                            </div>
                        </article>
                    ))}
                </div>
            ) : (
                <div className="free-elective-empty">{labels.noGroups}</div>
            )}
            <ToastNotifications
                error={error}
                onCloseError={() => setError('')}
            />
        </div>
    );
}
