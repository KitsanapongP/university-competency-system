import assert from 'node:assert/strict';
import test from 'node:test';
import { ASSESSMENT_NARRATIVE_SCHEMA, ASSESSMENT_NARRATIVE_SECTIONS, isAssessmentNarrative } from './learner-assessment-narrative.mjs';

test('narrative guard rejects legacy reports and incomplete bilingual paragraphs', () => {
  const content = { schema_version: ASSESSMENT_NARRATIVE_SCHEMA, narrative: Object.fromEntries(ASSESSMENT_NARRATIVE_SECTIONS.map(([key]) => [key, []])) };
  assert.equal(isAssessmentNarrative(content), true);
  content.narrative.development.push({ text: { th: 'แนะนำให้ทบทวน', en: 'Consider reviewing your work.' }, evidence_refs: ['course:1'] });
  assert.equal(isAssessmentNarrative(content), true);
  content.narrative.development[0].text.en = '';
  assert.equal(isAssessmentNarrative(content), false);
  assert.equal(isAssessmentNarrative({ strengths: [], limitations: [] }), false);
});
