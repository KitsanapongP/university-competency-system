'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Brain, CheckCircle2, Circle, RefreshCw } from 'lucide-react';
import { useLanguage } from '../../providers/LanguageContext';
import {
    fetchLearnerAssessmentJob,
    fetchLearnerAssessmentReport,
    generateLearnerAssessmentReport,
} from '../../lib/learner-assessment';
import {
    loadAssessmentReport,
    monitorAssessmentReport,
    assessmentGenerationStateForJob,
    assessmentRetryAfter,
    isAssessmentJobActive,
} from '../../lib/learner-assessment-state.mjs';
import { buildAssessmentEvidenceCatalog } from '../../lib/learner-assessment-evidence.mjs';
import { isAssessmentNarrative } from '../../lib/learner-assessment-narrative.mjs';
import { LearnerAssessmentNarrative } from './LearnerAssessmentNarrative';
import { LearnerAssessmentRejectedDraft } from './LearnerAssessmentRejectedDraft';
import styles from './LearnerAssessmentReportPanel.module.css';

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
    };
    return labels[reason] || t('assessment_reason_not_available');
}

function jobErrorMessage(code, t) {
    const labels = {
        provider_timeout: t('assessment_error_provider_timeout'),
		provider_authentication: t('assessment_error_api_auth'),
		provider_configuration: t('assessment_error_api_configuration'),
		provider_request_rejected: t('assessment_error_api_request'),
		provider_rate_limited: t('assessment_error_api_rate_limit'),
		api_quota_exhausted: t('assessment_error_api_quota'),
		provider_refusal: t('assessment_error_api_refusal'),
		truncated_output: t('assessment_error_output_truncated'),
		empty_output: t('assessment_error_malformed_output'),
        provider_unavailable: t('assessment_error_provider_unavailable'),
        model_not_found: t('assessment_error_model_missing'),
        invalid_output: t('assessment_error_invalid_output'),
		malformed_output: t('assessment_error_malformed_output'),
		provider_output_truncated: t('assessment_error_output_truncated'),
		provider_incomplete_response: t('assessment_error_output_truncated'),
        source_superseded: t('assessment_error_source_changed'),
        context_exceeded: t('assessment_report_context_exceeded'),
        pipeline_version_unsupported: t('assessment_error_version_changed'),
        worker_unavailable: t('assessment_error_worker_unavailable'),
        provider_stream_stalled: t('assessment_error_provider_stalled'),
    };
    return labels[code] || t('assessment_error_generic');
}

function formatDiagnosticBytes(value) {
    const bytes = Number(value) || 0;
    return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

const GENERATION_PHASES = ['queued', 'preparing', 'generating', 'validating', 'saving', 'completed'];

function timestampValue(value) {
    const timestamp = Date.parse(value || '');
    return Number.isFinite(timestamp) ? timestamp : null;
}

function formatElapsed(seconds) {
    const safeSeconds = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(safeSeconds / 60);
    return `${minutes}:${String(safeSeconds % 60).padStart(2, '0')}`;
}

function GenerationProgress({ job, paused, t, onCheckStatus, checking }) {
    const [clock, setClock] = useState(() => timestampValue(job?.server_time) || 0);
    const serverTime = timestampValue(job?.server_time);
    const now = clock;
    const requestedAt = timestampValue(job?.requested_at);
    const phaseStartedAt = timestampValue(job?.phase_started_at);
    const lastProviderActivityAt = timestampValue(job?.last_provider_activity_at);
    const phase = GENERATION_PHASES.includes(job?.progress_phase)
        ? job.progress_phase
        : job?.status === 'queued' ? 'queued' : 'generating';
    const currentIndex = GENERATION_PHASES.indexOf(phase);
    const inactiveSince = lastProviderActivityAt || (phase === 'generating' ? phaseStartedAt : null);
    const inactivitySeconds = inactiveSince == null ? 0 : Math.floor((now - inactiveSince) / 1000);
    const attemptCount = Number(job?.attempt_count) || 0;
    const maxAttempts = Number(job?.max_attempts) || 0;
    const totalSeconds = requestedAt == null ? null : Math.max(0, Math.floor((now - requestedAt) / 1000));
    const phaseSeconds = phaseStartedAt == null ? null : Math.max(0, Math.floor((now - phaseStartedAt) / 1000));

    useEffect(() => {
        if (paused) return undefined;
        const serverOffset = serverTime == null ? 0 : serverTime - Date.now();
        const timer = window.setInterval(() => setClock(Date.now() + serverOffset), 1000);
        return () => window.clearInterval(timer);
    }, [paused, serverTime]);

    return (
        <section className={styles.generationProgress} aria-label={t('assessment_report_progress')}>
            <div className={styles.progressHeading}>
                <div>
                    <strong>{t(`assessment_phase_${phase}`)}</strong>
                    <span>{t('assessment_report_generation_explainer')}</span>
                </div>
                {!paused && <span className={styles.spinner} aria-hidden="true" />}
            </div>

            <ol className={styles.phaseList}>
                {GENERATION_PHASES.map((item, index) => {
                    const isComplete = index < currentIndex;
                    const isCurrent = index === currentIndex;
                    return (
                        <li
                            className={[
                                styles.phaseItem,
                                isComplete ? styles.phaseComplete : '',
                                isCurrent ? styles.phaseCurrent : '',
                            ].filter(Boolean).join(' ')}
                            key={item}
                            aria-current={isCurrent ? 'step' : undefined}
                        >
                            {isComplete
                                ? <CheckCircle2 size={16} aria-hidden="true" />
                                : isCurrent && !paused
                                    ? <span className={styles.phaseSpinner} aria-hidden="true" />
                                    : <Circle size={16} aria-hidden="true" />}
                            <span>{t(`assessment_phase_${item}`)}</span>
                        </li>
                    );
                })}
            </ol>

            <div className={styles.progressDetails}>
                {totalSeconds != null && <span>{t('assessment_report_elapsed')}: {formatElapsed(totalSeconds)}</span>}
                {phaseSeconds != null && <span>{t('assessment_report_phase_elapsed')}: {formatElapsed(phaseSeconds)}</span>}
                {attemptCount > 0 && maxAttempts > 0 && (
                    <span>{t('assessment_report_attempt')}: {attemptCount}/{maxAttempts}</span>
                )}
            </div>

            {phase === 'generating' && inactivitySeconds >= 30 && (
                <p className={styles.inactivityNotice}>
                    <AlertCircle size={16} aria-hidden="true" />
                    {t('assessment_report_no_provider_activity')} {formatElapsed(inactivitySeconds)}
                </p>
            )}

            {paused && (
                <div className={styles.pollingPaused}>
                    <span>{t('assessment_report_polling_paused')}</span>
                    <button type="button" className={styles.action} onClick={onCheckStatus} disabled={checking}>
                        <RefreshCw size={15} aria-hidden="true" />
                        {checking ? t('assessment_report_checking_status') : t('assessment_report_check_status')}
                    </button>
                </div>
            )}
        </section>
    );
}

function ContextDiagnostics({ diagnostics, t }) {
    if (!diagnostics) return null;

    const sections = [
        ['assessment_context_readiness', diagnostics.readiness_bytes],
        ['assessment_context_availability', diagnostics.availability_bytes],
        ['assessment_context_academic_evidence', diagnostics.academic_evidence_bytes],
        ['assessment_context_competency_scores', diagnostics.competency_scores_bytes],
        ['assessment_context_activity_evidence', diagnostics.activity_evidence_bytes],
        ['assessment_context_system_prompt', diagnostics.system_prompt_bytes],
        ['assessment_context_user_prompt', diagnostics.user_prompt_bytes],
    ];

    return (
        <div className={styles.contextDiagnostics}>
            <div className={styles.contextSummary}>
                <span>{t('assessment_context_estimated_total')}</span>
                <strong>{diagnostics.estimated_total_tokens} / {diagnostics.context_tokens} tokens</strong>
                <span>{t('assessment_context_input_budget')}: {diagnostics.estimated_input_tokens} / {diagnostics.input_budget_tokens} tokens</span>
                <span>{t('assessment_context_output_reserve')}: {diagnostics.output_reserve_tokens} tokens · {t('assessment_context_safety_margin')}: {diagnostics.safety_margin_tokens} tokens</span>
                <span>{t('assessment_context_source_data')}: {formatDiagnosticBytes(diagnostics.source_data_bytes)}</span>
                {diagnostics.academic_record_count != null && (
                    <span>{t('assessment_context_academic_groups')}: {diagnostics.academic_record_count} / {diagnostics.academic_group_count}</span>
                )}
            </div>
            <dl>
                {sections.map(([label, bytes]) => (
                    <div key={label}>
                        <dt>{t(label)}</dt>
                        <dd>{formatDiagnosticBytes(bytes)}</dd>
                    </div>
                ))}
            </dl>
        </div>
    );
}

export default function LearnerAssessmentReportPanel({ semester, onGenerationActiveChange }) {
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

    const checkJobStatus = async () => {
        const controller = controllerRef.current;
        const jobID = view.data?.job?.job_id;
        if (!controller || controller.signal.aborted || !jobID || view.actionLoading) return;
        const { signal } = controller;
        setView((current) => ({ ...current, actionLoading: true, error: null }));
        try {
            const job = await fetchLearnerAssessmentJob(jobID, { signal });
            if (isAssessmentJobActive(job)) {
                applyState({
                    ...view.data,
                    job,
                    generation_state: assessmentGenerationStateForJob(job),
                }, signal, true);
            } else {
                applyState(await fetchLearnerAssessmentReport(semester, { signal }), signal);
            }
        } catch (error) {
            if (error?.name === 'AbortError' || signal.aborted) return;
            setView((current) => ({ ...current, error }));
        } finally {
            if (!signal.aborted && controllerRef.current?.signal === signal) {
                setView((current) => ({ ...current, actionLoading: false }));
            }
        }
    };

    const data = view.data;
    const report = data?.report;
    const parsedContent = reportContent(report);
    const content = isAssessmentNarrative(parsedContent) ? parsedContent : null;
    const sourceSnapshot = report?.source_snapshot;
    const catalog = buildAssessmentEvidenceCatalog(
        sourceSnapshot,
        language,
        t('assessment_evidence_weighted_points'),
    );
    const active = isAssessmentJobActive(data?.job);
    const isLoading = view.phase === 'loading';
    const sourceAvailability = data?.availability || [];
    const currentErrorCode = view.error?.code;
    const jobFailed = data?.job?.status === 'failed';

    useEffect(() => {
        onGenerationActiveChange?.(active);
    }, [active, onGenerationActiveChange]);

    useEffect(() => () => onGenerationActiveChange?.(false), [onGenerationActiveChange]);

    if (!semester) return null;

    return (
        <section className={styles.panel} aria-labelledby="learner-assessment-title">
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
                        <ContextDiagnostics diagnostics={data.context_diagnostics} t={t} />
                    </div>
                </div>
            )}

            {!isLoading && active && !report && (
                <GenerationProgress
                    job={data.job}
                    paused={view.pollingPaused}
                    t={t}
                    onCheckStatus={checkJobStatus}
                    checking={view.actionLoading}
                />
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

            {report && !content && !active && (
                <p className={styles.inlineError} role="status">
                    {t('assessment_report_format_changed')}
                </p>
            )}

            {!isLoading && <LearnerAssessmentRejectedDraft draft={data?.rejected_draft} language={language} t={t} />}

            {report && content && (
                <div className={styles.report}>
                    {active && (
                        <>
                            <p className={styles.progress} role="status">
                                {t('assessment_report_regenerating_current')}
                            </p>
                            <GenerationProgress
                                job={data.job}
                                paused={view.pollingPaused}
                                t={t}
                                onCheckStatus={checkJobStatus}
                                checking={view.actionLoading}
                            />
                        </>
                    )}
                    <LearnerAssessmentNarrative
                        content={content}
                        language={language}
                        t={t}
                        catalog={catalog}
                        provenance={sourceSnapshot?.provenance}
                    />

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

        </section>
    );
}
