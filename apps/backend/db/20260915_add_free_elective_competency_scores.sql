-- Free Elective Management: competency mappings and score storage
-- Run after 20260915_add_free_elective_course_offerings.sql and
-- 20260915_add_free_elective_enrollment_grades.sql.
-- Run this migration manually against the selected database.

SELECT DATABASE() AS selected_database;

-- Preflight: the current cohort-score schema is required. This migration does
-- not change the existing core, course, or activity score values.
SELECT required.table_name,
       CASE WHEN existing.table_name IS NULL THEN 'MISSING' ELSE 'OK' END AS status
FROM (
    SELECT 'comp_competencies' AS table_name
    UNION ALL SELECT 'edu_student_cohorts'
    UNION ALL SELECT 'score_competency_result'
    UNION ALL SELECT 'ele_free_elective_offerings'
    UNION ALL SELECT 'ele_offering_grade_records'
) required
LEFT JOIN information_schema.tables existing
    ON existing.table_schema = DATABASE()
   AND existing.table_name = required.table_name
ORDER BY required.table_name;

SELECT required.table_name,
       required.column_name,
       CASE WHEN existing.column_name IS NULL THEN 'MISSING' ELSE 'OK' END AS status
FROM (
    SELECT 'score_competency_result' AS table_name, 'course_bonus_score' AS column_name
    UNION ALL SELECT 'score_competency_result', 'activity_score'
    UNION ALL SELECT 'edu_student_cohorts', 'course_scores_recalculated_at'
) required
LEFT JOIN information_schema.columns existing
    ON existing.table_schema = DATABASE()
   AND existing.table_name = required.table_name
   AND existing.column_name = required.column_name
ORDER BY required.table_name, required.column_name;

CREATE TABLE IF NOT EXISTS ele_offering_competencies (
    offering_competency_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    offering_id BIGINT UNSIGNED NOT NULL,
    competency_id BIGINT UNSIGNED NOT NULL,
    weight_percent DECIMAL(6,2) NOT NULL,
    display_order INT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    live_unique_key TINYINT GENERATED ALWAYS AS (
        CASE WHEN deleted_at IS NULL THEN 1 ELSE NULL END
    ) STORED,
    PRIMARY KEY (offering_competency_id),
    UNIQUE KEY uq_ele_offering_competencies_live
        (offering_id, competency_id, live_unique_key),
    KEY idx_ele_offering_competencies_offering (offering_id),
    KEY idx_ele_offering_competencies_competency (competency_id),
    KEY idx_ele_offering_competencies_order (offering_id, display_order),
    KEY idx_ele_offering_competencies_deleted_at (deleted_at),
    CONSTRAINT fk_ele_offering_competencies_offering
        FOREIGN KEY (offering_id)
        REFERENCES ele_free_elective_offerings (offering_id)
        ON UPDATE CASCADE,
    CONSTRAINT fk_ele_offering_competencies_competency
        FOREIGN KEY (competency_id)
        REFERENCES comp_competencies (competency_id)
        ON UPDATE CASCADE,
    CONSTRAINT chk_ele_offering_competencies_weight
        CHECK (weight_percent >= 0 AND weight_percent <= 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Competency และ Weight ของรอบวิชาเสรี';

CREATE TABLE IF NOT EXISTS score_free_elective_competency_scores (
    free_elective_score_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    grade_record_id BIGINT UNSIGNED NOT NULL,
    offering_competency_id BIGINT UNSIGNED NOT NULL,
    raw_score DECIMAL(8,2) NOT NULL,
    weighted_score DECIMAL(10,4) NOT NULL,
    weight_snapshot DECIMAL(6,2) NOT NULL,
    grade_snapshot VARCHAR(5) NOT NULL,
    grade_scheme_snapshot VARCHAR(32) NOT NULL,
    calculated_by BIGINT UNSIGNED NULL,
    calculated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    live_unique_key TINYINT GENERATED ALWAYS AS (
        CASE WHEN deleted_at IS NULL THEN 1 ELSE NULL END
    ) STORED,
    PRIMARY KEY (free_elective_score_id),
    UNIQUE KEY uq_score_ele_grade_competency_live
        (grade_record_id, offering_competency_id, live_unique_key),
    KEY idx_score_ele_grade_record (grade_record_id),
    KEY idx_score_ele_offering_competency (offering_competency_id),
    KEY idx_score_ele_calculated_at (calculated_at),
    KEY idx_score_ele_deleted_at (deleted_at),
    CONSTRAINT fk_score_ele_grade_record
        FOREIGN KEY (grade_record_id)
        REFERENCES ele_offering_grade_records (grade_record_id)
        ON UPDATE CASCADE,
    CONSTRAINT fk_score_ele_offering_competency
        FOREIGN KEY (offering_competency_id)
        REFERENCES ele_offering_competencies (offering_competency_id)
        ON UPDATE CASCADE,
    CONSTRAINT fk_score_ele_calculated_by
        FOREIGN KEY (calculated_by) REFERENCES auth_users (user_id)
        ON UPDATE CASCADE,
    CONSTRAINT chk_score_ele_raw_score CHECK (raw_score >= 0 AND raw_score <= 100),
    CONSTRAINT chk_score_ele_weighted_score CHECK (weighted_score >= 0),
    CONSTRAINT chk_score_ele_weight_snapshot CHECK (
        weight_snapshot >= 0 AND weight_snapshot <= 100
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='คะแนน Competency ที่มาจากวิชาเสรี';

-- MySQL does not support ADD COLUMN IF NOT EXISTS consistently across the
-- supported versions, so each existing-table change is guarded explicitly.
SET @add_free_elective_score_sql = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE score_competency_result ADD COLUMN free_elective_score DECIMAL(8,2) NOT NULL DEFAULT 0.00 AFTER course_bonus_score',
        'SELECT 1'
    )
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'score_competency_result'
      AND column_name = 'free_elective_score'
);
PREPARE add_free_elective_score_stmt FROM @add_free_elective_score_sql;
EXECUTE add_free_elective_score_stmt;
DEALLOCATE PREPARE add_free_elective_score_stmt;

SET @add_cohort_free_recalc_required_sql = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE edu_student_cohorts ADD COLUMN free_elective_scores_recalculation_required TINYINT(1) NOT NULL DEFAULT 0 AFTER course_scores_recalculated_at',
        'SELECT 1'
    )
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'edu_student_cohorts'
      AND column_name = 'free_elective_scores_recalculation_required'
);
PREPARE add_cohort_free_recalc_required_stmt FROM @add_cohort_free_recalc_required_sql;
EXECUTE add_cohort_free_recalc_required_stmt;
DEALLOCATE PREPARE add_cohort_free_recalc_required_stmt;

SET @add_cohort_free_recalculated_at_sql = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE edu_student_cohorts ADD COLUMN free_elective_scores_recalculated_at DATETIME NULL AFTER free_elective_scores_recalculation_required',
        'SELECT 1'
    )
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'edu_student_cohorts'
      AND column_name = 'free_elective_scores_recalculated_at'
);
PREPARE add_cohort_free_recalculated_at_stmt FROM @add_cohort_free_recalculated_at_sql;
EXECUTE add_cohort_free_recalculated_at_stmt;
DEALLOCATE PREPARE add_cohort_free_recalculated_at_stmt;

-- Postflight: the new aggregate column is initialized to zero, so existing
-- competency results remain numerically unchanged until the new service runs.
SELECT table_name, column_name, column_type, is_nullable, column_default
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

SELECT table_name, column_name, COUNT(*) AS non_zero_or_pending_count
FROM (
    SELECT 'score_competency_result' AS table_name,
           CASE WHEN free_elective_score <> 0 THEN 'free_elective_score' END AS column_name
    FROM score_competency_result
    UNION ALL
    SELECT 'edu_student_cohorts',
           CASE WHEN free_elective_scores_recalculation_required = 1 THEN 'free_elective_scores_recalculation_required' END
    FROM edu_student_cohorts
) values_to_check
WHERE column_name IS NOT NULL
GROUP BY table_name, column_name;

SELECT table_name, index_name, non_unique, GROUP_CONCAT(column_name ORDER BY seq_in_index) AS columns_in_index
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND table_name IN ('ele_offering_competencies', 'score_free_elective_competency_scores')
GROUP BY table_name, index_name, non_unique
ORDER BY table_name, index_name;
