# Structured Facts and Context Comparison

## Implementation

The pipeline retains scoped source data and compact provider input in existing JSON snapshots. Go produces deterministic bilingual display facts and typed model facts. The model receives only IDs, permitted kinds, fact types, and structured values. Repeated rules live in the system prompt. Output remains bilingual with at most three items per section.

Academic records are partitioned by academic year/semester, including Summer. Grade distributions retain scheme, grade and occurrence count; absent grades are counted separately. These are counts of records, not unique courses, passed courses or credits. Readiness, GPA and best-attempt calculations are unchanged. All original references remain traceable through stored provenance; the UI expands aggregated citations. Competencies and activities are not silently ranked or truncated.

Validator numeric/grade allowlists use typed values. This prevents display wording from authorizing an invented number, but cannot detect every swapped numeric role or unjustified qualitative inference. Overflow still stops generation before Ollama. No migration, RAG, additional model call or default context change is introduced.

## Budget Comparison

Synthetic fixture: 96 grade records across eight semesters, with eight competencies, letter and satisfactory grades, no learner identity. Fixed model `qwen3:4b`, digest `359d7dd4bcdab3d86b87d73ac27966f4dbb9f5efdfcc75d34a8764a09474fae7`, thinking off, output reserve 1024, safety 128.

| Pipeline | Estimated input | Estimated total | Context 4096 | Context 12288 |
|---|---:|---:|---|---|
| Previous bilingual per-course facts | 15599 | 16751 | Blocked by budget | Blocked by budget |
| Structured semester facts | 4834 | 5986 | Blocked by budget | Within budget |

Estimated input fell about 69%. Raw provider evidence remains 29320 bytes; the actual compact user prompt is 5081 bytes and system prompt 2158 bytes. The estimator is conservative and not Ollama's tokenizer. In the first 12288 large-fixture generation Ollama counted 1823 input tokens and 553 output tokens; this difference does not authorize weakening the guard based on a single case.

## Experiment Method

Run `apps/backend/scripts/assessment-context-benchmark.ps1` for the same five fixtures at both contexts with three repeats, one provider request at a time. Results are synthetic only and are not saved as learner reports. API and frontend listeners were present at ports 8080 and 3000; UI preview was also present at 3001 during part of the run. This is not a simultaneous multi-user load test.

The first request after a context switch includes loading effects; subsequent requests are warm. One-second samples record total Ollama/llama process RSS/private bytes, loaded-model VRAM allocation, and total GPU used memory when `nvidia-smi` is available. Values are sampled peaks, not exact allocation peaks or total system RAM. Model allocation proportions do not establish execution-time CPU/GPU shares. Raw logs are local artifacts under `outputs/assessment-context-benchmark`, not production logs.

## Release Decision

### Measured results (2026-10-03)

| Context | Accepted / called | Budget-blocked | Sampled peak Ollama RSS | Sampled peak private bytes | Peak total GPU used |
|---|---:|---:|---:|---:|---:|
| 4096 | 12 / 12 | 3 large-fixture attempts | 1.93 GiB | 4.46 GiB | 2513 MiB |
| 12288 | 14 / 15 | 0 | 2.73 GiB | 5.92 GiB | 2513 MiB |

All 27 actual provider calls ended with `done_reason=stop`; no truncation or provider timeout occurred. One full-evidence response at 12288 was rejected for an unsupported numeric assertion and would not be saved by the worker. At 4096 the 12 smaller-case calls passed validation; the large fixture was blocked on all three attempts, as expected. Initial harness metrics captured a null process exit code; stderr confirms evaluation failures and `exit status 1` for each profile. The harness now acquires the process handle before waiting to retain exit status on Windows. Do not treat an absent exit code as success.

The three large-fixture calls at 12288 took 70.754, 69.533, and 68.876 seconds. Actual prompt tokens were 1823 each; output counts were 553, 583, and 583. Common smaller cases were slower in this run at 12288: B+/partial cases took roughly 9-10 seconds versus 5.6-6.9 seconds at 4096, and the untrusted-name case roughly 18-19 seconds versus 11-12 seconds. Full-evidence valid calls took 57.7-59.0 seconds at 12288 versus 32.3-49.1 seconds at 4096. These are observations under a shared development workload, not controlled latency guarantees.

Loaded-model allocation at the end of each run was about 3.28 GiB (4096) versus 4.42 GiB (12288), with about 2.18 versus 2.14 GiB allocated to VRAM. Model memory therefore did not remain entirely on the GPU; these allocation numbers are not CPU execution percentages. Sampled peaks include context transitions and other GPU users; identical peak GPU usage does not mean the larger context has no memory cost. No multi-user stress test or whole-system peak-RAM measurement was performed.

Defaults remain 4096/1024/128. The large synthetic history needs a higher configured guard budget after compaction; 12288 is experimental, not automatically promoted. Restart matching API/worker deployments together if opting into it for development. Pipeline/prompt/compaction version changes make old reports stale and regenerate them lazily; old incompatible jobs are rejected.

Semantic review remains failed: one valid 12288 response inferred attendance at all activities and consistent participation from a single activity record. Other responses called grade records unique courses or used the Thai term for curriculum when describing a course. Numerical and schema validity do not eliminate these errors. Do not approve production quality or weaken validation merely because generation fits the context.

The user subsequently reported a machine freeze during follow-up browser verification. The available samples do not establish its cause or capture whole-system pressure. Combined-workload stability is therefore not approved; no further model benchmark was launched after resuming. A separate diagnostics UI run completed only two combinations before interruption, while the original grouped-evidence UI run had completed all eight. Review memory headroom on the target machine before enabling 12288 routinely.
