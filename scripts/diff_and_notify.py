# scripts/diff_and_notify.py

import os
import subprocess
import google.generativeai as genai
from bs4 import BeautifulSoup
import html2text

# --- Configuration ---
# Your Gemini API key will be read from GitHub Secrets
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

def get_changed_files():
    """Gets a list of snapshot files changed in the last commit."""
    # This git command compares the latest commit (HEAD) with the one before it (HEAD~1)
    # and lists only the names of the changed files.
    result = subprocess.run(
        ["git", "diff", "--name-only", "HEAD~1", "HEAD"],
        capture_output=True, text=True, check=True
    )
    files = result.stdout.strip().split("\n")
    # We only care about changes to our HTML snapshots
    return [f for f in files if f and f.startswith("snapshots/") and f.endswith(".html")]

def get_diff(filepath):
    """Gets the raw diff for a single file from the last commit."""
    result = subprocess.run(
        ["git", "diff", "HEAD~1", "HEAD", "--", filepath],
        capture_output=True, text=True, check=True
    )
    return result.stdout

def clean_html_diff(raw_diff):
    """Strips HTML tags and noise from a raw diff to get clean, comparable text."""
    h = html2text.HTML2Text()
    h.ignore_links = True
    h.ignore_images = True
    h.ignore_emphasis = True
    
    clean_lines = []
    for line in raw_diff.split("\n"):
        # Skip git diff metadata lines
        if line.startswith("---") or line.startswith("+++") or line.startswith("@@"):
            continue
        
        # Strip the leading + or - to parse the HTML content itself
        if not line:
            continue
        content_line = line[1:]
        
        # Use BeautifulSoup to get text content, removing all tags
        soup = BeautifulSoup(content_line, 'html.parser')
        text = soup.get_text(" ", strip=True)
        
        # Only include lines that have meaningful text content
        if text:
            # Add the +/- prefix back to the clean text for context
            clean_lines.append(line[0] + " " + text)
            
    return "\n".join(clean_lines)

def summarize_with_gemini(diff_text):
    """Sends the cleaned diff to Gemini for summarization."""
    if not GEMINI_API_KEY:
        return "Error: GEMINI_API_KEY not configured."
    
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel('gemini-1.5-flash')

    prompt = (
        "You are a Trust & Safety analyst for a live shopping platform. "
        "Below is a diff showing changes to a competitor's policy page. "
        "Analyze these changes and provide a concise summary in markdown format for a product manager.\n\n"
        "Focus on changes that could impact users, creators, or business strategy. "
        "Highlight new features, policy tightening, or significant clarifications. "
        "Ignore minor grammatical or formatting fixes. If the changes are trivial (e.g., only fixing a typo), state that clearly.\n\n"
        "Diff:\n"
        "---\n"
        f"{diff_text}\n"
        "---\n\n"
        "Summary:"
    )

    try:
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        return f"Error calling Gemini API: {e}"

def set_github_action_output(name, value):
    """Sets an output variable for subsequent steps in a GitHub Action."""
    # The GITHUB_OUTPUT path is provided by the runner environment
    with open(os.environ['GITHUB_OUTPUT'], 'a') as fh:
        # This is the required format for multiline outputs
        delimiter = f"gh_action_delimiter_{os.urandom(16).hex()}"
        print(f'{name}<<{delimiter}', file=fh)
        print(value, file=fh)
        print(delimiter, file=fh)

def main():
    try:
        changed_files = get_changed_files()
    except subprocess.CalledProcessError as e:
        print(f"Error getting changed files: {e}. This might happen on the first run; exiting gracefully.")
        set_github_action_output("summary_generated", "false")
        return

    if not changed_files:
        print("No snapshot files changed in the last commit. Nothing to do.")
        set_github_action_output("summary_generated", "false")
        return

    print(f"Found {len(changed_files)} changed files. Analyzing...")
    full_report_parts = []

    for f in changed_files:
        print(f"Analyzing: {f}")
        try:
            raw_diff = get_diff(f)
            # Limit diff size to avoid hitting API context window limits
            cleaned_diff = clean_html_diff(raw_diff)[:15000]

            if not cleaned_diff.strip():
                print(f"Skipping {f} - diff was only cosmetic HTML changes.")
                continue
            
            print(f"Summarizing changes for {f}...")
            summary = summarize_with_gemini(cleaned_diff)
            
            # Get the commit hash to create a permanent link to the change
            commit_hash = os.environ.get("GITHUB_SHA")
            repo_url = f"https://github.com/{os.environ.get('GITHUB_REPOSITORY')}"
            diff_url = f"{repo_url}/commit/{commit_hash}#diff-{hashlib.sha1(f.encode('utf-8')).hexdigest()}"
            
            report_section = (
                f"### Changes detected in: `{f}`\n\n"
                f"**AI Summary:**\n{summary}\n\n"
                f"_[View Raw Diff]({diff_url})_"
            )
            full_report_parts.append(report_section)
        except subprocess.CalledProcessError as e:
            print(f"Could not get diff for {f}. It may be a new file. Error: {e}")
            continue # Continue to the next file
        except Exception as e:
            print(f"An unexpected error occurred while processing {f}: {e}")
            continue

    if not full_report_parts:
        print("All changes were trivial or could not be processed. No notification needed.")
        set_github_action_output("summary_generated", "false")
        return

    # Combine all individual reports into one email body
    final_report_body = "\n\n---\n\n".join(full_report_parts)

    set_github_action_output("summary_generated", "true")
    set_github_action_output("email_subject", f"T&S Policy Watcher Alert: {len(full_report_parts)} Pages Changed")
    set_github_action_output("email_body", final_report_body)
    print("Summary generated and outputs set successfully.")

if __name__ == "__main__":
    # Import hashlib only if running main
    import hashlib
    main()