-- ============================================================
-- Migration: Add Template Additional Courses & Categories
-- Date: 2026-07-07
-- Description:
-- 1. Create comp_template_categories for template-specific custom categories
-- 2. Create comp_template_courses for template-specific custom courses
-- 3. Modify comp_template_items to remove master course foreign key constraint and add is_custom_course flag
-- ============================================================

-- 1. Create comp_template_categories
CREATE TABLE IF NOT EXISTS `comp_template_categories` (
  `template_category_id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'Primary key of template custom category',
  `template_id` bigint unsigned NOT NULL COMMENT 'FK to comp_templates',
  `curriculum_parent_id` bigint unsigned DEFAULT NULL COMMENT 'FK to master category if placed under master category',
  `parent_id` bigint unsigned DEFAULT NULL COMMENT 'FK to self for hierarchy (NULL = root or under master)',
  `code` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Category code e.g. 1, 1.1',
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Category name',
  `display_order` int unsigned NOT NULL DEFAULT '0' COMMENT 'Display order in UI',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'Active flag',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete timestamp',
  PRIMARY KEY (`template_category_id`),
  KEY `idx_ctc_template` (`template_id`),
  KEY `idx_ctc_curri_parent` (`curriculum_parent_id`),
  KEY `idx_ctc_parent` (`parent_id`),
  KEY `idx_ctc_deleted_at` (`deleted_at`),
  CONSTRAINT `fk_ctc_template` FOREIGN KEY (`template_id`) REFERENCES `comp_templates` (`template_id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_ctc_parent` FOREIGN KEY (`parent_id`) REFERENCES `comp_template_categories` (`template_category_id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=50001 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Template Additional Categories';

-- 2. Create comp_template_courses
CREATE TABLE IF NOT EXISTS `comp_template_courses` (
  `template_course_id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'Primary key of template custom course',
  `template_id` bigint unsigned NOT NULL COMMENT 'FK to comp_templates',
  `curriculum_category_id` bigint unsigned DEFAULT NULL COMMENT 'FK to crs_course_categories if placed under master category',
  `template_category_id` bigint unsigned DEFAULT NULL COMMENT 'FK to comp_template_categories if placed under custom category',
  `code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Course code',
  `name_th` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Course name TH',
  `name_en` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Course name EN',
  `credits` tinyint unsigned NOT NULL DEFAULT '3' COMMENT 'Credits',
  `description` text COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Course description',
  `display_order` int unsigned NOT NULL DEFAULT '0' COMMENT 'Display order',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'Active flag',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete timestamp',
  PRIMARY KEY (`template_course_id`),
  KEY `idx_ctco_template` (`template_id`),
  KEY `idx_ctco_curri_cat` (`curriculum_category_id`),
  KEY `idx_ctco_tpl_cat` (`template_category_id`),
  KEY `idx_ctco_deleted_at` (`deleted_at`),
  CONSTRAINT `fk_ctco_template` FOREIGN KEY (`template_id`) REFERENCES `comp_templates` (`template_id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Template Additional Courses';

-- 3. Modify comp_template_items: Drop foreign key constraint fk_cti_course_id if exists
SET @schema_name = DATABASE();
SET @fk_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = @schema_name AND TABLE_NAME = 'comp_template_items' AND CONSTRAINT_NAME = 'fk_cti_course_id' AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql = IF(@fk_exists > 0, 'ALTER TABLE `comp_template_items` DROP FOREIGN KEY `fk_cti_course_id`;', 'SELECT "FK fk_cti_course_id already dropped or not exists";');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. Add is_custom_course column to comp_template_items if not exists
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'comp_template_items' AND COLUMN_NAME = 'is_custom_course');
SET @sql_col = IF(@col_exists = 0, 'ALTER TABLE `comp_template_items` ADD COLUMN `is_custom_course` tinyint(1) NOT NULL DEFAULT 0 COMMENT "0=master course, 1=template custom course" AFTER `course_id`;', 'SELECT "Column is_custom_course already exists";');
PREPARE stmt_col FROM @sql_col;
EXECUTE stmt_col;
DEALLOCATE PREPARE stmt_col;

-- 5. Add live_unique_key to comp_template_items for soft delete support
SET @col_live_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'comp_template_items' AND COLUMN_NAME = 'live_unique_key');
SET @sql_live = IF(@col_live_exists = 0, 'ALTER TABLE `comp_template_items` ADD COLUMN `live_unique_key` tinyint GENERATED ALWAYS AS ((case when (`deleted_at` is null) then 1 else NULL end)) STORED AFTER `is_active`;', 'SELECT "Column live_unique_key already exists";');
PREPARE stmt_live FROM @sql_live;
EXECUTE stmt_live;
DEALLOCATE PREPARE stmt_live;

-- 6. Modify UNIQUE KEY on comp_template_items to support soft delete and is_custom_course
SET @idx_old_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'comp_template_items' AND INDEX_NAME = 'uq_cti_template_course_competency');
SET @sql_drop_idx = IF(@idx_old_exists > 0, 'ALTER TABLE `comp_template_items` DROP INDEX `uq_cti_template_course_competency`;', 'SELECT "INDEX uq_cti_template_course_competency already dropped";');
PREPARE stmt_drop_idx FROM @sql_drop_idx;
EXECUTE stmt_drop_idx;
DEALLOCATE PREPARE stmt_drop_idx;

SET @idx_new_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'comp_template_items' AND INDEX_NAME = 'uq_cti_template_course_comp_live');
SET @sql_add_idx = IF(@idx_new_exists = 0, 'ALTER TABLE `comp_template_items` ADD UNIQUE KEY `uq_cti_template_course_comp_live` (`template_id`, `competency_id`, `course_id`, `is_custom_course`, `live_unique_key`);', 'SELECT "INDEX uq_cti_template_course_comp_live already exists";');
PREPARE stmt_add_idx FROM @sql_add_idx;
EXECUTE stmt_add_idx;
DEALLOCATE PREPARE stmt_add_idx;
