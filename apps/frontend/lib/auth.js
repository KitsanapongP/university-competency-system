import { apiFetch } from './api';

export async function login(email, password) {
  return apiFetch('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function me() {
  return apiFetch('/api/v1/auth/me');
}

export async function logout() {
  return apiFetch('/api/v1/auth/logout', {
    method: 'POST',
  });
}
