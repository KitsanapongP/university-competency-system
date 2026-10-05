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
- Live-data browser coverage remains a release check; synthetic UI coverage is recorded below.

## Verified-observation Follow-up

Latest verification on 2026-10-02:

- `go test ./...`: passed, including observation rules, ID/section binding, unsupported numeric/grade assertions, safe token telemetry, no persistence for malformed/truncated output, and existing source-supersession tests. Opt-in MySQL integration still requires its DSN; no migration or live DB writes were performed.
- `npm.cmd run test:learner-assessment`: passed, 11 tests, including bilingual readiness evidence labels and existing bounded polling behavior.
- Targeted ESLint for the report component, language context, evidence helper and evidence tests: passed.
- `npm.cmd run build`: passed after allowing the existing Google Fonts network requests.
- Playwright with headless installed Chrome and mocked synthetic API data: all 8 combinations passed (Thai/English, light/dark, widths 1440/390). Verified section labels, empty states, evidence expansion, no horizontal document overflow, and no page runtime errors. Screenshots were visually inspected; temporary artifacts remain under `outputs/assessment-grounding-*` and are not application code.
- Real Ollama: 4 fixtures x 3 repeats completed, with no truncated response, invalid ID, or rejected numeric/grade assertion. Semantic review still failed the production gate; see `model-evaluation.md`.

No SQL files or existing unrelated changes were included in these implementation commits. Report content uses existing JSON columns; old versions become stale through versioned source hashes.

## Compact Context Verification (2026-10-03)

- Go tests passed across all packages. Added deterministic semester partitions, occurrence counting, letter/S-U separation, missing grades, Summer, no dropped evidence on overflow, structured numeric authorization, and the experimental large-fixture budget. Worker source-rebuild tests use the new summary IDs.
- Frontend assessment tests passed: 12 tests, including expansion to original course/activity evidence and unique React keys. Targeted ESLint passed.
- Production build passed after allowing existing Google Fonts network access.
- Playwright synthetic API coverage passed all eight Thai/English, light/dark, 1440/390 combinations. Original records expand fully without document overflow or runtime errors. Mobile Thai/light and desktop English/dark screenshots were visually inspected. Temporary artifacts are under `outputs/assessment-compact-*`.
- Real Ollama context comparison and resource limitations are recorded in [context-compaction.md](context-compaction.md). Do not interpret schema validity as release approval.
- Additional overflow-diagnostics browser coverage completed Thai/light desktop and mobile before the machine interruption; remaining combinations were not completed in that follow-up. The earlier eight-combination grouped-evidence run passed. No model benchmark was repeated after resuming.

## Narrative v1.1 Verification (2026-10-05)

- `go test ./...` passed. New coverage checks narrative schema/permissions, suggestion intents, duplicate and overlong prose, unauthorized numeric/grade claims, readiness contradictions (including advice), missing grades, source scope, legacy-version staleness and safe shape diagnostics. Database integration tests remain opt-in.
- Frontend assessment tests passed (15 tests), and targeted ESLint passed. Production build passed with Google Fonts network access.
- Playwright presentation checks passed eight desktop/mobile, Thai/English, light/dark combinations with keyboard-expandable evidence and no horizontal overflow or page errors. This used synthetic props and is not authenticated end-to-end verification.
- Live two-round candidate evaluation was attempted but failed preflight because Ollama was unavailable. The narrative release gate remains pending, not passed. See [narrative-evaluation.md](narrative-evaluation.md).
