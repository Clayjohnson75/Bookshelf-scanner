// Vercel serverless function for HEIC to JPEG conversion
// Using a different approach that works reliably

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

module.exports = async function handler(req, res) {
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
        const { file } = req.body;
        
        if (!file) {
            return res.status(400).json({ error: 'No file provided' });
        }

        // Convert base64 to buffer
        const fileBuffer = Buffer.from(file.split(',')[1], 'base64');
        
        // Create temporary files
        const tempDir = '/tmp';
        const inputPath = path.join(tempDir, `input_${Date.now()}.heic`);
        const outputPath = path.join(tempDir, `output_${Date.now()}.jpg`);
        
        // Write input file
        fs.writeFileSync(inputPath, fileBuffer);
        
        // Use ImageMagick to convert HEIC to JPEG
        const convertCommand = `convert "${inputPath}" "${outputPath}"`;
        
        await new Promise((resolve, reject) => {
            exec(convertCommand, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(`ImageMagick conversion failed: ${error.message}`));
                } else {
                    resolve();
                }
            });
        });
        
        // Read converted file
        const jpegBuffer = fs.readFileSync(outputPath);
        const jpegBase64 = jpegBuffer.toString('base64');
        const jpegDataUrl = `data:image/jpeg;base64,${jpegBase64}`;
        
        // Clean up temp files
        try {
            fs.unlinkSync(inputPath);
            fs.unlinkSync(outputPath);
        } catch (cleanupError) {
            console.warn('Failed to clean up temp files:', cleanupError);
        }
        
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
