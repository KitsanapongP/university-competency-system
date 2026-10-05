package services

import (
	"fmt"
	"strings"

	"github.com/spw32767/university-competency-system-backend/models"
)

const assessmentNarrativeSchemaVersion = "learner-assessment-output-v1.1.0"

func newAssessmentProseReport(input models.AssessmentProviderInput) models.AssessmentProseReport {
	return models.AssessmentProseReport{
		SchemaVersion: assessmentNarrativeSchemaVersion,
		Narrative: models.AssessmentReportNarrative{
			Readiness:    []models.AssessmentReportParagraph{assessmentReadinessParagraph(input)},
			Strengths:    []models.AssessmentReportParagraph{},
			Development:  []models.AssessmentReportParagraph{},
			Observations: []models.AssessmentReportParagraph{},
			DataScope:    []models.AssessmentReportParagraph{assessmentScopeParagraph(input)},
		},
	}
}

func assessmentReadinessParagraph(input models.AssessmentProviderInput) models.AssessmentReportParagraph {
	text := assessmentReadinessExplanation(input)
	refs := make([]string, 0, len(input.Readiness.Results))
	observations := make(map[string]models.AssessmentObservation)
	for _, item := range BuildAssessmentObservations(input) {
		observations[item.ObservationID] = item
	}
	details := 0
	for index, item := range input.Readiness.Results {
		ref := fmt.Sprintf("readiness:%d:%d", item.RequirementID, index)
		refs = append(refs, ref)
		// All criteria remain accessible in evidence; the prose highlights a few.
		if details >= 3 && item.Status == CooperativeCriterionMet {
			continue
		}
		nameTH := sanitizeAssessmentText(item.NameTH)
		nameEN := assessmentTextWithFallback(item.NameEN, item.NameTH)
		if item.Status == CooperativeCriterionMissing {
			text.TH += " สำหรับ" + nameTH + " ยังไม่มีข้อมูลผลการเรียนเพียงพอที่จะตรวจเกณฑ์ จึงยังสรุปว่าผ่านหรือไม่ผ่านไม่ได้"
			text.EN += " For " + nameEN + ", the available grades are insufficient to check the criterion; no met or not-met conclusion is available."
		} else if observation, exists := observations[ref]; exists {
			text.TH += " สำหรับ" + nameTH + " " + observation.Fact.TH
			text.EN += " For " + nameEN + ", " + observation.Fact.EN
		}
		details++
	}
	return models.AssessmentReportParagraph{Text: text, EvidenceRefs: refs}
}

func assessmentScopeParagraph(input models.AssessmentProviderInput) models.AssessmentReportParagraph {
	text := models.AssessmentBilingualText{
		TH: fmt.Sprintf("รายงานนี้ใช้รายวิชาและเกรดก่อนภาคเรียนที่ %d ปีการศึกษา %d รวมภาคฤดูร้อนก่อนหน้า โดยใช้เกรดดีที่สุดภายในช่วงดังกล่าว ส่วนกิจกรรมใช้ข้อมูลล่าสุดทั้งหมดที่ระบบมี", input.Semester, input.TargetYearBE),
		EN: fmt.Sprintf("This report uses courses and grades before semester %d of academic year %d, including earlier summer terms and the best grades within that period. Activities use all the latest available records.", input.Semester, input.TargetYearBE),
	}
	seen := make(map[string]bool)
	for _, item := range input.Availability {
		if item.Available && item.Reason == "" {
			continue
		}
		key := item.Source + ":" + item.Reason
		if seen[key] {
			continue
		}
		seen[key] = true
		source := assessmentSourceText(item.Source)
		reason := assessmentSourceReasonText(item.Reason)
		text.TH += " " + source.TH + ": " + reason.TH
		text.EN += " " + source.EN + ": " + reason.EN
	}
	text.TH += " ข้อมูลที่ยังไม่พร้อมไม่ได้หมายความว่าผู้เรียนไม่มีทักษะ เมื่อข้อมูลเปลี่ยนแปลงสามารถนำมาประกอบรายงานฉบับใหม่ได้"
	text.EN += " Unavailable data does not mean the learner lacks skills. Updated records can be included in a new report."
	return models.AssessmentReportParagraph{Text: text, EvidenceRefs: []string{}}
}

func assessmentSourceText(source string) models.AssessmentBilingualText {
	labels := map[string]models.AssessmentBilingualText{
		"cooperative_readiness":           {TH: "ผลตรวจความพร้อม", EN: "Readiness results"},
		"academic_grades":                 {TH: "ผลการเรียน", EN: "Academic grades"},
		"course_competency_scores":        {TH: "คะแนนสมรรถนะจากรายวิชา", EN: "Course competency scores"},
		"free_elective_competency_scores": {TH: "คะแนนสมรรถนะจากวิชาเสรี", EN: "Free elective competency scores"},
		"activity_participation":          {TH: "การเข้าร่วมกิจกรรม", EN: "Activity participation"},
		"activity_competency_scores":      {TH: "คะแนนสมรรถนะจากกิจกรรม", EN: "Activity competency scores"},
	}
	if value, ok := labels[source]; ok {
		return value
	}
	return models.AssessmentBilingualText{TH: "ข้อมูลประกอบ", EN: "Supporting data"}
}

func assessmentSourceReasonText(reason string) models.AssessmentBilingualText {
	labels := map[string]models.AssessmentBilingualText{
		"criteria_not_published":                      {TH: "ยังไม่มีชุดเกณฑ์ที่เปิดใช้งาน", EN: "No published requirement set is available."},
		"no_graded_courses_before_target":             {TH: "ยังไม่มีเกรดก่อนภาคเรียนที่เลือก", EN: "No grades are available before the selected term."},
		"template_assignment_missing":                 {TH: "ยังไม่ได้กำหนดแบบประเมินให้รุ่น", EN: "No assessment template is assigned to the cohort."},
		"active_template_missing":                     {TH: "ยังไม่มีแบบประเมินที่เปิดใช้งาน", EN: "No active assessment template is available."},
		"course_scores_recalculation_required":        {TH: "คะแนนรายวิชาต้องคำนวณใหม่", EN: "Course scores require recalculation."},
		"free_elective_scores_recalculation_required": {TH: "คะแนนวิชาเสรีต้องคำนวณใหม่", EN: "Free elective scores require recalculation."},
		"competency_mapping_missing":                  {TH: "ยังไม่ได้กำหนดสมรรถนะของรายวิชา", EN: "Course competency mappings are missing."},
		"no_mapped_course_grades_before_target":       {TH: "ยังไม่มีเกรดรายวิชาที่เชื่อมสมรรถนะก่อนภาคเรียนที่เลือก", EN: "No mapped course grades are available before the selected term."},
		"no_finalized_elective_score_evidence":        {TH: "ยังไม่มีคะแนนวิชาเสรีที่พร้อมใช้งาน", EN: "No finalized free elective score evidence is available."},
		"no_confirmed_activity_participation":         {TH: "ยังไม่มีข้อมูลยืนยันการเข้าร่วมกิจกรรม", EN: "No confirmed activity participation is available."},
		"no_finalized_activity_scores":                {TH: "ยังไม่มีคะแนนกิจกรรมที่พร้อมใช้งาน", EN: "No finalized activity scores are available."},
		"some_activity_scores_unavailable":            {TH: "คะแนนกิจกรรมบางส่วนยังไม่พร้อม", EN: "Some activity scores are unavailable."},
	}
	if value, ok := labels[reason]; ok {
		return value
	}
	return models.AssessmentBilingualText{TH: "ข้อมูลส่วนนี้ยังไม่พร้อมใช้งาน", EN: "This data source is not ready for analysis."}
}

func joinAssessmentSentences(items []models.AssessmentNarrativeSentence) models.AssessmentBilingualText {
	thai, english := make([]string, 0, len(items)), make([]string, 0, len(items))
	for _, item := range items {
		thai = append(thai, strings.TrimSpace(item.Text.TH))
		english = append(english, strings.TrimSpace(item.Text.EN))
	}
	return models.AssessmentBilingualText{TH: strings.Join(thai, " "), EN: strings.Join(english, " ")}
}
