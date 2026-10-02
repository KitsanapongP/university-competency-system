import { apiFetch } from "./api";
import {
  buildCareerPathQuery,
  mapCareerPath,
} from "./career-paths.mjs";

function unwrapData(response, fallback) {
  return response?.data ?? fallback;
}

function draftPayload(form) {
  return {
    faculty_id: Number(form.facultyId),
    code: String(form.code || "").trim(),
    name_th: String(form.nameTh || "").trim(),
    name_en: String(form.nameEn || "").trim() || null,
    description_th: String(form.descriptionTh || "").trim() || null,
    description_en: String(form.descriptionEn || "").trim() || null,
    skills_description_th: String(form.skillsTh || "").trim() || null,
    skills_description_en: String(form.skillsEn || "").trim() || null,
    source_reference: String(form.sourceReference || "").trim() || null,
    curriculum_ids: (form.curriculumIds || []).map(Number),
    competency_ids: (form.competencyIds || []).map(Number),
  };
}

export async function fetchCareerPaths(filters = {}, options = {}) {
  const query = buildCareerPathQuery(filters);
  const response = await apiFetch(`/api/v1/career-paths/${query ? `?${query}` : ""}`, options);
  const data = unwrapData(response, {});
  return {
    items: (data.items || []).map(mapCareerPath),
    total: Number(data.total || 0),
    page: Number(data.page || 1),
    pageSize: Number(data.page_size || 25),
  };
}

export async function getCareerPath(careerPathId, options = {}) {
  const response = await apiFetch(`/api/v1/career-paths/${careerPathId}`, options);
  return mapCareerPath(unwrapData(response, null));
}

export async function createCareerPathDraft(form) {
  const response = await apiFetch("/api/v1/career-paths/", {
    method: "POST",
    body: JSON.stringify(draftPayload(form)),
  });
  return mapCareerPath(unwrapData(response, null));
}

export async function updateCareerPathDraft(careerPathId, expectedVersionId, form) {
  const response = await apiFetch(`/api/v1/career-paths/${careerPathId}/draft`, {
    method: "PUT",
    body: JSON.stringify({
      ...draftPayload(form),
      expected_version_id: Number(expectedVersionId || 0),
    }),
  });
  return mapCareerPath(unwrapData(response, null));
}

async function postCareerPathIDs(path, careerPathIds) {
  const response = await apiFetch(`/api/v1/career-paths/${path}`, {
    method: "POST",
    body: JSON.stringify({ career_path_ids: careerPathIds.map(Number) }),
  });
  return unwrapData(response, null);
}

export function publishCareerPaths(careerPathIds) {
  return postCareerPathIDs("publish", careerPathIds);
}

export function deactivateCareerPaths(careerPathIds) {
  return postCareerPathIDs("deactivate", careerPathIds);
}

export async function deleteCareerPath(careerPathId) {
  const response = await apiFetch(`/api/v1/career-paths/${careerPathId}`, { method: "DELETE" });
  return unwrapData(response, null);
}

export async function previewCareerPathImport(payload, options = {}) {
  const response = await apiFetch("/api/v1/career-paths/imports/preview", {
    method: "POST",
    body: JSON.stringify(payload),
    ...options,
  });
  return unwrapData(response, null);
}

export async function commitCareerPathImport(payload, previewToken) {
  const response = await apiFetch("/api/v1/career-paths/imports/commit", {
    method: "POST",
    body: JSON.stringify({ ...payload, preview_token: previewToken }),
  });
  return unwrapData(response, null);
}
