package routes

import (
	"database/sql"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/spw32767/university-competency-system-backend/config"
	"github.com/spw32767/university-competency-system-backend/controllers"
	"github.com/spw32767/university-competency-system-backend/middleware"
	"github.com/spw32767/university-competency-system-backend/repositories"
	"github.com/spw32767/university-competency-system-backend/services"
	"github.com/spw32767/university-competency-system-backend/utils"
)

func New(db *sql.DB, cfg config.Config) http.Handler {
	r := chi.NewRouter()

	// Global middlewares
	r.Use(middleware.RequestID)
	r.Use(middleware.Logger)
	r.Use(middleware.CORS)

	// Health
	r.Get("/health", controllers.Health)

	// JWT Manager
	jwtMgr := utils.JWTManager{
		Secret:        []byte(cfg.JWTSecret),
		Issuer:        cfg.JWTIssuer,
		ExpireMinutes: cfg.JWTExpireMinutes,
	}

	// Auth middleware (cookie first, bearer fallback)
	authMW := middleware.AuthMiddleware{JWT: jwtMgr}

	// Auth module wiring (DB real)
	authRepo := repositories.NewRepository(db)
	authSvc := services.NewService(authRepo)
	authHandler := &controllers.AuthController{
		Service: authSvc,
		JWT:     jwtMgr,
	}

	// Versioned API routes
	r.Route("/api/v1", func(api chi.Router) {
		// --- Public ---
		api.Post("/auth/login", authHandler.Login)

		// --- Protected ---
		api.Group(func(pr chi.Router) {
			pr.Use(authMW.Required)

			// Who am I (for role-based UI)
			pr.Get("/auth/me", authHandler.Me)
			pr.Post("/auth/logout", authHandler.Logout)

			// Examples (optional)
			pr.With(middleware.RequireRoles("admin")).Get("/admin/ping", func(w http.ResponseWriter, r *http.Request) {
				w.Write([]byte("admin pong"))
			})

			pr.With(middleware.RequireRoles("admin", "officer")).Get("/officer/ping", func(w http.ResponseWriter, r *http.Request) {
				w.Write([]byte("officer pong"))
			})
		})
	})

	return r
}
