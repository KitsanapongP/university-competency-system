-- Refactor comp_competencies.code uniqueness for soft delete.
-- Goal: active/non-deleted Competencies must have unique code, while
-- soft-deleted Competencies should not block creating the same code again.
--
-- Run the preflight SELECT first. It must return zero rows before ALTER.

SELECT
  code,
  COUNT(*) AS live_count
FROM comp_competencies
WHERE deleted_at IS NULL
GROUP BY code
HAVING COUNT(*) > 1;

-- Keep a generated key that participates in the unique index only for live rows.
-- MySQL unique indexes allow multiple NULL values, so deleted rows no longer
-- block code reuse.
ALTER TABLE comp_competencies
  ADD COLUMN live_unique_key TINYINT
    GENERATED ALWAYS AS (
      CASE WHEN deleted_at IS NULL THEN 1 ELSE NULL END
    ) STORED;

ALTER TABLE comp_competencies
  DROP INDEX uq_competencies_code;

ALTER TABLE comp_competencies
  ADD UNIQUE KEY uq_competencies_code_live (code, live_unique_key);
