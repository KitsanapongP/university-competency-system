-- Course Competency Scoring v1
-- Review the preflight result sets, then run this migration manually against
-- the target database. This script is not run automatically by the app.

-- Requirements must resolve to exactly one Cohort before cohort_id becomes required.
SELECT
  requirement.curriculum_requirement_id,
  requirement.curriculum_id,
  requirement.cohort_year_be,
  requirement.competency_id,
  COUNT(cohort.cohort_id) AS matching_cohort_count
FROM comp_curriculum_requirements requirement
LEFT JOIN edu_student_cohorts cohort
  ON cohort.curriculum_id = requirement.curriculum_id
  AND cohort.entry_year_be = requirement.cohort_year_be
  AND cohort.deleted_at IS NULL
WHERE requirement.deleted_at IS NULL
GROUP BY requirement.curriculum_requirement_id, requirement.curriculum_id,
  requirement.cohort_year_be, requirement.competency_id
HAVING COUNT(cohort.cohort_id) <> 1;

-- MySQL implicitly commits around ALTER TABLE. Review the preflight result
-- before executing this script; the application never executes it itself.

-- MySQL does not support ADD COLUMN IF NOT EXISTS on all supported server
-- versions. Make this step safe after a partially applied migration.
SET @add_cohort_id_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE comp_curriculum_requirements ADD COLUMN cohort_id BIGINT UNSIGNED NULL AFTER curriculum_id',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'comp_curriculum_requirements'
    AND column_name = 'cohort_id'
);
PREPARE add_cohort_id_stmt FROM @add_cohort_id_sql;
EXECUTE add_cohort_id_stmt;
DEALLOCATE PREPARE add_cohort_id_stmt;

UPDATE comp_curriculum_requirements requirement
JOIN edu_student_cohorts cohort
  ON cohort.curriculum_id = requirement.curriculum_id
  AND cohort.entry_year_be = requirement.cohort_year_be
  AND cohort.deleted_at IS NULL
SET requirement.cohort_id = cohort.cohort_id
WHERE requirement.deleted_at IS NULL;

-- The legacy unique key starts with curriculum_id and is currently used by
-- fk_ccr_curriculum. Add a replacement supporting index before dropping it.
ALTER TABLE comp_curriculum_requirements
  ADD KEY idx_comp_req_curriculum (curriculum_id);

ALTER TABLE comp_curriculum_requirements
  DROP INDEX uq_comp_req_curri_cohort_comp,
  CHANGE COLUMN target_percent target_score DECIMAL(8,2) NOT NULL DEFAULT 100.00,
  MODIFY COLUMN cohort_id BIGINT UNSIGNED NOT NULL,
  ADD UNIQUE KEY uq_comp_req_cohort_comp (cohort_id, competency_id),
  ADD KEY idx_comp_req_cohort (cohort_id),
  ADD CONSTRAINT fk_comp_req_cohort
    FOREIGN KEY (cohort_id) REFERENCES edu_student_cohorts(cohort_id) ON UPDATE CASCADE;

ALTER TABLE score_course_competency_scores
  ADD COLUMN template_id BIGINT UNSIGNED NULL AFTER competency_id,
  ADD COLUMN template_item_id BIGINT UNSIGNED NULL AFTER template_id,
  ADD COLUMN weight_snapshot DECIMAL(6,2) NULL AFTER weighted_score,
  ADD COLUMN grade_snapshot VARCHAR(5) NULL AFTER weight_snapshot,
  ADD COLUMN score_type_snapshot ENUM('core', 'bonus') NULL AFTER grade_snapshot,
  ADD COLUMN calculated_at DATETIME NULL AFTER score_type_snapshot,
  ADD KEY idx_sccs_template (template_id),
  ADD KEY idx_sccs_template_item (template_item_id);

ALTER TABLE score_competency_result
  ADD COLUMN core_score DECIMAL(8,2) NOT NULL DEFAULT 0.00 AFTER competency_id,
  ADD COLUMN course_bonus_score DECIMAL(8,2) NOT NULL DEFAULT 0.00 AFTER core_score,
  ADD COLUMN activity_score DECIMAL(8,2) NOT NULL DEFAULT 0.00 AFTER course_bonus_score;

-- Fixed Grade Map for Course Competency Scoring v1. Existing rows are retained.
INSERT INTO crs_grade_maps (grade, score)
SELECT source.grade, source.score
FROM (
  SELECT 'A' AS grade, 100 AS score UNION ALL
  SELECT 'B+', 85 UNION ALL
  SELECT 'B', 80 UNION ALL
  SELECT 'C+', 75 UNION ALL
  SELECT 'C', 70 UNION ALL
  SELECT 'D+', 65 UNION ALL
  SELECT 'D', 60 UNION ALL
  SELECT 'F', 0
) source
WHERE NOT EXISTS (
  SELECT 1
  FROM crs_grade_maps existing
  WHERE existing.grade = source.grade AND existing.deleted_at IS NULL
);
