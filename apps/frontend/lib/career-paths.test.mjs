import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCareerPathQuery,
  careerPathName,
  mapCareerPath,
  mapCareerPathVersion,
} from "./career-paths.mjs";

test("maps draft and published career path versions independently", () => {
  const item = mapCareerPath({
    career_path_id: 12,
    faculty_id: 4,
    code: "DEV",
    status: "active",
    draft: {
      career_version_id: 21,
      revision: 3,
      status: "draft",
      name_th: "นักพัฒนาซอฟต์แวร์ฉบับร่าง",
      curricula: [{ id: 2, code: "CS", name_th: "วิทยาการคอมพิวเตอร์" }],
      competencies: [],
    },
    published: {
      career_version_id: 20,
      revision: 2,
      status: "published",
      name_th: "นักพัฒนาซอฟต์แวร์",
      name_en: "Software Developer",
      curricula: [],
      competencies: [{ id: 7, code: "COMM", name_th: "การสื่อสาร" }],
    },
  });

  assert.equal(item.id, 12);
  assert.equal(item.draftVersion.id, 21);
  assert.equal(item.publishedVersion.id, 20);
  assert.equal(item.draftVersion.curricula[0].nameTh, "วิทยาการคอมพิวเตอร์");
  assert.equal(item.publishedVersion.competencies[0].id, 7);
});

test("query omits empty filters and preserves scoped pagination parameters", () => {
  assert.equal(
    buildCareerPathQuery({ faculty_id: "4", status: "active", search: "  developer ", page: 2, page_size: 20 }),
    "faculty_id=4&status=active&search=developer&page=2&page_size=20",
  );
  assert.equal(buildCareerPathQuery({ faculty_id: "", status: "", search: "  " }), "");
});

test("English display falls back to Thai without showing internal codes", () => {
  assert.equal(
    careerPathName({ publishedNameTh: "นักวิเคราะห์ข้อมูล", code: "DATA", draftNameTh: "ร่าง" }, "en"),
    "นักวิเคราะห์ข้อมูล",
  );
  assert.equal(mapCareerPathVersion(null), null);
});
