package services

import (
	"strings"
	"testing"

	"github.com/spw32767/university-competency-system-backend/models"
)

func TestValidateTemplateCoreReadiness(t *testing.T) {
	items := []models.TemplateItem{
		{CompetencyID: 1, CompetencyName: "Communication"},
		{CompetencyID: 2, CompetencyName: "Teamwork"},
	}

	tests := []struct {
		name       string
		items      []models.TemplateItem
		weightSums map[uint64]float64
		wantErr    string
	}{
		{
			name:       "accepts every selected competency at core 100 percent",
			items:      items,
			weightSums: map[uint64]float64{1: 100, 2: 99.99},
		},
		{
			name:       "rejects a template without competency configuration",
			items:      nil,
			weightSums: map[uint64]float64{1: 100},
			wantErr:    "template has no competency configuration",
		},
		{
			name:       "rejects a template without core weights",
			items:      items,
			weightSums: map[uint64]float64{},
			wantErr:    "template has no core course weights",
		},
		{
			name:       "rejects a selected competency below core 100 percent",
			items:      items,
			weightSums: map[uint64]float64{1: 100, 2: 95},
			wantErr:    "Teamwork",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateTemplateCoreReadiness(tt.items, tt.weightSums)
			if tt.wantErr == "" {
				if err != nil {
					t.Fatalf("validateTemplateCoreReadiness() error = %v, want nil", err)
				}
				return
			}
			if err == nil || !strings.Contains(err.Error(), tt.wantErr) {
				t.Fatalf("validateTemplateCoreReadiness() error = %v, want substring %q", err, tt.wantErr)
			}
		})
	}
}
