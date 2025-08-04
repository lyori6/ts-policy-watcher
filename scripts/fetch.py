#import json
import json
import httpx
import time
import os
import sys
from pathlib import Path
from datetime import datetime, UTC
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError
from bs4 import BeautifulSoup

# --- Configuration ---
USER_AGENT = "TrustAndSafety-Policy-Watcher/1.0 (https://github.com/your-repo/ts-policy-watcher; mailto:your-email@example.com)"
URL_CONFIG_FILE = Path("platform_urls.json")
FAILURE_LOG_FILE = Path("failures.log")
RETRY_ATTEMPTS = 2
RETRY_DELAY_SECONDS = 5

def get_snapshot_base_directory():
    """
    Determine snapshot base directory based on environment.
    
    Environment detection logic:
    - GitHub Actions (production): snapshots/production/
    - Local development (DEBUG_FETCH=1 or DEVELOPMENT_MODE=1): snapshots/development/
    - Default: snapshots/production/ (backward compatibility)
    """
    if os.getenv('GITHUB_ACTIONS'):
        return Path("snapshots/production")
    elif os.getenv('DEBUG_FETCH') or os.getenv('DEVELOPMENT_MODE'):
        return Path("snapshots/development")
    else:
        # Backward compatibility: use production by default
        return Path("snapshots/production")

# Dynamic snapshots directory based on environment
SNAPSHOTS_DIR = get_snapshot_base_directory()

def fetch_with_httpx(url: str) -> str:
    """Fetches page content using the lightweight httpx library."""
    headers = {"User-Agent": USER_AGENT}
    with httpx.Client(headers=headers, follow_redirects=True) as client:
        response = client.get(url, timeout=30.0)
        response.raise_for_status()
        return response.text

def fetch_with_playwright(url: str) -> str:
    """Fetches page content using a full headless browser (Playwright)."""
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(user_agent=USER_AGENT)
        try:
            page.goto(url, timeout=60000, wait_until='domcontentloaded')
            page.wait_for_timeout(3000)
            content = page.content()
        except PlaywrightTimeoutError as e:
            print(f"    ERROR: Playwright timeout for {url}: {e}", file=sys.stderr)
            raise
        finally:
            browser.close()
        return content

def clean_html(html_content: str) -> str:
    """
    Cleans HTML content by removing noisy tags and normalizing whitespace.
    For Google/YouTube help pages, it specifically targets the main article body
    and removes dynamic elements like feedback forms and follow buttons.
    """
    soup = BeautifulSoup(html_content, 'html.parser')

    # For Google/YouTube pages, find the main content area
    # First try class-based selector, then itemprop-based selector
    article_body = soup.find('div', class_='article-body')
    if not article_body:
        article_body = soup.find('div', attrs={'itemprop': 'articleBody'})
    
    # If a specific container is found, use it. Otherwise, use the whole soup.
    target_soup = article_body if article_body else soup

    # Remove dynamic elements that change on each request
    # 1. Remove the feedback form, which contains dynamic IDs
    feedback_form = target_soup.find('div', class_='article-survey-container')
    if feedback_form:
        feedback_form.decompose()
    
    # 2. Remove follow/subscribe buttons with dynamic IDs
    for subscribe_btn in target_soup.find_all('div', class_='subscribe-btn'):
        subscribe_btn.decompose()
    
    # 3. Remove any element with dynamic ID patterns (contains random numbers)
    import re
    for element in target_soup.find_all(attrs={'id': re.compile(r'.*-\d+\.\d+.*')}):
        element.decompose()
    
    # 4. Remove Google-specific dynamic elements
    # Remove zwieback_id div that contains dynamic session IDs
    for zwieback_div in target_soup.find_all('div', attrs={'data-page-data-key': 'zwieback_id'}):
        zwieback_div.decompose()
    
    # 5. Remove hidden elements that don't contain meaningful content
    for hidden_element in target_soup.find_all(attrs={'style': re.compile(r'display:\s*none')}):
        hidden_element.decompose()
    
    # 6. Remove search elements that can appear in different positions
    for search_element in target_soup.find_all(['input', 'button'], attrs={'type': 'search'}):
        search_element.decompose()
    for search_element in target_soup.find_all(attrs={'class': re.compile(r'search|menu')}):
        search_element.decompose()
    
    # 7. Remove Google-specific navigation elements that load dynamically
    for nav_element in target_soup.find_all(['form', 'div'], attrs={'role': 'search'}):
        nav_element.decompose()
    
    # 8. Remove text patterns that appear in different orders dynamically
    # This is aggressive filtering for navigation elements
    dynamic_nav_patterns = [
        'SearchClear searchClose searchMain menu',
        'Google Help', 
        'Help Center',
        'Google apps'
    ]
    
    # Split text into lines and filter out navigation patterns
    text = target_soup.get_text()
    lines = text.splitlines()
    filtered_lines = []
    
    for line in lines:
        line = line.strip()
        if line and not any(pattern in line for pattern in dynamic_nav_patterns):
            filtered_lines.append(line)
    
    # Return early with filtered content
    return "\n".join(filtered_lines)

def main():
    """Main function to orchestrate the fetching process."""
    print("--- Starting Fetcher Script ---")
    
    # Track run statistics
    run_start_time = datetime.now(UTC)
    pages_checked = 0
    changes_found = 0
    errors = []
    
    # CRITICAL: Check if config file exists
    if not URL_CONFIG_FILE.is_file():
        print(f"FATAL: Configuration file not found at '{URL_CONFIG_FILE}'. Make sure it's in the root directory.", file=sys.stderr)
        sys.exit(1) # Exit with an error code to fail the workflow step

    with open(URL_CONFIG_FILE, "r") as f:
        try:
            pages_to_track = json.load(f)
        except json.JSONDecodeError as e:
            print(f"FATAL: Could not parse {URL_CONFIG_FILE}. Invalid JSON. Error: {e}", file=sys.stderr)
            sys.exit(1)

    if not pages_to_track:
        print("WARNING: The configuration file is empty. No pages to track.", file=sys.stderr)
        sys.exit(0)

    print(f"Successfully loaded {len(pages_to_track)} pages from config.")
    failures = []

    for page_data in pages_to_track:
        url = page_data["url"]
        slug = page_data["slug"]
        renderer = page_data.get("renderer", "httpx")
        
        print(f"\n[INFO] Processing '{slug}'...")
        print(f"  - URL: {url}")
        print(f"  - Renderer: {renderer}")
        
        pages_checked += 1

        content = None
        for attempt in range(RETRY_ATTEMPTS):
            try:
                if renderer == "playwright":
                    content = fetch_with_playwright(url)
                else:
                    content = fetch_with_httpx(url)
                break 
            except Exception as e:
                error_msg = f"Attempt {attempt + 1}/{RETRY_ATTEMPTS} FAILED for {slug}. Reason: {e}"
                print(f"    - {error_msg}", file=sys.stderr)
                if attempt < RETRY_ATTEMPTS - 1:
                    time.sleep(RETRY_DELAY_SECONDS)
                else:
                    failures.append({"url": url, "platform": slug, "reason": str(e)})
                    errors.append(error_msg)

        if content:
            try:
                output_path = SNAPSHOTS_DIR / slug / "snapshot.html"
                output_path.parent.mkdir(parents=True, exist_ok=True)

                is_new_policy = not output_path.exists()
                cleaned_new = clean_html(content)

                if is_new_policy:
                    output_path.write_text(content, encoding="utf-8")
                    print(f"  - NEW: Saved initial snapshot for {slug} at {output_path}")
                else:
                    old_content = output_path.read_text(encoding="utf-8")
                    cleaned_old = clean_html(old_content)

                    # Debug mode: Save raw HTML files for comparison if DEBUG_FETCH is set
                    if os.environ.get("DEBUG_FETCH"):
                        debug_dir = Path("/tmp")
                        debug_dir.mkdir(exist_ok=True)
                        (debug_dir / f"{slug}_fetch1.html").write_text(old_content, encoding="utf-8")
                        (debug_dir / f"{slug}_fetch2.html").write_text(content, encoding="utf-8")
                        (debug_dir / f"{slug}_cleaned1.txt").write_text(cleaned_old, encoding="utf-8")
                        (debug_dir / f"{slug}_cleaned2.txt").write_text(cleaned_new, encoding="utf-8")
                        print(f"  - DEBUG: Saved files to /tmp/{slug}_fetch*.html and /tmp/{slug}_cleaned*.txt")

                    # Compare cleaned content
                    if os.environ.get("DEBUG_FETCH"):
                        print(f"  - DEBUG: cleaned_old length: {len(cleaned_old)}, cleaned_new length: {len(cleaned_new)}")
                        print(f"  - DEBUG: cleaned_old == cleaned_new: {cleaned_old == cleaned_new}")
                    
                    if cleaned_old == cleaned_new:
                        print(f"  - NO CHANGE: Content for '{slug}' is unchanged.")
                    else:
                        # Overwrite the file only if the cleaned content is different
                        output_path.write_text(content, encoding="utf-8")
                        changes_found += 1
                        print(f"  - SUCCESS: Snapshot updated for {slug} at {output_path}")
            except Exception as e:
                print(f"    - CRITICAL: Failed to write file for {url}. Reason: {e}", file=sys.stderr)
                failures.append({"url": url, "platform": slug, "reason": f"File write error: {e}"})

    # Create run log entry
    try:
        run_log_entry = {
            "timestamp_utc": run_start_time.isoformat() + "Z",
            "status": "success" if not failures else "partial_failure",
            "pages_checked": pages_checked,
            "changes_found": changes_found,
            "errors": errors
        }
        
        # Load existing run log or create new one
        run_log_file = Path("run_log.json")
        if run_log_file.exists():
            try:
                with open(run_log_file, "r") as f:
                    run_log = json.load(f)
            except (json.JSONDecodeError, IOError):
                run_log = []
        else:
            run_log = []
        
        # Add new entry at the beginning and keep only the last 25 entries
        run_log.insert(0, run_log_entry)
        run_log = run_log[:25]
        
        # Write updated run log
        with open(run_log_file, "w") as f:
            json.dump(run_log, f, indent=2)
        
        print(f"\n--- Run Log Updated: {pages_checked} pages checked, {changes_found} changes found ---")
    
    except Exception as e:
        print(f"WARNING: Failed to update run log: {e}", file=sys.stderr)
        
    if failures:
        print(f"\n--- Fetch completed with {len(failures)} failures. ---", file=sys.stderr)
        with open(FAILURE_LOG_FILE, "w") as f:
            for failure in failures:
                f.write(json.dumps(failure) + "\n")
        print(f"Failure details written to {FAILURE_LOG_FILE}")
    else:
        print("\n--- Fetch completed successfully with 0 failures. ---")
        if FAILURE_LOG_FILE.exists():
            os.remove(FAILURE_LOG_FILE)

if __name__ == "__main__":
    main()
