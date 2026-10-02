import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAssessmentEvidenceCatalog } from './learner-assessment-evidence.mjs';

const sourceSnapshot = {
  provider_input: {
    academic_evidence: [
      {
        evidence_ref: 'course:1',
        course_code: 'CS101',
        course_name_th: 'การเขียนโปรแกรม',
        course_name_en: 'Programming',
        grade: 'A',
        academic_year_be: 2569,
      },
    ],
    competency_scores: [
      {
        competency_ref: 'competency:1',
        name_th: 'การแก้ปัญหา',
        name_en: 'Problem solving',
        course_scores: [
          {
            evidence_ref: 'score:course:1',
            course_evidence_ref: 'course:1',
            weighted_score: 18,
          },
        ],
        activity_scores: [
          {
            evidence_ref: 'score:activity:1',
            activity_evidence_ref: 'activity:1',
          },
        ],
      },
    ],
    activity_evidence: [
      {
        evidence_ref: 'activity:1',
        score_evidence_ref: 'score:activity:1',
        activity_name_th: 'โครงการพัฒนาระบบ',
        activity_name_en: 'System development project',
        start_at: '2026-02-10T09:00:00Z',
        earned_percent: 80,
      },
    ],
  },
};

test('course score references resolve their label from centralized academic evidence', () => {
  const catalog = buildAssessmentEvidenceCatalog(sourceSnapshot, 'en', 'weighted points');

  assert.equal(catalog.get('course:1'), 'CS101 · Programming · A · 2569');
  assert.equal(catalog.get('score:course:1'), 'CS101 · Programming · A · 2569 · 18 weighted points · Problem solving');
});

test('activity score references resolve their label from centralized activity evidence', () => {
  const catalog = buildAssessmentEvidenceCatalog(sourceSnapshot, 'th', 'คะแนนถ่วงน้ำหนัก');

  assert.equal(catalog.get('score:activity:1'), 'โครงการพัฒนาระบบ · 2026-02-10 · 80%');
  assert.equal(catalog.get('activity:1'), catalog.get('score:activity:1'));
});

test('labels fall back to Thai when English data is missing and ignore unknown references', () => {
  const snapshot = {
    provider_input: {
      academic_evidence: [{ evidence_ref: 'course:2', course_code: 'CS202', course_name_th: 'โครงสร้างข้อมูล' }],
      competency_scores: [],
      activity_evidence: [],
    },
  };
  const catalog = buildAssessmentEvidenceCatalog(snapshot, 'en', 'weighted points');

  assert.equal(catalog.get('course:2'), 'CS202 · โครงสร้างข้อมูล');
  assert.equal(catalog.get('missing:reference'), undefined);
});
