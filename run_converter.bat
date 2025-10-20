@echo off
echo 📸 HEIC to JPEG Converter
echo =========================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python is not installed. Please install Python first.
    echo    Download from: https://www.python.org/downloads/
    pause
    exit /b 1
)

REM Check if ImageMagick is installed
convert -version >nul 2>&1
if errorlevel 1 (
    echo ❌ ImageMagick is not installed.
    echo.
    echo To install ImageMagick:
    echo   Download from: https://imagemagick.org/script/download.php
    echo.
    pause
)

echo 🚀 Starting HEIC Converter...
echo.

REM Run the Python application
python heic_converter.py

pause
