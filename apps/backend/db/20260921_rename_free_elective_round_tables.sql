-- Free Elective Management v2: compact names for the canonical round model.
-- Run after 20260917_add_free_elective_round_schema.sql and
-- 20260917_migrate_free_elective_offerings_to_rounds.sql.
--
-- This migration intentionally keeps the legacy Offering tables. They are
-- read-only rollback data until the application cutover has been verified.

SELECT DATABASE() AS selected_database;

DELIMITER $$

DROP PROCEDURE IF EXISTS rename_free_elective_round_table$$
CREATE PROCEDURE rename_free_elective_round_table(
    IN old_table_name VARCHAR(64),
    IN new_table_name VARCHAR(64)
)
BEGIN
    DECLARE old_table_exists INT DEFAULT 0;
    DECLARE new_table_exists INT DEFAULT 0;

    SELECT COUNT(*) INTO old_table_exists
    FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = old_table_name;

    SELECT COUNT(*) INTO new_table_exists
    FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = new_table_name;

    IF old_table_exists = 1 AND new_table_exists = 0 THEN
        SET @rename_sql = CONCAT(
            'RENAME TABLE `', old_table_name, '` TO `', new_table_name, '`'
        );
        PREPARE rename_statement FROM @rename_sql;
        EXECUTE rename_statement;
        DEALLOCATE PREPARE rename_statement;
    ELSEIF old_table_exists = 0 AND new_table_exists = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Free-elective round table is missing during rename';
    ELSEIF old_table_exists = 1 AND new_table_exists = 1 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Both old and new free-elective round table names exist';
    END IF;
END$$

CALL rename_free_elective_round_table(
    'ele_free_elective_courses',
    'ele_courses'
)$$
CALL rename_free_elective_round_table(
    'ele_free_elective_rounds',
    'ele_rounds'
)$$
CALL rename_free_elective_round_table(
    'ele_free_elective_round_courses',
    'ele_round_courses'
)$$
CALL rename_free_elective_round_table(
    'ele_free_elective_round_course_competencies',
    'ele_round_course_competencies'
)$$
CALL rename_free_elective_round_table(
    'ele_free_elective_round_course_enrollments',
    'ele_course_enrollments'
)$$
CALL rename_free_elective_round_table(
    'ele_free_elective_round_course_grade_records',
    'ele_course_grades'
)$$
CALL rename_free_elective_round_table(
    'score_free_elective_round_course_competency_scores',
    'ele_course_scores'
)$$

DROP PROCEDURE IF EXISTS rename_free_elective_round_table$$

DELIMITER ;

SELECT table_name
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name IN (
      'ele_courses',
      'ele_rounds',
      'ele_round_courses',
      'ele_round_course_competencies',
      'ele_course_enrollments',
      'ele_course_grades',
      'ele_course_scores'
  )
ORDER BY table_name;
