"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronRight,
  ChevronDown,
  BookOpen,
  AlertCircle,
  Check,
  Pencil,
  LockKeyhole,
  TriangleAlert,
  ExternalLink,
} from "lucide-react";

function isLeaf(cat) {
  return !cat.children?.length;
}

// ============================================================
// SpreadsheetRow
// ============================================================
function SpreadsheetRow({
  course,
  catId,
  competencies,
  weightMap,
  onUpdate,
  onDelete,
  onSetWeight,
  isNew,
  hideEditActions = false,
  isSetupMode = false,
  template,
}) {
  const codeRef = useRef(null);
  useEffect(() => {
    if (isNew) codeRef.current?.focus();
  }, [isNew]);

  const fromMaster = !!course.fromMaster;
  const locked = fromMaster || hideEditActions || template?.isActive; // master หรือ active ล็อคทุกอย่าง

  const [editing, setEditing] = useState(
    !fromMaster && !!isNew && !template?.isActive,
  );
  const [form, setForm] = useState({
    code: course.code || "",
    nameTh: course.nameTh || "",
    nameEn: course.nameEn || "",
    credits: course.credits || "",
  });

  const hasData = !!(course.code?.trim() || course.nameTh?.trim());
  const hasCompetency =
    hasData && competencies.some((c) => (Number(weightMap?.[c.id]) || 0) > 0);

  const showNoCompWarn = !isSetupMode && hasData && !hasCompetency;
  const showCoreCourseBadge = hasData && !!course.isCoreCourse;

  const handleSave = () => {
    if (!form.code.trim() && !form.nameTh.trim()) return;
    onUpdate(catId, { ...course, ...form, credits: Number(form.credits) || 0 });
    setEditing(false);
  };
  const handleKey = (e) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") {
      setForm({
        code: course.code || "",
        nameTh: course.nameTh || "",
        nameEn: course.nameEn || "",
        credits: course.credits || "",
      });
      setEditing(false);
    }
  };

  // cell click — master ไม่ให้ edit
  const handleCellClick = () => {
    if (!locked) setEditing(true);
  };

  return (
    <React.Fragment>
      <tr
        className={`ss-row ${editing ? "ss-row--editing" : ""} ${fromMaster ? "ss-row--master" : ""}`}
      >
        <td className="ss-cell ss-cell--grip">
          {fromMaster ? (
            <span
              className="ss-master-badge"
              title="วิชาจาก Curriculum Master — ไม่สามารถแก้ไขได้"
            >
              M
            </span>
          ) : (
            <GripVertical size={13} />
          )}
        </td>

        {/* รหัสวิชา */}
        <td className="ss-cell" onClick={handleCellClick}>
          {editing && !locked ? (
            <input
              ref={codeRef}
              className="ss-input"
              value={form.code}
              onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
              onKeyDown={handleKey}
              placeholder="รหัสวิชา"
            />
          ) : (
            <span className="ss-code-wrap">
              <span className="ss-code">
                {course.code || (
                  <span className="ss-placeholder">รหัสวิชา</span>
                )}
              </span>
              {showCoreCourseBadge && (
                <span className="ss-core-course-badge" title="วิชาหลัก">
                  <span style={{ fontSize: "0.65rem", color: "#fbd100" }}>
                    วิชาบังคับ
                  </span>
                </span>
              )}
              {showNoCompWarn && (
                <span
                  className="ss-no-comp-warn"
                  title="ยังไม่ได้ผูก Competency"
                >
                  <AlertCircle size={12} />
                </span>
              )}
            </span>
          )}
        </td>

        {/* ชื่อไทย */}
        <td className="ss-cell ss-cell--wide" onClick={handleCellClick}>
          {editing && !locked ? (
            <input
              className="ss-input"
              value={form.nameTh}
              onChange={(e) =>
                setForm((p) => ({ ...p, nameTh: e.target.value }))
              }
              onKeyDown={handleKey}
              placeholder="ชื่อวิชาภาษาไทย"
            />
          ) : (
            <span>
              {course.nameTh || (
                <span className="ss-placeholder">ชื่อภาษาไทย</span>
              )}
            </span>
          )}
        </td>

        {/* ชื่ออังกฤษ */}
        <td className="ss-cell ss-cell--wide" onClick={handleCellClick}>
          {editing && !locked ? (
            <input
              className="ss-input"
              value={form.nameEn}
              onChange={(e) =>
                setForm((p) => ({ ...p, nameEn: e.target.value }))
              }
              onKeyDown={handleKey}
              placeholder="English Name"
            />
          ) : (
            <span>
              {course.nameEn || (
                <span className="ss-placeholder">English Name</span>
              )}
            </span>
          )}
        </td>

        {/* หน่วยกิต */}
        <td className="ss-cell ss-cell--num" onClick={handleCellClick}>
          {editing && !locked ? (
            <input
              className="ss-input ss-input--num"
              type="number"
              min={0}
              max={12}
              value={form.credits}
              onChange={(e) =>
                setForm((p) => ({ ...p, credits: e.target.value }))
              }
              onKeyDown={handleKey}
              placeholder="0"
            />
          ) : (
            <span>
              {course.credits || <span className="ss-placeholder">0</span>}
            </span>
          )}
        </td>

        {/* Weight columns — ซ่อนใน setup mode */}
        {!isSetupMode &&
          competencies.map((comp) => {
            const stored = weightMap?.[comp.id] ?? 0;
            const active = Number(stored) > 0;
            return (
              <td
                key={comp.id}
                className="ss-cell ss-cell--weight"
                style={{ "--wc": comp.color }}
              >
                <div
                  className={`ss-weight-wrap ${active ? "ss-weight-wrap--active" : ""} ${!hasData || template?.isActive ? "ss-weight-wrap--locked" : ""}`}
                >
                  <input
                    className="ss-weight-input"
                    type="number"
                    min={0}
                    max={100}
                    value={Number(stored)}
                    disabled={!hasData || template?.isActive}
                    title={
                      template?.isActive
                        ? "ล็อคการแก้ไข (Template สถานะ Active)"
                        : !hasData
                          ? "กรอกข้อมูลวิชาก่อน"
                          : `${comp.name} weight`
                    }
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const val =
                        raw === ""
                          ? 0
                          : Math.min(100, Math.max(0, parseInt(raw, 10) || 0));
                      onSetWeight(course.id, comp.id, val);
                    }}
                  />
                  {active && <span className="ss-weight-pct">%</span>}
                </div>
              </td>
            );
          })}

        {/* Actions */}
        <td
          className="ss-cell ss-cell--actions"
          onClick={(e) => e.stopPropagation()}
        >
          {fromMaster ? (
            /* Master: ล็อค icon แทนปุ่ม */
            isSetupMode && (
              <span
                className="ss-locked-icon"
                title="วิชาจาก Curriculum Master"
              >
                <LockKeyhole size={12} />
              </span>
            )
          ) : (
            /* Custom Course: แสดงปุ่มลบได้เสมอทุกหน้า */
            <>
              {!locked &&
                (editing ? (
                  <button
                    className="icon-btn icon-btn--edit icon-btn--xs"
                    onClick={handleSave}
                  >
                    <Check size={13} />
                  </button>
                ) : (
                  <button
                    className="icon-btn icon-btn--edit icon-btn--xs"
                    onClick={() => setEditing(true)}
                  >
                    <Pencil size={12} />
                  </button>
                ))}
              {!hideEditActions && !template?.isActive && (
                <button
                  className="icon-btn icon-btn--danger icon-btn--xs"
                  onClick={() => onDelete(catId, course)}
                  title="ลบรายวิชา"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </>
          )}
        </td>
      </tr>
    </React.Fragment>
  );
}

// ============================================================
// CourseSpreadsheet
// ============================================================
function CourseSpreadsheet({
  catId,
  courses,
  competencies,
  weightsByCourseId,
  onAddCourse,
  onUpdateCourse,
  onDeleteCourse,
  onSetWeight,
  hideEditActions = false,
  isSetupMode = false,
  template,
}) {
  const colCount = 1 + 1 + 2 + 1 + (isSetupMode ? 0 : competencies.length) + 1;

  return (
    <div className="ss-wrapper">
      <div className="ss-scroll">
        <table className="ss-table">
          <thead>
            <tr>
              <th className="ss-th ss-th--grip" />
              <th className="ss-th">รหัสวิชา</th>
              <th className="ss-th ss-th--wide">ชื่อวิชา (ไทย)</th>
              <th className="ss-th ss-th--wide">ชื่อวิชา (Eng)</th>
              <th className="ss-th ss-th--num">หน่วยกิต</th>
              {/* Weight columns — ซ่อนใน setup mode */}
              {!isSetupMode &&
                competencies.map((c) => (
                  <th
                    key={c.id}
                    className="ss-th ss-th--weight"
                    style={{ "--comp-color": c.color }}
                  >
                    <span
                      className="ss-comp-dot"
                      style={{ background: c.color }}
                    />
                    <span className="ss-comp-name">{c.name}</span>
                  </th>
                ))}
              <th className="ss-th ss-th--actions" />
            </tr>
          </thead>
          <tbody>
            {courses.length === 0 && (
              <tr>
                <td colSpan={colCount} className="ss-empty">
                  ยังไม่มีรายวิชา — กดปุ่ม &quot;+ เพิ่มรายวิชา&quot; ด้านบน
                </td>
              </tr>
            )}
            {courses.map((course, i) => (
              <SpreadsheetRow
                key={course.id}
                course={course}
                catId={catId}
                competencies={competencies}
                weightMap={weightsByCourseId[course.id] || {}}
                onUpdate={onUpdateCourse}
                onDelete={onDeleteCourse}
                onSetWeight={onSetWeight}
                isNew={
                  i === courses.length - 1 && !course.code && !course.nameTh
                }
                hideEditActions={hideEditActions}
                isSetupMode={isSetupMode}
                template={template}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// Helper — เก็บ leaf categories ทั้งหมดพร้อม path
// ============================================================
function collectLeafSections(cats, coursesByCategoryId, parentPath = "") {
  const result = [];
  for (const cat of cats) {
    const path = parentPath ? `${parentPath} › ${cat.name}` : cat.name;
    if (!cat.children?.length) {
      result.push({ cat, path, courses: coursesByCategoryId[cat.id] || [] });
    } else {
      result.push(
        ...collectLeafSections(cat.children, coursesByCategoryId, path),
      );
    }
  }
  return result;
}

// ============================================================
// AllCategoriesView — แสดงทุกหมวดในครั้งเดียว
// ============================================================
// ============================================================
// GlobalCompSummary — แถบสรุป competency รวมทุกวิชาทั้งหลักสูตร
// ============================================================
function GlobalCompSummary({
  categories,
  coursesByCategoryId,
  weightsByCourseId,
  competencies,
  language = "th",
}) {
  const totals = competencies.map((comp) => {
    let core = 0;
    let bonus = 0;
    Object.values(coursesByCategoryId).forEach((courses) => {
      courses.forEach((course) => {
        const weight = Number(weightsByCourseId[course.id]?.[comp.id]) || 0;
        if (course.isCoreCourse) core += weight;
        else bonus += weight;
      });
    });
    return { comp, core, bonus };
  });

  if (totals.length === 0) return null;

  const isEnglish = language === "en";
  const copy = isEnglish
    ? {
        overview: "Weight overview",
        core: "Core",
        bonus: "Bonus",
        over: "Over",
      }
    : { overview: "ภาพรวมน้ำหนัก", core: "หลัก", bonus: "เสริม", over: "เกิน" };

  return (
    <div className="global-comp-summary">
      <span className="global-comp-summary__label">{copy.overview}</span>
      {totals.map(({ comp, core, bonus }) => {
        const isOver = core > 100;
        const displayName = isEnglish
          ? comp.nameEn || comp.nameTh || comp.name || comp.code
          : comp.nameTh || comp.name || comp.nameEn || comp.code;
        const color = comp.color || "#3b82f6";
        return (
          <div
            key={comp.id}
            className={`global-comp-chip ${isOver ? "global-comp-chip--over" : ""}`}
            style={{ "--cc": isOver ? "#f87171" : color }}
            title={`${displayName}: ${copy.core} ${core}% | ${copy.bonus} ${bonus}%`}
          >
            {isOver ? (
              <AlertCircle
                size={11}
                style={{ color: "#f87171", flexShrink: 0 }}
              />
            ) : (
              <span
                className="global-comp-chip__dot"
                style={{ background: color }}
              />
            )}
            <span className="global-comp-chip__name">{displayName}</span>
            <span className="global-comp-chip__val">
              {copy.core} {core}% / {copy.bonus} {bonus}%
            </span>
            {isOver && (
              <span className="global-comp-chip__warn">{copy.over}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AllCategoriesView({
  categories,
  coursesByCategoryId,
  competencies,
  weightsByCourseId,
  onAddCourse,
  onUpdateCourse,
  onDeleteCourse,
  onSetWeight,
  scrollToCatId,
  hideEditActions = false,
  isSetupMode = false,
  template,
}) {
  const sectionRefs = useRef({});
  const sections = collectLeafSections(categories, coursesByCategoryId);
  const colCount = 1 + 1 + 2 + 1 + (isSetupMode ? 0 : competencies.length) + 1;

  useEffect(() => {
    if (scrollToCatId && sectionRefs.current[scrollToCatId]) {
      sectionRefs.current[scrollToCatId].scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [scrollToCatId]);

  if (sections.length === 0) {
    return (
      <div className="panel-empty" style={{ padding: "3rem" }}>
        <BookOpen size={24} opacity={0.3} />
        <span>ยังไม่มีหมวดวิชา — กด &quot;+ หมวดวิชา&quot; เพื่อเริ่ม</span>
      </div>
    );
  }

  return (
    <div className="all-cat-view">
      <div className="all-cat-view__scroll">
        <table className="ss-table all-cat-table">
          <thead>
            <tr>
              <th className="ss-th ss-th--grip" />
              <th className="ss-th">รหัสวิชา</th>
              <th className="ss-th ss-th--wide">ชื่อวิชา (ไทย)</th>
              <th className="ss-th ss-th--wide">ชื่อวิชา (Eng)</th>
              <th className="ss-th ss-th--num">หน่วยกิต</th>
              {!isSetupMode &&
                competencies.map((c) => (
                  <th
                    key={c.id}
                    className="ss-th ss-th--weight"
                    style={{ "--comp-color": c.color }}
                  >
                    <span
                      className="ss-comp-dot"
                      style={{ background: c.color }}
                    />
                    <span className="ss-comp-name">{c.name}</span>
                  </th>
                ))}
              <th className="ss-th ss-th--actions" />
            </tr>
          </thead>
          <tbody>
            {sections.map(({ cat, path, courses }) => (
              <React.Fragment key={cat.id}>
                <tr
                  ref={(el) => {
                    sectionRefs.current[cat.id] = el;
                  }}
                  className="all-cat-section-hdr"
                  id={`cat-section-${cat.id}`}
                >
                  <td colSpan={colCount} className="all-cat-section-hdr__cell">
                    <div className="all-cat-section-hdr__inner">
                      <span className="cat-section__code">{cat.code}</span>
                      <span className="cat-section__name">
                        {cat.name || (
                          <em style={{ color: "#475569" }}>ยังไม่ตั้งชื่อ</em>
                        )}
                      </span>
                      <span className="cat-section__path">{path}</span>
                      {!template?.isActive && (
                        <button
                          className="btn btn--primary btn--sm cat-section__add-btn"
                          onClick={() =>
                            onAddCourse(cat.id, {
                              code: "",
                              nameTh: "",
                              nameEn: "",
                              credits: 0,
                            })
                          }
                        >
                          <Plus size={12} /> เพิ่มรายวิชา
                        </button>
                      )}
                    </div>
                  </td>
                </tr>

                {courses.length === 0 ? (
                  <tr key={`empty-${cat.id}`}>
                    <td
                      colSpan={colCount}
                      className="ss-empty cat-section__empty"
                    >
                      ยังไม่มีรายวิชา
                    </td>
                  </tr>
                ) : (
                  courses.map((course, i) => (
                    <SpreadsheetRow
                      key={course.id}
                      course={course}
                      catId={cat.id}
                      competencies={competencies}
                      weightMap={weightsByCourseId[course.id] || {}}
                      onUpdate={onUpdateCourse}
                      onDelete={onDeleteCourse}
                      onSetWeight={onSetWeight}
                      isNew={
                        i === courses.length - 1 &&
                        !course.code &&
                        !course.nameTh
                      }
                      hideEditActions={hideEditActions}
                      isSetupMode={isSetupMode}
                      template={template}
                    />
                  ))
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TreeItem({
  cat,
  depth = 0,
  selectedId,
  coursesByCategoryId,
  creditMap,
  onSelect,
  onRename,
  onCreateChild,
  onDelete,
  hideActions = false,
}) {
  const [expanded, setExpanded] = useState(true);
  const fromMaster = !!cat.fromMaster;

  const [renaming, setRenaming] = useState(!fromMaster && (cat.isNew || false));
  const [nameVal, setNameVal] = useState(cat.name);
  const inputRef = useRef(null);
  useEffect(() => {
    if (renaming) inputRef.current?.focus();
  }, [renaming]);

  const courseCount = (coursesByCategoryId[cat.id] || []).length;
  const credits = creditMap?.[cat.id] ?? 0;
  const leaf = isLeaf(cat);
  const hasChildren = !!cat.children?.length;

  const confirm = () => {
    onRename(cat.id, nameVal || "หมวดใหม่");
    setRenaming(false);
  };

  return (
    <div className="tree-item-wrap">
      <div
        className={`tree-item ${selectedId === cat.id ? "tree-item--selected" : ""} ${fromMaster ? "tree-item--master" : ""}`}
        style={{ paddingLeft: `${0.5 + depth * 1}rem` }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(cat);
          if (hasChildren) setExpanded((p) => !p);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          // master ห้าม rename
          if (!fromMaster && !hideActions) {
            setRenaming(true);
            setNameVal(cat.name);
          }
        }}
      >
        <span className="tree-toggle">
          {hasChildren ? (
            expanded ? (
              <ChevronDown size={13} />
            ) : (
              <ChevronRight size={13} />
            )
          ) : (
            <span style={{ width: 13 }} />
          )}
        </span>

        {renaming ? (
          <input
            ref={inputRef}
            className="tree-name-input"
            value={nameVal}
            onChange={(e) => setNameVal(e.target.value)}
            onBlur={confirm}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirm();
              if (e.key === "Escape") setRenaming(false);
              e.stopPropagation();
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className={`tree-label ${fromMaster ? "tree-label--master" : ""}`}
          >
            {cat.code}{" "}
            {cat.name || <em style={{ color: "#64748b" }}>ยังไม่ตั้งชื่อ</em>}
          </span>
        )}

        <div className="tree-item__meta">
          {leaf && courseCount > 0 && (
            <span className="tree-course-badge">{courseCount} วิชา</span>
          )}
          {credits > 0 && (
            <span className="tree-credits tree-credits--live">
              {credits} หน่วยกิต
            </span>
          )}
        </div>

        <div
          className="tree-item__actions"
          onClick={(e) => e.stopPropagation()}
        >
          {fromMaster ? (
            /* Master: ล็อค icon + อนุญาตให้เพิ่มหมวดย่อยได้เฉพาะถ้ายังไม่มีรายวิชาอยู่ข้างใน */
            <>
              {depth < 3 && courseCount === 0 && (
                <button
                  className="icon-btn icon-btn--xs"
                  title="เพิ่มหมวดย่อยใหม่ (ไม่ใช่ Master)"
                  onClick={() => onCreateChild(cat)}
                >
                  <Plus size={12} />
                </button>
              )}
              <span
                className="tree-master-lock"
                title="หมวดวิชาจาก Curriculum Master — ไม่สามารถแก้ไขหรือลบได้"
              >
                <LockKeyhole size={12} />
              </span>
            </>
          ) : (
            /* Non-master (Custom Category): ปุ่มเพิ่มหมวดย่อย (ถ้ายังไม่มีวิชา) + ปุ่มลบเสมอทุกหน้า */
            <>
              {depth < 2 && courseCount === 0 && (
                <button
                  className="icon-btn icon-btn--xs"
                  title="เพิ่มหมวดย่อย"
                  onClick={() => onCreateChild(cat)}
                >
                  <Plus size={12} />
                </button>
              )}
              <button
                className="icon-btn icon-btn--danger icon-btn--xs"
                title="ลบหมวดวิชา"
                onClick={() => onDelete(cat)}
              >
                <Trash2 size={12} />
              </button>
            </>
          )}
        </div>
      </div>

      {expanded && hasChildren && (
        <div className="tree-children">
          {cat.children.map((child) => (
            <TreeItem
              key={child.id}
              cat={child}
              depth={depth + 1}
              selectedId={selectedId}
              coursesByCategoryId={coursesByCategoryId}
              creditMap={creditMap}
              onSelect={onSelect}
              onRename={onRename}
              onCreateChild={onCreateChild}
              onDelete={onDelete}
              hideActions={hideActions}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// CategoryCoursePanel — Panel 2
// ============================================================
export default function CategoryCoursePanel({
  template,
  categories = [],
  selectedCategory,
  coursesByCategoryId = {},
  weightsByCourseId = {},
  competencies = [],
  creditMap = {},
  onSelectCategory,
  onDeselectCategory,
  onCreateCategory,
  onRenameCategory,
  onDeleteCategory,
  onAddCourse,
  onUpdateCourse,
  onDeleteCourse,
  onToggleCompetency,
  onSetWeight,
  mode = "setup",
}) {
  const [viewMode, setViewMode] = useState("single");
  const [scrollToCatId, setScrollToCatId] = useState(null);

  const isWeightMode = mode === "weight";

  const leaf = selectedCategory && isLeaf(selectedCategory);
  const courses = selectedCategory
    ? coursesByCategoryId[selectedCategory.id] || []
    : [];

  const handleSelectInAll = (cat) => {
    onSelectCategory(cat);
    setScrollToCatId(cat.id);
    setTimeout(() => setScrollToCatId(null), 800);
  };

  return (
    <div className="tm-panel ccp-panel">
      {!template ? (
        <div className="panel-empty">เลือก Template ก่อน</div>
      ) : (
        <div className="ccp-body" style={{ flexDirection: "column" }}>
          {template?.isActive && (
            <div
              className="ccp-active-warning"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
                background: "#fef2f2",
                border: "1px solid #f87171",
                color: "#b91c1c",
                padding: "0.75rem 1rem",
                margin: "0.75rem 1rem 0 1rem",
                borderRadius: "8px",
                fontSize: "0.9rem",
                fontWeight: 500,
                flexShrink: 0,
              }}
            >
              <TriangleAlert size={18} style={{ flexShrink: 0 }} />
              <span>
                <b>Template มีสถานะพร้อมใช้งาน (Active)</b> :
                ระบบล็อคการแก้ไขค่าน้ำหนักและโครงสร้างรายวิชา
                กรุณาเปลี่ยนสถานะเป็น <b>&quot;ปิดใช้งาน&quot;</b> ที่แท็บ
                &quot;ภาพรวมสมรรถนะ&quot; ก่อนแก้ไขข้อมูล
              </span>
            </div>
          )}
          <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
            {/* ── Tree sidebar ── */}
            <div className="ccp-tree">
              <div className="ccp-tree__header">
                <span>โครงสร้างหมวดวิชา</span>
                <button
                  className="btn btn--primary btn--sm ccp-tree__add-btn"
                  disabled={template?.isActive}
                  style={{
                    opacity: template?.isActive ? 0.5 : 1,
                    cursor: template?.isActive ? "not-allowed" : "pointer",
                  }}
                  onClick={() =>
                    !template?.isActive &&
                    onCreateCategory(selectedCategory?.id ?? null)
                  }
                  title="เพิ่มหมวดวิชา"
                >
                  <Plus size={12} /> หมวดวิชา
                </button>
              </div>
              {/* คลิกพื้นที่ว่างใน scroll → deselect */}
              <div
                className="ccp-tree__scroll"
                onClick={() => onDeselectCategory?.()}
              >
                {categories.length === 0 ? (
                  <div className="panel-empty panel-empty--sm">
                    กด &quot;+ หมวดวิชา&quot; เพื่อเริ่ม
                  </div>
                ) : (
                  categories.map((cat) => (
                    <TreeItem
                      key={cat.id}
                      cat={cat}
                      selectedId={selectedCategory?.id}
                      coursesByCategoryId={coursesByCategoryId}
                      creditMap={creditMap}
                      onSelect={(c) => {
                        if (viewMode === "all") handleSelectInAll(c);
                        else onSelectCategory(c);
                      }}
                      onRename={onRenameCategory}
                      onCreateChild={(parent) => onCreateCategory(parent.id)}
                      onDelete={onDeleteCategory}
                      hideActions={isWeightMode}
                    />
                  ))
                )}
              </div>
            </div>

            {/* ── Sheet area ── */}
            <div className="ccp-sheet">
              {/* Sheet toolbar */}
              <div className="ccp-sheet__toolbar">
                <div className="view-toggle">
                  <button
                    className={`view-toggle__btn ${viewMode === "single" ? "view-toggle__btn--active" : ""}`}
                    onClick={() => setViewMode("single")}
                  >
                    หมวดที่เลือก
                  </button>
                  <button
                    className={`view-toggle__btn ${viewMode === "all" ? "view-toggle__btn--active" : ""}`}
                    onClick={() => setViewMode("all")}
                  >
                    ดูทั้งหมด
                  </button>
                </div>

                <GlobalCompSummary
                  categories={categories}
                  coursesByCategoryId={coursesByCategoryId}
                  weightsByCourseId={weightsByCourseId}
                  competencies={competencies}
                />

                <div
                  style={{
                    marginLeft: "auto",
                    display: "flex",
                    gap: "0.4rem",
                    flexShrink: 0,
                  }}
                >
                  {/* จัดการ Competency — แสดงทุกเฉพาะหน้าตั้งค่า Weight */}
                  {isWeightMode && (
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      onClick={() =>
                        window.open(
                          "/competency-management",
                          "_blank",
                          "noopener,noreferrer",
                        )
                      }
                    >
                      <ExternalLink size={13} /> จัดการสมรรถนะ
                    </button>
                  )}
                  {leaf && viewMode === "single" && (
                    <button
                      className="btn btn--primary btn--sm"
                      onClick={() =>
                        onAddCourse(selectedCategory.id, {
                          code: "",
                          nameTh: "",
                          nameEn: "",
                          credits: 0,
                        })
                      }
                    >
                      <Plus size={13} /> เพิ่มรายวิชา
                    </button>
                  )}
                </div>
              </div>

              {/* ── All-view ── */}
              {viewMode === "all" ? (
                <AllCategoriesView
                  categories={categories}
                  coursesByCategoryId={coursesByCategoryId}
                  competencies={competencies}
                  weightsByCourseId={weightsByCourseId}
                  onAddCourse={onAddCourse}
                  onUpdateCourse={onUpdateCourse}
                  onDeleteCourse={onDeleteCourse}
                  onSetWeight={onSetWeight}
                  scrollToCatId={scrollToCatId}
                  hideEditActions={isWeightMode}
                  isSetupMode={!isWeightMode}
                  template={template}
                />
              ) : !selectedCategory ? (
                <div className="panel-empty">
                  <BookOpen size={22} opacity={0.3} />
                  <span>เลือกหมวดวิชาเพื่อดูรายวิชา</span>
                </div>
              ) : !leaf ? (
                <div className="panel-empty">
                  <AlertCircle size={20} opacity={0.35} />
                  <span>เพิ่มรายวิชาได้เฉพาะหมวดวิชาที่ไม่มีหมวดย่อย</span>
                </div>
              ) : (
                <div className="ccp-sheet__inner">
                  <div className="ccp-sheet__header">
                    <div className="ccp-sheet__header-left">
                      <span className="ccp-sheet__cat">
                        {selectedCategory.code} {selectedCategory.name}
                      </span>
                      <span className="ccp-sheet__hint">
                        {isWeightMode
                          ? "ใส่ค่าน้ำหนักของแต่ละสมรรถนะในวิชา"
                          : "คลิกเลือกเพื่อแก้ไขหรือกรอกข้อมูลวิชาก่อนถึงจะใส่ค่าน้ำหนักได้"}
                      </span>
                    </div>
                  </div>
                  <CourseSpreadsheet
                    catId={selectedCategory.id}
                    courses={courses}
                    competencies={competencies}
                    weightsByCourseId={weightsByCourseId}
                    onAddCourse={onAddCourse}
                    onUpdateCourse={onUpdateCourse}
                    onDeleteCourse={onDeleteCourse}
                    onSetWeight={onSetWeight}
                    hideEditActions={isWeightMode}
                    isSetupMode={isWeightMode ? false : true}
                    template={template}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { GlobalCompSummary as TemplateWeightSummary };
