package utils

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	UserID    int64    `json:"user_id"`
	Roles     []string `json:"roles"`
	FacultyID *int64   `json:"faculty_id,omitempty"`

	jwt.RegisteredClaims
}

type JWTManager struct {
	Secret        []byte
	Issuer        string
	ExpireMinutes int
}

func (m JWTManager) Generate(userID int64, roles []string, facultyID *int64) (string, error) {
	now := time.Now()
	claims := Claims{
		UserID:    userID,
		Roles:     roles,
		FacultyID: facultyID,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    m.Issuer,
			Subject:   "auth",
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(time.Duration(m.ExpireMinutes) * time.Minute)),
		},
	}
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return t.SignedString(m.Secret)
}

func (m JWTManager) Verify(tokenStr string) (*Claims, error) {
	t, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(token *jwt.Token) (any, error) {
		return m.Secret, nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := t.Claims.(*Claims)
	if !ok || !t.Valid {
		return nil, jwt.ErrTokenInvalidClaims
	}
	return claims, nil
}
