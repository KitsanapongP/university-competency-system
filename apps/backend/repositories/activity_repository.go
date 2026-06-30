package repositories

import (
	"context"
	"database/sql"
	"strings"

	"github.com/spw32767/university-competency-system-backend/models"
)

type ActivityRepository struct {
	DB *sql.DB
}

func NewActivityRepository(db *sql.DB) *ActivityRepository {
	return &ActivityRepository{DB: db}
}

func (r *ActivityRepository) GetActivities(ctx context.Context, filters models.ActivityFilters) ([]*models.Activity, error) {
	query, args := buildActivityListQuery(filters, false)
	rows, err := r.DB.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	activities := make([]*models.Activity, 0)
	for rows.Next() {
		activity, err := scanActivity(rows)
		if err != nil {
			return nil, err
		}
		activities = append(activities, activity)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return activities, nil
}

func (r *ActivityRepository) GetActivityByID(ctx context.Context, activityID uint64) (*models.Activity, error) {
	query, args := buildActivityListQuery(models.ActivityFilters{}, true)
	args = append(args, activityID)
	return scanActivity(r.DB.QueryRowContext(ctx, query, args...))
}

func (r *ActivityRepository) CreateActivity(ctx context.Context, payload models.UpsertActivityPayload, createdBy int64) (*models.Activity, error) {
	result, err := r.DB.ExecContext(ctx, `
		INSERT INTO act_activities (
			faculty_id,
			code,
			name_th,
			name_en,
			description,
			category,
			type,
			created_by,
			status,
			visibility_scope,
			registration_required
		)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', 'faculty_only', ?)
	`, payload.FacultyID, payload.Code, payload.NameTH, payload.NameEN, payload.Description, payload.Category, payload.Type, createdBy, boolValue(payload.RegistrationRequired))
	if err != nil {
		return nil, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}
	return r.GetActivityByID(ctx, uint64(id))
}

func (r *ActivityRepository) UpdateActivityDraft(ctx context.Context, activityID uint64, payload models.UpsertActivityPayload) (*models.Activity, error) {
	result, err := r.DB.ExecContext(ctx, `
		UPDATE act_activities
		SET faculty_id = ?,
			code = ?,
			name_th = ?,
			name_en = ?,
			description = ?,
			category = ?,
			type = ?,
			registration_required = ?,
			updated_at = NOW()
		WHERE activity_id = ?
			AND deleted_at IS NULL
	`, payload.FacultyID, payload.Code, payload.NameTH, payload.NameEN, payload.Description, payload.Category, payload.Type, boolValue(payload.RegistrationRequired), activityID)
	if err != nil {
		return nil, err
	}
	if err := ensureAffected(result); err != nil {
		return nil, err
	}
	return r.GetActivityByID(ctx, activityID)
}

func (r *ActivityRepository) UpdateActivityPublished(ctx context.Context, activityID uint64, payload models.UpsertActivityPayload) (*models.Activity, error) {
	result, err := r.DB.ExecContext(ctx, `
		UPDATE act_activities
		SET description = ?,
			category = ?,
			type = ?,
			registration_required = ?,
			updated_at = NOW()
		WHERE activity_id = ?
			AND deleted_at IS NULL
	`, payload.Description, payload.Category, payload.Type, boolValue(payload.RegistrationRequired), activityID)
	if err != nil {
		return nil, err
	}
	if err := ensureAffected(result); err != nil {
		return nil, err
	}
	return r.GetActivityByID(ctx, activityID)
}

func (r *ActivityRepository) PublishActivity(ctx context.Context, activityID uint64) (*models.Activity, error) {
	result, err := r.DB.ExecContext(ctx, `
		UPDATE act_activities
		SET status = 'published',
			published_at = NOW(),
			updated_at = NOW()
		WHERE activity_id = ?
			AND deleted_at IS NULL
	`, activityID)
	if err != nil {
		return nil, err
	}
	if err := ensureAffected(result); err != nil {
		return nil, err
	}
	return r.GetActivityByID(ctx, activityID)
}

func (r *ActivityRepository) CloseActivity(ctx context.Context, activityID uint64) (*models.Activity, error) {
	result, err := r.DB.ExecContext(ctx, `
		UPDATE act_activities
		SET status = 'closed',
			updated_at = NOW()
		WHERE activity_id = ?
			AND deleted_at IS NULL
	`, activityID)
	if err != nil {
		return nil, err
	}
	if err := ensureAffected(result); err != nil {
		return nil, err
	}
	return r.GetActivityByID(ctx, activityID)
}

func (r *ActivityRepository) CountSessionsForActivity(ctx context.Context, activityID uint64) (int, error) {
	var count int
	err := r.DB.QueryRowContext(ctx, `
		SELECT COUNT(*)
		FROM act_sessions
		WHERE activity_id = ?
			AND deleted_at IS NULL
	`, activityID).Scan(&count)
	return count, err
}

func (r *ActivityRepository) SoftDeleteActivity(ctx context.Context, activityID uint64) error {
	result, err := r.DB.ExecContext(ctx, `
		UPDATE act_activities
		SET deleted_at = NOW(),
			updated_at = NOW()
		WHERE activity_id = ?
			AND deleted_at IS NULL
	`, activityID)
	if err != nil {
		return err
	}
	return ensureAffected(result)
}

func (r *ActivityRepository) GetActivityOptions(ctx context.Context, filters models.ActivityFilters) (*models.ActivityOptions, error) {
	categories, err := r.getActivityDistinctValues(ctx, "category", filters)
	if err != nil {
		return nil, err
	}
	types, err := r.getActivityDistinctValues(ctx, "type", filters)
	if err != nil {
		return nil, err
	}
	return &models.ActivityOptions{
		Categories: categories,
		Types:      types,
	}, nil
}

func (r *ActivityRepository) getActivityDistinctValues(ctx context.Context, column string, filters models.ActivityFilters) ([]string, error) {
	args := make([]any, 0)
	where := []string{"deleted_at IS NULL", column + " IS NOT NULL", "TRIM(" + column + ") <> ''"}
	if filters.FacultyID != nil {
		where = append(where, "faculty_id = ?")
		args = append(args, *filters.FacultyID)
	}

	rows, err := r.DB.QueryContext(ctx, `
		SELECT DISTINCT `+column+`
		FROM act_activities
		WHERE `+strings.Join(where, " AND ")+`
		ORDER BY `+column+`
	`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	values := make([]string, 0)
	for rows.Next() {
		var value string
		if err := rows.Scan(&value); err != nil {
			return nil, err
		}
		values = append(values, value)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return values, nil
}

func buildActivityListQuery(filters models.ActivityFilters, byID bool) (string, []any) {
	args := make([]any, 0)
	where := []string{"a.deleted_at IS NULL"}

	if byID {
		where = append(where, "a.activity_id = ?")
	} else {
		if filters.FacultyID != nil {
			where = append(where, "a.faculty_id = ?")
			args = append(args, *filters.FacultyID)
		}
		if filters.Status != "" {
			where = append(where, "a.status = ?")
			args = append(args, filters.Status)
		}
		if filters.Category != "" {
			where = append(where, "a.category = ?")
			args = append(args, filters.Category)
		}
		if filters.Type != "" {
			where = append(where, "a.type = ?")
			args = append(args, filters.Type)
		}
		if filters.Search != "" {
			where = append(where, "(a.code LIKE ? OR a.name_th LIKE ? OR COALESCE(a.name_en, '') LIKE ? OR COALESCE(a.description, '') LIKE ?)")
			search := "%" + filters.Search + "%"
			args = append(args, search, search, search, search)
		}
	}

	query := `
		SELECT
			a.activity_id,
			a.faculty_id,
			f.name_th AS faculty_name_th,
			f.name_en AS faculty_name_en,
			a.code,
			a.name_th,
			a.name_en,
			a.description,
			a.category,
			a.type,
			a.created_by,
			a.status,
			a.visibility_scope,
			a.registration_required,
			a.published_at,
			COALESCE(session_stats.session_count, 0) AS session_count,
			session_stats.next_session_at,
			session_stats.latest_session_at,
			a.created_at,
			a.updated_at,
			a.deleted_at
		FROM act_activities a
		JOIN org_faculties f ON f.faculty_id = a.faculty_id
		LEFT JOIN (
			SELECT
				activity_id,
				COUNT(*) AS session_count,
				MIN(CASE WHEN start_at >= NOW() AND status <> 'cancelled' THEN start_at END) AS next_session_at,
				MAX(start_at) AS latest_session_at
			FROM act_sessions
			WHERE deleted_at IS NULL
			GROUP BY activity_id
		) session_stats ON session_stats.activity_id = a.activity_id
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY a.updated_at DESC, a.activity_id DESC
	`
	return query, args
}

func scanActivity(scanner interface {
	Scan(dest ...any) error
}) (*models.Activity, error) {
	var activity models.Activity
	var facultyNameEN sql.NullString
	var nameEN sql.NullString
	var description sql.NullString
	var category sql.NullString
	var activityType sql.NullString
	var createdBy sql.NullInt64
	var publishedAt sql.NullTime
	var nextSessionAt sql.NullTime
	var latestSessionAt sql.NullTime
	var deletedAt sql.NullTime

	if err := scanner.Scan(
		&activity.ActivityID,
		&activity.FacultyID,
		&activity.FacultyNameTH,
		&facultyNameEN,
		&activity.Code,
		&activity.NameTH,
		&nameEN,
		&description,
		&category,
		&activityType,
		&createdBy,
		&activity.Status,
		&activity.VisibilityScope,
		&activity.RegistrationRequired,
		&publishedAt,
		&activity.SessionCount,
		&nextSessionAt,
		&latestSessionAt,
		&activity.CreatedAt,
		&activity.UpdatedAt,
		&deletedAt,
	); err != nil {
		return nil, err
	}

	if facultyNameEN.Valid {
		activity.FacultyNameEN = &facultyNameEN.String
	}
	if nameEN.Valid {
		activity.NameEN = &nameEN.String
	}
	if description.Valid {
		activity.Description = &description.String
	}
	if category.Valid {
		activity.Category = &category.String
	}
	if activityType.Valid {
		activity.Type = &activityType.String
	}
	if createdBy.Valid && createdBy.Int64 > 0 {
		value := uint64(createdBy.Int64)
		activity.CreatedBy = &value
	}
	if publishedAt.Valid {
		activity.PublishedAt = &publishedAt.Time
	}
	if nextSessionAt.Valid {
		activity.NextSessionAt = &nextSessionAt.Time
	}
	if latestSessionAt.Valid {
		activity.LatestSessionAt = &latestSessionAt.Time
	}
	if deletedAt.Valid {
		activity.DeletedAt = &deletedAt.Time
	}

	activity.CanEdit = activity.Status == "draft" || activity.Status == "published"
	activity.CanDelete = activity.Status == "draft" && activity.SessionCount == 0
	activity.CanPublish = activity.Status == "draft"
	activity.CanClose = activity.Status == "published"

	return &activity, nil
}

func ensureAffected(result sql.Result) error {
	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func boolValue(value *bool) bool {
	return value != nil && *value
}
