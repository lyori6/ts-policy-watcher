#!/usr/bin/env python3
import os
import resend

# Set up API key
resend.api_key = "re_SoF8AxLT_NGYh7RUUXeUYVQ9jbVVZ3w5m"

try:
    params = {
        "from": "Policy Watcher <onboarding@resend.dev>",
        "to": ["lyori6us@gmail.com"],
        "subject": "Simple Email Test from Policy Watcher",
        "html": "<h1>Test Email</h1><p>This is a simple test to verify email notifications are working.</p>",
    }
    
    print("Sending test email...")
    email = resend.Emails.send(params)
    print(f"✅ Email sent successfully! Message ID: {email['id']}")
    
except Exception as e:
    print(f"❌ Failed to send email: {e}")
    print(f"Error type: {type(e)}")
    if hasattr(e, 'response'):
        print(f"Response: {e.response}")
    if hasattr(e, 'status_code'):
        print(f"Status code: {e.status_code}")
    import traceback
    traceback.print_exc()