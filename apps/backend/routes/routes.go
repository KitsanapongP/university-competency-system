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

	activityRepo := repositories.NewActivityRepository(db)
	activitySvc := services.NewActivityService(activityRepo)
	activityHandler := &controllers.ActivityController{
		Service: activitySvc,
	}
	activitySessionRepo := repositories.NewActivitySessionRepository(db)
	activitySessionSvc := services.NewActivitySessionService(activitySessionRepo, activityRepo)
	activitySessionHandler := &controllers.ActivitySessionController{
		Service: activitySessionSvc,
	}
	activitySessionWorkspaceRepo := repositories.NewActivitySessionWorkspaceRepository(db)
	activitySessionWorkspaceSvc := services.NewActivitySessionWorkspaceService(activitySessionRepo, activitySessionWorkspaceRepo)
	activitySessionWorkspaceHandler := &controllers.ActivitySessionWorkspaceController{
		Service: activitySessionWorkspaceSvc,
	}

	curriculumRepo := repositories.NewCurriculumRepository(db)
	curriculumSvc := services.NewCurriculumService(curriculumRepo)
	curriculumHandler := &controllers.CurriculumController{
		Service: curriculumSvc,
	}

	templateRepo := repositories.NewTemplateRepository(db)
	templateSvc := services.NewTemplateService(templateRepo)
	templateHandler := &controllers.TemplateController{
		Service: templateSvc,
	}
	studentCohortRepo := repositories.NewStudentCohortRepository(db)
	studentCohortSvc := services.NewStudentCohortService(studentCohortRepo)
	studentCohortHandler := &controllers.StudentCohortController{
		Service: studentCohortSvc,
	}
	templateAssignmentRepo := repositories.NewTemplateAssignmentRepository(db)
	templateAssignmentSvc := services.NewTemplateAssignmentService(templateRepo, studentCohortRepo, templateAssignmentRepo)
	templateAssignmentHandler := &controllers.TemplateAssignmentController{
		Service: templateAssignmentSvc,
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
			pr.Get("/competencies", competencyHandler.GetAll)

			pr.With(middleware.RequireRoles("admin", "officer")).Post("/competencies", competencyHandler.Create)
			pr.With(middleware.RequireRoles("admin", "officer")).Patch("/competencies/{competency_id}", competencyHandler.Update)
			pr.With(middleware.RequireRoles("admin", "officer")).Delete("/competencies/{competency_id}", competencyHandler.Delete)

			pr.Route("/activities", func(ar chi.Router) {
				ar.Use(middleware.RequireRoles("admin", "officer"))
				ar.Get("/", activityHandler.GetAll)
				ar.Post("/", activityHandler.Create)
				ar.Get("/options", activityHandler.GetOptions)
				ar.Get("/{activity_id}/sessions", activitySessionHandler.GetByActivity)
				ar.Post("/{activity_id}/sessions", activitySessionHandler.Create)
				ar.Get("/{activity_id}/session-assignee-options", activitySessionHandler.GetAssigneeOptions)
				ar.Get("/{activity_id}", activityHandler.GetByID)
				ar.Patch("/{activity_id}", activityHandler.Update)
				ar.Patch("/{activity_id}/status", activityHandler.UpdateStatus)
				ar.Delete("/{activity_id}", activityHandler.Delete)
			})

			pr.Route("/sessions", func(sr chi.Router) {
				sr.Use(middleware.RequireRoles("admin", "officer"))
				sr.Get("/{session_id}", activitySessionHandler.GetByID)
				sr.Patch("/{session_id}", activitySessionHandler.Update)
				sr.Patch("/{session_id}/status", activitySessionHandler.UpdateStatus)
				sr.Patch("/{session_id}/finalize", activitySessionHandler.Finalize)
				sr.Delete("/{session_id}", activitySessionHandler.Delete)
				sr.Put("/{session_id}/assignments", activitySessionHandler.ReplaceAssignments)
				sr.Put("/{session_id}/competencies", activitySessionHandler.ReplaceCompetencies)
			})

			// Participant, attendance, and scoring workspace. Assigned lecturers receive
			// only the actions granted by their active session assignment.
			pr.With(middleware.RequireRoles("admin", "officer", "lecturer")).Get("/my/activity-sessions", activitySessionWorkspaceHandler.GetMySessions)
			pr.Route("/session-workspace", func(sw chi.Router) {
				sw.Use(middleware.RequireRoles("admin", "officer", "lecturer"))
				sw.Get("/{session_id}", activitySessionWorkspaceHandler.GetSession)
				sw.Get("/{session_id}/participants", activitySessionWorkspaceHandler.GetParticipants)
				sw.Get("/{session_id}/walk-in-candidates", activitySessionWorkspaceHandler.SearchWalkInCandidates)
				sw.Post("/{session_id}/walk-ins", activitySessionWorkspaceHandler.AddWalkIn)
				sw.Put("/{session_id}/attendance/{person_id}", activitySessionWorkspaceHandler.UpsertAttendance)
				sw.Post("/{session_id}/attendance/mark-unrecorded-absent", activitySessionWorkspaceHandler.MarkUnrecordedAbsent)
				sw.Get("/{session_id}/scores", activitySessionWorkspaceHandler.GetScores)
				sw.Put("/{session_id}/scores", activitySessionWorkspaceHandler.SaveScores)
				sw.Post("/{session_id}/scores/finalize", activitySessionWorkspaceHandler.FinalizeScores)
				sw.Post("/{session_id}/score-corrections", activitySessionWorkspaceHandler.OpenCorrection)
			})

			pr.With(middleware.RequireRoles("admin", "officer")).Get("/faculties", curriculumHandler.GetFaculties)
			pr.With(middleware.RequireRoles("admin", "officer")).Get("/departments", curriculumHandler.GetDepartments)
			pr.With(middleware.RequireRoles("admin", "officer")).Get("/majors", curriculumHandler.GetMajors)
			pr.With(middleware.RequireRoles("admin", "officer")).Post("/majors", curriculumHandler.CreateMajor)
			pr.With(middleware.RequireRoles("admin", "officer")).Patch("/majors/{major_id}", curriculumHandler.UpdateMajor)
			pr.With(middleware.RequireRoles("admin", "officer")).Patch("/majors/{major_id}/status", curriculumHandler.UpdateMajorStatus)

			// Student Management and cohort roster routes.
			pr.Route("/student-cohorts", func(scr chi.Router) {
				scr.Use(middleware.RequireRoles("admin", "officer"))
				scr.Get("/", studentCohortHandler.GetAll)
				scr.Post("/", studentCohortHandler.Create)
				scr.Route("/{cohort_id}", func(cor chi.Router) {
					cor.Get("/", studentCohortHandler.GetByID)
					cor.Patch("/", studentCohortHandler.Update)
					cor.Patch("/status", studentCohortHandler.UpdateStatus)
					cor.Delete("/", studentCohortHandler.Delete)
					cor.Get("/students", studentCohortHandler.GetStudents)
					cor.Post("/students", studentCohortHandler.AddStudent)
					cor.Patch("/students/{enrollment_id}", studentCohortHandler.UpdateStudent)
					cor.Delete("/students/{enrollment_id}", studentCohortHandler.RemoveStudent)
					cor.Post("/imports/preview", studentCohortHandler.PreviewImport)
					cor.Post("/imports/commit", studentCohortHandler.CommitImport)
				})
			})

			// Curriculum Management Routes
			pr.Route("/curricula", func(cr chi.Router) {
				cr.Use(middleware.RequireRoles("admin", "officer"))
				cr.Get("/", curriculumHandler.GetAll)
				cr.Get("/generated-code", curriculumHandler.GetGeneratedCode)
				cr.Post("/", curriculumHandler.Create)
				cr.Route("/{id}", func(cir chi.Router) {
					cir.Delete("/", curriculumHandler.DeleteCurriculum)
					cir.Get("/", curriculumHandler.GetByID)
					cir.Patch("/", curriculumHandler.UpdateMetadata)
					cir.Post("/duplicate", curriculumHandler.DuplicateCurriculum)
					cir.Patch("/status", curriculumHandler.UpdateStatus)
					cir.Post("/structure-imports/preview", curriculumHandler.PreviewStructureImport)
					cir.Post("/structure-imports/commit", curriculumHandler.CommitStructureImport)

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

			// Template Management Routes
			pr.Route("/templates", func(tr chi.Router) {
				tr.Use(middleware.RequireRoles("admin", "officer"))
				tr.Get("/", templateHandler.GetAll)
				tr.Post("/", templateHandler.Create)
				tr.Route("/{id}", func(tir chi.Router) {
					tir.Get("/", templateHandler.GetByID)
					tir.Patch("/", templateHandler.UpdateName)
					tir.Patch("/status", templateHandler.UpdateStatus)
					tir.Delete("/", templateHandler.Delete)
					tir.Get("/items", templateHandler.GetItems)
					tir.Get("/structure", templateHandler.GetStructure)
					tir.Get("/competencies", templateHandler.GetCompetencies)
					tir.Put("/items", templateHandler.SaveItems)
					tir.Put("/competencies", templateHandler.UpdateCompetencies)
				})
			})

			// Template assignments connect an already active template to one active cohort.
			pr.Route("/template-assignments", func(tar chi.Router) {
				tar.Use(middleware.RequireRoles("admin", "officer"))
				tar.Get("/", templateAssignmentHandler.GetAll)
				tar.Get("/available-templates", templateAssignmentHandler.GetAvailableTemplates)
				tar.Get("/available-cohorts", templateAssignmentHandler.GetAvailableCohorts)
				tar.Post("/", templateAssignmentHandler.Create)
				tar.Get("/cohorts/{cohort_id}/history", templateAssignmentHandler.GetHistory)
				tar.Patch("/{assignment_id}", templateAssignmentHandler.Replace)
				tar.Delete("/{assignment_id}", templateAssignmentHandler.Delete)
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
