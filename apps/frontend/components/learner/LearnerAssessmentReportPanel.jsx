'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Brain, CheckCircle2, RefreshCw } from 'lucide-react';
import { useLanguage } from '../../providers/LanguageContext';
import {
    fetchLearnerAssessmentJob,
    fetchLearnerAssessmentReport,
    generateLearnerAssessmentReport,
} from '../../lib/learner-assessment';
import {
    loadAssessmentReport,
    monitorAssessmentReport,
    assessmentRetryAfter,
    isAssessmentJobActive,
} from '../../lib/learner-assessment-state.mjs';
import styles from './LearnerAssessmentReportPanel.module.css';

function localizedValue(value, language, fallback = '-') {
    if (typeof value === 'string') return value || fallback;
    const english = String(value?.en || '').trim();
    const thai = String(value?.th || '').trim();
    return language === 'en' ? english || thai || fallback : thai || english || fallback;
}

function evidenceCatalog(sourceSnapshot, language) {
    const input = sourceSnapshot?.provider_input;
    const catalog = new Map();
    if (!input) return catalog;

    const add = (reference, title) => {
        if (reference && title) catalog.set(reference, title);
    };
    const courseLabel = (course) => {
        const name = localizedValue({ th: course.course_name_th, en: course.course_name_en }, language);
        const details = [course.grade, course.academic_year_be && String(course.academic_year_be)]
            .filter(Boolean)
            .join(' · ');
        return [course.course_code, name, details].filter(Boolean).join(' · ');
    };

    (input.academic_evidence || []).forEach((course) => {
        add(course.evidence_ref, courseLabel(course));
    });
    (input.competency_scores || []).forEach((competency) => {
        const competencyName = localizedValue({ th: competency.name_th, en: competency.name_en }, language);
        add(competency.competency_ref, competencyName);
        (competency.course_scores || []).forEach((score) => {
            const scoreParts = [
                courseLabel(score),
                `${score.weighted_score ?? 0} ${language === 'en' ? 'weighted points' : 'คะแนนถ่วงน้ำหนัก'}`,
                competencyName,
            ].filter(Boolean);
            add(score.evidence_ref, scoreParts.join(' · '));
            add(score.course_evidence_ref, courseLabel(score));
        });
        (competency.activity_scores || []).forEach((activity) => {
            add(activity.evidence_ref, localizedValue({ th: activity.activity_name_th, en: activity.activity_name_en }, language));
            add(activity.activity_evidence_ref, localizedValue({ th: activity.activity_name_th, en: activity.activity_name_en }, language));
        });
    });
    (input.activity_evidence || []).forEach((activity) => {
        const name = localizedValue({ th: activity.activity_name_th, en: activity.activity_name_en }, language);
        const details = [activity.start_at?.slice(0, 10), activity.earned_percent != null ? `${activity.earned_percent}%` : '']
            .filter(Boolean)
            .join(' · ');
        add(activity.evidence_ref, [name, details].filter(Boolean).join(' · '));
        add(activity.score_evidence_ref, [name, details].filter(Boolean).join(' · '));
    });
    return catalog;
}

function reportContent(report) {
    if (!report?.content) return null;
    try {
        return typeof report.content === 'string' ? JSON.parse(report.content) : report.content;
    } catch {
        return null;
    }
}

function reportDependencies(signal, onState) {
    return {
        signal,
        onState,
        getReport: fetchLearnerAssessmentReport,
        getJob: fetchLearnerAssessmentJob,
        generate: generateLearnerAssessmentReport,
    };
}

function assessmentSources(sourceSnapshot) {
    return sourceSnapshot?.provider_input?.eligible_careers || [];
}

function availabilityLabel(source, t) {
    const labels = {
        cooperative_readiness: t('assessment_source_readiness'),
        academic_grades: t('assessment_source_grades'),
        course_competency_scores: t('assessment_source_course_competencies'),
        free_elective_competency_scores: t('assessment_source_elective_competencies'),
        activity_participation: t('assessment_source_activity_participation'),
        activity_competency_scores: t('assessment_source_activity_scores'),
        activity_scores: t('assessment_source_activities'),
        activity_evidence: t('assessment_source_activities'),
        career_paths: t('assessment_source_careers'),
    };
    return labels[source] || t('assessment_source_other');
}

function availabilityReason(reason, t) {
    const labels = {
        criteria_not_published: t('assessment_reason_no_readiness_criteria'),
        no_graded_courses_before_target: t('assessment_reason_no_grades'),
        template_assignment_missing: t('assessment_reason_no_template_assignment'),
        active_template_missing: t('assessment_reason_no_active_template'),
        course_scores_recalculation_required: t('assessment_reason_course_recalculation'),
        competency_mapping_missing: t('assessment_reason_no_course_mapping'),
        no_mapped_course_grades_before_target: t('assessment_reason_no_course_scores'),
        free_elective_scores_recalculation_required: t('assessment_reason_elective_recalculation'),
        no_finalized_elective_score_evidence: t('assessment_reason_no_elective_scores'),
        no_confirmed_activity_participation: t('assessment_reason_no_activities'),
        no_finalized_activity_scores: t('assessment_reason_no_activity_scores'),
        some_activity_scores_unavailable: t('assessment_reason_some_activity_scores'),
        activity_competency_not_configured: t('assessment_reason_activity_competency_missing'),
        session_not_completed: t('assessment_reason_session_incomplete'),
        scores_not_finalized: t('assessment_reason_activity_not_finalized'),
        scores_recalculation_required: t('assessment_reason_activity_recalculation'),
        score_not_finalized: t('assessment_reason_activity_not_finalized'),
        score_value_missing: t('assessment_reason_activity_score_missing'),
        no_published_career_paths: t('assessment_reason_no_career_catalog'),
    };
    return labels[reason] || t('assessment_reason_not_available');
}

function jobErrorMessage(code, t) {
    const labels = {
        provider_timeout: t('assessment_error_provider_timeout'),
        provider_unavailable: t('assessment_error_provider_unavailable'),
        model_not_found: t('assessment_error_model_missing'),
        invalid_output: t('assessment_error_invalid_output'),
        source_superseded: t('assessment_error_source_changed'),
        context_exceeded: t('assessment_report_context_exceeded'),
        pipeline_version_unsupported: t('assessment_error_version_changed'),
    };
    return labels[code] || t('assessment_error_generic');
}

function ReportFindings({ title, items, language, t, catalog }) {
    if (!items?.length) return null;
    return (
        <section className={styles.findingGroup}>
            <h4>{title}</h4>
            <div className={styles.findingList}>
                {items.map((item, index) => (
                    <article className={styles.finding} key={`${title}-${index}`}>
                        <h5>{localizedValue(item.title, language)}</h5>
                        <p>{localizedValue(item.reason, language)}</p>
                        {item.development_advice && (
                            <p className={styles.advice}>
                                <strong>{t('assessment_report_advice')}: </strong>
                                {localizedValue(item.development_advice, language)}
                            </p>
                        )}
                        <EvidenceList references={item.evidence_refs} catalog={catalog} t={t} />
                    </article>
                ))}
            </div>
        </section>
    );
}

function EvidenceList({ references, catalog, t }) {
    if (!references?.length) return null;
    return (
        <details className={styles.evidence}>
            <summary>{t('assessment_report_evidence')}</summary>
            <ul>
                {references.map((reference) => (
                    <li key={reference}>{catalog.get(reference) || t('assessment_report_evidence_unavailable')}</li>
                ))}
            </ul>
        </details>
    );
}

function CareerRecommendations({ items, sourceSnapshot, language, t, catalog }) {
    if (!items?.length) {
        const hasCareers = assessmentSources(sourceSnapshot).length > 0;
        return (
            <section className={styles.findingGroup}>
                <h4>{t('assessment_report_careers')}</h4>
                <p className={styles.muted}>
                    {hasCareers ? t('assessment_report_no_supported_career') : t('assessment_report_no_career_catalog')}
                </p>
            </section>
        );
    }

    const careers = new Map(assessmentSources(sourceSnapshot).map((career) => [career.career_path_id, career]));
    return (
        <section className={styles.findingGroup}>
            <h4>{t('assessment_report_careers')}</h4>
            <div className={styles.findingList}>
                {items.map((item) => {
                    const career = careers.get(item.career_path_id);
                    const careerName = localizedValue({ th: career?.name_th, en: career?.name_en }, language, t('assessment_report_career'));
                    const competencies = career?.competencies || [];
                    return (
                        <article className={styles.finding} key={item.career_path_id}>
                            <h5>{careerName}</h5>
                            <p>{localizedValue(item.reason, language)}</p>
                            <p className={styles.advice}>{localizedValue(item.advice, language)}</p>
                            {competencies.length > 0 && (
                                <p className={styles.muted}>
                                    {t('assessment_report_related_competencies')}: {competencies
                                        .map((competency) => localizedValue({ th: competency.competency_name_th, en: competency.competency_name_en }, language))
                                        .join(', ')}
                                </p>
                            )}
                            <EvidenceList references={item.evidence_refs} catalog={catalog} t={t} />
                        </article>
                    );
                })}
            </div>
        </section>
    );
}

export default function LearnerAssessmentReportPanel({ semester }) {
    const { language, t } = useLanguage();
    const [view, setView] = useState({ phase: 'idle', data: null, error: null, pollingPaused: false, actionLoading: false });
    const controllerRef = useRef(null);

    const applyState = useCallback((data, signal, pollingPaused = false) => {
        if (signal.aborted || controllerRef.current?.signal !== signal) return;
        setView((current) => ({
            ...current,
            phase: 'ready',
            data,
            error: null,
            retryAfterSeconds: 0,
            pollingPaused,
        }));
    }, []);

    useEffect(() => {
        if (!semester) {
            setView({ phase: 'idle', data: null, error: null, pollingPaused: false, actionLoading: false });
            return undefined;
        }

        const controller = new AbortController();
        controllerRef.current = controller;
        const { signal } = controller;
        setView({ phase: 'loading', data: null, error: null, pollingPaused: false, actionLoading: false });

        loadAssessmentReport(semester, reportDependencies(signal, (data) => applyState(data, signal)))
            .then((result) => applyState(result.state, signal, result.pollingPaused))
            .catch((error) => {
            if (error?.name === 'AbortError' || signal.aborted) return;
            setView((current) => ({ ...current, phase: 'error', error, pollingPaused: Boolean(current.data?.job) }));
        });

        return () => {
            controller.abort();
            if (controllerRef.current === controller) controllerRef.current = null;
        };
    }, [applyState, semester]);

    const generate = async (force) => {
        const controller = controllerRef.current;
        if (!semester || !controller || controller.signal.aborted || view.actionLoading) return;
        const { signal } = controller;
        setView((current) => ({ ...current, actionLoading: true, error: null, retryAfterSeconds: 0 }));
        try {
            let data = await generateLearnerAssessmentReport(semester, force, { signal });
            applyState(data, signal);
            if (isAssessmentJobActive(data?.job)) {
                const result = await monitorAssessmentReport(data, reportDependencies(signal, (next) => applyState(next, signal)), 1);
                applyState(result.state, signal, result.pollingPaused);
            }
        } catch (error) {
            if (error?.name === 'AbortError' || signal.aborted) return;
            setView((current) => ({
                ...current,
                phase: current.data ? 'ready' : 'error',
                error,
                retryAfterSeconds: assessmentRetryAfter(error),
            }));
        } finally {
            if (!signal.aborted && controllerRef.current?.signal === signal) {
                setView((current) => ({ ...current, actionLoading: false }));
            }
        }
    };

    const refresh = async () => {
        const controller = controllerRef.current;
        if (!controller || controller.signal.aborted || view.actionLoading) return;
        const { signal } = controller;
        setView((current) => ({ ...current, actionLoading: true, error: null }));
        try {
            const result = await loadAssessmentReport(
                semester,
                reportDependencies(signal, (data) => applyState(data, signal)),
            );
            applyState(result.state, signal, result.pollingPaused);
        } catch (error) {
            if (error?.name === 'AbortError' || signal.aborted) return;
            setView((current) => ({ ...current, phase: current.data ? 'ready' : 'error', error }));
        } finally {
            if (!signal.aborted && controllerRef.current?.signal === signal) {
                setView((current) => ({ ...current, actionLoading: false }));
            }
        }
    };

    const data = view.data;
    const report = data?.report;
    const content = reportContent(report);
    const sourceSnapshot = report?.source_snapshot;
    const catalog = evidenceCatalog(sourceSnapshot, language);
    const active = isAssessmentJobActive(data?.job);
    const isLoading = view.phase === 'loading';
    const sourceAvailability = data?.availability || [];
    const unavailableSources = sourceAvailability.filter((source) => !source.available || source.reason_code);
    const currentErrorCode = view.error?.code;
    const jobFailed = data?.job?.status === 'failed';

    if (!semester) return null;

    return (
        <section className={styles.panel} aria-labelledby="learner-assessment-title" aria-live="polite">
            <div className={styles.header}>
                <div>
                    <h3 id="learner-assessment-title">
                        <Brain size={19} aria-hidden="true" />
                        {t('assessment_report_title')}
                    </h3>
                    <p>{t('assessment_report_description')}</p>
                </div>
                {report && !active && (
                    <button
                        type="button"
                        className={styles.action}
                        onClick={() => generate(true)}
                        disabled={view.actionLoading || data?.generation_state === 'context_exceeded'}
                    >
                        <RefreshCw size={15} aria-hidden="true" />
                        {t('assessment_report_regenerate')}
                    </button>
                )}
            </div>

            {isLoading && (
                <div className={styles.state} role="status">
                    <span className={styles.spinner} aria-hidden="true" />
                    {t('assessment_report_loading')}
                </div>
            )}

            {view.phase === 'error' && !isLoading && (
                <div className={`${styles.state} ${styles.error}`} role="alert">
                    <AlertCircle size={17} aria-hidden="true" />
                    <span>{t('assessment_report_load_error')}</span>
                    <button type="button" className={styles.action} onClick={refresh} disabled={view.actionLoading}>
                        <RefreshCw size={15} aria-hidden="true" />
                        {t('learner_coop_retry')}
                    </button>
                </div>
            )}

            {view.error && view.phase === 'ready' && (
                <p className={styles.inlineError} role="alert">
                    {currentErrorCode === 'ASSESSMENT_COOLDOWN'
                        ? `${t('assessment_report_cooldown')} ${view.retryAfterSeconds || 1} ${t('assessment_report_seconds')}`
                        : t('assessment_report_generate_error')}
                </p>
            )}

            {jobFailed && data?.generation_state !== 'context_exceeded' && (
                <p className={styles.inlineError} role="status">
                    {jobErrorMessage(data.job.error_code, t)}
                    {data.job.failure_wait_until && ` · ${t('assessment_report_retry_later')}`}
                </p>
            )}

            {!isLoading && data?.generation_state === 'insufficient_data' && (
                <div className={styles.state} role="status">
                    <AlertCircle size={18} aria-hidden="true" />
                    <div>
                        <strong>{t('assessment_report_insufficient_title')}</strong>
                        <p>{t('assessment_report_insufficient_description')}</p>
                    </div>
                </div>
            )}

            {!isLoading && data?.generation_state === 'context_exceeded' && (
                <div className={styles.state} role="status">
                    <AlertCircle size={18} aria-hidden="true" />
                    <div>
                        <strong>{t('assessment_report_context_exceeded')}</strong>
                        <p>{t('assessment_report_context_exceeded_description')}</p>
                    </div>
                </div>
            )}

            {!isLoading && active && !report && (
                <div className={styles.state} role="status">
                    <span className={styles.spinner} aria-hidden="true" />
                    {data.generation_state === 'queued' ? t('assessment_report_queued') : t('assessment_report_generating')}
                </div>
            )}

            {!isLoading && data?.generation_state === 'missing' && !active && (
                <div className={styles.state}>
                    <span>{t('assessment_report_not_created')}</span>
                    <button type="button" className={styles.action} onClick={() => generate(false)} disabled={view.actionLoading}>
                        <Brain size={15} aria-hidden="true" />
                        {t('assessment_report_generate')}
                    </button>
                </div>
            )}

            {!isLoading && data?.generation_state === 'failed' && !report && (
                <div className={styles.state}>
                    <span>{t('assessment_report_not_created')}</span>
                    <button type="button" className={styles.action} onClick={() => generate(false)} disabled={view.actionLoading}>
                        <RefreshCw size={15} aria-hidden="true" />
                        {t('assessment_report_generate')}
                    </button>
                </div>
            )}

            {report && content && (
                <div className={styles.report}>
                    {active && (
                        <p className={styles.progress} role="status">
                            <span className={styles.spinner} aria-hidden="true" />
                            {t('assessment_report_regenerating_current')}
                        </p>
                    )}
                    <div className={styles.readinessExplanation}>
                        <h4>{t('assessment_report_readiness')}</h4>
                        <p>{localizedValue(content.readiness_explanation, language)}</p>
                    </div>

                    <div className={styles.findings}>
                        <ReportFindings title={t('assessment_report_strengths')} items={content.strengths} language={language} t={t} catalog={catalog} />
                        <ReportFindings title={t('assessment_report_limitations')} items={content.limitations} language={language} t={t} catalog={catalog} />
                        <CareerRecommendations items={content.career_recommendations} sourceSnapshot={sourceSnapshot} language={language} t={t} catalog={catalog} />
                    </div>

                    {content.career_recommendation_reason && (
                        <p className={styles.muted}>{t('assessment_report_no_supported_career')}</p>
                    )}

                    {unavailableSources.length > 0 && (
                        <section className={styles.availability}>
                            <h4>{t('assessment_report_partial_sources')}</h4>
                            <ul>
                                {unavailableSources.map((source) => (
                                    <li key={source.source}>
                                        <span>{availabilityLabel(source.source, t)}</span>
                                        <span>{availabilityReason(source.reason_code, t)}</span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    <p className={styles.disclaimer}>{t('assessment_report_disclaimer')}</p>
                </div>
            )}

            {!isLoading && !report && data && data.generation_state !== 'context_exceeded' && sourceAvailability.length > 0 && (
                <section className={styles.availability}>
                    <h4>{t('assessment_report_available_sources')}</h4>
                    <ul>
                        {sourceAvailability.map((source) => (
                            <li key={source.source}>
                                <span className={source.available && !source.reason_code ? styles.available : styles.unavailable}>
                                    {source.available && !source.reason_code ? <CheckCircle2 size={15} aria-hidden="true" /> : <AlertCircle size={15} aria-hidden="true" />}
                                    {availabilityLabel(source.source, t)}
                                </span>
                                {!source.available && <span>{availabilityReason(source.reason_code, t)}</span>}
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {view.pollingPaused && active && (
                <div className={styles.pollingPaused}>
                    <span>{t('assessment_report_polling_paused')}</span>
                    <button type="button" className={styles.action} onClick={refresh} disabled={view.actionLoading}>
                        <RefreshCw size={15} aria-hidden="true" />
                        {t('assessment_report_check_status')}
                    </button>
                </div>
            )}
        </section>
    );
}
