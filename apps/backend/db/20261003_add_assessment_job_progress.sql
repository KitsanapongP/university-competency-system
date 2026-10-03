-- Adds observable progress to learner assessment jobs. Safe to rerun in MySQL clients.
SET @ucs_schema_name = DATABASE();

SET @ucs_has_progress_phase = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @ucs_schema_name
      AND TABLE_NAME = 'ai_report_jobs'
      AND COLUMN_NAME = 'progress_phase'
);
SET @ucs_progress_phase_ddl = IF(
    @ucs_has_progress_phase = 0,
    'ALTER TABLE ai_report_jobs ADD COLUMN progress_phase VARCHAR(24) NULL AFTER status',
    'SELECT 1'
);
PREPARE ucs_progress_phase_stmt FROM @ucs_progress_phase_ddl;
EXECUTE ucs_progress_phase_stmt;
DEALLOCATE PREPARE ucs_progress_phase_stmt;

SET @ucs_has_phase_started_at = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @ucs_schema_name
      AND TABLE_NAME = 'ai_report_jobs'
      AND COLUMN_NAME = 'phase_started_at'
);
SET @ucs_phase_started_at_ddl = IF(
    @ucs_has_phase_started_at = 0,
    'ALTER TABLE ai_report_jobs ADD COLUMN phase_started_at DATETIME NULL AFTER progress_phase',
    'SELECT 1'
);
PREPARE ucs_phase_started_at_stmt FROM @ucs_phase_started_at_ddl;
EXECUTE ucs_phase_started_at_stmt;
DEALLOCATE PREPARE ucs_phase_started_at_stmt;

SET @ucs_has_last_provider_activity_at = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @ucs_schema_name
      AND TABLE_NAME = 'ai_report_jobs'
      AND COLUMN_NAME = 'last_provider_activity_at'
);
SET @ucs_last_provider_activity_at_ddl = IF(
    @ucs_has_last_provider_activity_at = 0,
    'ALTER TABLE ai_report_jobs ADD COLUMN last_provider_activity_at DATETIME NULL AFTER phase_started_at',
    'SELECT 1'
);
PREPARE ucs_last_provider_activity_at_stmt FROM @ucs_last_provider_activity_at_ddl;
EXECUTE ucs_last_provider_activity_at_stmt;
DEALLOCATE PREPARE ucs_last_provider_activity_at_stmt;

SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = @ucs_schema_name
  AND TABLE_NAME = 'ai_report_jobs'
  AND COLUMN_NAME IN ('progress_phase', 'phase_started_at', 'last_provider_activity_at')
ORDER BY ORDINAL_POSITION;
