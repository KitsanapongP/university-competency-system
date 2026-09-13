"use client";

import { useCallback, useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const SIDE_NAMES = ["left", "right"];
const FIELD_NAMES = ["faculty_id", "major_id", "curriculum_id", "cohort_id"];
const LEGACY_FILTER_NAMES = [
  "faculty_id",
  "major_id",
  "curriculum_id",
  "cohort_id",
  "entry_year_be",
];

function emptySide() {
  return {
    faculty_id: "",
    major_id: "",
    curriculum_id: "",
    cohort_id: "",
  };
}

function emptySelection() {
  return {
    left: emptySide(),
    right: emptySide(),
  };
}

function validID(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : "";
}

function asID(value) {
  return validID(value);
}

function scopeItems(scope, key) {
  return Array.isArray(scope?.[key]) ? scope[key] : [];
}

export function readComparisonSelection(searchParams) {
  const selection = emptySelection();
  SIDE_NAMES.forEach((side) => {
    FIELD_NAMES.forEach((field) => {
      selection[side][field] = validID(
        searchParams?.get(`${side}_${field}`),
      );
    });
  });
  return selection;
}

export function selectionEquals(left, right) {
  return SIDE_NAMES.every((side) =>
    FIELD_NAMES.every(
      (field) => left?.[side]?.[field] === right?.[side]?.[field],
    ),
  );
}

function cohortOption(scope, cohortID) {
  return scopeItems(scope, "cohorts").find(
    (item) => String(item.cohort_id) === validID(cohortID),
  );
}

function chooseDefaultCohorts(scope, user) {
  const cohorts = scopeItems(scope, "cohorts").filter((item) => item.ready);
  const preferredFaculty = validID(user?.faculty_id);
  const preferred = preferredFaculty
    ? cohorts.filter((item) => String(item.faculty_id) === preferredFaculty)
    : [];
  const candidates = (preferred.length >= 2 ? preferred : cohorts).sort(
    (left, right) =>
      Number(right.entry_year_be || 0) - Number(left.entry_year_be || 0) ||
      Number(right.cohort_id || 0) - Number(left.cohort_id || 0),
  );
  return [candidates[0], candidates[1]].filter(Boolean);
}

export function selectionFromCohorts(cohorts = []) {
  return cohorts.reduce(
    (selection, cohort, index) => {
      const side = SIDE_NAMES[index];
      if (!side || !cohort) return selection;
      selection[side] = {
        faculty_id: asID(cohort.faculty_id),
        major_id: asID(cohort.major_id),
        curriculum_id: asID(cohort.curriculum_id),
        cohort_id: asID(cohort.cohort_id),
      };
      return selection;
    },
    emptySelection(),
  );
}

function normalizeSide(side, scope, isDean) {
  const next = { ...emptySide(), ...(side || {}) };
  const cohorts = scopeItems(scope, "cohorts");
  const selectedCohort = cohortOption(scope, next.cohort_id);
  if (selectedCohort) {
    next.faculty_id = asID(selectedCohort.faculty_id);
    next.major_id = asID(selectedCohort.major_id);
    next.curriculum_id = asID(selectedCohort.curriculum_id);
  }

  const facultyIDs = new Set(
    scopeItems(scope, "faculties").map((item) => String(item.faculty_id)),
  );
  if (isDean) {
    next.faculty_id = asID(cohorts[0]?.faculty_id || next.faculty_id);
  } else if (next.faculty_id && !facultyIDs.has(next.faculty_id)) {
    next.faculty_id = "";
  }

  const major = scopeItems(scope, "majors").find(
    (item) =>
      String(item.major_id) === next.major_id &&
      (!next.faculty_id || String(item.faculty_id) === next.faculty_id),
  );
  if (!major) next.major_id = "";

  const curriculum = scopeItems(scope, "curricula").find(
    (item) =>
      String(item.curriculum_id) === next.curriculum_id &&
      (!next.major_id || String(item.major_id) === next.major_id) &&
      (!next.faculty_id || String(item.faculty_id) === next.faculty_id),
  );
  if (!curriculum) next.curriculum_id = "";

  const validCohort = cohorts.find(
    (item) =>
      String(item.cohort_id) === next.cohort_id &&
      (!next.curriculum_id ||
        String(item.curriculum_id) === next.curriculum_id),
  );
  if (!validCohort) next.cohort_id = "";
  return next;
}

export function normalizeComparisonSelection(selection, scope, isDean) {
  return {
    left: normalizeSide(selection?.left, scope, isDean),
    right: normalizeSide(selection?.right, scope, isDean),
  };
}

function putSelectionInURL(router, pathname, searchParams, selection) {
  const params = new URLSearchParams(searchParams?.toString() || "");
  LEGACY_FILTER_NAMES.forEach((name) => params.delete(name));
  SIDE_NAMES.forEach((side) => {
    FIELD_NAMES.forEach((field) => {
      const value = selection?.[side]?.[field];
      const key = `${side}_${field}`;
      if (value) params.set(key, value);
      else params.delete(key);
    });
  });
  const query = params.toString();
  router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
}

export function comparisonOptions(scope, selection, side, isDean) {
  const current = selection?.[side] || emptySide();
  const faculties = scopeItems(scope, "faculties");
  const majors = scopeItems(scope, "majors").filter(
    (item) =>
      !current.faculty_id || String(item.faculty_id) === current.faculty_id,
  );
  const curricula = scopeItems(scope, "curricula").filter(
    (item) =>
      (!current.faculty_id || String(item.faculty_id) === current.faculty_id) &&
      (!current.major_id || String(item.major_id) === current.major_id),
  );
  const cohorts = scopeItems(scope, "cohorts").filter(
    (item) =>
      (!current.faculty_id || String(item.faculty_id) === current.faculty_id) &&
      (!current.major_id || String(item.major_id) === current.major_id) &&
      (!current.curriculum_id ||
        String(item.curriculum_id) === current.curriculum_id),
  );
  return {
    faculties: isDean ? [] : faculties,
    majors,
    curricula,
    cohorts,
  };
}

export function useExecutiveComparisonSelection({ scope, scopeLoading, user }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isDean = user?.roles?.includes("dean");
  const urlSelection = useMemo(
    () => readComparisonSelection(searchParams),
    [searchParams],
  );
  const selection = useMemo(() => {
    const requested = normalizeComparisonSelection(urlSelection, scope, isDean);
    const defaults = selectionFromCohorts(chooseDefaultCohorts(scope, user));
    const hasSelection = (side) =>
      Object.values(side || {}).some((value) => Boolean(value));
    return {
      left: hasSelection(requested.left) ? requested.left : defaults.left,
      right: hasSelection(requested.right) ? requested.right : defaults.right,
    };
  }, [isDean, scope, urlSelection, user]);

  useEffect(() => {
    if (!scopeLoading && !selectionEquals(urlSelection, selection)) {
      putSelectionInURL(router, pathname, searchParams, selection);
    }
  }, [
    pathname,
    router,
    scopeLoading,
    searchParams,
    selection,
    urlSelection,
  ]);

  const updateSide = useCallback(
    (side, field, value) => {
      const next = {
        left: { ...selection.left },
        right: { ...selection.right },
      };
      const nextSide = next[side];
      nextSide[field] = value;
      if (field === "faculty_id") {
        nextSide.major_id = "";
        nextSide.curriculum_id = "";
        nextSide.cohort_id = "";
      }
      if (field === "major_id") {
        nextSide.curriculum_id = "";
        nextSide.cohort_id = "";
      }
      if (field === "curriculum_id") nextSide.cohort_id = "";
      putSelectionInURL(router, pathname, searchParams, next);
    },
    [pathname, router, searchParams, selection],
  );

  const swap = useCallback(() => {
    const next = { left: selection.right, right: selection.left };
    putSelectionInURL(router, pathname, searchParams, next);
  }, [pathname, router, searchParams, selection]);

  return {
    initialized: !scopeLoading,
    selection,
    updateSide,
    swap,
  };
}
