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

	competencyRepo := repositories.NewCompetencyRepository(db)
	competencySvc := services.NewCompetencyService(competencyRepo)
	competencyHandler := &controllers.CompetencyController{
		Service: competencySvc,
	}

	curriculumRepo := repositories.NewCurriculumRepository(db)
	curriculumSvc := services.NewCurriculumService(curriculumRepo)
	curriculumHandler := &controllers.CurriculumController{
		Service: curriculumSvc,
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

			pr.Get("/competency/dashboard", competencyHandler.Dashboard)

			pr.With(middleware.RequireRoles("admin", "officer")).Get("/faculties", curriculumHandler.GetFaculties)
			pr.With(middleware.RequireRoles("admin", "officer")).Get("/departments", curriculumHandler.GetDepartments)
			pr.With(middleware.RequireRoles("admin", "officer")).Get("/majors", curriculumHandler.GetMajors)
			pr.With(middleware.RequireRoles("admin", "officer")).Post("/majors", curriculumHandler.CreateMajor)
			pr.With(middleware.RequireRoles("admin", "officer")).Patch("/majors/{major_id}", curriculumHandler.UpdateMajor)
			pr.With(middleware.RequireRoles("admin", "officer")).Patch("/majors/{major_id}/status", curriculumHandler.UpdateMajorStatus)

			// Curriculum Management Routes
			pr.Route("/curricula", func(cr chi.Router) {
				cr.Use(middleware.RequireRoles("admin", "officer"))
				cr.Get("/", curriculumHandler.GetAll)
				cr.Post("/", curriculumHandler.Create)
				cr.Route("/{id}", func(cir chi.Router) {
					cir.Get("/", curriculumHandler.GetByID)
					cir.Patch("/status", curriculumHandler.UpdateStatus)

					cir.Post("/categories", curriculumHandler.CreateCategory)
					cir.Get("/categories/{category_id}/delete-preview", curriculumHandler.GetDeleteCategoryPreview)
					cir.Patch("/categories/{category_id}", curriculumHandler.UpdateCategory)
					cir.Delete("/categories/{category_id}", curriculumHandler.DeleteCategory)
					cir.Post("/categories/{category_id}/courses", curriculumHandler.CreateCourse)

					cir.Patch("/courses/{course_id}", curriculumHandler.UpdateCourse)
					cir.Patch("/curriculum-courses/{curriculum_course_id}", curriculumHandler.UpdateCurriculumCoursePlacement)
					cir.Delete("/curriculum-courses/{curriculum_course_id}", curriculumHandler.DeleteCurriculumCoursePlacement)
				})
			})

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
