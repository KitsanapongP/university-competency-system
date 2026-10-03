function localizedValue(value, language, fallback = '') {
  if (typeof value === 'string') return value.trim() || fallback;
  const english = String(value?.en || '').trim();
  const thai = String(value?.th || '').trim();
  return language === 'en' ? english || thai || fallback : thai || english || fallback;
}

function courseLabel(course, language) {
  if (!course) return '';
  const name = localizedValue({ th: course.course_name_th, en: course.course_name_en }, language);
  const details = [course.grade, course.academic_year_be && String(course.academic_year_be)]
    .filter(Boolean)
    .join(' · ');
  return [course.course_code, name, details].filter(Boolean).join(' · ');
}

export function buildAssessmentEvidenceCatalog(sourceSnapshot, language, weightedPointsLabel) {
  const input = sourceSnapshot?.provider_input;
  const catalog = new Map();
  if (!input) return catalog;

  const add = (reference, title) => {
    if (reference && title) catalog.set(reference, title);
  };
  const coursesByReference = new Map();

  (input.readiness?.results || []).forEach((criterion, index) => {
    const name = localizedValue({ th: criterion.name_th, en: criterion.name_en }, language);
    const current = criterion.current_grade ?? criterion.current_value;
    const minimum = criterion.required_grade ?? criterion.required_value;
    const labels = language === 'en' ? ['Current', 'Minimum'] : ['ค่าปัจจุบัน', 'ค่าขั้นต่ำ'];
    const details = current != null && minimum != null
      ? `${labels[0]}: ${current}; ${labels[1]}: ${minimum}`
      : '';
    add(`readiness:${criterion.requirement_id || 0}:${index}`, [name, details].filter(Boolean).join(' / '));
  });

  (input.academic_evidence || []).forEach((course) => {
    coursesByReference.set(course.evidence_ref, course);
    add(course.evidence_ref, courseLabel(course, language));
  });

  (sourceSnapshot.source?.academic_evidence || []).forEach((course) => {
    add(course.evidence_ref, courseLabel(course, language));
  });

  (input.competency_scores || []).forEach((competency) => {
    const competencyName = localizedValue({ th: competency.name_th, en: competency.name_en }, language);
    add(competency.competency_ref, competencyName);
    (competency.course_scores || []).forEach((score) => {
      const course = coursesByReference.get(score.course_evidence_ref) || score;
      const label = courseLabel(course, language);
      const scoreParts = [
        label,
        `${score.weighted_score ?? 0} ${weightedPointsLabel}`,
        competencyName,
      ].filter(Boolean);
      add(score.evidence_ref, scoreParts.join(' · '));
      if (!coursesByReference.has(score.course_evidence_ref)) {
        add(score.course_evidence_ref, label);
      }
    });
  });

  (input.activity_evidence || []).forEach((activity) => {
    const name = localizedValue({ th: activity.activity_name_th, en: activity.activity_name_en }, language);
    const details = [activity.start_at?.slice(0, 10), activity.earned_percent != null ? `${activity.earned_percent}%` : '']
      .filter(Boolean)
      .join(' · ');
    const title = [name, details].filter(Boolean).join(' · ');
    add(activity.evidence_ref, title);
    add(activity.score_evidence_ref, title);
  });

  return catalog;
}

export function expandAssessmentEvidenceReferences(references, provenance = {}) {
  return [...new Set((references || []).flatMap((reference) => {
    const originals = provenance[reference];
    return Array.isArray(originals) && originals.length ? originals : [reference];
  }))];
}
