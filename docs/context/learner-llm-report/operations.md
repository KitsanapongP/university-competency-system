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

Prompt version `learner-assessment-prompt-v1.1.0` receives compact Go-verified typed facts without arbitrary official names. The model returns bounded bilingual sentences grouped into narrative paragraphs, with an observation ID and explanation/advice intent. Go validates section permissions and resolves evidence, then adds authoritative readiness and data-scope paragraphs. See [narrative-evaluation.md](narrative-evaluation.md) for the current contract and pending release gate; `assessment-reliability.md` describes the earlier contract.

Usage logs contain `done_reason`, `prompt_eval_count`, and `eval_count`, plus `job_id` and `attempt_count` when invoked by the worker. Standalone synthetic provider calls omit the job fields. A response stopped by the output limit fails with `provider_output_truncated`; malformed JSON fails with `malformed_output`; invalid findings fail with `invalid_output`. None of these outputs is saved or automatically repaired. Validation rejection logs include a bounded reason code and available positions; see Validation Diagnostics below.

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

## Narrative v1.1 Rollout

For the narrative experiment, use context `12288` and output reserve `3072` rather than the earlier output `1024` profile above. Run the seven synthetic cases at least twice and review both languages. The benchmark accepts `-Contexts 12288 -OutputReserve 3072 -Repeat 2`. Production defaults remain unchanged until evaluation passes. Install/restart matching API and worker binaries together; VersionHash hides old-schema reports and uses the existing regeneration flow. No additional migration is required. See [narrative-evaluation.md](narrative-evaluation.md) for commands, review requirements and known verification limits.

## Validation Diagnostics

The worker emits one `WARN assessment output rejected` event when `ValidateAssessmentProviderOutput` rejects a completed response. Match this event with `INFO assessment generation usage` using both `job_id` and `attempt_count`; a retried job keeps its ID but has a different attempt count. These IDs identify internal work, not learners. For example, the following synthetic response finished normally at Ollama and then failed validation:

```text
INFO assessment generation usage job_id=501 attempt_count=1 done_reason=stop prompt_eval_count=1669 eval_count=518
WARN assessment output rejected job_id=501 attempt_count=1 error_code=invalid_output validation_reason=observation_section_mismatch output_bytes=2841 schema_version=learner-assessment-output-v1.1.0 section=strengths paragraph_index=1 sentence_index=2 field=observation_id
```

`done_reason=stop` describes generation completion; it does not mean the report passed validation. `output_bytes` measures the UTF-8 response bytes handed to the validator, not the token count. `schema_version` identifies the backend's expected output contract. Paragraph positions count from the start of the complete output array; sentence positions count within that paragraph. Both start at 1. The worker omits unavailable positions, rather than inventing a location for malformed JSON.

The validator reports its first failure in the existing check order. `section` is one of `strengths`, `development`, or `observations`; an unrecognized supplied section is recorded as `unknown`. Optional `language` identifies `th` or `en`. `field` is a fixed structural label such as `output`, `paragraphs`, `sentences`, `observation_id`, `sentence.text`, or `paragraph.text`; it never includes a model-supplied unknown field name or observation ID.

| Validation reason | Meaning |
|---|---|
| `output_empty` / `output_too_large` | No output bytes or output exceeds the validator's byte limit. |
| `malformed_json` | Invalid JSON, including incomplete JSON or trailing content; the stored job code remains `malformed_output`. |
| `invalid_json_structure` / `unknown_field` | JSON has an incompatible structure/type or an unrecognized field. |
| `paragraphs_missing` | The paragraph array is absent or null. An explicit empty array remains allowed. |
| `paragraph_count_exceeded` | Total paragraph count or the count for a section exceeds the existing limit. |
| `sentence_count_invalid` | A paragraph has no sentences or exceeds its sentence limit. |
| `unknown_section` / `invalid_intent` | An unrecognized narrative section or sentence intent. |
| `observation_unknown` / `observation_section_mismatch` | The observation cannot be resolved, or its kind is incompatible with the section/intent. |
| `bilingual_text_missing` | Thai or English text is absent or blank. |
| `text_too_long` | The text exceeds an existing byte/rune limit; `field` distinguishes sentence and paragraph text. |
| `pii_detected` | Text matches an existing email, phone, national ID, or student ID detector. |
| `duplicate_sentence` | A trimmed Thai or English sentence was already used. |
| `unsupported_claim` | Text matches an existing prohibited numeric, grade, authorization, career, or formatting assertion rule. |
| `readiness_contradiction` | Text contradicts the observation's verified criterion status. |
| `advice_not_suggestion` / `advice_missing` | Advice lacks the existing suggestion wording, or a development paragraph contains no advice. |
| `validation_unknown` | The failure does not carry a recognized typed diagnostic; inspect the code path without logging raw error content. |

Detailed reasons stay in the worker log. The database/API still use the existing `invalid_output` and `malformed_output` codes, and the learner page keeps its existing localized messages. Provider failures before validation, including `provider_output_truncated`, retain their existing provider codes and do not emit a validator rejection event. Validation limits, accepted reports, retries, and failure cooldowns are unchanged.

Log events allow only fixed reason codes, safe structural metadata, numeric positions/sizes, and internal job correlation fields. Do not add raw model output, thinking content, prompts, source evidence, names, student IDs, enrollment IDs, observation IDs, lease tokens, snapshots, or decoder error messages. Unknown diagnostic values are normalized to `unknown` or `validation_unknown`.

Restart the worker after rebuilding to enable these logs. This change needs no migration or generation configuration update. To verify diagnostics without a running Ollama server or database, run from `apps/backend`:

```powershell
go test ./services -run 'TestAssessmentValidation|TestAssessmentRejection|TestWorkerValidation|TestWorkerOllama|TestOllamaAssessmentUsage' -count=1
```

These tests use synthetic outputs and an `httptest` Ollama server, assert reason/location codes and shared correlation fields, and check that private response/prompt markers and untrusted metadata never enter the captured logs.
