export const ASSESSMENT_NARRATIVE_SCHEMA = 'learner-assessment-output-v1.1.0';

export const ASSESSMENT_NARRATIVE_SECTIONS = [
  ['readiness', 'assessment_report_readiness'],
  ['strengths', 'assessment_report_strengths'],
  ['development', 'assessment_report_development'],
  ['observations', 'assessment_report_observations'],
  ['data_scope', 'assessment_report_data_scope'],
];

export function isAssessmentNarrative(content) {
  return content?.schema_version === ASSESSMENT_NARRATIVE_SCHEMA
    && ASSESSMENT_NARRATIVE_SECTIONS.every(([key]) => Array.isArray(content?.narrative?.[key])
      && content.narrative[key].every((paragraph) => typeof paragraph?.text?.th === 'string'
        && paragraph.text.th.trim() && typeof paragraph?.text?.en === 'string'
        && paragraph.text.en.trim() && Array.isArray(paragraph.evidence_refs)));
}
