package services

import (
	"database/sql"
	"encoding/json"
	"log"
	"strings"
)

// RestoreOrderStock restores product variant stock in products.variants for a cancelled order (idempotent)
func RestoreOrderStock(db *sql.DB, orderID string) error {
	if db == nil || strings.TrimSpace(orderID) == "" {
		return nil
	}

	cleanID := strings.TrimSpace(orderID)

	// Pastikan kolom stock_restored_at ada pada tabel orders
	_, _ = db.Exec(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS stock_restored_at TIMESTAMPTZ;`)

	// Cek dan tandai stock_restored_at secara atomik untuk mencegah double-restoration
	res, err := db.Exec(`
		UPDATE orders 
		SET stock_restored_at = NOW(), updated_at = NOW() 
		WHERE (id::text = $1 OR order_number = $1) AND stock_restored_at IS NULL
	`, cleanID)
	if err != nil {
		log.Printf("[Stock] Gagal update stock_restored_at untuk order %s: %v", cleanID, err)
		return err
	}

	rowsAff, _ := res.RowsAffected()
	if rowsAff == 0 {
		log.Printf("[Stock] Stok untuk order %s sudah pernah dikembalikan atau order tidak ditemukan. Melewati.", cleanID)
		return nil
	}

	rows, err := db.Query(`
		SELECT product_id, variant_name, quantity 
		FROM order_items 
		WHERE order_id::text = $1 OR order_id IN (SELECT id::text FROM orders WHERE order_number = $1 OR id::text = $1)
	`, cleanID)
	if err != nil {
		log.Printf("[Stock] Gagal query order_items untuk order %s: %v", cleanID, err)
		return err
	}
	defer rows.Close()

	type itemToRestore struct {
		productID   string
		variantName string
		quantity    int
	}

	var items []itemToRestore
	for rows.Next() {
		var it itemToRestore
		var pID, vName sql.NullString
		var qty int
		if err := rows.Scan(&pID, &vName, &qty); err == nil {
			it.productID = pID.String
			it.variantName = strings.TrimSpace(vName.String)
			it.quantity = qty
			if it.quantity <= 0 {
				it.quantity = 1
			}
			items = append(items, it)
		}
	}

	if len(items) == 0 {
		return nil
	}

	for _, it := range items {
		if it.productID == "" {
			continue
		}

		var variantsJSON []byte
		err := db.QueryRow("SELECT variants FROM products WHERE id::text = $1", it.productID).Scan(&variantsJSON)
		if err != nil || len(variantsJSON) == 0 {
			continue
		}

		var variants []map[string]interface{}
		if err := json.Unmarshal(variantsJSON, &variants); err == nil {
			updated := false
			for _, v := range variants {
				sizeVal, _ := v["size"].(string)
				// Cocokkan ukuran varian, atau jika hanya ada 1 varian produk
				if strings.EqualFold(strings.TrimSpace(sizeVal), it.variantName) || len(variants) == 1 {
					if curStock, ok := v["stock"].(float64); ok {
						v["stock"] = int(curStock) + it.quantity
						updated = true
					}
				}
			}

			if updated {
				if newVariantsBytes, err := json.Marshal(variants); err == nil {
					_, updateErr := db.Exec("UPDATE products SET variants = $1::jsonb WHERE id::text = $2", string(newVariantsBytes), it.productID)
					if updateErr != nil {
						log.Printf("[Stock] Gagal update stok produk %s: %v", it.productID, updateErr)
					} else {
						log.Printf("[Stock] Berhasil mengembalikan stok %d unit untuk produk %s varian %s", it.quantity, it.productID, it.variantName)
					}
				}
			}
		}
	}

	return nil
}
