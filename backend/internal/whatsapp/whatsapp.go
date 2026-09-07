package whatsapp

import (
	"context"
	"encoding/base64"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"xar-backend-go/internal/config"

	"github.com/skip2/go-qrcode"
	"go.mau.fi/whatsmeow"
	waProto "go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	waLog "go.mau.fi/whatsmeow/util/log"
	"google.golang.org/protobuf/proto"
)

var (
	Client    *whatsmeow.Client
	container *sqlstore.Container

	stateLock     sync.RWMutex
	qrBase64      string
	qrRawCode     string
	qrExpiresAt   time.Time
	qrChanRunning bool
)

type WhatsAppStatus struct {
	Connected bool   `json:"connected"`
	LoggedIn  bool   `json:"loggedIn"`
	Phone     string `json:"phone,omitempty"`
	JID       string `json:"jid,omitempty"`
	HasQR     bool   `json:"hasQr"`
}

type WhatsAppQRResponse struct {
	QR        string `json:"qr,omitempty"`
	Expiry    int64  `json:"expiry,omitempty"`
	Seconds   int    `json:"seconds,omitempty"`
	Connected bool   `json:"connected"`
	LoggedIn  bool   `json:"loggedIn"`
}

// InitWhatsApp initializes the WhatsApp client using the existing Supabase Postgres DB
func InitWhatsApp() error {
	if config.DB == nil {
		return fmt.Errorf("database not initialized, cannot start WhatsApp store")
	}

	dbLog := waLog.Stdout("Database", "WARN", true)

	var err error
	container = sqlstore.NewWithDB(config.DB, "postgres", dbLog)
	err = container.Upgrade(context.Background())
	if err != nil {
		return fmt.Errorf("failed to upgrade WhatsApp store: %v", err)
	}

	deviceStore, err := container.GetFirstDevice(context.Background())
	if err != nil {
		return fmt.Errorf("failed to get WhatsApp device store: %v", err)
	}

	clientLog := waLog.Stdout("WhatsApp", "INFO", true)
	Client = whatsmeow.NewClient(deviceStore, clientLog)

	if Client.Store.ID == nil {
		// Device not logged in, prepare QR channel
		log.Println("📱 [WhatsApp] Belum ada sesi WhatsApp yang tersimpan. Menunggu login...")
		startQRListener()
	} else {
		// Device already logged in, connect directly
		err = Client.Connect()
		if err != nil {
			return fmt.Errorf("failed to connect WhatsApp client: %v", err)
		}
		log.Printf("✅ WhatsApp Gateway (whatsmeow) terhubung sebagai: %s\n", Client.Store.ID.User)
	}

	return nil
}

func startQRListener() {
	stateLock.Lock()
	if qrChanRunning {
		stateLock.Unlock()
		return
	}
	qrChanRunning = true
	stateLock.Unlock()

	go func() {
		defer func() {
			stateLock.Lock()
			qrChanRunning = false
			stateLock.Unlock()
		}()

		if Client == nil {
			return
		}

		if Client.IsConnected() {
			Client.Disconnect()
		}

		qrChan, err := Client.GetQRChannel(context.Background())
		if err != nil {
			log.Printf("⚠️ [WhatsApp] Gagal membuka channel QR: %v\n", err)
			return
		}

		err = Client.Connect()
		if err != nil {
			log.Printf("⚠️ [WhatsApp] Gagal connect saat inisialisasi QR: %v\n", err)
			return
		}

		for evt := range qrChan {
			if evt.Event == "code" {
				pngBytes, encErr := qrcode.Encode(evt.Code, qrcode.Medium, 300)
				stateLock.Lock()
				qrRawCode = evt.Code
				if encErr == nil {
					qrBase64 = "data:image/png;base64," + base64.StdEncoding.EncodeToString(pngBytes)
				}
				// Gunakan durasi timeout event atau fallback 120 detik
				timeout := evt.Timeout
				if timeout < 60*time.Second {
					timeout = 120 * time.Second
				}
				qrExpiresAt = time.Now().Add(timeout)
				stateLock.Unlock()

				log.Println("📷 [WhatsApp] QR Code baru siap untuk dipindai dari admin dashboard.")
			} else if evt.Event == "success" {
				stateLock.Lock()
				qrBase64 = ""
				qrRawCode = ""
				qrExpiresAt = time.Time{}
				stateLock.Unlock()
				if Client.Store.ID != nil {
					log.Printf("🎉 [WhatsApp] Berhasil login sebagai: %s\n", Client.Store.ID.User)
				}
			} else {
				log.Printf("ℹ️ [WhatsApp] Event status: %s\n", evt.Event)
			}
		}
	}()
}

// GetStatus returns the current connection and login status of WhatsApp
func GetStatus() WhatsAppStatus {
	if Client == nil {
		return WhatsAppStatus{Connected: false, LoggedIn: false}
	}

	loggedIn := Client.Store != nil && Client.Store.ID != nil
	connected := Client.IsConnected()
	phone := ""
	jid := ""
	if loggedIn {
		phone = Client.Store.ID.User
		jid = Client.Store.ID.String()
	}

	stateLock.RLock()
	hasQR := qrBase64 != "" && time.Now().Before(qrExpiresAt)
	stateLock.RUnlock()

	return WhatsAppStatus{
		Connected: connected,
		LoggedIn:  loggedIn,
		Phone:     phone,
		JID:       jid,
		HasQR:     hasQR,
	}
}

// GetQRCode returns an active QR code image or initiates a fresh QR if expired
func GetQRCode() (WhatsAppQRResponse, error) {
	if Client == nil {
		return WhatsAppQRResponse{}, fmt.Errorf("whatsapp client not initialized")
	}

	if Client.Store != nil && Client.Store.ID != nil && Client.IsConnected() {
		return WhatsAppQRResponse{
			Connected: true,
			LoggedIn:  true,
		}, nil
	}

	stateLock.RLock()
	curQR := qrBase64
	curExp := qrExpiresAt
	stateLock.RUnlock()

	if curQR != "" && time.Now().Before(curExp) {
		remainingSec := int(time.Until(curExp).Seconds())
		return WhatsAppQRResponse{
			QR:        curQR,
			Expiry:    curExp.Unix(),
			Seconds:   remainingSec,
			Connected: Client.IsConnected(),
			LoggedIn:  false,
		}, nil
	}

	// Trigger fresh QR channel
	startQRListener()

	// Wait up to 3 seconds for the first QR event
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		time.Sleep(200 * time.Millisecond)
		stateLock.RLock()
		newQR := qrBase64
		newExp := qrExpiresAt
		stateLock.RUnlock()

		if newQR != "" && time.Now().Before(newExp) {
			remainingSec := int(time.Until(newExp).Seconds())
			return WhatsAppQRResponse{
				QR:        newQR,
				Expiry:    newExp.Unix(),
				Seconds:   remainingSec,
				Connected: Client.IsConnected(),
				LoggedIn:  false,
			}, nil
		}
	}

	return WhatsAppQRResponse{
		Connected: Client.IsConnected(),
		LoggedIn:  false,
	}, fmt.Errorf("timeout waiting for whatsapp QR code generation")
}

// LogoutWhatsApp clears device credentials and disconnects
func LogoutWhatsApp() error {
	if Client == nil {
		return fmt.Errorf("whatsapp client not initialized")
	}

	if Client.IsConnected() {
		_ = Client.Logout(context.Background())
		Client.Disconnect()
	}

	stateLock.Lock()
	qrBase64 = ""
	qrRawCode = ""
	qrExpiresAt = time.Time{}
	stateLock.Unlock()

	// Re-init for fresh QR scanning
	return InitWhatsApp()
}

// SendMessage sends a text message to a specific phone number
func SendMessage(phone string, message string) error {
	if Client == nil || !Client.IsConnected() {
		return fmt.Errorf("whatsapp client not connected")
	}

	// Format phone number to Indonesian JID
	phone = strings.ReplaceAll(phone, "+", "")
	phone = strings.ReplaceAll(phone, " ", "")
	phone = strings.ReplaceAll(phone, "-", "")
	phone = strings.TrimSpace(phone)

	if strings.HasPrefix(phone, "0") {
		phone = "62" + phone[1:]
	} else if !strings.HasPrefix(phone, "62") {
		phone = "62" + phone
	}

	targetJID := types.NewJID(phone, types.DefaultUserServer)

	msg := &waProto.Message{
		Conversation: proto.String(message),
	}

	_, err := Client.SendMessage(context.Background(), targetJID, msg)
	return err
}
