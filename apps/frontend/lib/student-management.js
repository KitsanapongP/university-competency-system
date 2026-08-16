import { apiFetch } from './api';

function unwrapData(response, fallback) {
    return response?.data ?? fallback;
}

function nullable(value) {
    const normalized = String(value ?? '').trim();
    return normalized || null;
}

function queryString(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            query.set(key, String(value));
        }
    });
    const value = query.toString();
    return value ? `?${value}` : '';
}

export function mapStudentCohort(item) {
    return {
        cohortId: item.cohort_id,
        curriculumId: item.curriculum_id,
        curriculumCode: item.curriculum_code || '',
        curriculumNameTh: item.curriculum_name_th || '',
        curriculumNameEn: item.curriculum_name_en || '',
        curriculumEffectiveYear: item.curriculum_effective_year_be || 0,
        majorId: item.major_id,
        majorNameTh: item.major_name_th || '',
        facultyId: item.faculty_id,
        facultyNameTh: item.faculty_name_th || '',
        entryYearBe: item.entry_year_be || 0,
        status: item.status || 'draft',
        note: item.note || '',
        rosterCount: item.roster_count || 0,
        studentCount: item.student_count || 0,
        suspendedCount: item.suspended_count || 0,
        templateCount: item.template_count || 0,
        activeTemplateCount: item.active_template_count || 0,
        lastReactivationReason: item.last_reactivation_reason || '',
        lastReactivatedAt: item.last_reactivated_at,
        lastReactivatedBy: item.last_reactivated_by,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
    };
}

export function mapCohortStudent(item) {
    return {
        enrollmentCurriculumId: item.enrollment_curriculum_id,
        enrollmentId: item.enrollment_id,
        personId: item.person_id,
        studentCode: item.student_code || '',
        prefixTh: item.prefix_th || '',
        firstNameTh: item.first_name_th || '',
        lastNameTh: item.last_name_th || '',
        firstNameEn: item.first_name_en || '',
        lastNameEn: item.last_name_en || '',
        email: item.email || '',
        phone: item.phone || '',
        enrollmentStatus: item.enrollment_status || 'student',
        isKkuStudent: Boolean(item.is_kku_student),
        createdAt: item.created_at,
        updatedAt: item.updated_at,
    };
}

function cohortPayload(form) {
    return {
        curriculum_id: Number(form.curriculumId) || 0,
        entry_year_be: Number(form.entryYearBe) || 0,
        note: nullable(form.note),
    };
}

function studentPayload(form) {
    return {
        student_code: String(form.studentCode || '').trim(),
        prefix_th: nullable(form.prefixTh),
        first_name_th: String(form.firstNameTh || '').trim(),
        last_name_th: String(form.lastNameTh || '').trim(),
        first_name_en: nullable(form.firstNameEn),
        last_name_en: nullable(form.lastNameEn),
        email: nullable(form.email),
        phone: nullable(form.phone),
        enrollment_status: String(form.enrollmentStatus || 'student').trim(),
    };
}

function importRowPayload(row) {
    return {
        row_number: Number(row.rowNumber) || 0,
        ...studentPayload(row),
        apply_update: Boolean(row.applyUpdate),
    };
}

export async function fetchStudentCohorts(filters = {}) {
    const response = await apiFetch(`/api/v1/student-cohorts${queryString({
        faculty_id: filters.facultyId,
        major_id: filters.majorId,
        curriculum_id: filters.curriculumId,
        entry_year_be: filters.entryYearBe,
        status: filters.status,
        search: filters.search,
    })}`);
    return unwrapData(response, []).map(mapStudentCohort);
}

export async function fetchStudentCohort(cohortId) {
    const response = await apiFetch(`/api/v1/student-cohorts/${cohortId}`);
    return mapStudentCohort(unwrapData(response, null));
}

export async function createStudentCohort(form) {
    const response = await apiFetch('/api/v1/student-cohorts', {
        method: 'POST',
        body: JSON.stringify(cohortPayload(form)),
    });
    return mapStudentCohort(unwrapData(response, null));
}

export async function updateStudentCohort(cohortId, form) {
    const response = await apiFetch(`/api/v1/student-cohorts/${cohortId}`, {
        method: 'PATCH',
        body: JSON.stringify(cohortPayload(form)),
    });
    return mapStudentCohort(unwrapData(response, null));
}

export async function updateStudentCohortStatus(cohortId, status, options = {}) {
    const response = await apiFetch(`/api/v1/student-cohorts/${cohortId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
            status,
            confirm_reactivation: Boolean(options.confirmReactivation),
            reactivation_reason: String(options.reactivationReason || '').trim(),
        }),
    });
    return mapStudentCohort(unwrapData(response, null));
}

export async function deleteStudentCohort(cohortId) {
    const response = await apiFetch(`/api/v1/student-cohorts/${cohortId}`, { method: 'DELETE' });
    return unwrapData(response, null);
}

export async function fetchCohortStudents(cohortId, filters = {}) {
    const response = await apiFetch(`/api/v1/student-cohorts/${cohortId}/students${queryString({
        search: filters.search,
        status: filters.status,
    })}`);
    return unwrapData(response, []).map(mapCohortStudent);
}

export async function addCohortStudent(cohortId, form) {
    const response = await apiFetch(`/api/v1/student-cohorts/${cohortId}/students`, {
        method: 'POST',
        body: JSON.stringify(studentPayload(form)),
    });
    return mapCohortStudent(unwrapData(response, null));
}

export async function updateCohortStudent(cohortId, enrollmentId, form) {
    const response = await apiFetch(`/api/v1/student-cohorts/${cohortId}/students/${enrollmentId}`, {
        method: 'PATCH',
        body: JSON.stringify(studentPayload(form)),
    });
    return mapCohortStudent(unwrapData(response, null));
}

export async function removeCohortStudent(cohortId, enrollmentId) {
    const response = await apiFetch(`/api/v1/student-cohorts/${cohortId}/students/${enrollmentId}`, { method: 'DELETE' });
    return unwrapData(response, null);
}

export async function previewCohortImport(cohortId, rows) {
    const response = await apiFetch(`/api/v1/student-cohorts/${cohortId}/imports/preview`, {
        method: 'POST',
        body: JSON.stringify({ rows: rows.map(importRowPayload) }),
    });
    return unwrapData(response, { valid_rows: [], update_candidates: [], skipped_rows: [], errors: [] });
}

export async function commitCohortImport(cohortId, rows) {
    const response = await apiFetch(`/api/v1/student-cohorts/${cohortId}/imports/commit`, {
        method: 'POST',
        body: JSON.stringify({ rows: rows.map(importRowPayload) }),
    });
    return unwrapData(response, null);
}

function mapCompetencyRequirement(item) {
    return {
        competencyId: item.competency_id,
        competencyCode: item.competency_code || '',
        competencyName: item.competency_name || '',
        targetScore: Number(item.target_score || 0),
        isRequired: Boolean(item.is_required),
        displayOrder: Number(item.display_order || 0),
        coreWeight: Number(item.core_weight || 0),
        bonusWeight: Number(item.bonus_weight || 0),
    };
}

function mapCompetencyScoreSummary(item) {
    return {
        enrollmentId: item.enrollment_id,
        studentCode: item.student_code || '',
        studentNameTh: item.student_name_th || '',
        competencyId: item.competency_id,
        competencyCode: item.competency_code || '',
        competencyName: item.competency_name || '',
        targetScore: Number(item.target_score || 0),
        coreScore: Number(item.core_score || 0),
        courseBonusScore: Number(item.course_bonus_score || 0),
        courseTotalScore: Number(item.course_total_score || 0),
        activityScore: Number(item.activity_score || 0),
        accumulatedScore: Number(item.accumulated_score || 0),
        passedRequirement: Boolean(item.passed_requirement),
    };
}

export async function fetchCohortCompetencyRequirements(cohortId) {
    const response = await apiFetch(`/api/v1/student-cohorts/${cohortId}/competency-requirements`);
    return unwrapData(response, []).map(mapCompetencyRequirement);
}

export async function saveCohortCompetencyRequirements(cohortId, requirements) {
    const response = await apiFetch(`/api/v1/student-cohorts/${cohortId}/competency-requirements`, {
        method: 'PUT',
        body: JSON.stringify({
            requirements: requirements.map(item => ({
                competency_id: item.competencyId,
                target_score: Number(item.targetScore) || 0,
                is_required: Boolean(item.isRequired),
            })),
        }),
    });
    return unwrapData(response, []).map(mapCompetencyRequirement);
}

export async function recalculateCohortCourseCompetencyScores(cohortId) {
    const response = await apiFetch(`/api/v1/student-cohorts/${cohortId}/course-competency-scores/recalculate`, {
        method: 'POST',
    });
    return unwrapData(response, null);
}

export async function fetchCohortCourseCompetencyScoreSummary(cohortId) {
    const response = await apiFetch(`/api/v1/student-cohorts/${cohortId}/course-competency-scores/summary`);
    return unwrapData(response, []).map(mapCompetencyScoreSummary);
}
