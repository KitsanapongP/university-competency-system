export const SIDEBAR_GROUPS = [
  { id: "overview", labelKey: "sidebar_group_overview" },
  { id: "academic", labelKey: "sidebar_group_academic" },
  { id: "assessment", labelKey: "sidebar_group_assessment" },
  { id: "supplementary", labelKey: "sidebar_group_supplementary" },
  { id: "system", labelKey: "sidebar_group_system" },
];

export const SIDEBAR_MENU_CONFIG = {
  officer: [
    {
      id: "major-management",
      iconKey: "GraduationCap",
      labelKey: "major_management",
      groupKey: "academic",
    },
    {
      id: "curriculum-management",
      iconKey: "BookOpen",
      labelKey: "curriculum_management",
      groupKey: "academic",
    },
    {
      id: "career-management",
      iconKey: "BriefcaseBusiness",
      labelKey: "career_management",
      groupKey: "academic",
    },
    {
      id: "student-management",
      iconKey: "Users",
      labelKey: "student_management",
      groupKey: "academic",
    },
    {
      id: "competency-management",
      iconKey: "ShieldCheck",
      labelKey: "competency_management",
      groupKey: "assessment",
    },
    {
      id: "template-management",
      iconKey: "ClipboardList",
      labelKey: "templates",
      groupKey: "assessment",
    },
    {
      id: "template-assignments",
      iconKey: "Link2",
      labelKey: "sidebar_template_assignments",
      groupKey: "assessment",
    },
    {
      id: "activity-management",
      iconKey: "CalendarDays",
      labelKey: "activity_management",
      groupKey: "supplementary",
    },
    {
      id: "free-elective-management",
      iconKey: "LibraryBig",
      labelKey: "free_elective_management",
      groupKey: "supplementary",
    },
    {
      id: "free-elective-management/groups",
      iconKey: "UserRoundSearch",
      labelKey: "free_elective_students",
      groupKey: "supplementary",
    },
  ],
  admin: [
    {
      id: "dashboard",
      iconKey: "LayoutDashboard",
      labelKey: "dashboard",
      groupKey: "overview",
    },
    {
      id: "executive-management",
      iconKey: "BarChart3",
      labelKey: "executive_analytics",
      groupKey: "overview",
    },
    {
      id: "major-management",
      iconKey: "GraduationCap",
      labelKey: "major_management",
      groupKey: "academic",
    },
    {
      id: "career-management",
      iconKey: "BriefcaseBusiness",
      labelKey: "career_management",
      groupKey: "academic",
    },
    {
      id: "student-management",
      iconKey: "Users",
      labelKey: "student_management",
      groupKey: "academic",
    },
    {
      id: "competency-management",
      iconKey: "ShieldCheck",
      labelKey: "competency_management",
      groupKey: "assessment",
    },
    {
      id: "template-assignments",
      iconKey: "Link2",
      labelKey: "template_assignments",
      groupKey: "assessment",
    },
    {
      id: "activity-management",
      iconKey: "CalendarDays",
      labelKey: "activity_management",
      groupKey: "supplementary",
    },
    {
      id: "free-elective-management",
      iconKey: "LibraryBig",
      labelKey: "free_elective_management",
      groupKey: "supplementary",
    },
    {
      id: "free-elective-management/groups",
      iconKey: "UserRoundSearch",
      labelKey: "free_elective_students",
      groupKey: "supplementary",
    },
    {
      id: "users",
      iconKey: "UserRoundCog",
      labelKey: "users",
      groupKey: "system",
    },
    {
      id: "settings",
      iconKey: "Settings",
      labelKey: "settings",
      groupKey: "system",
    },
  ],
};

export function buildSidebarGroups(items, translate) {
  return SIDEBAR_GROUPS.map((group) => ({
    ...group,
    label: translate(group.labelKey),
    items: items.filter((item) => item.groupKey === group.id),
  })).filter((group) => group.items.length > 0);
}

export function resolveActiveSidebarItem(items, activeItem) {
  if (typeof activeItem !== "string") return undefined;

  const exactMatch = items.find((item) => item.id === activeItem);
  if (exactMatch) return exactMatch.id;

  return items
    .filter((item) => activeItem.startsWith(`${item.id}/`))
    .sort((left, right) => right.id.length - left.id.length)[0]?.id;
}
