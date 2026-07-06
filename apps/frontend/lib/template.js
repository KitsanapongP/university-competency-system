import { apiFetch } from './api';

export async function fetchTemplates(facultyId) {
    const query = facultyId ? `?faculty_id=${facultyId}` : '';
    return apiFetch(`/api/v1/templates${query}`);
}

export async function fetchTemplateById(id) {
    return apiFetch(`/api/v1/templates/${id}`);
}

export async function createTemplate(payload) {
    return apiFetch('/api/v1/templates', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export async function updateTemplateStatus(id, status) {
    return apiFetch(`/api/v1/templates/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
    });
}

export async function deleteTemplate(id) {
    return apiFetch(`/api/v1/templates/${id}`, {
        method: 'DELETE',
    });
}

export async function fetchTemplateItems(id) {
    return apiFetch(`/api/v1/templates/${id}/items`);
}

export async function saveTemplateItems(id, items) {
    return apiFetch(`/api/v1/templates/${id}/items`, {
        method: 'PUT',
        body: JSON.stringify({ items }),
    });
}
