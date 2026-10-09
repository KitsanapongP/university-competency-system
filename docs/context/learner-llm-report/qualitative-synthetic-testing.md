# Qualitative Synthetic Testing

This procedure does not use MySQL, real learner accounts, API servers, or workers. Run from `apps/backend` with Ollama already available locally and `qwen3:4b` installed. The evaluator resolves and records the model digest. Do not substitute production exports for the checked-in fixtures.

## Unit Verification

Leave database integration environment variables unset. Run:

```powershell
go test ./... -count=1
go test -race ./services ./cmd/assessment-eval -run 'TestAssessmentQualitative|TestQualitativeEvaluation|TestAssessmentEvaluationRejection|TestEvaluateDirectoryHonors|TestAssessmentSchema|TestAssessmentDuplicate|TestAssessmentUnsupportedProse' -count=2
```

The projection tests check lineage, input immutability, pending-result neutrality, readiness preservation, reviewed Thai wording, and exclusion of exact values/free text. Existing tests check authoritative report assembly and unchanged rejection guards. MySQL integration tests are not part of this procedure.

## Real Provider Verification

Set these variables only in the evaluation shell, not by editing `.env` or production defaults:

```powershell
$env:LEARNER_ASSESSMENT_EVAL = '1'
$env:LEARNER_ASSESSMENT_OLLAMA_URL = 'http://127.0.0.1:11434'
$env:LEARNER_ASSESSMENT_CONTEXT_TOKENS = '12288'
$env:LEARNER_ASSESSMENT_OUTPUT_RESERVE_TOKENS = '3072'
$env:LEARNER_ASSESSMENT_TOKEN_SAFETY_MARGIN = '128'
$env:LEARNER_ASSESSMENT_OLLAMA_THINK = 'false'
$env:LEARNER_ASSESSMENT_OLLAMA_TIMEOUT_SECONDS = '240'
go run ./cmd/assessment-eval -cases testdata/learner_assessment/qualitative -repeat 2 -minutes 25
go run ./cmd/assessment-eval -repeat 2 -minutes 25
```

The first command covers seven targeted cases; the second covers the seven existing fixtures. Each request is a fresh generation without retries; failed cases remain in the summary. `-minutes` bounds a command's total duration (1-90); separately track the total evaluation session and stop after three candidate changes or ninety minutes. Failed validation emits the worker's allowlisted reason, rule, section and position, never the rejected raw response. Successful assembled synthetic reports print for bilingual review and include authoritative backend facts; these facts were not necessarily included in the model prompt.

Review every accepted report for Thai/English equivalence, unsupported inferences, readiness contradictions, and repetitive/awkward prose. Empty narratives are contract-valid for sparse evidence but are not automatically useful reports. Check these separately from validator success. Do not auto-repair, strip paragraphs, weaken acceptance rules, or silently exclude failures.

Current candidate v1.1.7 accepted 12/14 targeted and 7/14 existing-suite requests, but still fails section cardinality and occasionally numeric prose. Bilingual semantic approval is withheld for ambiguous advice wording and incomplete preparation content. See `narrative-evaluation.md`; no production approval or database success is claimed. Subsequent full-system testing remains the user's responsibility.
