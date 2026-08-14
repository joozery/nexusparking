@echo off
title Parking System Installer
echo ========================================
echo   ติดตั้งระบบจอดรถ - Parking System
echo ========================================
echo.

:: ตรวจสอบว่ารันด้วย Admin
net session >nul 2>&1
if %errorLevel% neq 0 (
  echo [ERROR] กรุณารันด้วย Administrator
  echo คลิกขวา install-windows.bat แล้วเลือก "Run as administrator"
  pause
  exit /b 1
)

cd /d "%~dp0"
echo [1/5] ติดตั้ง dependencies...
call npm install
if %errorLevel% neq 0 ( echo [ERROR] npm install ล้มเหลว & pause & exit /b 1 )

echo.
echo [2/5] Build โปรเจค...
call npm run build
if %errorLevel% neq 0 ( echo [ERROR] npm build ล้มเหลว & pause & exit /b 1 )

echo.
echo [3/5] ติดตั้ง PM2...
call npm install -g pm2
call npm install -g pm2-windows-startup
if %errorLevel% neq 0 ( echo [ERROR] ติดตั้ง PM2 ล้มเหลว & pause & exit /b 1 )

echo.
echo [4/5] เริ่มต้น services...
call pm2 start ecosystem.config.js
call pm2 save

echo.
echo [5/5] ตั้งค่า auto-start เมื่อเปิดเครื่อง...
call pm2-startup install

echo.
echo ========================================
echo   ติดตั้งสำเร็จ!
echo   - ระบบจอดรถ:   http://localhost:3000
echo   - Barrier API: http://localhost:8080
echo ========================================
pause
