package controllers

import (
	"fmt"
	"strings"
	"time"
	"xar-backend-go/internal/config"
	"xar-backend-go/internal/middleware"
	"xar-backend-go/internal/models"

	"github.com/gofiber/fiber/v2"
)

// GetAvailableVouchers returns active vouchers
func GetAvailableVouchers(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(500).JSON(fiber.Map{"error": "Database not initialized"})
	}

	authHeader := c.Get("Authorization")
	_, err := middleware.ParseSupabaseToken(authHeader)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}

	query := `
		SELECT id::text, code, title, type, discount_amount, min_purchase, valid_until, usage_limit, used_count, is_active, created_at 
		FROM vouchers 
		WHERE is_active = true AND (valid_until IS NULL OR valid_until > NOW())
		ORDER BY created_at DESC
	`
	rows, err := config.DB.Query(query)
	if err != nil {
		return c.JSON(fiber.Map{"success": true, "data": []interface{}{}})
	}
	defer rows.Close()

	var vouchers []models.Voucher
	for rows.Next() {
		var v models.Voucher
		if err := rows.Scan(&v.ID, &v.Code, &v.Title, &v.Type, &v.DiscountAmount, &v.MinPurchase, &v.ValidUntil, &v.UsageLimit, &v.UsedCount, &v.IsActive, &v.CreatedAt); err == nil {
			vouchers = append(vouchers, v)
		}
	}
	if err := rows.Err(); err != nil {
		_ = err // ignored or handle appropriately
	}
	if vouchers == nil {
		vouchers = []models.Voucher{}
	}

	return c.JSON(fiber.Map{"success": true, "data": vouchers})
}

// GetPublicVouchers returns active vouchers without auth
func GetPublicVouchers(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(500).JSON(fiber.Map{"error": "Database not initialized"})
	}

	query := `
		SELECT id::text, code, title, type, discount_amount, min_purchase, valid_until, usage_limit, used_count, is_active, created_at 
		FROM vouchers 
		WHERE is_active = true AND (valid_until IS NULL OR valid_until > NOW())
		ORDER BY created_at DESC
	`
	rows, err := config.DB.Query(query)
	if err != nil {
		return c.JSON(fiber.Map{"success": true, "data": []interface{}{}})
	}
	defer rows.Close()

	var vouchers []models.Voucher
	for rows.Next() {
		var v models.Voucher
		if err := rows.Scan(&v.ID, &v.Code, &v.Title, &v.Type, &v.DiscountAmount, &v.MinPurchase, &v.ValidUntil, &v.UsageLimit, &v.UsedCount, &v.IsActive, &v.CreatedAt); err == nil {
			vouchers = append(vouchers, v)
		}
	}
	if err := rows.Err(); err != nil {
		_ = err // ignored or handle appropriately
	}
	if vouchers == nil {
		vouchers = []models.Voucher{}
	}

	return c.JSON(fiber.Map{"success": true, "data": vouchers})
}

// ClaimVoucher claims a voucher for a user
func ClaimVoucher(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database not initialized"})
	}

	authHeader := c.Get("Authorization")
	user, err := middleware.ParseSupabaseToken(authHeader)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req struct {
		VoucherID interface{} `json:"voucher_id"`
		Code      string      `json:"code"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	voucherIDStr := ""
	if req.VoucherID != nil {
		voucherIDStr = strings.TrimSpace(fmt.Sprintf("%v", req.VoucherID))
		if voucherIDStr == "<nil>" || voucherIDStr == "0" {
			voucherIDStr = ""
		}
	}

	var v models.Voucher
	var query string
	var queryArg interface{}

	if strings.TrimSpace(req.Code) != "" {
		query = `SELECT id::text, code, title, type, discount_amount, min_purchase, valid_until, usage_limit, used_count, is_active, created_at FROM vouchers WHERE LOWER(code) = LOWER($1) LIMIT 1`
		queryArg = strings.TrimSpace(req.Code)
	} else if voucherIDStr != "" {
		query = `SELECT id::text, code, title, type, discount_amount, min_purchase, valid_until, usage_limit, used_count, is_active, created_at FROM vouchers WHERE id::text = $1 LIMIT 1`
		queryArg = voucherIDStr
	} else {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Voucher ID or Code is required"})
	}

	err = config.DB.QueryRow(query, queryArg).Scan(
		&v.ID, &v.Code, &v.Title, &v.Type, &v.DiscountAmount, &v.MinPurchase,
		&v.ValidUntil, &v.UsageLimit, &v.UsedCount, &v.IsActive, &v.CreatedAt,
	)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Voucher tidak ditemukan"})
	}

	if !v.IsActive {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Voucher sudah tidak aktif"})
	}

	if v.ValidUntil != nil && v.ValidUntil.Before(time.Now()) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Voucher telah kadaluarsa"})
	}

	if v.UsageLimit > 0 && v.UsedCount >= v.UsageLimit {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Kuota voucher telah habis"})
	}

	// Check if user already claimed this voucher
	var existingClaimID string
	_ = config.DB.QueryRow(
		"SELECT id::text FROM user_vouchers WHERE user_id::text = $1 AND voucher_id::text = $2 LIMIT 1",
		user.ID, v.ID,
	).Scan(&existingClaimID)

	if existingClaimID != "" {
		return c.JSON(fiber.Map{
			"success": true,
			"message": "Voucher sudah ada di daftar voucher Anda",
			"data": fiber.Map{
				"id":         existingClaimID,
				"voucher_id": v.ID,
				"status":     "active",
				"vouchers":   v,
			},
		})
	}

	// Insert into user_vouchers
	var claimID string
	err = config.DB.QueryRow(
		"INSERT INTO user_vouchers (user_id, voucher_id, status, created_at) VALUES ($1::uuid, $2::int, 'active', NOW()) RETURNING id::text",
		user.ID, v.ID,
	).Scan(&claimID)

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal menyimpan klaim voucher: " + err.Error()})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Voucher berhasil diklaim!",
		"data": fiber.Map{
			"id":         claimID,
			"voucher_id": v.ID,
			"status":     "active",
			"vouchers":   v,
		},
	})
}

// GetAdminVouchers lists all vouchers for the admin
func GetAdminVouchers(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(500).JSON(fiber.Map{"error": "Database not initialized"})
	}

	authHeader := c.Get("Authorization")
	user, err := middleware.ParseSupabaseToken(authHeader)
	if err != nil || (user.Role != "admin" && user.Role != "superadmin") {
		return c.Status(403).JSON(fiber.Map{"error": "Admin access required"})
	}

	query := `SELECT id::text, code, title, type, discount_amount, min_purchase, valid_until, usage_limit, used_count, is_active, created_at FROM vouchers ORDER BY created_at DESC`
	rows, err := config.DB.Query(query)
	if err != nil {
		return c.JSON(fiber.Map{"vouchers": []interface{}{}, "error": err.Error()})
	}
	defer rows.Close()

	var vouchers []models.Voucher
	for rows.Next() {
		var v models.Voucher
		if err := rows.Scan(&v.ID, &v.Code, &v.Title, &v.Type, &v.DiscountAmount, &v.MinPurchase, &v.ValidUntil, &v.UsageLimit, &v.UsedCount, &v.IsActive, &v.CreatedAt); err == nil {
			vouchers = append(vouchers, v)
		}
	}
	if err := rows.Err(); err != nil {
		_ = err // ignored or handle appropriately
	}

	if vouchers == nil {
		vouchers = []models.Voucher{}
	}

	return c.JSON(fiber.Map{"vouchers": vouchers})
}

// CreateVoucher creates a new voucher
func CreateVoucher(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(500).JSON(fiber.Map{"error": "Database not initialized"})
	}

	authHeader := c.Get("Authorization")
	user, err := middleware.ParseSupabaseToken(authHeader)
	if err != nil || (user.Role != "admin" && user.Role != "superadmin") {
		return c.Status(403).JSON(fiber.Map{"error": "Admin access required"})
	}

	var req struct {
		Code           string      `json:"code"`
		Title          string      `json:"title"`
		Type           string      `json:"type"`
		DiscountAmount float64     `json:"discount_amount"`
		MinPurchase    float64     `json:"min_purchase"`
		ValidUntil     interface{} `json:"valid_until"`
		UsageLimit     int         `json:"usage_limit"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid JSON format"})
	}

	if req.Code == "" || req.Title == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Code and Title are required"})
	}

	var validUntilArg interface{} = nil
	if req.ValidUntil != nil {
		strVal := strings.TrimSpace(fmt.Sprintf("%v", req.ValidUntil))
		if strVal != "" && strVal != "<nil>" && strVal != "null" {
			if t, err := time.Parse(time.RFC3339, strVal); err == nil {
				validUntilArg = t
			} else if t, err := time.Parse("2006-01-02", strVal); err == nil {
				validUntilArg = t
			} else {
				validUntilArg = strVal
			}
		}
	}

	query := `
		INSERT INTO vouchers (code, title, type, discount_amount, min_purchase, valid_until, usage_limit, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, $7, true)
		RETURNING id::text, created_at, used_count
	`

	var newID string
	var createdAt *time.Time
	var usedCount int
	err = config.DB.QueryRow(query, req.Code, req.Title, req.Type, req.DiscountAmount, req.MinPurchase, validUntilArg, req.UsageLimit).Scan(&newID, &createdAt, &usedCount)

	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to save voucher: " + err.Error()})
	}

	createdVoucher := models.Voucher{
		ID:             newID,
		Code:           req.Code,
		Title:          req.Title,
		Type:           req.Type,
		DiscountAmount: req.DiscountAmount,
		MinPurchase:    req.MinPurchase,
		UsageLimit:     req.UsageLimit,
		UsedCount:      usedCount,
		IsActive:       true,
		CreatedAt:      createdAt,
	}
	if t, ok := validUntilArg.(time.Time); ok {
		createdVoucher.ValidUntil = &t
	}

	return c.JSON(fiber.Map{"success": true, "voucher": createdVoucher})
}

// UpdateVoucher updates an existing voucher
func UpdateVoucher(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(500).JSON(fiber.Map{"error": "Database not initialized"})
	}

	authHeader := c.Get("Authorization")
	user, err := middleware.ParseSupabaseToken(authHeader)
	if err != nil || (user.Role != "admin" && user.Role != "superadmin") {
		return c.Status(403).JSON(fiber.Map{"error": "Admin access required"})
	}

	var req struct {
		ID             string      `json:"id"`
		VoucherID      string      `json:"voucherId"`
		Code           *string     `json:"code"`
		Title          *string     `json:"title"`
		Type           *string     `json:"type"`
		DiscountAmount *float64    `json:"discount_amount"`
		MinPurchase    *float64    `json:"min_purchase"`
		UsageLimit     *int        `json:"usage_limit"`
		IsActive       *bool       `json:"is_active"`
		ValidUntil     interface{} `json:"valid_until"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid JSON format"})
	}

	targetID := req.ID
	if targetID == "" {
		targetID = req.VoucherID
	}
	if targetID == "" {
		targetID = c.Params("id")
	}
	if targetID == "" {
		targetID = c.Query("id")
	}
	if targetID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Voucher ID is required"})
	}

	var validUntilArg interface{} = nil
	updateValidUntil := false
	if req.ValidUntil != nil {
		updateValidUntil = true
		strVal := strings.TrimSpace(fmt.Sprintf("%v", req.ValidUntil))
		if strVal != "" && strVal != "<nil>" && strVal != "null" {
			if t, err := time.Parse(time.RFC3339, strVal); err == nil {
				validUntilArg = t
			} else if t, err := time.Parse("2006-01-02", strVal); err == nil {
				validUntilArg = t
			} else {
				validUntilArg = strVal
			}
		} else {
			validUntilArg = nil
		}
	}

	query := `
		UPDATE vouchers SET
			code = COALESCE($1, code),
			title = COALESCE($2, title),
			type = COALESCE($3, type),
			discount_amount = COALESCE($4, discount_amount),
			min_purchase = COALESCE($5, min_purchase),
			usage_limit = COALESCE($6, usage_limit),
			is_active = COALESCE($7, is_active),
			valid_until = CASE WHEN $8::boolean THEN $9::timestamptz ELSE valid_until END
		WHERE id::text = $10
		RETURNING id::text, code, title, type, discount_amount, min_purchase, valid_until, usage_limit, used_count, is_active, created_at
	`

	var updated models.Voucher
	err = config.DB.QueryRow(
		query,
		req.Code, req.Title, req.Type, req.DiscountAmount, req.MinPurchase,
		req.UsageLimit, req.IsActive, updateValidUntil, validUntilArg,
		targetID,
	).Scan(
		&updated.ID, &updated.Code, &updated.Title, &updated.Type,
		&updated.DiscountAmount, &updated.MinPurchase, &updated.ValidUntil,
		&updated.UsageLimit, &updated.UsedCount, &updated.IsActive, &updated.CreatedAt,
	)

	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update voucher: " + err.Error()})
	}

	return c.JSON(fiber.Map{"success": true, "message": "Voucher updated successfully", "voucher": updated})
}

// DeleteVoucher deletes a voucher
func DeleteVoucher(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(500).JSON(fiber.Map{"error": "Database not initialized"})
	}

	authHeader := c.Get("Authorization")
	user, err := middleware.ParseSupabaseToken(authHeader)
	if err != nil || (user.Role != "admin" && user.Role != "superadmin") {
		return c.Status(403).JSON(fiber.Map{"error": "Admin access required"})
	}

	id := c.Query("id")
	if id == "" {
		id = c.Params("id")
	}
	if id == "" {
		var req struct {
			ID string `json:"id"`
		}
		_ = c.BodyParser(&req)
		id = req.ID
	}
	if id == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Voucher ID is required"})
	}

	_, err = config.DB.Exec("DELETE FROM vouchers WHERE id::text = $1", id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete voucher: " + err.Error()})
	}

	return c.JSON(fiber.Map{"success": true, "message": "Voucher deleted successfully"})
}
