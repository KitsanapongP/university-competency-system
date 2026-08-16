-- Curriculum category codes are user-managed identifiers. Keep them unique only
-- while a category is live so a soft-deleted code can be reused later.
-- Review the preflight result before continuing with the ALTER statements.

SELECT
    curriculum_id,
  code,
  COUNT(*) AS live_category_count,
  GROUP_CONCAT(category_id ORDER BY category_id) AS category_ids
FROM crs_course_categories
WHERE deleted_at IS NULL
  AND NULLIF(TRIM(code), '') IS NOT NULL
GROUP BY curriculum_id, code
HAVING COUNT(*) > 1;

-- Preflight: every current Category should have a valid editable code before this rule is enforced.
SELECT
    category_id,
    curriculum_id,
    code,
    name_th
FROM crs_course_categories
WHERE deleted_at IS NULL
  AND (
      code IS NULL
      OR TRIM(code) = ''
      OR TRIM(code) NOT REGEXP '^[0-9]+(\\.[0-9]+){0,3}$'
  );

ALTER TABLE crs_course_categories
  ADD COLUMN live_unique_key TINYINT
    GENERATED ALWAYS AS (
      CASE WHEN deleted_at IS NULL THEN 1 ELSE NULL END
    ) STORED;

ALTER TABLE crs_course_categories
  ADD UNIQUE KEY uq_crs_course_categories_curriculum_code_live
    (curriculum_id, code, live_unique_key);
