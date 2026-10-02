import { apiFetch } from './api';

export async function fetchLearnerAssessmentReport(semester, options = {}) {
  const query = new URLSearchParams({ semester: String(semester) });
  const response = await apiFetch(`/api/v1/learner/assessment-report?${query}`, {
    method: 'GET',
    signal: options.signal,
  });
  return response.data;
}

export async function generateLearnerAssessmentReport(semester, force = false, options = {}) {
  const response = await apiFetch('/api/v1/learner/assessment-report/generate', {
    method: 'POST',
    signal: options.signal,
    body: JSON.stringify({ semester: Number(semester), force }),
  });
  return response.data;
}

export async function fetchLearnerAssessmentJob(jobID, options = {}) {
  const response = await apiFetch(`/api/v1/learner/assessment-report/jobs/${encodeURIComponent(jobID)}`, {
    method: 'GET',
    signal: options.signal,
  });
  return response.data;
}
