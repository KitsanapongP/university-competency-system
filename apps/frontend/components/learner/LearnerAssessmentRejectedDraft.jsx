'use client';

import { AlertTriangle } from 'lucide-react';
import { assessmentDraftPreview, assessmentDraftReason } from '../../lib/learner-assessment-draft.mjs';
import styles from './LearnerAssessmentReportPanel.module.css';

export function LearnerAssessmentRejectedDraft({ draft, language, t }) {
    if (!draft) return null;
    const violation = draft.violation || {};
    const preview = assessmentDraftPreview(draft);
    return (
        <section className={styles.rejectedDraft} aria-label={t('assessment_draft_title')}>
            <div className={styles.draftWarning} role="status">
                <AlertTriangle size={20} aria-hidden="true" />
                <div>
                    <h4>{t('assessment_draft_title')}</h4>
                    <p>{t('assessment_draft_warning')}</p>
                </div>
            </div>
            {draft.previous_attempt && <p>{t('assessment_draft_previous')}</p>}
            {draft.is_stale && <p>{t('assessment_draft_stale')}</p>}
            <p>{assessmentDraftReason(violation, language)}</p>
            {(violation.reason === 'pii_detected' || preview.includes('[redacted]')) && <p className={styles.muted}>{t('assessment_draft_redacted')}</p>}
            <p className={styles.muted}>{t('assessment_draft_first_error')}</p>
            <dl className={styles.draftLocation}>
                {violation.section && <><dt>{t('assessment_draft_section')}</dt><dd>{['strengths', 'development', 'observations'].includes(violation.section) ? t(`assessment_report_${violation.section}`) : violation.section}</dd></>}
                {violation.paragraph_index > 0 && <><dt>{t('assessment_draft_paragraph')}</dt><dd>{violation.paragraph_index}</dd></>}
                {violation.sentence_index > 0 && <><dt>{t('assessment_draft_sentence')}</dt><dd>{violation.sentence_index}</dd></>}
                {violation.language && <><dt>{t('assessment_draft_language')}</dt><dd>{violation.language.toUpperCase()}</dd></>}
            </dl>
            <details className={styles.draftDetails}>
                <summary>{t('assessment_draft_details')}</summary>
                <code>{violation.reason}{violation.rule ? ` / ${violation.rule}` : ''}{violation.field ? ` / ${violation.field}` : ''}</code>
            </details>
            {preview && <details className={styles.draftDetails} open={!draft.previous_attempt}>
                <summary>{t('assessment_draft_content')}</summary>
                <pre className={styles.draftPreview}>{preview}</pre>
                {draft.truncated && <p className={styles.muted}>{t('assessment_draft_truncated')}</p>}
            </details>}
        </section>
    );
}
