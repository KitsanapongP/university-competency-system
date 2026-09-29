-- Split cooperative requirement history into independent semester tracks.
-- Run with the application stopped and select the target database first.

SELECT DATABASE() AS selected_database;

SELECT required.table_name,
       CASE WHEN existing.table_name IS NULL THEN 'MISSING' ELSE 'OK' END AS status
FROM (
    SELECT 'crs_coop_requirement_sets' AS table_name
    UNION ALL SELECT 'crs_coop_requirements'
) required
LEFT JOIN information_schema.tables existing
    ON existing.table_schema = DATABASE()
   AND existing.table_name = required.table_name
ORDER BY required.table_name;

-- Add the nullable column first so a retry can detect legacy rows by NULL.
SET @coop_sql = IF(
    (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'crs_coop_requirement_sets'
       AND column_name = 'semester') = 0,
    'ALTER TABLE crs_coop_requirement_sets ADD COLUMN semester TINYINT UNSIGNED NULL AFTER curriculum_id',
    'SELECT ''semester column already exists'' AS migration_status'
);
PREPARE coop_stmt FROM @coop_sql;
EXECUTE coop_stmt;
DEALLOCATE PREPARE coop_stmt;

-- Replace curriculum-only unique indexes with semester-scoped indexes.
SET @coop_sql = IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = 'crs_coop_requirement_sets'
       AND index_name = 'uq_crs_coop_set_revision') > 0,
    'ALTER TABLE crs_coop_requirement_sets DROP INDEX uq_crs_coop_set_revision',
    'SELECT ''legacy revision index already removed'' AS migration_status'
);
PREPARE coop_stmt FROM @coop_sql;
EXECUTE coop_stmt;
DEALLOCATE PREPARE coop_stmt;

SET @coop_sql = IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = 'crs_coop_requirement_sets'
       AND index_name = 'uq_crs_coop_draft_curriculum') > 0,
    'ALTER TABLE crs_coop_requirement_sets DROP INDEX uq_crs_coop_draft_curriculum',
    'SELECT ''legacy draft index already removed'' AS migration_status'
);
PREPARE coop_stmt FROM @coop_sql;
EXECUTE coop_stmt;
DEALLOCATE PREPARE coop_stmt;

SET @coop_sql = IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = 'crs_coop_requirement_sets'
       AND index_name = 'uq_crs_coop_published_curriculum') > 0,
    'ALTER TABLE crs_coop_requirement_sets DROP INDEX uq_crs_coop_published_curriculum',
    'SELECT ''legacy published index already removed'' AS migration_status'
);
PREPARE coop_stmt FROM @coop_sql;
EXECUTE coop_stmt;
DEALLOCATE PREPARE coop_stmt;

SET @coop_sql = IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = 'crs_coop_requirement_sets'
       AND index_name = 'uq_crs_coop_set_revision_semester') = 0,
    'ALTER TABLE crs_coop_requirement_sets ADD UNIQUE KEY uq_crs_coop_set_revision_semester (curriculum_id, semester, revision)',
    'SELECT ''semester revision index already exists'' AS migration_status'
);
PREPARE coop_stmt FROM @coop_sql;
EXECUTE coop_stmt;
DEALLOCATE PREPARE coop_stmt;

SET @coop_sql = IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = 'crs_coop_requirement_sets'
       AND index_name = 'uq_crs_coop_draft_curriculum_semester') = 0,
    'ALTER TABLE crs_coop_requirement_sets ADD UNIQUE KEY uq_crs_coop_draft_curriculum_semester (draft_curriculum_id, semester)',
    'SELECT ''semester draft index already exists'' AS migration_status'
);
PREPARE coop_stmt FROM @coop_sql;
EXECUTE coop_stmt;
DEALLOCATE PREPARE coop_stmt;

SET @coop_sql = IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = 'crs_coop_requirement_sets'
       AND index_name = 'uq_crs_coop_published_curriculum_semester') = 0,
    'ALTER TABLE crs_coop_requirement_sets ADD UNIQUE KEY uq_crs_coop_published_curriculum_semester (published_curriculum_id, semester)',
    'SELECT ''semester published index already exists'' AS migration_status'
);
PREPARE coop_stmt FROM @coop_sql;
EXECUTE coop_stmt;
DEALLOCATE PREPARE coop_stmt;

-- All legacy sets become semester 1; their complete history is copied to semester 2.
-- The data copy and source assignment are atomic, so rerunning after a failure is safe.
START TRANSACTION;

INSERT INTO crs_coop_requirement_sets (
    curriculum_id, semester, revision, status,
    created_by, published_by, published_at, created_at, updated_at
)
SELECT source.curriculum_id, 2, source.revision, source.status,
       source.created_by, source.published_by, source.published_at,
       source.created_at, source.updated_at
FROM crs_coop_requirement_sets source
WHERE source.semester IS NULL;

INSERT INTO crs_coop_requirements (
    requirement_set_id, criterion_type, name_th, name_en,
    minimum_value, minimum_grade, category_id, course_id,
    display_order, created_at, updated_at
)
SELECT target.requirement_set_id, requirement.criterion_type,
       requirement.name_th, requirement.name_en,
       requirement.minimum_value, requirement.minimum_grade,
       requirement.category_id, requirement.course_id,
       requirement.display_order, requirement.created_at, requirement.updated_at
FROM crs_coop_requirement_sets source
JOIN crs_coop_requirement_sets target
  ON target.curriculum_id = source.curriculum_id
 AND target.revision = source.revision
 AND target.semester = 2
JOIN crs_coop_requirements requirement
  ON requirement.requirement_set_id = source.requirement_set_id
WHERE source.semester IS NULL;

UPDATE crs_coop_requirement_sets
SET semester = 1
WHERE semester IS NULL;

COMMIT;

SET @coop_sql = IF(
    (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'crs_coop_requirement_sets'
       AND column_name = 'semester'
       AND is_nullable = 'YES') > 0,
    'ALTER TABLE crs_coop_requirement_sets MODIFY COLUMN semester TINYINT UNSIGNED NOT NULL AFTER curriculum_id',
    'SELECT ''semester is already required'' AS migration_status'
);
PREPARE coop_stmt FROM @coop_sql;
EXECUTE coop_stmt;
DEALLOCATE PREPARE coop_stmt;

SET @coop_sql = IF(
    (SELECT COUNT(*) FROM information_schema.table_constraints
     WHERE constraint_schema = DATABASE()
       AND table_name = 'crs_coop_requirement_sets'
       AND constraint_name = 'chk_crs_coop_set_semester'
       AND constraint_type = 'CHECK') = 0,
    'ALTER TABLE crs_coop_requirement_sets ADD CONSTRAINT chk_crs_coop_set_semester CHECK (semester IN (1, 2))',
    'SELECT ''semester check already exists'' AS migration_status'
);
PREPARE coop_stmt FROM @coop_sql;
EXECUTE coop_stmt;
DEALLOCATE PREPARE coop_stmt;

SELECT semester, status, COUNT(*) AS requirement_set_count
FROM crs_coop_requirement_sets
GROUP BY semester, status
ORDER BY semester, status;

SELECT sets.semester, COUNT(requirements.requirement_id) AS requirement_count
FROM crs_coop_requirement_sets sets
LEFT JOIN crs_coop_requirements requirements
  ON requirements.requirement_set_id = sets.requirement_set_id
GROUP BY sets.semester
ORDER BY sets.semester;

SELECT COUNT(*) AS invalid_semester_rows
FROM crs_coop_requirement_sets
WHERE semester IS NULL OR semester NOT IN (1, 2);
