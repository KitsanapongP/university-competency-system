-- Free Elective Management v2: migrate the legacy one-course offerings.
-- Run after 20260917_add_free_elective_round_schema.sql.
-- This file intentionally does not contain USE <database>.
-- Legacy tables are retained as read-only history after this migration.

SELECT DATABASE() AS selected_database;

SELECT required.table_name,
       CASE WHEN existing.table_name IS NULL THEN 'MISSING' ELSE 'OK' END AS status
FROM (
    SELECT 'ele_free_elective_courses' AS table_name
    UNION ALL SELECT 'ele_free_elective_offerings'
    UNION ALL SELECT 'ele_offering_competencies'
    UNION ALL SELECT 'ele_offering_enrollments'
    UNION ALL SELECT 'ele_offering_grade_records'
    UNION ALL SELECT 'score_free_elective_competency_scores'
    UNION ALL SELECT 'ele_free_elective_rounds'
    UNION ALL SELECT 'ele_free_elective_round_courses'
    UNION ALL SELECT 'ele_free_elective_round_course_competencies'
    UNION ALL SELECT 'ele_free_elective_round_course_enrollments'
    UNION ALL SELECT 'ele_free_elective_round_course_grade_records'
    UNION ALL SELECT 'score_free_elective_round_course_competency_scores'
) required
LEFT JOIN information_schema.tables existing
    ON existing.table_schema = DATABASE()
   AND existing.table_name = required.table_name
ORDER BY required.table_name;

-- One new round has one status. A legacy database with multiple sections or
-- mixed statuses cannot be migrated safely without an explicit data decision.
DELIMITER $$
DROP PROCEDURE IF EXISTS validate_free_elective_round_migration$$
CREATE PROCEDURE validate_free_elective_round_migration()
BEGIN
    DECLARE section_conflicts INT DEFAULT 0;
    DECLARE status_conflicts INT DEFAULT 0;

    SELECT COUNT(*) INTO section_conflicts
    FROM (
        SELECT course.faculty_id, offering.academic_year_be, offering.semester
        FROM ele_free_elective_offerings offering
        JOIN ele_free_elective_courses course
            ON course.free_elective_course_id = offering.free_elective_course_id
        WHERE offering.deleted_at IS NULL
        GROUP BY course.faculty_id, offering.academic_year_be, offering.semester
        HAVING COUNT(DISTINCT offering.section_no) > 1
    ) conflicts;

    IF section_conflicts > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Migration stopped: legacy offerings contain multiple sections in the same faculty, academic year, and semester';
    END IF;

    SELECT COUNT(*) INTO status_conflicts
    FROM (
        SELECT course.faculty_id, offering.academic_year_be, offering.semester
        FROM ele_free_elective_offerings offering
        JOIN ele_free_elective_courses course
            ON course.free_elective_course_id = offering.free_elective_course_id
        WHERE offering.deleted_at IS NULL
        GROUP BY course.faculty_id, offering.academic_year_be, offering.semester
        HAVING COUNT(DISTINCT offering.status) > 1
    ) conflicts;

    IF status_conflicts > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Migration stopped: legacy offerings contain mixed statuses in the same faculty, academic year, and semester';
    END IF;
END$$
DELIMITER ;

CALL validate_free_elective_round_migration();
DROP PROCEDURE IF EXISTS validate_free_elective_round_migration;

-- Create one round per faculty/year/semester. The validation above guarantees
-- that MAX(status) is an unambiguous copy of the legacy status.
INSERT INTO ele_free_elective_rounds (
    faculty_id, academic_year_be, semester, status,
    scores_recalculation_required, scores_recalculated_at,
    scores_recalculated_by, finalized_at, finalized_by, created_by,
    created_at, updated_at
)
SELECT course.faculty_id,
       offering.academic_year_be,
       offering.semester,
       MAX(offering.status),
       MAX(offering.scores_recalculation_required),
       MAX(offering.scores_recalculated_at),
       MAX(offering.scores_recalculated_by),
       MAX(offering.finalized_at),
       MAX(offering.finalized_by),
       MAX(offering.created_by),
       MIN(offering.created_at),
       MAX(offering.updated_at)
FROM ele_free_elective_offerings offering
JOIN ele_free_elective_courses course
    ON course.free_elective_course_id = offering.free_elective_course_id
WHERE offering.deleted_at IS NULL
GROUP BY course.faculty_id, offering.academic_year_be, offering.semester
ON DUPLICATE KEY UPDATE
    status = VALUES(status),
    scores_recalculation_required = VALUES(scores_recalculation_required),
    scores_recalculated_at = VALUES(scores_recalculated_at),
    scores_recalculated_by = VALUES(scores_recalculated_by),
    finalized_at = VALUES(finalized_at),
    finalized_by = VALUES(finalized_by),
    updated_at = VALUES(updated_at);

-- Copy course metadata into each round. These are snapshots: future edits to
-- the master course must not rewrite a historical round.
INSERT INTO ele_free_elective_round_courses (
    round_id, free_elective_course_id, course_code, course_name_th,
    course_name_en, description, credits, grade_scheme, display_order,
    created_by, created_at, updated_at
)
SELECT round.round_id,
       course.free_elective_course_id,
       course.code,
       course.name_th,
       course.name_en,
       course.description,
       course.credits,
       course.grade_scheme,
       offering.offering_id,
       offering.created_by,
       offering.created_at,
       offering.updated_at
FROM ele_free_elective_offerings offering
JOIN ele_free_elective_courses course
    ON course.free_elective_course_id = offering.free_elective_course_id
JOIN ele_free_elective_rounds round
    ON round.faculty_id = course.faculty_id
   AND round.academic_year_be = offering.academic_year_be
   AND round.semester = offering.semester
   AND round.deleted_at IS NULL
WHERE offering.deleted_at IS NULL
ON DUPLICATE KEY UPDATE
    course_code = VALUES(course_code),
    course_name_th = VALUES(course_name_th),
    course_name_en = VALUES(course_name_en),
    description = VALUES(description),
    credits = VALUES(credits),
    grade_scheme = VALUES(grade_scheme),
    updated_at = VALUES(updated_at);

DROP TEMPORARY TABLE IF EXISTS tmp_free_elective_legacy_round_course_map;
CREATE TEMPORARY TABLE tmp_free_elective_legacy_round_course_map (
    offering_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    round_course_id BIGINT UNSIGNED NOT NULL,
    INDEX idx_tmp_free_elective_map_round_course (round_course_id)
) ENGINE=InnoDB;

INSERT INTO tmp_free_elective_legacy_round_course_map (offering_id, round_course_id)
SELECT offering.offering_id, roundCourse.round_course_id
FROM ele_free_elective_offerings offering
JOIN ele_free_elective_courses course
    ON course.free_elective_course_id = offering.free_elective_course_id
JOIN ele_free_elective_rounds round
    ON round.faculty_id = course.faculty_id
   AND round.academic_year_be = offering.academic_year_be
   AND round.semester = offering.semester
   AND round.deleted_at IS NULL
JOIN ele_free_elective_round_courses roundCourse
    ON roundCourse.round_id = round.round_id
   AND roundCourse.free_elective_course_id = offering.free_elective_course_id
   AND roundCourse.deleted_at IS NULL
WHERE offering.deleted_at IS NULL;

INSERT INTO ele_free_elective_round_course_competencies (
    round_course_id, competency_id, weight_percent, display_order,
    created_at, updated_at
)
SELECT legacyMap.round_course_id,
       mapping.competency_id,
       mapping.weight_percent,
       mapping.display_order,
       mapping.created_at,
       mapping.updated_at
FROM ele_offering_competencies mapping
JOIN tmp_free_elective_legacy_round_course_map legacyMap
    ON legacyMap.offering_id = mapping.offering_id
WHERE mapping.deleted_at IS NULL
ON DUPLICATE KEY UPDATE
    weight_percent = VALUES(weight_percent),
    display_order = VALUES(display_order),
    updated_at = VALUES(updated_at);

INSERT INTO ele_free_elective_round_course_enrollments (
    round_course_id, enrollment_id, enrollment_curriculum_id, status,
    enrolled_at, enrolled_by, created_at, updated_at
)
SELECT legacyMap.round_course_id,
       enrollment.enrollment_id,
       enrollment.enrollment_curriculum_id,
       enrollment.status,
       enrollment.enrolled_at,
       enrollment.enrolled_by,
       enrollment.created_at,
       enrollment.updated_at
FROM ele_offering_enrollments enrollment
JOIN tmp_free_elective_legacy_round_course_map legacyMap
    ON legacyMap.offering_id = enrollment.offering_id
WHERE enrollment.deleted_at IS NULL
ON DUPLICATE KEY UPDATE
    enrollment_curriculum_id = VALUES(enrollment_curriculum_id),
    status = VALUES(status),
    enrolled_at = VALUES(enrolled_at),
    enrolled_by = VALUES(enrolled_by),
    updated_at = VALUES(updated_at);

INSERT INTO ele_free_elective_round_course_grade_records (
    round_course_enrollment_id, grade, grade_source, source_reference,
    is_best_grade, recorded_by, recorded_at, created_at, updated_at
)
SELECT roundEnrollment.round_course_enrollment_id,
       grade.grade,
       grade.grade_source,
       grade.source_reference,
       grade.is_best_grade,
       grade.recorded_by,
       grade.recorded_at,
       grade.created_at,
       grade.updated_at
FROM ele_offering_grade_records grade
JOIN ele_offering_enrollments legacyEnrollment
    ON legacyEnrollment.offering_enrollment_id = grade.offering_enrollment_id
JOIN tmp_free_elective_legacy_round_course_map legacyMap
    ON legacyMap.offering_id = legacyEnrollment.offering_id
JOIN ele_free_elective_round_course_enrollments roundEnrollment
    ON roundEnrollment.round_course_id = legacyMap.round_course_id
   AND roundEnrollment.enrollment_id = legacyEnrollment.enrollment_id
   AND roundEnrollment.deleted_at IS NULL
WHERE grade.deleted_at IS NULL
  AND legacyEnrollment.deleted_at IS NULL
ON DUPLICATE KEY UPDATE
    grade = VALUES(grade),
    grade_source = VALUES(grade_source),
    source_reference = VALUES(source_reference),
    is_best_grade = VALUES(is_best_grade),
    recorded_by = VALUES(recorded_by),
    recorded_at = VALUES(recorded_at),
    updated_at = VALUES(updated_at);

INSERT INTO score_free_elective_round_course_competency_scores (
    grade_record_id, round_course_competency_id, raw_score, weighted_score,
    weight_snapshot, grade_snapshot, grade_scheme_snapshot, calculated_by,
    calculated_at, created_at, updated_at
)
SELECT roundGrade.grade_record_id,
       roundCompetency.round_course_competency_id,
       score.raw_score,
       score.weighted_score,
       score.weight_snapshot,
       score.grade_snapshot,
       score.grade_scheme_snapshot,
       score.calculated_by,
       score.calculated_at,
       score.created_at,
       score.updated_at
FROM score_free_elective_competency_scores score
JOIN ele_offering_grade_records legacyGrade
    ON legacyGrade.grade_record_id = score.grade_record_id
JOIN ele_offering_enrollments legacyEnrollment
    ON legacyEnrollment.offering_enrollment_id = legacyGrade.offering_enrollment_id
JOIN tmp_free_elective_legacy_round_course_map legacyMap
    ON legacyMap.offering_id = legacyEnrollment.offering_id
JOIN ele_free_elective_round_course_enrollments roundEnrollment
    ON roundEnrollment.round_course_id = legacyMap.round_course_id
   AND roundEnrollment.enrollment_id = legacyEnrollment.enrollment_id
   AND roundEnrollment.deleted_at IS NULL
JOIN ele_free_elective_round_course_grade_records roundGrade
    ON roundGrade.round_course_enrollment_id = roundEnrollment.round_course_enrollment_id
   AND roundGrade.deleted_at IS NULL
JOIN ele_offering_competencies legacyCompetency
    ON legacyCompetency.offering_competency_id = score.offering_competency_id
JOIN ele_free_elective_round_course_competencies roundCompetency
    ON roundCompetency.round_course_id = legacyMap.round_course_id
   AND roundCompetency.competency_id = legacyCompetency.competency_id
   AND roundCompetency.deleted_at IS NULL
WHERE score.deleted_at IS NULL
  AND legacyGrade.deleted_at IS NULL
  AND legacyEnrollment.deleted_at IS NULL
ON DUPLICATE KEY UPDATE
    raw_score = VALUES(raw_score),
    weighted_score = VALUES(weighted_score),
    weight_snapshot = VALUES(weight_snapshot),
    grade_snapshot = VALUES(grade_snapshot),
    grade_scheme_snapshot = VALUES(grade_scheme_snapshot),
    calculated_by = VALUES(calculated_by),
    calculated_at = VALUES(calculated_at),
    updated_at = VALUES(updated_at);

-- Postflight: every live legacy offering should have exactly one round course.
SELECT COUNT(*) AS legacy_live_offerings,
       COUNT(legacyMap.offering_id) AS migrated_offerings,
       COUNT(*) - COUNT(legacyMap.offering_id) AS unmigrated_offerings
FROM ele_free_elective_offerings offering
LEFT JOIN tmp_free_elective_legacy_round_course_map legacyMap
    ON legacyMap.offering_id = offering.offering_id
WHERE offering.deleted_at IS NULL;

SELECT round.round_id, round.faculty_id, round.academic_year_be,
       round.semester, COUNT(roundCourse.round_course_id) AS course_count
FROM ele_free_elective_rounds round
LEFT JOIN ele_free_elective_round_courses roundCourse
    ON roundCourse.round_id = round.round_id
   AND roundCourse.deleted_at IS NULL
WHERE round.deleted_at IS NULL
GROUP BY round.round_id, round.faculty_id, round.academic_year_be, round.semester
ORDER BY round.academic_year_be DESC, round.semester DESC, round.round_id;

DROP TEMPORARY TABLE IF EXISTS tmp_free_elective_legacy_round_course_map;

