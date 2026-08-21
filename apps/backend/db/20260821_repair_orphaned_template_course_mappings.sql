-- Repair existing Template mappings whose normal Course is no longer placed
-- in any live Curriculum owned by that Template.
-- This is a data repair only. Review and run manually; it is idempotent.

START TRANSACTION;

UPDATE comp_template_items cti
JOIN curri_curriculum_templates cct
  ON cct.template_id = cti.template_id
SET cti.is_active = 0,
    cti.deleted_at = NOW()
WHERE cct.deleted_at IS NULL
  AND cti.deleted_at IS NULL
  AND (cti.is_custom_course = 0 OR cti.is_custom_course IS NULL)
  AND NOT EXISTS (
    SELECT 1
    FROM curri_curriculum_templates current_cct
    JOIN crs_curriculum_courses cc
      ON cc.course_id = cti.course_id
    JOIN crs_course_categories cat
      ON cat.category_id = cc.category_id
    WHERE current_cct.template_id = cti.template_id
      AND current_cct.deleted_at IS NULL
      AND cat.curriculum_id = current_cct.curriculum_id
      AND cc.is_active = 1
      AND cc.deleted_at IS NULL
      AND cat.is_active = 1
      AND cat.deleted_at IS NULL
  );

COMMIT;
