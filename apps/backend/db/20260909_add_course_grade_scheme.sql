-- Course-specific grade schemes.
-- Run this migration manually against the selected database.

SET @add_grade_scheme_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE crs_courses ADD COLUMN grade_scheme ENUM(''letter'',''satisfactory'') NOT NULL DEFAULT ''letter'' AFTER credits',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'crs_courses'
    AND column_name = 'grade_scheme'
);
PREPARE add_grade_scheme_stmt FROM @add_grade_scheme_sql;
EXECUTE add_grade_scheme_stmt;
DEALLOCATE PREPARE add_grade_scheme_stmt;

UPDATE crs_courses
SET grade_scheme = 'letter'
WHERE grade_scheme IS NULL OR grade_scheme NOT IN ('letter', 'satisfactory');

SELECT grade_scheme, COUNT(*) AS course_count
FROM crs_courses
WHERE deleted_at IS NULL
GROUP BY grade_scheme
ORDER BY grade_scheme;
