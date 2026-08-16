-- Student Management + Cohort v1
-- Run this migration manually against the target database after reviewing the
-- preflight result set. It does not create learner login accounts.

-- Preflight: existing curriculum history must resolve to one cohort identity.
SELECT
  ec.curriculum_id,
  ec.start_academic_year_be AS entry_year_be,
  COUNT(*) AS enrollment_curriculum_count,
  SUM(CASE WHEN ec.is_current = 1 THEN 1 ELSE 0 END) AS current_members
FROM kku_enrollment_curricula ec
WHERE ec.deleted_at IS NULL
GROUP BY ec.curriculum_id, ec.start_academic_year_be
ORDER BY ec.curriculum_id, ec.start_academic_year_be;

CREATE TABLE edu_student_cohorts (
  cohort_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  curriculum_id BIGINT UNSIGNED NOT NULL,
  entry_year_be SMALLINT UNSIGNED NOT NULL,
  status ENUM('draft', 'active', 'archived') NOT NULL DEFAULT 'draft',
  note VARCHAR(500) NULL,
  created_by BIGINT UNSIGNED NULL,
  last_reactivation_reason VARCHAR(500) NULL,
  last_reactivated_at DATETIME NULL,
  last_reactivated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (cohort_id),
  UNIQUE KEY uq_student_cohorts_curriculum_entry_year (curriculum_id, entry_year_be),
  KEY idx_student_cohorts_curriculum (curriculum_id),
  KEY idx_student_cohorts_status (status),
  KEY idx_student_cohorts_deleted_at (deleted_at),
  CONSTRAINT fk_student_cohorts_curriculum
    FOREIGN KEY (curriculum_id) REFERENCES edu_curricula (curriculum_id) ON UPDATE CASCADE,
  CONSTRAINT fk_student_cohorts_created_by
    FOREIGN KEY (created_by) REFERENCES auth_users (user_id) ON UPDATE CASCADE,
  CONSTRAINT fk_student_cohorts_last_reactivated_by
    FOREIGN KEY (last_reactivated_by) REFERENCES auth_users (user_id) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Student cohort grouped by curriculum and entry year';

-- Backfill a cohort for every existing live curriculum-history identity.
INSERT INTO edu_student_cohorts (curriculum_id, entry_year_be, status, note)
SELECT
  ec.curriculum_id,
  ec.start_academic_year_be,
  CASE WHEN MAX(CASE WHEN ec.is_current = 1 THEN 1 ELSE 0 END) = 1 THEN 'active' ELSE 'archived' END,
  'Backfilled from existing curriculum enrollment history'
FROM kku_enrollment_curricula ec
WHERE ec.deleted_at IS NULL
GROUP BY ec.curriculum_id, ec.start_academic_year_be;

ALTER TABLE kku_enrollment_curricula
  ADD COLUMN cohort_id BIGINT UNSIGNED NULL
    COMMENT 'Student cohort membership source of truth' AFTER curriculum_id,
  ADD KEY idx_kec_cohort (cohort_id),
  ADD CONSTRAINT fk_kec_cohort
    FOREIGN KEY (cohort_id) REFERENCES edu_student_cohorts (cohort_id) ON UPDATE CASCADE;

UPDATE kku_enrollment_curricula ec
JOIN edu_student_cohorts sc
  ON sc.curriculum_id = ec.curriculum_id
  AND sc.entry_year_be = ec.start_academic_year_be
SET ec.cohort_id = sc.cohort_id
WHERE ec.deleted_at IS NULL;

-- Postflight check: this should return zero rows before the application uses
-- Student Management. Historical soft-deleted rows intentionally remain NULL.
SELECT enrollment_curriculum_id, enrollment_id, curriculum_id, start_academic_year_be
FROM kku_enrollment_curricula
WHERE deleted_at IS NULL
  AND cohort_id IS NULL;
