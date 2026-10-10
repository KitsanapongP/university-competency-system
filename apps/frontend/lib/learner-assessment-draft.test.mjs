import test from 'node:test';
import assert from 'node:assert/strict';
import { assessmentDraftPreview, assessmentDraftReason } from './learner-assessment-draft.mjs';

test('draft preview hides stale and personal data, bounds Unicode text', () => {
    assert.equal(assessmentDraftPreview({ preview: 'old', is_stale: true }), '');
    assert.equal(assessmentDraftPreview({ preview: 'private', violation: { reason: 'pii_detected' } }), '');
    assert.equal(Array.from(assessmentDraftPreview({ preview: 'ก'.repeat(9000) })).length, 8000);
    assert.equal(assessmentDraftPreview({ preview: '<script>alert(1)</script>' }), '<script>alert(1)</script>');
});

test('specific rule takes priority and both languages explain failures', () => {
    assert.match(assessmentDraftReason({ reason: 'unsupported_claim', rule: 'numeric_literal' }, 'en'), /digits/);
    assert.match(assessmentDraftReason({ reason: 'duplicate_sentence' }, 'th'), /ซ้ำ/);
    assert.match(assessmentDraftReason({ reason: 'unknown-code' }, 'en'), /Validation failed/);
});
