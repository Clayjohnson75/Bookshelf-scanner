// Vercel serverless function for HEIC to JPEG conversion
import sharp from 'sharp';

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Get the file from the request
        const { file } = req.body;
        
        if (!file) {
            return res.status(400).json({ error: 'No file provided' });
        }

        // Convert base64 to buffer
        const fileBuffer = Buffer.from(file.split(',')[1], 'base64');
        
        // Use Sharp to convert HEIC to JPEG
        const jpegBuffer = await sharp(fileBuffer)
            .jpeg({ quality: 90 })
            .toBuffer();
        
        // Convert back to base64 data URL
        const jpegBase64 = jpegBuffer.toString('base64');
        const jpegDataUrl = `data:image/jpeg;base64,${jpegBase64}`;
        
        res.status(200).json({
            success: true,
            jpegDataUrl: jpegDataUrl
        });
        
    } catch (error) {
        console.error('HEIC conversion error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}
