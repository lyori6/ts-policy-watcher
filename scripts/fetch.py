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

PUNCTUATION_MARKERS = ('.', '!', '?')
HISTORY_SUBDIR_NAME = "history"
HISTORY_MANIFEST_FILENAME = "index.json"
MAX_HISTORY_ENTRIES = 5

# --- Configuration ---
USER_AGENT = "TrustAndSafety-Policy-Watcher/1.0 (https://github.com/your-repo/ts-policy-watcher; mailto:your-email@example.com)"
URL_CONFIG_FILE = Path("platform_urls.json")
FAILURE_LOG_FILE = Path("failures.log")
RETRY_ATTEMPTS = 2
RETRY_DELAY_SECONDS = 5

# --- Error Classification ---
class URLErrorTypes:
    """Classification of URL fetch errors for smart retry logic."""
    BROKEN_LINK = "404_not_found"          # Don't retry - URL is permanently broken
    ACCESS_DENIED = "403_forbidden"        # Don't retry - Access blocked
    SERVER_ERROR = "5xx_server_error"      # Retry - Temporary server issue
    NETWORK_TIMEOUT = "timeout"            # Retry - Network connectivity issue
    UNKNOWN = "unknown_error"              # Retry once - Uncertain cause

def classify_error(exception: Exception) -> str:
    """Classify error type for smart retry logic."""
    error_str = str(exception).lower()
    
    if "404" in error_str or "not found" in error_str:
        return URLErrorTypes.BROKEN_LINK
    elif "403" in error_str or "forbidden" in error_str:
        return URLErrorTypes.ACCESS_DENIED
    elif "5" in error_str and ("50" in error_str or "51" in error_str or "52" in error_str or "53" in error_str):
        return URLErrorTypes.SERVER_ERROR
    elif "timeout" in error_str:
        return URLErrorTypes.NETWORK_TIMEOUT
    else:
        return URLErrorTypes.UNKNOWN

def should_retry(error_type: str) -> bool:
    """Determine if error type should be retried."""
    return error_type in [URLErrorTypes.SERVER_ERROR, URLErrorTypes.NETWORK_TIMEOUT, URLErrorTypes.UNKNOWN]

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


def is_env_flag_enabled(name: str) -> bool:
    """Return True when the given environment variable is set to a truthy value."""
    raw_value = os.getenv(name)
    if raw_value is None:
        return False
    return raw_value.strip().lower() not in {"", "0", "false", "no", "off"}


HISTORY_EXPORT_ENABLED = is_env_flag_enabled("ENABLE_HISTORY_EXPORT")
CLEAN_SNAPSHOT_FILENAME = "clean.txt"
HISTORY_EXPORT_ONLY_MODE = is_env_flag_enabled("HISTORY_EXPORT_ONLY")


def export_clean_snapshot_if_enabled(slug: str, cleaned_content: str, slug_dir: Path) -> None:
    """Persist a cleaned snapshot when history export is enabled."""
    if not HISTORY_EXPORT_ENABLED:
        return

    clean_path = slug_dir / CLEAN_SNAPSHOT_FILENAME
    try:
        existed_before = clean_path.exists()
        if existed_before:
            existing_clean = clean_path.read_text(encoding="utf-8")
            if existing_clean == cleaned_content:
                return

        clean_path.write_text(cleaned_content, encoding="utf-8")
        action = "Initialized" if not existed_before else "Updated"
        print(f"  - HISTORY EXPORT: {action} clean snapshot at {clean_path}")
    except Exception as e:
        print(f"    - WARNING: Failed to write clean snapshot for {slug}: {e}", file=sys.stderr)


def load_history_manifest(manifest_path: Path) -> list[dict]:
    if not manifest_path.exists():
        return []
    try:
        raw_data = json.loads(manifest_path.read_text(encoding="utf-8"))
        if isinstance(raw_data, list):
            return raw_data

        # Backwards compatibility with legacy manifest structure {"slug": ..., "versions": [...]}
        if isinstance(raw_data, dict) and "versions" in raw_data:
            converted: list[dict] = []
            for legacy_entry in raw_data.get("versions", []):
                file_name = legacy_entry.get("path") or legacy_entry.get("file")
                if not file_name:
                    continue

                version_id = legacy_entry.get("version_id") or ""
                iso_timestamp = ""
                label = version_id

                if version_id:
                    try:
                        dt = datetime.strptime(version_id, "%Y%m%dT%H%M%SZ").replace(tzinfo=UTC)
                        iso_timestamp = dt.isoformat().replace('+00:00', 'Z')
                        label = dt.strftime("%b %d, %Y · %H:%M UTC")
                    except ValueError:
                        iso_timestamp = ""
                        label = version_id

                converted.append({
                    "timestamp": iso_timestamp,
                    "label": label,
                    "file": file_name
                })

            save_history_manifest(manifest_path, converted)
            return converted

        return []
    except json.JSONDecodeError as exc:
        print(f"    - WARNING: History manifest corrupted at {manifest_path}: {exc}. Rebuilding.", file=sys.stderr)
        return []


def save_history_manifest(manifest_path: Path, manifest: list[dict]) -> None:
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")


def update_history_artifacts(slug: str, cleaned_content: str, snapshots_dir: Path) -> None:
    if not HISTORY_EXPORT_ENABLED:
        return

    history_root = snapshots_dir / HISTORY_SUBDIR_NAME / slug
    manifest_path = history_root / HISTORY_MANIFEST_FILENAME

    try:
        history_root.mkdir(parents=True, exist_ok=True)
        manifest = load_history_manifest(manifest_path)

        # Skip new entry if latest stored content matches the cleaned content
        if manifest:
            latest_file = manifest[0].get("file")
            if latest_file:
                latest_path = history_root / latest_file
                if latest_path.exists():
                    existing_text = latest_path.read_text(encoding="utf-8")
                    if existing_text == cleaned_content:
                        return

        timestamp = datetime.now(UTC)
        iso_timestamp = timestamp.isoformat().replace('+00:00', 'Z')
        label = timestamp.strftime("%b %d, %Y · %H:%M UTC")

        base_filename = timestamp.strftime("%Y%m%dT%H%M%SZ")
        file_name = f"{base_filename}.txt"
        file_path = history_root / file_name
        suffix = 1
        while file_path.exists():
            suffix += 1
            file_name = f"{base_filename}-{suffix}.txt"
            file_path = history_root / file_name

        file_path.write_text(cleaned_content, encoding="utf-8")

        entry: dict[str, str] = {
            "timestamp": iso_timestamp,
            "label": label,
            "file": file_name,
        }

        commit_sha = os.getenv("GITHUB_SHA")
        if commit_sha:
            entry["commit"] = commit_sha[:7]
            entry["commit_full"] = commit_sha

        manifest.insert(0, entry)

        # Enforce retention cap
        while len(manifest) > MAX_HISTORY_ENTRIES:
            removed = manifest.pop()
            removed_file = removed.get("file")
            if removed_file:
                removed_path = history_root / removed_file
                if removed_path.exists():
                    removed_path.unlink()

        save_history_manifest(manifest_path, manifest)
        print(f"  - HISTORY EXPORT: Added entry for {slug} ({file_name})")
    except Exception as exc:  # noqa: BLE001
        print(f"    - WARNING: Failed to update history for {slug}: {exc}", file=sys.stderr)


def run_history_export_only_mode() -> None:
    """Generate clean artifacts from existing snapshots without refetching."""
    if not HISTORY_EXPORT_ENABLED:
        print("History export flag not set; skipping clean artifact generation.")
        return

    base_dir = SNAPSHOTS_DIR
    if not base_dir.exists():
        print(f"No snapshots directory found at {base_dir}. Nothing to export.")
        return

    snapshot_files = sorted(base_dir.glob("*/snapshot.html"))
    if not snapshot_files:
        print(f"No snapshot.html files found under {base_dir}.")
        return

    print(f"History export-only mode: processing {len(snapshot_files)} snapshots in {base_dir}.")

    for snapshot_path in snapshot_files:
        slug = snapshot_path.parent.name
        try:
            html_content = snapshot_path.read_text(encoding="utf-8")
        except Exception as exc:  # noqa: BLE001
            print(f"    - WARNING: Failed to read {snapshot_path}: {exc}", file=sys.stderr)
            continue

        cleaned = clean_html(html_content, slug)
        export_clean_snapshot_if_enabled(slug, cleaned, snapshot_path.parent)

        update_history_artifacts(slug, cleaned, SNAPSHOTS_DIR)

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
            response = page.goto(url, timeout=60000, wait_until='domcontentloaded')
            
            # CRITICAL FIX: Check HTTP status code to prevent silent failures
            if response and response.status >= 400:
                raise Exception(f"HTTP {response.status}: {response.status_text}")
            
            page.wait_for_timeout(3000)
            content = page.content()
        except PlaywrightTimeoutError as e:
            print(f"    ERROR: Playwright timeout for {url}: {e}", file=sys.stderr)
            raise
        finally:
            browser.close()
        return content

def lines_without_noise(lines, slug: str | None) -> list[str]:
    """Filter out nav-heavy lines and platform-specific noise."""

    dynamic_nav_patterns = [
        'SearchClear searchClose searchMain menu',
        'Google Help',
        'Help Center',
        'Google apps',
        'Community Standards | Transparency Center',
        'Preferred Language',
        'Was it helpful?',
        'Submit Feedback',
        'Next article',
        'TikTokCompany',
        'Product feedbackHow do you think we can improve?',
        'Sorry to interrupt',
    ]

    slug_specific_patterns = {
        'youtube-': ['Do not share any personal info'],
        'twitch-': [
            'English',
            'twitch.tv ↗',
            'Search',
            'Enter a search term and use arrow keys to navigate results. Press enter to select.',
            'Loading×Sorry to interrupt',
        ],
        'tiktok-': ['Yes', 'No', 'Read next'],
    }

    if slug:
        for prefix, patterns in slug_specific_patterns.items():
            if slug.startswith(prefix):
                dynamic_nav_patterns.extend(patterns)
                break

    cleaned = []
    for line in lines:
        if not line:
            continue
        if any(pattern in line for pattern in dynamic_nav_patterns):
            continue
        # Drop language grids or nav blobs (very long lines with almost no spaces)
        if len(line) > 180 and line.count(' ') < 4:
            continue
        cleaned.append(line)

    return cleaned


def trim_leading_navigation(lines: list[str], slug: str | None) -> list[str]:
    """Remove leading navigational headings until real sentences appear."""
    if slug and slug.startswith('meta-'):
        for idx, line in enumerate(lines):
            if 'The Community Standards outline' in line:
                return lines[idx:]

    for idx, line in enumerate(lines):
        if any(marker in line for marker in PUNCTUATION_MARKERS):
            start = max(0, idx - 1)
            return lines[start:]
    return lines


def clean_html(html_content: str, slug: str | None = None) -> str:
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
    text = target_soup.get_text(separator="\n")
    lines = [" ".join(part.strip() for part in line.split()) for line in text.splitlines()]

    filtered_lines = lines_without_noise(lines, slug)

    if slug and (slug.startswith('meta-') or slug.startswith('twitch-')):
        filtered_lines = trim_leading_navigation(filtered_lines, slug)

    if not filtered_lines:
        # Fallback to raw text when filters are overly aggressive
        return text.strip()

    return "\n".join(filtered_lines)

def main():
    """Main function to orchestrate the fetching process."""
    print("--- Starting Fetcher Script ---")
    if HISTORY_EXPORT_ENABLED:
        print("History export enabled: clean artifacts will be written alongside snapshots.")

    if HISTORY_EXPORT_ONLY_MODE:
        print("History export-only flag detected; skipping network fetch and exporting existing snapshots.")
        run_history_export_only_mode()
        return
    
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
        error_type = None
        for attempt in range(RETRY_ATTEMPTS):
            try:
                if renderer == "playwright":
                    content = fetch_with_playwright(url)
                else:
                    content = fetch_with_httpx(url)
                break 
            except Exception as e:
                error_type = classify_error(e)
                error_msg = f"Attempt {attempt + 1}/{RETRY_ATTEMPTS} FAILED for {slug}. Error Type: {error_type}. Reason: {e}"
                print(f"    - {error_msg}", file=sys.stderr)
                
                # Smart retry logic - don't retry permanent failures
                if not should_retry(error_type):
                    print(f"    - Not retrying {error_type} - permanent failure", file=sys.stderr)
                    failures.append({
                        "url": url, 
                        "platform": slug, 
                        "reason": str(e),
                        "error_type": error_type,
                        "attempts": attempt + 1
                    })
                    errors.append(error_msg)
                    break
                elif attempt < RETRY_ATTEMPTS - 1:
                    time.sleep(RETRY_DELAY_SECONDS)
                else:
                    failures.append({
                        "url": url, 
                        "platform": slug, 
                        "reason": str(e),
                        "error_type": error_type,
                        "attempts": RETRY_ATTEMPTS
                    })
                    errors.append(error_msg)

        if content:
            try:
                output_path = SNAPSHOTS_DIR / slug / "snapshot.html"
                output_path.parent.mkdir(parents=True, exist_ok=True)

                is_new_policy = not output_path.exists()
                cleaned_new = clean_html(content, slug)

                if is_new_policy:
                    output_path.write_text(content, encoding="utf-8")
                    print(f"  - NEW: Saved initial snapshot for {slug} at {output_path}")
                else:
                    old_content = output_path.read_text(encoding="utf-8")
                    cleaned_old = clean_html(old_content, slug)

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

                export_clean_snapshot_if_enabled(slug, cleaned_new, output_path.parent)
            except Exception as e:
                print(f"    - CRITICAL: Failed to write file for {url}. Reason: {e}", file=sys.stderr)
                failures.append({"url": url, "platform": slug, "reason": f"File write error: {e}"})

    # Create run log entry
    try:
        run_log_entry = {
            "timestamp_utc": run_start_time.isoformat().replace('+00:00', 'Z'),
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
