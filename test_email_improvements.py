#!/usr/bin/env python3
"""
Test script for the improved email notification system.
Tests the new concise formatting and change filtering.
"""

import os
import sys
sys.path.append('scripts')

from diff_and_notify import send_email_notification, group_changes_by_platform, create_concise_summary, is_significant_change

def test_email_improvements():
    """Test the improved email notification system with sample data."""
    
    # Check if required environment variables are set
    if not os.environ.get("RESEND_API_KEY"):
        print("ERROR: RESEND_API_KEY environment variable not set")
        return False
    
    if not os.environ.get("RECIPIENT_EMAIL"):
        print("ERROR: RECIPIENT_EMAIL environment variable not set")
        return False
    
    print("Testing improved email notification system...")
    print(f"Sending test email to: {os.environ.get('RECIPIENT_EMAIL')}")
    
    # Sample test data with realistic policy changes
    test_changes = [
        {
            "policy_name": "TikTok Community Guidelines",
            "summary": "Updated harassment reporting procedures to include automated detection systems. New appeals process introduced for content moderation decisions. Enhanced protection measures for vulnerable users including minors and public figures.",
            "is_new": False
        },
        {
            "policy_name": "Instagram Blocking People", 
            "summary": "Added new criteria for automatic blocking of repeat offenders. Users can now block based on keyword patterns in comments and messages.",
            "is_new": False
        },
        {
            "policy_name": "Whatnot Enforcement Actions",
            "summary": "Introduced escalating penalty system for policy violations. First-time offenders receive warnings, while repeat violations result in temporary suspensions.",
            "is_new": False
        }
    ]
    
    print("\n=== Testing Change Grouping ===")
    groups = group_changes_by_platform(test_changes)
    for platform, changes in groups.items():
        print(f"{platform}: {len(changes)} changes")
    
    print("\n=== Testing Concise Summaries ===")
    for change in test_changes:
        original = change['summary']
        concise = create_concise_summary(original)
        print(f"Original ({len(original)} chars): {original[:60]}...")
        print(f"Concise ({len(concise)} chars): {concise}")
        print("---")
    
    print("\n=== Testing Significance Detection ===")
    test_diffs = [
        "- <div class='nav-menu'> updated CSS styling and navigation elements",  # Should skip
        "- Policy now prohibits harassment based on protected characteristics. New enforcement procedures include immediate suspension for severe violations.",  # Should process
        "- Updated font colors and margin spacing in header section",  # Should skip
    ]
    
    for diff in test_diffs:
        is_sig, reason = is_significant_change(diff)
        print(f"'{diff[:50]}...' -> {'PROCESS' if is_sig else 'SKIP'} ({reason})")
    
    print("\n=== Sending Test Email ===")
    try:
        send_email_notification(test_changes)
        print("✅ Improved email sent successfully!")
        return True
    except Exception as e:
        print(f"❌ Test email failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_email_improvements()
    sys.exit(0 if success else 1)