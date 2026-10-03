# Learner Assessment Worker Operations

## Runtime

The HTTP API and assessment worker are separate Go processes. The API only reads learner-owned reports and enqueues generation jobs; it never waits for Ollama. Run both processes with the same database and assessment context settings.

```powershell
# Terminal 1: API
cd apps/backend
go run ./cmd/api

# Terminal 2: job worker
cd apps/backend
go run ./cmd/assessment-worker
```

The worker exits on Ctrl+C or SIGTERM. Jobs use database leases and can be reclaimed after a worker stops unexpectedly. Stop any worker running the previous version before applying the progress migration: the new API treats a running job with no heartbeat for 45 seconds as unavailable, while old workers do not maintain the new heartbeat cadence.

## Ollama

Install and pull `qwen3:4b` as an operator action before starting the worker. The application deliberately does not download models.

Keep the Ollama endpoint on loopback or a trusted private network. Do not expose port `11434` publicly. The worker logs safe error codes only; prompts, model responses, learner names, grades, and source snapshots must not be added to operational logs.

## Configuration

| Environment variable | Default | Purpose |
|---|---:|---|
| `LEARNER_ASSESSMENT_OLLAMA_URL` | `http://127.0.0.1:11434` | Ollama base URL |
| `LEARNER_ASSESSMENT_OLLAMA_TIMEOUT_SECONDS` | `120` | Maximum generation request duration |
| `LEARNER_ASSESSMENT_OLLAMA_KEEP_ALIVE` | `5m` | Ollama model keep-alive request |
| `LEARNER_ASSESSMENT_OLLAMA_THINK` | `false` | Toggle Qwen3 thinking mode; changing it invalidates saved report freshness |
| `LEARNER_ASSESSMENT_OLLAMA_MODEL_DIGEST` | required by worker | Pinned installed model digest; get it from the synthetic evaluation output and set the same value for API and worker |
| `LEARNER_ASSESSMENT_WORKER_POLL_SECONDS` | `3` | Idle worker polling interval |
| `LEARNER_ASSESSMENT_WORKER_LEASE_SECONDS` | `900` | Job lease and heartbeat interval budget |
| `LEARNER_ASSESSMENT_CONTEXT_TOKENS` | `4096` | Input context budget |
| `LEARNER_ASSESSMENT_OUTPUT_RESERVE_TOKENS` | `1024` | Reserved and requested output budget |
| `LEARNER_ASSESSMENT_TOKEN_SAFETY_MARGIN` | `128` | Context safety margin |

The model is fixed to `qwen3:4b` so the provider, source hash, and stored model metadata cannot drift apart. Set `LEARNER_ASSESSMENT_OLLAMA_MODEL_DIGEST` to the digest printed by the opt-in synthetic evaluation; the worker checks Ollama's installed digest before connecting to MySQL and refuses to start when it is missing or different. API and worker must use the same digest, think mode, keep-alive, and context settings. `LEARNER_ASSESSMENT_CONTEXT_TOKENS` is sent as Ollama `num_ctx`; `LEARNER_ASSESSMENT_OUTPUT_RESERVE_TOKENS` is both the backend output reserve and Ollama `num_predict`. These settings form part of the source hash and persisted provider configuration fingerprint. The initial timeout is 120 seconds and the initial think setting is off; evaluate think on/off before changing the approved setting. Ollama streams NDJSON to the worker, which buffers the response privately and returns it to the report pipeline only after the final chunk. No partial model text or thinking content is sent to the browser. The provider's stream idle timeout is 60 seconds after response activity begins; the overall request timeout still applies. The application validates the completed JSON and rejects unknown evidence references and unrecognized output fields. A missing model and invalid output are recorded as safe job error codes, not raw provider messages.

When the report state is `context_exceeded`, the API may include `context_diagnostics` with estimated token budgets and byte sizes by section. These diagnostics contain no prompt or evidence content. Do not add source text, learner identifiers, grades, or model responses to logs.

## Database and Retention

Migrations are manual. For a new database, apply `20261001_add_cooperative_career_paths.sql`, then `20261001_add_learner_assessment_reports.sql`, then run `20261001_verify_learner_assessment_schema.sql`. Apply `20261003_add_assessment_job_progress.sql` after the report/job schema; verify that `ai_report_jobs` contains `progress_phase`, `phase_started_at`, and `last_provider_activity_at` before starting the new API or worker. The application does not execute migrations at startup.

For an existing deployment, stop the old worker and API, apply the progress migration, verify the three columns, then deploy and start the matching API and worker binaries together. Do not run old and new workers side by side during rollout.

Automatic cleanup is intentionally disabled. The retention period for job snapshots and terminal job metadata has not been approved; do not delete or scrub them until that policy is decided. Never remove active jobs or the latest successful report as part of cleanup.

## Recovery

- Restarting the worker does not duplicate a successful report; expired running jobs are reclaimed according to their retry limit.
- The worker updates job phases (`preparing`, `generating`, `validating`, and `saving`) and heartbeats at intervals no longer than 10 seconds. A learner status request reconciles a running job whose heartbeat is at least 45 seconds old to `worker_unavailable`; the old report remains visible only if it is still current.
- The learner page polls job status every 2.5 seconds while visible. Polling pauses when the browser tab is hidden, resumes when visible, and stops after five minutes of foreground polling with a manual status-check action. This does not cancel the server job.
- The page shows elapsed time, current phase, retry attempt, and a no-provider-activity notice after 30 seconds without streamed model activity. It never displays partial generated text. During queued/running report work, the learner profile's animated WebGL background is paused; click sparks only animate briefly after user interaction.
- If Ollama is unavailable, retryable provider failures use bounded retries and then a failure cooldown.
- A stalled Ollama stream is cancelled after its idle timeout. The job is failed/retried through the existing bounded retry policy; a disconnected model process is therefore not represented as an indefinitely animated browser spinner.
- If source data changes while a report is generated, the worker discards that result instead of publishing it.
- If generation reports `model_not_found`, install the configured model manually and request generation again after the failure wait.
- To disable generation, stop the worker. Learner GET requests continue to return any current saved report and job state; source grade and competency tables are never changed by this feature.

Prompt version `learner-assessment-prompt-v1.0.4` receives compact Go-verified typed facts without arbitrary official names or repeated bilingual prose. Dynamic JSON Schema constrains observation IDs to their sections. Go supplies readiness results, titles, facts, and evidence references after validating the model's short bilingual explanations. See [assessment-reliability.md](assessment-reliability.md) for the current contract and validation limits.

Usage logs contain only `done_reason`, `prompt_eval_count`, and `eval_count`. A response stopped by the output limit fails with `provider_output_truncated`; malformed JSON fails with `malformed_output`; invalid findings fail with `invalid_output`. None of these outputs is saved or automatically repaired.

For synthetic evaluation only, try the larger profile without changing production defaults:

```powershell
$env:LEARNER_ASSESSMENT_EVAL = '1'
$env:LEARNER_ASSESSMENT_CONTEXT_TOKENS = '12288'
$env:LEARNER_ASSESSMENT_OUTPUT_RESERVE_TOKENS = '1024'
$env:LEARNER_ASSESSMENT_OLLAMA_THINK = 'false'
go run ./cmd/assessment-eval -repeat 3
```

For the measured Windows comparison, run `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/assessment-context-benchmark.ps1` from the backend directory. It runs the same synthetic fixtures three times at 4096 and 12288, serially, with output 1024 and safety 128. It restores process environment variables and never edits `.env`. Logs and sampled memory metrics go to `outputs/assessment-context-benchmark`. The first request after a context change includes model-loading effects; later requests are warm. RSS/private memory are sampled process totals, not whole-system RAM, and `/api/ps` allocation is not a measured CPU/GPU execution percentage.

Use matching API and worker settings for an actual development deployment and restart both after changing them. A 12288 experiment is not a default change or quality approval. See [context-compaction.md](context-compaction.md) for current results and `model-evaluation.md` for the historical evaluation.
