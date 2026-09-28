import assert from 'node:assert/strict';
import test from 'node:test';
import {
    cloneCooperativeRequirement,
    cloneSelectedCooperativeRequirements,
    duplicateCooperativeRequirement,
    isCopyableCooperativeRequirement,
    preferredCooperativeRequirementCopySource,
} from './cooperative-requirement-copy.mjs';

const requirements = [
    {
        clientId: 'row-1',
        requirementId: 21,
        criterionType: 'overall_gpa',
        nameTh: 'เกรดเฉลี่ยรวม',
        nameEn: 'Overall GPA',
        minimumValue: '3.00',
        minimumGrade: '',
        categoryId: '',
        courseId: '',
        displayOrder: 1,
    },
    {
        clientId: 'row-2',
        requirementId: 22,
        criterionType: '',
        nameTh: '',
        nameEn: '',
        minimumValue: '',
        minimumGrade: '',
        categoryId: '',
        courseId: '',
    },
    {
        clientId: 'row-3',
        requirementId: 23,
        criterionType: 'course_grade',
        nameTh: 'วิชาสัมมนา',
        nameEn: 'Seminar',
        minimumValue: '',
        minimumGrade: 'D',
        categoryId: '',
        courseId: '104',
    },
];

test('only configured requirements can be copied', () => {
    assert.equal(isCopyableCooperativeRequirement(requirements[0]), true);
    assert.equal(isCopyableCooperativeRequirement(requirements[1]), false);
    assert.equal(isCopyableCooperativeRequirement(null), false);
});

test('a configured draft is preferred as the source over the active set', () => {
    const draft = { revision: 2, requirements: [requirements[2]] };
    const published = { revision: 1, requirements: [requirements[0]] };

    assert.equal(preferredCooperativeRequirementCopySource(draft, published), draft);
});

test('the active set is used when the draft has no configured requirements', () => {
    const draft = { revision: 2, requirements: [requirements[1]] };
    const published = { revision: 1, requirements: [requirements[0]] };

    assert.equal(preferredCooperativeRequirementCopySource(draft, published), published);
    assert.equal(preferredCooperativeRequirementCopySource(null, null), null);
});

test('cloning resets persisted identity and copies editable fields only', () => {
    const source = requirements[0];
    const clone = cloneCooperativeRequirement(source, 'copy-1');

    assert.deepEqual(clone, {
        clientId: 'copy-1',
        requirementId: 0,
        criterionType: 'overall_gpa',
        nameTh: 'เกรดเฉลี่ยรวม',
        nameEn: 'Overall GPA',
        minimumValue: '3.00',
        minimumGrade: '',
        categoryId: '',
        courseId: '',
    });
    assert.equal(source.requirementId, 21);
    assert.equal(source.clientId, 'row-1');
});

test('duplicating one requirement inserts a new unsaved row immediately after it', () => {
    const result = duplicateCooperativeRequirement(
        requirements,
        'row-1',
        () => 'copy-1',
    );

    assert.equal(result.duplicateClientId, 'copy-1');
    assert.deepEqual(result.requirements.map((item) => item.clientId), [
        'row-1',
        'copy-1',
        'row-2',
        'row-3',
    ]);
    assert.equal(result.requirements[1].requirementId, 0);
    assert.equal(requirements.length, 3);
});

test('an incomplete requirement cannot be duplicated', () => {
    const result = duplicateCooperativeRequirement(
        requirements,
        'row-2',
        () => 'copy-2',
    );

    assert.equal(result.duplicateClientId, '');
    assert.equal(result.requirements, requirements);
});

test('cross-semester copying preserves source order and copies only selected configured rows', () => {
    const nextIds = ['copy-1', 'copy-3'];
    const result = cloneSelectedCooperativeRequirements(
        requirements,
        ['row-3', 'row-2', 'row-1'],
        () => nextIds.shift(),
    );

    assert.deepEqual(result.map((item) => item.clientId), ['copy-1', 'copy-3']);
    assert.deepEqual(result.map((item) => item.criterionType), ['overall_gpa', 'course_grade']);
    assert.deepEqual(result.map((item) => item.requirementId), [0, 0]);
    assert.equal(requirements[0].requirementId, 21);
    assert.equal(requirements[2].requirementId, 23);
});
