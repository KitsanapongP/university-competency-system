export function mapCareerPathOption(option = {}) {
  return {
    id: Number(option.id || 0),
    code: option.code || "",
    nameTh: option.name_th || "",
    nameEn: option.name_en || "",
  };
}

export function mapCareerPathVersion(version) {
  if (!version) return null;
  return {
    id: Number(version.career_version_id || 0),
    revision: Number(version.revision || 0),
    status: version.status || "draft",
    nameTh: version.name_th || "",
    nameEn: version.name_en || "",
    descriptionTh: version.description_th || "",
    descriptionEn: version.description_en || "",
    skillsTh: version.skills_description_th || "",
    skillsEn: version.skills_description_en || "",
    sourceReference: version.source_reference || "",
    curricula: (version.curricula || []).map(mapCareerPathOption),
    competencies: (version.competencies || []).map(mapCareerPathOption),
    publishedAt: version.published_at || null,
  };
}

export function mapCareerPath(item = {}) {
  return {
    id: Number(item.career_path_id || 0),
    facultyId: Number(item.faculty_id || 0),
    code: item.code || "",
    status: item.status || "draft",
    draftVersion: mapCareerPathVersion(item.draft),
    publishedVersion: mapCareerPathVersion(item.published),
    draftVersionId: Number(item.draft_version_id || 0),
    draftNameTh: item.draft_name_th || "",
    draftRevision: Number(item.draft_revision || 0),
    publishedNameTh: item.published_name_th || "",
    publishedNameEn: item.published_name_en || "",
    publishedRevision: Number(item.published_revision || 0),
  };
}

export function buildCareerPathQuery(filters = {}) {
  const query = new URLSearchParams();
  for (const key of ["faculty_id", "status", "search", "page", "page_size"]) {
    const value = filters[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      query.set(key, String(value).trim());
    }
  }
  return query.toString();
}

export function careerPathName(item, language = "th") {
  if (language === "en") {
    return item?.publishedNameEn || item?.publishedNameTh || item?.draftNameTh || item?.code || "-";
  }
  return item?.publishedNameTh || item?.draftNameTh || item?.code || "-";
}

export function careerPathVersionName(version, language = "th") {
  if (language === "en") return version?.nameEn || version?.nameTh || "";
  return version?.nameTh || version?.nameEn || "";
}
