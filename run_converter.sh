#!/bin/bash
# HEIC Converter Launcher Script

echo "📸 HEIC to JPEG Converter"
echo "========================="
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3 first."
    echo "   Download from: https://www.python.org/downloads/"
    exit 1
fi

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "❌ ImageMagick is not installed."
    echo ""
    echo "To install ImageMagick:"
    echo "  Mac: brew install imagemagick"
    echo "  Windows: Download from https://imagemagick.org/script/download.php"
    echo "  Linux: sudo apt-get install imagemagick"
    echo ""
    read -p "Press Enter to continue anyway..."
fi

echo "🚀 Starting HEIC Converter..."
echo ""

# Run the Python application
python3 heic_converter.py
