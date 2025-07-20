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

# Suppress BeautifulSoup warnings
warnings.filterwarnings("ignore", category=MarkupResemblesLocatorWarning)

# --- Configuration ---
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
RUN_LOG_FILE = "run_log.json"
SUMMARIES_FILE = "summaries.json"
PROMPT_TEMPLATE = """You are a Trust & Safety analyst. Below is text from a competitor's policy page. Analyze it and provide a concise summary in markdown format for a product manager. {instruction}\n\nText:\n---\n{policy_text}\n---\n\nSummary:"""

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
        print(f"Could not get changed files: {e}. This may be the first run.", file=sys.stderr)
        return []
    except Exception as e:
        print(f"An unexpected error occurred while getting changed files: {e}.", file=sys.stderr)
        return []

def get_git_diff(file_path, commit_sha):
    """Gets the raw diff for a single file from a specific commit."""
    # This compares the commit with its direct parent
    return subprocess.run(
        ["git", "diff", f"{commit_sha}~1", commit_sha, "--", file_path],
        capture_output=True, text=True, check=True
    ).stdout

def clean_html(html_content):
    """Strips all HTML tags to get clean text."""
    soup = BeautifulSoup(html_content, 'html.parser')
    return soup.get_text(" ", strip=True)

def get_ai_summary(text_content, is_new_policy):
    """Generates a summary using the Gemini API."""
    if not GEMINI_API_KEY:
        return "Error: GEMINI_API_KEY not configured."
    
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel('gemini-1.5-flash')
    
    instruction = (
        "Summarize the key points of this entire policy document." if is_new_policy 
        else "Summarize the key changes based on this diff."
    )
    
    prompt = PROMPT_TEMPLATE.format(instruction=instruction, policy_text=text_content)
    
    try:
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        print(f"ERROR: Gemini API call failed. Reason: {e}", file=sys.stderr)
        return None

def process_changed_file(file_path, is_new_policy):
    """Processes a single changed file to generate a summary."""
    print(f"\nProcessing: {file_path} {'(new policy)' if is_new_policy else '(existing policy)'}")
    
    try:
        if is_new_policy:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            text_to_summarize = clean_html(content)
        else:
            diff_content = get_git_diff(file_path, commit_sha)
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

def main():
    print("--- Starting Differ and Notifier Script ---")

    commit_sha = os.environ.get("COMMIT_SHA")
    if not commit_sha:
        print("No snapshot commit SHA found. Exiting gracefully.")
        log_run_status(status="success", pages_checked=0, changes_found=0, errors=[])
        return

    # Load existing summaries or create a new dictionary
    try:
        with open(SUMMARIES_FILE, 'r') as f:
            summaries_data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        summaries_data = {}

    changed_files = get_changed_files(commit_sha)
    
    if not changed_files:
        print("No policy changes detected.")
        log_run_status(status="success", pages_checked=0, changes_found=0, errors=[])
        return

    print(f"Detected {len(changed_files)} changed policy files.")
    
    update_count = 0
    for file_path in changed_files:
        slug = os.path.basename(os.path.dirname(file_path))
        is_new_policy = slug not in summaries_data

        summary_text = process_changed_file(file_path, is_new_policy)
        
        if summary_text:
            if is_new_policy:
                # Create a new entry for a policy seen for the first time
                summaries_data[slug] = {
                    "initial_summary": summary_text,
                    "last_update_summary": "", # No updates yet
                    "last_update_timestamp_utc": datetime.utcnow().isoformat() + 'Z'
                }
                print(f"Generated initial summary for new policy: {slug}")
            else:
                # Update the entry for an existing policy
                summaries_data[slug]['last_update_summary'] = summary_text
                summaries_data[slug]['last_update_timestamp_utc'] = datetime.utcnow().isoformat() + 'Z'
                print(f"Generated update summary for existing policy: {slug}")
            update_count += 1

    # Save the updated summaries back to the file
    with open(SUMMARIES_FILE, 'w') as f:
        json.dump(summaries_data, f, indent=2)
    print(f"Successfully updated {SUMMARIES_FILE}.")

    log_run_status(status="success", pages_checked=len(changed_files), changes_found=update_count, errors=[])

if __name__ == "__main__":
    main()
