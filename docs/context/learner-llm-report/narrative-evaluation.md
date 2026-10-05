# Narrative Report v1.1 Evaluation

Date: 2026-10-05. Pipeline/prompt/schema: v1.1.0. Model: `qwen3:4b`.

## Current Gate

Implementation tests pass, but the live model release gate is **not passed**. The candidate evaluation (`12288` context, `3072` output, two repeats) stopped in preflight with `provider_unavailable`: Ollama was not listening at `127.0.0.1:11434`. No generated samples, real token counts, latency, TTFT, or RAM/VRAM results were obtained. Historical v1.0 evaluation is not approval for this contract.

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
