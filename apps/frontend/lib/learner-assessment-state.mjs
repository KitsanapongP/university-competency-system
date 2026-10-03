export function shouldAutoGenerateAssessment(state) {
  return state?.generation_state === 'missing'
    && state?.completeness !== 'none'
    && !state?.report;
}

export function isAssessmentJobActive(job) {
  return job?.status === 'queued' || job?.status === 'running';
}

export function assessmentPollDelay() {
  return 2500;
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

export function waitForAssessmentPoll(delay, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      const error = new Error('Aborted');
      error.name = 'AbortError';
      reject(error);
      return;
    }

    const visibilityDocument = globalThis.document;
    let timer = null;
    let settled = false;
    const cleanup = () => {
      if (timer !== null) clearTimeout(timer);
      visibilityDocument?.removeEventListener?.('visibilitychange', onVisibilityChange);
      signal?.removeEventListener('abort', abort);
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const onVisibilityChange = () => {
      if (visibilityDocument.visibilityState === 'hidden') {
        if (timer !== null) clearTimeout(timer);
        timer = null;
        return;
      }
      if (timer === null) finish();
    };
    const abort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      const error = new Error('Aborted');
      error.name = 'AbortError';
      reject(error);
    };

    visibilityDocument?.addEventListener?.('visibilitychange', onVisibilityChange);
    signal?.addEventListener('abort', abort, { once: true });
    if (visibilityDocument?.visibilityState !== 'hidden') {
      timer = setTimeout(finish, delay);
    }
  });
}

export async function monitorAssessmentReport(initialState, dependencies, automaticRetries = 0) {
  const {
    signal,
    onState = () => {},
    getReport,
    getJob,
    generate,
    wait = waitForAssessmentPoll,
    getPollDelay = assessmentPollDelay,
    maxPollAttempts = 120,
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
