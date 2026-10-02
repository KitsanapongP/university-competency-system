# Learner LLM Report Verification

This file records implementation checks separately from human release approval. A passing automated test suite does not close model-quality, privacy-retention, or deployment gates.

## Automated Checks

Last automated run: 2026-10-02. The following checks completed during implementation:

- `go test ./...`: passed. Repository MySQL integration test skipped because `LEARNER_ASSESSMENT_TEST_DSN` was not configured.
- `npm.cmd run test:learner-assessment`: passed, 10 tests.
- `npm.cmd run test:career-paths`: passed, 3 tests.
- `npm.cmd run test:career-path-import`: passed, 3 tests.
- `npm.cmd run test:sidebar-navigation`: passed, 5 tests.
- `npm.cmd run test:cooperative-requirement-copy`: passed, 7 tests.
- `npm.cmd run test:officer-ui`: passed for 17 operational pages.
- Targeted ESLint for learner report/profile, cooperative readiness, language context, and career-management UI: passed.
- `npm.cmd run build`: passed. The first sandboxed attempt could not fetch the repository's existing Google Fonts; the network-enabled build completed successfully.
- `git diff --check`: passed; Git emitted only the repository's existing LF-to-CRLF working-copy notices.
- Latest Unit 05 `go test ./...`: passed.
- Real Ollama synthetic evaluation was attempted on `qwen3:4b` with thinking disabled. An earlier prompt revision under the default 4096/1024 context/output profile truncated the full-evidence JSON. With an experimental 6144/2048 profile, full and untrusted-input fixtures passed structural/reference validation, while the partial-evidence fixture was rejected for an unknown evidence reference. Human review also found unsupported content in an accepted sample. Details and single-process resource measurements are in `model-evaluation.md`; the model-quality and production approval gates remain open.

The MySQL repository integration test is opt-in and requires `LEARNER_ASSESSMENT_TEST_DSN`. A real Ollama evaluation is opt-in and uses only the synthetic fixtures under `apps/backend/testdata/learner_assessment/`.

## Not Yet Approved

- No live MySQL migration was run as part of implementation; apply the documented SQL manually to a disposable database and run its verifier before rollout.
- No production-quality Ollama model evaluation or resource benchmark is approved by this implementation. Complete the outstanding review and benchmark gates in `model-evaluation.md` on the target 16 GB RAM / 4 GB VRAM machine.
- Retention periods and cleanup ownership remain unapproved; automatic cleanup remains disabled.
- Browser screenshot coverage across mobile/desktop, both themes, and both languages remains a release check.
