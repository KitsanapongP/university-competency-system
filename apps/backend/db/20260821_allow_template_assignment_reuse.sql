-- Allow an assessment plan to be assigned again after its previous assignment ends.
-- Review the preflight result before running the ALTER statement.

-- A live assessment plan must not be assigned to more than one cohort.
SELECT template_id, COUNT(*) AS live_assignment_count
FROM curri_template_assignments
WHERE deleted_at IS NULL
GROUP BY template_id
HAVING COUNT(*) > 1;

START TRANSACTION;

ALTER TABLE curri_template_assignments
    DROP INDEX uq_template_assignments_template,
    ADD UNIQUE KEY uq_template_assignments_template_live (template_id, live_unique_key);

COMMIT;
