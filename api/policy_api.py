#!/usr/bin/env python3
"""
Enhanced Policy Watch API
Handles subscription endpoints and weekly summary data
"""

import os
import sys
import json
import resend
from datetime import datetime, UTC
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs
from pathlib import Path
import re

# Configuration
RESEND_API_KEY = os.environ.get("RESEND_API_KEY")
RECIPIENT_EMAIL = os.environ.get("RECIPIENT_EMAIL", "lyori6us@gmail.com")
WEEKLY_SUMMARIES_FILE = "weekly_summaries.json"

def is_valid_email(email):
    """Validate email format"""
    pattern = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
    return re.match(pattern, email) is not None

def load_weekly_summaries():
    """Load weekly summaries from file"""
    try:
        if Path(WEEKLY_SUMMARIES_FILE).exists():
            with open(WEEKLY_SUMMARIES_FILE, 'r') as f:
                return json.load(f)
        return {"_metadata": {"description": "No weekly summaries available"}}
    except Exception as e:
        print(f"ERROR loading weekly summaries: {e}", file=sys.stderr)
        return {"error": "Failed to load weekly summaries"}

def send_subscription_notification(subscriber_email, source="unknown"):
    """Send email notification about new subscriber"""
    if not RESEND_API_KEY:
        print("ERROR: RESEND_API_KEY not configured")
        return False
    
    try:
        resend.api_key = RESEND_API_KEY
        
        # Email content
        subject = "🔔 New Policy Watch Subscriber"
        
        html_content = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #2c3e50 0%, #3498db 100%); padding: 30px; border-radius: 12px; text-align: center; color: white; margin-bottom: 20px;">
                <h1 style="margin: 0; font-size: 24px;">📧 New Newsletter Subscriber</h1>
            </div>
            
            <div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);">
                <h2 style="color: #2c3e50; margin-top: 0;">Subscription Details</h2>
                
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #3498db;">
                    <p style="margin: 0; font-size: 16px;"><strong>Email:</strong> {subscriber_email}</p>
                    <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">
                        <strong>Source:</strong> {source}
                    </p>
                    <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">
                        <strong>Subscribed:</strong> {datetime.now(UTC).strftime('%Y-%m-%d %H:%M:%S')} UTC
                    </p>
                </div>
                
                <div style="margin-top: 25px; padding: 20px; background: #e8f5e8; border-radius: 8px; border-left: 4px solid #27ae60;">
                    <p style="margin: 0; color: #2d5a2d;">
                        <strong>📋 Next Steps:</strong><br>
                        Add this email to your weekly summary notifications. 
                        They'll automatically receive weekly summaries when policy changes are detected.
                    </p>
                </div>
                
                <div style="margin-top: 25px; padding: 15px; background: #f0f9ff; border-radius: 8px; text-align: center;">
                    <p style="margin: 0; color: #1e40af; font-size: 14px;">
                        <strong>Policy Watch Dashboard:</strong> 
                        <a href="https://ts-policy-watcher.vercel.app/" style="color: #3498db; text-decoration: none;">
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

class PolicyAPIHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        """Handle CORS preflight requests"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def do_GET(self):
        """Handle GET requests"""
        try:
            parsed_url = urlparse(self.path)
            path = parsed_url.path
            query_params = parse_qs(parsed_url.query)
            
            if path == '/api/weekly-summary':
                self.handle_weekly_summary_get(query_params)
            elif path == '/api/health':
                self.handle_health_check()
            else:
                self.send_error(404, "Endpoint not found")
                
        except Exception as e:
            print(f"❌ Error handling GET request: {e}")
            self.send_error(500, "Internal server error")
    
    def do_POST(self):
        """Handle POST requests"""
        try:
            if self.path == '/api/subscribe':
                self.handle_subscription()
            else:
                self.send_error(404, "Endpoint not found")
                
        except Exception as e:
            print(f"❌ Error handling POST request: {e}")
            self.send_error(500, "Internal server error")
    
    def handle_weekly_summary_get(self, query_params):
        """Handle GET /api/weekly-summary requests"""
        try:
            # Load weekly summaries
            summaries = load_weekly_summaries()
            
            # Check for specific week parameter
            week = query_params.get('week', [None])[0]
            
            if week:
                # Return specific week
                if week in summaries:
                    response_data = {
                        "success": True,
                        "week": week,
                        "data": summaries[week]
                    }
                else:
                    self.send_error(404, f"Weekly summary for {week} not found")
                    return
            else:
                # Return all weeks or latest
                latest = query_params.get('latest', ['false'])[0].lower() == 'true'
                
                if latest and summaries:
                    # Find the most recent week (excluding metadata)
                    weeks = [k for k in summaries.keys() if not k.startswith('_')]
                    if weeks:
                        latest_week = max(weeks)
                        response_data = {
                            "success": True,
                            "latest": True,
                            "week": latest_week,
                            "data": summaries[latest_week]
                        }
                    else:
                        response_data = {
                            "success": True,
                            "latest": True,
                            "message": "No weekly summaries available"
                        }
                else:
                    # Return all summaries
                    response_data = {
                        "success": True,
                        "data": summaries
                    }
            
            # Send response
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            self.wfile.write(json.dumps(response_data, indent=2).encode('utf-8'))
            
            print(f"✅ Weekly summary served: {self.path}")
            
        except Exception as e:
            print(f"❌ Error serving weekly summary: {e}")
            self.send_error(500, "Failed to load weekly summary")
    
    def handle_health_check(self):
        """Handle health check endpoint"""
        response_data = {
            "status": "healthy",
            "service": "Policy Watch API",
            "timestamp": datetime.now(UTC).isoformat(),
            "endpoints": {
                "GET /api/weekly-summary": "Get weekly summaries",
                "GET /api/weekly-summary?week=YYYY-MM-DD_to_YYYY-MM-DD": "Get specific week",
                "GET /api/weekly-summary?latest=true": "Get latest week",
                "POST /api/subscribe": "Subscribe to notifications",
                "GET /api/health": "Health check"
            }
        }
        
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        
        self.wfile.write(json.dumps(response_data, indent=2).encode('utf-8'))
    
    def handle_subscription(self):
        """Handle POST /api/subscribe requests"""
        try:
            # Set CORS headers
            self.send_header('Access-Control-Allow-Origin', '*')
            
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
            source = data.get('source', 'api')
            
            if not email:
                self.send_error(400, "Email is required")
                return
            
            if not is_valid_email(email):
                self.send_error(400, "Invalid email format")
                return
            
            # Send notification
            success = send_subscription_notification(email, source)
            
            if success:
                # Send success response
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                
                response = {
                    "success": True,
                    "message": "Subscription successful",
                    "email": email
                }
                self.wfile.write(json.dumps(response).encode('utf-8'))
                
                print(f"✅ New subscriber: {email} (source: {source})")
            else:
                self.send_error(500, "Failed to process subscription")
            
        except Exception as e:
            print(f"❌ Error handling subscription: {e}")
            self.send_error(500, "Internal server error")
    
    def log_message(self, format, *args):
        """Override to reduce noise in logs"""
        return

def main():
    """Start the Policy API server"""
    port = 8081
    server_address = ('', port)
    httpd = HTTPServer(server_address, PolicyAPIHandler)
    
    print(f"🚀 Policy Watch API server running on port {port}")
    print(f"📧 Notifications will be sent to: {RECIPIENT_EMAIL}")
    print("🌐 Available endpoints:")
    print(f"   POST http://localhost:{port}/api/subscribe")
    print(f"   GET  http://localhost:{port}/api/weekly-summary")
    print(f"   GET  http://localhost:{port}/api/weekly-summary?latest=true")
    print(f"   GET  http://localhost:{port}/api/health")
    print("Press Ctrl+C to stop the server")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 API server stopped")
        httpd.server_close()

if __name__ == "__main__":
    main()