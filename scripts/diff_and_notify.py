# scripts/diff_and_notify.py

print("=== DIFF_AND_NOTIFY STARTING ===", flush=True)
print("Attempting imports...", flush=True)

try:
    import os
    print("✓ os imported", flush=True)
    import sys
    print("✓ sys imported", flush=True)
    import json
    print("✓ json imported", flush=True)
    import subprocess
    print("✓ subprocess imported", flush=True)
    from datetime import datetime
    print("✓ datetime imported", flush=True)
    import google.generativeai as genai
    print("✓ google.generativeai imported", flush=True)
    from bs4 import BeautifulSoup, MarkupResemblesLocatorWarning
    print("✓ BeautifulSoup imported", flush=True)
    import html2text
    print("✓ html2text imported", flush=True)
    import warnings
    print("✓ warnings imported", flush=True)
    print("All imports successful!", flush=True)
except Exception as e:
    print(f"FATAL IMPORT ERROR: {e}", flush=True, file=sys.stderr)
    sys.exit(1)

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
    print("--- Starting Differ and Notifier Script ---", flush=True)
    print("Initializing variables...", flush=True)
    status = "success"
    pages_checked = 0
    changes_found = 0
    errors = []

    try:
        print("Entered main try block", flush=True)
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
                summary_text = process_changed_file(file_path, is_new_policy)
                
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
            except Exception as e:
                error_message = f"Failed to process {file_path}: {e}"
                print(error_message, file=sys.stderr)
                errors.append({"file": file_path, "error": str(e)})

        changes_found = update_count
        if changes_found > 0:
            with open(SUMMARIES_FILE, 'w') as f:
                json.dump(summaries_data, f, indent=2)
            print(f"Successfully updated {SUMMARIES_FILE}.")

    except Exception as e:
        print(f"An unhandled error occurred: {e}", file=sys.stderr)
        errors.append({"file": "N/A", "error": f"Unhandled exception: {e}"})
        status = "failure"

    finally:
        print("Entered finally block", flush=True)
        if errors and status == "success":
            status = "partial_failure"
        
        print("About to call log_run_status...", flush=True)
        try:
            log_run_status(
                status=status,
                pages_checked=pages_checked,
                changes_found=changes_found,
                errors=errors
            )
            print("log_run_status completed successfully", flush=True)
        except Exception as log_error:
            print(f"FATAL: log_run_status failed: {log_error}", flush=True, file=sys.stderr)
        
        print("--- Differ and Notifier Script Finished ---", flush=True)

if __name__ == "__main__":
    main()
