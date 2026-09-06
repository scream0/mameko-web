@echo off
echo ===================================================
echo   Memulai MAMEKO Backend dan Cloudflare Tunnel
echo   Menggunakan PM2 Process Manager (Best Practice)
echo ===================================================
cd /d "%~dp0"

call pm2 start ecosystem.config.js
call pm2 save

:: Menjalankan MamekoServer manager engine di background secara silent
start "" "%~dp0..\MamekoServer.exe" --silent

echo [OK] Layanan backend, tunnel, dan MamekoServer berhasil aktif.
