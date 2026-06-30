import { apiFetch } from './api';

function unwrapData(response, fallback) {
    return response?.data ?? fallback;
}

function toNullableString(value) {
    const normalized = String(value ?? '').trim();
    return normalized ? normalized : null;
}

function buildQuery(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            query.set(key, String(value));
        }
    });

    const text = query.toString();
    return text ? `?${text}` : '';
}

export function mapActivity(item) {
    return {
        activityId: item.activity_id,
        id: item.activity_id,
        facultyId: item.faculty_id,
        facultyNameTh: item.faculty_name_th || '',
        facultyNameEn: item.faculty_name_en || '',
        code: item.code || '',
        nameTh: item.name_th || '',
        nameEn: item.name_en || '',
        description: item.description || '',
        category: item.category || '',
        type: item.type || '',
        createdBy: item.created_by,
        status: item.status || 'draft',
        visibilityScope: item.visibility_scope || 'faculty_only',
        registrationRequired: Boolean(item.registration_required),
        publishedAt: item.published_at,
        sessionCount: item.session_count || 0,
        nextSessionAt: item.next_session_at,
        latestSessionAt: item.latest_session_at,
        canEdit: item.can_edit ?? ['draft', 'published'].includes(item.status),
        canDelete: item.can_delete ?? (item.status === 'draft' && (item.session_count || 0) === 0),
        canPublish: item.can_publish ?? item.status === 'draft',
        canClose: item.can_close ?? item.status === 'published',
        createdAt: item.created_at,
        updatedAt: item.updated_at,
    };
}

function activityPayload(form) {
    return {
        faculty_id: Number(form.facultyId) || 0,
        code: String(form.code || '').trim(),
        name_th: String(form.nameTh || '').trim(),
        name_en: toNullableString(form.nameEn),
        description: toNullableString(form.description),
        category: toNullableString(form.category),
        type: toNullableString(form.type),
        registration_required: Boolean(form.registrationRequired),
    };
}

export async function fetchActivities(filters = {}) {
    const query = buildQuery({
        faculty_id: filters.facultyId,
        status: filters.status,
        category: filters.category,
        type: filters.type,
        search: filters.search,
    });
    const response = await apiFetch(`/api/v1/activities${query}`);
    return unwrapData(response, []).map(mapActivity);
}

export async function fetchActivityOptions(filters = {}) {
    const query = buildQuery({
        faculty_id: filters.facultyId,
    });
    const response = await apiFetch(`/api/v1/activities/options${query}`);
    const data = unwrapData(response, {});
    return {
        categories: data.categories || [],
        types: data.types || [],
    };
}

export async function createActivity(form) {
    const response = await apiFetch('/api/v1/activities', {
        method: 'POST',
        body: JSON.stringify(activityPayload(form)),
    });

    return mapActivity(unwrapData(response, null));
}

export async function updateActivity(activityId, form) {
    const response = await apiFetch(`/api/v1/activities/${activityId}`, {
        method: 'PATCH',
        body: JSON.stringify(activityPayload(form)),
    });

    return mapActivity(unwrapData(response, null));
}

export async function updateActivityStatus(activityId, status) {
    const response = await apiFetch(`/api/v1/activities/${activityId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
    });

    return mapActivity(unwrapData(response, null));
}

export async function deleteActivity(activityId) {
    const response = await apiFetch(`/api/v1/activities/${activityId}`, {
        method: 'DELETE',
    });

    return unwrapData(response, null);
}
