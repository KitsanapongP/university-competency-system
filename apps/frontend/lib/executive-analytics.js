import { apiFetch } from './api';

function queryString(filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') params.set(key, value);
    });
    const query = params.toString();
    return query ? `?${query}` : '';
}

function unwrap(response) {
    return response?.data ?? response;
}

export async function fetchExecutiveScope(filters = {}) {
    return unwrap(await apiFetch(`/api/v1/executive-analytics/scopes${queryString(filters)}`));
}

export async function fetchExecutiveOverview(filters = {}) {
    return unwrap(await apiFetch(`/api/v1/executive-analytics/overview${queryString(filters)}`));
}

export async function fetchExecutiveCompetency(competencyId, filters = {}) {
    return unwrap(await apiFetch(`/api/v1/executive-analytics/competencies/${competencyId}${queryString(filters)}`));
}

export async function fetchExecutiveComparison(filters = {}) {
    return unwrap(await apiFetch(`/api/v1/executive-analytics/comparison${queryString(filters)}`));
}

export async function fetchExecutiveStudents(filters = {}) {
    return unwrap(await apiFetch(`/api/v1/executive-analytics/students${queryString(filters)}`));
}

export async function fetchExecutiveStudent(enrollmentId, filters = {}) {
    return unwrap(await apiFetch(`/api/v1/executive-analytics/students/${enrollmentId}${queryString(filters)}`));
}
