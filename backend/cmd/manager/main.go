package main

import (
	"context"
	"database/sql"
	"embed"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"time"

	"github.com/gogpu/systray"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/joho/godotenv"
	"github.com/skip2/go-qrcode"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/store/sqlstore"
	waLog "go.mau.fi/whatsmeow/util/log"
)

//go:embed web/*
var webFiles embed.FS

//go:embed icon.png
var iconBytes []byte

var (
	currentTray *systray.SystemTray
	waClient    *whatsmeow.Client
)

func main() {
	loadEnv()

	isSilent := false
	for _, arg := range os.Args[1:] {
		if strings.EqualFold(arg, "--silent") {
			isSilent = true
		}
	}

	// 1. Check if manager is already running on port 9099
	resp, err := http.Get("http://127.0.0.1:9099/api/status")
	if err == nil && resp.StatusCode == 200 {
		_ = resp.Body.Close()
		if !isSilent {
			launchAppWindow("http://127.0.0.1:9099")
		}
		return
	}

	// 2. Start HTTP GUI Engine on port 9099
	mux := http.NewServeMux()

	mux.HandleFunc("/", handleIndex)
	mux.HandleFunc("/api/status", handleStatus)
	mux.HandleFunc("/api/logs", handleLogs)
	mux.HandleFunc("/api/action/restart", handleRestart)
	mux.HandleFunc("/api/action/stop", handleStop)
	mux.HandleFunc("/api/action/start", handleStart)
	mux.HandleFunc("/api/action/exit", handleExit)
	mux.HandleFunc("/api/whatsapp/qr", handleWhatsAppQR)

	server := &http.Server{
		Addr:    "127.0.0.1:9099",
		Handler: mux,
	}

	go func() {
		_ = server.ListenAndServe()
	}()

	time.Sleep(150 * time.Millisecond)

	// 3. Launch Standalone Native Window (unless silent)
	if !isSilent {
		go launchAppWindow("http://127.0.0.1:9099")
	}

	// 4. Run Native Windows Notification Area System Tray
	runSystemTray()
}

func runSystemTray() {
	currentTray = systray.New()
	if len(iconBytes) > 0 {
		currentTray.SetIcon(iconBytes)
	}
	currentTray.SetTooltip("MAMEKO Server Manager")

	// Left click or double click opens the dashboard
	currentTray.OnClick(func() {
		launchAppWindow("http://127.0.0.1:9099")
	})
	currentTray.OnDoubleClick(func() {
		launchAppWindow("http://127.0.0.1:9099")
	})

	menu := systray.NewMenu()
	menu.Add("📊 Buka Dashboard", func() {
		launchAppWindow("http://127.0.0.1:9099")
	})
	menu.Add("🌐 Buka Toko (mameko.my.id)", func() {
		_ = exec.Command("rundll32", "url.dll,FileProtocolHandler", "https://mameko.my.id").Start()
	})
	menu.Add("⚡ Restart Layanan", func() {
		c := exec.Command("pm2", "restart", "all")
		c.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
		_ = c.Run()
	})
	menu.AddSeparator()
	menu.Add("❌ Keluar", func() {
		if currentTray != nil {
			currentTray.Remove()
		}
		os.Exit(0)
	})

	currentTray.SetMenu(menu)
	currentTray.Show()

	_ = currentTray.Run()
}

func loadEnv() {
	var envPaths []string

	if exe, err := os.Executable(); err == nil {
		exeDir := filepath.Dir(exe)
		envPaths = append(envPaths,
			filepath.Join(exeDir, ".env.local"),
			filepath.Join(exeDir, "backend", ".env.local"),
		)
	}

	_, thisFile, _, ok := runtime.Caller(0)
	if ok {
		backendDir := filepath.Join(filepath.Dir(thisFile), "..", "..")
		projectRoot := filepath.Join(backendDir, "..")
		envPaths = append(envPaths,
			filepath.Join(backendDir, ".env.local"),
			filepath.Join(projectRoot, ".env.local"),
		)
	}

	envPaths = append(envPaths, ".env.local", "../.env.local", "backend/.env.local")

	for _, p := range envPaths {
		if _, err := os.Stat(p); err == nil {
			_ = godotenv.Load(p)
			break
		}
	}
}

func launchAppWindow(targetURL string) {
	edgePaths := []string{
		`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`,
		`C:\Program Files\Microsoft\Edge\Application\msedge.exe`,
		`C:\Program Files\Google\Chrome\Application\chrome.exe`,
	}

	tempUserData := filepath.Join(os.TempDir(), "mameko-manager-edge")

	for _, p := range edgePaths {
		if _, err := os.Stat(p); err == nil {
			cmd := exec.Command(p,
				fmt.Sprintf("--app=%s", targetURL),
				fmt.Sprintf("--user-data-dir=%s", tempUserData),
				"--window-size=1080,780",
				"--no-first-run",
				"--no-default-browser-check",
			)
			if err := cmd.Start(); err == nil {
				return
			}
		}
	}

	// Fallback to default browser
	_ = exec.Command("rundll32", "url.dll,FileProtocolHandler", targetURL).Start()
}

func handleIndex(w http.ResponseWriter, r *http.Request) {
	data, err := webFiles.ReadFile("web/index.html")
	if err != nil {
		http.Error(w, "Dashboard file missing", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write(data)
}

func handleStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	backendOnline := false
	resp, err := http.Get("http://127.0.0.1:8080/api/health")
	if err == nil && resp.StatusCode == 200 {
		backendOnline = true
		_ = resp.Body.Close()
	}

	type PM2App struct {
		Name   string `json:"name"`
		Pid    int    `json:"pid"`
		Pm2Env struct {
			Status string `json:"status"`
			Uptime int64  `json:"pm_uptime"`
		} `json:"pm2_env"`
		Monit struct {
			Memory int64 `json:"memory"`
			CPU    int   `json:"cpu"`
		} `json:"monit"`
	}

	var apps []PM2App
	cmd := exec.Command("pm2", "jlist")
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	if out, err := cmd.Output(); err == nil {
		_ = json.Unmarshal(out, &apps)
	}

	apiStatus := "offline"
	apiPid := 0
	apiMem := "-"
	apiUptime := "-"

	tunnelStatus := "offline"
	tunnelPid := 0

	for _, app := range apps {
		if app.Name == "mameko-api" {
			apiStatus = app.Pm2Env.Status
			apiPid = app.Pid
			if app.Monit.Memory > 0 {
				apiMem = fmt.Sprintf("%.1f MB", float64(app.Monit.Memory)/(1024*1024))
			}
			if app.Pm2Env.Uptime > 0 {
				duration := time.Since(time.Unix(app.Pm2Env.Uptime/1000, 0))
				apiUptime = formatDuration(duration)
			}
		} else if app.Name == "mameko-tunnel" {
			tunnelStatus = app.Pm2Env.Status
			tunnelPid = app.Pid
		}
	}

	waStatus := "disconnected"
	if waClient != nil && waClient.IsConnected() && waClient.IsLoggedIn() {
		waStatus = "connected"
	}

	if backendOnline && apiStatus != "online" {
		apiStatus = "online"
	}

	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"backend_online": backendOnline,
		"api": map[string]interface{}{
			"status": apiStatus,
			"pid":    apiPid,
			"memory": apiMem,
			"uptime": apiUptime,
		},
		"tunnel": map[string]interface{}{
			"status": tunnelStatus,
			"pid":    tunnelPid,
			"url":    "https://api.mameko.my.id",
		},
		"whatsapp": map[string]interface{}{
			"status": waStatus,
		},
		"api_status":     apiStatus,
		"api_pid":        apiPid,
		"api_memory":     apiMem,
		"api_uptime":     apiUptime,
		"tunnel_status":  tunnelStatus,
		"tunnel_pid":     tunnelPid,
		"tunnel_url":     "https://api.mameko.my.id",
		"store_url":      "https://mameko.my.id",
		"wa_status":      waStatus,
	})
}

func formatDuration(d time.Duration) string {
	hours := int(d.Hours())
	minutes := int(d.Minutes()) % 60
	if hours > 0 {
		return fmt.Sprintf("%dj %dm", hours, minutes)
	}
	return fmt.Sprintf("%dm", minutes)
}

func handleLogs(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")

	target := r.URL.Query().Get("type")
	if target == "" {
		target = r.URL.Query().Get("target")
	}

	exePath, _ := os.Executable()
	backendDir := filepath.Join(filepath.Dir(exePath), "backend")
	if _, err := os.Stat(backendDir); err != nil {
		backendDir = filepath.Dir(exePath)
	}

	homeDir, _ := os.UserHomeDir()
	pm2LogsDir := filepath.Join(homeDir, ".pm2", "logs")

	var content string
	if target == "tunnel" {
		content = readTail(filepath.Join(pm2LogsDir, "mameko-tunnel-error.log"), 60)
		if strings.Contains(content, "belum tersedia") {
			content = readTail(filepath.Join(backendDir, "tunnel.log"), 60)
		}
	} else if target == "backend" {
		content = readTail(filepath.Join(pm2LogsDir, "mameko-api-out.log"), 60)
		if strings.Contains(content, "belum tersedia") {
			content = readTail(filepath.Join(backendDir, "backend.log"), 60)
		}
	} else {
		bLog := readTail(filepath.Join(pm2LogsDir, "mameko-api-out.log"), 35)
		tLog := readTail(filepath.Join(pm2LogsDir, "mameko-tunnel-error.log"), 25)
		content = fmt.Sprintf("=== BACKEND LOG ===\n%s\n\n=== TUNNEL LOG ===\n%s", bLog, tLog)
	}

	_, _ = w.Write([]byte(content))
}

func readTail(path string, linesCount int) string {
	data, err := os.ReadFile(path)
	if err != nil {
		return fmt.Sprintf("[Log file %s belum tersedia]", filepath.Base(path))
	}
	lines := strings.Split(string(data), "\n")
	if len(lines) > linesCount {
		lines = lines[len(lines)-linesCount:]
	}
	return strings.Join(lines, "\n")
}

func handleRestart(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	cmd := exec.Command("pm2", "restart", "all")
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	_ = cmd.Run()
	_ = json.NewEncoder(w).Encode(map[string]string{"message": "Semua layanan berhasil direstart via PM2!"})
}

func handleStop(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	cmd := exec.Command("pm2", "stop", "all")
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	_ = cmd.Run()
	_ = json.NewEncoder(w).Encode(map[string]string{"message": "Layanan berhasil dihentikan."})
}

func handleStart(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	cmd := exec.Command("pm2", "start", "all")
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	_ = cmd.Run()
	_ = json.NewEncoder(w).Encode(map[string]string{"message": "Layanan berhasil dijalankan."})
}

func handleExit(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"message": "Manager app exiting."})
	go func() {
		time.Sleep(300 * time.Millisecond)
		if currentTray != nil {
			currentTray.Remove()
		}
		os.Exit(0)
	}()
}

func handleWhatsAppQR(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		_ = json.NewEncoder(w).Encode(map[string]string{"message": "DATABASE_URL belum dikonfigurasi."})
		return
	}

	db, err := sql.Open("pgx", dbURL)
	if err != nil {
		_ = json.NewEncoder(w).Encode(map[string]string{"message": "Gagal koneksi database."})
		return
	}
	defer db.Close()

	dbLog := waLog.Stdout("Database", "ERROR", true)
	container := sqlstore.NewWithDB(db, "postgres", dbLog)
	if err := container.Upgrade(context.Background()); err != nil {
		_ = json.NewEncoder(w).Encode(map[string]string{"message": "Gagal upgrade DB WhatsApp."})
		return
	}

	// Delete old device to force QR
	devices, err := container.GetAllDevices(context.Background())
	if err == nil {
		for _, d := range devices {
			_ = d.Delete(context.Background())
		}
	}

	device := container.NewDevice()
	clientLog := waLog.Stdout("WhatsApp", "WARN", true)
	waClient = whatsmeow.NewClient(device, clientLog)

	qrChan, _ := waClient.GetQRChannel(context.Background())
	if err := waClient.Connect(); err != nil {
		_ = json.NewEncoder(w).Encode(map[string]string{"message": "Gagal menghubungkan WhatsApp gateway."})
		return
	}

	select {
	case evt := <-qrChan:
		if evt.Event == "code" {
			pngBytes, err := qrcode.Encode(evt.Code, qrcode.Medium, 256)
			if err == nil {
				dataURL := "data:image/png;base64," + base64.StdEncoding.EncodeToString(pngBytes)
				_ = json.NewEncoder(w).Encode(map[string]string{"qr": dataURL})
				return
			}
		}
	case <-time.After(8 * time.Second):
	}

	_ = json.NewEncoder(w).Encode(map[string]string{"message": "Waktu pembuatan QR habis, silakan coba lagi."})
}
