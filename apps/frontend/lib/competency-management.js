import { apiFetch } from './api';

function unwrapData(response, fallback) {
    return response?.data ?? fallback;
}

function toNullableString(value) {
    const normalized = String(value ?? '').trim();
    return normalized ? normalized : null;
}

export function mapCompetencyOption(competency) {
    if (!competency) return null;
    return {
        competencyId: competency.competency_id,
        code: competency.code || '',
        nameTh: competency.name_th || '',
        nameEn: competency.name_en || '',
        description: competency.description || '',
        isActive: competency.is_active ?? true,
        templateUsageCount: competency.template_usage_count || 0,
        canEdit: competency.can_edit ?? (competency.template_usage_count === 0),
        canDelete: competency.can_delete ?? (competency.template_usage_count === 0),
        createdAt: competency.created_at,
        updatedAt: competency.updated_at,
    };
}

export async function fetchCompetenciesForManagement() {
    const response = await apiFetch('/api/v1/competencies');
    return unwrapData(response, []).map(mapCompetencyOption);
}

function competencyPayload(form) {
    return {
        code: String(form.code || '').trim(),
        name_th: String(form.nameTh || '').trim(),
        name_en: toNullableString(form.nameEn),
        description: toNullableString(form.description),
    };
}

export async function createCompetency(form) {
    const response = await apiFetch('/api/v1/competencies', {
        method: 'POST',
        body: JSON.stringify(competencyPayload(form)),
    });

    return mapCompetencyOption(unwrapData(response, null));
}

export async function updateCompetency(competencyId, form) {
    const response = await apiFetch(`/api/v1/competencies/${competencyId}`, {
        method: 'PATCH',
        body: JSON.stringify(competencyPayload(form)),
    });

    return mapCompetencyOption(unwrapData(response, null));
}

export async function deleteCompetency(competencyId) {
    const response = await apiFetch(`/api/v1/competencies/${competencyId}`, {
        method: 'DELETE',
    });

    return response;
}
