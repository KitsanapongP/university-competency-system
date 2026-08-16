-- Template ownership and Cohort assignment refactor.
-- Review the preflight result before running the ALTER statements.
-- This migration deliberately preserves curri_curriculum_templates as legacy history.

-- -----------------------------------------------------------------------------
-- Preflight: investigate every row returned before migration.
-- -----------------------------------------------------------------------------

-- A template with more than one active legacy Curriculum link needs manual repair.
SELECT
    cct.template_id,
    COUNT(DISTINCT cct.curriculum_id) AS active_curriculum_count
FROM curri_curriculum_templates cct
WHERE cct.deleted_at IS NULL
GROUP BY cct.template_id
HAVING COUNT(DISTINCT cct.curriculum_id) > 1;

-- Legacy links that cannot become current assignments remain unassigned.
SELECT
    cct.curriculum_template_id,
    cct.template_id,
    cct.curriculum_id,
    cct.cohort_year_be,
    cct.is_active AS legacy_assignment_active,
    tpl.is_active AS template_active,
    sc.cohort_id,
    sc.status AS cohort_status
FROM curri_curriculum_templates cct
JOIN comp_templates tpl ON tpl.template_id = cct.template_id AND tpl.deleted_at IS NULL
LEFT JOIN edu_student_cohorts sc
    ON sc.curriculum_id = cct.curriculum_id
    AND sc.entry_year_be = cct.cohort_year_be
    AND sc.deleted_at IS NULL
WHERE cct.deleted_at IS NULL
  AND (
      sc.cohort_id IS NULL
      OR sc.status <> 'active'
      OR cct.is_active <> 1
      OR tpl.is_active <> 1
  );

START TRANSACTION;

-- A NULL owner is reserved for legacy Templates whose Curriculum cannot be inferred.
ALTER TABLE comp_templates
    ADD COLUMN curriculum_id BIGINT UNSIGNED NULL AFTER faculty_id,
    ADD KEY idx_comp_templates_curriculum (curriculum_id),
    ADD CONSTRAINT fk_comp_templates_curriculum
        FOREIGN KEY (curriculum_id) REFERENCES edu_curricula(curriculum_id);

-- Backfill ownership only when the legacy Template has exactly one active Curriculum link.
UPDATE comp_templates tpl
JOIN (
    SELECT cct.template_id, MIN(cct.curriculum_id) AS curriculum_id
    FROM curri_curriculum_templates cct
    WHERE cct.deleted_at IS NULL
    GROUP BY cct.template_id
    HAVING COUNT(DISTINCT cct.curriculum_id) = 1
) source ON source.template_id = tpl.template_id
SET tpl.curriculum_id = source.curriculum_id
WHERE tpl.curriculum_id IS NULL;

CREATE TABLE curri_template_assignments (
    template_assignment_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    template_id BIGINT UNSIGNED NOT NULL,
    cohort_id BIGINT UNSIGNED NOT NULL,
    assigned_by BIGINT UNSIGNED NULL,
    assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_by BIGINT UNSIGNED NULL,
    ended_at DATETIME NULL,
    end_reason VARCHAR(500) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    live_unique_key TINYINT GENERATED ALWAYS AS (
        CASE WHEN deleted_at IS NULL THEN 1 ELSE NULL END
    ) STORED,
    PRIMARY KEY (template_assignment_id),
    UNIQUE KEY uq_template_assignments_template (template_id),
    UNIQUE KEY uq_template_assignments_cohort_live (cohort_id, live_unique_key),
    KEY idx_template_assignments_cohort (cohort_id),
    KEY idx_template_assignments_deleted_at (deleted_at),
    KEY fk_template_assignments_assigned_by (assigned_by),
    KEY fk_template_assignments_ended_by (ended_by),
    CONSTRAINT fk_template_assignments_template
        FOREIGN KEY (template_id) REFERENCES comp_templates(template_id),
    CONSTRAINT fk_template_assignments_cohort
        FOREIGN KEY (cohort_id) REFERENCES edu_student_cohorts(cohort_id),
    CONSTRAINT fk_template_assignments_assigned_by
        FOREIGN KEY (assigned_by) REFERENCES auth_users(user_id),
    CONSTRAINT fk_template_assignments_ended_by
        FOREIGN KEY (ended_by) REFERENCES auth_users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migrate only verified live relationships. All others remain unassigned Templates.
INSERT INTO curri_template_assignments (
    template_id,
    cohort_id,
    assigned_by,
    assigned_at,
    created_at,
    updated_at
)
SELECT
    cct.template_id,
    sc.cohort_id,
    cct.created_by,
    COALESCE(cct.created_at, NOW()),
    COALESCE(cct.created_at, NOW()),
    NOW()
FROM curri_curriculum_templates cct
JOIN comp_templates tpl
    ON tpl.template_id = cct.template_id
    AND tpl.deleted_at IS NULL
    AND tpl.is_active = 1
JOIN edu_student_cohorts sc
    ON sc.curriculum_id = cct.curriculum_id
    AND sc.entry_year_be = cct.cohort_year_be
    AND sc.status = 'active'
    AND sc.deleted_at IS NULL
WHERE cct.deleted_at IS NULL
  AND cct.is_active = 1
  AND tpl.curriculum_id = cct.curriculum_id;

COMMIT;

-- curri_curriculum_templates is retained as legacy history. New code must not write it.
