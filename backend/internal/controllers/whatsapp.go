package controllers

import (
	"strings"

	"xar-backend-go/internal/whatsapp"

	"github.com/gofiber/fiber/v2"
)

// GetWhatsAppStatus returns current WhatsApp gateway connection status
func GetWhatsAppStatus(c *fiber.Ctx) error {
	status := whatsapp.GetStatus()
	return c.JSON(fiber.Map{
		"success": true,
		"data":    status,
	})
}

// GetWhatsAppQR returns a valid QR code data URL (or status if already logged in)
func GetWhatsAppQR(c *fiber.Ctx) error {
	resp, err := whatsapp.GetQRCode()
	if err != nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"error":   err.Error(),
			"data":    resp,
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    resp,
	})
}

// LogoutWhatsApp disconnects WhatsApp session and prepares for fresh login
func LogoutWhatsApp(c *fiber.Ctx) error {
	err := whatsapp.LogoutWhatsApp()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "WhatsApp session logged out and restarted successfully",
	})
}

// TestSendWhatsApp allows admin to test sending a WhatsApp message
func TestSendWhatsApp(c *fiber.Ctx) error {
	var req struct {
		Phone   string `json:"phone"`
		Message string `json:"message"`
	}
	if err := c.BodyParser(&req); err != nil || strings.TrimSpace(req.Phone) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   "Nomor telepon tujuan wajib diisi",
		})
	}

	msg := req.Message
	if strings.TrimSpace(msg) == "" {
		msg = "Halo! Ini adalah pesan uji coba dari sistem Mameko WhatsApp Gateway."
	}

	err := whatsapp.SendMessage(req.Phone, msg)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   "Gagal mengirim pesan WhatsApp: " + err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Pesan uji coba berhasil terkirim ke " + req.Phone,
	})
}
