-- Fix Template course-to-competency mappings.
--
-- The legacy uq_cti_template_competency index permits only one row per
-- template and competency. That is incompatible with the current model:
-- one competency marker (course_id IS NULL) plus many course mappings.
--
-- Run this migration in the selected database before using Template weights.

-- Preflight: these rows contain legacy/corrupted marker-level weights.
-- They cannot be assigned back to a specific course automatically. Record them
-- for reference, then re-enter the affected course weights after this migration.
SELECT
  template_id,
  competency_id,
  weight,
  updated_at
FROM comp_template_items
WHERE course_id IS NULL
  AND weight IS NOT NULL
  AND deleted_at IS NULL
ORDER BY template_id, competency_id;

SET @schema_name = DATABASE();
SET @legacy_index_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'comp_template_items'
    AND INDEX_NAME = 'uq_cti_template_competency'
);
SET @drop_legacy_index_sql = IF(
  @legacy_index_exists > 0,
  'ALTER TABLE `comp_template_items` DROP INDEX `uq_cti_template_competency`;',
  'SELECT "INDEX uq_cti_template_competency already dropped";'
);
PREPARE drop_legacy_index_stmt FROM @drop_legacy_index_sql;
EXECUTE drop_legacy_index_stmt;
DEALLOCATE PREPARE drop_legacy_index_stmt;

-- Verify the live-only key required for course-level mappings is present.
SET @course_mapping_index_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'comp_template_items'
    AND INDEX_NAME = 'uq_cti_template_course_comp_live'
);
SET @add_course_mapping_index_sql = IF(
  @course_mapping_index_exists = 0,
  'ALTER TABLE `comp_template_items` ADD UNIQUE KEY `uq_cti_template_course_comp_live` (`template_id`, `competency_id`, `course_id`, `is_custom_course`, `live_unique_key`);',
  'SELECT "INDEX uq_cti_template_course_comp_live already exists";'
);
PREPARE add_course_mapping_index_stmt FROM @add_course_mapping_index_sql;
EXECUTE add_course_mapping_index_stmt;
DEALLOCATE PREPARE add_course_mapping_index_stmt;
