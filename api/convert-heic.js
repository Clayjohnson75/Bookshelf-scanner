// Vercel serverless function for HEIC to JPEG conversion
// Using a simpler approach without Sharp to avoid build issues

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
        // For now, return an error that suggests using client-side conversion
        // This avoids build issues while we work on a better solution
        res.status(501).json({
            success: false,
            error: 'Server-side HEIC conversion not yet implemented. Please use client-side conversion or convert your HEIC file to JPEG manually.',
            suggestion: 'Try taking a screenshot instead (CMD+Shift+4 on Mac)'
        });
        
    } catch (error) {
        console.error('HEIC conversion error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}
