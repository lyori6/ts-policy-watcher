# scripts/diff_and_notify.py

import os
import sys
import json
import subprocess
from datetime import datetime, UTC, timedelta
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
RUN_LOG_FILE = "run_log.json"
SUMMARIES_FILE = "summaries.json"
PROMPT_TEMPLATE = """As a Trust & Safety analyst, provide a concise summary for a product manager. {instruction}

Policy content:
{policy_text}

Provide a direct summary using bullet points:"""

# Track which API key we're currently using
current_api_key = GEMINI_API_KEY
using_backup_key = False
RESEND_API_KEY = os.environ.get("RESEND_API_KEY")
RECIPIENT_EMAIL = os.environ.get("RECIPIENT_EMAIL")

def get_changed_files(commit_sha):
    """Gets a list of snapshot files from a specific commit SHA."""
    try:
        # Use git diff to compare the commit with its parent (HEAD^)
        # This ensures we only get files that have actually changed.
        result = subprocess.run(
            ["git", "diff", "--name-only", f"{commit_sha}^", commit_sha],
            capture_output=True, text=True, check=True
        )
        files = result.stdout.strip().split("\n")
        changed_html_files = [f for f in files if f and f.startswith("snapshots/") and f.endswith(".html")]
        print(f"DEBUG: Found {len(changed_html_files)} changed HTML files: {changed_html_files}")
        return changed_html_files
    except subprocess.CalledProcessError as e:
        print(f"ERROR: 'git diff' failed with exit code {e.returncode}", file=sys.stderr)
        print(f"Stderr: {e.stderr}", file=sys.stderr)
        return []
    except Exception as e:
        print(f"An unexpected error occurred while getting changed files: {e}.", file=sys.stderr)
        return []

def get_git_diff(file_path, commit_sha):
    """Gets the diff for a specific file from a specific commit."""
    try:
        # Diff against the parent commit
        result = subprocess.run(
            ["git", "diff", f"{commit_sha}^!", "--", file_path],
            capture_output=True, text=True, check=True
        )
        return result.stdout
    except subprocess.CalledProcessError as e:
        print(f"ERROR: 'git diff' failed for {file_path} with exit code {e.returncode}", file=sys.stderr)
        print(f"Stderr: {e.stderr}", file=sys.stderr)
        return ""

def clean_html(html_content):
    """Strips all HTML tags to get clean text."""
    soup = BeautifulSoup(html_content, 'html.parser')
    return soup.get_text(" ", strip=True)

def get_ai_summary(text_content, is_new_policy):
    """Generates a summary using the Gemini API with fallback to backup key."""
    global current_api_key, using_backup_key
    
    if not current_api_key:
        return "Error: No GEMINI_API_KEY configured."
    
    genai.configure(api_key=current_api_key)
    model = genai.GenerativeModel('gemini-2.5-flash')
    
    instruction = (
        "Analyze this complete policy document and highlight the key aspects." if is_new_policy 
        else "Identify the specific changes and their impact."
    )
    
    prompt = PROMPT_TEMPLATE.format(instruction=instruction, policy_text=text_content)
    
    try:
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        error_str = str(e)
        print(f"ERROR: Gemini API call failed. Reason: {error_str}", file=sys.stderr)
        
        # Check if quota exceeded and we have a backup key
        if "429" in error_str or "quota" in error_str.lower():
            if not using_backup_key and GEMINI_API_KEY_2:
                print("Quota exceeded on primary key, switching to backup key...", file=sys.stderr)
                current_api_key = GEMINI_API_KEY_2
                using_backup_key = True
                genai.configure(api_key=current_api_key)
                
                try:
                    response = model.generate_content(prompt)
                    print("Successfully used backup API key", file=sys.stderr)
                    return response.text
                except Exception as backup_error:
                    print(f"ERROR: Backup API key also failed: {backup_error}", file=sys.stderr)
                    return None
            else:
                print("No backup key available or already using backup", file=sys.stderr)
        
        return None

def is_significant_change(diff_content):
    """Determines if a change is significant enough to warrant notification."""
    if not diff_content or len(diff_content.strip()) < 100:
        return False, "Change too small"
    
    # Convert to text for analysis
    text_content = html2text.html2text(diff_content)
    words = text_content.split()
    
    # Skip if very few meaningful words
    if len(words) < 20:
        return False, "Too few words changed"
    
    # Detect trivial changes (CSS, navigation, formatting)
    trivial_indicators = [
        'class=', 'style=', 'css', 'javascript', 'nav-', 'menu-',
        'font-', 'color:', 'margin:', 'padding:', 'display:',
        'href="#"', 'onclick=', '<script', '</script>',
        'breadcrumb', 'navigation', 'footer', 'header'
    ]
    
    # Count trivial vs. content changes
    trivial_count = sum(1 for indicator in trivial_indicators 
                       if indicator.lower() in text_content.lower())
    content_ratio = len([w for w in words if len(w) > 3]) / len(words) if words else 0
    
    # Skip if mostly trivial changes
    if trivial_count > 5 and content_ratio < 0.6:
        return False, "Mostly formatting/navigation changes"
    
    # Look for substantive content indicators
    substantive_indicators = [
        'policy', 'rule', 'guideline', 'prohibited', 'allowed', 'enforcement',
        'violation', 'report', 'block', 'suspend', 'remove', 'content',
        'community', 'safety', 'harassment', 'hate', 'spam', 'violence'
    ]
    
    substantive_count = sum(1 for indicator in substantive_indicators 
                           if indicator.lower() in text_content.lower())
    
    if substantive_count >= 2:
        return True, f"Substantive policy content detected ({substantive_count} indicators)"
    
    return False, "No significant policy content changes detected"

def process_changed_file(file_path, is_new_policy, commit_sha):
    """Processes a single changed file to generate a summary."""
    print(f"\nProcessing: {file_path} {'(new policy)' if is_new_policy else '(existing policy)'}")
    
    try:
        if is_new_policy:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            text_to_summarize = clean_html(content)
        else:
            diff_content = get_git_diff(file_path, commit_sha)
            
            # Check if change is significant
            is_significant, reason = is_significant_change(diff_content)
            if not is_significant:
                print(f"Skipping: {reason}")
                return None
                
            text_to_summarize = html2text.html2text(diff_content)

        if len(text_to_summarize.split()) < 10:
            print("Change is too small to summarize. Skipping.")
            return None

        return get_ai_summary(text_to_summarize[:20000], is_new_policy)
    except Exception as e:
        print(f"ERROR: Could not process file {file_path}. Reason: {e}", file=sys.stderr)
        return None

def log_run_status(status, pages_checked, changes_found, errors):
    """Log summary processing status (run_log is now handled by fetch.py)."""
    print(f"Summary processing complete: {status}, {pages_checked} pages checked, {changes_found} changes found")

def group_changes_by_platform(changes):
    """Groups policy changes by platform for better organization."""
    platform_groups = {}
    
    for change in changes:
        # Extract platform from policy name or use a mapping
        policy_name = change['policy_name'].lower()
        platform = 'Unknown'
        
        if 'tiktok' in policy_name:
            platform = 'TikTok'
        elif 'instagram' in policy_name or 'meta' in policy_name:
            platform = 'Meta'  
        elif 'youtube' in policy_name:
            platform = 'YouTube'
        elif 'whatnot' in policy_name:
            platform = 'Whatnot'
            
        if platform not in platform_groups:
            platform_groups[platform] = []
        platform_groups[platform].append(change)
    
    return platform_groups

def create_concise_summary(summary_text, max_length=800):
    """Creates a concise summary from longer text while preserving important markdown formatting."""
    if not summary_text:
        return "Policy updated with new content."
    
    # Clean up the text while preserving important markdown
    lines = [line.strip() for line in summary_text.split('\n') if line.strip()]
    
    # Remove redundant intro phrases - comprehensive patterns
    filtered_lines = []
    skip_patterns = [
        "here are the key changes based on the diff",
        "based on the diff",
        "here are the key changes",
        "the key changes are",
        "here's a concise summary for the product manager",
        "here's a summary for the product manager",
        "here's a concise summary of the",
        "as a trust & safety analyst, here",
        "as a trust & safety analyst, here's",
        "summary for product manager",
        "summary for a product manager",
        "concise summary for a product manager",
        "concise summary for the product manager",
        "for a product manager:",
        "for the product manager:",
        "summary:",
        "key changes:",
        "overview:",
        "key information:",
        "policy overview:"
    ]
    
    for line in lines:
        # Skip only very specific formatting lines and redundant intros
        line_lower = line.lower().strip()
        
        # Skip separator lines
        if line.startswith('---') or line.startswith('==='):
            continue
            
        # Skip lines that contain any of our skip patterns (more flexible matching)
        if any(pattern in line_lower for pattern in skip_patterns):
            continue
        
        # Additional check for lines that start with problematic patterns
        line_start = line_lower[:50]  # Check first 50 chars for efficiency
        if any(line_start.startswith(pattern.replace(':', '')) for pattern in skip_patterns):
            continue
            
        # Skip lines that are just headers ending with colon that match patterns
        if (line_lower.endswith(':') and 
            any(pattern.replace(':', '') in line_lower for pattern in skip_patterns)):
            continue
            
        # Skip standalone intro headers like "### Summary" or "## Overview"  
        if (line.startswith('#') and 
            any(pattern.replace(':', '') in line_lower for pattern in skip_patterns if len(pattern) > 5)):
            continue
            
        # Keep everything else including bullets and headers
        filtered_lines.append(line)
    
    if not filtered_lines:
        return "Policy content has been updated."
    
    # Join lines with proper spacing
    summary = '\n'.join(filtered_lines)
    
    # Only truncate if extremely long (over 800 chars)
    if len(summary) > max_length:
        # Find a good breaking point near word boundaries
        truncated = summary[:max_length-3]
        last_space = truncated.rfind(' ')
        if last_space > max_length//2:
            summary = truncated[:last_space] + "..."
        else:
            summary = truncated + "..."
    
    return summary

def load_health_alerts():
    """Load health alerts from file generated by health check system"""
    try:
        with open("health_alerts.json", 'r') as f:
            alerts = json.load(f)
        # Only return alerts from the last 6 hours (recent alerts)
        recent_alerts = []
        cutoff_time = datetime.now(UTC) - timedelta(hours=6)
        
        for alert in alerts:
            alert_time = datetime.fromisoformat(alert['timestamp'].replace('Z', '+00:00'))
            if alert_time > cutoff_time:
                recent_alerts.append(alert)
        
        return recent_alerts
    except (FileNotFoundError, json.JSONDecodeError, KeyError):
        return []

def send_email_notification(changes, health_alerts=None):
    """Sends a concise email notification with grouped policy changes and health alerts."""
    if not RESEND_API_KEY or not RECIPIENT_EMAIL:
        print("ERROR: Resend API Key or Recipient Email not configured. Skipping email.", file=sys.stderr)
        return

    if not changes and not health_alerts:
        print("No changes or health alerts to report via email.")
        return

    resend.api_key = RESEND_API_KEY

    # Group changes by platform  
    platform_groups = group_changes_by_platform(changes) if changes else {}
    
    # Updated subject line to include health alerts
    total_items = len(changes) + (len(health_alerts) if health_alerts else 0)
    has_changes = len(changes) > 0
    has_health_alerts = health_alerts and len(health_alerts) > 0
    
    if has_health_alerts and not has_changes:
        subject = f"Health Alert: {len(health_alerts)} URL{'s' if len(health_alerts) != 1 else ''} Failed"
    elif has_changes and not has_health_alerts:
        if len(changes) == 1:
            platform = list(platform_groups.keys())[0] if platform_groups else "Policy"
            subject = f"Policy Update: {platform}"
        else:
            subject = f"Policy Updates: {len(changes)} changes"
    else:
        subject = f"Policy & Health Updates: {total_items} alerts"
    
    # Create clean plain text email with health alerts section
    timestamp = datetime.now(UTC).strftime('%B %d, %Y at %H:%M')
    email_body = f"""T&S Policy Monitoring Report
{timestamp} UTC

"""
    
    # Add health alerts section first (high priority)
    if health_alerts:
        email_body += f"🚨 HEALTH ALERTS\n{'=' * 16}\n\n"
        
        # Group health alerts by platform
        health_by_platform = {}
        for alert in health_alerts:
            platform = alert.get('platform', 'Unknown')
            if platform not in health_by_platform:
                health_by_platform[platform] = []
            health_by_platform[platform].append(alert)
        
        for platform, platform_alerts in health_by_platform.items():
            email_body += f"{platform} - {len(platform_alerts)} URL{'s' if len(platform_alerts) != 1 else ''} Failed\n"
            for alert in platform_alerts:
                slug = alert.get('slug', 'unknown')
                error = alert.get('error_message', 'Connection failed')[:100]
                email_body += f"  • {slug}: {error}\n"
            email_body += "\n"
        
        email_body += "These URLs may need investigation for accessibility issues.\n\n"
        
    # Add policy changes section
    if changes:
        if health_alerts:
            email_body += f"📝 POLICY CHANGES\n{'=' * 16}\n\n"
        else:
            email_body += f"{len(changes)} policy change{'s' if len(changes) != 1 else ''} detected:\n\n"
    
    for platform, platform_changes in platform_groups.items():
        email_body += f"{platform.upper()}\n{'=' * len(platform)}\n\n"
        
        for change in platform_changes:
            change_type = "New Policy" if change['is_new'] else "Updated"
            concise_summary = create_concise_summary(change['summary'])
            policy_clean_name = change['policy_name'].replace(platform.lower(), '').strip()
            
            email_body += f"{policy_clean_name} ({change_type})\n"
            email_body += f"{'-' * (len(policy_clean_name) + len(change_type) + 3)}\n"
            
            # Clean up markdown formatting for plain text
            plain_summary = concise_summary.replace('**', '').replace('* ', '• ')
            # Remove any remaining double spaces and clean up formatting
            plain_summary = ' '.join(plain_summary.split())
            email_body += f"{plain_summary}\n\n"
        
        email_body += "\n"
    
    email_body += """────────────────────────────────────────

View detailed changes and history at:
https://ts-policy-watcher.vercel.app/

"""

    try:
        params = {
            "from": "Policy Watcher <onboarding@resend.dev>",
            "to": [RECIPIENT_EMAIL],
            "subject": subject,
            "text": email_body,
        }
        email = resend.Emails.send(params)
        print(f"Successfully sent email notification. Message ID: {email['id']}")
    except Exception as e:
        print(f"ERROR: Failed to send email notification: {e}", file=sys.stderr)

def main():
    print("--- Starting Differ and Notifier Script ---")
    status = "success"
    pages_checked = 0
    changes_found = 0
    errors = []
    email_notifications = []

    try:
        commit_sha = os.environ.get("COMMIT_SHA")
        if not commit_sha:
            print("No snapshot commit SHA found. Exiting gracefully.")
            return

        try:
            with open(SUMMARIES_FILE, 'r') as f:
                summaries_data = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            summaries_data = {}

        changed_files = get_changed_files(commit_sha)
        pages_checked = len(changed_files)
        if not changed_files:
            print("No policy changes detected.")
            return

        print(f"Detected {pages_checked} changed policy files.")
        update_count = 0

        for file_path in changed_files:
            try:
                slug = os.path.basename(os.path.dirname(file_path))
                is_new_policy = slug not in summaries_data
                summary_text = process_changed_file(file_path, is_new_policy, commit_sha)
                
                if summary_text:
                    if is_new_policy:
                        summaries_data[slug] = {
                            "policy_name": slug.replace('-', ' ').title(),
                            "initial_summary": summary_text,
                            "last_update_summary": "Initial version.",
                            "last_updated": datetime.now(UTC).isoformat().replace('+00:00', 'Z')
                        }
                        print(f"Generated initial summary for new policy: {slug}")
                    else:
                        summaries_data[slug]['last_update_summary'] = summary_text
                        summaries_data[slug]['last_updated'] = datetime.now(UTC).isoformat().replace('+00:00', 'Z')
                        print(f"Generated update summary for existing policy: {slug}")
                    update_count += 1
                    email_notifications.append({
                        "policy_name": slug.replace('-', ' ').title(),
                        "summary": summary_text,
                        "is_new": is_new_policy
                    })
            except Exception as e:
                error_message = f"Failed to process {file_path}: {e}"
                print(error_message, file=sys.stderr)
                errors.append({"file": file_path, "error": str(e)})

        changes_found = update_count
        if changes_found > 0:
            with open(SUMMARIES_FILE, 'w') as f:
                json.dump(summaries_data, f, indent=2)
            print(f"Successfully updated {SUMMARIES_FILE}.")

            # Load health alerts 
            health_alerts = load_health_alerts()
            
            # Send email if there are meaningful changes or health alerts to report
            if email_notifications or health_alerts:
                print(f"Sending email notification for {len(email_notifications)} policy changes and {len(health_alerts)} health alerts.")
                send_email_notification(email_notifications, health_alerts)
            else:
                print("No meaningful changes or health alerts detected - skipping email notification.")
        else:
            print("No policy updates to process - skipping email notification.")

    except Exception as e:
        print(f"An unhandled error occurred: {e}", file=sys.stderr)
        errors.append({"file": "N/A", "error": f"Unhandled exception: {e}"})
        status = "failure"

    finally:
        if errors and status == "success":
            status = "partial_failure"
        
        log_run_status(
            status=status,
            pages_checked=pages_checked,
            changes_found=changes_found,
            errors=errors
        )
        print("--- Differ and Notifier Script Finished ---")

if __name__ == "__main__":
    main()
