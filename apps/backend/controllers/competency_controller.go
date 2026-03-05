package controllers

import (
	"net/http"

	"github.com/spw32767/university-competency-system-backend/services"
	"github.com/spw32767/university-competency-system-backend/utils"
)

type CompetencyController struct {
	Service *services.CompetencyService
}

func (h *CompetencyController) Dashboard(w http.ResponseWriter, r *http.Request) {
	claims, ok := utils.ClaimsFromContext(r.Context())
	if !ok {
		utils.Error(w, http.StatusUnauthorized, "AUTH_MISSING", "missing auth")
		return
	}

	// อ่าน query parameter 'category' เพื่อกรองข้อมูลตามหมวดหมู่ที่ต้องการ
	// ค่าเริมต้น: "activity" (แสดงคะแนน Competency ของกิจกรรมทั้งหมด)
	category := r.URL.Query().Get("category")
	if category == "" {
		category = "activity"
	}

	// ตรวจสอบว่าค่าของ category เป็นค่าที่ถูกต้อง
	if category != "activity" && category != "course" {
		utils.Error(w, http.StatusBadRequest, "INVALID_CATEGORY", "invalid category")
		return
	}

	// เรียก Serveice และส่ง Category parameter
	data, err := h.Service.BuildDashboard(r.Context(), claims.UserID, category)
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, "SERVER_ERROR", "could not load competency data")
		return
	}

	utils.OK(w, data)
}
