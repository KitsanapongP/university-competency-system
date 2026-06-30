import { apiFetch } from './api';

function unwrapData(response, fallback) {
    return response?.data ?? fallback;
}

function toNullableString(value) {
    const normalized = String(value ?? '').trim();
    return normalized ? normalized : null;
}

export function mapCompetency(item) {
    return {
        competencyId: item.competency_id,
        id: item.competency_id,
        code: item.code || '',
        nameTh: item.name_th || '',
        nameEn: item.name_en || '',
        description: item.description || '',
        isActive: item.is_active ?? true,
        templateUsageCount: item.template_usage_count || 0,
        canEdit: item.can_edit ?? (item.template_usage_count || 0) === 0,
        canDelete: item.can_delete ?? (item.template_usage_count || 0) === 0,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
    };
}

function competencyPayload(form) {
    return {
        code: String(form.code || '').trim(),
        name_th: String(form.nameTh || '').trim(),
        name_en: toNullableString(form.nameEn),
        description: toNullableString(form.description),
    };
}

export async function fetchCompetenciesForManagement() {
    const response = await apiFetch('/api/v1/competencies');
    return unwrapData(response, []).map(mapCompetency);
}

export async function createCompetency(form) {
    const response = await apiFetch('/api/v1/competencies', {
        method: 'POST',
        body: JSON.stringify(competencyPayload(form)),
    });

    return mapCompetency(unwrapData(response, null));
}

export async function updateCompetency(competencyId, form) {
    const response = await apiFetch(`/api/v1/competencies/${competencyId}`, {
        method: 'PATCH',
        body: JSON.stringify(competencyPayload(form)),
    });

    return mapCompetency(unwrapData(response, null));
}

export async function deleteCompetency(competencyId) {
    const response = await apiFetch(`/api/v1/competencies/${competencyId}`, {
        method: 'DELETE',
    });

    return unwrapData(response, null);
}
