package models

type User struct {
	UserID       int64
	Username     string
	Email        *string
	DisplayName  *string
	FacultyID    *int64
	IsActive     bool
	PasswordHash string
	Roles        []string
}
