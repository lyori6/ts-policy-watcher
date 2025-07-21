# scripts/diff_and_notify.py

import os
import sys
import json
import subprocess
from datetime import datetime
import google.generativeai as genai
from bs4 import BeautifulSoup, MarkupResemblesLocatorWarning
import html2text
import warnings
import resend

# Suppress BeautifulSoup warnings
warnings.filterwarnings("ignore", category=MarkupResemblesLocatorWarning)

# --- Configuration ---
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GEMINI_API_KEY_2 = os.environ.get("GEMINI_API_KEY_2")
RUN_LOG_FILE = "run_log.json"
SUMMARIES_FILE = "summaries.json"
PROMPT_TEMPLATE = """You are a Trust & Safety analyst. Below is text from a competitor's policy page. Analyze it and provide a concise summary in markdown format for a product manager. {instruction}\n\nText:\n---\n{policy_text}\n---\n\nSummary:"""

# Track which API key we're currently using
current_api_key = GEMINI_API_KEY
using_backup_key = False
RESEND_API_KEY = os.environ.get("RESEND_API_KEY")
RECIPIENT_EMAIL = os.environ.get("RECIPIENT_EMAIL")

def get_changed_files(commit_sha):
    """Gets a list of snapshot files from a specific commit SHA."""
    try:
        result = subprocess.run(
            ["git", "show", "--pretty=", "--name-only", commit_sha],
            capture_output=True, text=True, check=True
        )
        files = result.stdout.strip().split("\n")
        return [f for f in files if f and f.startswith("snapshots/") and f.endswith(".html")]
    except subprocess.CalledProcessError as e:
        print(f"ERROR: 'git show' failed with exit code {e.returncode}", file=sys.stderr)
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
        "Summarize the key points of this entire policy document." if is_new_policy 
        else "Summarize the key changes based on this diff."
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
    """Appends the status of the current run to a JSON log file."""
    log_entry = {
        "timestamp_utc": datetime.utcnow().isoformat() + 'Z',
        "status": status,
        "pages_checked": pages_checked,
        "changes_found": changes_found,
        "errors": errors
    }
    
    log_data = []
    if os.path.exists(RUN_LOG_FILE):
        try:
            with open(RUN_LOG_FILE, 'r') as f:
                log_data = json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            print(f"Warning: Could not read or parse {RUN_LOG_FILE}. A new one will be created.", file=sys.stderr)
            log_data = []

    log_data.insert(0, log_entry)

    with open(RUN_LOG_FILE, 'w') as f:
        json.dump(log_data, f, indent=2)
    
    print(f"Successfully logged run status to {RUN_LOG_FILE}")

def group_changes_by_platform(changes):
    """Groups policy changes by platform for better organization."""
    platform_groups = {}
    
    for change in changes:
        # Extract platform from policy name or use a mapping
        policy_name = change['policy_name'].lower()
        platform = 'Unknown'
        
        if 'tiktok' in policy_name:
            platform = 'TikTok'
        elif 'instagram' in policy_name:
            platform = 'Instagram'  
        elif 'youtube' in policy_name:
            platform = 'YouTube'
        elif 'whatnot' in policy_name:
            platform = 'Whatnot'
            
        if platform not in platform_groups:
            platform_groups[platform] = []
        platform_groups[platform].append(change)
    
    return platform_groups

def create_concise_summary(summary_text, max_sentences=2):
    """Creates a concise 1-2 sentence summary from longer text."""
    if not summary_text:
        return "Policy updated with new content."
    
    # Split into sentences and take first 1-2 meaningful ones
    sentences = [s.strip() for s in summary_text.split('.') if s.strip() and len(s.strip()) > 20]
    
    if not sentences:
        return "Policy content has been updated."
    
    # Take first sentence, or first two if first is very short
    if len(sentences) == 1 or len(sentences[0]) > 80:
        return sentences[0] + "."
    else:
        return sentences[0] + ". " + sentences[1] + "."

def send_email_notification(changes):
    """Sends a concise email notification with grouped policy changes."""
    if not RESEND_API_KEY or not RECIPIENT_EMAIL:
        print("ERROR: Resend API Key or Recipient Email not configured. Skipping email.", file=sys.stderr)
        return

    if not changes:
        print("No significant changes to report via email.")
        return

    resend.api_key = RESEND_API_KEY

    # Group changes by platform
    platform_groups = group_changes_by_platform(changes)
    
    subject = f"Policy Watch: {len(changes)} meaningful change{'s' if len(changes) != 1 else ''} detected"
    
    # Create concise HTML email
    html_body = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">
            Policy Watch Report
        </h2>
        <p style="color: #555; margin-bottom: 25px;">
            Detected {len(changes)} meaningful policy change{'s' if len(changes) != 1 else ''} on {datetime.utcnow().strftime('%B %d, %Y at %H:%M')} UTC
        </p>
    """
    
    for platform, platform_changes in platform_groups.items():
        html_body += f"""
        <div style="margin-bottom: 25px; border-left: 4px solid #3498db; padding-left: 15px;">
            <h3 style="color: #2c3e50; margin: 0 0 15px 0; font-size: 18px;">{platform}</h3>
        """
        
        for change in platform_changes:
            change_type = "New Policy" if change['is_new'] else "Updated"
            concise_summary = create_concise_summary(change['summary'])
            policy_clean_name = change['policy_name'].replace(platform.lower(), '').strip()
            
            html_body += f"""
            <div style="margin-bottom: 15px; padding: 12px; background: #f8f9fa; border-radius: 6px;">
                <div style="font-weight: 600; color: #2c3e50; margin-bottom: 5px;">
                    {policy_clean_name} <span style="font-size: 12px; color: #7f8c8d;">({change_type})</span>
                </div>
                <div style="color: #555; line-height: 1.4;">
                    {concise_summary}
                </div>
            </div>
            """
        
        html_body += "</div>"
    
    html_body += """
        <div style="margin-top: 30px; padding: 15px; background: #ecf0f1; border-radius: 6px; text-align: center;">
            <p style="color: #7f8c8d; margin: 0; font-size: 14px;">
                View detailed changes and history at your 
                <a href="https://ts-policy-watcher.vercel.app/" style="color: #3498db;">Policy Dashboard</a>
            </p>
        </div>
    </div>
    """

    try:
        params = {
            "from": "Policy Watcher <onboarding@resend.dev>",
            "to": [RECIPIENT_EMAIL],
            "subject": subject,
            "html": html_body,
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
                            "last_updated": datetime.utcnow().isoformat() + 'Z'
                        }
                        print(f"Generated initial summary for new policy: {slug}")
                    else:
                        summaries_data[slug]['last_update_summary'] = summary_text
                        summaries_data[slug]['last_updated'] = datetime.utcnow().isoformat() + 'Z'
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

            # Send email only if there are meaningful changes to report
            if email_notifications:
                print(f"Sending email notification for {len(email_notifications)} meaningful changes.")
                send_email_notification(email_notifications)
            else:
                print("No meaningful changes detected - skipping email notification.")
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
