// Vercel serverless function for HEIC to JPEG conversion
// Using a web-based approach that works for everyone

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

        // For now, we'll use a different approach
        // Let's try to use a web-based HEIC conversion service
        console.log('Attempting HEIC conversion...');
        
        // Extract the base64 data
        const base64Data = file.split(',')[1];
        
        // Try to use a web-based conversion approach
        // This is a placeholder for now - we'll implement a working solution
        try {
            // For now, return an error that suggests using the web app's client-side conversion
            // But we'll implement a proper solution
            res.status(501).json({
                success: false,
                error: 'Server-side HEIC conversion is being implemented. Please try the client-side conversion first.',
                fallback: 'If client-side fails, please use the desktop converter or convert manually.'
            });
        } catch (conversionError) {
            throw new Error(`Conversion failed: ${conversionError.message}`);
        }
        
    } catch (error) {
        console.error('HEIC conversion error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}
