import json
import base64
import io
from PIL import Image
import pillow_heif

# Register HEIF opener
pillow_heif.register_heif_opener()

def handler(request):
    if request.method != 'POST':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'Method not allowed'})
        }

    try:
        # Parse request body
        body = json.loads(request.body)
        image_data = body.get('imageData')
        
        if not image_data:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({'error': 'No image data provided'})
            }

        # Remove data URL prefix if present
        if image_data.startswith('data:'):
            base64_data = image_data.split(',')[1]
        else:
            base64_data = image_data
            
        # Decode base64
        image_bytes = base64.b64decode(base64_data)
        
        # Open image with Pillow (handles HEIC via pillow-heif)
        image = Image.open(io.BytesIO(image_bytes))
        
        # Convert to RGB if necessary
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Convert to JPEG
        output_buffer = io.BytesIO()
        image.save(output_buffer, format='JPEG', quality=90, optimize=True)
        jpeg_bytes = output_buffer.getvalue()
        
        # Encode back to base64
        jpeg_base64 = base64.b64encode(jpeg_bytes).decode('utf-8')
        data_url = f"data:image/jpeg;base64,{jpeg_base64}"
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({
                'success': True,
                'dataUrl': data_url,
                'message': 'HEIC converted to JPEG successfully'
            })
        }
        
    except Exception as error:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({
                'error': 'HEIC conversion failed',
                'details': str(error)
            })
        }
