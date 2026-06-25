-- MySQL dump 10.13  Distrib 8.0.34, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: kku_competency_localhost
-- ------------------------------------------------------
-- Server version	9.4.0

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `act_activities`
--

DROP TABLE IF EXISTS `act_activities`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `act_activities` (
  `activity_id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'Primary key of activity',
  `faculty_id` bigint unsigned NOT NULL COMMENT 'Faculty that owns and manages this activity',
  `code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Optional internal activity code or number',
  `name_th` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Activity name in Thai',
  `name_en` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Activity name in English',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT 'Detailed description of the activity',
  `category` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Activity category (e.g. volunteer, academic, sport)',
  `type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Activity type or classification',
  `created_by` bigint unsigned DEFAULT NULL COMMENT 'User ID of staff who created the activity',
  `status` enum('draft','published','closed','cancelled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft' COMMENT 'Activity lifecycle status',
  `visibility_scope` enum('faculty_only','university_wide') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'faculty_only' COMMENT 'Visibility scope of the activity',
  `registration_required` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'Whether participants must register before joining',
  `published_at` datetime DEFAULT NULL COMMENT 'Datetime when activity is published',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Record last update timestamp',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete timestamp',
  PRIMARY KEY (`activity_id`),
  KEY `idx_activities_faculty` (`faculty_id`),
  KEY `idx_activities_status` (`status`),
  KEY `idx_activities_deleted_at` (`deleted_at`),
  CONSTRAINT `fk_activities_faculty` FOREIGN KEY (`faculty_id`) REFERENCES `org_faculties` (`faculty_id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Faculty-level activities (parent entity)';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `act_activities`
--

LOCK TABLES `act_activities` WRITE;
/*!40000 ALTER TABLE `act_activities` DISABLE KEYS */;
INSERT INTO `act_activities` VALUES (1,1,'TST-AI-WS','อบรมเชิงปฏิบัติการ AI','AI Workshop','กิจกรรมทดสอบ: เวิร์กช็อป AI','academic','workshop',3,'published','faculty_only',1,'2026-02-05 18:11:50','2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(2,1,'TST-VOL-01','อาสาพัฒนาชุมชน','Community Volunteer','กิจกรรมทดสอบ: จิตอาสา','volunteer','field',3,'published','faculty_only',1,'2026-02-05 18:11:50','2026-02-05 18:11:50','2026-02-05 18:11:50',NULL);
/*!40000 ALTER TABLE `act_activities` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `act_faculty_policies`
--

DROP TABLE IF EXISTS `act_faculty_policies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `act_faculty_policies` (
  `faculty_policy_id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'Primary key of faculty activity policy',
  `faculty_id` bigint unsigned NOT NULL COMMENT 'Faculty that owns this default policy',
  `default_timezone` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Asia/Bangkok' COMMENT 'Default timezone used when creating new sessions',
  `default_registration_required` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'Default registration_required for new sessions',
  `default_grading_mode` enum('attendance_only','manual_score','submission','exam','hybrid') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'attendance_only' COMMENT 'Default grading_mode for new sessions',
  `default_max_raw_score` decimal(6,2) NOT NULL DEFAULT '100.00' COMMENT 'Default maximum raw score for new sessions',
  `default_pass_threshold` decimal(6,2) DEFAULT NULL COMMENT 'Default pass threshold for new sessions (optional)',
  `default_late_grace_minutes` int unsigned NOT NULL DEFAULT '0' COMMENT 'Default grace period in minutes before marking as late',
  `default_late_penalty_factor` decimal(5,4) NOT NULL DEFAULT '1.0000' COMMENT 'Default multiplier applied when late (e.g. 0.8000 means 80%)',
  `default_require_checkout` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'Default flag: require checkout for attendance to be considered valid',
  `default_min_attendance_minutes` int unsigned DEFAULT NULL COMMENT 'Default minimum attendance duration in minutes to be eligible (optional)',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'Whether this policy is active',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Record last update timestamp',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete timestamp',
  PRIMARY KEY (`faculty_policy_id`),
  UNIQUE KEY `uq_faculty_policy` (`faculty_id`),
  KEY `idx_fap_faculty` (`faculty_id`),
  KEY `idx_fap_deleted_at` (`deleted_at`),
  CONSTRAINT `fk_fap_faculty` FOREIGN KEY (`faculty_id`) REFERENCES `org_faculties` (`faculty_id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Default session settings per faculty to reduce repeated data entry';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `act_faculty_policies`
--

LOCK TABLES `act_faculty_policies` WRITE;
/*!40000 ALTER TABLE `act_faculty_policies` DISABLE KEYS */;
INSERT INTO `act_faculty_policies` VALUES (1,1,'Asia/Bangkok',1,'hybrid',100.00,60.00,15,0.9000,1,150,1,'2026-02-05 18:11:50','2026-02-05 18:11:50',NULL);
/*!40000 ALTER TABLE `act_faculty_policies` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `act_session_assignments`
--

DROP TABLE IF EXISTS `act_session_assignments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `act_session_assignments` (
  `session_assignment_id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'Primary key of session assignment',
  `session_id` bigint unsigned NOT NULL COMMENT 'FK to act_sessions',
  `user_id` bigint unsigned NOT NULL COMMENT 'FK to auth_users (assigned staff/lecturer)',
  `assignment_role` enum('lecturer','officer','assistant','supervisor') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Role of the assignee for this session',
  `can_record_attendance` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'If 1, user can record/edit attendance for this session',
  `can_grade` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'If 1, user can create/update competency scores for this session',
  `can_finalize` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'If 1, user can finalize this session',
  `note` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Optional note about assignment',
  `created_by` bigint unsigned DEFAULT NULL COMMENT 'User ID who created this assignment (optional)',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Record last update timestamp',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete timestamp',
  PRIMARY KEY (`session_assignment_id`),
  UNIQUE KEY `uq_session_user_assignment_role` (`session_id`,`user_id`,`assignment_role`),
  KEY `idx_asa_session` (`session_id`),
  KEY `idx_asa_user` (`user_id`),
  KEY `idx_asa_deleted_at` (`deleted_at`),
  CONSTRAINT `fk_asa_session` FOREIGN KEY (`session_id`) REFERENCES `act_sessions` (`session_id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_asa_user` FOREIGN KEY (`user_id`) REFERENCES `auth_users` (`user_id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Assign lecturers/officers to a session and define their permissions';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `act_session_assignments`
--

LOCK TABLES `act_session_assignments` WRITE;
/*!40000 ALTER TABLE `act_session_assignments` DISABLE KEYS */;
INSERT INTO `act_session_assignments` VALUES (1,1,2,'lecturer',0,1,1,'ผู้สอน/ผู้ประเมิน',3,'2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(2,1,3,'officer',1,0,0,'เจ้าหน้าที่บันทึกเวลา',3,'2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(3,2,3,'supervisor',1,0,1,'หัวหน้ากิจกรรม/ปิดงาน',3,'2026-02-05 18:11:50','2026-02-05 18:11:50',NULL);
/*!40000 ALTER TABLE `act_session_assignments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `act_session_competencies`
--

DROP TABLE IF EXISTS `act_session_competencies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `act_session_competencies` (
  `session_competency_id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'Primary key of session-competency mapping',
  `session_id` bigint unsigned NOT NULL COMMENT 'Activity session that grants competency',
  `competency_id` bigint unsigned NOT NULL COMMENT 'Competency granted by this session',
  `max_percent` decimal(6,2) NOT NULL COMMENT 'Maximum percent contribution to this competency from this session (e.g. 5.00)',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Record last update timestamp',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete timestamp',
  PRIMARY KEY (`session_competency_id`),
  UNIQUE KEY `uq_session_competency` (`session_id`,`competency_id`),
  KEY `idx_sc_session` (`session_id`),
  KEY `idx_sc_competency` (`competency_id`),
  KEY `idx_sc_deleted_at` (`deleted_at`),
  CONSTRAINT `fk_sc_competency` FOREIGN KEY (`competency_id`) REFERENCES `comp_competencies` (`competency_id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_sc_session` FOREIGN KEY (`session_id`) REFERENCES `act_sessions` (`session_id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Defines which competencies a session awards and the max percent for each';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `act_session_competencies`
--

LOCK TABLES `act_session_competencies` WRITE;
/*!40000 ALTER TABLE `act_session_competencies` DISABLE KEYS */;
INSERT INTO `act_session_competencies` VALUES (1,1,1,30.00,'2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(2,1,2,40.00,'2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(3,1,3,30.00,'2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(4,2,5,50.00,'2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(5,2,3,50.00,'2026-02-05 18:11:50','2026-02-05 18:11:50',NULL);
/*!40000 ALTER TABLE `act_session_competencies` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `act_session_registrations`
--

DROP TABLE IF EXISTS `act_session_registrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `act_session_registrations` (
  `session_registration_id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'Primary key of session registration',
  `session_id` bigint unsigned NOT NULL COMMENT 'FK to act_sessions',
  `person_id` bigint unsigned NOT NULL COMMENT 'FK to persons',
  `status` enum('pending','approved','waitlisted','rejected','cancelled','checked_in','no_show') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending' COMMENT 'Registration status',
  `registered_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Datetime when student registered',
  `approved_by` bigint unsigned DEFAULT NULL COMMENT 'User ID who approvedrejected (optional)',
  `approved_at` datetime DEFAULT NULL COMMENT 'Datetime when approvedrejected',
  `cancel_reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Reason for cancellation (optional)',
  `note` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Optional note',
  `source` enum('student','officer','lecturer','system') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'student' COMMENT 'Who created the registration',
  `created_by` bigint unsigned DEFAULT NULL COMMENT 'User ID who created the registration (optional)',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Record last update timestamp',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete timestamp',
  PRIMARY KEY (`session_registration_id`),
  UNIQUE KEY `uq_asr_session_student` (`session_id`,`person_id`),
  KEY `idx_asr_session` (`session_id`),
  KEY `idx_asr_student` (`person_id`),
  KEY `idx_asr_status` (`status`),
  KEY `idx_asr_deleted_at` (`deleted_at`),
  CONSTRAINT `fk_asr_person` FOREIGN KEY (`person_id`) REFERENCES `persons` (`person_id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_asr_session` FOREIGN KEY (`session_id`) REFERENCES `act_sessions` (`session_id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Student registrations per session (supports required registration and walk-in)';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `act_session_registrations`
--

LOCK TABLES `act_session_registrations` WRITE;
/*!40000 ALTER TABLE `act_session_registrations` DISABLE KEYS */;
INSERT INTO `act_session_registrations` VALUES (1,1,1,'approved','2026-02-05 18:11:50',3,'2026-02-05 18:11:50',NULL,'ลงทะเบียนและอนุมัติ','student',3,'2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(2,1,2,'approved','2026-02-05 18:11:50',3,'2026-02-05 18:11:50',NULL,'ลงทะเบียนและอนุมัติ','student',3,'2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(3,1,3,'pending','2026-02-05 18:11:50',NULL,NULL,NULL,'รออนุมัติ','student',3,'2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(4,2,1,'approved','2026-02-05 18:11:50',3,'2026-02-05 18:11:50',NULL,'อาสา','student',3,'2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(5,2,2,'approved','2026-02-05 18:11:50',3,'2026-02-05 18:11:50',NULL,'อาสา','student',3,'2026-02-05 18:11:50','2026-02-05 18:11:50',NULL);
/*!40000 ALTER TABLE `act_session_registrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `act_sessions`
--

DROP TABLE IF EXISTS `act_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `act_sessions` (
  `session_id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'Primary key of activity session',
  `activity_id` bigint unsigned NOT NULL COMMENT 'Parent activity',
  `session_no` int unsigned NOT NULL COMMENT 'Session sequence number (1,2,3...)',
  `start_at` datetime NOT NULL COMMENT 'Session start datetime',
  `end_at` datetime NOT NULL COMMENT 'Session end datetime',
  `timezone` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Asia/Bangkok' COMMENT 'Timezone of the session',
  `location_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Location name (building / room / venue)',
  `location_detail` text COLLATE utf8mb4_unicode_ci COMMENT 'Additional location detail or description',
  `latitude` decimal(10,7) DEFAULT NULL COMMENT 'Latitude for map integration',
  `longitude` decimal(10,7) DEFAULT NULL COMMENT 'Longitude for map integration',
  `capacity` int unsigned DEFAULT NULL COMMENT 'Maximum number of participants',
  `registration_required` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'Whether this session requires registration',
  `grading_mode` enum('attendance_only','manual_score','submission','exam','hybrid') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'attendance_only' COMMENT 'Grading mode for this session',
  `max_raw_score` decimal(6,2) NOT NULL DEFAULT '100.00' COMMENT 'Maximum raw score for grading',
  `pass_threshold` decimal(6,2) DEFAULT NULL COMMENT 'Minimum raw score required to pass (optional)',
  `late_grace_minutes` int unsigned NOT NULL DEFAULT '0' COMMENT 'Grace period in minutes before marking as late',
  `late_penalty_factor` decimal(5,4) NOT NULL DEFAULT '1.0000' COMMENT 'Multiplier applied when late (e.g. 0.8000 means 80%)',
  `require_checkout` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'Require checkout for attendance to be considered valid',
  `min_attendance_minutes` int unsigned DEFAULT NULL COMMENT 'Minimum attendance duration (minutes) to be eligible (optional)',
  `status` enum('scheduled','completed','cancelled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'scheduled' COMMENT 'Session status',
  `is_finalized` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'Whether this session is finalized (locked for edits)',
  `finalized_at` datetime DEFAULT NULL COMMENT 'Datetime when session was finalized',
  `finalized_by` bigint unsigned DEFAULT NULL COMMENT 'User ID who finalized the session',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Record last update timestamp',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete timestamp',
  PRIMARY KEY (`session_id`),
  UNIQUE KEY `uq_activity_session_no` (`activity_id`,`session_no`),
  KEY `idx_sessions_activity` (`activity_id`),
  KEY `idx_sessions_status` (`status`),
  KEY `idx_sessions_deleted_at` (`deleted_at`),
  KEY `idx_sessions_finalized` (`is_finalized`),
  KEY `idx_sessions_finalized_at` (`finalized_at`),
  CONSTRAINT `fk_sessions_activity` FOREIGN KEY (`activity_id`) REFERENCES `act_activities` (`activity_id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Actual scheduled sessions of activities';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `act_sessions`
--

LOCK TABLES `act_sessions` WRITE;
/*!40000 ALTER TABLE `act_sessions` DISABLE KEYS */;
INSERT INTO `act_sessions` VALUES (1,1,1,'2026-02-10 09:00:00','2026-02-10 12:00:00','Asia/Bangkok','อาคารเรียนรวม','ห้อง 1401',16.4740000,102.8230000,50,1,'hybrid',100.00,60.00,15,0.9000,1,150,'completed',1,'2026-02-10 12:30:00',2,'2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(2,2,1,'2026-02-15 08:30:00','2026-02-15 16:30:00','Asia/Bangkok','ศูนย์ชุมชน','พื้นที่กิจกรรมกลางแจ้ง',16.4700000,102.8200000,80,1,'attendance_only',100.00,0.00,10,1.0000,1,360,'completed',1,'2026-02-15 17:00:00',3,'2026-02-05 18:11:50','2026-02-05 18:11:50',NULL);
/*!40000 ALTER TABLE `act_sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `att_session_attendances`
--

DROP TABLE IF EXISTS `att_session_attendances`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `att_session_attendances` (
  `session_attendance_id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'Primary key of session attendance',
  `session_id` bigint unsigned NOT NULL COMMENT 'Activity session attended',
  `person_id` bigint unsigned NOT NULL COMMENT 'Person who attends the session',
  `status` enum('present','late','absent','excused') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'absent' COMMENT 'Attendance status',
  `checkin_at` datetime DEFAULT NULL COMMENT 'Check-in timestamp',
  `checkout_at` datetime DEFAULT NULL COMMENT 'Check-out timestamp (optional)',
  `checkin_method` enum('qr','manual','system','other') COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'How check-in was recorded',
  `checkout_method` enum('qr','manual','system','other') COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'How check-out was recorded (optional)',
  `notes` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Optional notes about attendance',
  `recorded_by` bigint unsigned DEFAULT NULL COMMENT 'User ID who recorded/edited the attendance (staff/lecturer)',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Record last update timestamp',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete timestamp',
  PRIMARY KEY (`session_attendance_id`),
  UNIQUE KEY `uq_session_student` (`session_id`,`person_id`),
  KEY `idx_sa_session` (`session_id`),
  KEY `idx_sa_student` (`person_id`),
  KEY `idx_sa_status` (`status`),
  KEY `idx_sa_deleted_at` (`deleted_at`),
  CONSTRAINT `fk_att_person` FOREIGN KEY (`person_id`) REFERENCES `persons` (`person_id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_sa_session` FOREIGN KEY (`session_id`) REFERENCES `act_sessions` (`session_id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Attendance per student per session, including optional check-in/out';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `att_session_attendances`
--

LOCK TABLES `att_session_attendances` WRITE;
/*!40000 ALTER TABLE `att_session_attendances` DISABLE KEYS */;
INSERT INTO `att_session_attendances` VALUES (1,1,1,'present','2026-02-10 09:02:00','2026-02-10 12:01:00','qr','qr','มาตรงเวลา',3,'2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(2,1,2,'late','2026-02-10 09:20:00','2026-02-10 12:00:00','qr','qr','มาสาย',3,'2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(3,1,3,'absent',NULL,NULL,NULL,NULL,'ไม่มา',3,'2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(4,2,1,'present','2026-02-15 08:35:00','2026-02-15 16:35:00','qr','qr','เข้าร่วมครบ',3,'2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(5,2,2,'present','2026-02-15 08:40:00','2026-02-15 16:20:00','qr','qr','เข้าร่วมครบ',3,'2026-02-05 18:11:50','2026-02-05 18:11:50',NULL);
/*!40000 ALTER TABLE `att_session_attendances` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `auth_roles`
--

DROP TABLE IF EXISTS `auth_roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `auth_roles` (
  `role_id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'Primary key of role',
  `code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Role code (admin, student, lecturer, officer, dean)',
  `name_th` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Role name in Thai',
  `name_en` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Role name in English',
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Role description',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Record last update timestamp',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete timestamp',
  PRIMARY KEY (`role_id`),
  UNIQUE KEY `uq_auth_roles_code` (`code`),
  KEY `idx_auth_roles_deleted_at` (`deleted_at`)
) ENGINE=InnoDB AUTO_INCREMENT=100 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Roles master table';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auth_roles`
--

LOCK TABLES `auth_roles` WRITE;
/*!40000 ALTER TABLE `auth_roles` DISABLE KEYS */;
INSERT INTO `auth_roles` VALUES (1,'learner','นักศึกษา','Student','Learner / student user','2026-01-26 13:33:04','2026-02-05 03:00:37',NULL),(2,'lecturer','อาจารย์','Lecturer','Lecturer / assessor','2026-01-26 13:33:04','2026-02-05 03:00:41',NULL),(3,'officer','เจ้าหน้าที่พัฒนานักศึกษา','Student Development Officer','Faculty officer who manages activities','2026-01-26 13:33:04','2026-02-05 03:00:44',NULL),(4,'dean','คณบดี','Dean','Faculty dean view/report','2026-01-26 13:33:04','2026-02-05 03:00:46',NULL),(5,'admin','ผู้ดูแลระบบ','Admin','System administrator','2026-01-26 13:33:04','2026-02-05 03:00:47',NULL);
/*!40000 ALTER TABLE `auth_roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `auth_user_roles`
--

DROP TABLE IF EXISTS `auth_user_roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `auth_user_roles` (
  `user_role_id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'Primary key of user-role mapping',
  `user_id` bigint unsigned NOT NULL COMMENT 'FK to auth_users',
  `role_id` bigint unsigned NOT NULL COMMENT 'FK to auth_roles',
  `scope_faculty_id` bigint unsigned DEFAULT NULL COMMENT 'Optional scope for this role (e.g., officer of faculty X)',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Record last update timestamp',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete timestamp',
  PRIMARY KEY (`user_role_id`),
  UNIQUE KEY `uq_auth_user_roles` (`user_id`,`role_id`,`scope_faculty_id`),
  KEY `idx_aur_user` (`user_id`),
  KEY `idx_aur_role` (`role_id`),
  KEY `idx_aur_deleted_at` (`deleted_at`),
  KEY `fk_aur_scope_faculty` (`scope_faculty_id`),
  CONSTRAINT `fk_aur_role` FOREIGN KEY (`role_id`) REFERENCES `auth_roles` (`role_id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_aur_scope_faculty` FOREIGN KEY (`scope_faculty_id`) REFERENCES `org_faculties` (`faculty_id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_aur_user` FOREIGN KEY (`user_id`) REFERENCES `auth_users` (`user_id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=558 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Mapping of users to roles with optional faculty scope';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auth_user_roles`
--

LOCK TABLES `auth_user_roles` WRITE;
/*!40000 ALTER TABLE `auth_user_roles` DISABLE KEYS */;
INSERT INTO `auth_user_roles` VALUES (1,1,1,NULL,'2026-02-05 02:59:07','2026-02-05 03:02:11',NULL),(2,2,2,NULL,'2026-02-05 02:59:07','2026-02-05 03:02:12',NULL),(3,3,3,NULL,'2026-02-05 02:59:07','2026-02-05 03:02:13',NULL),(4,4,4,NULL,'2026-02-05 02:59:07','2026-02-05 03:02:15',NULL),(5,5,5,NULL,'2026-02-05 02:59:07','2026-02-05 03:02:14',NULL),(557,52324,3,NULL,'2026-06-17 14:28:37','2026-06-17 14:28:37',NULL);
/*!40000 ALTER TABLE `auth_user_roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `auth_users`
--

DROP TABLE IF EXISTS `auth_users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `auth_users` (
  `user_id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'Primary key of user',
  `username` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Login username (could be student code or staff account)',
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Email (optional)',
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Password hash (NULL if using SSO)',
  `auth_provider` enum('local','sso','ldap','oauth') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'local' COMMENT 'Authentication provider',
  `display_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Display name shown in UI',
  `user_type` enum('student','staff','mixed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'staff' COMMENT 'High-level user type',
  `faculty_id` bigint unsigned DEFAULT NULL COMMENT 'Faculty scope for staff/officer (activity visibility); NULL for global/admin',
  `person_id` bigint unsigned DEFAULT NULL COMMENT 'FK to persons (nullable; link login user to person identity)',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'Active flag',
  `last_login_at` datetime DEFAULT NULL COMMENT 'Last login datetime',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Record last update timestamp',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete timestamp',
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `uq_auth_users_username` (`username`),
  UNIQUE KEY `uq_auth_users_email` (`email`),
  KEY `idx_auth_users_faculty` (`faculty_id`),
  KEY `idx_auth_users_deleted_at` (`deleted_at`),
  KEY `idx_auth_users_person` (`person_id`),
  CONSTRAINT `fk_auth_users_faculty` FOREIGN KEY (`faculty_id`) REFERENCES `org_faculties` (`faculty_id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_auth_users_person` FOREIGN KEY (`person_id`) REFERENCES `persons` (`person_id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=52326 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='System users for authentication and auditing';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auth_users`
--

LOCK TABLES `auth_users` WRITE;
/*!40000 ALTER TABLE `auth_users` DISABLE KEYS */;
INSERT INTO `auth_users` VALUES (1,'learner01','learner@dev.local','$2b$12$5rwKoXDzsWW4BN1ujsGRzO5dLCpJ7k8tZi2OvBECY1zu83Cw8NzQq','local','Dev Learner','student',1,NULL,1,NULL,'2026-02-05 02:36:00','2026-02-05 03:01:32',NULL),(2,'lecturer01','lecturer@dev.local','$2b$12$maIvSL3inQHbq0O/5m6PRe4vdVcIXmqRt0yY3PxRC8A.zLs4td/1C','local','Dev Lecturer','staff',1,NULL,1,NULL,'2026-02-05 02:36:00','2026-02-05 03:01:35',NULL),(3,'officer01','officer@dev.local','$2b$12$GLJkNOHitkqPgbfnpkzcuuX08sXf4FcbmyjV7FMWzntyULzWUhjLa','local','Dev Officer','staff',1,NULL,1,NULL,'2026-02-05 02:36:00','2026-02-05 03:01:37',NULL),(4,'dean01','dean@dev.local','$2b$12$KK/FpIralbn6/IKSOm4cb.Ugi/2zxjRKIVTKSMKLOvc1F09F30Ova','local','Dev Dean','staff',1,NULL,1,NULL,'2026-02-05 02:36:00','2026-02-05 03:01:38',NULL),(5,'admin01','admin@dev.local','$2b$12$Aoq.oi5.zXX.SjICdyjBGO6ZkbvT4F4s7b8mXkcZJKTL3Nr91y8Iy','local','Dev Admin','staff',NULL,NULL,1,NULL,'2026-02-05 02:36:00','2026-02-05 03:01:28',NULL),(52324,'officer02','officer02@dev.local','$2a$12$zkfU0HzKHlWYg4GL3UBkWeXgoLh/pFFRHTBzonsk1l/43sCPUO6ky','local','Dev Officer 02','staff',1,NULL,1,NULL,'2026-06-17 14:24:12','2026-06-17 14:41:07',NULL);
/*!40000 ALTER TABLE `auth_users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `comp_competencies`
--

DROP TABLE IF EXISTS `comp_competencies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `comp_competencies` (
  `competency_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name_th` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name_en` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`competency_id`),
  UNIQUE KEY `uq_competencies_code` (`code`),
  KEY `idx_competencies_deleted_at` (`deleted_at`),
  KEY `idx_competencies_active` (`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `comp_competencies`
--

LOCK TABLES `comp_competencies` WRITE;
/*!40000 ALTER TABLE `comp_competencies` DISABLE KEYS */;
INSERT INTO `comp_competencies` VALUES (1,'tst_comm','การสื่อสาร','Communication','ทักษะการสื่อสารและการนำเสนอ',1,'2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(2,'tst_ct','คิดเชิงวิพากษ์','Critical Thinking','วิเคราะห์ แก้ปัญหา ตัดสินใจ',1,'2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(3,'tst_team','ทำงานเป็นทีม','Teamwork','ทำงานร่วมกับผู้อื่นได้',1,'2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(4,'tst_lead','ภาวะผู้นำ','Leadership','ริเริ่ม นำทีม รับผิดชอบ',1,'2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(5,'tst_ethic','คุณธรรมจริยธรรม','Ethics','จริยธรรมและความรับผิดชอบ',1,'2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(6,'tst_digi','ทักษะดิจิทัล','Digital Literacy','ใช้เครื่องมือดิจิทัลอย่างเหมาะสม',1,'2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(7,'tst_csk','ความรุู้ด้านคอมพิวเตอร์','Computer Science knowledge','ความรู้และการประยุกต์ใช้วิทยาการคอมพิวเตอร์',1,'2026-02-26 10:37:46','2026-02-26 10:37:46',NULL),(8,'tst_sd','การพัฒนาระบบ','System Development','การออกแบบและพัฒนาระบบคอมพิวเตอร์',1,'2026-02-26 10:37:46','2026-02-26 10:37:46',NULL),(9,'tst_ll','การเรียนรู้สิ่งใหม่','Lifelong Learning','การเรียนรู้สิ่งใหม่ทางด้านวิทยาการคอมพิวเตอร์ และการต่อยอดองค์ความรู้',1,'2026-02-26 10:37:46','2026-02-26 10:37:46',NULL);
/*!40000 ALTER TABLE `comp_competencies` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `comp_curriculum_requirements`
--

DROP TABLE IF EXISTS `comp_curriculum_requirements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `comp_curriculum_requirements` (
  `curriculum_requirement_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `curriculum_id` bigint unsigned NOT NULL,
  `cohort_year_be` smallint unsigned NOT NULL COMMENT 'รหัสนักศึกษาปีเข้า (เป้าหมายอาจเปลี่ยนตามปีเข้า)',
  `competency_id` bigint unsigned NOT NULL,
  `target_percent` decimal(6,2) NOT NULL DEFAULT '100.00',
  `is_required` tinyint(1) NOT NULL DEFAULT '1',
  `display_order` int unsigned NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`curriculum_requirement_id`),
  UNIQUE KEY `uq_comp_req_curri_cohort_comp` (`curriculum_id`,`cohort_year_be`,`competency_id`),
  KEY `fk_ccr_competency` (`competency_id`),
  CONSTRAINT `fk_ccr_competency` FOREIGN KEY (`competency_id`) REFERENCES `comp_competencies` (`competency_id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_ccr_curriculum` FOREIGN KEY (`curriculum_id`) REFERENCES `edu_curricula` (`curriculum_id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='เป้าหมายระดับหลักสูตร (แยกตามปีเข้า)';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `comp_curriculum_requirements`
--

LOCK TABLES `comp_curriculum_requirements` WRITE;
/*!40000 ALTER TABLE `comp_curriculum_requirements` DISABLE KEYS */;
/*!40000 ALTER TABLE `comp_curriculum_requirements` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `comp_template_items`
--

DROP TABLE IF EXISTS `comp_template_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `comp_template_items` (
  `template_item_id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'Primary key of competency template item',
  `template_id` bigint unsigned NOT NULL COMMENT 'FK to comp_templates',
  `course_id` bigint unsigned DEFAULT NULL,
  `competency_id` bigint unsigned NOT NULL COMMENT 'FK to comp_competencies',
  `weight` decimal(6,2) DEFAULT NULL,
  `display_order` int unsigned NOT NULL DEFAULT '0' COMMENT 'Order in UI',
  `default_target_percent` decimal(6,2) DEFAULT NULL COMMENT 'Optional default target percent when generating curriculum requirements (e.g., 100.00)',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'Active flag (hide item without deleting)',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Record last update timestamp',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete timestamp',
  PRIMARY KEY (`template_item_id`),
  UNIQUE KEY `uq_cti_template_competency` (`template_id`,`competency_id`),
  KEY `idx_cti_template` (`template_id`),
  KEY `idx_cti_competency` (`competency_id`),
  KEY `idx_cti_deleted_at` (`deleted_at`),
  KEY `fk_cti_course_id` (`course_id`),
  CONSTRAINT `fk_cti_competency` FOREIGN KEY (`competency_id`) REFERENCES `comp_competencies` (`competency_id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_cti_course_id` FOREIGN KEY (`course_id`) REFERENCES `crs_courses` (`course_id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_cti_template` FOREIGN KEY (`template_id`) REFERENCES `comp_templates` (`template_id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Competency items inside a named template';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `comp_template_items`
--

LOCK TABLES `comp_template_items` WRITE;
/*!40000 ALTER TABLE `comp_template_items` DISABLE KEYS */;
INSERT INTO `comp_template_items` VALUES (1,1,NULL,1,NULL,1,15.00,1,'2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(2,1,NULL,2,NULL,2,20.00,1,'2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(3,1,NULL,3,NULL,3,15.00,1,'2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(4,1,NULL,6,NULL,4,25.00,1,'2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(5,1,NULL,5,NULL,5,15.00,1,'2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(6,1,NULL,4,NULL,6,10.00,1,'2026-02-05 18:11:50','2026-02-05 18:11:50',NULL);
/*!40000 ALTER TABLE `comp_template_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `comp_templates`
--

DROP TABLE IF EXISTS `comp_templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `comp_templates` (
  `template_id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'Primary key of competency template',
  `faculty_id` bigint unsigned NOT NULL COMMENT 'Owner faculty of this template',
  `code` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Unique code e.g., tpl_comp_comsci_2568',
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Display name e.g., ComSci Competency Template (2568)',
  `description` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Optional description / notes',
  `version_year_be` smallint unsigned DEFAULT NULL COMMENT 'B.E. year (พ.ศ.) for this template (e.g., 2568)',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'Active flag',
  `created_by` bigint unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Record last update timestamp',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete timestamp',
  PRIMARY KEY (`template_id`),
  UNIQUE KEY `uq_comp_templates_faculty_code` (`faculty_id`,`code`),
  KEY `idx_comp_templates_faculty` (`faculty_id`),
  KEY `idx_comp_templates_deleted_at` (`deleted_at`),
  KEY `fk_comp_tpl_created_by` (`created_by`),
  CONSTRAINT `fk_comp_templates_faculty` FOREIGN KEY (`faculty_id`) REFERENCES `org_faculties` (`faculty_id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_comp_tpl_created_by` FOREIGN KEY (`created_by`) REFERENCES `auth_users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Named competency templates per faculty (used to initialize new curricula)';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `comp_templates`
--

LOCK TABLES `comp_templates` WRITE;
/*!40000 ALTER TABLE `comp_templates` DISABLE KEYS */;
INSERT INTO `comp_templates` VALUES (1,1,'tst_tpl_2568','Template สมรรถนะ (ทดสอบ)','Template สำหรับทดสอบระบบ',2568,1,NULL,'2026-02-05 18:11:50','2026-02-05 18:11:50',NULL);
/*!40000 ALTER TABLE `comp_templates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `crs_course_categories`
--

DROP TABLE IF EXISTS `crs_course_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `crs_course_categories` (
  `category_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `curriculum_id` bigint unsigned NOT NULL,
  `parent_id` bigint unsigned DEFAULT NULL,
  `code` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name_th` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name_en` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `required_credits` int NOT NULL DEFAULT '0',
  `display_order` int NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`category_id`),
  KEY `fk_ccc_curriculum` (`curriculum_id`),
  KEY `fk_ccc_parent` (`parent_id`),
  CONSTRAINT `fk_ccc_curriculum` FOREIGN KEY (`curriculum_id`) REFERENCES `edu_curricula` (`curriculum_id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_ccc_parent` FOREIGN KEY (`parent_id`) REFERENCES `crs_course_categories` (`category_id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `crs_course_categories`
--

LOCK TABLES `crs_course_categories` WRITE;
/*!40000 ALTER TABLE `crs_course_categories` DISABLE KEYS */;
INSERT INTO `crs_course_categories` VALUES (1,11,NULL,'1','หมวดวิชาศึกษาทั่วไป',NULL,0,1,1,'2026-06-23 15:01:32','2026-06-25 16:12:14',NULL),(2,11,NULL,'2','หมวดวิชาใหม่',NULL,0,2,0,'2026-06-24 16:35:31','2026-06-24 16:35:37','2026-06-24 16:35:37'),(3,11,1,'1.1','กลุ่มวิชาภาษา',NULL,0,1,1,'2026-06-24 17:00:40','2026-06-25 16:12:19',NULL),(4,11,1,'1.2','กลุ่มวิชามนุษยศาสตร์และสังคมศาสตร์',NULL,0,2,1,'2026-06-24 17:00:42','2026-06-25 16:12:50',NULL),(5,11,NULL,'2','หมวดวิชาเฉพาะ',NULL,0,2,1,'2026-06-24 17:00:45','2026-06-25 16:13:12',NULL),(6,11,5,'2.1','หมวดวิชาพื้นฐานหรือวิชาแกน',NULL,0,1,1,'2026-06-25 16:13:18','2026-06-25 16:13:20',NULL),(7,11,6,'2.1.1','กลุ่มวิชาบังคับพื้นฐานวิชาชีพ',NULL,0,1,1,'2026-06-25 16:13:26','2026-06-25 16:13:28',NULL),(8,11,7,'2.1.1.1','หมวดวิชาใหม่',NULL,0,1,0,'2026-06-25 16:13:33','2026-06-25 16:13:36','2026-06-25 16:13:36'),(9,11,7,'2.1.1.1','หมวดวิชาใหม่',NULL,0,1,0,'2026-06-25 16:13:38','2026-06-25 16:13:41','2026-06-25 16:13:41'),(10,11,6,'2.1.2','พื้นฐานเทคโนโลยีสารสนเทศ',NULL,0,2,1,'2026-06-25 16:13:42','2026-06-25 16:13:44',NULL),(11,11,5,'2.1.3','หมวดวิชาเฉพาะด้าน',NULL,0,2,0,'2026-06-25 17:09:52','2026-06-25 17:10:18','2026-06-25 17:10:18'),(12,11,5,'2.2','หมวดวิชาเฉพาะด้าน',NULL,0,2,1,'2026-06-25 17:10:19','2026-06-25 17:20:12',NULL),(13,11,12,'2.2.1','กลุ่มวิชาประเด็นด้านองค์กรและระบบสารสนเทศ',NULL,0,1,1,'2026-06-25 17:20:44','2026-06-25 17:20:48',NULL),(14,11,12,'2.2.2','กลุ่มวิชาเทคโนโลยีเพื่องานประยุกต์',NULL,0,2,1,'2026-06-25 17:21:18','2026-06-25 17:21:25',NULL),(15,11,12,'2.2.3','กลุ่มวิชาเทคโนโลยีและวิธีการทางซอฟต์แวร์',NULL,0,3,1,'2026-06-25 17:22:04','2026-06-25 17:22:09',NULL);
/*!40000 ALTER TABLE `crs_course_categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `crs_course_enrollment`
--

DROP TABLE IF EXISTS `crs_course_enrollment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `crs_course_enrollment` (
  `course_student_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `course_id` bigint unsigned NOT NULL,
  `enrollment_id` bigint unsigned NOT NULL COMMENT 'อ้างอิง kku_enrollments',
  `map_id` bigint unsigned DEFAULT NULL COMMENT 'ได้เมื่อเกรดออก',
  `student_curricula_id` bigint unsigned DEFAULT NULL,
  `academic_year_be` smallint unsigned NOT NULL COMMENT 'ปีการศึกษาที่ลงเรียนวิชานี้',
  `semester` tinyint unsigned NOT NULL COMMENT 'เทอมที่ลงเรียนวิชานี้',
  `grade` varchar(5) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_best_grade` tinyint(1) NOT NULL DEFAULT '0',
  `retake_sequence` bigint unsigned DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`course_student_id`),
  KEY `fk_cce_course` (`course_id`),
  KEY `fk_cce_enrollment` (`enrollment_id`),
  KEY `fk_cce_map` (`map_id`),
  KEY `fk_cce_std_curri` (`student_curricula_id`),
  CONSTRAINT `fk_cce_course` FOREIGN KEY (`course_id`) REFERENCES `crs_courses` (`course_id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_cce_enrollment` FOREIGN KEY (`enrollment_id`) REFERENCES `kku_enrollments` (`enrollment_id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_cce_map` FOREIGN KEY (`map_id`) REFERENCES `crs_grade_maps` (`map_id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_cce_std_curri` FOREIGN KEY (`student_curricula_id`) REFERENCES `kku_enrollment_curricula` (`enrollment_curriculum_id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `crs_course_enrollment`
--

LOCK TABLES `crs_course_enrollment` WRITE;
/*!40000 ALTER TABLE `crs_course_enrollment` DISABLE KEYS */;
/*!40000 ALTER TABLE `crs_course_enrollment` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `crs_courses`
--

DROP TABLE IF EXISTS `crs_courses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `crs_courses` (
  `course_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `curriculum_id` bigint unsigned NOT NULL,
  `faculty_id` bigint unsigned NOT NULL,
  `degree_level` enum('bachelor','master','phd','other') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'bachelor',
  `code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name_th` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name_en` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `credits` int NOT NULL DEFAULT '3',
  `description` text COLLATE utf8mb4_unicode_ci,
  `created_by` bigint unsigned DEFAULT NULL,
  `status` enum('draft','published','closed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `live_unique_key` tinyint GENERATED ALWAYS AS ((case when (`deleted_at` is null) then 1 else NULL end)) STORED,
  PRIMARY KEY (`course_id`),
  UNIQUE KEY `uq_crs_courses_curriculum_code_live` (`curriculum_id`,`code`,`live_unique_key`),
  KEY `idx_crs_courses_curriculum` (`curriculum_id`),
  KEY `idx_crs_courses_faculty` (`faculty_id`),
  CONSTRAINT `fk_crs_courses_curriculum` FOREIGN KEY (`curriculum_id`) REFERENCES `edu_curricula` (`curriculum_id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_crs_courses_faculty` FOREIGN KEY (`faculty_id`) REFERENCES `org_faculties` (`faculty_id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `crs_courses`
--

LOCK TABLES `crs_courses` WRITE;
/*!40000 ALTER TABLE `crs_courses` DISABLE KEYS */;
INSERT INTO `crs_courses` (`course_id`, `curriculum_id`, `faculty_id`, `degree_level`, `code`, `name_th`, `name_en`, `credits`, `description`, `created_by`, `status`, `is_active`, `created_at`, `updated_at`, `deleted_at`) VALUES (1,11,1,'bachelor','IT','โปร','Pro',3,NULL,52324,'draft',1,'2026-06-24 16:35:53','2026-06-24 16:35:53',NULL),(2,11,1,'bachelor','LI101001','ภาษาอังกฤษ 1','English I',3,NULL,52324,'draft',1,'2026-06-25 16:35:49','2026-06-25 16:40:19',NULL),(3,11,1,'bachelor','LI101002','ภาษาอังกฤษ 1','English II',3,NULL,52324,'draft',1,'2026-06-25 16:40:42','2026-06-25 16:41:11',NULL),(16,11,1,'bachelor','LI101003','ภาษาอังกฤษ 3','English III',3,NULL,52324,'draft',1,'2026-06-25 16:41:28','2026-06-25 16:41:52',NULL),(17,11,1,'bachelor','LI101004','ภาษาอังกฤษ 4','English IIII',3,NULL,52324,'draft',1,'2026-06-25 16:42:06','2026-06-25 16:42:06',NULL),(18,11,1,'bachelor','GE519742','นวัตกรรมสร้างสรรค์เพื่อเป้าหมายการพัฒนาที่ยั่งยืน','Creative Innovation for Sustainable Development Goals',3,NULL,52324,'draft',1,'2026-06-25 16:51:17','2026-06-25 16:51:17',NULL),(19,11,1,'bachelor','GE519741','ต้นกล้านักธุรกิจ','Business Seedling',3,NULL,52324,'draft',1,'2026-06-25 17:03:43','2026-06-25 17:03:43',NULL),(20,11,1,'bachelor','GE519321','การสื่อสารในยุคเทคโนโลยีดิจิทัล','Digital Technology Communication',3,NULL,52324,'draft',1,'2026-06-25 17:04:06','2026-06-25 17:04:06',NULL),(21,11,1,'bachelor','SC002104','วิทยาศาสตร์กายภาพ','Physical Science',3,NULL,52324,'draft',1,'2026-06-25 17:04:21','2026-06-25 17:04:28',NULL),(22,11,1,'bachelor','SC602001','สถิติขั้นต้น','Introduction to Statistics',3,NULL,52324,'draft',1,'2026-06-25 17:04:48','2026-06-25 17:04:48',NULL),(23,11,1,'bachelor','CP321001','การสร้างพอร์ตอาชีพด้านเทคโนโลยีสารสนเทศและจริยธรรมปัญญาประดิษฐ์','IT Career Portfolio Builder with AI Ethics',3,NULL,52324,'draft',1,'2026-06-25 17:05:08','2026-06-25 17:05:08',NULL),(24,11,1,'bachelor','CP323761','สัมมนาทางเทคโนโลยีสารสนเทศและนวัตกรรมอัจฉริยะ','Seminar in Information Technology and Intelligent Innovation',3,NULL,52324,'draft',1,'2026-06-25 17:21:12','2026-06-25 17:21:12',NULL),(25,11,1,'bachelor','CP321002','การเขียนโปรแกรมเชิงโครงสร้างสำหรับเทคโนโลยีสารสนเทศ','Structured Programming for Information Technology',3,NULL,52324,'draft',1,'2026-06-25 17:21:44','2026-06-25 17:21:44',NULL),(26,11,1,'bachelor','CP322005','การวิเคราะห์และออกแบบฐานข้อมูลสมัยใหม่','Modern Database Analysis and Design',2,NULL,52324,'draft',1,'2026-06-25 17:21:56','2026-06-25 17:21:56',NULL),(27,11,1,'bachelor','CP321003','แนวคิดและการเขียนโปรแกรมเชิงวัตถุ','Object Oriented Concepts and Programming',3,NULL,52324,'draft',1,'2026-06-25 17:22:26','2026-06-25 17:22:26',NULL),(28,11,1,'bachelor','CP322002','ขั้นตอนวิธีและโครงสร้างข้อมูล','Algorithms and Data Structures',3,NULL,52324,'draft',1,'2026-06-25 17:22:38','2026-06-25 17:22:38',NULL);
/*!40000 ALTER TABLE `crs_courses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `crs_curriculum_courses`
--

DROP TABLE IF EXISTS `crs_curriculum_courses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `crs_curriculum_courses` (
  `curriculum_course_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `category_id` bigint unsigned NOT NULL,
  `course_id` bigint unsigned NOT NULL,
  `is_required` tinyint(1) NOT NULL DEFAULT '1',
  `is_locked` tinyint(1) NOT NULL DEFAULT '0',
  `display_order` int NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`curriculum_course_id`),
  UNIQUE KEY `uq_crs_cc_category_course` (`category_id`,`course_id`),
  KEY `fk_crs_cc_course` (`course_id`),
  CONSTRAINT `fk_crs_cc_category` FOREIGN KEY (`category_id`) REFERENCES `crs_course_categories` (`category_id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_crs_cc_course` FOREIGN KEY (`course_id`) REFERENCES `crs_courses` (`course_id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `crs_curriculum_courses`
--

LOCK TABLES `crs_curriculum_courses` WRITE;
/*!40000 ALTER TABLE `crs_curriculum_courses` DISABLE KEYS */;
INSERT INTO `crs_curriculum_courses` VALUES (1,1,1,1,0,1,0,'2026-06-24 16:35:53','2026-06-25 16:12:40','2026-06-25 16:12:40'),(2,3,2,1,0,1,1,'2026-06-25 16:35:49','2026-06-25 16:35:49',NULL),(3,3,3,1,0,2,1,'2026-06-25 16:40:42','2026-06-25 16:40:42',NULL),(4,3,16,1,0,3,1,'2026-06-25 16:41:28','2026-06-25 16:41:28',NULL),(5,3,17,1,0,4,1,'2026-06-25 16:42:06','2026-06-25 16:42:06',NULL),(6,4,18,1,0,3,1,'2026-06-25 16:51:17','2026-06-25 17:05:47',NULL),(7,4,19,1,0,2,1,'2026-06-25 17:03:43','2026-06-25 17:03:43',NULL),(8,4,20,1,0,3,1,'2026-06-25 17:04:06','2026-06-25 17:04:06',NULL),(9,7,21,1,0,1,1,'2026-06-25 17:04:21','2026-06-25 17:04:21',NULL),(10,7,22,1,0,2,1,'2026-06-25 17:04:48','2026-06-25 17:04:48',NULL),(11,10,23,1,0,1,1,'2026-06-25 17:05:08','2026-06-25 17:05:08',NULL),(12,13,24,1,0,1,1,'2026-06-25 17:21:12','2026-06-25 17:21:12',NULL),(13,14,25,1,0,1,1,'2026-06-25 17:21:44','2026-06-25 17:21:44',NULL),(14,14,26,1,0,2,1,'2026-06-25 17:21:56','2026-06-25 17:21:56',NULL),(15,15,27,1,0,1,1,'2026-06-25 17:22:26','2026-06-25 17:22:26',NULL),(16,15,28,1,0,2,1,'2026-06-25 17:22:38','2026-06-25 17:22:38',NULL);
/*!40000 ALTER TABLE `crs_curriculum_courses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `crs_grade_maps`
--

DROP TABLE IF EXISTS `crs_grade_maps`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `crs_grade_maps` (
  `map_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `grade` varchar(5) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '(A,B,C,D,F,S,U,W)',
  `score` int NOT NULL COMMENT 'คะแนนดิบเต็ม 100 เช่น A=100',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`map_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `crs_grade_maps`
--

LOCK TABLES `crs_grade_maps` WRITE;
/*!40000 ALTER TABLE `crs_grade_maps` DISABLE KEYS */;
/*!40000 ALTER TABLE `crs_grade_maps` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `curri_curriculum_templates`
--

DROP TABLE IF EXISTS `curri_curriculum_templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `curri_curriculum_templates` (
  `curriculum_template_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `curriculum_id` bigint unsigned NOT NULL,
  `template_id` bigint unsigned NOT NULL,
  `cohort_year_be` smallint unsigned NOT NULL COMMENT 'รหัสนักศึกษาปีเข้าที่ใช้ Template นี้ (เช่น 2565, 2566)',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`curriculum_template_id`),
  UNIQUE KEY `uq_curri_tpl_cohort` (`curriculum_id`,`cohort_year_be`),
  KEY `fk_cct_template` (`template_id`),
  KEY `fk_cct_created_by` (`created_by`),
  CONSTRAINT `fk_cct_created_by` FOREIGN KEY (`created_by`) REFERENCES `auth_users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_cct_curriculum` FOREIGN KEY (`curriculum_id`) REFERENCES `edu_curricula` (`curriculum_id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_cct_template` FOREIGN KEY (`template_id`) REFERENCES `comp_templates` (`template_id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ผูกหลักสูตร + รหัสปีเข้าเด็ก เข้ากับ Template';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `curri_curriculum_templates`
--

LOCK TABLES `curri_curriculum_templates` WRITE;
/*!40000 ALTER TABLE `curri_curriculum_templates` DISABLE KEYS */;
/*!40000 ALTER TABLE `curri_curriculum_templates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `deliv_deliverable_sessions`
--

DROP TABLE IF EXISTS `deliv_deliverable_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `deliv_deliverable_sessions` (
  `deliverable_session_id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'Primary key of deliverable-to-session mapping',
  `deliverable_id` bigint unsigned NOT NULL COMMENT 'FK to activity_deliverables',
  `session_id` bigint unsigned NOT NULL COMMENT 'FK to activity_sessions where this deliverable is applicable',
  `require_attendance` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'If 1, student must attend this session (or be eligible) before submitting',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Record last update timestamp',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete timestamp',
  PRIMARY KEY (`deliverable_session_id`),
  UNIQUE KEY `uq_ads_deliverable_session` (`deliverable_id`,`session_id`),
  KEY `idx_ads_deliverable` (`deliverable_id`),
  KEY `idx_ads_session` (`session_id`),
  KEY `idx_ads_deleted_at` (`deleted_at`),
  CONSTRAINT `fk_ads_deliverable` FOREIGN KEY (`deliverable_id`) REFERENCES `deliv_deliverables` (`deliverable_id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_ads_session` FOREIGN KEY (`session_id`) REFERENCES `act_sessions` (`session_id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Maps an activity deliverable to one or more sessions (supports multi-day activities)';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `deliv_deliverable_sessions`
--

LOCK TABLES `deliv_deliverable_sessions` WRITE;
/*!40000 ALTER TABLE `deliv_deliverable_sessions` DISABLE KEYS */;
INSERT INTO `deliv_deliverable_sessions` VALUES (1,1,1,1,'2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(2,2,1,1,'2026-02-05 18:11:50','2026-02-05 18:11:50',NULL);
/*!40000 ALTER TABLE `deliv_deliverable_sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `deliv_deliverables`
--

DROP TABLE IF EXISTS `deliv_deliverables`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `deliv_deliverables` (
  `deliverable_id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'Primary key of deliverable (assignment/exam) under an activity',
  `activity_id` bigint unsigned NOT NULL COMMENT 'Parent activity that owns this deliverable',
  `name_th` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Deliverable name in Thai',
  `name_en` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Deliverable name in English',
  `deliverable_type` enum('submission','exam','quiz','presentation','other') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Type of deliverable',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT 'Instructions/description of the deliverable',
  `due_at` datetime DEFAULT NULL COMMENT 'Due datetime for submission (optional)',
  `max_raw_score` decimal(6,2) NOT NULL DEFAULT '100.00' COMMENT 'Maximum raw score for this deliverable',
  `allow_multiple_attempts` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'Whether multiple attempts are allowed',
  `max_attempts` int unsigned DEFAULT NULL COMMENT 'Maximum attempts allowed (NULL means unlimited when allow_multiple_attempts=1)',
  `late_grace_minutes` int unsigned NOT NULL DEFAULT '0' COMMENT 'Grace period in minutes before marking as late',
  `late_penalty_factor` decimal(5,4) NOT NULL DEFAULT '1.0000' COMMENT 'Penalty multiplier when late (e.g. 0.8000 means 80%)',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'Whether this deliverable is active and usable',
  `created_by` bigint unsigned DEFAULT NULL COMMENT 'User ID who created this deliverable',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Record last update timestamp',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete timestamp',
  PRIMARY KEY (`deliverable_id`),
  KEY `idx_ad_activity` (`activity_id`),
  KEY `idx_ad_type` (`deliverable_type`),
  KEY `idx_ad_deleted_at` (`deleted_at`),
  CONSTRAINT `fk_ad_activity` FOREIGN KEY (`activity_id`) REFERENCES `act_activities` (`activity_id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Deliverables (assignments/exams) defined under an activity';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `deliv_deliverables`
--

LOCK TABLES `deliv_deliverables` WRITE;
/*!40000 ALTER TABLE `deliv_deliverables` DISABLE KEYS */;
INSERT INTO `deliv_deliverables` VALUES (1,1,'Reflection: AI Workshop','AI Workshop Reflection','submission','ให้นักศึกษาเขียน reflection หลังจบกิจกรรม','2026-02-12 23:59:00',20.00,1,2,60,0.9000,1,2,'2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(2,1,'AI Quiz','AI Quiz','exam','แบบทดสอบหลังอบรม','2026-02-10 12:15:00',30.00,1,1,0,1.0000,1,2,'2026-02-05 18:11:50','2026-02-05 18:11:50',NULL);
/*!40000 ALTER TABLE `deliv_deliverables` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `deliv_student_exam_attempts`
--

DROP TABLE IF EXISTS `deliv_student_exam_attempts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `deliv_student_exam_attempts` (
  `exam_attempt_id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'Primary key of exam attempt record',
  `deliverable_id` bigint unsigned NOT NULL COMMENT 'FK to activity_deliverables',
  `person_id` bigint unsigned NOT NULL COMMENT 'Person who takes the exam',
  `attempt_no` int unsigned NOT NULL DEFAULT '1' COMMENT 'Attempt number (1,2,3...)',
  `status` enum('scheduled','started','submitted','graded','absent','cancelled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'scheduled' COMMENT 'Exam attempt status lifecycle',
  `started_at` datetime DEFAULT NULL COMMENT 'Datetime when exam started',
  `submitted_at` datetime DEFAULT NULL COMMENT 'Datetime when exam submitted/finished',
  `duration_seconds` int unsigned DEFAULT NULL COMMENT 'Duration in seconds (optional)',
  `raw_score` decimal(6,2) DEFAULT NULL COMMENT 'Raw exam score',
  `max_raw_score_snapshot` decimal(6,2) NOT NULL DEFAULT '100.00' COMMENT 'Snapshot of deliverable max_raw_score at grading time',
  `final_score` decimal(6,2) DEFAULT NULL COMMENT 'Final score (usually equals raw_score unless penalty applies)',
  `graded_by` bigint unsigned DEFAULT NULL COMMENT 'User ID who graded this exam attempt',
  `graded_at` datetime DEFAULT NULL COMMENT 'Datetime when graded',
  `grader_notes` text COLLATE utf8mb4_unicode_ci COMMENT 'Grader notes',
  `external_exam_ref` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'External exam system reference (future integration)',
  `is_locked` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'Lock exam attempt after finalization',
  `locked_at` datetime DEFAULT NULL COMMENT 'Datetime when locked',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Record last update timestamp',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete timestamp',
  PRIMARY KEY (`exam_attempt_id`),
  UNIQUE KEY `uq_sdea_attempt` (`deliverable_id`,`person_id`,`attempt_no`),
  KEY `idx_sdea_deliverable` (`deliverable_id`),
  KEY `idx_sdea_student` (`person_id`),
  KEY `idx_sdea_status` (`status`),
  KEY `idx_sdea_deleted_at` (`deleted_at`),
  CONSTRAINT `fk_deliv_exam_person` FOREIGN KEY (`person_id`) REFERENCES `persons` (`person_id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_sdea_deliverable` FOREIGN KEY (`deliverable_id`) REFERENCES `deliv_deliverables` (`deliverable_id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Exam attempts per activity deliverable (supports multiple attempts)';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `deliv_student_exam_attempts`
--

LOCK TABLES `deliv_student_exam_attempts` WRITE;
/*!40000 ALTER TABLE `deliv_student_exam_attempts` DISABLE KEYS */;
INSERT INTO `deliv_student_exam_attempts` VALUES (1,2,1,1,'graded','2026-02-10 12:05:00','2026-02-10 12:15:00',600,24.00,30.00,24.00,2,'2026-02-10 12:20:00','ผ่าน','TST-EXAM-REF-0001',1,'2026-02-10 12:21:00','2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(2,2,2,1,'graded','2026-02-10 12:05:00','2026-02-10 12:15:00',600,18.00,30.00,18.00,2,'2026-02-10 12:20:00','พอใช้','TST-EXAM-REF-0002',1,'2026-02-10 12:21:00','2026-02-05 18:11:50','2026-02-05 18:11:50',NULL);
/*!40000 ALTER TABLE `deliv_student_exam_attempts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `deliv_student_submission_files`
--

DROP TABLE IF EXISTS `deliv_student_submission_files`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `deliv_student_submission_files` (
  `submission_file_id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'Primary key of submission file record',
  `submission_id` bigint unsigned NOT NULL COMMENT 'FK to student_deliverable_submissions',
  `storage_key` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Storage key/path (server path or object storage key)',
  `original_filename` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Original filename uploaded by student',
  `mime_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'MIME type',
  `file_size_bytes` bigint unsigned DEFAULT NULL COMMENT 'File size in bytes',
  `uploaded_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Datetime when file was uploaded',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete timestamp',
  PRIMARY KEY (`submission_file_id`),
  KEY `idx_sdsf_submission` (`submission_id`),
  KEY `idx_sdsf_deleted_at` (`deleted_at`),
  CONSTRAINT `fk_sdsf_submission` FOREIGN KEY (`submission_id`) REFERENCES `deliv_student_submissions` (`submission_id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Files attached to a student submission (multiple files supported)';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `deliv_student_submission_files`
--

LOCK TABLES `deliv_student_submission_files` WRITE;
/*!40000 ALTER TABLE `deliv_student_submission_files` DISABLE KEYS */;
INSERT INTO `deliv_student_submission_files` VALUES (1,1,'tst/submissions/student1/reflection.txt','reflection.txt','text/plain',2048,'2026-02-05 18:11:50',NULL);
/*!40000 ALTER TABLE `deliv_student_submission_files` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `deliv_student_submissions`
--

DROP TABLE IF EXISTS `deliv_student_submissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `deliv_student_submissions` (
  `submission_id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'Primary key of student submission',
  `deliverable_id` bigint unsigned NOT NULL COMMENT 'FK to activity_deliverables',
  `person_id` bigint unsigned NOT NULL COMMENT 'Person who submits',
  `attempt_no` int unsigned NOT NULL DEFAULT '1' COMMENT 'Attempt number (1,2,3...)',
  `status` enum('draft','submitted','late','missing','graded','rejected') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft' COMMENT 'Submission status lifecycle',
  `submitted_at` datetime DEFAULT NULL COMMENT 'Datetime when submission was submitted',
  `due_at_snapshot` datetime DEFAULT NULL COMMENT 'Snapshot of due datetime at submission time (optional)',
  `late_minutes` int unsigned DEFAULT NULL COMMENT 'Minutes late compared to due_at_snapshot (optional)',
  `submission_text` longtext COLLATE utf8mb4_unicode_ci COMMENT 'Optional text content of submission',
  `submission_url` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Optional URL for submission',
  `raw_score` decimal(6,2) DEFAULT NULL COMMENT 'Raw score for this submission (before penalties)',
  `penalty_factor_snapshot` decimal(5,4) NOT NULL DEFAULT '1.0000' COMMENT 'Snapshot penalty multiplier applied (e.g. late penalty)',
  `final_score` decimal(6,2) DEFAULT NULL COMMENT 'Final score after penalty (raw_score * penalty_factor_snapshot)',
  `max_raw_score_snapshot` decimal(6,2) NOT NULL DEFAULT '100.00' COMMENT 'Snapshot of deliverable max_raw_score at grading time',
  `graded_by` bigint unsigned DEFAULT NULL COMMENT 'User ID who graded this submission',
  `graded_at` datetime DEFAULT NULL COMMENT 'Datetime when graded',
  `grader_notes` text COLLATE utf8mb4_unicode_ci COMMENT 'Grader feedback/notes',
  `is_locked` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'Lock this submission after finalization',
  `locked_at` datetime DEFAULT NULL COMMENT 'Datetime when locked',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Record last update timestamp',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete timestamp',
  PRIMARY KEY (`submission_id`),
  UNIQUE KEY `uq_sds_attempt` (`deliverable_id`,`person_id`,`attempt_no`),
  KEY `idx_sds_deliverable` (`deliverable_id`),
  KEY `idx_sds_student` (`person_id`),
  KEY `idx_sds_status` (`status`),
  KEY `idx_sds_deleted_at` (`deleted_at`),
  CONSTRAINT `fk_deliv_submissions_person` FOREIGN KEY (`person_id`) REFERENCES `persons` (`person_id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_sds_deliverable` FOREIGN KEY (`deliverable_id`) REFERENCES `deliv_deliverables` (`deliverable_id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Student submissions per activity deliverable (supports multiple attempts)';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `deliv_student_submissions`
--

LOCK TABLES `deliv_student_submissions` WRITE;
/*!40000 ALTER TABLE `deliv_student_submissions` DISABLE KEYS */;
INSERT INTO `deliv_student_submissions` VALUES (1,1,1,1,'graded','2026-02-11 20:10:00','2026-02-12 23:59:00',0,'ได้เรียนรู้พื้นฐานและการประยุกต์ใช้ AI',NULL,18.00,1.0000,18.00,20.00,2,'2026-02-12 10:00:00','ทำได้ดี',1,'2026-02-12 10:05:00','2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(2,1,2,1,'graded','2026-02-13 01:10:00','2026-02-12 23:59:00',71,'สรุปความเข้าใจเกี่ยวกับ prompt และ model',NULL,17.00,0.9000,15.30,20.00,2,'2026-02-13 10:00:00','ช้าเล็กน้อย แต่เนื้อหาดี',1,'2026-02-13 10:05:00','2026-02-05 18:11:50','2026-02-05 18:11:50',NULL);
/*!40000 ALTER TABLE `deliv_student_submissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `deliv_templates`
--

DROP TABLE IF EXISTS `deliv_templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `deliv_templates` (
  `deliverable_template_id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'Primary key of deliverable template file',
  `deliverable_id` bigint unsigned NOT NULL COMMENT 'FK to activity_deliverables',
  `storage_key` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Storage key/path of the template file (server path or object storage key)',
  `original_filename` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Original template filename (e.g., template.docx)',
  `mime_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'MIME type of the template file',
  `file_size_bytes` bigint unsigned DEFAULT NULL COMMENT 'Template file size in bytes',
  `uploaded_by` bigint unsigned DEFAULT NULL COMMENT 'User ID who uploaded the template file',
  `uploaded_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Datetime when template file was uploaded',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete timestamp',
  PRIMARY KEY (`deliverable_template_id`),
  KEY `idx_adt_deliverable` (`deliverable_id`),
  KEY `idx_adt_deleted_at` (`deleted_at`),
  CONSTRAINT `fk_adt_deliverable` FOREIGN KEY (`deliverable_id`) REFERENCES `deliv_deliverables` (`deliverable_id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Template files for a deliverable (students download these to complete the work)';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `deliv_templates`
--

LOCK TABLES `deliv_templates` WRITE;
/*!40000 ALTER TABLE `deliv_templates` DISABLE KEYS */;
INSERT INTO `deliv_templates` VALUES (1,1,'tst/templates/reflection-guideline.pdf','reflection-guideline.pdf','application/pdf',245678,2,'2026-02-05 18:11:50',NULL);
/*!40000 ALTER TABLE `deliv_templates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `edu_curricula`
--

DROP TABLE IF EXISTS `edu_curricula`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `edu_curricula` (
  `curriculum_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `major_id` bigint unsigned NOT NULL,
  `code` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name_th` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name_en` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `effective_year_be` smallint unsigned NOT NULL,
  `status` enum('draft','active','inactive') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `live_unique_key` tinyint GENERATED ALWAYS AS ((case when (`deleted_at` is null) then 1 else NULL end)) STORED,
  PRIMARY KEY (`curriculum_id`),
  UNIQUE KEY `uq_curricula_major_code_live` (`major_id`,`code`,`live_unique_key`),
  UNIQUE KEY `uq_curricula_major_year_name_th_live` (`major_id`,`effective_year_be`,`name_th`,`live_unique_key`),
  KEY `idx_curricula_major` (`major_id`),
  KEY `idx_curricula_status` (`status`),
  KEY `idx_curricula_deleted_at` (`deleted_at`),
  KEY `idx_curricula_major_year` (`major_id`,`effective_year_be`),
  CONSTRAINT `fk_curricula_major` FOREIGN KEY (`major_id`) REFERENCES `edu_majors` (`major_id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `edu_curricula`
--

LOCK TABLES `edu_curricula` WRITE;
/*!40000 ALTER TABLE `edu_curricula` DISABLE KEYS */;
INSERT INTO `edu_curricula` (`curriculum_id`, `major_id`, `code`, `name_th`, `name_en`, `effective_year_be`, `status`, `start_date`, `end_date`, `created_at`, `updated_at`, `deleted_at`) VALUES (1,1,'cp_2568_curriculum','หลักสูตรวิทยาการคอมพิวเตอร์_พ.ศ.2568','cp_curriculum_2025',2568,'inactive','2026-02-05',NULL,'2026-02-05 18:00:48','2026-06-20 13:15:56',NULL),(11,1,'IT_2568','เทคโนโลยีสารสนเทศและนวัตกรรมอัจฉริยะ','Information Technology and Innovation Intelligence',2568,'active',NULL,NULL,'2026-06-23 15:01:32','2026-06-25 17:08:00',NULL);
/*!40000 ALTER TABLE `edu_curricula` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `edu_majors`
--

DROP TABLE IF EXISTS `edu_majors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `edu_majors` (
  `major_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `department_id` bigint unsigned NOT NULL,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name_th` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name_en` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `degree_level` enum('bachelor','master','phd','other') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`major_id`),
  UNIQUE KEY `uq_majors_department_code` (`department_id`,`code`),
  KEY `idx_majors_department` (`department_id`),
  KEY `idx_majors_deleted_at` (`deleted_at`),
  CONSTRAINT `fk_majors_department` FOREIGN KEY (`department_id`) REFERENCES `org_departments` (`department_id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `edu_majors`
--

LOCK TABLES `edu_majors` WRITE;
/*!40000 ALTER TABLE `edu_majors` DISABLE KEYS */;
INSERT INTO `edu_majors` VALUES (1,1,'cp_major','วิทยาการคอมพิวเตอร์','College of Computing','bachelor',1,'2026-02-05 17:59:12','2026-02-05 17:59:12',NULL);
/*!40000 ALTER TABLE `edu_majors` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `kku_enrollment_curricula`
--

DROP TABLE IF EXISTS `kku_enrollment_curricula`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `kku_enrollment_curricula` (
  `enrollment_curriculum_id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'Primary key of enrollment curriculum record',
  `enrollment_id` bigint unsigned NOT NULL COMMENT 'FK to kku_enrollments',
  `curriculum_id` bigint unsigned NOT NULL COMMENT 'FK to edu_curricula',
  `start_academic_year_be` smallint unsigned NOT NULL COMMENT 'Start academic year in Buddhist Era (พ.ศ.)',
  `start_semester` tinyint unsigned NOT NULL COMMENT 'Start semester (1/2/3 if summer)',
  `end_academic_year_be` smallint unsigned DEFAULT NULL COMMENT 'End academic year in Buddhist Era (พ.ศ.), NULL if current',
  `end_semester` tinyint unsigned DEFAULT NULL COMMENT 'End semester, NULL if current',
  `is_current` tinyint(1) DEFAULT NULL COMMENT 'Current flag: 1=current, NULL=historical (default NULL to avoid accidental current rows)',
  `change_reason` enum('initial','curriculum_change','major_change','other') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'initial' COMMENT 'Reason for curriculum assignment/change',
  `note` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Optional note',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Record last update timestamp',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete timestamp',
  PRIMARY KEY (`enrollment_curriculum_id`),
  UNIQUE KEY `uq_kec_one_current` (`enrollment_id`,`is_current`),
  KEY `idx_kec_enrollment` (`enrollment_id`),
  KEY `idx_kec_curriculum` (`curriculum_id`),
  KEY `idx_kec_deleted_at` (`deleted_at`),
  CONSTRAINT `fk_kec_curriculum` FOREIGN KEY (`curriculum_id`) REFERENCES `edu_curricula` (`curriculum_id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_kec_enrollment` FOREIGN KEY (`enrollment_id`) REFERENCES `kku_enrollments` (`enrollment_id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Curriculum history per KKU enrollment';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `kku_enrollment_curricula`
--

LOCK TABLES `kku_enrollment_curricula` WRITE;
/*!40000 ALTER TABLE `kku_enrollment_curricula` DISABLE KEYS */;
INSERT INTO `kku_enrollment_curricula` VALUES (1,1,1,2565,1,NULL,NULL,1,'initial','เข้าหลักสูตรเริ่มต้น','2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(2,2,1,2565,1,NULL,NULL,1,'initial','เข้าหลักสูตรเริ่มต้น','2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(3,3,1,2566,1,NULL,NULL,1,'initial','เข้าหลักสูตรเริ่มต้น','2026-02-05 18:11:50','2026-02-05 18:11:50',NULL);
/*!40000 ALTER TABLE `kku_enrollment_curricula` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `kku_enrollments`
--

DROP TABLE IF EXISTS `kku_enrollments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `kku_enrollments` (
  `enrollment_id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'Primary key of KKU enrollment record',
  `person_id` bigint unsigned NOT NULL COMMENT 'FK to persons',
  `student_code` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'KKU student code (may be NULL if not officially student yet)',
  `faculty_id` bigint unsigned DEFAULT NULL COMMENT 'KKU faculty (for visibility / ownership)',
  `major_id` bigint unsigned DEFAULT NULL COMMENT 'KKU major',
  `entry_year_be` smallint unsigned DEFAULT NULL COMMENT 'Entry year in Buddhist Era (พ.ศ.)',
  `enrollment_status` enum('prospect','student','alumni','suspended','inactive') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'prospect' COMMENT 'Enrollment status at KKU',
  `is_kku_student` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'Convenience flag: 1 if currently a student',
  `started_at` date DEFAULT NULL COMMENT 'Enrollment start date',
  `ended_at` date DEFAULT NULL COMMENT 'Enrollment end date (if any)',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`enrollment_id`),
  UNIQUE KEY `uq_kku_student_code` (`student_code`),
  KEY `idx_kku_enroll_person` (`person_id`),
  KEY `idx_kku_enroll_faculty` (`faculty_id`),
  KEY `idx_kku_enroll_major` (`major_id`),
  KEY `idx_kku_enroll_deleted_at` (`deleted_at`),
  CONSTRAINT `fk_kku_enroll_faculty` FOREIGN KEY (`faculty_id`) REFERENCES `org_faculties` (`faculty_id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_kku_enroll_major` FOREIGN KEY (`major_id`) REFERENCES `edu_majors` (`major_id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_kku_enroll_person` FOREIGN KEY (`person_id`) REFERENCES `persons` (`person_id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='KKU enrollment status & academic affiliation per person';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `kku_enrollments`
--

LOCK TABLES `kku_enrollments` WRITE;
/*!40000 ALTER TABLE `kku_enrollments` DISABLE KEYS */;
INSERT INTO `kku_enrollments` VALUES (1,1,'653040000-1',1,1,2565,'',1,'2022-06-01',NULL,'2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(2,2,'653040000-2',1,1,2565,'',1,'2022-06-01',NULL,'2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(3,3,'663040000-3',1,1,2566,'',1,'2023-06-01',NULL,'2026-02-05 18:11:50','2026-02-05 18:11:50',NULL);
/*!40000 ALTER TABLE `kku_enrollments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `org_departments`
--

DROP TABLE IF EXISTS `org_departments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `org_departments` (
  `department_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `faculty_id` bigint unsigned NOT NULL,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name_th` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name_en` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`department_id`),
  UNIQUE KEY `uq_departments_faculty_code` (`faculty_id`,`code`),
  KEY `idx_departments_faculty` (`faculty_id`),
  KEY `idx_departments_deleted_at` (`deleted_at`),
  CONSTRAINT `fk_departments_faculty` FOREIGN KEY (`faculty_id`) REFERENCES `org_faculties` (`faculty_id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `org_departments`
--

LOCK TABLES `org_departments` WRITE;
/*!40000 ALTER TABLE `org_departments` DISABLE KEYS */;
INSERT INTO `org_departments` VALUES (1,1,'cp_department','วิทยาการคอมพิวเตอร์','College of Computing',1,'2026-02-05 02:35:44','2026-02-05 17:59:19',NULL);
/*!40000 ALTER TABLE `org_departments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `org_faculties`
--

DROP TABLE IF EXISTS `org_faculties`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `org_faculties` (
  `faculty_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `university_id` bigint unsigned NOT NULL,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name_th` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name_en` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`faculty_id`),
  UNIQUE KEY `uq_faculties_university_code` (`university_id`,`code`),
  KEY `idx_faculties_university` (`university_id`),
  KEY `idx_faculties_deleted_at` (`deleted_at`),
  CONSTRAINT `fk_faculties_university` FOREIGN KEY (`university_id`) REFERENCES `org_universities` (`university_id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `org_faculties`
--

LOCK TABLES `org_faculties` WRITE;
/*!40000 ALTER TABLE `org_faculties` DISABLE KEYS */;
INSERT INTO `org_faculties` VALUES (1,1,'cp_faculty','วิทยาการคอมพิวเตอร์','College of Computing',1,'2026-02-05 02:35:20','2026-02-05 17:59:41',NULL);
/*!40000 ALTER TABLE `org_faculties` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `org_universities`
--

DROP TABLE IF EXISTS `org_universities`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `org_universities` (
  `university_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name_th` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name_en` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`university_id`),
  UNIQUE KEY `uq_universities_code` (`code`),
  KEY `idx_universities_deleted_at` (`deleted_at`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `org_universities`
--

LOCK TABLES `org_universities` WRITE;
/*!40000 ALTER TABLE `org_universities` DISABLE KEYS */;
INSERT INTO `org_universities` VALUES (1,'kku','มหาวิทยาลัยขอนแก่น','Khon Kaen University',1,'2026-02-05 02:33:07','2026-02-05 02:33:07',NULL);
/*!40000 ALTER TABLE `org_universities` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `persons`
--

DROP TABLE IF EXISTS `persons`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `persons` (
  `person_id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'Primary key for person',
  `national_id` char(13) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Thai national ID (unique when present)',
  `passport_no` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Passport number for non-Thai (optional)',
  `prefix_th` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Thai prefix',
  `first_name_th` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Thai first name',
  `last_name_th` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Thai last name',
  `first_name_en` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'English first name',
  `last_name_en` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'English last name',
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Email',
  `phone` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Phone',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Record last update timestamp',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete timestamp',
  PRIMARY KEY (`person_id`),
  UNIQUE KEY `uq_persons_national_id` (`national_id`),
  UNIQUE KEY `uq_persons_passport_no` (`passport_no`),
  KEY `idx_persons_deleted_at` (`deleted_at`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Person master data (identity)';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `persons`
--

LOCK TABLES `persons` WRITE;
/*!40000 ALTER TABLE `persons` DISABLE KEYS */;
INSERT INTO `persons` VALUES (1,'1103700000011',NULL,'นาย','สมชาย','ใจดี','Somchai','Jaidee','student01@demo.local','0810000001','2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(2,'1103700000029',NULL,'นางสาว','สมหญิง','ตั้งใจ','Somying','Tangjai','student02@demo.local','0810000002','2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(3,'1103700000037',NULL,'นาย','อนันต์','พยายาม','Anan','Phayayam','student03@demo.local','0810000003','2026-02-05 18:11:50','2026-02-05 18:11:50',NULL);
/*!40000 ALTER TABLE `persons` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `score_competency_result`
--

DROP TABLE IF EXISTS `score_competency_result`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `score_competency_result` (
  `competency_result_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `enrollment_id` bigint unsigned NOT NULL COMMENT 'นักศึกษาคนนี้ (รหัสนักศึกษา)',
  `competency_id` bigint unsigned NOT NULL,
  `final_score` decimal(8,2) NOT NULL DEFAULT '0.00' COMMENT 'คะแนนรวมทั้งหมดของสมรรถนะนี้ (ไม่มีลิมิต)',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`competency_result_id`),
  UNIQUE KEY `uq_score_comp_result` (`enrollment_id`,`competency_id`),
  KEY `fk_scr_comp` (`competency_id`),
  CONSTRAINT `fk_scr_comp` FOREIGN KEY (`competency_id`) REFERENCES `comp_competencies` (`competency_id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_scr_enrollment` FOREIGN KEY (`enrollment_id`) REFERENCES `kku_enrollments` (`enrollment_id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='คะแนนสมรรถนะรวมของนักศึกษา (สำหรับวาด Radar Chart)';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `score_competency_result`
--

LOCK TABLES `score_competency_result` WRITE;
/*!40000 ALTER TABLE `score_competency_result` DISABLE KEYS */;
/*!40000 ALTER TABLE `score_competency_result` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `score_course_competency_scores`
--

DROP TABLE IF EXISTS `score_course_competency_scores`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `score_course_competency_scores` (
  `score_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `course_student_id` bigint unsigned NOT NULL COMMENT 'ลิงก์กับการลงทะเบียนวิชานั้นๆ',
  `competency_id` bigint unsigned NOT NULL,
  `raw_score` decimal(6,2) DEFAULT NULL COMMENT 'คะแนนดิบที่แปลงมาจากเกรด',
  `weighted_score` decimal(6,2) DEFAULT NULL COMMENT 'คะแนนที่คูณน้ำหนักแล้ว',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`score_id`),
  UNIQUE KEY `uq_score_course_student_comp` (`course_student_id`,`competency_id`),
  KEY `fk_score_ccs_comp` (`competency_id`),
  CONSTRAINT `fk_score_ccs_comp` FOREIGN KEY (`competency_id`) REFERENCES `comp_competencies` (`competency_id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_score_ccs_student` FOREIGN KEY (`course_student_id`) REFERENCES `crs_course_enrollment` (`course_student_id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ผลคะแนนสมรรถนะที่ได้จากแต่ละวิชา';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `score_course_competency_scores`
--

LOCK TABLES `score_course_competency_scores` WRITE;
/*!40000 ALTER TABLE `score_course_competency_scores` DISABLE KEYS */;
/*!40000 ALTER TABLE `score_course_competency_scores` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `score_session_competency_evidences`
--

DROP TABLE IF EXISTS `score_session_competency_evidences`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `score_session_competency_evidences` (
  `session_competency_evidence_id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'Primary key of score evidence record',
  `score_id` bigint unsigned NOT NULL COMMENT 'FK to session_competency_scores',
  `evidence_type` enum('submission','exam','external','other') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Type of evidence linked to this competency score',
  `submission_id` bigint unsigned DEFAULT NULL COMMENT 'Reference to student_deliverable_submissions.id when evidence_type=submission',
  `exam_attempt_id` bigint unsigned DEFAULT NULL COMMENT 'Reference to student_deliverable_exam_attempts.id when evidence_type=exam',
  `external_ref` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'External reference (e.g., exam sheet id, Google Form response id) when evidence is outside the system',
  `note` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Optional note about this evidence',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Record last update timestamp',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete timestamp',
  PRIMARY KEY (`session_competency_evidence_id`),
  KEY `idx_scse_score` (`score_id`),
  KEY `idx_scse_submission` (`submission_id`),
  KEY `idx_scse_exam_attempt` (`exam_attempt_id`),
  KEY `idx_scse_deleted_at` (`deleted_at`),
  CONSTRAINT `fk_scse_score` FOREIGN KEY (`score_id`) REFERENCES `score_session_competency_scores` (`session_competency_score_id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Links competency scores to multiple evidence records (submission/exam/external)';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `score_session_competency_evidences`
--

LOCK TABLES `score_session_competency_evidences` WRITE;
/*!40000 ALTER TABLE `score_session_competency_evidences` DISABLE KEYS */;
INSERT INTO `score_session_competency_evidences` VALUES (1,1,'submission',1,NULL,NULL,'อ้างอิง reflection','2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(2,2,'exam',NULL,1,NULL,'อ้างอิง AI Quiz','2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(3,4,'submission',2,NULL,NULL,'อ้างอิง reflection (late)','2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(4,5,'exam',NULL,2,NULL,'อ้างอิง AI Quiz','2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(5,7,'other',NULL,NULL,'attendance:session2','หลักฐานจากการเข้าร่วมกิจกรรม','2026-02-05 18:11:50','2026-02-05 18:11:50',NULL);
/*!40000 ALTER TABLE `score_session_competency_evidences` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `score_session_competency_results`
--

DROP TABLE IF EXISTS `score_session_competency_results`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `score_session_competency_results` (
  `session_competency_result_id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'Primary key of computed competency result',
  `score_id` bigint unsigned NOT NULL COMMENT 'FK to session_competency_scores (source of computation)',
  `max_percent_snapshot` decimal(6,2) NOT NULL COMMENT 'Snapshot of max_percent from session_competencies at computation time',
  `factor_snapshot` decimal(7,6) NOT NULL COMMENT 'Snapshot of normalization factor (final_score / max_raw_score_snapshot)',
  `earned_percent` decimal(6,2) NOT NULL COMMENT 'Computed earned percent contributed to the competency from this session',
  `computed_by` bigint unsigned DEFAULT NULL COMMENT 'User ID or system user who computed the result',
  `computed_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Datetime when result was computed',
  `is_locked` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'Lock computed result to prevent changes (historical record)',
  `locked_at` datetime DEFAULT NULL COMMENT 'Datetime when computed result was locked',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Record last update timestamp',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete timestamp',
  PRIMARY KEY (`session_competency_result_id`),
  UNIQUE KEY `uq_scr_score_id` (`score_id`),
  KEY `idx_scr_deleted_at` (`deleted_at`),
  KEY `idx_scr_computed_at` (`computed_at`),
  CONSTRAINT `fk_scr_score` FOREIGN KEY (`score_id`) REFERENCES `score_session_competency_scores` (`session_competency_score_id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Stored computed earned percent per score record (snapshotted + lockable)';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `score_session_competency_results`
--

LOCK TABLES `score_session_competency_results` WRITE;
/*!40000 ALTER TABLE `score_session_competency_results` DISABLE KEYS */;
INSERT INTO `score_session_competency_results` VALUES (1,1,30.00,1.000000,25.50,5,'2026-02-05 18:11:50',1,'2026-02-05 18:11:50','2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(2,2,40.00,1.000000,31.20,5,'2026-02-05 18:11:50',1,'2026-02-05 18:11:50','2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(3,3,30.00,1.000000,27.60,5,'2026-02-05 18:11:50',1,'2026-02-05 18:11:50','2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(4,4,30.00,1.000000,21.60,5,'2026-02-05 18:11:50',1,'2026-02-05 18:11:50','2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(5,5,40.00,1.000000,25.20,5,'2026-02-05 18:11:50',1,'2026-02-05 18:11:50','2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(6,6,30.00,1.000000,20.25,5,'2026-02-05 18:11:50',1,'2026-02-05 18:11:50','2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(7,7,50.00,1.000000,50.00,5,'2026-02-05 18:11:50',1,'2026-02-05 18:11:50','2026-02-05 18:11:50','2026-02-05 18:11:50',NULL);
/*!40000 ALTER TABLE `score_session_competency_results` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `score_session_competency_scores`
--

DROP TABLE IF EXISTS `score_session_competency_scores`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `score_session_competency_scores` (
  `session_competency_score_id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'Primary key of score record',
  `session_competency_id` bigint unsigned NOT NULL COMMENT 'FK to session_competencies (ensures competency is configured for this session)',
  `person_id` bigint unsigned NOT NULL COMMENT 'Person who is being scored',
  `grading_source` enum('attendance','manual','submission','exam','hybrid','system') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'manual' COMMENT 'Where this score comes from',
  `raw_score` decimal(6,2) DEFAULT NULL COMMENT 'Raw score before penalty (NULL allowed if not graded yet)',
  `max_raw_score_snapshot` decimal(6,2) NOT NULL DEFAULT '100.00' COMMENT 'Snapshot of max raw score used for normalization at grading time',
  `attendance_status_snapshot` enum('present','late','absent','excused') COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Snapshot of attendance status at grading time (optional but useful for audit)',
  `penalty_factor_snapshot` decimal(5,4) NOT NULL DEFAULT '1.0000' COMMENT 'Snapshot multiplier applied to raw_score (e.g. late penalty 0.8000)',
  `final_score` decimal(6,2) DEFAULT NULL COMMENT 'Final score after applying penalty (raw_score * penalty_factor_snapshot)',
  `graded_by` bigint unsigned DEFAULT NULL COMMENT 'User ID who graded this competency score',
  `graded_at` datetime DEFAULT NULL COMMENT 'Datetime when this competency score was graded',
  `notes` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Optional notes for this score',
  `is_locked` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'Lock the score record to prevent changes after session is finalized',
  `locked_at` datetime DEFAULT NULL COMMENT 'Datetime when the score record was locked',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Record last update timestamp',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete timestamp',
  PRIMARY KEY (`session_competency_score_id`),
  UNIQUE KEY `uq_scs_session_competency_student` (`session_competency_id`,`person_id`),
  KEY `idx_scs_session_competency` (`session_competency_id`),
  KEY `idx_scs_student` (`person_id`),
  KEY `idx_scs_graded_at` (`graded_at`),
  KEY `idx_scs_deleted_at` (`deleted_at`),
  CONSTRAINT `fk_score_person` FOREIGN KEY (`person_id`) REFERENCES `persons` (`person_id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_scs_session_competency` FOREIGN KEY (`session_competency_id`) REFERENCES `act_session_competencies` (`session_competency_id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Raw/final score per student per session competency (score is separated per competency)';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `score_session_competency_scores`
--

LOCK TABLES `score_session_competency_scores` WRITE;
/*!40000 ALTER TABLE `score_session_competency_scores` DISABLE KEYS */;
INSERT INTO `score_session_competency_scores` VALUES (1,1,1,'hybrid',85.00,100.00,'present',1.0000,85.00,2,'2026-02-10 12:40:00','รวมคะแนนกิจกรรม+submission',1,'2026-02-10 12:41:00','2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(2,2,1,'hybrid',78.00,100.00,'present',1.0000,78.00,2,'2026-02-10 12:40:00','รวมคะแนนกิจกรรม+exam',1,'2026-02-10 12:41:00','2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(3,3,1,'hybrid',92.00,100.00,'present',1.0000,92.00,2,'2026-02-10 12:40:00','ทำกิจกรรมกลุ่มดี',1,'2026-02-10 12:41:00','2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(4,1,2,'hybrid',80.00,100.00,'late',0.9000,72.00,2,'2026-02-10 12:40:00','มาสาย - คิด penalty',1,'2026-02-10 12:41:00','2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(5,2,2,'hybrid',70.00,100.00,'late',0.9000,63.00,2,'2026-02-10 12:40:00','คะแนนรวม + penalty',1,'2026-02-10 12:41:00','2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(6,3,2,'hybrid',75.00,100.00,'late',0.9000,67.50,2,'2026-02-10 12:40:00','ทำงานกลุ่มพอใช้',1,'2026-02-10 12:41:00','2026-02-05 18:11:50','2026-02-05 18:11:50',NULL),(7,4,1,'attendance',100.00,100.00,'present',1.0000,100.00,3,'2026-02-15 17:05:00','attendance only',1,'2026-02-15 17:06:00','2026-02-05 18:11:50','2026-02-05 18:11:50',NULL);
/*!40000 ALTER TABLE `score_session_competency_scores` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-06-25 17:27:53
