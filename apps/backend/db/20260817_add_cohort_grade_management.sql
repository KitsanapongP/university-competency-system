-- Cohort Grade Management v1
-- Review the duplicate preflight result before running this migration.
-- The application does not execute this file automatically.

SELECT
  student_curricula_id,
  course_id,
  academic_year_be,
  semester,
  COUNT(*) AS live_grade_count
FROM crs_course_enrollment
WHERE deleted_at IS NULL
GROUP BY student_curricula_id, course_id, academic_year_be, semester
HAVING COUNT(*) > 1;

SELECT
  cohort_id
FROM edu_student_cohorts
WHERE deleted_at IS NULL;

-- These guarded statements make the migration safe to resume after a failed
-- ALTER TABLE. Review the preflight result set before the unique key step.
SET @add_grade_source_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE crs_course_enrollment ADD COLUMN grade_source ENUM(''manual'',''excel'',''reg'') NOT NULL DEFAULT ''manual'' AFTER grade',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'crs_course_enrollment'
    AND column_name = 'grade_source'
);
PREPARE add_grade_source_stmt FROM @add_grade_source_sql;
EXECUTE add_grade_source_stmt;
DEALLOCATE PREPARE add_grade_source_stmt;

SET @add_source_reference_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE crs_course_enrollment ADD COLUMN source_reference VARCHAR(255) NULL AFTER grade_source',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'crs_course_enrollment'
    AND column_name = 'source_reference'
);
PREPARE add_source_reference_stmt FROM @add_source_reference_sql;
EXECUTE add_source_reference_stmt;
DEALLOCATE PREPARE add_source_reference_stmt;

SET @add_course_live_key_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE crs_course_enrollment ADD COLUMN live_unique_key TINYINT GENERATED ALWAYS AS (CASE WHEN deleted_at IS NULL THEN 1 ELSE NULL END) STORED',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'crs_course_enrollment'
    AND column_name = 'live_unique_key'
);
PREPARE add_course_live_key_stmt FROM @add_course_live_key_sql;
EXECUTE add_course_live_key_stmt;
DEALLOCATE PREPARE add_course_live_key_stmt;

SET @add_course_grade_lookup_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE crs_course_enrollment ADD KEY idx_cce_grade_lookup (student_curricula_id, course_id, academic_year_be, semester, deleted_at)',
    'SELECT 1'
  )
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'crs_course_enrollment'
    AND index_name = 'idx_cce_grade_lookup'
);
PREPARE add_course_grade_lookup_stmt FROM @add_course_grade_lookup_sql;
EXECUTE add_course_grade_lookup_stmt;
DEALLOCATE PREPARE add_course_grade_lookup_stmt;

SET @add_course_grade_unique_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE crs_course_enrollment ADD UNIQUE KEY uq_cce_student_course_term_live (student_curricula_id, course_id, academic_year_be, semester, live_unique_key)',
    'SELECT 1'
  )
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'crs_course_enrollment'
    AND index_name = 'uq_cce_student_course_term_live'
);
PREPARE add_course_grade_unique_stmt FROM @add_course_grade_unique_sql;
EXECUTE add_course_grade_unique_stmt;
DEALLOCATE PREPARE add_course_grade_unique_stmt;

SET @add_recalc_required_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE edu_student_cohorts ADD COLUMN course_scores_recalculation_required TINYINT(1) NOT NULL DEFAULT 0 AFTER deleted_at',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'edu_student_cohorts'
    AND column_name = 'course_scores_recalculation_required'
);
PREPARE add_recalc_required_stmt FROM @add_recalc_required_sql;
EXECUTE add_recalc_required_stmt;
DEALLOCATE PREPARE add_recalc_required_stmt;

SET @add_recalculated_at_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE edu_student_cohorts ADD COLUMN course_scores_recalculated_at DATETIME NULL AFTER course_scores_recalculation_required',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'edu_student_cohorts'
    AND column_name = 'course_scores_recalculated_at'
);
PREPARE add_recalculated_at_stmt FROM @add_recalculated_at_sql;
EXECUTE add_recalculated_at_stmt;
DEALLOCATE PREPARE add_recalculated_at_stmt;

SELECT
  student_curricula_id,
  course_id,
  academic_year_be,
  semester,
  COUNT(*) AS live_grade_count
FROM crs_course_enrollment
WHERE deleted_at IS NULL
GROUP BY student_curricula_id, course_id, academic_year_be, semester
HAVING COUNT(*) > 1;
