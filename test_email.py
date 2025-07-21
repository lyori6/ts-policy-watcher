#!/usr/bin/env python3
"""
Simple test script to verify email notifications are working.
Run this to test the Resend email integration.
"""

import os
import sys
sys.path.append('scripts')

from diff_and_notify import send_email_notification

def test_email():
    """Test the email notification system with sample data."""
    
    # Check if required environment variables are set
    if not os.environ.get("RESEND_API_KEY"):
        print("ERROR: RESEND_API_KEY environment variable not set")
        return False
    
    if not os.environ.get("RECIPIENT_EMAIL"):
        print("ERROR: RECIPIENT_EMAIL environment variable not set")
        return False
    
    print("Testing email notification system...")
    print(f"Sending test email to: {os.environ.get('RECIPIENT_EMAIL')}")
    
    # Sample test data
    test_changes = [
        {
            "policy_name": "Test Policy Update",
            "summary": "This is a **test email** to verify the policy watcher notification system is working correctly.\n\n- Email integration is functional\n- Markdown formatting is preserved\n- Notifications are being sent successfully",
            "is_new": False
        }
    ]
    
    try:
        send_email_notification(test_changes)
        print("✅ Test email sent successfully!")
        return True
    except Exception as e:
        print(f"❌ Test email failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_email()
    sys.exit(0 if success else 1)