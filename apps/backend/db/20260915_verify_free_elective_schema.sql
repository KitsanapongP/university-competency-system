-- Free Elective Management: read-only migration verification
-- Run after all three 20260915 free-elective migrations.
-- Select the target database in the SQL client before running this file.
-- This file does not insert, update, delete, or alter any data.

SELECT DATABASE() AS selected_database;

-- 1. Every table used by the free-elective module must exist.
SELECT required.table_name,
       CASE WHEN existing.table_name IS NULL THEN 'MISSING' ELSE 'OK' END AS status
FROM (
    SELECT 'ele_free_elective_courses' AS table_name
    UNION ALL SELECT 'ele_free_elective_offerings'
    UNION ALL SELECT 'ele_offering_competencies'
    UNION ALL SELECT 'ele_offering_enrollments'
    UNION ALL SELECT 'ele_offering_grade_records'
    UNION ALL SELECT 'score_free_elective_competency_scores'
    UNION ALL SELECT 'score_competency_result'
    UNION ALL SELECT 'edu_student_cohorts'
) required
LEFT JOIN information_schema.tables existing
    ON existing.table_schema = DATABASE()
   AND existing.table_name = required.table_name
ORDER BY required.table_name;

-- 2. Check the new aggregate columns and their safe defaults.
SELECT table_name,
       column_name,
       column_type,
       is_nullable,
       column_default
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND (
      (
          table_name = 'score_competency_result'
          AND column_name = 'free_elective_score'
      )
      OR (
          table_name = 'edu_student_cohorts'
          AND column_name IN (
              'free_elective_scores_recalculation_required',
              'free_elective_scores_recalculated_at'
          )
      )
  )
ORDER BY table_name, ordinal_position;

SELECT
    COUNT(*) AS existing_result_count,
    SUM(CASE WHEN free_elective_score = 0 THEN 1 ELSE 0 END) AS zero_free_elective_score_count,
    SUM(CASE WHEN free_elective_score <> 0 THEN 1 ELSE 0 END) AS non_zero_free_elective_score_count
FROM score_competency_result;

-- 3. Verify the live-record unique indexes. A deleted row has a NULL
-- live_unique_key, so it remains historical without blocking a new live row.
SELECT table_name,
       index_name,
       non_unique,
       GROUP_CONCAT(column_name ORDER BY seq_in_index) AS columns_in_index
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND (
      (
          table_name = 'ele_free_elective_courses'
          AND index_name = 'uq_ele_free_courses_faculty_code_live'
      )
      OR (
          table_name = 'ele_free_elective_offerings'
          AND index_name = 'uq_ele_offerings_course_period_section_live'
      )
      OR (
          table_name = 'ele_offering_competencies'
          AND index_name = 'uq_ele_offering_competencies_live'
      )
      OR (
          table_name = 'ele_offering_enrollments'
          AND index_name = 'uq_ele_enrollments_offering_student_live'
      )
      OR (
          table_name = 'ele_offering_grade_records'
          AND index_name = 'uq_ele_grade_records_enrollment_live'
      )
      OR (
          table_name = 'score_free_elective_competency_scores'
          AND index_name = 'uq_score_ele_grade_competency_live'
      )
  )
GROUP BY table_name, index_name, non_unique
ORDER BY table_name, index_name;

-- 4. No active duplicate should exist after application data is written.
SELECT 'ele_free_elective_courses' AS table_name,
       faculty_id,
       code,
       COUNT(*) AS live_count
FROM ele_free_elective_courses
WHERE deleted_at IS NULL
GROUP BY faculty_id, code
HAVING COUNT(*) > 1
UNION ALL
SELECT 'ele_free_elective_offerings',
       free_elective_course_id,
       CONCAT(academic_year_be, '/', semester, '/', section_no),
       COUNT(*)
FROM ele_free_elective_offerings
WHERE deleted_at IS NULL
GROUP BY free_elective_course_id, academic_year_be, semester, section_no
HAVING COUNT(*) > 1
UNION ALL
SELECT 'ele_offering_competencies',
       offering_id,
       CAST(competency_id AS CHAR),
       COUNT(*)
FROM ele_offering_competencies
WHERE deleted_at IS NULL
GROUP BY offering_id, competency_id
HAVING COUNT(*) > 1
UNION ALL
SELECT 'ele_offering_enrollments',
       offering_id,
       CAST(enrollment_id AS CHAR),
       COUNT(*)
FROM ele_offering_enrollments
WHERE deleted_at IS NULL
GROUP BY offering_id, enrollment_id
HAVING COUNT(*) > 1
UNION ALL
SELECT 'ele_offering_grade_records',
       offering_enrollment_id,
       'live_grade_record',
       COUNT(*)
FROM ele_offering_grade_records
WHERE deleted_at IS NULL
GROUP BY offering_enrollment_id
HAVING COUNT(*) > 1
UNION ALL
SELECT 'score_free_elective_competency_scores',
       grade_record_id,
       CAST(offering_competency_id AS CHAR),
       COUNT(*)
FROM score_free_elective_competency_scores
WHERE deleted_at IS NULL
GROUP BY grade_record_id, offering_competency_id
HAVING COUNT(*) > 1;

-- 5. Review every foreign-key target and every range check declared by the
-- migration. The result should contain all expected relationships/checks.
SELECT table_name,
       constraint_name,
       referenced_table_name,
       referenced_column_name
FROM information_schema.key_column_usage
WHERE constraint_schema = DATABASE()
  AND referenced_table_name IS NOT NULL
  AND table_name IN (
      'ele_free_elective_courses',
      'ele_free_elective_offerings',
      'ele_offering_competencies',
      'ele_offering_enrollments',
      'ele_offering_grade_records',
      'score_free_elective_competency_scores'
  )
ORDER BY table_name, constraint_name, ordinal_position;

SELECT constraint_name,
       table_name,
       check_clause
FROM information_schema.check_constraints
WHERE constraint_schema = DATABASE()
  AND table_name IN (
      'ele_free_elective_offerings',
      'ele_offering_competencies',
      'ele_offering_grade_records',
      'score_free_elective_competency_scores'
  )
ORDER BY table_name, constraint_name;

-- 6. These cases are intentionally enforced by the application service in a
-- transaction because they compare values across tables:
--   * enrollment_id and enrollment_curriculum_id belong to one learner;
--   * the enrollment is inside the offering's faculty scope;
--   * only the best grade is marked is_best_grade;
--   * finalizing an offering recalculates its free-elective scores atomically.
