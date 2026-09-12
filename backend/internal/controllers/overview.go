package controllers

import (
	"database/sql"
	"encoding/json"
	"xar-backend-go/internal/config"

	"github.com/gofiber/fiber/v2"
)

type WeeklyRevenuePoint struct {
	Day    string  `json:"day"`
	Amount float64 `json:"amount"`
}

// GetAdminOverview computes real database-driven analytics for Admin Overview tab
// Supports both Web Next.js Dashboard and Android Mobile App
func GetAdminOverview(c *fiber.Ctx) error {
	c.Set("Cache-Control", "no-cache, no-store, must-revalidate")
	c.Set("Pragma", "no-cache")
	c.Set("Expires", "0")

	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   "Database not initialized",
		})
	}

	var totalRevenue float64
	var totalOrders int
	var totalCustomers int
	var pendingShipment int

	// 1. Total Revenue & Total Orders
	err := config.DB.QueryRow(`
		SELECT COALESCE(SUM(gross_amount), 0), COUNT(*)
		FROM orders
		WHERE LOWER(status) IN ('paid', 'processing', 'shipped', 'delivered', 'completed', 'success', 'settlement', 'shipping', 'capture')
	`).Scan(&totalRevenue, &totalOrders)
	if err != nil || totalRevenue == 0 {
		_ = config.DB.QueryRow(`
			SELECT COALESCE(SUM(total_amount), 0), COUNT(*)
			FROM orders
			WHERE LOWER(status) IN ('paid', 'processing', 'shipped', 'delivered', 'completed', 'success', 'settlement', 'shipping', 'capture')
		`).Scan(&totalRevenue, &totalOrders)
	}

	// 2. Total Registered Customers from profiles table
	_ = config.DB.QueryRow(`SELECT COUNT(*) FROM profiles`).Scan(&totalCustomers)

	// 3. Pending Shipment Count
	_ = config.DB.QueryRow(`
		SELECT COUNT(*)
		FROM orders
		WHERE LOWER(status) IN ('paid', 'processing')
	`).Scan(&pendingShipment)

	// 4. Active Products Count (products marked is_available = true or published)
	var activeProducts int
	_ = config.DB.QueryRow(`
		SELECT COUNT(*) 
		FROM products 
		WHERE is_available = true OR LOWER(COALESCE(status, 'published')) IN ('published', 'active')
	`).Scan(&activeProducts)

	// 5. Low stock threshold from store_config or default 5
	lowStockThreshold := 5
	var thresholdVal int
	if err := config.DB.QueryRow(`SELECT COALESCE(low_stock_threshold, 5) FROM store_config LIMIT 1`).Scan(&thresholdVal); err == nil && thresholdVal > 0 {
		lowStockThreshold = thresholdVal
	}

	// 6. Low stock count across all variants of products (from products.variants JSONB)
	lowStockCount := 0
	rowsStock, errStock := config.DB.Query(`SELECT variants FROM products WHERE variants IS NOT NULL`)
	if errStock == nil && rowsStock != nil {
		defer rowsStock.Close()
		for rowsStock.Next() {
			var rawVariants []byte
			if err := rowsStock.Scan(&rawVariants); err == nil && len(rawVariants) > 0 {
				var variants []map[string]interface{}
				if json.Unmarshal(rawVariants, &variants) == nil {
					isProductLow := false
					for _, v := range variants {
						stk := 0
						if val, ok := v["stock"]; ok {
							switch n := val.(type) {
							case float64:
								stk = int(n)
							case int:
								stk = n
							}
						} else if val, ok := v["stok"]; ok {
							switch n := val.(type) {
							case float64:
								stk = int(n)
							case int:
								stk = n
							}
						}
						if stk <= lowStockThreshold {
							isProductLow = true
							break
						}
					}
					if isProductLow {
						lowStockCount++
					}
				}
			}
		}
	}

	// 7. Average Order Value
	aov := 0.0
	if totalOrders > 0 {
		aov = totalRevenue / float64(totalOrders)
	}

	// 8. Real Weekly Revenue by Day of Week for the last 7 days (for Android App Analytics)
	dayAmounts := map[int]float64{
		1: 0.0, 2: 0.0, 3: 0.0, 4: 0.0, 5: 0.0, 6: 0.0, 7: 0.0,
	}

	rows, errWeekly := config.DB.Query(`
		SELECT EXTRACT(ISODOW FROM created_at)::int AS dow, COALESCE(SUM(COALESCE(gross_amount, total_amount, 0)), 0) AS total
		FROM orders
		WHERE LOWER(status) IN ('paid', 'processing', 'shipped', 'delivered', 'completed', 'success', 'settlement', 'shipping', 'capture')
		  AND created_at >= NOW() - INTERVAL '7 days'
		GROUP BY dow
	`)
	if errWeekly == nil && rows != nil {
		defer rows.Close()
		for rows.Next() {
			var dow int
			var total sql.NullFloat64
			if err := rows.Scan(&dow, &total); err == nil && total.Valid {
				dayAmounts[dow] = total.Float64
			}
		}
	}

	daysOrder := []struct {
		id   int
		name string
	}{
		{1, "Sen"},
		{2, "Sel"},
		{3, "Rab"},
		{4, "Kam"},
		{5, "Jum"},
		{6, "Sab"},
		{7, "Min"},
	}

	weeklyPoints := make([]WeeklyRevenuePoint, 0, 7)
	for _, d := range daysOrder {
		weeklyPoints = append(weeklyPoints, WeeklyRevenuePoint{
			Day:    d.name,
			Amount: dayAmounts[d.id],
		})
	}

	resMap := fiber.Map{
		"success":              true,
		"totalRevenue":         totalRevenue,
		"total_revenue":        totalRevenue,
		"totalOrders":          totalOrders,
		"total_orders":         totalOrders,
		"totalCustomers":       totalCustomers,
		"total_customers":      totalCustomers,
		"averageOrderValue":    aov,
		"average_order_value":  aov,
		"pendingShipmentCount": pendingShipment,
		"pending_shipment":     pendingShipment,
		"activeProducts":       activeProducts,
		"active_products":      activeProducts,
		"lowStockCount":        lowStockCount,
		"low_stock_count":      lowStockCount,
		"lowStockThreshold":    lowStockThreshold,
		"weeklyRevenue":        weeklyPoints,
		"weekly_revenue":       weeklyPoints,
	}

	// Also embed identical data inside "data" key for client flexibility
	dataCopy := make(fiber.Map)
	for k, v := range resMap {
		dataCopy[k] = v
	}
	resMap["data"] = dataCopy

	return c.JSON(resMap)
}
