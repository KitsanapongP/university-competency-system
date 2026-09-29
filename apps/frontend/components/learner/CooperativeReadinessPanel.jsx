'use client';

import { useState } from 'react';
import { AlertCircle, BriefcaseBusiness, CheckCircle2, RefreshCw } from 'lucide-react';
import { useLanguage } from '../../providers/LanguageContext';
import { fetchCooperativeReadiness } from '../../lib/cooperative-readiness';
import styles from './CooperativeReadinessPanel.module.css';

const CRITERION_TYPES = [
    'overall_gpa',
    'category_gpa',
    'course_grade',
    'category_credits',
    'free_elective_credits',
];

function localizedValue(valueEn, valueTh, language, fallback = '-') {
    const english = String(valueEn || '').trim();
    const thai = String(valueTh || '').trim();
    return language === 'en' ? english || thai || fallback : thai || english || fallback;
}

function formatNumber(value, language, isGPA = false) {
    if (value == null || !Number.isFinite(value)) return '-';
    return new Intl.NumberFormat(language === 'en' ? 'en-US' : 'th-TH', {
        minimumFractionDigits: isGPA ? 2 : 0,
        maximumFractionDigits: 2,
    }).format(value);
}

function criterionTypeLabel(type, t) {
    return CRITERION_TYPES.includes(type)
        ? t(`coop_requirements_type_${type}`)
        : type;
}

function resultValue(item, language, t) {
    if (item.currentGrade) return item.currentGrade;
    if (item.currentValue == null) {
        return item.criterionType === 'course_grade'
            ? t('learner_coop_missing_grade')
            : t('learner_coop_data_insufficient');
    }

    const value = formatNumber(
        item.currentValue,
        language,
        item.criterionType.includes('gpa'),
    );
    return item.criterionType.includes('credits')
        ? `${value} ${t('learner_coop_credits')}`
        : value;
}

function requiredValue(item, language, t) {
    if (item.requiredGrade) return item.requiredGrade;
    if (item.requiredValue == null) return '-';

    const value = formatNumber(
        item.requiredValue,
        language,
        item.criterionType.includes('gpa'),
    );
    return item.criterionType.includes('credits')
        ? `${value} ${t('learner_coop_credits')}`
        : value;
}

function requirementStatusLabel(item, t) {
    if (item.status === 'met') return t('learner_coop_met');
    if (item.status === 'not_met') return t('learner_coop_not_met');
    if (item.criterionType === 'course_grade') return t('learner_coop_missing_grade');
    return t('learner_coop_data_insufficient');
}

function RequirementResult({ item, language, t }) {
    const contextName = item.courseNameTh || item.courseNameEn
        ? localizedValue(item.courseNameEn, item.courseNameTh, language)
        : localizedValue(item.categoryNameEn, item.categoryNameTh, language, '');
    const requirementName = localizedValue(
        item.nameEn,
        item.nameTh,
        language,
        criterionTypeLabel(item.criterionType, t),
    );

    return (
        <article className={styles.result}>
            <div className={styles.resultHeading}>
                <div className={styles.resultName}>
                    <strong>{requirementName}</strong>
                    <span>{criterionTypeLabel(item.criterionType, t)}</span>
                    {contextName && <small>{contextName}</small>}
                </div>
                <span className={`${styles.status} ${styles[`status_${item.status}`] || styles.status_missing}`}>
                    {requirementStatusLabel(item, t)}
                </span>
            </div>
            <dl className={styles.values}>
                <div>
                    <dt>{t('learner_coop_current')}</dt>
                    <dd>{resultValue(item, language, t)}</dd>
                </div>
                <div>
                    <dt>{t('learner_coop_required')}</dt>
                    <dd>{requiredValue(item, language, t)}</dd>
                </div>
            </dl>
        </article>
    );
}

export default function CooperativeReadinessPanel() {
    const { language, t } = useLanguage();
    const [semester, setSemester] = useState('');
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [hasError, setHasError] = useState(false);

    const checkReadiness = async (selectedSemester) => {
        if (!selectedSemester) return;
        setSemester(String(selectedSemester));
        setLoading(true);
        setHasError(false);
        try {
            setResult(await fetchCooperativeReadiness(selectedSemester));
        } catch {
            setResult(null);
            setHasError(true);
        } finally {
            setLoading(false);
        }
    };

    const counts = result?.results?.reduce((summary, item) => {
        if (item.status === 'met') summary.met += 1;
        else if (item.status === 'not_met') summary.notMet += 1;
        else summary.missing += 1;
        return summary;
    }, { met: 0, notMet: 0, missing: 0 }) || { met: 0, notMet: 0, missing: 0 };

    return (
        <section className={`card ${styles.panel}`} aria-labelledby="learner-coop-title">
            <header className={styles.header}>
                <div className={styles.titleGroup}>
                    <h2 id="learner-coop-title">
                        <BriefcaseBusiness size={20} aria-hidden="true" />
                        {t('learner_coop_title')}
                    </h2>
                    <p>{t('learner_coop_description')}</p>
                </div>
                <label className={styles.termField}>
                    <span>{t('learner_coop_select_prompt')}</span>
                    <select
                        value={semester}
                        disabled={loading}
                        onChange={(event) => checkReadiness(event.target.value)}
                    >
                        <option value="">{t('learner_coop_select_prompt')}</option>
                        <option value="1">{t('learner_semester_one')}</option>
                        <option value="2">{t('learner_semester_two')}</option>
                    </select>
                </label>
            </header>

            <p className={styles.note}>{t('learner_coop_assessment_note')}</p>

            {loading && (
                <div className={styles.state} role="status">
                    <span className={styles.spinner} aria-hidden="true" />
                    {t('learner_coop_loading')}
                </div>
            )}

            {hasError && !loading && (
                <div className={`${styles.state} ${styles.error}`} role="alert">
                    <AlertCircle size={18} aria-hidden="true" />
                    <span>{t('learner_coop_error')}</span>
                    <button
                        type="button"
                        className={styles.retry}
                        onClick={() => checkReadiness(semester)}
                    >
                        <RefreshCw size={15} aria-hidden="true" />
                        {t('learner_coop_retry')}
                    </button>
                </div>
            )}

            {!semester && !loading && (
                <div className={styles.state} role="status">
                    {t('learner_coop_empty_prompt')}
                </div>
            )}

            {result?.status === 'not_configured' && !loading && (
                <div className={styles.state} role="status">
                    {t('learner_coop_not_configured')}
                </div>
            )}

            {result && result.status !== 'not_configured' && !loading && (
                <div className={styles.results}>
                    <section
                        className={`${styles.summary} ${result.status === 'ready'
                            ? styles.summaryReady
                            : styles.summaryNotReady}`}
                    >
                        <div className={styles.summaryTitle}>
                            {result.status === 'ready'
                                ? <CheckCircle2 size={20} aria-hidden="true" />
                                : <AlertCircle size={20} aria-hidden="true" />}
                            <strong>
                                {result.status === 'ready'
                                    ? t('learner_coop_ready')
                                    : t('learner_coop_not_ready')}
                            </strong>
                        </div>
                        <span>
                            {t('learner_coop_target_term')}: {result.targetYearBE} · {result.targetSemester === 1
                                ? t('learner_semester_one')
                                : t('learner_semester_two')}
                        </span>
                        <div className={styles.counts}>
                            <span>{t('learner_coop_passed_count')}: {counts.met} / {result.requirementCount}</span>
                            <span>{t('learner_coop_not_met_count')}: {counts.notMet}</span>
                            <span>{t('learner_coop_missing_count')}: {counts.missing}</span>
                        </div>
                    </section>

                    <div className={styles.resultList}>
                        <h3>{t('learner_coop_results_title')}</h3>
                        {result.results.map((item) => (
                            <RequirementResult
                                key={item.requirementId}
                                item={item}
                                language={language}
                                t={t}
                            />
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
}
