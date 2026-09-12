package controllers

import (
	"encoding/json"
	"xar-backend-go/internal/config"

	"github.com/gofiber/fiber/v2"
)

// GetAdminOverview computes dashboard statistics for admin (revenue, orders, products, low stock)
func GetAdminOverview(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Database not initialized",
		})
	}

	// 1. Total Revenue from successful/paid orders
	var totalRevenue float64
	_ = config.DB.QueryRow(`
		SELECT COALESCE(SUM(amount), 0)
		FROM orders
		WHERE LOWER(status) IN ('paid', 'success', 'settlement', 'delivered', 'completed', 'processing', 'shipped', 'shipping', 'capture')
	`).Scan(&totalRevenue)

	// 2. Total Orders
	var totalOrders int
	_ = config.DB.QueryRow(`SELECT COUNT(*) FROM orders`).Scan(&totalOrders)

	// 3. Active Products count
	var activeProducts int
	_ = config.DB.QueryRow(`SELECT COUNT(*) FROM products WHERE LOWER(COALESCE(status, 'active')) = 'active'`).Scan(&activeProducts)

	// 4. Low stock threshold from store_config or default 5
	lowStockThreshold := 5
	var thresholdVal int
	if err := config.DB.QueryRow(`SELECT COALESCE(low_stock_threshold, 5) FROM store_config WHERE id = 'main'`).Scan(&thresholdVal); err == nil && thresholdVal > 0 {
		lowStockThreshold = thresholdVal
	}

	// 5. Low stock count across all variants of products
	lowStockCount := 0
	rows, err := config.DB.Query(`SELECT variants FROM products WHERE variants IS NOT NULL`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var rawVariants []byte
			if err := rows.Scan(&rawVariants); err == nil && len(rawVariants) > 0 {
				var variants []map[string]interface{}
				if json.Unmarshal(rawVariants, &variants) == nil {
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
							lowStockCount++
						}
					}
				}
			}
		}
	}

	overviewData := fiber.Map{
		"totalRevenue":      totalRevenue,
		"total_revenue":     totalRevenue,
		"totalOrders":       totalOrders,
		"total_orders":      totalOrders,
		"activeProducts":    activeProducts,
		"active_products":   activeProducts,
		"lowStockCount":     lowStockCount,
		"low_stock_count":   lowStockCount,
		"lowStockThreshold": lowStockThreshold,
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    overviewData,
	})
}
