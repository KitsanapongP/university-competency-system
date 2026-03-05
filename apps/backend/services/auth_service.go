package services

import (
	"context"
	"database/sql"
	"errors"
	"log"

	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/repositories"
	"golang.org/x/crypto/bcrypt"
)

var ErrInvalidCredentials = errors.New("invalid credentials")
var ErrUserInactive = errors.New("user inactive")

type Service struct {
	Repo *repositories.Repository
}

func NewService(repo *repositories.Repository) *Service {
	return &Service{Repo: repo}
}

func (s *Service) AuthenticateByEmail(ctx context.Context, email, password string) (*models.User, error) {
	u, err := s.Repo.GetUserWithRolesByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrInvalidCredentials
		}
		return nil, err
	}

	// debug: log minimal info to help trace login problems
	log.Printf("AuthenticateByEmail: found user id=%d email=%s active=%v hashlen=%d", u.UserID, email, u.IsActive, len(u.PasswordHash))

	if !u.IsActive {
		return nil, ErrUserInactive
	}

	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password)); err != nil {
		log.Printf("AuthenticateByEmail: password compare failed for user id=%d: %v", u.UserID, err)
		return nil, ErrInvalidCredentials
	}

	// ไม่ส่ง hash ออกไป
	u.PasswordHash = ""
	return u, nil
}
