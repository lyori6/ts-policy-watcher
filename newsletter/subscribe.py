#!/usr/bin/env python3
"""
Newsletter subscription handler
Sends an email notification when someone subscribes to the newsletter
"""

import os
import sys
import json
import resend
from datetime import datetime, UTC
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs
import re

# Configuration
RESEND_API_KEY = os.environ.get("RESEND_API_KEY")
RECIPIENT_EMAIL = os.environ.get("RECIPIENT_EMAIL", "lyori6us@gmail.com")
PORT = 8080

def is_valid_email(email):
    """Validate email format"""
    pattern = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
    return re.match(pattern, email) is not None

def send_subscription_notification(subscriber_email):
    """Send email notification about new subscriber"""
    if not RESEND_API_KEY:
        print("ERROR: RESEND_API_KEY not configured")
        return False
    
    try:
        resend.api_key = RESEND_API_KEY
        
        # Email content
        subject = "🔔 New Newsletter Subscriber"
        
        html_content = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px; text-align: center; color: white; margin-bottom: 20px;">
                <h1 style="margin: 0; font-size: 24px;">📧 New Newsletter Subscriber</h1>
            </div>
            
            <div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);">
                <h2 style="color: #2c3e50; margin-top: 0;">Subscription Details</h2>
                
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #3498db;">
                    <p style="margin: 0; font-size: 16px;"><strong>Email:</strong> {subscriber_email}</p>
                    <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">
                        <strong>Subscribed:</strong> {datetime.now(UTC).strftime('%Y-%m-%d %H:%M:%S')} UTC
                    </p>
                </div>
                
                <div style="margin-top: 25px; padding: 20px; background: #e8f5e8; border-radius: 8px; border-left: 4px solid #27ae60;">
                    <p style="margin: 0; color: #2d5a2d;">
                        <strong>📋 Next Steps:</strong><br>
                        Add this email to your newsletter subscriber list and they'll automatically receive notifications 
                        when platform policy changes are detected.
                    </p>
                </div>
                
                <div style="margin-top: 25px; padding: 15px; background: #f0f9ff; border-radius: 8px; text-align: center;">
                    <p style="margin: 0; color: #1e40af; font-size: 14px;">
                        <strong>Policy Watch Dashboard:</strong> 
                        <a href="http://localhost:8000/dashboard/" style="color: #3498db; text-decoration: none;">
                            View Current Status
                        </a>
                    </p>
                </div>
            </div>
            
            <p style="text-align: center; color: #666; font-size: 12px; margin-top: 20px;">
                This notification was generated automatically by your Policy Watch system.
            </p>
        </div>
        """
        
        # Send email
        result = resend.Emails.send({
            "from": "Policy Watch <noreply@resend.dev>",
            "to": [RECIPIENT_EMAIL],
            "subject": subject,
            "html": html_content
        })
        
        print(f"✅ Subscription notification sent successfully. Email ID: {result.get('id', 'unknown')}")
        return True
        
    except Exception as e:
        print(f"❌ Failed to send subscription notification: {e}")
        return False

class SubscriptionHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        """Handle POST requests to /newsletter/subscribe"""
        try:
            # Parse the URL
            parsed_path = urlparse(self.path)
            
            if parsed_path.path != '/newsletter/subscribe':
                self.send_error(404, "Not Found")
                return
            
            # Get content length
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                self.send_error(400, "No data provided")
                return
            
            # Read and parse JSON data
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode('utf-8'))
            except json.JSONDecodeError:
                self.send_error(400, "Invalid JSON")
                return
            
            # Validate email
            email = data.get('email', '').strip().lower()
            if not email:
                self.send_error(400, "Email is required")
                return
            
            if not is_valid_email(email):
                self.send_error(400, "Invalid email format")
                return
            
            # Send notification
            success = send_subscription_notification(email)
            
            if success:
                # Send success response
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                
                response = {
                    "success": True,
                    "message": "Subscription successful"
                }
                self.wfile.write(json.dumps(response).encode('utf-8'))
                
                print(f"✅ New subscriber: {email}")
            else:
                self.send_error(500, "Failed to process subscription")
            
        except Exception as e:
            print(f"❌ Error handling subscription: {e}")
            self.send_error(500, "Internal server error")
    
    def do_OPTIONS(self):
        """Handle CORS preflight requests"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def log_message(self, format, *args):
        """Override to reduce noise in logs"""
        return

def main():
    """Start the subscription server"""
    if not RESEND_API_KEY:
        print("❌ ERROR: RESEND_API_KEY environment variable not set")
        print("Please set your Resend API key before running the server")
        sys.exit(1)
    
    server_address = ('', PORT)
    httpd = HTTPServer(server_address, SubscriptionHandler)
    
    print(f"🚀 Newsletter subscription server running on port {PORT}")
    print(f"📧 Notifications will be sent to: {RECIPIENT_EMAIL}")
    print(f"🌐 Subscribe endpoint: http://localhost:{PORT}/newsletter/subscribe")
    print("Press Ctrl+C to stop the server")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 Server stopped")
        httpd.server_close()

if __name__ == "__main__":
    main()