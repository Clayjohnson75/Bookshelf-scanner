#!/usr/bin/env python3
"""
Simple proxy server to handle OpenAI API calls and avoid CORS issues
Now includes HEIC to JPEG conversion capability
"""

import http.server
import socketserver
import json
import urllib.request
import urllib.parse
from urllib.error import HTTPError
import os
import base64
import io
from PIL import Image
import pillow_heif
import subprocess
import tempfile

# Register HEIC plugin
pillow_heif.register_heif_opener()

# Get OpenAI API key from environment variable
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')

class ProxyHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/api/openai':
            self.handle_openai_request()
        elif self.path == '/api/convert-heic':
            self.handle_heic_conversion()
        else:
            self.send_error(404, "Not Found")
    
    def do_GET(self):
        # Serve static files normally
        super().do_GET()
    
    def handle_openai_request(self):
        try:
            # Get the content length and read the request body
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            # Parse the JSON data - now we only expect the OpenAI request data
            openai_data = json.loads(post_data.decode('utf-8'))
            
            # Debug: Check the image format being sent and handle HEIC
            if 'messages' in openai_data:
                for message in openai_data['messages']:
                    if 'content' in message and isinstance(message['content'], list):
                        for content in message['content']:
                            if content.get('type') == 'image_url' and 'image_url' in content:
                                url = content['image_url']['url']
                                print(f"Received image format: {url[:50]}...")
                                if url.startswith('data:image/'):
                                    format_part = url.split(';')[0].replace('data:image/', '')
                                    print(f"Image format detected: {format_part}")
                                    
                                    # Handle HEIC format - OpenAI doesn't officially support it
                                    # but it might work if we tell it it's JPEG
                                    if format_part.lower() in ['heic', 'heif']:
                                        print("HEIC format detected, converting MIME type to JPEG for OpenAI")
                                        # Replace the MIME type in the data URL
                                        original_url = content['image_url']['url']
                                        if 'data:image/heic;' in original_url:
                                            content['image_url']['url'] = original_url.replace('data:image/heic;', 'data:image/jpeg;')
                                        elif 'data:image/heif;' in original_url:
                                            content['image_url']['url'] = original_url.replace('data:image/heif;', 'data:image/jpeg;')
                                        print(f"Updated MIME type from {format_part} to JPEG for OpenAI compatibility")
                                        print(f"New format: {content['image_url']['url'][:50]}...")
            
            # Use the API key stored in the server
            if not OPENAI_API_KEY:
                self.send_error(500, "API key not configured on server")
                return
            
            # Make request to OpenAI
            req = urllib.request.Request(
                'https://api.openai.com/v1/chat/completions',
                data=json.dumps(openai_data).encode('utf-8'),
                headers={
                    'Authorization': f'Bearer {OPENAI_API_KEY}',
                    'Content-Type': 'application/json',
                }
            )
            
            with urllib.request.urlopen(req) as response:
                response_data = response.read()
                
                # Send successful response
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
                self.send_header('Access-Control-Allow-Headers', 'Content-Type')
                self.end_headers()
                self.wfile.write(response_data)
                
        except HTTPError as e:
            error_response = e.read().decode('utf-8')
            print(f"OpenAI API Error: {e.code} - {error_response}")
            
            self.send_response(e.code)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(error_response.encode('utf-8'))
            
        except Exception as e:
            print(f"Proxy Error: {str(e)}")
            self.send_error(500, f"Internal Server Error: {str(e)}")
    
    def do_OPTIONS(self):
        # Handle CORS preflight requests
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def handle_heic_conversion(self):
        try:
            # Get the content length and read the request body
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            # Parse the JSON data
            data = json.loads(post_data.decode('utf-8'))
            heic_data_url = data.get('heicDataUrl')
            
            if not heic_data_url:
                self.send_error(400, "Missing heicDataUrl")
                return
            
            # Extract base64 data from data URL
            if heic_data_url.startswith('data:image/heic;base64,'):
                base64_data = heic_data_url.split(',')[1]
            elif heic_data_url.startswith('data:image/heif;base64,'):
                base64_data = heic_data_url.split(',')[1]
            else:
                self.send_error(400, "Invalid HEIC data URL format")
                return
            
            # Decode base64 data
            heic_data = base64.b64decode(base64_data)
            
            # Convert HEIC to JPEG using Pillow
            try:
                # Try to open with Pillow (supports HEIC if pillow-heif is installed)
                image = Image.open(io.BytesIO(heic_data))
                
                # Convert to RGB if necessary
                if image.mode != 'RGB':
                    image = image.convert('RGB')
                
                # Save as JPEG
                jpeg_buffer = io.BytesIO()
                image.save(jpeg_buffer, format='JPEG', quality=85)
                jpeg_data = jpeg_buffer.getvalue()
                
                # Convert back to base64
                jpeg_base64 = base64.b64encode(jpeg_data).decode('utf-8')
                jpeg_data_url = f"data:image/jpeg;base64,{jpeg_base64}"
                
                # Send successful response
                response_data = json.dumps({
                    'success': True,
                    'jpegDataUrl': jpeg_data_url
                })
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
                self.send_header('Access-Control-Allow-Headers', 'Content-Type')
                self.end_headers()
                self.wfile.write(response_data.encode('utf-8'))
                
            except Exception as e:
                print(f"Pillow HEIC conversion failed: {e}")
                
                # Fallback: Try using ImageMagick if available
                try:
                    with tempfile.NamedTemporaryFile(suffix='.heic', delete=False) as temp_heic:
                        temp_heic.write(heic_data)
                        temp_heic_path = temp_heic.name
                    
                    with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as temp_jpg:
                        temp_jpg_path = temp_jpg.name
                    
                    # Use ImageMagick to convert
                    result = subprocess.run([
                        'convert', temp_heic_path, '-quality', '85', temp_jpg_path
                    ], capture_output=True, text=True)
                    
                    if result.returncode == 0:
                        # Read converted JPEG
                        with open(temp_jpg_path, 'rb') as f:
                            jpeg_data = f.read()
                        
                        # Convert to base64
                        jpeg_base64 = base64.b64encode(jpeg_data).decode('utf-8')
                        jpeg_data_url = f"data:image/jpeg;base64,{jpeg_base64}"
                        
                        # Send successful response
                        response_data = json.dumps({
                            'success': True,
                            'jpegDataUrl': jpeg_data_url
                        })
                        
                        self.send_response(200)
                        self.send_header('Content-Type', 'application/json')
                        self.send_header('Access-Control-Allow-Origin', '*')
                        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
                        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
                        self.end_headers()
                        self.wfile.write(response_data.encode('utf-8'))
                    else:
                        raise Exception(f"ImageMagick conversion failed: {result.stderr}")
                    
                    # Clean up temp files
                    os.unlink(temp_heic_path)
                    os.unlink(temp_jpg_path)
                    
                except Exception as e2:
                    print(f"ImageMagick HEIC conversion also failed: {e2}")
                    
                    # All conversion methods failed
                    response_data = json.dumps({
                        'success': False,
                        'error': 'Server-side HEIC conversion failed'
                    })
                    
                    self.send_response(500)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(response_data.encode('utf-8'))
                
        except Exception as e:
            print(f"HEIC conversion error: {str(e)}")
            response_data = json.dumps({
                'success': False,
                'error': str(e)
            })
            
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(response_data.encode('utf-8'))

if __name__ == "__main__":
    PORT = 8080
    
    print(f"Starting proxy server on port {PORT}...")
    print(f"Access your bookshelf scanner at: http://localhost:{PORT}")
    print("The server will handle both static files and OpenAI API requests.")
    
    with socketserver.TCPServer(("", PORT), ProxyHandler) as httpd:
        httpd.serve_forever()
