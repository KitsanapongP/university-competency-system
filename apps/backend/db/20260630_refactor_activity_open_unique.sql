-- Activity Management v1 duplicate rule.
-- Only non-deleted activities that are still open for operation
-- (draft/published) block reuse of the same faculty + code + Thai name.

-- Preflight: this query must return zero rows before running the ALTER below.
-- If rows are returned, resolve duplicate draft/published activities first.
SELECT
  faculty_id,
  code,
  name_th,
  COUNT(*) AS duplicate_count,
  GROUP_CONCAT(activity_id ORDER BY activity_id) AS activity_ids
FROM act_activities
WHERE deleted_at IS NULL
  AND status IN ('draft', 'published')
  AND code IS NOT NULL
  AND TRIM(code) <> ''
GROUP BY faculty_id, code, name_th
HAVING COUNT(*) > 1;

ALTER TABLE act_activities
  ADD COLUMN open_unique_key TINYINT
    GENERATED ALWAYS AS (
      CASE
        WHEN deleted_at IS NULL AND status IN ('draft', 'published') THEN 1
        ELSE NULL
      END
    ) STORED;

CREATE UNIQUE INDEX uq_act_activities_open_faculty_code_name
  ON act_activities (faculty_id, code, name_th, open_unique_key);
