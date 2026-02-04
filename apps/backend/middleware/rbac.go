package middleware

import (
	"net/http"

	"github.com/spw32767/university-competency-system-backend/utils"
)

func RequireRoles(roles ...string) func(http.Handler) http.Handler {
	allowed := map[string]bool{}
	for _, r := range roles {
		allowed[r] = true
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, ok := utils.ClaimsFromContext(r.Context())
			if !ok {
				utils.Error(w, http.StatusUnauthorized, "AUTH_MISSING", "missing auth context")
				return
			}

			has := false
			for _, rr := range claims.Roles {
				if allowed[rr] {
					has = true
					break
				}
			}

			if !has {
				utils.Error(w, http.StatusForbidden, "FORBIDDEN", "insufficient role")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
