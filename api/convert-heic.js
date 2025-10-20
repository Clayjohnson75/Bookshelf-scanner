const sharp = require('sharp');

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { imageData } = req.body;
        
        if (!imageData) {
            return res.status(400).json({ error: 'No image data provided' });
        }

        // Remove data URL prefix if present
        const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');

        // Convert HEIC to JPEG using Sharp
        const jpegBuffer = await sharp(imageBuffer)
            .jpeg({ quality: 90 })
            .toBuffer();

        // Convert back to base64
        const jpegBase64 = jpegBuffer.toString('base64');
        const dataUrl = `data:image/jpeg;base64,${jpegBase64}`;

        res.status(200).json({ 
            success: true, 
            dataUrl: dataUrl,
            message: 'HEIC converted to JPEG successfully'
        });

    } catch (error) {
        console.error('HEIC conversion error:', error);
        res.status(500).json({ 
            error: 'HEIC conversion failed',
            details: error.message 
        });
    }
}
