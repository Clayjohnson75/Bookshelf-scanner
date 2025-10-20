# 📚 Bookshelf Scanner

An AI-powered bookshelf scanner that uses OpenAI's Vision API to automatically detect and catalog books from photos.

## ✨ Features

- **Live Camera Scanning**: Real-time book detection using your device's camera
- **Photo Upload**: Upload HEIC/JPEG images of your bookshelf
- **AI-Powered Detection**: Uses OpenAI Vision API for accurate book title recognition
- **Classy Design**: Sophisticated, elegant interface with luxury aesthetics
- **Library Management**: Search, export, and manage your book collection
- **HEIC Support**: Automatic conversion of iPhone HEIC photos to JPEG

## 🚀 Quick Start

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/Clayjohnson75/Bookshelf-scanner.git
   cd Bookshelf-scanner
   ```

2. **Set up environment variables**
   ```bash
   export OPENAI_API_KEY="your_openai_api_key_here"
   ```

3. **Install Python dependencies**
   ```bash
   pip install pillow pillow-heif
   ```

4. **Start the server**
   ```bash
   python proxy-server.py
   ```

5. **Open your browser**
   Navigate to `http://localhost:8080`

### Vercel Deployment

1. **Fork this repository** on GitHub
2. **Connect to Vercel** and import your fork
3. **Add environment variable** in Vercel dashboard:
   - `OPENAI_API_KEY`: Your OpenAI API key
4. **Deploy** - Vercel will automatically build and deploy

## 🔧 Configuration

### Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key (required)

### API Key Setup

1. Get your API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. For local development: Set the environment variable
3. For Vercel: Add it in your project's environment variables

### Browser Compatibility
- Chrome 60+ (recommended)
- Firefox 55+
- Safari 11+
- Edge 79+

## Privacy & Data

- All book data is stored locally in your browser
- No personal data is sent to external servers
- Only book titles are sent to Google Books API for identification
- Camera feed is processed locally and never transmitted

## Tips for Best Results

### Camera Scanning
- Ensure good lighting on your bookshelf
- Hold camera steady for a few seconds
- Position camera so book spines are clearly visible
- Try different angles if books aren't detected

### Photo Upload
- Use high-resolution photos for better text recognition
- Ensure book spines are clearly visible and well-lit
- Avoid blurry or angled photos
- Close-up photos of individual shelves work better than full bookcase shots

## Troubleshooting

### Camera Not Working
- Ensure you've granted camera permissions
- Try refreshing the page and allowing permissions again
- Check if other applications are using the camera
- Use HTTPS (required for camera access)

### Books Not Detected
- Improve lighting conditions
- Move closer to the bookshelf
- Ensure book spines are clearly visible
- Try different angles or positions

### API Rate Limits
- The app includes delays to avoid overwhelming book APIs
- If you encounter rate limits, wait a few minutes before continuing

## Future Enhancements

- Barcode scanning for more accurate identification
- Integration with additional book databases
- Social features for sharing libraries
- Advanced filtering and sorting options
- Book recommendation engine

## License

MIT License - Feel free to modify and distribute as needed.

