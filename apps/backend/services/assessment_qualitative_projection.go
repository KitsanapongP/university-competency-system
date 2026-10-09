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
				meaning = "The specified curriculum readiness criterion is met; this is not placement approval."
			} else if item.Kind == "limitation" {
				meaning = "The specified curriculum readiness criterion is not yet met; plan preparation with an advisor."
			}
		case "academic_summary":
			meaning = "Recorded academic results are available for review; no ability judgment or comparison threshold is supplied."
			if item.Values.MissingGradeCount != nil && *item.Values.MissingGradeCount > 0 {
				meaning = "Some academic results are awaiting publication; missing results do not establish failure or a personal weakness."
				if item.Values.RecordCount != nil && *item.Values.MissingGradeCount < *item.Values.RecordCount {
					meaning = "Published academic results and results awaiting publication coexist; review available results without treating pending results as failure."
				}
			}
		case "competency":
			meaning = "Accumulated competency contributions have supporting evidence; there is no ability threshold or comparison scale in this report."
		case "activity":
			meaning = "Activity evidence is recorded; it does not establish expertise or personality."
			if item.Values.AttendanceStatus == "attended" {
				meaning = "Activity attendance is recorded; it supports describing participation, not expertise or personality."
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
			return "ถึงเกณฑ์ความพร้อมที่หลักสูตรกำหนดแล้ว แต่ไม่ใช่การอนุมัติสิทธิ์ไปสหกิจศึกษา"
		}
		return "ยังไม่ถึงเกณฑ์ความพร้อมที่หลักสูตรกำหนด ควรวางแผนเตรียมตัวร่วมกับอาจารย์ที่ปรึกษา"
	case "academic_summary":
		if item.Values.MissingGradeCount != nil && *item.Values.MissingGradeCount > 0 {
			if item.Values.RecordCount != nil && *item.Values.MissingGradeCount < *item.Values.RecordCount {
				return "มีทั้งผลการเรียนที่ประกาศแล้วและผลที่รอประกาศ สามารถทบทวนข้อมูลที่พร้อมได้โดยไม่ถือว่าผลที่รอเป็นการไม่ผ่าน"
			}
			return "มีผลการเรียนที่รอประกาศ การไม่มีผลยังไม่ใช่การไม่ผ่านหรือข้อจำกัดส่วนบุคคล"
		}
		return "มีผลการเรียนที่บันทึกแล้วให้ทบทวน แต่ไม่มีเกณฑ์ประเมินระดับความสามารถหรือเปรียบเทียบในรายงานนี้"
	case "competency":
		return "มีหลักฐานคะแนนสมรรถนะสะสม แต่ไม่มีเกณฑ์หรือมาตราส่วนสำหรับตัดสินระดับความสามารถในรายงานนี้"
	case "activity":
		if item.Values.AttendanceStatus == "attended" {
			return "มีบันทึกการเข้าร่วมกิจกรรม ใช้อธิบายการมีส่วนร่วมได้ แต่ไม่ยืนยันความเชี่ยวชาญหรือบุคลิกภาพ"
		}
		return "มีหลักฐานกิจกรรม แต่ไม่ยืนยันความเชี่ยวชาญหรือบุคลิกภาพ"
	default:
		return ""
	}
}
