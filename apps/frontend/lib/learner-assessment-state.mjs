export function shouldAutoGenerateAssessment(state) {
  return state?.generation_state === 'missing'
    && state?.completeness !== 'none'
    && !state?.report;
}

export function isAssessmentJobActive(job) {
  return job?.status === 'queued' || job?.status === 'running';
}

export function assessmentPollDelay(attempt) {
  const safeAttempt = Math.max(0, Number.isFinite(attempt) ? Math.floor(attempt) : 0);
  return Math.min(2500 * (2 ** Math.min(safeAttempt, 2)), 8000);
}

export function assessmentGenerationStateForJob(job) {
  return job?.status === 'running' ? 'generating' : 'queued';
}

export function assessmentRetryAfter(error) {
  const value = Number(error?.payload?.error?.retry_after_seconds);
  if (Number.isFinite(value) && value > 0) return Math.ceil(value);

  const headerValue = Number(error?.retryAfter);
  return Number.isFinite(headerValue) && headerValue > 0 ? Math.ceil(headerValue) : 0;
}

function abortableWait(delay, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      const error = new Error('Aborted');
      error.name = 'AbortError';
      reject(error);
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, delay);
    const abort = () => {
      clearTimeout(timer);
      const error = new Error('Aborted');
      error.name = 'AbortError';
      reject(error);
    };
    signal?.addEventListener('abort', abort, { once: true });
  });
}

export async function monitorAssessmentReport(initialState, dependencies, automaticRetries = 0) {
  const {
    signal,
    onState = () => {},
    getReport,
    getJob,
    generate,
    wait = abortableWait,
    getPollDelay = assessmentPollDelay,
    maxPollAttempts = 40,
  } = dependencies;
  let state = initialState;
  let attempt = 0;
  while (isAssessmentJobActive(state?.job) && attempt < maxPollAttempts) {
    await wait(getPollDelay(attempt), signal);
    const job = await getJob(state.job.job_id, { signal });
    attempt += 1;
    if (isAssessmentJobActive(job)) {
      state = { ...state, job, generation_state: assessmentGenerationStateForJob(job) };
      onState(state);
      continue;
    }

    state = await getReport(state.semester, { signal });
    onState(state);
    if (automaticRetries < 1 && shouldAutoGenerateAssessment(state)) {
      automaticRetries += 1;
      state = await generate(state.semester, false, { signal });
      onState(state);
    }
  }
  return { state, pollingPaused: isAssessmentJobActive(state?.job) };
}

export async function loadAssessmentReport(semester, dependencies) {
  const { signal, onState = () => {}, getReport, generate } = dependencies;
  let state = await getReport(semester, { signal });
  onState(state);
  let automaticRetries = 0;
  if (shouldAutoGenerateAssessment(state)) {
    automaticRetries += 1;
    state = await generate(semester, false, { signal });
    onState(state);
  }
  return monitorAssessmentReport(state, dependencies, automaticRetries);
}
