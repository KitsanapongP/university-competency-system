package services

import (
	"context"
	"github.com/spw32767/university-competency-system-backend/models"
	"testing"
	"time"
)

type fakeAssessmentDraftStore struct {
	draft    models.AssessmentRejectedDraft
	owner    uint64
	semester uint
}

func (f *fakeAssessmentDraftStore) GetLatestDraft(_ context.Context, owner uint64, semester uint) (*models.AssessmentRejectedDraft, error) {
	f.owner = owner
	f.semester = semester
	d := f.draft
	return &d, nil
}

func TestDraftStateUsesResolvedOwnerAndHidesStaleContent(t *testing.T) {
	snapshot := reportServiceSnapshot(t)
	service, _, jobs, _ := reportServiceFixture(snapshot, models.AssessmentReportRecord{}, time.Now().UTC())
	drafts := &fakeAssessmentDraftStore{draft: models.AssessmentRejectedDraft{JobID: 8, SourceHash: snapshot.Metadata.SourceHash, Preview: "unverified draft"}}
	service.Drafts = drafts
	jobs.latest = models.AssessmentJob{JobID: 9, Status: "failed", InputHash: snapshot.Metadata.SourceHash}
	jobs.latestErr = nil
	state, err := service.Get(context.Background(), 77, 2)
	if err != nil {
		t.Fatal(err)
	}
	if drafts.owner != snapshot.Scope.EnrollmentCurriculumID || drafts.semester != 2 || !state.RejectedDraft.PreviousAttempt || state.RejectedDraft.IsStale {
		t.Fatal("incorrect draft scope or attempt")
	}
	drafts.draft.SourceHash = "old"
	state, err = service.Get(context.Background(), 77, 2)
	if err != nil || !state.RejectedDraft.IsStale || state.RejectedDraft.Preview != "" {
		t.Fatal("stale draft exposed")
	}
}
