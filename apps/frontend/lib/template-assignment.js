import { apiFetch } from './api';

function unwrapList(response) {
    const data = response?.data !== undefined ? response.data : response;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    return [];
}

function queryString(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
    });
    const serialized = query.toString();
    return serialized ? `?${serialized}` : '';
}

export function mapTemplateAssignment(item = {}) {
    return {
        assignmentId: item.template_assignment_id,
        templateId: item.template_id,
        templateName: item.template_name || '',
        templateCode: item.template_code || '',
        templateIsActive: Boolean(item.template_is_active),
        curriculumId: item.curriculum_id,
        curriculumCode: item.curriculum_code || '',
        curriculumNameTh: item.curriculum_name_th || '',
        cohortId: item.cohort_id,
        entryYearBe: item.entry_year_be || 0,
        cohortStatus: item.cohort_status || '',
        rosterCount: item.roster_count || 0,
        scoreLocked: Boolean(item.score_locked),
        assignedAt: item.assigned_at,
        assignedBy: item.assigned_by,
        endedAt: item.ended_at,
        endedBy: item.ended_by,
        endReason: item.end_reason || '',
        deletedAt: item.deleted_at,
    };
}

export function mapAssignmentCandidate(item = {}) {
    return {
        templateId: item.template_id,
        templateCode: item.template_code || '',
        templateName: item.template_name || '',
        templateIsActive: Boolean(item.template_is_active),
        wasAssignedBefore: Boolean(item.was_assigned_before),
        requiresReactivation: Boolean(item.requires_reactivation),
        curriculumId: item.curriculum_id,
        curriculumCode: item.curriculum_code || '',
        curriculumNameTh: item.curriculum_name_th || '',
        cohortId: item.cohort_id,
        entryYearBe: item.entry_year_be || 0,
        rosterCount: item.roster_count || 0,
    };
}

export async function fetchTemplateAssignments(filters = {}) {
    const response = await apiFetch(`/api/v1/template-assignments${queryString({ faculty_id: filters.facultyId })}`);
    return unwrapList(response).map(mapTemplateAssignment);
}

export async function fetchAvailableAssignmentTemplates(filters = {}) {
    const response = await apiFetch(`/api/v1/template-assignments/available-templates${queryString({ faculty_id: filters.facultyId })}`);
    return unwrapList(response).map(mapAssignmentCandidate);
}

export async function fetchAvailableAssignmentCohorts(templateId) {
    const response = await apiFetch(`/api/v1/template-assignments/available-cohorts${queryString({ template_id: templateId })}`);
    return unwrapList(response).map(mapAssignmentCandidate);
}

export async function fetchTemplateAssignmentHistory(cohortId) {
    const response = await apiFetch(`/api/v1/template-assignments/cohorts/${cohortId}/history`);
    return unwrapList(response).map(mapTemplateAssignment);
}

export async function createTemplateAssignment(templateId, cohortId) {
    const response = await apiFetch('/api/v1/template-assignments', {
        method: 'POST',
        body: JSON.stringify({ template_id: templateId, cohort_id: cohortId, confirm: true }),
    });
    return mapTemplateAssignment(response?.data || {});
}

export async function replaceTemplateAssignment(assignmentId, templateId, reason) {
    const response = await apiFetch(`/api/v1/template-assignments/${assignmentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ template_id: templateId, reason: String(reason || '').trim(), confirm: true }),
    });
    return mapTemplateAssignment(response?.data || {});
}

export async function removeTemplateAssignment(assignmentId, reason) {
    const response = await apiFetch(`/api/v1/template-assignments/${assignmentId}`, {
        method: 'DELETE',
        body: JSON.stringify({ reason: String(reason || '').trim(), confirm: true }),
    });
    return mapTemplateAssignment(response?.data || {});
}
