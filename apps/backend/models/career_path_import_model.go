package models

type CareerPathImportPayload struct {
	SchemaVersion int                   `json:"schema_version"`
	FacultyID     *uint64               `json:"faculty_id,omitempty"`
	PreviewToken  string                `json:"preview_token,omitempty"`
	Rows          []CareerPathImportRow `json:"rows"`
}

type CareerPathImportRow struct {
	RowNumber       int       `json:"row_number"`
	Action          string    `json:"action,omitempty"`
	Selected        bool      `json:"selected,omitempty"`
	Code            string    `json:"code"`
	NameTH          *string   `json:"name_th,omitempty"`
	NameEN          *string   `json:"name_en,omitempty"`
	DescriptionTH   *string   `json:"description_th,omitempty"`
	DescriptionEN   *string   `json:"description_en,omitempty"`
	SkillsTH        *string   `json:"skills_description_th,omitempty"`
	SkillsEN        *string   `json:"skills_description_en,omitempty"`
	SourceReference *string   `json:"source_reference,omitempty"`
	CurriculumIDs   *[]uint64 `json:"curriculum_ids,omitempty"`
	CompetencyIDs   *[]uint64 `json:"competency_ids,omitempty"`
	ClearFields     []string  `json:"clear_fields,omitempty"`
}

type CareerPathImportIssue struct {
	RowNumber int    `json:"row_number"`
	Field     string `json:"field"`
	Code      string `json:"code"`
	Message   string `json:"message"`
	Severity  string `json:"severity"`
}

type CareerPathImportPreviewRow struct {
	RowNumber                int                     `json:"row_number"`
	Action                   string                  `json:"action"`
	CareerPathID             *uint64                 `json:"career_path_id,omitempty"`
	ExpectedVersion          uint64                  `json:"expected_version_id,omitempty"`
	ExpectedPublishedVersion uint64                  `json:"expected_published_version_id,omitempty"`
	Selected                 bool                    `json:"selected"`
	Valid                    bool                    `json:"valid"`
	Payload                  CareerPathDraftPayload  `json:"payload"`
	Previous                 *CareerPathDraftPayload `json:"previous,omitempty"`
	Issues                   []CareerPathImportIssue `json:"issues"`
}

type CareerPathImportPreview struct {
	Valid        bool                         `json:"valid"`
	CanCommit    bool                         `json:"can_commit"`
	PreviewToken string                       `json:"preview_token"`
	Issues       []CareerPathImportIssue      `json:"issues"`
	Rows         []CareerPathImportPreviewRow `json:"rows"`
}

type CareerPathImportWrite struct {
	CareerPathID             *uint64
	ExpectedVersion          uint64
	ExpectedPublishedVersion uint64
	Payload                  CareerPathDraftPayload
}
