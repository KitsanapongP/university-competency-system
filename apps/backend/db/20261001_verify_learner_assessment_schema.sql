-- Read-only verification for learner assessment migrations.
-- Select the target database before running this file.

SELECT DATABASE() AS selected_database;

SELECT required.table_name,
       CASE WHEN actual.table_name IS NULL THEN 'MISSING' ELSE 'OK' END AS status,
       actual.engine
FROM (
    SELECT 'org_faculties' AS table_name
    UNION ALL SELECT 'auth_users'
    UNION ALL SELECT 'kku_enrollment_curricula'
    UNION ALL SELECT 'edu_curricula'
    UNION ALL SELECT 'comp_competencies'
    UNION ALL SELECT 'crs_coop_requirement_sets'
    UNION ALL SELECT 'coop_career_paths'
    UNION ALL SELECT 'coop_career_versions'
    UNION ALL SELECT 'coop_career_curricula'
    UNION ALL SELECT 'coop_career_competencies'
    UNION ALL SELECT 'ai_learner_reports'
    UNION ALL SELECT 'ai_report_jobs'
) required
LEFT JOIN information_schema.tables actual
    ON actual.table_schema = DATABASE()
   AND actual.table_name = required.table_name
ORDER BY required.table_name;

SELECT table_name, column_name, column_type, is_nullable, column_key, extra
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name IN (
      'coop_career_paths',
      'coop_career_versions',
      'coop_career_curricula',
      'coop_career_competencies',
      'ai_learner_reports',
      'ai_report_jobs'
  )
ORDER BY table_name, ordinal_position;

SELECT table_name, constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE constraint_schema = DATABASE()
  AND table_name IN (
      'coop_career_paths',
      'coop_career_versions',
      'coop_career_curricula',
      'coop_career_competencies',
      'ai_learner_reports',
      'ai_report_jobs'
  )
ORDER BY table_name, constraint_type, constraint_name;

SELECT table_name, index_name, non_unique, seq_in_index, column_name
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND table_name IN (
      'coop_career_paths',
      'coop_career_versions',
      'coop_career_curricula',
      'coop_career_competencies',
      'ai_learner_reports',
      'ai_report_jobs'
  )
ORDER BY table_name, index_name, seq_in_index;

SELECT table_name, column_name, referenced_table_name, referenced_column_name,
       constraint_name
FROM information_schema.key_column_usage
WHERE constraint_schema = DATABASE()
  AND table_name IN ('ai_learner_reports', 'ai_report_jobs')
  AND referenced_table_name IS NOT NULL
ORDER BY table_name, constraint_name, ordinal_position;
