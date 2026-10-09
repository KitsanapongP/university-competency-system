# Narrative Report v1.1 Evaluation

Date: 2026-10-05. Pipeline/prompt/schema: v1.1.0. Model: `qwen3:4b`.

## Historical Baseline (2026-10-05)

Implementation tests pass, but the live model release gate is **not passed**. The candidate evaluation (`12288` context, `3072` output, two repeats) stopped in preflight with `provider_unavailable`: Ollama was not listening at `127.0.0.1:11434`. No generated samples, real token counts, latency, TTFT, or RAM/VRAM results were obtained. Historical v1.0 evaluation is not approval for this contract.

## Historical Gate: Isolated Live Test (2026-10-09)

The gate remains **NOT PASSED**. Three bounded adjustment rounds produced six fresh real-provider requests (two semesters per round), all on attempt one, with **zero accepted reports**. The final candidate eliminated the observed within-paragraph duplicate in both requests, but introduced/did not prevent prohibited grade/numeric literals. Do not interpret schema completion, `done_reason=stop`, shorter output, or passing unit tests as release approval.

The test copied only one learner's required relational data into `ucs_assessment_llm_test`, using the existing local schema. Necessary reference accounts were anonymized and disabled; all copied password hashes were replaced with a test-only hash. Personal national/passport identifiers and phone numbers were removed. No source writes or migrations were performed. Both source/test snapshots matched before and after generation: 37 and 38 academic records respectively, six competency aggregates, and no confirmed activity evidence within the builder's rules. This does not establish that the source DB has no activity-related rows.

Model: `qwen3:4b`; digest: `359d7dd4bcdab3d86b87d73ac27966f4dbb9f5efdfcc75d34a8764a09474fae7`. Settings: context `12288`, output `3072`, safety `128`, think `false`, temperature `0`, request timeout `240s`. API/worker shared isolated credentials and matching generation settings; API was on loopback port `8081`. Ollama received only provider inputs prepared by the existing pipeline, never test-account credentials.

| Round | Prompt | Semester | Job | Seconds | Prompt tokens | Output tokens | Rejection |
|---|---|---|---|---:|---:|---:|---|
| 1 | v1.1.2 | 1 | 15 | 81.2 | 1854 | 583 | duplicate_sentence, strengths p1 s2 th |
| 1 | v1.1.2 | 2 | 16 | 66.1 | 1885 | 571 | duplicate_sentence, strengths p1 s2 th |
| 2 | v1.1.3 | 1 | 17 | 90.3 | 1994 | 671 | duplicate_sentence, strengths p1 s2 th |
| 2 | v1.1.3 | 2 | 18 | 75.1 | 2025 | 665 | duplicate_sentence, strengths p1 s2 th |
| 3 | v1.1.4 | 1 | 19 | 48.1 | 1970 | 364 | unsupported_claim / grade_literal, observations p3 s1 en |
| 3 | v1.1.4 | 2 | 20 | 45.1 | 2001 | 398 | unsupported_claim / numeric_literal, observations p3 s1 th |

All six completions had `done_reason=stop`. Durations include API polling (three-second interval), not exact provider latency. TTFT and memory peaks were not measured in this run. Rejected raw outputs were not saved, printed, edited, or repaired. The run stopped at the agreed three adjustment rounds; the intended final six-success repetition gate was not reached. No successful bilingual semantic review or real saved-report/current/regenerate verification can be claimed from this run.

Changes by round: v1.1.2 allowed shorter paragraphs and prohibited padding; v1.1.3 added a guarded one-sentence example and `uniqueItems`; v1.1.4 constrained the generation schema to one sentence per paragraph and requested one paragraph per section. The validator's existing sentence/paragraph ceilings and all factual/duplicate/privacy guards remain intact. The final candidate deliberately produces a shorter narrative, not a long multi-sentence essay; this tradeoff requires review before rollout. Schema wire shape remains v1.1.0, with freshness invalidated by the prompt version.

Verification completed: `go test ./...`, targeted race tests repeated twice, frontend learner-assessment tests (15), isolated frontend production build, and real failed-report UI checks for two semesters across eight language/theme/viewport combinations (16 checks). Those checks confirmed no automatic POST generation while opening failed reports, no page exceptions, and no horizontal overflow. Screenshots and private credentials remain in OS Temp, not Git. Existing deterministic frontend tests cover loading, polling and cooldown, but successful live report UI remains unverified.

The MySQL concurrency/fencing integration test exposed a same-second heartbeat bug: MySQL can report zero changed rows while a lease remains valid. The heartbeat fix rechecks the existing ownership/expiry conditions rather than enabling `clientFoundRows` or relaxing fencing. The isolated integration test then passed with the worker stopped and a temporary non-current enrollment-curriculum fixture; the fixture was cleaned up. Verification used the current worktree, including pre-existing unstaged repository progress/time fixes. Only the new heartbeat hunk was committed; those earlier changes were left untouched and should be reviewed separately before claiming a clean-checkout release gate.

All owned API/worker processes were stopped after review; the test database is retained for investigation. See [isolated-live-testing.md](isolated-live-testing.md) for safe rerun commands. A subsequent iteration should focus on discouraging numeric/grade restatement in neutral observations (for example, a reviewed qualitative provider projection), without stripping output, weakening validation, or claiming that regex checks establish semantic truth. This next iteration was not implemented under the three-round budget.

## Current Gate: Qualitative Synthetic Evaluation (2026-10-09)

The gate remains **NOT PASSED**. This iteration is limited to unit tests and synthetic Ollama requests. No database setup, database integration run, API, worker, real learner input, or UI test was performed. The user owns subsequent database/end-to-end verification. Existing source DBs and uncommitted SQL were not touched.

The provider now receives backend-owned qualitative meanings instead of numeric `AssessmentFactValues`. Observation IDs and classifications are preserved; numeric grades, scores, years, official names, and free text stay in the original input for validation/report assembly, not the prose prompt. Numeric characters in opaque reference IDs are allowed and are not factual values to reproduce in prose. Pending results remain neutral; missing readiness criteria remain omitted. No ability thresholds, grade-based weaknesses, personality judgments, or inferred expertise were introduced.

| Candidate | Targeted repetitions | Validator result | Remaining issue |
|---|---:|---:|---|
| v1.1.5 | one | 7/7 | Semantic review rejected the competency translation: Thai described feelings instead of competency contributions; advisor wording was also imprecise. |
| v1.1.6 | two | 12/14 | Mixed evidence failed `advice_not_suggestion`, English development paragraph, in both repetitions. Verbose bilingual projection also broke default-context unit tests. |
| v1.1.7 | two | 12/14 | Mixed evidence failed `paragraph_count_exceeded`, observations paragraph four, in both repetitions. |

The final candidate shortens reviewed descriptions and system instructions, keeps one sentence per paragraph, and constrains generated advice text to start `แนะนำให้` / `Consider `. The output JSON wire format and validator acceptance rules are unchanged. Prompt-version hashing invalidates old reports through the existing freshness mechanism. Default-context unit tests pass again; live requests used context `12288`, output `3072`, safety `128`, temperature `0`, think `false`, timeout `240s`, and the same reviewed model digest recorded above.

In targeted final repetitions, actual prompt tokens were 495-507 for single-source cases and 745 for mixed evidence; output tokens were 106-119 and 384 respectively, all `done_reason=stop`. End-to-end evaluator times were approximately 7-18 seconds for single-source cases and 34 seconds for mixed evidence. This is not a controlled performance benchmark; prompt cache/warmup and machine load were not controlled. TTFT and memory were not sampled.

All six single-source final cases passed the validator twice and were inspected in Thai/English: met criterion, unmet criterion, pending results, neutral grade, accumulated competency contributions, and recorded activity participation. The competency mistranslation no longer appeared in these samples. However, the Thai unmet-criterion advice uses ambiguous wording about fixing the criterion, which could be read as changing the requirement rather than meeting it. Therefore bilingual semantic approval is still withheld. The text is intentionally short and often restates the qualitative meaning; it is not approval of long-form essay quality. Rejected raw output was not retained or repaired. Three candidate adjustment rounds were used; no fourth candidate was attempted.

The remaining count failure is a generation-contract gap: the schema permits up to four paragraphs with repeated section branches, while the validator permits only one observations paragraph. A follow-up should bind section cardinality in generation, not relax the validator, delete extra paragraphs, or treat a malformed report as successful. JSON/schema completion does not establish factual truth or bilingual equivalence.

The existing seven-fixture suite was then run twice with the same final candidate, without further prompt changes: **4/7** and **3/7**, respectively. Full evidence, long academic history, and untrusted source names all failed the observations section count in both repetitions. The all-criteria-met fixture passed the validator once but failed `unsupported_claim / numeric_literal` in Thai strengths in the second repetition. Its accepted report also omitted preparation advice, so it does not meet that fixture's complete human-review checklist. The three neutral/partial academic fixtures passed twice. No final `duplicate_sentence` or `grade_literal` rejection occurred in these runs, but this is not proof they cannot recur. The exact offending numeric text is unknown because rejected raw output was not retained.

Across both final suites, validator acceptance was **19/28**: targeted **12/14**, existing **7/14**. All twenty-eight completions ended with `done_reason=stop`, not output truncation. Whole-session totals across the three candidates were forty-nine requests and thirty-eight validator acceptances; prior-candidate acceptances are not evidence of final-candidate approval. The final existing suite used actual prompt counts 498-1344 and output counts 109-395, with roughly 7-44 seconds per request. Even fixed temperature did not establish repeatability in the all-criteria-met case. Future work must address numeric prose generation as well as cardinality and wording; qualitative input reduces exposure but does not guarantee compliant generation.

Final verification: `go test ./... -count=1` passed; focused race tests for projection, synthetic fixtures, safe rejection logs, deadlines, schema constraints, duplicates and unsupported-prose guards passed with `-count=2`. The verbose intermediate candidate broke default-context regression tests; the final shortened candidate restored them without changing context defaults or weakening validators. Verification includes the previously dirty worktree noted in the historical run, not a clean-checkout release claim. No new SQL, dependency, public API, UI, or output wire-shape change was required.

Synthetic-only verification does not establish database persistence, stale-report recovery, regeneration, account authorization, or UI correctness. All evaluator processes completed; no test server was started. Local logs are in OS Temp under `assessment-qualitative-v115-round1.log`, `assessment-qualitative-v116-round2.log`, `assessment-qualitative-v117-round3.log`, and `assessment-existing-v117-round3.log`; do not commit local outputs or replace these with real learner inputs. Reproduction commands are in [qualitative-synthetic-testing.md](qualitative-synthetic-testing.md).

## Synthetic Cases

The evaluator runs seven checked-in groups:

1. `full-evidence.json`: mixed met/unmet criteria, competencies and activities.
2. `all-criteria-met.json`: preparation advice without invented weaknesses.
3. `neutral-grade-and-missing-result.json`: neutral grades and a pending result, not a failed criterion.
4. `partial-no-careers.json`: partial sources without career recommendations.
5. `no-published-readiness.json`: academic analysis when readiness cannot be checked.
6. `large-academic-history.json`: long source history and bounded output.
7. `untrusted-source-text.json`: injection/identity-bearing source names do not become instructions.

No real learner records are sent by this command. One provider request is made per case/round; the printed SUMMARY reports first-attempt success with `retries=0`. Worker retry behavior is tested separately. A schema-valid response still requires human review; failed cases are not silently removed from the denominator.

## Candidate Run

Run from `apps/backend` after starting Ollama and installing the configured model:

```powershell
$env:LEARNER_ASSESSMENT_EVAL = '1'
$env:LEARNER_ASSESSMENT_CONTEXT_TOKENS = '12288'
$env:LEARNER_ASSESSMENT_OUTPUT_RESERVE_TOKENS = '3072'
$env:LEARNER_ASSESSMENT_TOKEN_SAFETY_MARGIN = '128'
$env:LEARNER_ASSESSMENT_OLLAMA_THINK = 'false'
go run ./cmd/assessment-eval -repeat 2
```

For serial memory sampling with the same candidate:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/assessment-context-benchmark.ps1 -Contexts 12288 -OutputReserve 3072 -Repeat 2
```

The benchmark restores process settings and does not edit `.env`. Its files include context/output in the name to avoid mixing profiles. Sampled Ollama process memory and GPU allocation are not whole-system memory or execution percentages. If truncation occurs, try fewer sentences first, then compare output `4096` with the same context and record both results. Do not change production defaults automatically.

## Review And Release

Record digest, runtime settings, case/round, actual prompt/output token counts from safe usage logs, total latency, memory peaks, truncation, first-attempt success, and worker retries. TTFT must be measured from provider activity if available; otherwise mark it unavailable, not zero.

For every successful sample, review both languages for coherent paragraphs, proportionate advice, no repeated backend facts, equivalent meaning, and complete evidence lineage. Hard failures include invented evidence, reversed readiness, missing data treated as a weakness, occupation recommendations, or placement approval. Regex and JSON validation cannot prove semantic truth or bilingual equivalence.

Require at least two rounds across all groups, no final truncation failure, and reviewer approval before enabling the candidate. Restart matching API and worker versions/settings together; old-version reports become stale through VersionHash. No database migration is needed.

## UI Verification Boundary

Playwright checked the real narrative component with synthetic props at 1280x900 and 390x844, Thai/English, light/dark. Eight combinations passed horizontal-overflow and keyboard evidence-disclosure checks without page errors. Screenshots are local artifacts under `outputs/narrative-*`; desktop light and mobile dark were inspected. The temporary QA route was removed afterward.

This is presentation verification, not an authenticated end-to-end Ollama/DB run. Live generation, regenerate/cooldown, stale-report recovery and model quality must still be checked with the service running. Existing frontend state tests and backend service/worker tests cover their deterministic contracts.
