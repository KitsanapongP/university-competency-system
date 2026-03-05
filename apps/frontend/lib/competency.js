import { apiFetch } from './api';

/*
export async function fetchCompetencyDashboard() {
    return apiFetch('/api/v1/competency/dashboard');
}
*/
export async function fetchCompetencyDashboard(category) {
    const base = '/api/v1/competency/dashboard';
    const path = category ? `${base}?category=${encodeURIComponent(category)}` : base;
    return apiFetch(path);
}
