import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAssessmentEvidenceCatalog, expandAssessmentEvidenceReferences } from './learner-assessment-evidence.mjs';

test('grouped references expand to every original record without duplicate keys', () => {
  const snapshot = {
    provider_input: { academic_evidence: [] },
    source: {
      academic_evidence: [{ evidence_ref: 'original:1', course_name_th: 'วิชาเดิม' }],
      activity_evidence: [{ evidence_ref: 'activity:original', activity_name_th: 'กิจกรรมเดิม' }],
    },
    provenance: { 'aggregate:1': ['original:1', 'original:2'] },
  };
  assert.deepEqual(expandAssessmentEvidenceReferences(['aggregate:1', 'original:1', 'unknown'], snapshot.provenance), ['original:1', 'original:2', 'unknown']);
  assert.equal(buildAssessmentEvidenceCatalog(snapshot, 'en', 'points').get('original:1'), 'วิชาเดิม');
  assert.equal(buildAssessmentEvidenceCatalog(snapshot, 'en', 'points').get('activity:original'), 'กิจกรรมเดิม');
});

test('readiness evidence resolves criterion names and official comparisons in both languages', () => {
  const snapshot = { provider_input: { readiness: { results: [
    { requirement_id: 7, name_th: 'เกรดเฉลี่ยรวม', name_en: 'Overall GPA', current_value: 3.25, required_value: 3 },
    { requirement_id: 8, name_th: 'สัมมนา', current_grade: 'C', required_grade: 'B' },
  ] } } };
  const english = buildAssessmentEvidenceCatalog(snapshot, 'en', 'weighted points');
  const thai = buildAssessmentEvidenceCatalog(snapshot, 'th', 'คะแนนถ่วงน้ำหนัก');
  assert.equal(english.get('readiness:7:0'), 'Overall GPA / Current: 3.25; Minimum: 3');
  assert.equal(thai.get('readiness:8:1'), 'สัมมนา / ค่าปัจจุบัน: C; ค่าขั้นต่ำ: B');
  assert.equal(english.get('readiness:8:1'), 'สัมมนา / Current: C; Minimum: B');
});

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
