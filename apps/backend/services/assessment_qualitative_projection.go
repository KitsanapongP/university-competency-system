package services

import "github.com/spw32767/university-competency-system-backend/models"

type assessmentQualitativeObservation struct {
	ObservationID string `json:"observation_id"`
	Kind          string `json:"kind"`
	FactType      string `json:"fact_type"`
	Meaning       string `json:"meaning"`
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
			result = append(result, assessmentQualitativeObservation{item.ObservationID, item.Kind, item.FactType, meaning})
		}
	}
	return result
}
