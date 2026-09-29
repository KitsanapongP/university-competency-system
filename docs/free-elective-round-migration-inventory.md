# Free Elective Round Migration Inventory

## Canonical model

The round model is the source of truth for free-elective data:

- `ele_free_elective_rounds` stores an academic-year and semester round.
- `ele_free_elective_round_courses` stores the courses in a round.
- `ele_free_elective_round_course_competencies` stores competency weights for a course in that round.
- `ele_free_elective_round_course_enrollments` stores learners selected for a course in that round.
- `ele_free_elective_round_course_grade_records` stores the current grade for each enrollment.
- `score_free_elective_round_course_competency_scores` stores calculated competency scores.

The legacy Offering model is retained only as migration history until the retirement migration is approved:

- `ele_free_elective_offerings`
- `ele_offering_competencies`
- `ele_offering_enrollments`
- `ele_offering_grade_records`
- `score_free_elective_competency_scores`

## Dependency inventory

### Backend

- `free_elective_round_repository.go` and `free_elective_round_course_repository.go` already implement the round workflow.
- `free_elective_repository.go` contains both models. Course catalog queries still count legacy offerings, and the student-group query still joins `ele_offering_enrollments`.
- `competency_result_recalculator.go` still reads legacy free-elective score tables.
- `free_elective_controller.go` and the legacy Offering routes expose the old API surface.
- The round controllers and services expose the current round workflow and should become the only write path.

### Frontend

- `/free-elective-management`, `/rounds`, and `/rounds/[roundId]/courses/[roundCourseId]` use the round API.
- `/groups`, `/groups/[cohortId]`, and `/students/[enrollmentId]` use legacy-shaped API functions and need to read round data.
- `/offerings/[offeringId]` and Offering-specific components are legacy UI and can be removed after the round-based student workflow is available.
- `lib/free-elective.js` currently contains both API clients and both data shapes. Round clients should be the only clients used by active pages.

## Migration order

1. Migrate live legacy Offering rows into the round tables and verify the row counts.
2. Rename the round tables to compact canonical names in a dedicated migration.
3. Update backend SQL and recalculation queries to use the canonical names.
4. Move groups and student detail to round-based queries and endpoints.
5. Remove legacy Offering routes, services, repository code, and frontend pages.
6. Keep legacy tables archived for one release, then drop them in a separate reviewed migration.

The first retirement pass must not delete legacy tables. This keeps rollback possible while the application is being switched to the round model.
