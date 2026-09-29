import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSidebarGroups,
  SIDEBAR_GROUPS,
  SIDEBAR_MENU_CONFIG,
} from "./sidebar-navigation.mjs";

const expectedMenuIds = {
  officer: [
    "major-management",
    "curriculum-management",
    "student-management",
    "competency-management",
    "template-management",
    "template-assignments",
    "activity-management",
    "free-elective-management",
    "free-elective-management/groups",
  ],
  admin: [
    "dashboard",
    "executive-management",
    "major-management",
    "student-management",
    "competency-management",
    "template-assignments",
    "activity-management",
    "free-elective-management",
    "free-elective-management/groups",
    "users",
    "settings",
  ],
};

test("Officer and Admin keep their existing routes without duplicate IDs", () => {
  for (const role of Object.keys(expectedMenuIds)) {
    const menu = SIDEBAR_MENU_CONFIG[role];
    const ids = menu.map(({ id }) => id);

    assert.deepEqual(ids, expectedMenuIds[role]);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(menu.every((item) => item.groupKey));
  }
});

test("role menus form three Officer groups and five Admin groups in prototype order", () => {
  const translate = (key) => key;
  const officerGroups = buildSidebarGroups(SIDEBAR_MENU_CONFIG.officer, translate);
  const adminGroups = buildSidebarGroups(SIDEBAR_MENU_CONFIG.admin, translate);

  assert.deepEqual(
    officerGroups.map(({ id }) => id),
    ["academic", "assessment", "supplementary"],
  );
  assert.deepEqual(
    adminGroups.map(({ id }) => id),
    ["overview", "academic", "assessment", "supplementary", "system"],
  );
  assert.equal(officerGroups.length, 3);
  assert.equal(adminGroups.length, 5);
  assert.ok(SIDEBAR_GROUPS.every(({ labelKey }) => labelKey));
});

test("empty groups are omitted and group labels use the active language", () => {
  const translate = (key) => `translated:${key}`;
  const groups = buildSidebarGroups(
    [SIDEBAR_MENU_CONFIG.officer[0]],
    translate,
  );

  assert.equal(groups.length, 1);
  assert.equal(groups[0].label, "translated:sidebar_group_academic");
  assert.deepEqual(groups[0].items, [SIDEBAR_MENU_CONFIG.officer[0]]);
});
