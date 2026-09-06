package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"xar-backend-go/internal/config"

	"github.com/joho/godotenv"
	"github.com/skip2/go-qrcode"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/store/sqlstore"
	waLog "go.mau.fi/whatsmeow/util/log"
)

func main() {
	_, thisFile, _, _ := runtime.Caller(0)
	projectRoot := filepath.Join(filepath.Dir(thisFile), "..", "..", "..")

	envPaths := []string{
		".env.local",
		"../.env.local",
		"../../.env.local",
		filepath.Join(projectRoot, ".env.local"),
	}

	for _, p := range envPaths {
		if _, err := os.Stat(p); err == nil {
			if err2 := godotenv.Load(p); err2 == nil {
				log.Printf("Loaded env from: %s", p)
				break
			}
		}
	}

	config.ConnectDB()
	if config.DB == nil {
		log.Fatal("Database connection failed")
	}
	defer config.DB.Close()

	dbLog := waLog.Stdout("Database", "ERROR", true)
	container := sqlstore.NewWithDB(config.DB, "postgres", dbLog)
	if err := container.Upgrade(context.Background()); err != nil {
		log.Fatalf("Failed to upgrade WhatsApp store: %v", err)
	}

	// 1. Reset / Delete old devices if requested
	devices, err := container.GetAllDevices(context.Background())
	if err == nil && len(devices) > 0 {
		fmt.Printf("Menemukan %d sesi WhatsApp lama. Menghapus sesi lama...\n", len(devices))
		for _, dev := range devices {
			_ = dev.Delete(context.Background())
		}
		fmt.Println("✅ Sesi WhatsApp lama berhasil dihapus!")
	}

	// 2. Buat device baru
	newDevice := container.NewDevice()

	clientLog := waLog.Stdout("WhatsApp", "WARN", true)
	client := whatsmeow.NewClient(newDevice, clientLog)

	qrChan, _ := client.GetQRChannel(context.Background())
	if err := client.Connect(); err != nil {
		log.Fatalf("Gagal menghubungkan WhatsApp: %v", err)
	}

	fmt.Println("\n=======================================================")
	fmt.Println("  SILAKAN SCAN QR CODE INI DENGAN NOMOR WHATSAPP BARU")
	fmt.Println("  (Buka WhatsApp -> Perangkat Tertaut -> Tautkan)")
	fmt.Println("=======================================================\n")

	for evt := range qrChan {
		if evt.Event == "code" {
			q, err := qrcode.New(evt.Code, qrcode.Low)
			if err == nil {
				fmt.Println(q.ToSmallString(false))
			}
		} else if evt.Event == "success" {
			fmt.Println("\n🎉 BERHASIL! WhatsApp nomor baru sudah terhubung!")
			jid := client.Store.ID
			if jid != nil {
				fmt.Printf("Nomor HP Terdaftar: +%s\n", strings.Split(jid.User, ".")[0])
			}
			client.Disconnect()
			return
		} else {
			fmt.Printf("Event: %s\n", evt.Event)
		}
	}
}
