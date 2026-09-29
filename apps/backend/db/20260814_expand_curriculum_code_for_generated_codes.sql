-- Generated curriculum codes combine faculty code, major code, academic year,
-- and sequence. The existing VARCHAR(80) cannot safely contain the longest
-- supported master-code values.

SELECT
    curriculum_id,
    code,
    CHAR_LENGTH(code) AS code_length
FROM edu_curricula
WHERE CHAR_LENGTH(code) > 128;

ALTER TABLE edu_curricula
    MODIFY COLUMN code VARCHAR(128) NOT NULL;
