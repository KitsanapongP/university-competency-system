import { ASSESSMENT_NARRATIVE_SECTIONS, isAssessmentNarrative } from '../../lib/learner-assessment-narrative.mjs';
import { expandAssessmentEvidenceReferences } from '../../lib/learner-assessment-evidence.mjs';
import styles from './LearnerAssessmentReportPanel.module.css';

export function LearnerAssessmentNarrative({ content, language, t, catalog, provenance }) {
    if (!isAssessmentNarrative(content)) return null;

    return (
        <div className={styles.prose} lang={language === 'en' ? 'en' : 'th'}>
            {ASSESSMENT_NARRATIVE_SECTIONS.map(([section, label]) => {
                const paragraphs = content.narrative[section];
                if (!paragraphs.length) return null;

                return (
                    <section className={styles.proseSection} key={section}>
                        <h4>{t(label)}</h4>
                        {paragraphs.map((paragraph, index) => {
                            const references = expandAssessmentEvidenceReferences(paragraph.evidence_refs, provenance);

                            return (
                                <div className={styles.proseParagraph} key={`${section}-${index}`}>
                                    <p>{paragraph.text[language === 'en' ? 'en' : 'th']}</p>
                                    {references.length > 0 && (
                                        <details className={styles.evidence}>
                                            <summary>{t('assessment_report_evidence')}</summary>
                                            <ul>
                                                {references.map((reference) => (
                                                    <li key={reference}>
                                                        {catalog.get(reference) || t('assessment_report_evidence_unavailable')}
                                                    </li>
                                                ))}
                                            </ul>
                                        </details>
                                    )}
                                </div>
                            );
                        })}
                    </section>
                );
            })}
        </div>
    );
}
