import { apiFetch } from './api';

function unwrapData(response, fallback = null) {
    return response?.data !== undefined ? response.data : (response ?? fallback);
}

export async function fetchTemplates(facultyId) {
    const query = facultyId ? `?faculty_id=${facultyId}` : '';
    const res = await apiFetch(`/api/v1/templates${query}`);
    return unwrapData(res, []);
}

export async function fetchTemplateById(id) {
    const res = await apiFetch(`/api/v1/templates/${id}`);
    return unwrapData(res, null);
}

export async function createTemplate(payload) {
    const body = { ...(payload || {}) };
    delete body.cohort_year_be;
    delete body.academic_year;
    const res = await apiFetch('/api/v1/templates', {
        method: 'POST',
        body: JSON.stringify(body),
    });
    return unwrapData(res, res);
}

export async function previewDuplicateTemplate(id, payload) {
    const res = await apiFetch(`/api/v1/templates/${id}/duplicate-preview`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    return unwrapData(res, null);
}

export async function duplicateTemplate(id, payload) {
    const res = await apiFetch(`/api/v1/templates/${id}/duplicate`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    return unwrapData(res, res);
}

export async function updateTemplateStatus(id, status) {
    const res = await apiFetch(`/api/v1/templates/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
    });
    return unwrapData(res, res);
}

export async function updateTemplateName(id, name) {
    const res = await apiFetch(`/api/v1/templates/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
    });
    return unwrapData(res, res);
}

export async function deleteTemplate(id) {
    const res = await apiFetch(`/api/v1/templates/${id}`, {
        method: 'DELETE',
    });
    return unwrapData(res, res);
}

export async function fetchTemplateItems(id) {
    const res = await apiFetch(`/api/v1/templates/${id}/items`);
    return unwrapData(res, []);
}

export async function fetchTemplateStructure(id) {
    const res = await apiFetch(`/api/v1/templates/${id}/structure`);
    return unwrapData(res, { items: [], custom_categories: [], custom_courses: [] });
}

export async function fetchTemplateCompetencies(id) {
    const res = await apiFetch(`/api/v1/templates/${id}/competencies`);
    return unwrapData(res, null);
}

export async function updateTemplateCompetencies(id, payload) {
    const res = await apiFetch(`/api/v1/templates/${id}/competencies`, {
        method: 'PUT',
        body: JSON.stringify(payload),
    });
    return unwrapData(res, null);
}

export async function saveTemplateItems(id, payload) {
    const body = Array.isArray(payload) ? { items: payload } : payload;
    const res = await apiFetch(`/api/v1/templates/${id}/items`, {
        method: 'PUT',
        body: JSON.stringify(body),
    });
    return unwrapData(res, res);
}

