package controllers

import (
	"encoding/json"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/spw32767/university-competency-system-backend/services"
	"github.com/spw32767/university-competency-system-backend/utils"
)

type AuthController struct {
	Service *services.Service
	JWT     utils.JWTManager
}

type loginReq struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func cookieName() string {
	if v := os.Getenv("COOKIE_NAME"); v != "" {
		return v
	}
	return "ucs_token"
}

func cookieSecure() bool {
	v := os.Getenv("COOKIE_SECURE")
	return v == "true" || v == "1"
}

func (h *AuthController) Login(w http.ResponseWriter, r *http.Request) {
	var req loginReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "invalid json")
		return
	}
	if req.Email == "" || req.Password == "" {
		utils.Error(w, http.StatusBadRequest, "BAD_REQUEST", "email and password required")
		return
	}

	u, err := h.Service.AuthenticateByEmail(r.Context(), req.Email, req.Password)
	if err != nil {
		if err == services.ErrInvalidCredentials {
			utils.Error(w, http.StatusUnauthorized, "AUTH_INVALID", "invalid credentials")
			return
		}
		if err == services.ErrUserInactive {
			utils.Error(w, http.StatusForbidden, "USER_INACTIVE", "user is inactive")
			return
		}
		utils.Error(w, http.StatusInternalServerError, "SERVER_ERROR", "login failed")
		return
	}

	token, err := h.JWT.Generate(u.UserID, u.Roles, u.FacultyID)
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, "TOKEN_ERROR", "could not generate token")
		return
	}

	// cookie expiry = jwt expiry (โดยประมาณ)
	expMin := h.JWT.ExpireMinutes
	exp := time.Now().Add(time.Duration(expMin) * time.Minute)

	http.SetCookie(w, &http.Cookie{
		Name:     cookieName(),
		Value:    token,
		Path:     "/",
		Expires:  exp,
		HttpOnly: true,
		Secure:   cookieSecure(),
		SameSite: http.SameSiteLaxMode,
	})

	// ตอบกลับแบบ minimal (ไม่ต้องส่ง token ให้ JS)
	utils.OK(w, map[string]any{
		"ok": true,
	})
}

func (h *AuthController) Me(w http.ResponseWriter, r *http.Request) {
	claims, ok := utils.ClaimsFromContext(r.Context())
	if !ok {
		utils.Error(w, http.StatusUnauthorized, "AUTH_MISSING", "missing auth")
		return
	}

	// ดึงจาก DB เพื่อให้ได้ display_name/email ล่าสุด + roles ที่ครบ
	u, err := h.Service.Repo.GetUserWithRolesByID(r.Context(), claims.UserID)
	if err != nil {
		utils.Error(w, http.StatusUnauthorized, "AUTH_INVALID", "user not found")
		return
	}
	u.PasswordHash = ""

	resp := map[string]any{
		"user_id":    claims.UserID,
		"roles":      claims.Roles,
		"faculty_id": claims.FacultyID,
		"username":   u.Username,
	}

	if u.Email != nil {
		resp["email"] = *u.Email
	}
	if u.DisplayName != nil {
		resp["display_name"] = *u.DisplayName
	}

	utils.OK(w, resp)
}

func (h *AuthController) Logout(w http.ResponseWriter, r *http.Request) {
	// ลบ cookie
	http.SetCookie(w, &http.Cookie{
		Name:     cookieName(),
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   cookieSecure(),
		SameSite: http.SameSiteLaxMode,
	})
	utils.OK(w, map[string]any{"ok": true})
}

// helper: ใช้ถ้าคุณอยากอ่าน expire จาก env แทน config (optional)
func envInt(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return n
}
