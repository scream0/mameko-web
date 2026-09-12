@echo off
title Mameko - Backend & Cloudflare Tunnel
echo ==============================================
echo Starting Mameko Backend and Cloudflare Tunnel...
echo ==============================================

cd /d " %~dp0..\\mameko-backend\

echo [1/2] Starting Cloudflare Tunnel (HTTP2 Mode)...
if exist \cloudflared.exe\ (
 start \Cloudflare Tunnel\ cmd /c \cloudflared.exe tunnel --protocol http2 --config config.yml run \
)

echo [2/2] Starting Golang Backend...
cd cmd\\api
go run main.go

pause
