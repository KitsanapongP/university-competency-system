import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assessmentGenerationStateForJob,
  assessmentPollDelay,
  assessmentRetryAfter,
  isAssessmentJobActive,
  loadAssessmentReport,
  monitorAssessmentReport,
  shouldAutoGenerateAssessment,
  waitForAssessmentPoll,
} from './learner-assessment-state.mjs';

test('automatic generation only starts for missing reports with available source data', () => {
  assert.equal(shouldAutoGenerateAssessment({ generation_state: 'missing', completeness: 'partial' }), true);
  assert.equal(shouldAutoGenerateAssessment({ generation_state: 'missing', completeness: 'none' }), false);
  assert.equal(shouldAutoGenerateAssessment({ generation_state: 'missing', completeness: 'full', generation_available: false }), false);
  assert.equal(shouldAutoGenerateAssessment({ generation_state: 'failed', completeness: 'full' }), false);
  assert.equal(shouldAutoGenerateAssessment({ generation_state: 'missing', completeness: 'full', report: {} }), false);
});

test('job polling is limited to queued and running jobs', () => {
  assert.equal(isAssessmentJobActive({ status: 'queued' }), true);
  assert.equal(isAssessmentJobActive({ status: 'running' }), true);
  assert.equal(isAssessmentJobActive({ status: 'succeeded' }), false);
  assert.equal(isAssessmentJobActive(null), false);
  assert.equal(assessmentGenerationStateForJob({ status: 'running' }), 'generating');
  assert.equal(assessmentGenerationStateForJob({ status: 'queued' }), 'queued');
});

test('poll interval stays fixed at 2.5 seconds', () => {
  assert.deepEqual([0, 1, 2, 3, 10].map(assessmentPollDelay), [2500, 2500, 2500, 2500, 2500]);
});

test('poll wait pauses while the document is hidden and resumes immediately when visible', async () => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const listeners = new Set();
  const documentStub = {
    visibilityState: 'hidden',
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener),
  };
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: documentStub,
  });

  try {
    let settled = false;
    const pending = waitForAssessmentPoll(2500).then(() => { settled = true; });
    await Promise.resolve();
    assert.equal(settled, false);

    documentStub.visibilityState = 'visible';
    listeners.forEach((listener) => listener());
    await pending;
    assert.equal(settled, true);
    assert.equal(listeners.size, 0);
  } finally {
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else delete globalThis.document;
  }
});

test('cooldown retry time is read from the structured API error', () => {
  assert.equal(assessmentRetryAfter({ payload: { error: { retry_after_seconds: 29 } } }), 29);
  assert.equal(assessmentRetryAfter({ payload: { error: { retry_after_seconds: 0 } }, retryAfter: 6 }), 6);
  assert.equal(assessmentRetryAfter(new Error('failure')), 0);
});

test('missing report is generated once and polls its job without repeating source GETs', async () => {
  const calls = { reports: [], jobs: 0, generations: 0, waits: [] };
  const current = { semester: 2, generation_state: 'current', completeness: 'full', report: { report_id: 7 } };
  const result = await loadAssessmentReport(2, {
    getReport: async (semester) => {
      calls.reports.push(semester);
      return calls.reports.length === 1
        ? { semester, generation_state: 'missing', completeness: 'partial' }
        : current;
    },
    generate: async (semester, force) => {
      calls.generations += 1;
      assert.equal(semester, 2);
      assert.equal(force, false);
      return { semester, generation_state: 'queued', completeness: 'partial', job: { job_id: 12, status: 'queued' } };
    },
    getJob: async () => {
      calls.jobs += 1;
      return { job_id: 12, status: 'succeeded' };
    },
    wait: async (delay) => calls.waits.push(delay),
  });

  assert.equal(result.state.report.report_id, 7);
  assert.equal(result.pollingPaused, false);
  assert.deepEqual(calls.reports, [2, 2]);
  assert.equal(calls.generations, 1);
  assert.equal(calls.jobs, 1);
  assert.deepEqual(calls.waits, [2500]);
});

test('failed generation does not automatically retry', async () => {
  let generationCount = 0;
  let reportCount = 0;
  const initial = { semester: 1, generation_state: 'queued', completeness: 'full', job: { job_id: 3, status: 'queued' } };
  const result = await monitorAssessmentReport(initial, {
    getReport: async () => {
      reportCount += 1;
      return { semester: 1, generation_state: 'failed', completeness: 'full', job: { status: 'failed', error_code: 'invalid_output' } };
    },
    getJob: async () => ({ job_id: 3, status: 'failed' }),
    generate: async () => { generationCount += 1; },
    wait: async () => {},
  });

  assert.equal(result.state.generation_state, 'failed');
  assert.equal(reportCount, 1);
  assert.equal(generationCount, 0);
});

test('polling is bounded and reports that the job is still active', async () => {
  let jobsRead = 0;
  const result = await monitorAssessmentReport({
    semester: 1,
    generation_state: 'queued',
    job: { job_id: 5, status: 'queued' },
  }, {
    getJob: async () => {
      jobsRead += 1;
      return { job_id: 5, status: 'running' };
    },
    wait: async () => {},
    maxPollAttempts: 3,
  });
  assert.equal(jobsRead, 3);
  assert.equal(result.pollingPaused, true);
  assert.equal(result.state.job.status, 'running');
});

test('default foreground polling stops after five minutes', async () => {
  let jobsRead = 0;
  const delays = [];
  const result = await monitorAssessmentReport({
    semester: 1,
    generation_state: 'queued',
    job: { job_id: 6, status: 'queued' },
  }, {
    getJob: async () => {
      jobsRead += 1;
      return { job_id: 6, status: 'running' };
    },
    wait: async (delay) => delays.push(delay),
  });

  assert.equal(jobsRead, 120);
  assert.equal(delays.reduce((total, delay) => total + delay, 0), 300000);
  assert.equal(result.pollingPaused, true);
});
