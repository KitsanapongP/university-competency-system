package services

import (
	"fmt"
	"github.com/spw32767/university-competency-system-backend/models"
)

// BuildAssessmentObservations never assigns an ability threshold to grades or weighted contributions.
func BuildAssessmentObservations(input models.AssessmentProviderInput) []models.AssessmentObservation {
	items := make([]models.AssessmentObservation, 0)
	add := func(id, kind string, title, fact models.AssessmentBilingualText, refs ...string) *models.AssessmentObservation {
		items = append(items, models.AssessmentObservation{ObservationID: id, Kind: kind, Title: title, Fact: fact, EvidenceRefs: refs})
		return &items[len(items)-1]
	}
	for index, result := range input.Readiness.Results {
		kind := "neutral"
		switch result.Status {
		case CooperativeCriterionMet:
			kind = "strength"
		case CooperativeCriterionNotMet:
			kind = "limitation"
		default:
			continue // Missing grades or unavailable criteria are not personal limitations.
		}
		id := fmt.Sprintf("readiness:%d:%d", result.RequirementID, index)
		title := models.AssessmentBilingualText{TH: result.NameTH, EN: assessmentTextWithFallback(result.NameEN, result.NameTH)}
		if title.TH == "" {
			title = models.AssessmentBilingualText{TH: "เกณฑ์ความพร้อม", EN: "Readiness criterion"}
		}
		fact := models.AssessmentBilingualText{TH: "ถึงเกณฑ์ที่หลักสูตรกำหนดแล้ว", EN: "Meets the curriculum requirement."}
		if kind == "limitation" {
			fact = models.AssessmentBilingualText{TH: "ยังไม่ถึงเกณฑ์ที่หลักสูตรกำหนด", EN: "Does not yet meet the curriculum requirement."}
		}
		if result.CurrentValue != nil && result.RequiredValue != nil {
			fact.TH += fmt.Sprintf(" ค่าปัจจุบัน %.2f; ค่าขั้นต่ำ %.2f", *result.CurrentValue, *result.RequiredValue)
			fact.EN += fmt.Sprintf(" Current value %.2f; minimum %.2f.", *result.CurrentValue, *result.RequiredValue)
		} else if result.CurrentGrade != nil && result.RequiredGrade != nil {
			fact.TH += fmt.Sprintf(" เกรดปัจจุบัน %s; เกรดขั้นต่ำ %s", *result.CurrentGrade, *result.RequiredGrade)
			fact.EN += fmt.Sprintf(" Current grade %s; minimum grade %s.", *result.CurrentGrade, *result.RequiredGrade)
		}
		item := add(id, kind, title, fact, id)
		item.FactType = "readiness"
		item.Values = models.AssessmentFactValues{CriterionType: result.CriterionType, Status: result.Status, CurrentValue: result.CurrentValue, RequiredValue: result.RequiredValue, CurrentGrade: result.CurrentGrade, RequiredGrade: result.RequiredGrade}
	}
	items = append(items, buildAcademicSummaryObservations(input.AcademicEvidence)...)
	for _, competency := range input.CompetencyScores {
		if !competency.HasEvidence {
			continue
		}
		item := add("score:"+competency.CompetencyRef, "neutral",
			models.AssessmentBilingualText{TH: competency.NameTH, EN: assessmentTextWithFallback(competency.NameEN, competency.NameTH)},
			models.AssessmentBilingualText{TH: fmt.Sprintf("คะแนนหลัก %.2f; คะแนนเสริมรายวิชา %.2f; วิชาเสรี %.2f; กิจกรรม %.2f เป็นคะแนนสะสม ไม่ใช่คะแนนเต็ม 100 และไม่มีเกณฑ์เปรียบเทียบในรายงานนี้", competency.CoreScore, competency.BonusScore, competency.FreeElectiveScore, competency.ActivityScore), EN: fmt.Sprintf("Core %.2f; course bonus %.2f; elective %.2f; activity %.2f. These are accumulated contributions, not scores out of 100; this report has no comparison threshold.", competency.CoreScore, competency.BonusScore, competency.FreeElectiveScore, competency.ActivityScore)}, competency.CompetencyRef)
		item.FactType = "competency"
		item.Values = models.AssessmentFactValues{CoreScore: &competency.CoreScore, CourseBonusScore: &competency.BonusScore, FreeElectiveScore: &competency.FreeElectiveScore, ActivityScore: &competency.ActivityScore}
	}
	for _, activity := range input.ActivityEvidence {
		fact := models.AssessmentBilingualText{TH: "มีหลักฐานกิจกรรม; สถานะ " + activity.AttendanceStatus, EN: "Activity evidence recorded; attendance status " + activity.AttendanceStatus + "."}
		if activity.Score != nil {
			fact.TH += fmt.Sprintf(" คะแนนกิจกรรม %.2f%%", *activity.Score)
			fact.EN += fmt.Sprintf(" Activity score %.2f%%.", *activity.Score)
		}
		item := add("participation:"+activity.EvidenceRef, "neutral", models.AssessmentBilingualText{TH: activity.ActivityNameTH, EN: assessmentTextWithFallback(activity.ActivityNameEN, activity.ActivityNameTH)}, fact, activity.EvidenceRef)
		item.FactType = "activity"
		item.Values = models.AssessmentFactValues{AttendanceStatus: activity.AttendanceStatus, ActivityScore: activity.Score}
	}
	return items
}

func assessmentReadinessExplanation(input models.AssessmentProviderInput) models.AssessmentBilingualText {
	result := input.Readiness
	if result.RequirementCount == 0 || result.Status == CooperativeReadinessNotConfigured {
		return models.AssessmentBilingualText{TH: "ยังตรวจความพร้อมไม่ได้ เนื่องจากไม่มีชุดเกณฑ์ที่เปิดใช้งาน", EN: "Readiness cannot be checked because no published requirement set is available."}
	}
	return models.AssessmentBilingualText{
		TH: fmt.Sprintf("ผลตรวจจากระบบ: ถึงเกณฑ์ %d จาก %d ข้อ โปรดอ่านสถานะรายเกณฑ์ด้านบน ผลนี้เป็นการตรวจความพร้อม ไม่ใช่การอนุมัติสิทธิ์", result.PassedCount, result.RequirementCount),
		EN: fmt.Sprintf("System result: %d of %d requirements met. See each criterion's status above. This checks readiness; it does not approve eligibility.", result.PassedCount, result.RequirementCount),
	}
}
