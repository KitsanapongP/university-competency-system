package services

import "github.com/spw32767/university-competency-system-backend/models"

type assessmentQualitativeObservation struct {
	ObservationID string `json:"observation_id"`
	Kind          string `json:"kind"`
	FactType      string `json:"fact_type"`
	Meaning       string `json:"meaning"`
	MeaningTH     string `json:"meaning_th"`
}

// Only backend-owned descriptions reach the prose writer; exact facts stay in the report assembler.
func buildAssessmentQualitativeObservations(input models.AssessmentProviderInput) []assessmentQualitativeObservation {
	result := make([]assessmentQualitativeObservation, 0)
	for _, item := range BuildAssessmentObservations(input) {
		meaning := ""
		switch item.FactType {
		case "readiness":
			if item.Kind == "strength" {
				meaning = "The readiness criterion is met; not placement approval."
			} else if item.Kind == "limitation" {
				meaning = "The readiness criterion is not yet met; plan with an advisor."
			}
		case "academic_summary":
			meaning = "Recorded academic results are available; no ability threshold."
			if item.Values.MissingGradeCount != nil && *item.Values.MissingGradeCount > 0 {
				meaning = "Results are awaiting publication; not failure or weakness."
				if item.Values.RecordCount != nil && *item.Values.MissingGradeCount < *item.Values.RecordCount {
					meaning = "Published and pending results coexist; pending is not failure."
				}
			}
		case "competency":
			meaning = "Evidence supports accumulated competency contributions; no ability threshold."
		case "activity":
			meaning = "Activity evidence exists; not expertise or personality."
			if item.Values.AttendanceStatus == "attended" {
				meaning = "Activity attendance is recorded; not expertise or personality."
			}
		}
		if meaning != "" {
			result = append(result, assessmentQualitativeObservation{item.ObservationID, item.Kind, item.FactType, meaning, assessmentQualitativeThaiMeaning(item)})
		}
	}
	return result
}

func assessmentQualitativeThaiMeaning(item models.AssessmentObservation) string {
	switch item.FactType {
	case "readiness":
		if item.Kind == "strength" {
			return "ถึงเกณฑ์แล้ว ไม่ใช่การอนุมัติสิทธิ์"
		}
		return "ยังไม่ถึงเกณฑ์ ควรวางแผนกับอาจารย์ที่ปรึกษา"
	case "academic_summary":
		if item.Values.MissingGradeCount != nil && *item.Values.MissingGradeCount > 0 {
			if item.Values.RecordCount != nil && *item.Values.MissingGradeCount < *item.Values.RecordCount {
				return "มีผลที่ประกาศและรอประกาศ ผลที่รอไม่ใช่การไม่ผ่าน"
			}
			return "ผลรอประกาศ ไม่ใช่ข้อจำกัดส่วนบุคคล"
		}
		return "มีผลการเรียนแล้ว ไม่มีเกณฑ์วัดความสามารถ"
	case "competency":
		return "มีคะแนนสมรรถนะสะสม ไม่มีเกณฑ์วัดความสามารถ"
	case "activity":
		if item.Values.AttendanceStatus == "attended" {
			return "มีการเข้าร่วมกิจกรรม ไม่ยืนยันความเชี่ยวชาญหรือบุคลิกภาพ"
		}
		return "มีหลักฐานกิจกรรม ไม่ยืนยันความเชี่ยวชาญหรือบุคลิกภาพ"
	default:
		return ""
	}
}
