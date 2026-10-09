# Isolated Assessment Live Testing

## Safety Boundary

Use the commands from `apps/backend` unless indicated otherwise. Setup reads the existing local `.env` internally; never print it or put credentials on a command line. The default account is the developer-requested learner account. The tools clone base-table definitions, indexes and foreign keys, not stored routines, views or triggers. They follow an explicit list of child relationships plus foreign-key parents, not every learner in the database.

Destination names must differ from the source and end in `_test`. Setup refuses existing databases/files and retains partially created databases on failure; it never drops one. Choose a new explicit destination and a new private file for a retry after investigating the failure. The generated MySQL account has only SELECT/INSERT/UPDATE/DELETE on the test database, reference accounts are disabled, and test login passwords are independent from source passwords. Credentials and real snapshots/reports remain in OS Temp with restrictive file creation permissions; also respect the operating system's Temp directory ACLs.

No production migrations, source-data edits, provider-default changes, or fixture dumps are required. Ollama must be a loopback HTTP endpoint. The harness verifies the model digest and test DB identity, refuses occupied API port `8081`, and starts only its own compiled API/worker processes. A stale real-learner account/session is never reused for test authentication.

## Prepare And Verify

```powershell
go test ./cmd/assessment-test-db ./cmd/assessment-live-test
go run ./cmd/assessment-test-db -mode setup -target ucs_assessment_llm_test -env-out "$env:TEMP\ucs-assessment-test-private.json"
go run ./cmd/assessment-test-db -mode verify -target ucs_assessment_llm_test
```

`verify` compares both semesters' source hashes using read-only builders. It does not write records. Counts are logged without learner identity, grades or snapshot content. Setup requires CREATE DATABASE/USER and GRANT permissions only for provisioning; API/worker receive the newly restricted credentials. The learner password is changed only in the copied account. Keep the private JSON file local; do not attach it to an issue or commit it.

## Generate Through The Real API

```powershell
go run ./cmd/assessment-live-test -private-config "$env:TEMP\ucs-assessment-test-private.json" -repeat 3 -minutes 90 -keep-serving -stop-file "$env:TEMP\ucs-assessment-review.stop"
```

Use a new stop-marker path that does not already exist. The harness uses context 12288/output 3072/safety 128/think false from the setup profile, pins the installed digest if setup did not already pin one, and refuses a mismatch. It logs in through the real cookie-auth API, calls forced generation serially, honors HTTP 429 cooldowns, polls exact job IDs, and checks current saved output against the API response. It stops further repetition after a failed two-semester round; it never converts a failure into a success or emits a private response body.

The command's deadline includes compilation and cooldown. It writes safe summaries and, only on success, private review artifacts in a new Temp directory. A first-attempt structural gate is not semantic approval. Review both languages against evidence locally; do not print private report/snapshot content in application logs. At most three prompt-adjustment rounds are permitted for the agreed experiment; this command does not automatically edit prompts or start extra rounds. Record all failures, not just the eventual passing sample.

With `-keep-serving`, the test API remains available for UI inspection until its deadline or stop marker. For graceful shutdown on Windows, while it is running:

```powershell
New-Item -ItemType File -Path "$env:TEMP\ucs-assessment-review.stop"
```

The harness cancels/waits for its owned binaries. Abruptly killing `go run` can orphan child processes; if that happens, inspect executable paths and terminate only processes from the exact printed private artifacts directory. Never stop a generic `api.exe`, `node.exe`, Ollama, or an occupied port belonging to someone else.

## Frontend Verification

Run from `apps/frontend` in a dedicated terminal, with the test API still running:

```powershell
$env:NEXT_PUBLIC_API_BASE_URL = 'http://127.0.0.1:8081'
$env:NEXT_DIST_DIR = '.next/assessment-test'
npm.cmd run build
npm.cmd start -- --port 3101 --hostname 127.0.0.1
```

The optional `NEXT_DIST_DIR` keeps test build artifacts separate from an existing frontend server; without it, the normal `.next` default is unchanged. Refuse an occupied 3101 port. Use 127.0.0.1 consistently for the test UI/API to match cookie and CORS behavior. If launching a background frontend on Windows, hide its window and record its exact PID for later cleanup.

For the failure-state checks measured in this experiment, use an existing Playwright module (or install it in an OS Temp tools directory, not production dependencies) and installed Google Chrome:

```powershell
$env:ASSESSMENT_TEST_PRIVATE_CONFIG = "$env:TEMP\ucs-assessment-test-private.json"
$env:ASSESSMENT_PLAYWRIGHT_PATH = "$env:TEMP\ucs-assessment-qa-tools\node_modules\playwright"
node scripts/verify-assessment-live.mjs
npm.cmd run test:learner-assessment
```

This script is deliberately a failed-report test, not a successful narrative test. It covers both semesters at 1440/390 widths, Thai/English, light/dark, and verifies no automatic generation POSTs. Screenshots show only the report panel and remain in Temp. Successful live narrative/evidence/regenerate checks still require successful model generation; do not represent this script as coverage of those flows.

## Repository Integration And Finish

After stopping the test API/worker:

```powershell
go run ./cmd/assessment-live-test -private-config "$env:TEMP\ucs-assessment-test-private.json" -integration-only -minutes 5
go run ./cmd/assessment-test-db -mode verify
go test ./...
git diff --check
```

The integration helper creates a temporary non-current enrollment-curriculum scope for the copied learner, runs the existing MySQL concurrency/fencing test without changing `clientFoundRows`, and deletes that fixture and its synthetic jobs/reports afterward. It treats a skipped test as failure. Stop the worker first so it cannot claim synthetic jobs. Test errors are kept in a private Temp log rather than printing raw driver errors. Inspect only synthetic-test errors when troubleshooting.

Stop the owned frontend after review and verify 8081/3101 no longer belong to test processes. Retain the test DB for investigation; removal of the DB, restricted account, credentials and review files is a separate explicit cleanup action. The documented 2026-10-09 experiment did not pass the model gate. Its deterministic/integration verification used a dirty worktree with pre-existing repository progress/time fixes; those changes were not bundled into this feature's commits.
