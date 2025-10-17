#!/usr/bin/env python3
"""
Weekly Policy Changes Aggregator
Collects and summarizes policy changes from the past 7 days
Supports both manual testing and automated Friday runs
"""

import os
import sys
import json
import argparse
import subprocess
from datetime import datetime, UTC, timedelta
from pathlib import Path
import google.generativeai as genai
from bs4 import BeautifulSoup, MarkupResemblesLocatorWarning
import html2text
import warnings
import resend
import markdown

# Suppress BeautifulSoup warnings
warnings.filterwarnings("ignore", category=MarkupResemblesLocatorWarning)

# --- Configuration ---
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GEMINI_API_KEY_2 = os.environ.get("GEMINI_API_KEY_2")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY")
RECIPIENT_EMAIL = os.environ.get("RECIPIENT_EMAIL")
SUMMARIES_FILE = "summaries.json"
WEEKLY_SUMMARIES_FILE = "weekly_summaries.json"
RUN_LOG_FILE = "run_log.json"

# Email settings
SEND_IMMEDIATE_EMAILS = os.environ.get("SEND_IMMEDIATE_EMAILS", "false").lower() == "true"

# AI Prompt Template for weekly summaries
WEEKLY_PROMPT_TEMPLATE = """As a Trust & Safety analyst, provide a comprehensive weekly summary for a product manager covering policy changes across multiple platforms.

Week Period: {week_start} to {week_end}
Run Information: {run_type} run generated on {run_date}

Policy Changes This Week:
{changes_summary}

Please provide:
1. **Executive Summary** - 2-3 key takeaways for the week
2. **Platform Highlights** - Notable changes by platform
3. **Risk Assessment** - Any changes that require immediate attention
4. **Trends Analysis** - Patterns observed across platforms

Format the response in markdown with clear sections and bullet points."""

class WeeklyAggregator:
    def __init__(self, manual_run=False, week_ending=None):
        self.manual_run = manual_run
        self.week_ending = week_ending or datetime.now(UTC).date()
        self.week_start = self.week_ending - timedelta(days=6)  # 7-day period
        self.run_date = datetime.now(UTC)
        
        # Track API key usage
        self.current_api_key = GEMINI_API_KEY
        self.using_backup_key = False

        if not self.current_api_key and GEMINI_API_KEY_2:
            self.current_api_key = GEMINI_API_KEY_2
            self.using_backup_key = True
            print("ℹ️  Using backup Gemini API key as primary key is not configured.", file=sys.stderr)
        
        print(f"🗓️  Weekly aggregation for: {self.week_start} to {self.week_ending}")
        print(f"🔧 Run type: {'Manual' if self.manual_run else 'Scheduled'}")

    def get_weekly_changes(self):
        """Get all policy changes from the past week using git log."""
        try:
            # Get commits from the past week that modified snapshots
            since_date = self.week_start.strftime('%Y-%m-%d')
            until_date = (self.week_ending + timedelta(days=1)).strftime('%Y-%m-%d')
            
            # Get commits that modified snapshot files in the date range
            result = subprocess.run([
                "git", "log", 
                f"--since={since_date}",
                f"--until={until_date}",
                "--pretty=format:%H|%ci|%s",
                "--", "snapshots/"
            ], capture_output=True, text=True, check=True)
            
            if not result.stdout.strip():
                print("No policy changes found in the specified week.")
                return []
            
            commits = []
            for line in result.stdout.strip().split('\n'):
                if line:
                    commit_hash, commit_date, commit_msg = line.split('|', 2)
                    commits.append({
                        'hash': commit_hash,
                        'date': commit_date,
                        'message': commit_msg
                    })
            
            print(f"Found {len(commits)} commits with policy changes")
            
            # Get changed files for each commit
            weekly_changes = []
            for commit in commits:
                changed_files = self.get_changed_files(commit['hash'])
                if changed_files:
                    weekly_changes.append({
                        'commit': commit,
                        'changed_files': changed_files
                    })
            
            return weekly_changes
            
        except subprocess.CalledProcessError as e:
            print(f"ERROR: Git log failed: {e}", file=sys.stderr)
            return []
        except Exception as e:
            print(f"ERROR: Failed to get weekly changes: {e}", file=sys.stderr)
            return []

    def get_changed_files(self, commit_sha):
        """Get changed snapshot files for a specific commit."""
        try:
            result = subprocess.run([
                "git", "diff", "--name-only", 
                f"{commit_sha}^", commit_sha
            ], capture_output=True, text=True, check=True)
            
            files = result.stdout.strip().split("\n")
            snapshot_files = [f for f in files if f and f.startswith("snapshots/") and f.endswith(".html")]
            return snapshot_files
            
        except subprocess.CalledProcessError as e:
            print(f"ERROR: Failed to get changed files for {commit_sha}: {e}", file=sys.stderr)
            return []

    def load_existing_summaries(self):
        """Load existing policy summaries for context."""
        try:
            if Path(SUMMARIES_FILE).exists():
                with open(SUMMARIES_FILE, 'r') as f:
                    return json.load(f)
            return {}
        except Exception as e:
            print(f"WARNING: Could not load summaries: {e}", file=sys.stderr)
            return {}

    def generate_weekly_summary(self, weekly_changes):
        """Generate AI summary of the week's policy changes."""
        if not weekly_changes:
            return "No policy changes detected this week."
        
        existing_summaries = self.load_existing_summaries()
        
        # Build changes summary
        changes_text = []
        for change in weekly_changes:
            commit_date = change['commit']['date']
            for file_path in change['changed_files']:
                # Extract policy name from file path
                policy_key = file_path.split('/')[-2] if '/' in file_path else file_path
                
                # Get summary from existing summaries if available
                if policy_key in existing_summaries:
                    summary_data = existing_summaries[policy_key]
                    policy_name = summary_data.get('policy_name', policy_key)
                    last_update = summary_data.get('last_update_summary', 'No summary available')
                    
                    changes_text.append(f"**{policy_name}** ({commit_date}):\n{last_update}\n")
                else:
                    changes_text.append(f"**{policy_key}** ({commit_date}): New policy file detected\n")
        
        changes_summary = "\n".join(changes_text)
        
        # Generate AI summary
        run_type = "Manual test" if self.manual_run else "Scheduled weekly"
        prompt = WEEKLY_PROMPT_TEMPLATE.format(
            week_start=self.week_start.strftime('%B %d, %Y'),
            week_end=self.week_ending.strftime('%B %d, %Y'),
            run_type=run_type,
            run_date=self.run_date.strftime('%B %d, %Y at %H:%M UTC'),
            changes_summary=changes_summary
        )
        
        ai_summary = self.call_ai_api(prompt)
        
        # Check if AI summary generation failed and provide fallback
        if not ai_summary or ai_summary.lower().startswith("error"):
            print(f"WARNING: AI summary generation failed, using fallback summary", file=sys.stderr)
            return self.generate_fallback_summary(weekly_changes, run_type)
        
        return ai_summary

    def call_ai_api(self, prompt, max_retries=3):
        """Call Gemini API with improved error handling and fallback to backup key."""
        if not self.current_api_key:
            return "Error: No GEMINI_API_KEY configured. Set GEMINI_API_KEY or GEMINI_API_KEY_2 to enable AI summaries."
        
        genai.configure(api_key=self.current_api_key)
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        for attempt in range(max_retries):
            try:
                response = model.generate_content(prompt)
                if response and response.text:
                    return response.text
                else:
                    raise Exception("Empty response from Gemini API")
                    
            except Exception as e:
                error_str = str(e)
                is_final_attempt = attempt == max_retries - 1
                
                print(f"ERROR: Gemini API call failed (attempt {attempt + 1}/{max_retries}): {error_str}", file=sys.stderr)
                
                # Check if this is a quota/rate limit error
                is_quota_error = any(keyword in error_str.lower() for keyword in ["429", "quota", "rate", "limit"])
                
                # Try backup key if quota exceeded and we haven't tried it yet
                if is_quota_error and not self.using_backup_key and GEMINI_API_KEY_2:
                    print("Switching to backup API key...", file=sys.stderr)
                    self.current_api_key = GEMINI_API_KEY_2
                    self.using_backup_key = True
                    genai.configure(api_key=self.current_api_key)
                    
                    try:
                        response = model.generate_content(prompt)
                        if response and response.text:
                            print("Successfully used backup API key", file=sys.stderr)
                            return response.text
                        else:
                            raise Exception("Empty response from backup API key")
                    except Exception as backup_error:
                        print(f"ERROR: Backup API key failed: {backup_error}", file=sys.stderr)
                        if is_final_attempt:
                            return f"Error generating AI summary: Both primary and backup API keys failed. Primary error: {error_str}, Backup error: {backup_error}"
                        continue
                
                # For non-quota errors or if we're on final attempt, apply exponential backoff
                if not is_final_attempt:
                    import time
                    wait_time = 2 ** attempt  # Exponential backoff: 1s, 2s, 4s
                    print(f"Retrying in {wait_time} seconds...", file=sys.stderr)
                    time.sleep(wait_time)
                else:
                    # Final attempt failed - provide helpful error message
                    if is_quota_error:
                        return f"Error generating AI summary: API quota exceeded. Please check your Gemini API quota and billing. Original error: {error_str}"
                    else:
                        return f"Error generating AI summary after {max_retries} attempts: {error_str}"
        
        return f"Error generating AI summary: Maximum retries ({max_retries}) exceeded"

    def generate_fallback_summary(self, weekly_changes, run_type):
        """Generate a basic summary when AI generation fails."""
        # Count changes by platform
        platform_changes = {}
        total_changes = 0
        
        for change in weekly_changes:
            total_changes += len(change['changed_files'])
            for file_path in change['changed_files']:
                policy_key = file_path.split('/')[-2] if '/' in file_path else file_path
                # Extract platform from policy key (e.g., "tiktok-community-guidelines" -> "TikTok")
                platform = policy_key.split('-')[0].capitalize()
                if platform in ['Tiktok']: platform = 'TikTok'
                elif platform in ['Youtube']: platform = 'YouTube'
                elif platform in ['Meta', 'Instagram', 'Facebook']: platform = 'Meta'
                elif platform in ['Whatnot']: platform = 'Whatnot'
                elif platform in ['Twitch']: platform = 'Twitch'
                
                platform_changes[platform] = platform_changes.get(platform, 0) + 1
        
        # Generate fallback summary
        week_range = f"{self.week_start.strftime('%B %d')} to {self.week_ending.strftime('%B %d, %Y')}"
        
        fallback_summary = f"""# Weekly Trust & Safety Policy Summary

**Week Period:** {week_range}
**Run Information:** {run_type} run generated on {self.run_date.strftime('%B %d, %Y at %H:%M UTC')}
**Note:** This summary was generated using fallback mode due to AI service unavailability.

---

## Executive Summary

During the week of {week_range}, a total of **{total_changes} policy changes** were detected across **{len(platform_changes)} platform(s)**.

## Platform Activity

"""
        
        for platform, count in sorted(platform_changes.items(), key=lambda x: x[1], reverse=True):
            fallback_summary += f"* **{platform}:** {count} change(s) detected\n"
        
        fallback_summary += f"""

## Changes Summary

The following policy changes were detected during this period:

"""
        
        for change in weekly_changes:
            commit_date = change['commit']['date']
            for file_path in change['changed_files']:
                policy_key = file_path.split('/')[-2] if '/' in file_path else file_path
                policy_name = policy_key.replace('-', ' ').title()
                fallback_summary += f"* **{policy_name}** (Updated: {commit_date[:10]})\n"
        
        fallback_summary += f"""

---

*This summary was automatically generated in fallback mode. For detailed analysis, please run the weekly aggregator again when AI services are available.*
"""
        
        return fallback_summary

    def save_weekly_summary(self, summary_text, weekly_changes):
        """Save the weekly summary with metadata."""
        weekly_data = {
            "run_metadata": {
                "run_date": self.run_date.isoformat(),
                "run_type": "manual" if self.manual_run else "scheduled",
                "week_start": self.week_start.isoformat(),
                "week_end": self.week_ending.isoformat(),
                "generated_by": "manual_test" if self.manual_run else "friday_automation"
            },
            "summary": summary_text,
            "changes_count": len(weekly_changes),
            "changed_policies": []
        }
        
        # Add policy details
        for change in weekly_changes:
            for file_path in change['changed_files']:
                policy_key = file_path.split('/')[-2] if '/' in file_path else file_path
                weekly_data["changed_policies"].append({
                    "policy_key": policy_key,
                    "file_path": file_path,
                    "commit_date": change['commit']['date'],
                    "commit_hash": change['commit']['hash']
                })
        
        # Load existing weekly summaries
        weekly_summaries = {}
        if Path(WEEKLY_SUMMARIES_FILE).exists():
            try:
                with open(WEEKLY_SUMMARIES_FILE, 'r') as f:
                    weekly_summaries = json.load(f)
            except:
                weekly_summaries = {}
        
        # Add this week's summary
        week_key = f"{self.week_start.isoformat()}_to_{self.week_ending.isoformat()}"
        weekly_summaries[week_key] = weekly_data
        
        # Save updated file
        with open(WEEKLY_SUMMARIES_FILE, 'w') as f:
            json.dump(weekly_summaries, f, indent=2)
        
        print(f"✅ Weekly summary saved to {WEEKLY_SUMMARIES_FILE}")
        return weekly_data

    def send_weekly_email(self, summary_data):
        """Send weekly summary email."""
        if not RESEND_API_KEY or not RECIPIENT_EMAIL:
            print("❌ Email not configured (missing RESEND_API_KEY or RECIPIENT_EMAIL)")
            return False
        
        try:
            resend.api_key = RESEND_API_KEY
            
            # Email subject
            week_range = f"{self.week_start.strftime('%b %d')}-{self.week_ending.strftime('%d, %Y')}"
            if self.manual_run:
                subject = f"[MANUAL] Weekly Policy Summary - {week_range}"
            else:
                subject = f"Weekly Policy Summary - {week_range}"
            
            # Generate HTML content
            summary_html = markdown.markdown(summary_data['summary'])
            run_type_label = "Manual Test Run" if self.manual_run else "Scheduled Friday Run"
            run_type_color = "#3498db" if self.manual_run else "#27ae60"
            
            html_content = f"""
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; max-width: 700px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #2c3e50 0%, #3498db 100%); padding: 30px; border-radius: 12px; text-align: center; color: white; margin-bottom: 20px;">
                    <h1 style="margin: 0; font-size: 24px;">📊 Weekly Policy Summary</h1>
                    <p style="margin: 10px 0 0 0; opacity: 0.9;">{week_range}</p>
                </div>
                
                <div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1); margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #eee;">
                        <div>
                            <p style="margin: 0; color: #666; font-size: 14px;">Generated on {self.run_date.strftime('%B %d, %Y at %H:%M UTC')}</p>
                            <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">Changes detected: {summary_data['changes_count']}</p>
                        </div>
                        <span style="background: {run_type_color}; color: white; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: bold;">
                            {run_type_label}
                        </span>
                    </div>
                    
                    <div style="color: #2c3e50; line-height: 1.6;">
                        {summary_html}
                    </div>
                </div>
                
                <div style="text-align: center; padding: 20px; background: #f8f9fa; border-radius: 8px;">
                    <p style="margin: 0; color: #666; font-size: 12px;">
                        <strong>T&S Policy Watcher</strong> | 
                        <a href="https://ts-policy-watcher.vercel.app/" style="color: #3498db; text-decoration: none;">View Dashboard</a>
                    </p>
                </div>
            </div>
            """
            
            # Send email
            result = resend.Emails.send({
                "from": "Policy Watch <noreply@resend.dev>",
                "to": [RECIPIENT_EMAIL],
                "subject": subject,
                "html": html_content
            })
            
            print(f"✅ Weekly email sent successfully. Email ID: {result.get('id', 'unknown')}")
            return True
            
        except Exception as e:
            print(f"❌ Failed to send weekly email: {e}", file=sys.stderr)
            return False

    def run(self):
        """Execute the weekly aggregation process."""
        print(f"🚀 Starting weekly policy aggregation...")
        
        # Get weekly changes
        weekly_changes = self.get_weekly_changes()
        
        if not weekly_changes:
            print("No changes found for this week.")
            summary_text = f"No policy changes detected for the week of {self.week_start.strftime('%B %d')} - {self.week_ending.strftime('%B %d, %Y')}."
        else:
            print(f"📝 Generating AI summary for {len(weekly_changes)} change(s)...")
            summary_text = self.generate_weekly_summary(weekly_changes)
        
        # Save summary
        summary_data = self.save_weekly_summary(summary_text, weekly_changes)
        
        # Send email if not disabled
        if not SEND_IMMEDIATE_EMAILS:
            print("📧 Sending weekly summary email...")
            self.send_weekly_email(summary_data)
        else:
            print("📧 Email disabled (SEND_IMMEDIATE_EMAILS=true)")
        
        print(f"✅ Weekly aggregation complete!")
        return summary_data

def main():
    parser = argparse.ArgumentParser(description='Generate weekly policy change summary')
    parser.add_argument('--manual', action='store_true', help='Run as manual test (adds special labeling)')
    parser.add_argument('--week-ending', type=str, help='Week ending date (YYYY-MM-DD), defaults to today')
    
    args = parser.parse_args()
    
    # Parse week ending date if provided
    week_ending = None
    if args.week_ending:
        try:
            week_ending = datetime.strptime(args.week_ending, '%Y-%m-%d').date()
        except ValueError:
            print("ERROR: Invalid date format. Use YYYY-MM-DD", file=sys.stderr)
            sys.exit(1)
    
    # Create and run aggregator
    aggregator = WeeklyAggregator(manual_run=args.manual, week_ending=week_ending)
    
    try:
        summary_data = aggregator.run()
        print(f"\n📊 Summary generated with {summary_data['changes_count']} changes")
    except KeyboardInterrupt:
        print("\n❌ Weekly aggregation cancelled")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Weekly aggregation failed: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
